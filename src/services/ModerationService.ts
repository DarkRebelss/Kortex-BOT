// SPDX-License-Identifier: AGPL-3.0-or-later

import {Permissions} from '../config/constants.js';
import {MicupApiClient} from '../api/MicupApiClient.js';
import {DatabaseClient} from '../database/DatabaseClient.js';
import {PermissionService} from './PermissionService.js';
import {t} from '../locales/i18n.js';
import type {FluxerChannel, FluxerGuild, FluxerMember, Snowflake} from '../types/fluxer.js';

export interface CommandExecutionResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface ActiveTimeoutMessageRef {
  channelId: Snowflake;
  messageId: Snowflake;
  type: 'mute' | 'info';
}

export interface ActiveTimeoutEntry {
  guildId: Snowflake;
  userId: Snowflake;
  username: string;
  reason: string;
  durationText: string;
  expireUnix: number;
  timer: NodeJS.Timeout;
  messageRefs: ActiveTimeoutMessageRef[];
}

export class ModerationService {
  private readonly activeTimeouts = new Map<string, ActiveTimeoutEntry>();
  private readonly activeTempBans = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly api: MicupApiClient,
    private readonly db: DatabaseClient,
  ) {
    this.restoreActiveTimeouts();
    this.restoreActiveTempBans();
  }

  private restoreActiveTempBans(): void {
    try {
      const records = this.db.getAllActiveTempBans();
      if (!records || records.length === 0) return;
      const now = Math.floor(Date.now() / 1000);
      for (const rec of records) {
        const remainingSeconds = rec.expire_unix - now;
        if (remainingSeconds <= 0) {
          void this.onTempBanExpired(rec.guild_id, rec.user_id);
        } else {
          const key = `${rec.guild_id}:${rec.user_id}`;
          const timer = setTimeout(() => {
            void this.onTempBanExpired(rec.guild_id, rec.user_id);
          }, remainingSeconds * 1000);
          this.activeTempBans.set(key, timer);
        }
      }
    } catch (err: any) {
      console.warn('[ModerationService] Error restoring active tempbans:', err.message);
    }
  }

  private async onTempBanExpired(guildId: string, userId: string): Promise<void> {
    const key = `${guildId}:${userId}`;
    const timer = this.activeTempBans.get(key);
    if (timer) {
      clearTimeout(timer);
      this.activeTempBans.delete(key);
    }
    this.db.removeTempBan(guildId, userId);
    try {
      await this.api.unbanMember(guildId, userId, 'Süreli ban (TempBan) süresi sona erdi.');
      this.db.addModerationLog(guildId, 'UNBAN', userId, 'SYSTEM', 'Süreli ban süresi sona erdi (Otomatik kaldırıldı).');
      console.log(`[ModerationService] 🔓 Süreli ban süresi sona erdi ve kaldırıldı: Sunucu ${guildId}, Kullanıcı ${userId}`);
    } catch (err: any) {
      console.warn(`[ModerationService] Otomatik unban hatası (${guildId}, ${userId}):`, err.message);
    }
  }

  private restoreActiveTimeouts(): void {
    try {
      const records = this.db.getAllActiveTimeoutMessages();
      if (!records || records.length === 0) return;

      const grouped = new Map<string, typeof records>();
      for (const rec of records) {
        const key = `${rec.guild_id}:${rec.user_id}`;
        let list = grouped.get(key);
        if (!list) {
          list = [];
          grouped.set(key, list);
        }
        list.push(rec);
      }

      const now = Date.now();
      for (const [key, list] of grouped.entries()) {
        const first = list[0];
        const remainingMs = first.expire_unix * 1000 - now;

        if (remainingMs <= 0) {
          // Expired while bot was restarting/offline
          void this.onTimeoutExpired(first.guild_id, first.user_id);
        } else {
          // Reschedule timer
          const timer = setTimeout(() => {
            void this.onTimeoutExpired(first.guild_id, first.user_id);
          }, remainingMs);

          this.activeTimeouts.set(key, {
            guildId: first.guild_id,
            userId: first.user_id,
            username: first.username,
            reason: first.reason,
            durationText: first.duration_text,
            expireUnix: first.expire_unix,
            timer,
            messageRefs: list.map((r) => ({
              channelId: r.channel_id,
              messageId: r.message_id,
              type: r.message_type as 'mute' | 'info',
            })),
          });
        }
      }
    } catch (err: any) {
      console.warn(`[ModerationService] Error restoring active timeouts:`, err.message);
    }
  }

  /**
   * Parse duration string like 10s, 10sn, 10, 5m, 5dk, 1h, 1saat, 1d, 7d into seconds.
   * If only digits provided (e.g. "10"), defaults to seconds.
   */
  static parseDuration(input: string): number | null {
    if (!input) return null;
    const clean = input.trim().toLowerCase();

    // Plain digits -> default to seconds (e.g. "10" -> 10 seconds)
    if (/^\d+$/.test(clean)) {
      return Number.parseInt(clean, 10);
    }

    const match = clean.match(
      /^(\d+)\s*(s|sn|saniye|sec|secs|second|seconds|m|dk|dakika|min|mins|minute|minutes|h|sa|saat|hr|hrs|hour|hours|d|g|gun|gün|day|days|w|hf|hafta|week|weeks)$/,
    );
    if (!match) return null;

    const amount = Number.parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
      case 'sn':
      case 'saniye':
      case 'sec':
      case 'secs':
      case 'second':
      case 'seconds':
        return amount;

      case 'm':
      case 'dk':
      case 'dakika':
      case 'min':
      case 'mins':
      case 'minute':
      case 'minutes':
        return amount * 60;

      case 'h':
      case 'sa':
      case 'saat':
      case 'hr':
      case 'hrs':
      case 'hour':
      case 'hours':
        return amount * 3600;

      case 'd':
      case 'g':
      case 'gun':
      case 'gün':
      case 'day':
      case 'days':
        return amount * 86400;

      case 'w':
      case 'hf':
      case 'hafta':
      case 'week':
      case 'weeks':
        return amount * 604800;

      default:
        return null;
    }
  }

  /**
   * Format seconds into a friendly Turkish description.
   */
  static formatDuration(seconds: number): string {
    if (seconds <= 0) return '0 saniye';
    if (seconds < 60) return `${seconds} saniye`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const remSec = seconds % 60;
      return remSec > 0 ? `${mins} dakika ${remSec} saniye` : `${mins} dakika`;
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      const remMins = Math.floor((seconds % 3600) / 60);
      return remMins > 0 ? `${hours} saat ${remMins} dakika` : `${hours} saat`;
    }
    if (seconds < 604800) {
      const days = Math.floor(seconds / 86400);
      const remHours = Math.floor((seconds % 86400) / 3600);
      return remHours > 0 ? `${days} gün ${remHours} saat` : `${days} gün`;
    }
    const weeks = Math.floor(seconds / 604800);
    const remDays = Math.floor((seconds % 604800) / 86400);
    return remDays > 0 ? `${weeks} hafta ${remDays} gün` : `${weeks} hafta`;
  }

  async ban(
    guild: FluxerGuild,
    invoker: FluxerMember,
    botMember: FluxerMember,
    target: FluxerMember,
    reason = 'No reason provided',
    durationInput?: string,
  ): Promise<CommandExecutionResult> {
    const validation = PermissionService.validateModerationAction(
      guild,
      invoker,
      botMember,
      target,
      Permissions.BAN_MEMBERS,
      'BAN_MEMBERS',
    );

    if (!validation.allowed) {
      return {success: false, message: t(validation.errorKey!, validation.params)};
    }

    let durationSeconds: number | null = null;
    let humanDuration = '';
    let expireUnix: number | null = null;

    if (durationInput) {
      durationSeconds = ModerationService.parseDuration(durationInput);
      if (durationSeconds && durationSeconds > 0) {
        humanDuration = ModerationService.formatDuration(durationSeconds);
        expireUnix = Math.floor(Date.now() / 1000) + durationSeconds;
      }
    }

    try {
      await this.api.banMember(guild.id, target.user.id, reason);

      this.db.addModerationLog(
        guild.id,
        'BAN',
        target.user.id,
        invoker.user.id,
        expireUnix ? `${reason} (Süre: ${humanDuration})` : reason,
      );

      if (expireUnix && durationSeconds) {
        this.db.addTempBan(
          guild.id,
          target.user.id,
          invoker.user.id,
          reason,
          humanDuration,
          durationSeconds,
          expireUnix,
        );
        const key = `${guild.id}:${target.user.id}`;
        const existingTimer = this.activeTempBans.get(key);
        if (existingTimer) clearTimeout(existingTimer);

        const timer = setTimeout(() => {
          void this.onTempBanExpired(guild.id, target.user.id);
        }, durationSeconds * 1000);
        this.activeTempBans.set(key, timer);

        return {
          success: true,
          message: `🔨 **${target.user.username}** sunucudan **${humanDuration}** süreliğine yasaklandı!\n• **Kalan Süre:** <t:${expireUnix}:R> (<t:${expireUnix}:F>)\n• **Sebep:** ${reason}\n• **Yetkili:** <@${invoker.user.id}>`,
          data: { expireUnix, durationSeconds, humanDuration },
        };
      }

      return {
        success: true,
        message: t('moderation.ban_success', {
          target: target.user.username,
          reason,
          moderator: invoker.user.username,
        }),
      };
    } catch (err: any) {
      return {success: false, message: t('errors.command_error', {error: err.message})};
    }
  }

  async unban(
    guild: FluxerGuild,
    invoker: FluxerMember,
    botMember: FluxerMember,
    targetUserId: Snowflake,
    targetTag?: string,
  ): Promise<CommandExecutionResult> {
    if (!PermissionService.hasPermission(guild, invoker, Permissions.BAN_MEMBERS)) {
      return {success: false, message: t('errors.no_permission')};
    }
    if (!PermissionService.hasPermission(guild, botMember, Permissions.BAN_MEMBERS)) {
      return {success: false, message: t('errors.bot_missing_permission', {permission: 'BAN_MEMBERS'})};
    }

    try {
      await this.api.unbanMember(guild.id, targetUserId);

      // Cancel tempban timer if active
      const key = `${guild.id}:${targetUserId}`;
      const timer = this.activeTempBans.get(key);
      if (timer) {
        clearTimeout(timer);
        this.activeTempBans.delete(key);
      }
      this.db.removeTempBan(guild.id, targetUserId);

      this.db.addModerationLog(
        guild.id,
        'UNBAN',
        targetUserId,
        invoker.user.id,
        `Unbanned ${targetTag || targetUserId}`,
      );

      return {
        success: true,
        message: t('moderation.unban_success', {
          target: targetTag || targetUserId,
          moderator: invoker.user.username,
        }),
      };
    } catch (err: any) {
      if (
        err.message &&
        (err.message.includes('404') ||
          err.message.toLowerCase().includes('unknown ban') ||
          err.message.toLowerCase().includes('not found'))
      ) {
        return {
          success: false,
          message: t('moderation.unban_not_banned', {target: targetTag || targetUserId}),
        };
      }
      return {success: false, message: t('errors.command_error', {error: err.message})};
    }
  }

  async kick(
    guild: FluxerGuild,
    invoker: FluxerMember,
    botMember: FluxerMember,
    target: FluxerMember,
    reason = 'No reason provided',
  ): Promise<CommandExecutionResult> {
    const validation = PermissionService.validateModerationAction(
      guild,
      invoker,
      botMember,
      target,
      Permissions.KICK_MEMBERS,
      'KICK_MEMBERS',
    );

    if (!validation.allowed) {
      return {success: false, message: t(validation.errorKey!, validation.params)};
    }

    try {
      await this.api.kickMember(guild.id, target.user.id, reason);

      this.db.addModerationLog(
        guild.id,
        'KICK',
        target.user.id,
        invoker.user.id,
        reason,
      );

      return {
        success: true,
        message: t('moderation.kick_success', {
          target: target.user.username,
          reason,
          moderator: invoker.user.username,
        }),
      };
    } catch (err: any) {
      return {success: false, message: t('errors.command_error', {error: err.message})};
    }
  }

  async timeout(
    guild: FluxerGuild,
    invoker: FluxerMember,
    botMember: FluxerMember,
    target: FluxerMember,
    durationInput: string,
    reason = 'No reason provided',
  ): Promise<CommandExecutionResult> {
    const durationSeconds = ModerationService.parseDuration(durationInput);
    if (!durationSeconds || durationSeconds <= 0) {
      return {success: false, message: t('errors.invalid_duration')};
    }

    const validation = PermissionService.validateModerationAction(
      guild,
      invoker,
      botMember,
      target,
      Permissions.MODERATE_MEMBERS,
      'MODERATE_MEMBERS',
    );

    if (!validation.allowed) {
      return {success: false, message: t(validation.errorKey!, validation.params)};
    }

    try {
      const updated = await this.api.timeoutMember(guild.id, target.user.id, durationSeconds, reason);

      const humanDuration = ModerationService.formatDuration(durationSeconds);
      this.db.addModerationLog(
        guild.id,
        'TIMEOUT',
        target.user.id,
        invoker.user.id,
        reason,
        null,
        {duration: humanDuration, seconds: durationSeconds},
      );

      // Calculate unix seconds for dynamic live countdown (<t:unix:R>) and exact clock time (<t:unix:T>)
      const expireUnix = updated?.communication_disabled_until
        ? Math.floor(new Date(updated.communication_disabled_until).getTime() / 1000)
        : Math.floor((Date.now() + durationSeconds * 1000) / 1000);
      const expiresAtFormatted = `<t:${expireUnix}:R> (<t:${expireUnix}:T>)`;

      return {
        success: true,
        message: t('moderation.timeout_success', {
          target: target.user.username,
          duration: humanDuration,
          reason,
          expiresAt: expiresAtFormatted,
        }),
        data: {
          durationSeconds,
          humanDuration,
          expireUnix,
        },
      };
    } catch (err: any) {
      if (err.message && (err.message.includes('403') || err.message.toLowerCase().includes('permissions required'))) {
        return {
          success: false,
          message:
            '❌ **Zamanaşımı uygulanamadı (Discord Yetki / Hiyerarşi Hatası [403])!**\n' +
            '• **Bot Rolü:** Sunucu Ayarları > Roller bölümünden botun rolünü hedef kullanıcının rolünün **üstüne** taşıyın.\n' +
            '• **Yönetici Koruması:** Hedef kullanıcı Yönetici (Administrator) yetkisine sahipse Discord timeout uygulanmasına izin vermez.\n' +
            '• **Bot İzni:** Botun rolünde **"Üyeleri Zamanaşımına Uğrat / Yönet (Moderate Members)"** yetkisinin açık olduğundan emin olun.',
        };
      }
      return {success: false, message: t('errors.command_error', {error: err.message})};
    }
  }

  async untimeout(
    guild: FluxerGuild,
    invoker: FluxerMember,
    botMember: FluxerMember,
    target: FluxerMember,
  ): Promise<CommandExecutionResult> {
    const validation = PermissionService.validateModerationAction(
      guild,
      invoker,
      botMember,
      target,
      Permissions.MODERATE_MEMBERS,
      'UNTIMEOUT',
    );

    if (!validation.allowed) {
      return {success: false, message: t(validation.errorKey!, validation.params)};
    }

    try {
      await this.api.untimeoutMember(guild.id, target.user.id);

      this.db.addModerationLog(
        guild.id,
        'UNTIMEOUT',
        target.user.id,
        invoker.user.id,
      );

      // Immediately cancel any active countdown and update message(s) to "Cezası bitti"
      await this.handleEarlyUntimeout(guild.id, target.user.id, invoker.user.username);

      return {
        success: true,
        message: t('moderation.untimeout_success', {
          target: target.user.username,
          moderator: invoker.user.username,
        }),
      };
    } catch (err: any) {
      return {success: false, message: t('errors.command_error', {error: err.message})};
    }
  }

  /**
   * Check if a member has an active timeout/mute and return detailed remaining countdown.
   */
  async getTimeoutStatus(
    guild: FluxerGuild,
    target: FluxerMember,
  ): Promise<CommandExecutionResult> {
    const key = `${guild.id}:${target.user.id}`;
    const tracked = this.activeTimeouts.get(key);

    let freshMember = target;
    try {
      const fetched = await this.api.getGuildMember(guild.id, target.user.id);
      if (fetched) freshMember = fetched;
    } catch {}

    const now = Date.now();
    let expireMs: number | null = null;

    if (tracked) {
      expireMs = tracked.expireUnix * 1000;
    } else if (freshMember.communication_disabled_until) {
      const parsed = new Date(freshMember.communication_disabled_until).getTime();
      if (!Number.isNaN(parsed) && parsed > now) {
        expireMs = parsed;
      }
    }

    // Fallback: If Discord API response omitted communication_disabled_until (undefined), check latest DB action
    if (!expireMs && !tracked && freshMember.communication_disabled_until === undefined) {
      const latestAction = this.db.getLatestModerationLog(guild.id, target.user.id);
      if (latestAction && latestAction.action_type === 'TIMEOUT' && latestAction.details) {
        try {
          const details =
            typeof latestAction.details === 'string'
              ? JSON.parse(latestAction.details)
              : latestAction.details;
          if (details?.seconds && typeof details.seconds === 'number') {
            const logCreatedAt = new Date(latestAction.created_at).getTime();
            const calculatedExpire = logCreatedAt + details.seconds * 1000;
            if (calculatedExpire > now) {
              expireMs = calculatedExpire;
            }
          }
        } catch {}
      }
    }

    const username = target.user.username;

    if (!expireMs || expireMs <= now) {
      return {
        success: true,
        message: `✨ **${username}** kullanıcısının şu anda aktif bir zamanaşımı (timeout/mute) cezası bulunmuyor (Cezası bitti).`,
        data: {isActive: false},
      };
    }

    const expireUnix = Math.floor(expireMs / 1000);

    const latestLog = this.db.getLatestModerationLog(guild.id, target.user.id, 'TIMEOUT');
    const reasonText = tracked?.reason || latestLog?.reason || 'Belirtilmedi';
    const moderatorText = latestLog?.moderator_id ? `<@${latestLog.moderator_id}>` : 'Bilinmiyor';

    const lines = [
      `⏳ **${username}** kullanıcısının aktif bir zamanaşımı (timeout) cezası bulunuyor:`,
      `• ⏱️ **Kalan Süre:** <t:${expireUnix}:R>`,
      `• 📅 **Bitiş Zamanı:** <t:${expireUnix}:F> (<t:${expireUnix}:T>)`,
      `• 📝 **Sebep:** ${reasonText}`,
      `• 🛡️ **Uygulayan Yetkili:** ${moderatorText}`,
    ];

    return {
      success: true,
      message: lines.join('\n'),
      data: {isActive: true, expireUnix},
    };
  }

  /**
   * Check if a member has an active timeout registered in memory or DB.
   */
  hasActiveTimeout(guildId: Snowflake, userId: Snowflake): boolean {
    const key = `${guildId}:${userId}`;
    if (this.activeTimeouts.has(key)) return true;
    try {
      const records = this.db.getActiveTimeoutMessages(guildId, userId);
      return records.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Register a sent timeout/mute message to automatically edit it when the timeout expires.
   */
  registerTimeoutMessage(params: {
    guildId: Snowflake;
    userId: Snowflake;
    username: string;
    reason: string;
    durationText: string;
    durationSeconds: number;
    expireUnix: number;
    channelId: Snowflake;
    messageId: Snowflake;
  }): void {
    const key = `${params.guildId}:${params.userId}`;
    const existing = this.activeTimeouts.get(key);
    if (existing) {
      clearTimeout(existing.timer);
    }

    const timer = setTimeout(() => {
      void this.onTimeoutExpired(params.guildId, params.userId);
    }, Math.max(1000, params.durationSeconds * 1000));

    this.activeTimeouts.set(key, {
      guildId: params.guildId,
      userId: params.userId,
      username: params.username,
      reason: params.reason,
      durationText: params.durationText,
      expireUnix: params.expireUnix,
      timer,
      messageRefs: [{channelId: params.channelId, messageId: params.messageId, type: 'mute'}],
    });

    try {
      this.db.saveActiveTimeoutMessage({
        guildId: params.guildId,
        userId: params.userId,
        username: params.username,
        reason: params.reason,
        durationText: params.durationText,
        durationSeconds: params.durationSeconds,
        expireUnix: params.expireUnix,
        channelId: params.channelId,
        messageId: params.messageId,
        messageType: 'mute',
      });
    } catch (err: any) {
      console.warn(`[ModerationService] saveActiveTimeoutMessage failed:`, err.message);
    }
  }

  /**
   * Register an info/status check message to also update when the penalty finishes.
   */
  registerInfoMessage(
    guildId: Snowflake,
    userId: Snowflake,
    channelId: Snowflake,
    messageId: Snowflake,
  ): void {
    const key = `${guildId}:${userId}`;
    const active = this.activeTimeouts.get(key);
    if (active) {
      active.messageRefs.push({channelId, messageId, type: 'info'});
      try {
        this.db.saveActiveTimeoutMessage({
          guildId,
          userId,
          username: active.username,
          reason: active.reason,
          durationText: active.durationText,
          durationSeconds: Math.max(1, active.expireUnix - Math.floor(Date.now() / 1000)),
          expireUnix: active.expireUnix,
          channelId,
          messageId,
          messageType: 'info',
        });
      } catch (err: any) {
        console.warn(`[ModerationService] saveActiveTimeoutMessage info failed:`, err.message);
      }
    }
  }

  /**
   * Handler when a timeout's timer reaches 0 naturally.
   */
  async onTimeoutExpired(guildId: Snowflake, userId: Snowflake): Promise<void> {
    const key = `${guildId}:${userId}`;
    const active = this.activeTimeouts.get(key);
    this.activeTimeouts.delete(key);

    let dbRecords: Array<{
      channel_id: string;
      message_id: string;
      message_type: string;
      username: string;
      duration_text: string;
      reason: string;
      expire_unix: number;
    }> = [];
    try {
      dbRecords = this.db.getActiveTimeoutMessages(guildId, userId);
      this.db.deleteActiveTimeoutMessages(guildId, userId);
    } catch (err: any) {
      console.warn(`[ModerationService] deleteActiveTimeoutMessages failed:`, err.message);
    }

    try {
      this.db.addModerationLog(
        guildId,
        'TIMEOUT_EXPIRED',
        userId,
        'SYSTEM',
        'Timeout duration finished',
      );
    } catch {}

    const combinedRefs = new Map<
      string,
      {
        channelId: string;
        messageId: string;
        type: 'mute' | 'info';
        username: string;
        durationText: string;
        reason: string;
        expireUnix: number;
      }
    >();

    if (active) {
      for (const ref of active.messageRefs) {
        combinedRefs.set(`${ref.channelId}:${ref.messageId}`, {
          channelId: ref.channelId,
          messageId: ref.messageId,
          type: ref.type,
          username: active.username,
          durationText: active.durationText,
          reason: active.reason,
          expireUnix: active.expireUnix,
        });
      }
    }

    for (const rec of dbRecords) {
      const recKey = `${rec.channel_id}:${rec.message_id}`;
      if (!combinedRefs.has(recKey)) {
        combinedRefs.set(recKey, {
          channelId: rec.channel_id,
          messageId: rec.message_id,
          type: (rec.message_type as 'mute' | 'info') || 'mute',
          username: rec.username || active?.username || 'Kullanıcı',
          durationText: rec.duration_text || active?.durationText || 'Belirtilmedi',
          reason: rec.reason || active?.reason || 'Belirtilmedi',
          expireUnix: rec.expire_unix || active?.expireUnix || Math.floor(Date.now() / 1000),
        });
      }
    }

    for (const item of combinedRefs.values()) {
      try {
        if (item.type === 'mute') {
          const content =
            `✅ **${item.username}** kullanıcısının **${item.durationText}** süreli zamanaşımı (mute) cezası bitti.\n` +
            `**Sebep:** ${item.reason}\n` +
            `**Durum:** ⌛ Süresi doldu (Cezası bitti)`;
          if (typeof this.api.editMessage === 'function') {
            await this.api.editMessage(item.channelId, item.messageId, content);
          }
        } else if (item.type === 'info') {
          const content =
            `✅ **${item.username}** kullanıcısının zamanaşımı (timeout) cezası sona erdi.\n` +
            `• ⏱️ **Durum:** ⌛ Süre doldu (Cezası bitti)\n` +
            `• 📅 **Bitiş Zamanı:** <t:${item.expireUnix}:T>\n` +
            `• 📝 **Sebep:** ${item.reason}`;
          if (typeof this.api.editMessage === 'function') {
            await this.api.editMessage(item.channelId, item.messageId, content);
          }
        }
      } catch (err: any) {
        console.warn(`[ModerationService] editMessage failed on timeout expiry: ${err.message}`);
      }
    }
  }

  /**
   * Handler when a timeout is manually removed before the timer expires.
   */
  async handleEarlyUntimeout(
    guildId: Snowflake,
    userId: Snowflake,
    moderatorUsername: string,
  ): Promise<void> {
    const key = `${guildId}:${userId}`;
    const active = this.activeTimeouts.get(key);
    if (active) {
      clearTimeout(active.timer);
      this.activeTimeouts.delete(key);
    }

    let dbRecords: Array<{
      channel_id: string;
      message_id: string;
      message_type: string;
      username: string;
      duration_text: string;
      reason: string;
      expire_unix: number;
    }> = [];
    try {
      dbRecords = this.db.getActiveTimeoutMessages(guildId, userId);
      this.db.deleteActiveTimeoutMessages(guildId, userId);
    } catch (err: any) {
      console.warn(`[ModerationService] deleteActiveTimeoutMessages failed:`, err.message);
    }

    const combinedRefs = new Map<
      string,
      {
        channelId: string;
        messageId: string;
        type: 'mute' | 'info';
        username: string;
        reason: string;
      }
    >();

    if (active) {
      for (const ref of active.messageRefs) {
        combinedRefs.set(`${ref.channelId}:${ref.messageId}`, {
          channelId: ref.channelId,
          messageId: ref.messageId,
          type: ref.type,
          username: active.username,
          reason: active.reason,
        });
      }
    }

    for (const rec of dbRecords) {
      const recKey = `${rec.channel_id}:${rec.message_id}`;
      if (!combinedRefs.has(recKey)) {
        combinedRefs.set(recKey, {
          channelId: rec.channel_id,
          messageId: rec.message_id,
          type: (rec.message_type as 'mute' | 'info') || 'mute',
          username: rec.username || active?.username || 'Kullanıcı',
          reason: rec.reason || active?.reason || 'Belirtilmedi',
        });
      }
    }

    for (const item of combinedRefs.values()) {
      try {
        if (item.type === 'mute') {
          const content =
            `✅ **${item.username}** kullanıcısının zamanaşımı cezası kaldırıldı.\n` +
            `**Sebep:** ${item.reason}\n` +
            `**Durum:** 🔓 Yetkili (${moderatorUsername}) tarafından açıldı (Cezası bitti)`;
          if (typeof this.api.editMessage === 'function') {
            await this.api.editMessage(item.channelId, item.messageId, content);
          }
        } else if (item.type === 'info') {
          const content =
            `✅ **${item.username}** kullanıcısının zamanaşımı cezası kaldırıldı.\n` +
            `• ⏱️ **Durum:** 🔓 Yetkili (${moderatorUsername}) tarafından açıldı (Cezası bitti)\n` +
            `• 📝 **Sebep:** ${item.reason}`;
          if (typeof this.api.editMessage === 'function') {
            await this.api.editMessage(item.channelId, item.messageId, content);
          }
        }
      } catch (err: any) {
        console.warn(`[ModerationService] editMessage failed on untimeout: ${err.message}`);
      }
    }
  }

  async clearMessages(
    guild: FluxerGuild,
    channelId: Snowflake,
    invoker: FluxerMember,
    botMember: FluxerMember,
    amount: number,
    targetUserId?: Snowflake,
  ): Promise<CommandExecutionResult> {
    if (amount < 1 || amount > 100) {
      return {success: false, message: t('errors.invalid_number')};
    }

    if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_MESSAGES)) {
      return {success: false, message: t('errors.no_permission')};
    }
    if (!PermissionService.hasPermission(guild, botMember, Permissions.MANAGE_MESSAGES)) {
      return {success: false, message: t('errors.bot_missing_permission', {permission: 'MANAGE_MESSAGES'})};
    }

    try {
      // Fetch messages (fetch a bit more if filtering by user)
      const fetchLimit = targetUserId ? Math.min(amount * 3, 100) : amount;
      const messages = await this.api.getMessages(channelId, fetchLimit);

      let toDelete = messages;
      if (targetUserId) {
        toDelete = messages.filter((m) => m.author.id === targetUserId).slice(0, amount);
      }

      if (toDelete.length === 0) {
        return {success: true, message: t('moderation.clear_success', {count: 0})};
      }

      const messageIds = toDelete.map((m) => m.id);
      try {
        if (messageIds.length > 1) {
          await this.api.bulkDeleteMessages(channelId, messageIds, `Bulk clear by ${invoker.user.username}`);
        } else if (messageIds.length === 1) {
          await this.api.deleteMessage(channelId, messageIds[0], `Single clear by ${invoker.user.username}`);
        }
      } catch (err: any) {
        // Fallback: delete messages one by one
        for (const msgId of messageIds) {
          await this.api.deleteMessage(channelId, msgId, `Clear by ${invoker.user.username}`).catch(() => {});
        }
      }

      this.db.addModerationLog(
        guild.id,
        'CLEAR',
        targetUserId || 'ALL',
        invoker.user.id,
        `Cleared ${messageIds.length} messages`,
        channelId,
      );

      return {
        success: true,
        message: targetUserId
          ? t('moderation.clear_user_success', {target: targetUserId, count: messageIds.length})
          : t('moderation.clear_success', {count: messageIds.length}),
      };
    } catch (err: any) {
      return {success: false, message: t('errors.command_error', {error: err.message})};
    }
  }

  async lockChannel(
    guild: FluxerGuild,
    invoker: FluxerMember,
    botMember: FluxerMember,
    channel: FluxerChannel,
    reason = 'Kanal kilitlendi',
  ): Promise<CommandExecutionResult> {
    if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_CHANNELS)) {
      return {success: false, message: t('errors.no_permission')};
    }
    if (!PermissionService.hasPermission(guild, botMember, Permissions.MANAGE_CHANNELS)) {
      return {
        success: false,
        message: t('errors.bot_missing_permission', {permission: 'MANAGE_CHANNELS'}),
      };
    }

    try {
      let currentDeny = 0n;
      let currentAllow = 0n;

      let freshChannel: FluxerChannel = channel;
      try {
        if (typeof this.api.getChannel === 'function') {
          freshChannel = await this.api.getChannel(channel.id);
        }
      } catch {
        const cached = guild.channels?.find((c) => c.id === channel.id);
        if (cached) freshChannel = cached;
      }

      const everyoneOverwrite = freshChannel.permission_overwrites?.find(
        (o) => o.id === guild.id,
      );
      if (everyoneOverwrite) {
        currentDeny = BigInt(everyoneOverwrite.deny || '0');
        currentAllow = BigInt(everyoneOverwrite.allow || '0');
      }

      const newDeny = (currentDeny | Permissions.SEND_MESSAGES).toString();
      const newAllow = (currentAllow & ~Permissions.SEND_MESSAGES).toString();

      await this.api.editChannelPermissions(
        channel.id,
        guild.id,
        {
          type: 0,
          allow: newAllow,
          deny: newDeny,
        },
        `${invoker.user.username}: ${reason}`,
      );

      this.db.addModerationLog(
        guild.id,
        'LOCK',
        channel.id,
        invoker.user.id,
        reason,
        channel.id,
      );

      return {
        success: true,
        message: `🔒 <#${channel.id}> kanalı başarıyla kilitlendi. Normal üyeler artık bu kanala mesaj gönderemez.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: t('errors.command_error', {error: err.message || 'Kanal kilitlenirken hata oluştu'}),
      };
    }
  }

  async unlockChannel(
    guild: FluxerGuild,
    invoker: FluxerMember,
    botMember: FluxerMember,
    channel: FluxerChannel,
    reason = 'Kanal kilidi açıldı',
  ): Promise<CommandExecutionResult> {
    if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_CHANNELS)) {
      return {success: false, message: t('errors.no_permission')};
    }
    if (!PermissionService.hasPermission(guild, botMember, Permissions.MANAGE_CHANNELS)) {
      return {
        success: false,
        message: t('errors.bot_missing_permission', {permission: 'MANAGE_CHANNELS'}),
      };
    }

    try {
      let currentDeny = 0n;
      let currentAllow = 0n;

      let freshChannel: FluxerChannel = channel;
      try {
        if (typeof this.api.getChannel === 'function') {
          freshChannel = await this.api.getChannel(channel.id);
        }
      } catch {
        const cached = guild.channels?.find((c) => c.id === channel.id);
        if (cached) freshChannel = cached;
      }

      const everyoneOverwrite = freshChannel.permission_overwrites?.find(
        (o) => o.id === guild.id,
      );
      if (everyoneOverwrite) {
        currentDeny = BigInt(everyoneOverwrite.deny || '0');
        currentAllow = BigInt(everyoneOverwrite.allow || '0');
      }

      const newDeny = (currentDeny & ~Permissions.SEND_MESSAGES).toString();
      const newAllow = currentAllow.toString();

      if (newDeny === '0' && newAllow === '0') {
        try {
          await this.api.deleteChannelPermission(
            channel.id,
            guild.id,
            `${invoker.user.username}: ${reason}`,
          );
        } catch {
          await this.api.editChannelPermissions(
            channel.id,
            guild.id,
            {type: 0, allow: '0', deny: '0'},
            `${invoker.user.username}: ${reason}`,
          );
        }
      } else {
        await this.api.editChannelPermissions(
          channel.id,
          guild.id,
          {
            type: 0,
            allow: newAllow,
            deny: newDeny,
          },
          `${invoker.user.username}: ${reason}`,
        );
      }

      this.db.addModerationLog(
        guild.id,
        'UNLOCK',
        channel.id,
        invoker.user.id,
        reason,
        channel.id,
      );

      return {
        success: true,
        message: `🔓 <#${channel.id}> kanalının kilidi başarıyla açıldı. Normal üyeler artık tekrar mesaj gönderebilir.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: t('errors.command_error', {error: err.message || 'Kanal kilidi açılırken hata oluştu'}),
      };
    }
  }

  async setSlowmode(
    guild: FluxerGuild,
    invoker: FluxerMember,
    botMember: FluxerMember,
    channel: FluxerChannel,
    seconds: number,
    reason?: string,
  ): Promise<CommandExecutionResult> {
    if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_CHANNELS)) {
      return {success: false, message: t('errors.no_permission')};
    }
    if (!PermissionService.hasPermission(guild, botMember, Permissions.MANAGE_CHANNELS)) {
      return {
        success: false,
        message: t('errors.bot_missing_permission', {permission: 'MANAGE_CHANNELS'}),
      };
    }

    if (seconds < 0 || seconds > 21600) {
      return {
        success: false,
        message: '❌ Geçersiz süre! Yavaş mod süresi 0 ile 21600 saniye (6 saat) arasında olmalıdır.',
      };
    }

    try {
      await this.api.modifyChannel(
        channel.id,
        {rate_limit_per_user: seconds},
        `${invoker.user.username}: ${reason || (seconds === 0 ? 'Slowmode kapatıldı' : `Slowmode ${seconds}s ayarlandı`)}`,
      );

      this.db.addModerationLog(
        guild.id,
        'SLOWMODE',
        channel.id,
        invoker.user.id,
        `Slowmode: ${seconds}s`,
        channel.id,
      );

      const msg =
        seconds === 0
          ? `⏱️ <#${channel.id}> kanalının yavaş modu (slowmode) kapatıldı.`
          : `⏱️ <#${channel.id}> kanalı için yavaş mod (slowmode) **${seconds} saniye** olarak ayarlandı.`;

      return {
        success: true,
        message: msg,
      };
    } catch (err: any) {
      return {
        success: false,
        message: t('errors.command_error', {error: err.message || 'Yavaş mod ayarlanırken hata oluştu'}),
      };
    }
  }
}
