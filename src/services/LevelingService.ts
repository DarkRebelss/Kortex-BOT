// SPDX-License-Identifier: AGPL-3.0-or-later

import {Permissions} from '../config/constants.js';
import {config} from '../config/env.js';
import type {MicupApiClient} from '../api/MicupApiClient.js';
import type {DatabaseClient, GuildUserLevelRecord} from '../database/DatabaseClient.js';
import {PermissionService} from './PermissionService.js';
import type {FluxerGuild, FluxerMember, FluxerMessage, FluxerUser, Snowflake} from '../types/fluxer.js';
import {resolveUserDisplayName, resolveUserDisplayNameSync, makeThenableResult} from '../utils/userResolver.js';

interface VoiceSessionEntry {
  guildId: Snowflake;
  userId: Snowflake;
  channelId: Snowflake;
  joinedAt: number;
  selfDeaf?: boolean;
}

export class LevelingService {
  private readonly textCooldowns = new Map<string, number>();
  private readonly voiceSessions = new Map<string, VoiceSessionEntry>();
  private voiceTicker?: NodeJS.Timeout;
  private cooldownCleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly api: MicupApiClient,
    private readonly db: DatabaseClient,
  ) {
    this.startVoiceTicker();
    // Periodic garbage collection: prune stale text cooldowns (> 120s) to prevent memory leaks
    this.cooldownCleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, ts] of this.textCooldowns.entries()) {
        if (now - ts > 120_000) {
          this.textCooldowns.delete(key);
        }
      }
    }, 60_000);
  }

  /**
   * Required XP formula for level progression.
   * Level 0 -> 1: 100 XP
   * Level 1 -> 2: 155 XP
   * Level 2 -> 3: 220 XP
   * Level 3 -> 4: 295 XP ...
   */
  getXpForLevel(level: number): number {
    return 5 * (level * level) + 50 * level + 100;
  }

  private startVoiceTicker(): void {
    if (this.voiceTicker) return;
    this.voiceTicker = setInterval(() => {
      void this.tickVoiceXP();
    }, 60_000);
  }

  stop(): void {
    if (this.voiceTicker) {
      clearInterval(this.voiceTicker);
      this.voiceTicker = undefined;
    }
    if (this.cooldownCleanupTimer) {
      clearInterval(this.cooldownCleanupTimer);
      this.cooldownCleanupTimer = undefined;
    }
  }

  /**
   * Tracks user voice state changes (join / leave voice channels).
   * Prevents AFK voice XP farming if user is self-deafened.
   */
  handleVoiceStateUpdate(
    guildId: Snowflake,
    userId: Snowflake,
    channelId: Snowflake | null,
    selfDeaf = false,
  ): void {
    const botId = config.botToken?.split('.')[0];
    if (botId && userId === botId) return;

    const key = `${guildId}:${userId}`;
    if (!channelId) {
      this.voiceSessions.delete(key);
    } else {
      const existing = this.voiceSessions.get(key);
      if (existing) {
        existing.channelId = channelId;
        existing.selfDeaf = selfDeaf;
      } else {
        this.voiceSessions.set(key, {guildId, userId, channelId, joinedAt: Date.now(), selfDeaf});
      }
    }
  }

  /**
   * Periodic voice XP distributor (runs every 60 seconds).
   */
  private async tickVoiceXP(): Promise<void> {
    if (this.voiceSessions.size === 0) return;

    for (const [key, session] of this.voiceSessions.entries()) {
      try {
        // Anti-AFK Farming: Skip deafened users
        if (session.selfDeaf) {
          continue;
        }

        const config = this.db.getGuildConfig(session.guildId);
        if ((config.leveling_enabled ?? 1) === 0) continue;

        const record = this.db.getGuildUserLevel(session.guildId, session.userId);
        const gainedXp = 10;
        let newXp = record.xp + gainedXp;
        let newLevel = record.level;
        const newVoiceSecs = record.voice_seconds + 60;
        let leveledUp = false;

        let needed = this.getXpForLevel(newLevel);
        while (newXp >= needed) {
          newXp -= needed;
          newLevel += 1;
          leveledUp = true;
          needed = this.getXpForLevel(newLevel);
        }

        this.db.updateGuildUserLevel(session.guildId, session.userId, {
          xp: newXp,
          level: newLevel,
          message_count: record.message_count,
          voice_seconds: newVoiceSecs,
        });

        if (leveledUp) {
          await this.processLevelUpRewards(session.guildId, session.userId, newLevel, config.leveling_channel_id);
        }
      } catch (err: any) {
        console.warn(`[LevelingService] Voice XP hatası (${key}):`, err.message);
      }
    }
  }

  /**
   * Handles text messages and awards text XP with 60-second cooldown.
   */
  async handleTextMessage(
    guild: FluxerGuild,
    member: FluxerMember,
    message: FluxerMessage,
  ): Promise<void> {
    if (member.user.bot) return;

    const config = this.db.getGuildConfig(guild.id);
    if ((config.leveling_enabled ?? 1) === 0) return;

    const key = `${guild.id}:${member.user.id}`;
    const now = Date.now();
    const lastXpTime = this.textCooldowns.get(key) || 0;

    const username = member.nick || member.user?.username || (member as any)?.user?.global_name || member.user?.id;
    const record = this.db.getGuildUserLevel(guild.id, member.user.id, username);
    const newMessageCount = record.message_count + 1;

    // Check 60-second cooldown
    if (now - lastXpTime < 60_000) {
      // Still update message_count without granting XP
      this.db.updateGuildUserLevel(guild.id, member.user.id, {
        username,
        message_count: newMessageCount,
      });
      return;
    }

    this.textCooldowns.set(key, now);

    // Random XP between 15 and 25
    const gainedXp = Math.floor(Math.random() * 11) + 15;
    let newXp = record.xp + gainedXp;
    let newLevel = record.level;
    let leveledUp = false;

    let needed = this.getXpForLevel(newLevel);
    while (newXp >= needed) {
      newXp -= needed;
      newLevel += 1;
      leveledUp = true;
      needed = this.getXpForLevel(newLevel);
    }

    this.db.updateGuildUserLevel(guild.id, member.user.id, {
      username,
      xp: newXp,
      level: newLevel,
      message_count: newMessageCount,
      last_message_unix: Math.floor(now / 1000),
    });

    if (leveledUp) {
      const targetChannelId = config.leveling_channel_id || message.channel_id;
      await this.processLevelUpRewards(guild.id, member.user.id, newLevel, targetChannelId);
    }
  }

  /**
   * Awards roles and sends level-up announcement.
   */
  private async processLevelUpRewards(
    guildId: Snowflake,
    userId: Snowflake,
    newLevel: number,
    channelId?: Snowflake | null,
  ): Promise<void> {
    // 1. Check Level Roles
    const roles = this.db.getLevelRoles(guildId);
    const matchingRoles = roles.filter((r) => r.level <= newLevel);

    for (const r of matchingRoles) {
      try {
        await this.api.addMemberRole(guildId, userId, r.role_id, `Seviye Atlama Ödülü (Seviye ${newLevel})`);
      } catch (err: any) {
        console.warn(`[LevelingService] Seviye rolü eklenemedi (${r.role_id}):`, err.message);
      }
    }

    // 2. Announce in designated channel
    if (channelId) {
      try {
        const guildCfg = this.db.getGuildConfig(guildId);
        let announcement = guildCfg?.leveling_message ||
          `🎉 **Tebrikler <@${userId}>!** Sunucudaki sohbet ve etkinliğin sayesinde **Seviye ${newLevel}** seviyesine ulaştın! 🚀`;
        announcement = announcement
          .replaceAll('{user}', `<@${userId}>`)
          .replaceAll('{level}', String(newLevel));
        const sent = await this.api.sendMessage(channelId, announcement);
        if (sent?.id) {
          setTimeout(() => {
            void this.api.deleteMessage(channelId, sent.id, 'Level Up Notice Auto Cleanup').catch(() => {});
          }, 12_000);
        }
      } catch (err: any) {
        console.warn(`[LevelingService] Seviye duyurusu gönderilemedi:`, err.message);
      }
    }
  }

  // -------------------------------------------------------------
  // User Commands: /rank, /topxp
  // -------------------------------------------------------------

  getRank(guild: FluxerGuild, targetUser: FluxerUser): { success: boolean; message: string } {
    const record = this.db.getGuildUserLevel(guild.id, targetUser.id);
    const rankInfo = this.db.getGuildUserRank(guild.id, targetUser.id);
    const neededXp = this.getXpForLevel(record.level);

    // Build progress bar
    const progress = Math.min(1, Math.max(0, record.xp / neededXp));
    const barLength = 12;
    const filled = Math.round(progress * barLength);
    const empty = Math.max(0, barLength - filled);
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percent = Math.floor(progress * 100);

    // Format voice time
    const voiceHours = Math.floor(record.voice_seconds / 3600);
    const voiceMins = Math.floor((record.voice_seconds % 3600) / 60);
    const voiceStr = voiceHours > 0 ? `${voiceHours} saat ${voiceMins} dakika` : `${voiceMins} dakika`;

    const lines: string[] = [
      `📊 **Sunucu Seviye & Sıralama Kartı**`,
      `────────────────────────────────────────`,
      `👤 **Kullanıcı:** <@${targetUser.id}> (\`${targetUser.username}\`)`,
      `🏆 **Sunucu Sıralaması:** \`#${rankInfo.rank} / ${rankInfo.total}\``,
      `⭐ **Mevcut Seviye:** \`Seviye ${record.level}\``,
      `✨ **Deneyim Puanı (XP):** \`${record.xp} / ${neededXp} XP\` (\`%${percent}\`)`,
      `📈 **İlerleme:** \`[${bar}]\``,
      `💬 **Toplam Mesaj:** \`${record.message_count} adet\``,
      `🎙️ **Ses Süresi:** \`${voiceStr}\``,
      `────────────────────────────────────────`,
    ];

    return {
      success: true,
      message: lines.join('\n'),
    };
  }

  getTopXP(
    guild: FluxerGuild,
    limit = 10,
    invokerId?: Snowflake,
  ): Promise<{ success: boolean; message: string }> & { success: boolean; message: string } {
    const topUsers = this.db.getTopGuildUserLevels(guild.id, limit);

    if (topUsers.length === 0) {
      const emptyRes = {
        success: true,
        message:
          '🏆 **Sunucu Seviye Liderlik Tablosu**\n\n*Henüz hiçbir üye mesaj yazarak veya ses odalarında kalarak XP kazanmadı.*',
      };
      return makeThenableResult(emptyRes, Promise.resolve(emptyRes));
    }

    const buildLines = (namesMap: Map<string, string>) => {
      const lines: string[] = [
        `🏆 **${guild.name} — En Yüksek Seviye & XP Liderlik Tablosu**`,
        `────────────────────────────────────────`,
      ];

      for (let idx = 0; idx < topUsers.length; idx++) {
        const u = topUsers[idx];
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `**#${idx + 1}**`;
        const needed = this.getXpForLevel(u.level);
        const voiceHours = Math.floor(u.voice_seconds / 3600);
        const voiceMins = Math.floor((u.voice_seconds % 3600) / 60);
        const voiceStr = voiceHours > 0 ? `${voiceHours}s ${voiceMins}dk` : `${voiceMins}dk`;

        let userDisplay: string;
        if (invokerId !== undefined) {
          if (u.user_id === invokerId) {
            userDisplay = `<@${u.user_id}>`;
          } else {
            const name = namesMap.get(u.user_id) || resolveUserDisplayNameSync(this.db, guild, u.user_id, u.username || undefined);
            userDisplay = `**${name}**`;
          }
        } else {
          userDisplay = `<@${u.user_id}>`;
        }

        lines.push(
          `${medal} ${userDisplay} ➔ **Seviye ${u.level}** (\`${u.xp}/${needed} XP\`) • 💬 \`${u.message_count} msj\` • 🎙️ \`${voiceStr}\``,
        );
      }

      lines.push('────────────────────────────────────────');
      lines.push(`💡 *Sohbet ederek ve ses kanallarında vakit geçirerek seviye atlayabilirsiniz!*`);
      return lines.join('\n');
    };

    const syncMap = new Map<string, string>();
    for (const u of topUsers) {
      syncMap.set(u.user_id, resolveUserDisplayNameSync(this.db, guild, u.user_id, u.username || undefined));
    }

    const syncResult = {
      success: true,
      message: buildLines(syncMap),
    };

    const asyncPromise = (async () => {
      const asyncMap = new Map<string, string>(syncMap);
      let anyChanged = false;
      for (const u of topUsers) {
        const curr = asyncMap.get(u.user_id);
        if (!curr || curr.startsWith('Kullanıcı')) {
          const fresh = await resolveUserDisplayName(this.api, this.db, guild, u.user_id, u.username || undefined);
          if (fresh && fresh !== curr) {
            asyncMap.set(u.user_id, fresh);
            anyChanged = true;
            if (!fresh.startsWith('Kullanıcı_')) {
              this.db.updateGuildUserLevel(guild.id, u.user_id, { username: fresh });
            }
          }
        }
      }
      return {
        success: true,
        message: anyChanged ? buildLines(asyncMap) : syncResult.message,
      };
    })();

    return makeThenableResult(syncResult, asyncPromise);
  }

  // -------------------------------------------------------------
  // Admin Management Commands: /leveling, /levelrole
  // -------------------------------------------------------------

  toggle(guild: FluxerGuild, invoker: FluxerMember, enabled: boolean): { success: boolean; message: string } {
    if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
      return {success: false, message: '❌ Bu ayarı değiştirmek için **Sunucuyu Yönet (MANAGE_GUILD)** yetkisine sahip olmalısınız.'};
    }

    this.db.updateGuildConfig(guild.id, {
      leveling_enabled: enabled ? 1 : 0,
    });

    return {
      success: true,
      message: enabled
        ? '📈 **Seviye Sistemi Aktif:** Üyeler metin mesajı gönderdikçe ve ses kanallarında kaldıkça XP kazanacak ve seviye atlayacaktır.'
        : '⚠️ **Seviye Sistemi Kapatıldı:** Sunucu geneli XP ve seviye kazanımı durduruldu.',
    };
  }

  setChannel(guild: FluxerGuild, invoker: FluxerMember, channelId: Snowflake | null): { success: boolean; message: string } {
    if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
      return {success: false, message: '❌ Bu ayarı değiştirmek için **Sunucuyu Yönet (MANAGE_GUILD)** yetkisine sahip olmalısınız.'};
    }

    this.db.updateGuildConfig(guild.id, {
      leveling_channel_id: channelId,
    });

    return {
      success: true,
      message: channelId
        ? `📢 **Seviye Bildirim Kanalı Ayarlandı:** Seviye atlama tebrik mesajları artık <#${channelId}> kanalına gönderilecektir.`
        : '📢 **Seviye Bildirim Kanalı Sıfırlandı:** Tebrik mesajları kullanıcının seviye atladığı anlık kanala gönderilecektir.',
    };
  }

  addLevelRole(guild: FluxerGuild, invoker: FluxerMember, level: number, roleId: Snowflake): { success: boolean; message: string } {
    if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_ROLES)) {
      return {success: false, message: '❌ Seviye rolü eklemek için **Rolleri Yönet (MANAGE_ROLES)** yetkisine sahip olmalısınız.'};
    }

    if (level < 1 || level > 100) {
      return {success: false, message: '❌ Seviye 1 ile 100 arasında bir sayı olmalıdır.'};
    }

    this.db.addLevelRole(guild.id, level, roleId);

    return {
      success: true,
      message: `🎖️ **Seviye Rol Ödülü Eklendi:** Kullanıcılar **Seviye ${level}** seviyesine ulaştığında <@&${roleId}> rolü otomatik olarak verilecektir!`,
    };
  }

  removeLevelRole(guild: FluxerGuild, invoker: FluxerMember, level: number): { success: boolean; message: string } {
    if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_ROLES)) {
      return {success: false, message: '❌ Seviye rolü silmek için **Rolleri Yönet (MANAGE_ROLES)** yetkisine sahip olmalısınız.'};
    }

    const removed = this.db.removeLevelRole(guild.id, level);
    if (!removed) {
      return {success: false, message: `❌ **Seviye ${level}** için ayarlanmış bir seviye rolü bulunamadı.`};
    }

    return {
      success: true,
      message: `🗑️ **Seviye Rol Ödülü Kaldırıldı:** Seviye ${level} için rol ödülü silindi.`,
    };
  }

  listLevelRoles(guild: FluxerGuild): { success: boolean; message: string } {
    const roles = this.db.getLevelRoles(guild.id);

    const lines: string[] = [
      `🎖️ **${guild.name} — Seviye Rol Ödülleri Listesi**`,
      `────────────────────────────────────────`,
    ];

    if (roles.length === 0) {
      lines.push('*Henüz hiçbir seviye rolü ayarlanmamış.*');
      lines.push('`/levelrole add <seviye> <@rol>` ile yeni seviye rolü ekleyebilirsiniz.');
    } else {
      roles.forEach((r) => {
        lines.push(`• **Seviye ${r.level}:** <@&${r.role_id}> (\`${r.role_id}\`)`);
      });
    }

    lines.push('────────────────────────────────────────');

    return {
      success: true,
      message: lines.join('\n'),
    };
  }
}
