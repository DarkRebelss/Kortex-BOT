// SPDX-License-Identifier: AGPL-3.0-or-later
import { Permissions } from '../config/constants.js';
import { PermissionService } from './PermissionService.js';
export class AntiRaidService {
    api;
    db;
    modLogService;
    trackers = new Map();
    RAID_WINDOW_MS = 10_000; // 10 seconds
    RAID_LOCK_DURATION_MS = 300_000; // 5 minutes
    constructor(api, db, modLogService) {
        this.api = api;
        this.db = db;
        this.modLogService = modLogService;
        // Periodic garbage collection to prevent memory leaks (clean trackers inactive for > 10 min)
        setInterval(() => {
            const now = Date.now();
            for (const [guildId, tracker] of this.trackers.entries()) {
                if (now > tracker.raidActiveUntil && tracker.joinTimestamps.every((t) => now - t > 60_000)) {
                    this.trackers.delete(guildId);
                }
            }
        }, 60_000);
    }
    /**
     * Evaluates incoming member join against raid thresholds.
     * Returns true if the join was part of a raid and handled (kicked or timed out).
     */
    async handleMemberJoin(guild, member) {
        const config = this.db.getGuildConfig(guild.id);
        if (!config.antiraid_enabled) {
            return { isRaid: false };
        }
        const threshold = config.antiraid_threshold || 8;
        const action = (config.antiraid_action || 'kick').toLowerCase();
        const now = Date.now();
        let tracker = this.trackers.get(guild.id);
        if (!tracker) {
            tracker = { joinTimestamps: [], raidActiveUntil: 0 };
            this.trackers.set(guild.id, tracker);
        }
        // Check if raid mode is currently active
        if (now < tracker.raidActiveUntil) {
            console.warn(`[AntiRaid] Raid modu devrede! Katılan kullanıcı cezalandırılıyor: ${member.user.username} (${member.user.id})`);
            await this.punishRaidMember(guild.id, member, action, 'Raid saldırısı koruması (Aktif raid modu)');
            return { isRaid: true, actionTaken: action === 'timeout' ? 'timeout' : 'kick' };
        }
        // Prune timestamps older than window
        tracker.joinTimestamps = tracker.joinTimestamps.filter((ts) => now - ts < this.RAID_WINDOW_MS);
        tracker.joinTimestamps.push(now);
        // If join velocity exceeds threshold, trigger Raid Mode!
        if (tracker.joinTimestamps.length >= threshold) {
            tracker.raidActiveUntil = now + this.RAID_LOCK_DURATION_MS;
            console.warn(`[AntiRaid] 🚨 RAID SALDIRISI TESPİT EDİLDİ! Sunucu: ${guild.name} (${guild.id}) - 10 saniyede ${tracker.joinTimestamps.length} giriş`);
            // Send emergency notice to modlog or system channel
            const alertMsg = `🚨 **DİKKAT: RAID / BOT SALDIRISI TESPİT EDİLDİ!**\nSon 10 saniyede **${tracker.joinTimestamps.length}** hesap katıldı.\n🛡️ Sunucu **5 dakika** boyunca otomatik Anti-Raid koruma moduna alındı.\nYeni katılan hesaplar otomatik olarak: **${action.toUpperCase()}** edilecek.`;
            if (this.modLogService && config.modlog_channel_id) {
                void this.modLogService.sendModLog(guild.id, {
                    action: '🚨 RAID KORUMASI DEVREYE GİRDİ',
                    target: member.user,
                    reason: alertMsg,
                });
            }
            else if (guild.system_channel_id) {
                void this.api.sendMessage(guild.system_channel_id, alertMsg).catch(() => { });
            }
            await this.punishRaidMember(guild.id, member, action, `Raid saldırısı başlangıcı (${tracker.joinTimestamps.length} giriş / 10sn)`);
            return { isRaid: true, actionTaken: action === 'timeout' ? 'timeout' : 'kick' };
        }
        return { isRaid: false };
    }
    async punishRaidMember(guildId, member, action, reason) {
        try {
            if (action === 'timeout') {
                // 24 hour timeout
                await this.api.timeoutMember(guildId, member.user.id, 86400, reason);
            }
            else {
                // Default: Kick
                await this.api.kickMember(guildId, member.user.id, reason);
            }
        }
        catch (err) {
            console.error(`[AntiRaid] Ceza uygulama hatası (${member.user.username}):`, err.message);
        }
    }
    // -------------------------------------------------------------
    // Configuration Commands
    // -------------------------------------------------------------
    toggle(guild, invoker, enable) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.ADMINISTRATOR) && invoker.user.id !== guild.owner_id) {
            return { success: false, message: '❌ Bu komutu kullanmak için **Yönetici (Administrator)** yetkisine sahip olmalısınız.' };
        }
        this.db.updateGuildConfig(guild.id, { antiraid_enabled: enable ? 1 : 0 });
        return {
            success: true,
            message: enable
                ? '🛡️ **Anti-Raid Akın Koruması Aktifleştirildi!**\nSunucuya 10 saniyede belirlenen eşikten fazla giriş olursa otomatik raid savunması devreye girecektir.'
                : '⚠️ **Anti-Raid Koruması Kapatıldı.**',
        };
    }
    setThreshold(guild, invoker, count) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.ADMINISTRATOR) && invoker.user.id !== guild.owner_id) {
            return { success: false, message: '❌ Bu komutu kullanmak için **Yönetici (Administrator)** yetkisine sahip olmalısınız.' };
        }
        if (count < 3 || count > 50) {
            return { success: false, message: '❌ Raid tetikleme eşiği 3 ile 50 arasında olmalıdır. (Örn: `/antiraid limit 8`)' };
        }
        this.db.updateGuildConfig(guild.id, { antiraid_threshold: count });
        return {
            success: true,
            message: `✅ **Anti-Raid Eşiği Güncellendi:** 10 saniyede **${count}** ve üzeri katılım olduğunda koruma devreye girecek.`,
        };
    }
    setAction(guild, invoker, action) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.ADMINISTRATOR) && invoker.user.id !== guild.owner_id) {
            return { success: false, message: '❌ Bu komutu kullanmak için **Yönetici (Administrator)** yetkisine sahip olmalısınız.' };
        }
        const norm = action.toLowerCase().trim();
        if (norm !== 'kick' && norm !== 'timeout' && norm !== 'at' && norm !== 'sustur') {
            return { success: false, message: '❌ Geçersiz işlem! Seçenekler: `kick` (sunucudan at) veya `timeout` (24 saat sustur).' };
        }
        const finalAction = norm === 'timeout' || norm === 'sustur' ? 'timeout' : 'kick';
        this.db.updateGuildConfig(guild.id, { antiraid_action: finalAction });
        return {
            success: true,
            message: `✅ **Anti-Raid Cezası Güncellendi:** Saldırı anında yeni katılan hesaplar **${finalAction === 'kick' ? 'Sunucudan Atılacak (Kick)' : '24 Saat Susturulacak (Timeout)'}**.`,
        };
    }
    getStatus(guild) {
        const config = this.db.getGuildConfig(guild.id);
        const tracker = this.trackers.get(guild.id);
        const now = Date.now();
        const isRaid = tracker && now < tracker.raidActiveUntil;
        const remainingSec = isRaid ? Math.ceil((tracker.raidActiveUntil - now) / 1000) : 0;
        return {
            success: true,
            message: `🛡️ **Anti-Raid Koruma Durumu:**\n` +
                `• **Durum:** ${config.antiraid_enabled ? '🟢 Aktif' : '🔴 Pasif'}\n` +
                `• **Hassasiyet / Eşik:** 10 saniyede **${config.antiraid_threshold || 8}** kullanıcı\n` +
                `• **Uygulanacak Ceza:** \`${(config.antiraid_action || 'kick').toUpperCase()}\`\n` +
                `• **Raid Modu:** ${isRaid ? `🚨 **AKTİF!** (${remainingSec} saniye kaldı)` : '✅ Sakin / Normal'}\n\n` +
                `*Ayar komutları: \`/antiraid on/off\`, \`/antiraid limit <sayı>\`, \`/antiraid action <kick|timeout>\`*`,
        };
    }
}
//# sourceMappingURL=AntiRaidService.js.map