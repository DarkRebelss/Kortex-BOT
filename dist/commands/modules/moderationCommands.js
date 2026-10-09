// SPDX-License-Identifier: AGPL-3.0-or-later
import { ModerationService } from '../../services/ModerationService.js';
import { PermissionService } from '../../services/PermissionService.js';
import { Permissions } from '../../config/constants.js';
import { t } from '../../locales/i18n.js';
function extractUserId(raw) {
    if (!raw)
        return null;
    const clean = raw.trim().replace(/^<@!?/, '').replace(/>$/, '');
    return clean || null;
}
export async function handleModerationCommands(ctx) {
    const { commandName, args, guild, botMember, message, api, modService, warnService, modLogService, db, helpers } = ctx;
    let { invoker } = ctx;
    switch (commandName) {
        case 'ban': {
            const targetRaw = args[0];
            if (!targetRaw) {
                await helpers.sendUsageError(message, '❌ Kullanım: `/ban @kullanıcı veya <ID> [süre] [sebep]` (Örn: `/ban @Kyron 7d Reklam` veya `/ban @Kyron Kural ihlali`)');
                return true;
            }
            let targetMember = await helpers.resolveMember(guild, targetRaw);
            const targetUserId = targetMember?.user.id || extractUserId(targetRaw);
            if (!targetUserId) {
                await helpers.sendUsageError(message, t('errors.user_not_found'));
                return true;
            }
            // Allow banning a user who has left or is not present in server (hackban)
            if (!targetMember) {
                targetMember = {
                    user: { id: targetUserId, username: `User_${targetUserId}`, discriminator: '0000' },
                    roles: [],
                    joined_at: new Date().toISOString(),
                };
            }
            else {
                try {
                    const freshTarget = await api.getGuildMember(guild.id, targetMember.user.id);
                    if (freshTarget)
                        targetMember = freshTarget;
                }
                catch { }
            }
            let durationInput;
            let reason;
            if (args.length >= 2) {
                const durCand = ModerationService.parseDuration(args[1]);
                if (durCand && durCand > 0) {
                    durationInput = args[1];
                    reason = args.slice(2).join(' ') || 'Belirtilmedi';
                }
                else {
                    reason = args.slice(1).join(' ') || 'Belirtilmedi';
                }
            }
            else {
                reason = args.slice(1).join(' ') || 'Belirtilmedi';
            }
            const result = await modService.ban(guild, invoker, botMember, targetMember, reason, durationInput);
            await api.sendMessage(message.channel_id, result.message);
            if (result.success) {
                void modLogService.sendModLog(guild.id, {
                    action: 'BAN',
                    target: targetMember.user,
                    moderator: invoker.user,
                    reason: durationInput ? `${reason} (${durationInput})` : reason,
                    channelId: message.channel_id,
                });
            }
            return true;
        }
        case 'unban': {
            const rawTarget = args.join(' ').trim();
            if (!rawTarget) {
                await helpers.sendUsageError(message, '❌ Kullanım: `/unban @kullanıcı#etiket veya <ID>` (Örn: `/unban Kyron#0164` veya `/unban 1553179766511632384`)');
                return true;
            }
            // 1. Try to resolve banned user from guild ban list
            const target = await helpers.resolveBannedUser(guild, rawTarget);
            if (!target) {
                // If not in ban list, check if user is currently active in server
                const activeMember = await helpers.resolveMember(guild, rawTarget);
                if (activeMember) {
                    const userTag = activeMember.user.discriminator &&
                        activeMember.user.discriminator !== '0' &&
                        activeMember.user.discriminator !== '0000'
                        ? `${activeMember.user.username}#${activeMember.user.discriminator}`
                        : activeMember.user.username;
                    await helpers.sendUsageError(message, `ℹ️ **${userTag}** kullanıcısı şu anda sunucuda bulunuyor ve yasaklı değil.`);
                    return true;
                }
                // If not in server and not banned
                await helpers.sendUsageError(message, `ℹ️ **${rawTarget}** kullanıcısının bu sunucuda aktif bir yasağı bulunmuyor (kullanıcı yasaklı değil).`);
                return true;
            }
            const result = await modService.unban(guild, invoker, botMember, target.id, target.tag);
            await api.sendMessage(message.channel_id, result.message);
            if (result.success) {
                void modLogService.sendModLog(guild.id, {
                    action: 'UNBAN',
                    target: target.user || { id: target.id, username: target.tag },
                    moderator: invoker.user,
                    channelId: message.channel_id,
                });
            }
            return true;
        }
        case 'kick': {
            if (!args[0]) {
                await helpers.sendUsageError(message, '❌ Kullanım: `/kick @kullanıcı [sebep]`');
                return true;
            }
            let targetMember = await helpers.resolveMember(guild, args[0]);
            if (!targetMember) {
                await helpers.sendUsageError(message, t('errors.user_not_found'));
                return true;
            }
            const refreshed = await helpers.refreshHierarchy(guild, invoker, botMember, targetMember);
            invoker = refreshed.invoker;
            targetMember = refreshed.targetMember;
            const reason = args.slice(1).join(' ') || 'Belirtilmedi';
            const result = await modService.kick(guild, invoker, refreshed.botMember, targetMember, reason);
            await api.sendMessage(message.channel_id, result.message);
            if (result.success) {
                void modLogService.sendModLog(guild.id, {
                    action: 'KICK',
                    target: targetMember.user,
                    moderator: invoker.user,
                    reason,
                    channelId: message.channel_id,
                });
            }
            return true;
        }
        case 'timeoutinfo':
        case 'muteinfo':
        case 'timeoutstatus':
        case 'cezasüre':
        case 'cezasure': {
            const targetRaw = args.join(' ');
            await helpers.handleTimeoutStatus(guild, invoker, message.channel_id, targetRaw);
            return true;
        }
        case 'mute':
        case 'timeout':
        case 'sustur': {
            if (args.length === 0) {
                await helpers.sendUsageError(message, '❌ Kullanım: `/mute @kullanıcı süre sebep` (Örn: `/mute @user 10m Spam`)\n' +
                    'ℹ️ Ceza durumu & kalan süre kontrolü: `/mute status [@kullanıcı]` veya `/muteinfo [@kullanıcı]`');
                return true;
            }
            const statusKeywords = ['status', 'check', 'bilgi', 'süre', 'sure', 'info', 'kalan'];
            // Subcommand: /mute status [@user]
            if (statusKeywords.includes(args[0].toLowerCase())) {
                await helpers.handleTimeoutStatus(guild, invoker, message.channel_id, args.slice(1).join(' '));
                return true;
            }
            // Subcommand: /mute @user status
            if (args[1] && statusKeywords.includes(args[1].toLowerCase())) {
                await helpers.handleTimeoutStatus(guild, invoker, message.channel_id, args[0]);
                return true;
            }
            let targetMember = await helpers.resolveMember(guild, args[0]);
            let duration = args[1];
            let reason = args.slice(2).join(' ') || 'Belirtilmedi';
            // Also accept duration first: /mute 10m @user [sebep]
            if (!targetMember && args.length >= 2) {
                const durCandidate = ModerationService.parseDuration(args[0]);
                if (durCandidate) {
                    const memberCandidate = await helpers.resolveMember(guild, args[1]);
                    if (memberCandidate) {
                        targetMember = memberCandidate;
                        duration = args[0];
                        reason = args.slice(2).join(' ') || 'Belirtilmedi';
                    }
                }
            }
            if (!targetMember || !duration) {
                await helpers.sendUsageError(message, '❌ Kullanım: `/mute @kullanıcı süre sebep` (Örn: `/mute @user 10m Spam`)');
                return true;
            }
            // Refresh live roles of guild, invoker, bot and target member from API for accurate hierarchy & admin checks
            const refreshed = await helpers.refreshHierarchy(guild, invoker, botMember, targetMember);
            invoker = refreshed.invoker;
            targetMember = refreshed.targetMember;
            const result = await modService.timeout(guild, invoker, refreshed.botMember, targetMember, duration, reason);
            const sentMsg = await api.sendMessage(message.channel_id, result.message);
            if (result.success) {
                if (result.data && sentMsg?.id) {
                    modService.registerTimeoutMessage({
                        guildId: guild.id,
                        userId: targetMember.user.id,
                        username: targetMember.user.username,
                        reason,
                        durationText: result.data.humanDuration,
                        durationSeconds: result.data.durationSeconds,
                        expireUnix: result.data.expireUnix,
                        channelId: message.channel_id,
                        messageId: sentMsg.id,
                    });
                }
                void modLogService.sendModLog(guild.id, {
                    action: 'MUTE',
                    target: targetMember.user,
                    moderator: invoker.user,
                    reason: `${reason} (${duration})`,
                    channelId: message.channel_id,
                });
            }
            return true;
        }
        case 'unmute':
        case 'untimeout':
        case 'susturmakaldir':
        case 'susturmakaldır': {
            if (!args[0]) {
                await helpers.sendUsageError(message, '❌ Kullanım: `/unmute @kullanıcı` (Kullanıcının susturmasını kaldırır)');
                return true;
            }
            let targetMember = await helpers.resolveMember(guild, args[0]);
            if (!targetMember) {
                await helpers.sendUsageError(message, t('errors.user_not_found'));
                return true;
            }
            const refreshed = await helpers.refreshHierarchy(guild, invoker, botMember, targetMember);
            invoker = refreshed.invoker;
            targetMember = refreshed.targetMember;
            const result = await modService.untimeout(guild, invoker, refreshed.botMember, targetMember);
            await api.sendMessage(message.channel_id, result.message);
            if (result.success) {
                void modLogService.sendModLog(guild.id, {
                    action: 'UNTIMEOUT',
                    target: targetMember.user,
                    moderator: invoker.user,
                    channelId: message.channel_id,
                });
            }
            return true;
        }
        case 'clear': {
            if (args[0]?.toLowerCase() === 'user') {
                const subArgs = args.slice(1);
                let targetMember = null;
                let count = 10;
                if (subArgs.length >= 2 && /^\d+$/.test(subArgs[subArgs.length - 1])) {
                    count = Number.parseInt(subArgs[subArgs.length - 1], 10);
                    const userRaw = subArgs.slice(0, -1).join(' ');
                    targetMember = await helpers.resolveMember(guild, userRaw);
                }
                else if (subArgs.length >= 1) {
                    targetMember = await helpers.resolveMember(guild, subArgs.join(' '));
                }
                if (!targetMember) {
                    const notFoundMsg = await api.sendMessage(message.channel_id, t('errors.user_not_found'));
                    if (notFoundMsg?.id) {
                        setTimeout(async () => {
                            try {
                                await api.deleteMessage(message.channel_id, notFoundMsg.id);
                            }
                            catch { }
                        }, 4000);
                    }
                    return true;
                }
                const result = await modService.clearMessages(guild, message.channel_id, invoker, botMember, count, targetMember.user.id);
                // Delete command trigger message
                try {
                    await api.deleteMessage(message.channel_id, message.id);
                }
                catch { }
                const feedback = await api.sendMessage(message.channel_id, result.message);
                if (feedback?.id) {
                    setTimeout(async () => {
                        try {
                            await api.deleteMessage(message.channel_id, feedback.id);
                        }
                        catch { }
                    }, 4000);
                }
            }
            else {
                const count = Number.parseInt(args[0], 10) || 10;
                const result = await modService.clearMessages(guild, message.channel_id, invoker, botMember, count);
                // Delete command trigger message
                try {
                    await api.deleteMessage(message.channel_id, message.id);
                }
                catch { }
                const feedback = await api.sendMessage(message.channel_id, result.message);
                if (feedback?.id) {
                    setTimeout(async () => {
                        try {
                            await api.deleteMessage(message.channel_id, feedback.id);
                        }
                        catch { }
                    }, 4000);
                }
            }
            return true;
        }
        case 'warn': {
            if (args[0]?.toLowerCase() === 'remove') {
                const subArgs = args.slice(1);
                if (subArgs.length === 0) {
                    await helpers.sendUsageError(message, '❌ Kullanım: `/warn remove @kullanıcı [adet]` veya `/warn remove <Uyarı ID>`');
                    return true;
                }
                let targetMember = null;
                let count = 1;
                // Check if last argument is count (e.g. ['@Kyron', '1'])
                if (subArgs.length >= 2 && /^\d+$/.test(subArgs[subArgs.length - 1])) {
                    const countCandidate = Number.parseInt(subArgs[subArgs.length - 1], 10);
                    const userRaw = subArgs.slice(0, -1).join(' ');
                    const memberCandidate = await helpers.resolveMember(guild, userRaw);
                    if (memberCandidate) {
                        targetMember = memberCandidate;
                        count = countCandidate;
                    }
                }
                // Check if first argument is count (e.g. ['1', '@Kyron'])
                if (!targetMember && subArgs.length >= 2 && /^\d+$/.test(subArgs[0])) {
                    const countCandidate = Number.parseInt(subArgs[0], 10);
                    const userRaw = subArgs.slice(1).join(' ');
                    const memberCandidate = await helpers.resolveMember(guild, userRaw);
                    if (memberCandidate) {
                        targetMember = memberCandidate;
                        count = countCandidate;
                    }
                }
                // Check if the entire argument resolves to a member (count defaults to 1)
                if (!targetMember) {
                    const userRaw = subArgs.join(' ');
                    const memberCandidate = await helpers.resolveMember(guild, userRaw);
                    if (memberCandidate) {
                        targetMember = memberCandidate;
                        count = 1;
                    }
                }
                // If target member was resolved, remove warnings by user
                if (targetMember) {
                    const res = warnService.removeWarningsByUser(guild, invoker, targetMember, count);
                    await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
                    if (res.success) {
                        void modLogService.sendModLog(guild.id, {
                            action: 'UYARI_KALDIRILDI',
                            target: targetMember.user,
                            moderator: invoker.user,
                            reason: `${res.removedCount} adet uyarı silindi (Kalan: ${res.remainingCount})`,
                            channelId: message.channel_id,
                        });
                    }
                    return true;
                }
                // If no member resolved and single numeric argument provided -> treat as Warning ID
                if (subArgs.length === 1 && /^\d+$/.test(subArgs[0])) {
                    const warnId = Number.parseInt(subArgs[0], 10);
                    const res = warnService.removeWarning(guild, invoker, warnId);
                    await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
                    if (res.success) {
                        void modLogService.sendModLog(guild.id, {
                            action: 'UYARI_KALDIRILDI',
                            target: { id: String(warnId), username: `Uyarı #${warnId}` },
                            moderator: invoker.user,
                            reason: `Uyarı #${warnId} silindi`,
                            channelId: message.channel_id,
                        });
                    }
                    return true;
                }
                await helpers.sendUsageError(message, '❌ Belirtilen kullanıcı veya uyarı bulunamadı.\nKullanım: `/warn remove @kullanıcı [adet]` veya `/warn remove <Uyarı ID>`');
                return true;
            }
            const targetMember = await helpers.resolveMember(guild, args[0]);
            if (!targetMember) {
                await helpers.sendUsageError(message, '❌ Kullanım: `/warn @kullanıcı [sebep]`');
                return true;
            }
            const reason = args.slice(1).join(' ') || 'Belirtilmedi';
            const res = await warnService.warnUser(guild, invoker, botMember, targetMember, reason);
            await api.sendMessage(message.channel_id, res.message);
            if (res.success) {
                void modLogService.sendModLog(guild.id, {
                    action: 'WARN',
                    target: targetMember.user,
                    moderator: invoker.user,
                    reason,
                    channelId: message.channel_id,
                });
            }
            return true;
        }
        case 'warnings': {
            let targetMember = args[0] ? await helpers.resolveMember(guild, args[0]) : invoker;
            let targetUser = null;
            if (targetMember) {
                targetUser = {
                    id: targetMember.user.id,
                    username: targetMember.user.discriminator &&
                        targetMember.user.discriminator !== '0' &&
                        targetMember.user.discriminator !== '0000'
                        ? `${targetMember.user.username}#${targetMember.user.discriminator}`
                        : targetMember.user.username,
                };
            }
            else if (args[0]) {
                const candidateId = extractUserId(args[0]) || (args[0] && /^\d+$/.test(args[0]) ? args[0] : null);
                if (candidateId) {
                    targetUser = { id: candidateId, username: `ID: ${candidateId}` };
                }
            }
            if (!targetUser) {
                await helpers.sendUsageError(message, t('errors.user_not_found'));
                return true;
            }
            const text = warnService.getWarnings(guild.id, targetUser);
            await api.sendMessage(message.channel_id, text);
            return true;
        }
        case 'modlogs':
        case 'denetim-kayitlari':
        case 'denetimkayitlari':
        case 'ceza-gecmisi': {
            const isOwner = guild.owner_id === invoker.user.id;
            const isAdmin = PermissionService.hasPermission(guild, invoker, Permissions.ADMINISTRATOR);
            const canManage = PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD) ||
                PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_MESSAGES);
            if (!isOwner && !isAdmin && !canManage) {
                await helpers.sendAutoExpiringMessage(message.channel_id, '❌ **Yetki Yetersiz:** Denetim kayıtlarını yalnızca yöneticiler ve moderatörler görüntüleyebilir.', 6, message.id);
                return true;
            }
            const logs = db?.getGuildModerationLogs(guild.id, 12) || [];
            if (!logs || logs.length === 0) {
                await api.sendMessage(message.channel_id, `📋 **Sunucu Denetim Kayıtları (${guild.name}):**\n*Henüz bu sunucuda kaydedilmiş bir ceza veya denetim işlemi bulunmuyor.*`);
                return true;
            }
            const logLines = logs.map((l, idx) => {
                const actionEmoji = l.action_type === 'ban'
                    ? '🔨'
                    : l.action_type === 'kick'
                        ? '👢'
                        : l.action_type === 'timeout' || l.action_type === 'mute'
                            ? '⏳'
                            : l.action_type === 'warn'
                                ? '⚠️'
                                : '🛡️';
                const timeStr = l.created_at
                    ? new Date(l.created_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
                    : '';
                const target = `<@${l.target_user_id}>`;
                const mod = `<@${l.moderator_id}>`;
                const reason = l.reason ? `("${l.reason}")` : '';
                return `${idx + 1}. ${actionEmoji} **${l.action_type.toUpperCase()}** • Hedef: ${target} • Yetkili: ${mod} ${reason} \`${timeStr}\``;
            });
            await api.sendMessage(message.channel_id, `📋 **Son Denetim & Ceza Kayıtları (${guild.name}):**\n\n` +
                logLines.join('\n') +
                `\n\nℹ️ *Toplam ${logs.length} işlem listelendi.*`);
            return true;
        }
        case 'modlog': {
            if (args[0]?.toLowerCase() === 'channel') {
                const channelRaw = args.slice(1).join(' ');
                const channel = await helpers.resolveChannel(guild, channelRaw);
                if (!channel) {
                    await helpers.sendUsageError(message, t('errors.channel_not_found'));
                    return true;
                }
                const res = modLogService.setLogChannel(guild, invoker, channel.id, channel.name);
                await api.sendMessage(message.channel_id, res.message);
            }
            else {
                await helpers.sendUsageError(message, '❌ Kullanım: `/modlog channel #kanal`');
            }
            return true;
        }
        case 'lock':
        case 'kilitle': {
            let targetChannel = null;
            let reason = 'Belirtilmedi';
            if (args[0]) {
                targetChannel = await helpers.resolveChannel(guild, args[0]);
                if (targetChannel) {
                    reason = args.slice(1).join(' ').trim() || 'Belirtilmedi';
                }
                else {
                    targetChannel =
                        guild.channels?.find((c) => c.id === message.channel_id) ||
                        { id: message.channel_id, name: 'kanal' };
                    reason = args.join(' ').trim() || 'Belirtilmedi';
                }
            }
            else {
                targetChannel =
                    guild.channels?.find((c) => c.id === message.channel_id) ||
                    { id: message.channel_id, name: 'kanal' };
            }
            const res = await modService.lockChannel(guild, invoker, botMember, targetChannel, reason);
            await api.sendMessage(message.channel_id, res.message);
            if (res.success) {
                void modLogService.sendModLog(guild.id, {
                    action: 'LOCK',
                    target: { id: targetChannel.id, username: `#${targetChannel.name || 'kanal'}` },
                    moderator: invoker.user,
                    reason,
                    channelId: message.channel_id,
                });
            }
            return true;
        }
        case 'unlock':
        case 'kilitac':
        case 'kilit-ac': {
            let targetChannel = null;
            let reason = 'Belirtilmedi';
            if (args[0]) {
                targetChannel = await helpers.resolveChannel(guild, args[0]);
                if (targetChannel) {
                    reason = args.slice(1).join(' ').trim() || 'Belirtilmedi';
                }
                else {
                    targetChannel =
                        guild.channels?.find((c) => c.id === message.channel_id) ||
                        { id: message.channel_id, name: 'kanal' };
                    reason = args.join(' ').trim() || 'Belirtilmedi';
                }
            }
            else {
                targetChannel =
                    guild.channels?.find((c) => c.id === message.channel_id) ||
                    { id: message.channel_id, name: 'kanal' };
            }
            const res = await modService.unlockChannel(guild, invoker, botMember, targetChannel, reason);
            await api.sendMessage(message.channel_id, res.message);
            if (res.success) {
                void modLogService.sendModLog(guild.id, {
                    action: 'UNLOCK',
                    target: { id: targetChannel.id, username: `#${targetChannel.name || 'kanal'}` },
                    moderator: invoker.user,
                    reason,
                    channelId: message.channel_id,
                });
            }
            return true;
        }
        case 'slowmode':
        case 'yavasmod':
        case 'yavaşmod': {
            if (!args[0]) {
                await helpers.sendUsageError(message, '❌ Kullanım: `/slowmode <saniye> [#kanal]` veya `/slowmode [#kanal] <saniye>`\n' +
                    'Örnekler:\n' +
                    '• `/slowmode 5` — Bu kanala 5 saniye slowmode uygular\n' +
                    '• `/slowmode 0` veya `/slowmode kapat` — Slowmode\'u kapatır\n' +
                    '• `/slowmode #sohbet 10` — Belirtilen kanala 10 saniye slowmode uygular');
                return true;
            }
            let targetChannel = null;
            let seconds = null;
            let reason;
            for (let i = 0; i < args.length; i++) {
                const arg = args[i];
                const lower = arg.toLowerCase();
                if (!targetChannel) {
                    const resolved = await helpers.resolveChannel(guild, arg);
                    if (resolved) {
                        targetChannel = resolved;
                        continue;
                    }
                }
                if (seconds === null) {
                    if (['0', 'off', 'kapat', 'kapali', 'kapalı', 'disable', 'false'].includes(lower)) {
                        seconds = 0;
                        continue;
                    }
                    if (/^\d+$/.test(arg)) {
                        seconds = parseInt(arg, 10);
                        continue;
                    }
                    const dur = ModerationService.parseDuration(arg);
                    if (dur !== null && dur >= 0) {
                        seconds = dur;
                        continue;
                    }
                }
                reason = args.slice(i).join(' ');
                break;
            }
            if (seconds === null) {
                await helpers.sendUsageError(message, '❌ Lütfen geçerli bir süre (saniye) belirtin! (Örn: `/slowmode 5` veya `/slowmode 0` (kapatır))');
                return true;
            }
            if (!targetChannel) {
                targetChannel =
                    guild.channels?.find((c) => c.id === message.channel_id) ||
                    { id: message.channel_id, name: 'kanal' };
            }
            const res = await modService.setSlowmode(guild, invoker, botMember, targetChannel, seconds, reason);
            await api.sendMessage(message.channel_id, res.message);
            if (res.success) {
                void modLogService.sendModLog(guild.id, {
                    action: 'SLOWMODE',
                    target: { id: targetChannel.id, username: `#${targetChannel.name || 'kanal'}` },
                    moderator: invoker.user,
                    reason: seconds === 0 ? 'Slowmode kapatıldı' : `Slowmode: ${seconds}s`,
                    channelId: message.channel_id,
                });
            }
            return true;
        }
        default:
            return false;
    }
}
//# sourceMappingURL=moderationCommands.js.map