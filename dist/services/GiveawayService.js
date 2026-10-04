// SPDX-License-Identifier: AGPL-3.0-or-later
import { Permissions } from '../config/constants.js';
import { PermissionService } from './PermissionService.js';
export class GiveawayService {
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
            void this.checkExpiredGiveaways();
        }, 5000);
    }
    stop() {
        if (this.ticker) {
            clearInterval(this.ticker);
            this.ticker = undefined;
        }
    }
    /**
     * Parse human duration string (e.g. '30s', '10m', '2h', '1d') into seconds.
     */
    static parseDuration(input) {
        const match = input.toLowerCase().match(/^(\d+)\s*(s|m|h|d|sn|dk|sa|gun|gün)$/);
        if (!match)
            return null;
        const val = Number.parseInt(match[1], 10);
        const unit = match[2];
        switch (unit) {
            case 's':
            case 'sn':
                return val;
            case 'm':
            case 'dk':
                return val * 60;
            case 'h':
            case 'sa':
                return val * 3600;
            case 'd':
            case 'gun':
            case 'gün':
                return val * 86400;
            default:
                return null;
        }
    }
    /**
     * Builds action row component with 🎉 Katıl button.
     */
    buildGiveawayButton(giveawayId, participantCount, disabled = false) {
        return [
            {
                type: 1, // ACTION_ROW
                components: [
                    {
                        type: 2, // BUTTON
                        style: disabled ? 2 : 3, // SUCCESS (Green) or SECONDARY (Gray)
                        custom_id: disabled ? 'giveaway_ended' : `giveaway_join_${giveawayId}`,
                        label: disabled ? `Çekiliş Bitti (${participantCount})` : `Katıl (${participantCount})`,
                        emoji: { name: disabled ? '🔒' : '🎉' },
                        disabled,
                    },
                ],
            },
        ];
    }
    /**
     * Starts a new giveaway.
     */
    async startGiveaway(guild, channelId, hostMember, durationInput, winnerCount, prize) {
        if (!PermissionService.hasPermission(guild, hostMember, Permissions.MANAGE_GUILD) && hostMember.user.id !== guild.owner_id) {
            return { success: false, message: '❌ Çekiliş başlatmak için **Sunucuyu Yönet** yetkisine sahip olmalısınız.' };
        }
        const durationSec = GiveawayService.parseDuration(durationInput);
        if (!durationSec || durationSec < 5) {
            return { success: false, message: '❌ Geçersiz süre! Örnekler: `30s`, `10m`, `2h`, `1d` (En az 5 saniye).' };
        }
        if (winnerCount < 1 || winnerCount > 20) {
            return { success: false, message: '❌ Kazanan sayısı 1 ile 20 arasında olmalıdır.' };
        }
        const cleanPrize = prize.trim();
        if (!cleanPrize) {
            return { success: false, message: '❌ Lütfen çekiliş ödülünü belirtin.' };
        }
        const nowUnix = Math.floor(Date.now() / 1000);
        const endUnix = nowUnix + durationSec;
        const embedContent = `🎉 **ÇEKİLİŞ BAŞLADI!** 🎉\n\n` +
            `🎁 **Ödül:** **${cleanPrize}**\n` +
            `👑 **Başlatan:** <@${hostMember.user.id}>\n` +
            `🏆 **Kazanan Sayısı:** **${winnerCount}**\n` +
            `👥 **Katılımcı:** **0**\n` +
            `⏰ **Bitiş:** <t:${endUnix}:R> (<t:${endUnix}:f>)\n\n` +
            `*Aşağıdaki **🎉 Katıl** butonuna tıklayarak veya mesaja 🎉 emojisi bırakarak çekilişe katılabilirsiniz!*`;
        // Initial button attached immediately so it appears at message creation!
        const initialButtons = this.buildGiveawayButton('init', 0, false);
        try {
            // Send message WITH the button directly
            const msg = await this.api.sendMessage(channelId, embedContent, {
                components: initialButtons,
            });
            // Add 🎉 reaction to message for classic 1-click entry & full client support
            try {
                await this.api.addReaction(channelId, msg.id, '🎉');
            }
            catch { }
            // Save to database
            const record = this.db.createGiveaway(guild.id, channelId, msg.id, cleanPrize, winnerCount, endUnix, hostMember.user.id);
            // Update button custom_id with the record ID
            const updatedButtons = this.buildGiveawayButton(record.id, 0, false);
            try {
                await this.api.editMessage(channelId, msg.id, embedContent, {
                    components: updatedButtons,
                });
            }
            catch { }
            return {
                success: true,
                message: `✅ Çekiliş başarıyla başlatıldı! Mesaj: <#${channelId}>`,
            };
        }
        catch (err) {
            return { success: false, message: `❌ Çekiliş mesajı gönderilemedi: ${err.message}` };
        }
    }
    /**
     * Handles user clicking the join button.
     */
    async handleJoinInteraction(giveawayId, arg2, messageId, arg4) {
        let member;
        let channelId;
        if (arg2 && typeof arg2 === 'object' && 'user' in arg2) {
            member = arg2;
        }
        else {
            channelId = typeof arg2 === 'string' ? arg2 : undefined;
            member = arg4;
        }
        if (!member)
            return { success: false, message: '❌ Kullanıcı bulunamadı.' };
        let giveaway = null;
        if (giveawayId) {
            giveaway = this.db.getGiveaway(giveawayId);
        }
        if (!giveaway && channelId && messageId) {
            giveaway = this.db.getGiveawayByMessage(channelId, messageId);
        }
        if (!giveaway && messageId) {
            const active = this.db.getActiveGiveaways();
            giveaway = active.find((g) => g.message_id === messageId) || null;
        }
        if (!giveaway || giveaway.status !== 'active') {
            return { success: false, message: '❌ Bu çekiliş aktif değil veya sona ermiş.' };
        }
        const result = this.db.addGiveawayParticipant(giveaway.id, member.user.id);
        if (!result.success) {
            if (result.alreadyJoined) {
                return { success: false, message: '⚠️ Çekilişe zaten katılmış durumdasınız!' };
            }
            return { success: false, message: '❌ Bu çekiliş sona ermiş.' };
        }
        // Refresh original message content and button label
        const activeEmbedContent = `🎉 **ÇEKİLİŞ BAŞLADI!** 🎉\n\n` +
            `🎁 **Ödül:** **${giveaway.prize}**\n` +
            `👑 **Başlatan:** <@${giveaway.host_id}>\n` +
            `🏆 **Kazanan Sayısı:** **${giveaway.winner_count}**\n` +
            `👥 **Katılımcı:** **${result.total}**\n` +
            `⏰ **Bitiş:** <t:${giveaway.end_unix}:R> (<t:${giveaway.end_unix}:f>)\n\n` +
            `*Aşağıdaki **🎉 Katıl** butonuna tıklayarak çekilişe katılabilirsiniz!*`;
        const updatedButtons = this.buildGiveawayButton(giveaway.id, result.total, false);
        try {
            await this.api.editMessage(giveaway.channel_id, giveaway.message_id, activeEmbedContent, {
                components: updatedButtons,
            });
        }
        catch { }
        return { success: true, message: `🎉 Çekilişe başarıyla katıldınız! Toplam katılımcı: **${result.total}**` };
    }
    /**
     * Periodic check for expired active giveaways.
     */
    async checkExpiredGiveaways() {
        const active = this.db.getActiveGiveaways();
        if (active.length === 0)
            return;
        const nowUnix = Math.floor(Date.now() / 1000);
        for (const g of active) {
            if (nowUnix >= g.end_unix) {
                await this.concludeGiveaway(g);
            }
        }
    }
    /**
     * Concludes a giveaway, selects winners randomly, edits original message to say ÇEKİLİŞ BİTTİ and posts announcement.
     */
    async concludeGiveaway(giveaway) {
        let participants = [];
        try {
            participants = JSON.parse(giveaway.participants || '[]');
        }
        catch {
            participants = [];
        }
        const winners = [];
        const pool = [...participants];
        const pickCount = Math.min(giveaway.winner_count, pool.length);
        for (let i = 0; i < pickCount; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            winners.push(pool[idx]);
            pool.splice(idx, 1);
        }
        this.db.endGiveaway(giveaway.id, winners);
        let winnerText = '';
        if (winners.length > 0) {
            winnerText = winners.map((w) => `<@${w}>`).join(', ');
        }
        else {
            winnerText = 'Katılımcı bulunamadı';
        }
        // 1. UPDATE ORIGINAL MESSAGE: Overwrite countdown, state "ÇEKİLİŞ BİTTİ" and disable button
        const endedEmbedContent = `🛑 **ÇEKİLİŞ BİTTİ** 🛑\n\n` +
            `🎁 **Ödül:** **${giveaway.prize}**\n` +
            `👑 **Başlatan:** <@${giveaway.host_id}>\n` +
            `🏆 **Kazanan(lar):** ${winnerText}\n` +
            `👥 **Toplam Katılımcı:** **${participants.length}**\n` +
            `⏰ **Durum:** 🔴 **Sona Erdi** (<t:${giveaway.end_unix}:f>)\n\n` +
            `*Bu çekiliş sona ermiştir.*`;
        const disabledButtons = this.buildGiveawayButton(giveaway.id, participants.length, true);
        try {
            await this.api.editMessage(giveaway.channel_id, giveaway.message_id, endedEmbedContent, {
                components: disabledButtons,
            });
        }
        catch (err) {
            console.warn('[GiveawayService] Orijinal çekiliş mesajı güncellenemedi:', err.message);
        }
        // 2. POST CELEBRATORY ANNOUNCEMENT IN CHANNEL
        const endNotice = `🎊 **ÇEKİLİŞ SONA ERDİ!** 🎊\n\n` +
            `🎁 **Ödül:** **${giveaway.prize}**\n` +
            `👑 **Başlatan:** <@${giveaway.host_id}>\n` +
            `👥 **Toplam Katılımcı:** ${participants.length}\n` +
            `🏆 **Kazananlar:** ${winnerText}\n\n` +
            (winners.length > 0
                ? `🎉 Tebrikler ${winnerText}! Ödülünüzü teslim almak için <@${giveaway.host_id}> ile iletişime geçin.`
                : 'Katılımcı olmadığı için kazanan seçilemedi.');
        try {
            await this.api.sendMessage(giveaway.channel_id, endNotice);
        }
        catch { }
    }
    /**
     * Rerolls winner(s) for an ended giveaway.
     */
    async reroll(guild, invoker, messageId) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD) && invoker.user.id !== guild.owner_id) {
            return { success: false, message: '❌ Çekilişi yeniden çekmek için **Sunucuyu Yönet** yetkisine sahip olmalısınız.' };
        }
        const activeList = this.db.getGuildGiveaways(guild.id);
        const giveaway = activeList.find((g) => g.message_id === messageId || g.id.toString() === messageId);
        if (!giveaway) {
            return { success: false, message: '❌ Belirtilen çekiliş mesajı bulunamadı.' };
        }
        let participants = [];
        try {
            participants = JSON.parse(giveaway.participants || '[]');
        }
        catch {
            participants = [];
        }
        if (participants.length === 0) {
            return { success: false, message: '❌ Çekilişe hiç katılımcı olmadığı için yeniden çekilemiyor.' };
        }
        const newWinner = participants[Math.floor(Math.random() * participants.length)];
        const rerollNotice = `🎲 **YENİ KAZANAN BELİRLENDİ!**\n🎁 **Ödül:** ${giveaway.prize}\n🏆 **Yeni Kazanan:** <@${newWinner}>! Tebrikler! 🎉`;
        try {
            await this.api.sendMessage(giveaway.channel_id, rerollNotice);
        }
        catch { }
        return { success: true, message: `✅ Yeni kazanan belirlendi: <@${newWinner}>` };
    }
    /**
     * Ends an active giveaway early.
     */
    async endEarly(guild, invoker, messageIdOrId) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD) && invoker.user.id !== guild.owner_id) {
            return { success: false, message: '❌ Çekilişi erken sonlandırmak için **Sunucuyu Yönet** yetkisine sahip olmalısınız.' };
        }
        const activeList = this.db.getActiveGiveaways();
        const giveaway = activeList.find((g) => g.guild_id === guild.id && (g.message_id === messageIdOrId || g.id.toString() === messageIdOrId));
        if (!giveaway) {
            return { success: false, message: '❌ Belirtilen aktif çekiliş bulunamadı.' };
        }
        await this.concludeGiveaway(giveaway);
        return { success: true, message: `✅ Çekiliş erken sonlandırıldı: **${giveaway.prize}**` };
    }
    /**
     * Lists guild giveaways.
     */
    list(guild) {
        const list = this.db.getGuildGiveaways(guild.id);
        if (list.length === 0) {
            return { success: true, message: '🎁 Sunucuda henüz kayıtlı bir çekiliş yok. Başlatmak için: `/giveaway start 10m 1 Micup VIP`' };
        }
        const lines = list.map((g) => {
            const statusIcon = g.status === 'active' ? '🟢 Aktif' : '🔴 Bitti';
            return `• **ID ${g.id}** — **${g.prize}** (${g.winner_count} kazanan) | Durum: ${statusIcon}`;
        });
        return {
            success: true,
            message: `🎁 **Sunucu Çekilişleri:**\n\n${lines.join('\n')}\n\n*Yeniden çekmek için: \`/giveaway reroll <id_veya_mesaj_id>\`*`,
        };
    }
}
//# sourceMappingURL=GiveawayService.js.map