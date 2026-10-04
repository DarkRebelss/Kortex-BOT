// SPDX-License-Identifier: AGPL-3.0-or-later
import { Permissions } from '../config/constants.js';
import { PermissionService } from './PermissionService.js';
export class CommunityService {
    api;
    db;
    modLogService;
    constructor(api, db, modLogService) {
        this.api = api;
        this.db = db;
        this.modLogService = modLogService;
    }
    // =============================================================
    // 1. AFK System
    // =============================================================
    /**
     * Sets user as AFK with a reason.
     */
    setAfk(guild, member, reason) {
        const cleanReason = reason.trim() || 'Sebep belirtilmedi.';
        this.db.setAfk(guild.id, member.user.id, cleanReason);
        return {
            success: true,
            message: `💤 **${member.user.username}**, artık AFK modundasınız!\n**Sebep:** *${cleanReason}*\n*Sohbete bir şey yazdığınızda AFK modunuz otomatik kaldırılacaktır.*`,
        };
    }
    /**
     * Checks if an incoming message speaker was previously AFK.
     * If yes, clears AFK status and sends welcome back message.
     */
    async handleAfkSpeaker(guild, member, message) {
        const afk = this.db.getAfk(guild.id, member.user.id);
        if (!afk)
            return false;
        this.db.removeAfk(guild.id, member.user.id);
        const nowUnix = Math.floor(Date.now() / 1000);
        const elapsedMinutes = Math.max(1, Math.round((nowUnix - afk.afk_since_unix) / 60));
        let timeText = `${elapsedMinutes} dakika`;
        if (elapsedMinutes >= 60) {
            const hours = Math.floor(elapsedMinutes / 60);
            const mins = elapsedMinutes % 60;
            timeText = `${hours} saat ${mins} dakika`;
        }
        try {
            const sent = await this.api.sendMessage(message.channel_id, `👋 Hoş geldin <@${member.user.id}>! AFK modundan çıktın. (${timeText} boyunca AFK idin)`);
            if (sent?.id) {
                setTimeout(() => {
                    void this.api.deleteMessage(message.channel_id, sent.id, 'AFK Return Notice Auto Cleanup').catch(() => { });
                }, 8_000);
            }
        }
        catch { }
        return true;
    }
    /**
     * Checks if message mentions any user who is currently AFK.
     * If yes, notifies the channel.
     */
    async handleAfkMentions(guild, message) {
        const content = message.content || '';
        const mentionRegex = /<@!?([^>]+)>/g;
        const matches = [...content.matchAll(mentionRegex)];
        if (matches.length === 0)
            return;
        const notifiedUsers = new Set();
        for (const match of matches) {
            const targetId = match[1];
            if (targetId === message.author?.id || notifiedUsers.has(targetId))
                continue;
            const afk = this.db.getAfk(guild.id, targetId);
            if (afk) {
                notifiedUsers.add(targetId);
                const nowUnix = Math.floor(Date.now() / 1000);
                const elapsedMinutes = Math.max(1, Math.round((nowUnix - afk.afk_since_unix) / 60));
                let timeText = `${elapsedMinutes} dakika`;
                if (elapsedMinutes >= 60) {
                    const hours = Math.floor(elapsedMinutes / 60);
                    const mins = elapsedMinutes % 60;
                    timeText = `${hours} saat ${mins} dakika`;
                }
                try {
                    const sent = await this.api.sendMessage(message.channel_id, `💤 <@${targetId}> şu anda **AFK**: *${afk.reason}* (${timeText} önce geçti)`);
                    if (sent?.id) {
                        setTimeout(() => {
                            void this.api.deleteMessage(message.channel_id, sent.id, 'AFK Mention Notice Auto Cleanup').catch(() => { });
                        }, 8_000);
                    }
                }
                catch { }
            }
        }
    }
    // =============================================================
    // 2. Custom Commands / Tags / Auto-Responder (/tag)
    // =============================================================
    tagCooldowns = new Map();
    /**
     * Checks if the tag / auto-responder system is enabled for the guild (defaults to true).
     */
    isTagsEnabled(guildId) {
        const config = this.db.getGuildConfig(guildId);
        return config.tags_enabled !== 0;
    }
    /**
     * Toggles the tag / auto-responder system on or off.
     */
    setTagsEnabled(guild, invoker, enabled) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD) && invoker.user.id !== guild.owner_id) {
            return { success: false, message: '❌ Otomatik yanıt sistemini açıp kapatmak için **Sunucuyu Yönet** yetkisine sahip olmalısınız.' };
        }
        this.db.updateGuildConfig(guild.id, { tags_enabled: enabled ? 1 : 0 });
        return {
            success: true,
            message: enabled
                ? '🟢 **Özel Komut / Otomatik Yanıt Sistemi AÇILDI!**\nArtık kullanıcılar `/` veya `!` koymadan belirlediğiniz kelimeleri/cümleleri yazdığında bot otomatik yanıt verecektir.'
                : '🔴 **Özel Komut / Otomatik Yanıt Sistemi KAPATILDI!**\nOtomatik yanıtlayıcı devre dışı bırakıldı.',
        };
    }
    /**
     * Gets the current status of the auto-responder system.
     */
    getStatus(guild) {
        const enabled = this.isTagsEnabled(guild.id);
        const tags = this.db.listTags(guild.id);
        return {
            success: true,
            message: `🏷️ **Otomatik Yanıtlayıcı Durumu:** ${enabled ? '🟢 **Açık (Aktif)**' : '🔴 **Kapalı (Devre Dışı)**'}\n` +
                `📝 **Kayıtlı Yanıt Sayısı:** **${tags.length}**\n\n` +
                `*Açmak/Kapatmak için: \`/tag on\` veya \`/tag off\`*`,
        };
    }
    /**
     * Formats dynamic template placeholders:
     * - User: {user}, {mention}, {username}, {id}, {userId}
     * - Server: {server}, {guild}, {guildName}, {serverName}, {memberCount}, {owner}
     * - Channel: {channel}, {channelId}
     * - Time & Date: {date}, {time}, {timestamp}
     * - Random: {random:min-max}, {random}
     */
    static formatTagTemplate(template, guild, member, channelId) {
        const user = member.user;
        const count = guild.member_count ?? guild.members?.length ?? 1;
        let res = template
            .replaceAll('{user}', `<@${user.id}>`)
            .replaceAll('{mention}', `<@${user.id}>`)
            .replaceAll('{username}', user.username)
            .replaceAll('{id}', user.id)
            .replaceAll('{userId}', user.id)
            .replaceAll('{server}', guild.name)
            .replaceAll('{guild}', guild.name)
            .replaceAll('{guildName}', guild.name)
            .replaceAll('{serverName}', guild.name)
            .replaceAll('{memberCount}', String(count))
            .replaceAll('{owner}', `<@${guild.owner_id}>`)
            .replaceAll('{channel}', channelId ? `<#${channelId}>` : '')
            .replaceAll('{channelId}', channelId || '');
        // Date & Time formatting
        const now = new Date();
        const dateStr = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const unixNow = Math.floor(now.getTime() / 1000);
        res = res
            .replaceAll('{date}', dateStr)
            .replaceAll('{time}', timeStr)
            .replaceAll('{timestamp}', `<t:${unixNow}:f>`);
        // Handle {random:min-max} and {random}
        res = res.replace(/\{random(?::(\d+)-(\d+))?\}/gi, (_, minStr, maxStr) => {
            const min = minStr !== undefined ? Number.parseInt(minStr, 10) : 1;
            const max = maxStr !== undefined ? Number.parseInt(maxStr, 10) : 100;
            if (isNaN(min) || isNaN(max) || min > max)
                return String(Math.floor(Math.random() * 100) + 1);
            return String(Math.floor(Math.random() * (max - min + 1)) + min);
        });
        return res;
    }
    addTag(guild, invoker, name, content) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_MESSAGES) && invoker.user.id !== guild.owner_id) {
            return { success: false, message: '❌ Özel komut eklemek için **Mesajları Yönet** yetkisine sahip olmalısınız.' };
        }
        const cleanName = name.toLowerCase().replace(/^[!/]/, '').trim();
        const cleanContent = content.trim();
        if (!cleanName || !cleanContent) {
            return { success: false, message: '❌ Kullanım: `/tag add <isim> <cevap_mesajı>` (Örn: `/tag add ip mc.sunucu.com` veya `/tag add sa Aleyküm selam {user}, hoş geldin!`)' };
        }
        this.db.addTag(guild.id, cleanName, cleanContent, invoker.user.id);
        return {
            success: true,
            message: `✅ **Otomatik Yanıt Eklendi:** Artık sohbet kutusuna doğrudan \`${cleanName}\`, \`!${cleanName}\` veya \`/tag ${cleanName}\` yazıldığında bu yanıt verilecek.\n\n` +
                `💡 *Kullanabileceğiniz dinamik değişkenler: \`{user}\` (etiket), \`{username}\`, \`{server}\`, \`{memberCount}\`, \`{channel}\`, \`{date}\`, \`{time}\`, \`{random:1-100}\`*`,
        };
    }
    removeTag(guild, invoker, name) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_MESSAGES) && invoker.user.id !== guild.owner_id) {
            return { success: false, message: '❌ Özel komut silmek için **Mesajları Yönet** yetkisine sahip olmalısınız.' };
        }
        const cleanName = name.toLowerCase().replace(/^[!/]/, '').trim();
        const removed = this.db.removeTag(guild.id, cleanName);
        if (!removed) {
            return { success: false, message: `❌ \`${cleanName}\` adında bir özel komut bulunamadı.` };
        }
        return { success: true, message: `🗑️ **\`${cleanName}\`** otomatik yanıtı silindi.` };
    }
    listTags(guild) {
        const enabled = this.isTagsEnabled(guild.id);
        const statusText = enabled ? '🟢 **Açık (Aktif)**' : '🔴 **Kapalı (Devre Dışı)**';
        const tags = this.db.listTags(guild.id);
        if (tags.length === 0) {
            return {
                success: true,
                message: `📝 Bu sunucuda henüz kayıtlı otomatik yanıt bulunmuyor. (Durum: ${statusText})\nEklemek için: \`/tag add <isim> <yanıt>\``,
            };
        }
        const list = tags.map((t) => `• \`${t.name}\` (veya \`!${t.name}\`)`).join('\n');
        return {
            success: true,
            message: `🏷️ **Sunucu Otomatik Yanıtları (${tags.length})** — Durum: ${statusText}\n\n${list}\n\n` +
                `*Kullanıcılar \`/\` veya \`!\` koymadan doğrudan bu kelimeleri yazdığında bot otomatik yanıt verir.*\n` +
                `*Desteklenen değişkenler: \`{user}\`, \`{username}\`, \`{server}\`, \`{memberCount}\`, \`{channel}\`, \`{date}\`, \`{time}\`, \`{random:1-100}\`*`,
        };
    }
    getTag(guild, name) {
        const cleanName = name.toLowerCase().replace(/^[!/]/, '').trim();
        return this.db.getTag(guild.id, cleanName);
    }
    /**
     * Automatically handles chat messages matching custom tags without requiring `/` or `!`.
     * Also handles classic `!tag` triggers for backwards compatibility.
     */
    async handleAutoResponse(guild, member, message) {
        if (member.user.bot)
            return false;
        if (!this.isTagsEnabled(guild.id))
            return false;
        const rawContent = (message.content || '').trim();
        if (!rawContent)
            return false;
        const tags = this.db.listTags(guild.id);
        if (tags.length === 0)
            return false;
        // Support both direct writing ("ip", "sa") and prefixed writing ("!ip")
        const contentWithoutPrefix = rawContent.startsWith('!') ? rawContent.slice(1).trim() : rawContent;
        const lowerContent = contentWithoutPrefix.toLowerCase();
        const lowerPunct = lowerContent.replace(/[!?,.:;]+$/, '').trim();
        // Sort by name length descending so multi-word / longer triggers take precedence
        const sortedTags = [...tags].sort((a, b) => b.name.length - a.name.length);
        let matchedTag = null;
        for (const tag of sortedTags) {
            const tagName = tag.name.toLowerCase().trim();
            if (!tagName)
                continue;
            // 1. Exact match with entire message or message without trailing punctuation (e.g. "sa", "sa!")
            if (lowerContent === tagName || lowerPunct === tagName) {
                matchedTag = tag;
                break;
            }
            // 2. Starts with tag + space or punctuation (e.g. "sa beyler", "ip nedir")
            if (lowerContent.startsWith(tagName + ' ') ||
                lowerContent.startsWith(tagName + ',') ||
                lowerContent.startsWith(tagName + '!') ||
                lowerContent.startsWith(tagName + '?')) {
                matchedTag = tag;
                break;
            }
            // 3. Multi-word phrase contained in message (e.g. "sunucu kuralları")
            if (tagName.includes(' ') && lowerContent.includes(tagName)) {
                matchedTag = tag;
                break;
            }
            // 4. Standalone word match for single-word tags (word-boundary safe, ignores "ekip" for "ip")
            if (!tagName.includes(' ')) {
                const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(?:^|[\\s.,!?¡¿()[\\]{}"':;])${escaped}(?:$|[\\s.,!?¡¿()[\\]{}"':;])`, 'i');
                if (regex.test(lowerContent)) {
                    matchedTag = tag;
                    break;
                }
            }
        }
        if (!matchedTag)
            return false;
        // 2-second cooldown per tag per channel to prevent bot message flood
        const cooldownKey = `${guild.id}_${matchedTag.name}_${message.channel_id}`;
        const lastTrigger = this.tagCooldowns.get(cooldownKey) || 0;
        const now = Date.now();
        if (now - lastTrigger < 2000) {
            return false;
        }
        this.tagCooldowns.set(cooldownKey, now);
        const formattedContent = CommunityService.formatTagTemplate(matchedTag.content, guild, member, message.channel_id);
        try {
            await this.api.sendMessage(message.channel_id, formattedContent);
            return true;
        }
        catch {
            return false;
        }
    }
    // =============================================================
    // 3. Mass Mention Filter (Toplu Etiket Engeli)
    // =============================================================
    async handleMassMention(guild, member, message) {
        if (member.user.bot)
            return false;
        const config = this.db.getGuildConfig(guild.id);
        if (!config.massmention_enabled)
            return false;
        // Exempt administrators and owner
        if (member.user.id === guild.owner_id || PermissionService.hasPermission(guild, member, Permissions.ADMINISTRATOR)) {
            return false;
        }
        const limit = config.massmention_limit || 5;
        const content = message.content || '';
        // Count user mentions and check everyone/here mentions
        const userMentionMatches = content.match(/<@!?([^>]+)>/g) || [];
        const hasEveryone = content.includes('@everyone') || content.includes('@here');
        // Check if user has permission to mention everyone
        const canMentionEveryone = PermissionService.hasPermission(guild, member, Permissions.MENTION_EVERYONE);
        let violated = false;
        let violationReason = '';
        if (hasEveryone && !canMentionEveryone) {
            violated = true;
            violationReason = 'İzinsiz @everyone veya @here etiketi';
        }
        else if (userMentionMatches.length >= limit) {
            violated = true;
            violationReason = `Toplu etiketleme (${userMentionMatches.length} etiket / Limit: ${limit})`;
        }
        if (!violated)
            return false;
        // Delete message
        try {
            await this.api.deleteMessage(message.channel_id, message.id, 'Mass Mention Protection');
        }
        catch { }
        // Apply 10 minute timeout
        try {
            await this.api.timeoutMember(guild.id, member.user.id, 600, violationReason);
        }
        catch { }
        // Send warning to channel
        try {
            const warnMsg = await this.api.sendMessage(message.channel_id, `⚠️ <@${member.user.id}>, **Toplu etiketleme koruması** nedeniyle mesajınız silindi ve 10 dakika susturuldunuz! (${violationReason})`);
            if (warnMsg?.id) {
                setTimeout(() => {
                    void this.api.deleteMessage(message.channel_id, warnMsg.id, 'Mass Mention Warning Auto Cleanup').catch(() => { });
                }, 8_000);
            }
        }
        catch { }
        // Modlog
        if (this.modLogService && config.modlog_channel_id) {
            void this.modLogService.sendModLog(guild.id, {
                action: 'TOPLU ETİKET KORUMASI',
                target: member.user,
                reason: violationReason,
            });
        }
        return true;
    }
    // =============================================================
    // 4. Capslock Filter (Büyük Harf Engeli)
    // =============================================================
    async handleCapslock(guild, member, message) {
        if (member.user.bot)
            return false;
        const config = this.db.getGuildConfig(guild.id);
        if (!config.capslock_enabled)
            return false;
        // Exempt administrators and owner
        if (member.user.id === guild.owner_id || PermissionService.hasPermission(guild, member, Permissions.ADMINISTRATOR)) {
            return false;
        }
        const content = message.content?.trim() || '';
        if (content.length < 8)
            return false;
        // Count letters only
        const letters = content.replace(/[^a-zA-ZçÇğĞıİöÖşŞüÜ]/g, '');
        if (letters.length < 6)
            return false;
        let upperCount = 0;
        for (const ch of letters) {
            if (ch === ch.toLocaleUpperCase('tr') && ch !== ch.toLocaleLowerCase('tr')) {
                upperCount++;
            }
        }
        const ratio = Math.round((upperCount / letters.length) * 100);
        const limit = config.capslock_percentage || 70;
        if (ratio >= limit) {
            try {
                await this.api.deleteMessage(message.channel_id, message.id, 'Capslock Protection');
            }
            catch { }
            try {
                const warnMsg = await this.api.sendMessage(message.channel_id, `🔇 <@${member.user.id}>, lütfen aşırı büyük harf (capslock) kullanmayın! Mesajınız silindi. (%${ratio} büyük harf)`);
                if (warnMsg?.id) {
                    setTimeout(() => {
                        void this.api.deleteMessage(message.channel_id, warnMsg.id, 'Auto Delete Capslock Warning').catch(() => { });
                    }, 5000);
                }
            }
            catch { }
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=CommunityService.js.map