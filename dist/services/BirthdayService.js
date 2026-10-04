// SPDX-License-Identifier: AGPL-3.0-or-later
import { PermissionService } from './PermissionService.js';
import { Permissions } from '../config/constants.js';
import { resolveUserDisplayName, resolveUserDisplayNameSync, makeThenableResult } from '../utils/userResolver.js';
export class BirthdayService {
    api;
    db;
    checkInterval = null;
    constructor(api, db) {
        this.api = api;
        this.db = db;
        this.startTicker();
    }
    /**
     * Periodically checks for members whose birthday is today and announces them.
     */
    startTicker() {
        if (this.checkInterval)
            return;
        // Run initial check after 2 seconds, then every 1 minute so celebrations are never delayed
        setTimeout(() => void this.checkAndAnnounceBirthdays(), 2000);
        this.checkInterval = setInterval(() => {
            void this.checkAndAnnounceBirthdays();
        }, 60 * 1000);
    }
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
    async checkAndAnnounceBirthdays(targetGuildId, targetUserId) {
        const now = new Date();
        const day = now.getDate();
        const month = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();
        let pending = this.db.getTodaysBirthdays(day, month, currentYear);
        if (!pending || pending.length === 0)
            return 0;
        if (targetGuildId) {
            pending = pending.filter((b) => b.guild_id === targetGuildId);
        }
        if (targetUserId) {
            pending = pending.filter((b) => b.user_id === targetUserId);
        }
        if (pending.length === 0)
            return 0;
        let announcedCount = 0;
        for (const b of pending) {
            const config = this.db.getGuildConfig(b.guild_id);
            if (config.birthday_enabled === 0)
                continue;
            const targetChannelId = config.birthday_channel_id || config.bot_channel_id;
            if (!targetChannelId)
                continue;
            const ageText = b.year ? ` (${currentYear - b.year}. Yaş Günü)` : '';
            const customMsg = config.birthday_message;
            let text = customMsg
                ? customMsg
                    .replaceAll('{user}', `<@${b.user_id}>`)
                    .replaceAll('{day}', String(b.day))
                    .replaceAll('{month}', String(b.month))
                    .replaceAll('{age}', b.year ? String(currentYear - b.year) : '')
                    .replaceAll('{yas}', b.year ? String(currentYear - b.year) : '')
                : `🎉 **Bugün <@${b.user_id}> Kullanıcısının Doğum Günü! 🎂🎈${ageText}**\n\n*İyi ki doğdun! Yeni yaşında sevdiklerinle birlikte sağlık, mutluluk, huzur ve nice başarılar dileriz!* 🥳🎁✨`;
            try {
                try {
                    await this.api.sendMessage(targetChannelId, text, {
                        embeds: [
                            {
                                title: '🎂 DOĞUM GÜNÜ KUTLAMASI 🎈',
                                description: `Bugün <@${b.user_id}> aramıza katılışının ve yeni yaşının coşkusunu yaşıyor!\nBütün sunucu olarak tebrik ediyoruz! 🥳🎊`,
                                color: 0xff69b4, // Hot Pink celebration color
                                footer: { text: 'Kortex • Doğum Günü Kutlama Sistemi' },
                            },
                        ],
                    });
                }
                catch {
                    // Fallback: If embeds fail (e.g. EMBED_LINKS permission missing), send plain text
                    await this.api.sendMessage(targetChannelId, text);
                }
                this.db.markBirthdayCelebrated(b.guild_id, b.user_id, currentYear);
                announcedCount++;
            }
            catch (err) {
                console.warn(`[BirthdayService] Doğum günü mesajı gönderilemedi (${b.guild_id}):`, err.message);
            }
        }
        return announcedCount;
    }
    // -------------------------------------------------------------
    // User Commands
    // -------------------------------------------------------------
    setBirthday(guildId, userId, day, month, year, username) {
        if (day < 1 || day > 31 || month < 1 || month > 12) {
            return {
                success: false,
                message: '❌ Lütfen geçerli bir gün (1-31) ve ay (1-12) girin. Örn: `/dogumgunu ayarla 15 05`',
            };
        }
        if (year !== undefined && year !== null) {
            const currentYear = new Date().getFullYear();
            if (year < 1920 || year > currentYear) {
                return {
                    success: false,
                    message: `❌ Geçersiz yıl! Lütfen 1920 ile ${currentYear} arasında bir yıl girin.`,
                };
            }
        }
        this.db.setBirthday(guildId, userId, day, month, year || null, username || null);
        if (username) {
            this.db.saveUserName(userId, username);
        }
        const now = new Date();
        const isToday = day === now.getDate() && month === (now.getMonth() + 1);
        // If today is their birthday, announce immediately!
        if (isToday) {
            void this.checkAndAnnounceBirthdays(guildId, userId);
        }
        const pad = (n) => n.toString().padStart(2, '0');
        const dateStr = `${pad(day)}/${pad(month)}${year ? `/${year}` : ''}`;
        if (isToday) {
            const config = this.db.getGuildConfig(guildId);
            const chNotice = config.birthday_channel_id
                ? `\n🎉 **Bugün senin doğum günün!** Kutlama mesajın <#${config.birthday_channel_id}> kanalına gönderildi!`
                : `\n🎉 **Bugün senin doğum günün!** Sunucu yöneticisi bir kutlama kanalı ayarladığında (\`/dogumgunu kanal #kanal\`) tebrik mesajın yayınlanacak!`;
            return {
                success: true,
                message: `🎂 **Doğum Günün Başarıyla Kaydedildi!**\n• Tarih: **${dateStr}**${chNotice}`,
            };
        }
        return {
            success: true,
            message: `🎂 **Doğum Günün Başarıyla Kaydedildi!**\n• Tarih: **${dateStr}**\n• Zamanı geldiğinde kutlama kanalında senin için özel tebrik mesajı yayınlanacak! 🎉`,
        };
    }
    getBirthday(guildId, userId) {
        const record = this.db.getBirthday(guildId, userId);
        if (!record) {
            return {
                success: false,
                message: 'ℹ️ Kayıtlı doğum günü bulunamadı. `/dogumgunu ayarla <gün> <ay>` komutuyla ekleyebilirsiniz.',
            };
        }
        const pad = (n) => n.toString().padStart(2, '0');
        const dateStr = `${pad(record.day)}/${pad(record.month)}${record.year ? `/${record.year}` : ''}`;
        return {
            success: true,
            message: `🎂 <@${userId}> kullanıcısının doğum günü: **${dateStr}**`,
            record,
        };
    }
    deleteBirthday(guildId, userId) {
        const deleted = this.db.deleteBirthday(guildId, userId);
        if (!deleted) {
            return {
                success: false,
                message: '❌ Zaten kayıtlı bir doğum gününüz bulunmuyor.',
            };
        }
        return {
            success: true,
            message: '✅ Doğum günü bilginiz başarıyla silindi.',
        };
    }
    listBirthdays(guild, invokerUserOrId) {
        const invokerUserId = typeof invokerUserOrId === 'object' && invokerUserOrId !== null
            ? invokerUserOrId.user?.id || invokerUserOrId.id
            : invokerUserOrId;
        const list = this.db.getGuildBirthdays(guild.id);
        if (list.length === 0) {
            const emptyRes = {
                success: true,
                message: '🎂 **Sunucu Doğum Günleri**\n\n*Henüz hiç kimse doğum gününü kaydetmedi. `/dogumgunu ayarla <gün> <ay>` ile ilk sen ol!*',
            };
            return makeThenableResult(emptyRes, Promise.resolve(emptyRes));
        }
        const pad = (n) => n.toString().padStart(2, '0');
        const months = [
            '', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
            'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
        ];
        const buildLines = (namesMap) => {
            const lines = [
                `🎂 **${guild.name} — Kayıtlı Doğum Günleri**`,
                `────────────────────────────────────────`,
            ];
            for (const b of list) {
                const monthName = months[b.month] || `${b.month}. Ay`;
                const dateText = `${pad(b.day)} ${monthName}${b.year ? ` ${b.year}` : ''}`;
                const name = namesMap.get(b.user_id) || resolveUserDisplayNameSync(this.db, guild, b.user_id, b.username || undefined);
                if (invokerUserId && b.user_id === invokerUserId) {
                    lines.push(`• **${dateText}** ➔ **${name}** (<@${b.user_id}>)`);
                }
                else {
                    lines.push(`• **${dateText}** ➔ **${name}**`);
                }
            }
            lines.push(`────────────────────────────────────────`);
            lines.push(`💡 *Kendini eklemek için: \`/dogumgunu ayarla <gün> <ay> [yıl]\`*`);
            return lines.join('\n');
        };
        const syncMap = new Map();
        for (const b of list) {
            syncMap.set(b.user_id, resolveUserDisplayNameSync(this.db, guild, b.user_id, b.username || undefined));
        }
        const syncResult = {
            success: true,
            message: buildLines(syncMap),
        };
        const asyncPromise = (async () => {
            const asyncMap = new Map(syncMap);
            let anyChanged = false;
            for (const b of list) {
                const curr = asyncMap.get(b.user_id);
                if (!curr || curr.startsWith('Kullanıcı')) {
                    const fresh = await resolveUserDisplayName(this.api, this.db, guild, b.user_id, b.username || undefined);
                    if (fresh && fresh !== curr) {
                        asyncMap.set(b.user_id, fresh);
                        anyChanged = true;
                    }
                }
            }
            return {
                success: true,
                message: anyChanged ? buildLines(asyncMap) : syncResult.message,
            };
        })();
        return makeThenableResult(syncResult, asyncPromise);
    }
    // -------------------------------------------------------------
    // Admin Management Commands
    // -------------------------------------------------------------
    setBirthdayChannel(guild, invoker, channelId, channelName) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return {
                success: false,
                message: '❌ Bu ayarı değiştirmek için **Sunucuyu Yönet (MANAGE_GUILD)** yetkisine sahip olmalısınız.',
            };
        }
        this.db.updateGuildConfig(guild.id, {
            birthday_channel_id: channelId,
            birthday_enabled: 1,
        });
        // Check if there are any pending celebrations for today in this guild and announce them immediately!
        void this.checkAndAnnounceBirthdays(guild.id);
        return {
            success: true,
            message: `🎂 **Doğum Günü Kutlama Kanalı Ayarlandı:** <#${channelId}> (#${channelName})\nDoğum günleri geldiğinde tebrikler otomatik olarak bu kanala gönderilecektir.`,
        };
    }
    setBirthdayMessage(guild, invoker, template) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return {
                success: false,
                message: '❌ Bu ayarı değiştirmek için **Sunucuyu Yönet (MANAGE_GUILD)** yetkisine sahip olmalısınız.',
            };
        }
        this.db.updateGuildConfig(guild.id, {
            birthday_message: template,
        });
        return {
            success: true,
            message: `✅ **Özel Doğum Günü Mesajı Güncellendi!**\nKullanılan Şablon: \`${template}\``,
        };
    }
    toggle(guild, invoker, enabled) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return {
                success: false,
                message: '❌ Bu ayarı değiştirmek için **Sunucuyu Yönet (MANAGE_GUILD)** yetkisine sahip olmalısınız.',
            };
        }
        this.db.updateGuildConfig(guild.id, {
            birthday_enabled: enabled ? 1 : 0,
        });
        if (enabled) {
            void this.checkAndAnnounceBirthdays(guild.id);
        }
        return {
            success: true,
            message: enabled
                ? '🎂 **Doğum Günü Kutlama Sistemi Aktifleştirildi!**'
                : '⚠️ **Doğum Günü Kutlama Sistemi Devre Dışı Bırakıldı.**',
        };
    }
}
//# sourceMappingURL=BirthdayService.js.map