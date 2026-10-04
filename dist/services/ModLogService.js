// SPDX-License-Identifier: AGPL-3.0-or-later
import { Permissions } from '../config/constants.js';
import { PermissionService } from './PermissionService.js';
import { t } from '../locales/i18n.js';
export class ModLogService {
    api;
    db;
    constructor(api, db) {
        this.api = api;
        this.db = db;
    }
    setLogChannel(guild, invoker, channelId, channelName) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return { success: false, message: t('errors.no_permission') };
        }
        this.db.updateGuildConfig(guild.id, {
            modlog_channel_id: channelId,
        });
        return {
            success: true,
            message: t('modlog.channel_set', { channel: channelName }),
        };
    }
    async sendModLog(guildId, entry) {
        const config = this.db.getGuildConfig(guildId);
        if (!config.modlog_channel_id)
            return;
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
        }
        catch (err) {
            console.error(`[ModLogService] Failed to send mod log to channel ${config.modlog_channel_id}:`, err);
        }
    }
}
//# sourceMappingURL=ModLogService.js.map