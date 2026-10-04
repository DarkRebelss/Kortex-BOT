// SPDX-License-Identifier: AGPL-3.0-or-later
import { Permissions } from '../config/constants.js';
import { PermissionService } from './PermissionService.js';
import { t } from '../locales/i18n.js';
export class WarnService {
    api;
    db;
    constructor(api, db) {
        this.api = api;
        this.db = db;
    }
    async warnUser(guild, invoker, botMember, target, reason = 'No reason provided') {
        const validation = PermissionService.validateModerationAction(guild, invoker, botMember, target, Permissions.MODERATE_MEMBERS, 'MODERATE_MEMBERS');
        if (!validation.allowed) {
            return { success: false, message: t(validation.errorKey, validation.params) };
        }
        try {
            const warning = this.db.addWarning(guild.id, target.user.id, invoker.user.id, reason);
            const activeWarns = this.db.getActiveWarnings(guild.id, target.user.id);
            const totalCount = activeWarns.length;
            this.db.addModerationLog(guild.id, 'WARN', target.user.id, invoker.user.id, reason, null, { warningId: warning.id, totalWarnings: totalCount });
            let escalationNotice;
            // Check auto-escalation thresholds
            if (totalCount >= 10) {
                // 10 warns -> Ban
                try {
                    await this.api.banMember(guild.id, target.user.id, `Automated punishment: ${totalCount} active warnings reached.`);
                    escalationNotice = t('moderation.auto_punishment_triggered', {
                        target: target.user.username,
                        count: totalCount,
                        action: 'BAN',
                    });
                }
                catch (err) {
                    console.error(`[WarnService] Auto-ban failed:`, err);
                }
            }
            else if (totalCount >= 7) {
                // 7 warns -> Kick
                try {
                    await this.api.kickMember(guild.id, target.user.id, `Automated punishment: ${totalCount} active warnings reached.`);
                    escalationNotice = t('moderation.auto_punishment_triggered', {
                        target: target.user.username,
                        count: totalCount,
                        action: 'KICK',
                    });
                }
                catch (err) {
                    console.error(`[WarnService] Auto-kick failed:`, err);
                }
            }
            else if (totalCount >= 5) {
                // 5 warns -> 1h timeout
                try {
                    await this.api.timeoutMember(guild.id, target.user.id, 3600, `Automated punishment: ${totalCount} warnings`);
                    escalationNotice = t('moderation.auto_punishment_triggered', {
                        target: target.user.username,
                        count: totalCount,
                        action: '1 SAAT TIMEOUT',
                    });
                }
                catch (err) {
                    console.error(`[WarnService] Auto-timeout failed:`, err);
                }
            }
            else if (totalCount >= 3) {
                // 3 warns -> 10m timeout
                try {
                    await this.api.timeoutMember(guild.id, target.user.id, 600, `Automated punishment: ${totalCount} warnings`);
                    escalationNotice = t('moderation.auto_punishment_triggered', {
                        target: target.user.username,
                        count: totalCount,
                        action: '10 DAKİKA TIMEOUT',
                    });
                }
                catch (err) {
                    console.error(`[WarnService] Auto-timeout failed:`, err);
                }
            }
            let responseMsg = t('moderation.warn_added', {
                target: target.user.username,
                id: warning.id,
                reason,
                totalWarnings: totalCount,
            });
            if (escalationNotice) {
                responseMsg += `\n\n${escalationNotice}`;
            }
            return {
                success: true,
                message: responseMsg,
                warning,
                escalationNotice,
            };
        }
        catch (err) {
            return { success: false, message: t('errors.command_error', { error: err.message }) };
        }
    }
    getWarnings(guildId, targetUser) {
        const list = this.db.getActiveWarnings(guildId, targetUser.id);
        if (list.length === 0) {
            return t('moderation.warnings_empty', { target: targetUser.username });
        }
        let header = t('moderation.warnings_header', { target: targetUser.username, count: list.length });
        const items = list.map((w) => `• **#${w.id}** | Sebep: ${w.reason} | Tarih: ${w.created_at.slice(0, 10)}`);
        return `${header}\n${items.join('\n')}`;
    }
    removeWarning(guild, invoker, warningId) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MODERATE_MEMBERS)) {
            return { success: false, message: t('errors.no_permission') };
        }
        const removed = this.db.dismissWarning(guild.id, warningId);
        if (!removed) {
            return { success: false, message: t('moderation.warn_not_found') };
        }
        this.db.addModerationLog(guild.id, 'WARN_REMOVE', String(warningId), invoker.user.id, `Dismissed warning #${warningId}`);
        return {
            success: true,
            message: t('moderation.warn_removed', { id: warningId }),
        };
    }
    removeWarningsByUser(guild, invoker, target, count = 1) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MODERATE_MEMBERS)) {
            return { success: false, message: t('errors.no_permission'), removedCount: 0, remainingCount: 0 };
        }
        if (invoker.user.id !== guild.owner_id) {
            if (invoker.user.id === target.user.id) {
                return {
                    success: false,
                    message: t('moderation.warn_cannot_remove_self'),
                    removedCount: 0,
                    remainingCount: 0,
                };
            }
            const invokerPos = PermissionService.getHighestRolePosition(guild, invoker);
            const targetPos = PermissionService.getHighestRolePosition(guild, target);
            if (invokerPos <= targetPos) {
                return {
                    success: false,
                    message: t('errors.user_hierarchy'),
                    removedCount: 0,
                    remainingCount: 0,
                };
            }
        }
        const activeBefore = this.db.getActiveWarnings(guild.id, target.user.id);
        if (activeBefore.length === 0) {
            return {
                success: false,
                message: t('moderation.warn_user_no_warnings', { target: target.user.username }),
                removedCount: 0,
                remainingCount: 0,
            };
        }
        const safeCount = Math.max(1, count);
        const removedList = this.db.dismissWarningsByUser(guild.id, target.user.id, safeCount);
        const remainingCount = this.db.getActiveWarnings(guild.id, target.user.id).length;
        this.db.addModerationLog(guild.id, 'WARN_REMOVE', target.user.id, invoker.user.id, `${removedList.length} adet uyarı silindi`, null, { removedCount: removedList.length, remainingWarnings: remainingCount });
        return {
            success: true,
            message: t('moderation.warn_removed_count', {
                target: target.user.username,
                count: removedList.length,
                remaining: remainingCount,
            }),
            removedCount: removedList.length,
            remainingCount,
        };
    }
}
//# sourceMappingURL=WarnService.js.map