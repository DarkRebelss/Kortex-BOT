// SPDX-License-Identifier: AGPL-3.0-or-later
import { PermissionService } from './PermissionService.js';
import { Permissions } from '../config/constants.js';
import { formatPollEmbed, buildPollComponents } from './PollCardGenerator.js';
export class PollService {
    api;
    db;
    ticker;
    constructor(api, db) {
        this.api = api;
        this.db = db;
        this.startTicker();
    }
    startTicker() {
        if (this.ticker)
            return;
        this.ticker = setInterval(() => {
            void this.checkExpiredPolls();
        }, 5000);
    }
    stop() {
        if (this.ticker) {
            clearInterval(this.ticker);
            this.ticker = undefined;
        }
    }
    /**
     * Periodic check for polls whose duration has expired.
     */
    async checkExpiredPolls() {
        const nowUnix = Math.floor(Date.now() / 1000);
        const expired = this.db.getActiveExpiringPolls(nowUnix);
        if (!expired || expired.length === 0)
            return;
        for (const poll of expired) {
            await this.concludePoll(poll);
        }
    }
    /**
     * Concludes a poll: updates the original embed to closed state and announces the winner in channel.
     */
    async concludePoll(poll) {
        this.db.closePoll(poll.id);
        let options = [];
        try {
            options = JSON.parse(poll.options_json);
        }
        catch {
            options = ['Evet', 'Hayır'];
        }
        const voteCounts = this.db.getPollVotes(poll.id);
        const voteMap = new Map();
        for (const v of voteCounts) {
            voteMap.set(v.option_index, v.count);
        }
        let totalVotes = 0;
        const optionItems = options.map((text, idx) => {
            const count = voteMap.get(idx) || 0;
            totalVotes += count;
            return { text, votes: count };
        });
        const maxVotes = Math.max(0, ...optionItems.map((o) => o.votes));
        const embed = formatPollEmbed({
            question: poll.question,
            options: optionItems,
            totalVotes,
            isClosed: true,
            expireUnix: poll.expire_unix,
        });
        const components = buildPollComponents(poll.id, options, true);
        // 1. Edit original message
        try {
            await this.api.editMessage(poll.channel_id, poll.message_id, '', {
                embeds: [embed],
                components,
            });
        }
        catch (err) {
            console.warn(`[PollService] Orijinal mesaj güncellenemedi (${poll.message_id}):`, err.message);
        }
        // 2. Announce poll conclusion in channel
        try {
            let announcement;
            if (totalVotes === 0 || maxVotes === 0) {
                announcement = `📊 **Anket Sonuçlandı!**\n> ❓ **Soru:** **${poll.question}**\nℹ️ *Anketin süresi doldu, hiç oy kullanılmadı.*`;
            }
            else {
                const winners = optionItems.filter((o) => o.votes === maxVotes);
                const percent = Math.round((maxVotes / totalVotes) * 100);
                if (winners.length === 1) {
                    announcement =
                        `📊 **Anket Sonuçlandı!**\n` +
                            `> ❓ **Soru:** **${poll.question}**\n` +
                            `🏆 **Kazanan Seçenek:** **${winners[0].text}** (%${percent} — **${maxVotes} oy**)\n` +
                            `👥 Toplam **${totalVotes}** oy kullanıldı.`;
                }
                else {
                    const names = winners.map((w) => `**${w.text}**`).join(' & ');
                    announcement =
                        `📊 **Anket Sonuçlandı!**\n` +
                            `> ❓ **Soru:** **${poll.question}**\n` +
                            `🤝 **Berabere:** ${names} (%${percent} — **${maxVotes} oy**)\n` +
                            `👥 Toplam **${totalVotes}** oy kullanıldı.`;
                }
            }
            await this.api.sendMessage(poll.channel_id, announcement);
        }
        catch (err) {
            console.warn(`[PollService] Sonuç bildirimi gönderilemedi:`, err.message);
        }
    }
    /**
     * Manually ends a poll early by ID or message ID.
     */
    async endPoll(guild, invoker, targetId) {
        const numericId = Number.parseInt(targetId, 10);
        const poll = (!isNaN(numericId) ? this.db.getPoll(numericId) : null) || this.db.getPollByMessageId(targetId);
        if (!poll) {
            return { success: false, message: '❌ Belirtilen anket bulunamadı. Lütfen geçerli bir anket ID veya mesaj ID girin.' };
        }
        if (poll.is_closed === 1) {
            return { success: false, message: '⚠️ Bu anket zaten sonlandırılmış durumdadır.' };
        }
        const isOwner = guild.owner_id === invoker.user.id;
        let hasPerm = isOwner;
        if (!hasPerm && Array.isArray(guild.roles)) {
            hasPerm =
                PermissionService.hasPermission(guild, invoker, Permissions.ADMINISTRATOR) ||
                    PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_MESSAGES) ||
                    PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD) ||
                    PermissionService.hasPermission(guild, invoker, Permissions.MODERATE_MEMBERS);
        }
        if (!hasPerm) {
            return { success: false, message: '❌ Bu anketi yalnızca sunucu sahibi, yöneticiler ve moderatörler sonlandırabilir.' };
        }
        await this.concludePoll(poll);
        return { success: true, message: `✅ **"${poll.question}"** anketi başarıyla sonlandırıldı ve sonuçlar kanalda paylaşıldı.` };
    }
}
//# sourceMappingURL=PollService.js.map