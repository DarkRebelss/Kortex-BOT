// SPDX-License-Identifier: AGPL-3.0-or-later

import {Permissions} from '../config/constants.js';
import {MicupApiClient} from '../api/MicupApiClient.js';
import {DatabaseClient} from '../database/DatabaseClient.js';
import {PermissionService} from './PermissionService.js';
import {ModerationService} from './ModerationService.js';
import {ModLogService} from './ModLogService.js';
import {t} from '../locales/i18n.js';
import type {FluxerGuild, FluxerMember, FluxerMessage, Snowflake} from '../types/fluxer.js';

interface MessageTrackerEntry {
  timestamps: number[];
  messageIds: Snowflake[];
}

export class AntiSpamService {
  // Map<guildId:userId, MessageTrackerEntry>
  private trackers = new Map<string, MessageTrackerEntry>();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly api: MicupApiClient,
    private readonly db: DatabaseClient,
    private readonly modService?: ModerationService,
    private readonly modLogService?: ModLogService,
  ) {
    // Periodic garbage collection: prune idle trackers older than 30 seconds to prevent memory leaks
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.trackers.entries()) {
        if (entry.timestamps.length === 0 || entry.timestamps.every((t) => now - t > 30_000)) {
          this.trackers.delete(key);
        }
      }
    }, 30_000);
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Process an incoming message and check for spam violations.
   * Returns true if message was spam and handled.
   */
  async handleMessage(
    guild: FluxerGuild,
    member: FluxerMember,
    message: FluxerMessage,
  ): Promise<boolean> {
    // Ignore bots
    if (member.user.bot) {
      return false;
    }

    const config = this.db.getGuildConfig(guild.id);
    if (!config.antispam_enabled) return false;

    // Check if member is a Server Owner, Administrator, or Exempt Moderator
    const isOwner = member.user.id === guild.owner_id;
    const isAdmin = PermissionService.hasPermission(guild, member, Permissions.ADMINISTRATOR);
    const exemptMods = config.antispam_exempt_mods !== undefined ? Boolean(config.antispam_exempt_mods) : true;
    const isExemptMod =
      exemptMods &&
      (PermissionService.hasPermission(guild, member, Permissions.MANAGE_MESSAGES) ||
        PermissionService.hasPermission(guild, member, Permissions.MANAGE_GUILD) ||
        PermissionService.hasPermission(guild, member, Permissions.MODERATE_MEMBERS));

    const isPrivileged = isOwner || isAdmin || isExemptMod;

    const key = `${guild.id}:${member.user.id}`;
    const now = Date.now();
    const intervalMs = (config.antispam_interval_seconds || 5) * 1000;
    const maxMessages = config.antispam_max_messages || 8;

    let tracker = this.trackers.get(key);
    if (!tracker) {
      tracker = {timestamps: [], messageIds: []};
      this.trackers.set(key, tracker);
    }

    // Filter out timestamps outside the sliding window
    const cutoff = now - intervalMs;
    const validIndices: number[] = [];
    tracker.timestamps = tracker.timestamps.filter((ts, idx) => {
      const keep = ts > cutoff;
      if (keep) validIndices.push(idx);
      return keep;
    });
    tracker.messageIds = tracker.messageIds.filter((_, idx) => validIndices.includes(idx));

    tracker.timestamps.push(now);
    tracker.messageIds.push(message.id);

    if (tracker.timestamps.length >= maxMessages) {
      // Spam detected!
      const toDelete = [...tracker.messageIds];
      this.trackers.delete(key); // Reset tracker

      console.warn(`[AntiSpamService] Spam detected from ${member.user.username} in guild ${guild.id}. Purging ${toDelete.length} messages.`);

      const durationSeconds = 300;
      const humanDuration = ModerationService.formatDuration(durationSeconds);
      const reason = `Otomatik Spam Koruması (${toDelete.length} mesaj / ${config.antispam_interval_seconds}sn)`;

      // 1. Delete spam messages
      try {
        if (toDelete.length > 1) {
          await this.api.bulkDeleteMessages(message.channel_id, toDelete, 'Anti-Spam automatic purge');
        } else {
          await this.api.deleteMessage(message.channel_id, message.id, 'Anti-Spam automatic purge');
        }
      } catch (err: any) {
        console.error(`[AntiSpamService] Failed to delete spam messages:`, err.message);
      }

      // 2. If member is a Manager/Admin/Owner:
      // Spam is caught and purged, but timeout is NOT applied.
      // Send an auto-deleting warning message instead!
      if (isPrivileged) {
        console.warn(`[AntiSpamService] Privileged member ${member.user.username} exceeded spam threshold. Mute bypassed, warning notice sent.`);
        const adminNotice = `⚠️ **<@${member.user.id}>**, çok hızlı mesaj gönderiyorsunuz! Yönetici/Yetkili olduğunuz için susturma (mute) uygulanmadı.`;
        try {
          const sentNotice = await this.api.sendMessage(message.channel_id, adminNotice);
          if (sentNotice?.id) {
            setTimeout(async () => {
              try {
                await this.api.deleteMessage(message.channel_id, sentNotice.id);
              } catch {}
            }, 5000);
          }
        } catch (err: any) {
          console.error(`[AntiSpamService] Failed to send admin spam notice:`, err.message);
        }

        if (this.modLogService) {
          void this.modLogService.sendModLog(guild.id, {
            action: 'SPAM_UYARISI (YÖNETİCİ)',
            target: member.user,
            reason: `Çok hızlı mesaj gönderimi (${toDelete.length} mesaj / ${config.antispam_interval_seconds}sn). Yönetici muafiyeti nedeniyle mute uygulanmadı.`,
            channelId: message.channel_id,
          });
        }

        return true;
      }

      // 3. Apply punishment (e.g. 5 minutes timeout) for regular members
      let expireUnix = Math.floor((Date.now() + durationSeconds * 1000) / 1000);
      let timeoutSucceeded = false;
      try {
        const updated = await this.api.timeoutMember(guild.id, member.user.id, durationSeconds, reason);
        timeoutSucceeded = true;
        if (updated?.communication_disabled_until) {
          const parsed = Math.floor(new Date(updated.communication_disabled_until).getTime() / 1000);
          if (!Number.isNaN(parsed) && parsed > 0) {
            expireUnix = parsed;
          }
        }
      } catch (err: any) {
        console.error(`[AntiSpamService] Failed to apply anti-spam timeout:`, err.message);
      }

      // If timeout failed (e.g. Discord 403 hierarchy error or invalid target), do not send fake timeout notice!
      if (!timeoutSucceeded) {
        return true;
      }

      // 3. Notify channel with dynamic ticking countdown
      const timeoutNotice =
        `⏳ **<@${member.user.id}>** kullanıcısına hızlı mesaj spamı sebebiyle **${humanDuration}** süreyle zamanaşımı uygulandı.\n` +
        `**Sebep:** ${reason}\n` +
        `**Bitiş:** <t:${expireUnix}:R> (<t:${expireUnix}:T>)`;

      let sentMsg: FluxerMessage | undefined;
      try {
        sentMsg = await this.api.sendMessage(message.channel_id, timeoutNotice);
      } catch (err: any) {
        console.error(`[AntiSpamService] Failed to send spam notification:`, err.message);
      }

      // 4. Register with ModerationService so it automatically updates to "Cezası bitti" on expiry or untimeout!
      if (this.modService && sentMsg?.id) {
        this.modService.registerTimeoutMessage({
          guildId: guild.id,
          userId: member.user.id,
          username: member.user.username,
          reason,
          durationText: humanDuration,
          durationSeconds,
          expireUnix,
          channelId: message.channel_id,
          messageId: sentMsg.id,
        });
      }

      // 5. Send log to mod-log channel!
      if (this.modLogService) {
        void this.modLogService.sendModLog(guild.id, {
          action: 'TIMEOUT (SPAM)',
          target: member.user,
          moderator: {
            id: 'SYSTEM',
            username: 'Anti-Spam Koruması',
          },
          reason: `${reason} (${humanDuration})`,
          channelId: message.channel_id,
        });
      }

      // 6. Log to DB
      this.db.addModerationLog(
        guild.id,
        'TIMEOUT',
        member.user.id,
        'SYSTEM',
        reason,
        message.channel_id,
        {duration: humanDuration, seconds: durationSeconds},
      );
      this.db.addModerationLog(
        guild.id,
        'ANTI_SPAM',
        member.user.id,
        'SYSTEM',
        `Automated Anti-Spam triggered (${toDelete.length} messages in ${config.antispam_interval_seconds}s)`,
        message.channel_id,
      );

      return true;
    }

    return false;
  }

  // -------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------

  configure(
    guild: FluxerGuild,
    invoker: FluxerMember,
    options: {
      enabled?: boolean;
      maxMessages?: number;
      intervalSeconds?: number;
      exemptMods?: boolean;
    },
  ): {success: boolean; message: string} {
    if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
      return {success: false, message: t('errors.no_permission')};
    }

    const updates: Record<string, unknown> = {};
    if (options.enabled !== undefined) updates.antispam_enabled = options.enabled ? 1 : 0;
    if (options.maxMessages !== undefined) updates.antispam_max_messages = options.maxMessages;
    if (options.intervalSeconds !== undefined) updates.antispam_interval_seconds = options.intervalSeconds;
    if (options.exemptMods !== undefined) updates.antispam_exempt_mods = options.exemptMods ? 1 : 0;

    this.db.updateGuildConfig(guild.id, updates as any);

    return this.getStatus(guild);
  }

  getStatus(guild: FluxerGuild): {success: boolean; message: string} {
    const cfg = this.db.getGuildConfig(guild.id);
    const exemptMods = Boolean((cfg as any).antispam_exempt_mods);
    return {
      success: true,
      message:
        `🛡️ Anti-Spam Koruması: **${cfg.antispam_enabled ? 'Aktif' : 'Devre Dışı'}**\n` +
        `• Maksimum Mesaj: ${cfg.antispam_max_messages}\n` +
        `• Zaman Aralığı: ${cfg.antispam_interval_seconds} saniye\n` +
        `• Yetkili Muafiyeti: **${exemptMods ? 'Açık (Yetkililer muaf)' : 'Kapalı (Tüm üyeler denetlenir)'}**`,
    };
  }
}
