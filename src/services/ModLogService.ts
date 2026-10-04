// SPDX-License-Identifier: AGPL-3.0-or-later

import {Permissions} from '../config/constants.js';
import {MicupApiClient} from '../api/MicupApiClient.js';
import {DatabaseClient} from '../database/DatabaseClient.js';
import {PermissionService} from './PermissionService.js';
import {t} from '../locales/i18n.js';
import type {FluxerGuild, FluxerMember, Snowflake} from '../types/fluxer.js';

export interface LogEntryPayload {
  action: string;
  target: {id: Snowflake; username: string};
  moderator?: {id: Snowflake; username: string};
  reason?: string | null;
  channelId?: Snowflake | null;
  extraDetails?: Record<string, unknown>;
}

export class ModLogService {
  constructor(
    private readonly api: MicupApiClient,
    private readonly db: DatabaseClient,
  ) {}

  setLogChannel(
    guild: FluxerGuild,
    invoker: FluxerMember,
    channelId: Snowflake,
    channelName: string,
  ): {success: boolean; message: string} {
    if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
      return {success: false, message: t('errors.no_permission')};
    }

    this.db.updateGuildConfig(guild.id, {
      modlog_channel_id: channelId,
    });

    return {
      success: true,
      message: t('modlog.channel_set', {channel: channelName}),
    };
  }

  async sendModLog(guildId: Snowflake, entry: LogEntryPayload): Promise<void> {
    const config = this.db.getGuildConfig(guildId);
    if (!config.modlog_channel_id) return;

    try {
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const modName = entry.moderator ? `${entry.moderator.username} (\`${entry.moderator.id}\`)` : 'Sistem / Otomatik';
      const targetName = `${entry.target.username} (\`${entry.target.id}\`)`;
      const reason = entry.reason || 'Belirtilmedi';
      const channelInfo = entry.channelId ? `\n**Kanal:** <#${entry.channelId}>` : '';

      const content = [
        `🛡️ **[MOD-LOG: ${entry.action}]**`,
        `**Hedef:** ${targetName}`,
        `**Yetkili:** ${modName}`,
        `**Sebep:** ${reason}${channelInfo}`,
        `**Zaman:** \`${now} UTC\``,
      ].join('\n');

      await this.api.sendMessage(config.modlog_channel_id, content);
    } catch (err) {
      console.error(`[ModLogService] Failed to send mod log to channel ${config.modlog_channel_id}:`, err);
    }
  }
}
