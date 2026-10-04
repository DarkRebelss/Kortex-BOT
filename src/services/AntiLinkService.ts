// SPDX-License-Identifier: AGPL-3.0-or-later

import {Permissions} from '../config/constants.js';
import {MicupApiClient} from '../api/MicupApiClient.js';
import {DatabaseClient} from '../database/DatabaseClient.js';
import {PermissionService} from './PermissionService.js';
import {t} from '../locales/i18n.js';
import type {FluxerGuild, FluxerMember, FluxerMessage} from '../types/fluxer.js';

const URL_REGEX = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])|(www\.[^\s<]+[^<.,:;"')\]\s])|(discord\.(gg|io|me|li)\/[^\s]+)|(micup\.(gg|com)\/invite\/[^\s]+)|([a-zA-Z0-9-]+\.(com|net|org|io|gg|me|tv|video|xyz|app|dev|link|site|top|club|online|store|tech|pro|info|co|biz|cc|to|ru|tr|uk|de|eu|us|vip)\b[^\s]*)/gi;

export class AntiLinkService {
  constructor(
    private readonly api: MicupApiClient,
    private readonly db: DatabaseClient,
  ) {}

  /**
   * Process message for unauthorized links.
   * Returns true if link was detected and deleted.
   */
  async handleMessage(
    guild: FluxerGuild,
    member: FluxerMember,
    message: FluxerMessage,
  ): Promise<boolean> {
    // Exempt bots from link filtering
    if (member.user.bot) {
      return false;
    }

    const config = this.db.getGuildConfig(guild.id);
    if (!config.antilink_enabled) return false;

    // Check if moderator exemption is explicitly enabled (default: false so all links are checked)
    const exemptMods = Boolean((config as any).antilink_exempt_mods);
    if (exemptMods && PermissionService.hasPermission(guild, member, Permissions.MANAGE_MESSAGES)) {
      return false;
    }

    const matches = message.content.match(URL_REGEX);
    if (!matches || matches.length === 0) return false;

    let whitelist: string[] = [];
    try {
      whitelist = JSON.parse(config.antilink_whitelist || '[]');
    } catch {
      whitelist = [];
    }

    // Check if any matched URL is prohibited
    const isProhibited = matches.some((rawUrl) => {
      try {
        const normalized = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
          ? rawUrl
          : `https://${rawUrl}`;
        const parsed = new URL(normalized);
        const hostname = parsed.hostname.toLowerCase();
        return !whitelist.some((wl) => {
          const cleanWl = wl.toLowerCase().trim();
          return hostname === cleanWl || hostname.endsWith(`.${cleanWl}`);
        });
      } catch {
        return true;
      }
    });

    if (!isProhibited) return false;

    // Delete message
    let deleteFailed = false;
    try {
      await this.api.deleteMessage(message.channel_id, message.id, 'Anti-Link automatic deletion');
    } catch (err: any) {
      deleteFailed = true;
      console.error(`[AntiLinkService] Failed to delete link message:`, err.message);
    }

    // Send warning notification
    try {
      let notice = t('security.antilink_triggered', {target: `<@${member.user.id}>`});
      if (deleteFailed) {
        notice += '\n⚠️ *(Uyarı: Botun bu kanalda "Mesajları Yönet (Manage Messages)" yetkisi olmadığı için mesaj silinemedi!)*';
      }
      const sentNotice = await this.api.sendMessage(message.channel_id, notice);
      if (!deleteFailed && sentNotice?.id) {
        setTimeout(() => {
          void this.api.deleteMessage(message.channel_id, sentNotice.id).catch(() => {});
        }, 5000);
      }
    } catch {
      // ignore
    }

    // Log to DB
    this.db.addModerationLog(
      guild.id,
      'ANTI_LINK',
      member.user.id,
      'SYSTEM',
      `Posted unauthorized link: ${matches.join(', ')}`,
      message.channel_id,
    );

    return true;
  }

  // -------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------

  toggle(
    guild: FluxerGuild,
    invoker: FluxerMember,
    enable: boolean,
  ): {success: boolean; message: string} {
    if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
      return {success: false, message: t('errors.no_permission')};
    }

    this.db.updateGuildConfig(guild.id, {
      antilink_enabled: enable ? 1 : 0,
    });

    return this.getStatus(guild);
  }

  setExemptMods(
    guild: FluxerGuild,
    invoker: FluxerMember,
    exempt: boolean,
  ): {success: boolean; message: string} {
    if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
      return {success: false, message: t('errors.no_permission')};
    }

    this.db.updateGuildConfig(guild.id, {
      antilink_exempt_mods: exempt ? 1 : 0,
    } as any);

    return {
      success: true,
      message: exempt
        ? '🛡️ **Anti-Link Yetkili Muafiyeti:** **Açık** (Yöneticiler ve moderatörler link paylaşabilir).'
        : '🛡️ **Anti-Link Yetkili Muafiyeti:** **Kapalı** (Sunucu sahibi dahil tüm üyelerin linkleri denetlenir).',
    };
  }

  getStatus(guild: FluxerGuild): {success: boolean; message: string} {
    const cfg = this.db.getGuildConfig(guild.id);
    const exemptMods = Boolean((cfg as any).antilink_exempt_mods);
    return {
      success: true,
      message:
        `🔗 **Anti-Link Koruması:** **${cfg.antilink_enabled ? 'Aktif' : 'Devre Dışı'}**\n` +
        `• **Beyaz Liste:** ${cfg.antilink_whitelist || '[]'}\n` +
        `• **Yetkili Muafiyeti:** **${exemptMods ? 'Açık (Yetkililer muaf)' : 'Kapalı (Tüm üyeler denetlenir)'}**`,
    };
  }

  addWhitelistDomain(
    guild: FluxerGuild,
    invoker: FluxerMember,
    domain: string,
  ): {success: boolean; message: string} {
    if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
      return {success: false, message: t('errors.no_permission')};
    }

    const cfg = this.db.getGuildConfig(guild.id);
    let whitelist: string[] = [];
    try {
      whitelist = JSON.parse(cfg.antilink_whitelist || '[]');
    } catch {
      whitelist = [];
    }

    const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!whitelist.includes(cleanDomain)) {
      whitelist.push(cleanDomain);
      this.db.updateGuildConfig(guild.id, {
        antilink_whitelist: JSON.stringify(whitelist),
      });
    }

    return {
      success: true,
      message: t('security.antilink_whitelist_added', {domain: cleanDomain}),
    };
  }

  removeWhitelistDomain(
    guild: FluxerGuild,
    invoker: FluxerMember,
    domain: string,
  ): {success: boolean; message: string} {
    if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
      return {success: false, message: t('errors.no_permission')};
    }

    const cfg = this.db.getGuildConfig(guild.id);
    let whitelist: string[] = [];
    try {
      whitelist = JSON.parse(cfg.antilink_whitelist || '[]');
    } catch {
      whitelist = [];
    }

    const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    whitelist = whitelist.filter((d) => d !== cleanDomain);
    this.db.updateGuildConfig(guild.id, {
      antilink_whitelist: JSON.stringify(whitelist),
    });

    return {
      success: true,
      message: t('security.antilink_whitelist_removed', {domain: cleanDomain}),
    };
  }
}
