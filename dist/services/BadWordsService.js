// SPDX-License-Identifier: AGPL-3.0-or-later
import { Permissions } from '../config/constants.js';
import { PermissionService } from './PermissionService.js';
import { ModerationService } from './ModerationService.js';
export const DEFAULT_TURKISH_BAD_WORDS = [
    'amk',
    'aq',
    'amq',
    'sik',
    'siki',
    'sikik',
    'sikerim',
    'sikeyim',
    'siktim',
    'siktir',
    'orospu',
    'orospucocugu',
    'oc',
    'oç',
    'pic',
    'piç',
    'yarrak',
    'yarak',
    'tasak',
    'taşak',
    'got',
    'göt',
    'gotveren',
    'götveren',
    'gotlek',
    'götlek',
    'kahpe',
    'ibne',
    'pezevenk',
    'amcuk',
    'amcik',
    'amcık',
    'dalyarak',
    'amina',
    'amına',
    'aminakoyim',
    'aminakoyayim',
    'amınakoyayım',
    'anani',
    'ananı',
    'ananisikeyim',
    'ananısikeyim',
    'surtuk',
    'sürtük',
    'fahise',
    'fahişe',
    'gavat',
    'kavat',
    'yavsak',
    'yavşak',
    'kasar',
    'kaşar',
];
export class BadWordsService {
    api;
    db;
    modLogService;
    constructor(api, db, modLogService) {
        this.api = api;
        this.db = db;
        this.modLogService = modLogService;
    }
    /**
     * Normalizes Turkish text to catch leetspeak, disguised characters, and repetitions.
     */
    normalizeText(text) {
        let s = text
            .replace(/İ/g, 'i')
            .replace(/I/g, 'i')
            .toLowerCase();
        // Map common Turkish diacritics & strip unicode combining accents
        s = s
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .replace(/â/g, 'a')
            .replace(/î/g, 'i')
            .replace(/û/g, 'u')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        // Leetspeak mapping
        s = s
            .replace(/[@4]/g, 'a')
            .replace(/8/g, 'b')
            .replace(/3/g, 'e')
            .replace(/[1!|]/g, 'i')
            .replace(/0/g, 'o')
            .replace(/[$5]/g, 's')
            .replace(/7/g, 't')
            .replace(/v/g, 'u')
            .replace(/w/g, 'v');
        return s;
    }
    /**
     * Detects if the message contains prohibited words.
     * Returns the detected bad word if found, or null.
     */
    findBadWord(content, customWords, checkDefault) {
        if (!content || !content.trim())
            return null;
        const normalized = this.normalizeText(content);
        // Remove space separators and punctuation to catch "s.i.k" or "o r o s p u"
        const collapsed = normalized.replace(/[\s\.\,\-\_\*\~\+\=\#\/\\]+/g, '');
        // Collapse consecutive repeating letters to catch "siiiiik", "piiiiic"
        const deduplicated = collapsed.replace(/(.)\1+/g, '$1');
        // Split words by standard whitespace and punctuation for exact matching (e.g. short words like "aq")
        const tokens = normalized.split(/[\s\.\,\-\_\*\~\+\=\#\/\\!\?\:\;\"\']+/).filter(Boolean);
        const deduplicatedTokens = tokens.map((t) => t.replace(/(.)\1+/g, '$1'));
        // 1. Check custom words (longer words first)
        const sortedCustom = [...customWords].sort((a, b) => b.length - a.length);
        for (const rawWord of sortedCustom) {
            const cleanCustom = this.normalizeText(rawWord.trim());
            if (!cleanCustom)
                continue;
            if (cleanCustom.length <= 3) {
                // Exact token matching for short words
                if (tokens.includes(cleanCustom) || deduplicatedTokens.includes(cleanCustom))
                    return rawWord;
            }
            else {
                if (normalized.includes(cleanCustom) || collapsed.includes(cleanCustom) || deduplicated.includes(cleanCustom)) {
                    return rawWord;
                }
            }
        }
        // 2. Check default Turkish profanity words if enabled (longer words first)
        if (checkDefault) {
            const sortedDefaults = [...DEFAULT_TURKISH_BAD_WORDS].sort((a, b) => b.length - a.length);
            for (const bad of sortedDefaults) {
                const cleanBad = this.normalizeText(bad);
                if (cleanBad.length <= 2) {
                    if (tokens.includes(cleanBad) || deduplicatedTokens.includes(cleanBad))
                        return bad;
                }
                else if (cleanBad.length === 3) {
                    // 3-letter words like sik, amk, pic, got
                    if (tokens.includes(cleanBad) ||
                        deduplicatedTokens.includes(cleanBad) ||
                        collapsed.includes(cleanBad) ||
                        deduplicated.includes(cleanBad)) {
                        return bad;
                    }
                }
                else {
                    if (normalized.includes(cleanBad) || collapsed.includes(cleanBad) || deduplicated.includes(cleanBad)) {
                        return bad;
                    }
                }
            }
        }
        return null;
    }
    /**
     * Process a message for bad words. Returns true if offending message was caught.
     */
    async handleMessage(guild, member, message) {
        if (member.user.bot)
            return false;
        const config = this.db.getGuildConfig(guild.id);
        if (!config.badwords_enabled)
            return false;
        // Check moderator exemption
        const isOwner = guild.owner_id === member.user.id;
        const isAdmin = PermissionService.hasPermission(guild, member, Permissions.ADMINISTRATOR);
        const exemptMods = config.badwords_exempt_mods ?? 1;
        const isMod = PermissionService.hasPermission(guild, member, Permissions.MANAGE_MESSAGES) ||
            PermissionService.hasPermission(guild, member, Permissions.MANAGE_GUILD) ||
            PermissionService.hasPermission(guild, member, Permissions.MODERATE_MEMBERS);
        if (isOwner || isAdmin || (exemptMods && isMod)) {
            return false;
        }
        let customWords = [];
        try {
            customWords = JSON.parse(config.badwords_custom || '[]');
        }
        catch {
            customWords = [];
        }
        const checkDefault = (config.badwords_filter_default ?? 1) === 1;
        const detected = this.findBadWord(message.content, customWords, checkDefault);
        if (!detected)
            return false;
        console.warn(`[BadWordsService] 🚫 Küfür/Yasaklı kelime tespit edildi (${member.user.username}): "${detected}"`);
        // 1. Delete message
        let deleteFailed = false;
        try {
            await this.api.deleteMessage(message.channel_id, message.id, `Küfür/Yasaklı Kelime Filtresi: ${detected}`);
        }
        catch (err) {
            deleteFailed = true;
            console.error(`[BadWordsService] Mesaj silinemedi:`, err.message);
        }
        const punishment = (config.badwords_punishment || 'delete').toLowerCase();
        // 2. Apply punishment
        if (punishment === 'timeout') {
            const durationSeconds = 300; // 5 minutes
            const humanDuration = ModerationService.formatDuration(durationSeconds);
            const reason = `Otomatik Küfür Filtresi (Yasaklı Kelime: "${detected}")`;
            try {
                await this.api.timeoutMember(guild.id, member.user.id, durationSeconds, reason);
                const expireUnix = Math.floor(Date.now() / 1000) + durationSeconds;
                const sentMsg = await this.api.sendMessage(message.channel_id, `⏳ **<@${member.user.id}>**, bu sunucuda küfür ve hakaret içerikli mesajlar yasaktır!\n` +
                    `**Ceza:** ${humanDuration} zamanaşımı (mute)\n` +
                    `**Bitiş:** <t:${expireUnix}:R>`);
                if (sentMsg?.id) {
                    setTimeout(() => {
                        void this.api.deleteMessage(message.channel_id, sentMsg.id).catch(() => { });
                    }, 6000);
                }
            }
            catch (err) {
                console.error(`[BadWordsService] Timeout uygulanamadı:`, err.message);
                // Fallback to warning notice
                await this.sendWarningNotice(message.channel_id, member.user.id, deleteFailed);
            }
        }
        else if (punishment === 'warn') {
            try {
                this.db.addWarning(guild.id, member.user.id, 'SİSTEM (Auto-Mod)', `Yasaklı Kelime/Küfür Kullanımı: "${detected}"`);
                const warnNotice = await this.api.sendMessage(message.channel_id, `⚠️ **<@${member.user.id}>**, bu sunucuda küfür ve hakaret içerikli kelimeler yasaktır! Hesabınıza **uyarı (warn)** eklendi.`);
                if (warnNotice?.id) {
                    setTimeout(() => {
                        void this.api.deleteMessage(message.channel_id, warnNotice.id).catch(() => { });
                    }, 6000);
                }
            }
            catch { }
        }
        else {
            // 'delete' only
            await this.sendWarningNotice(message.channel_id, member.user.id, deleteFailed);
        }
        // 3. Log to DB and Mod-Log Channel
        try {
            this.db.addModerationLog(guild.id, 'BAD_WORDS_FILTER', member.user.id, 'SYSTEM', message.channel_id, `Yasaklı kelime kullanımı ("${detected}")`, { punishment, detectedWord: detected });
            if (this.modLogService) {
                void this.modLogService.sendModLog(guild.id, {
                    action: 'KÜFÜR_FİLTRESİ',
                    target: member.user,
                    reason: `Yasaklı kelime tespit edildi ("${detected}"). Ceza: ${punishment.toUpperCase()}`,
                    channelId: message.channel_id,
                });
            }
        }
        catch { }
        return true;
    }
    async sendWarningNotice(channelId, userId, deleteFailed) {
        try {
            let notice = `⚠️ **<@${userId}>**, bu sunucuda küfür ve argo kelimeler kullanmak yasaktır!`;
            if (deleteFailed) {
                notice += '\n⚠️ *(Uyarı: Botun bu kanalda "Mesajları Yönet" yetkisi olmadığı için mesaj silinemedi!)*';
            }
            const sent = await this.api.sendMessage(channelId, notice);
            if (sent?.id) {
                setTimeout(() => {
                    void this.api.deleteMessage(channelId, sent.id).catch(() => { });
                }, 5000);
            }
        }
        catch { }
    }
    // -------------------------------------------------------------
    // Configuration Commands
    // -------------------------------------------------------------
    toggle(guild, invoker, enabled) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return { success: false, message: '❌ Bu ayarı değiştirmek için **Sunucuyu Yönet (MANAGE_GUILD)** yetkisine sahip olmalısınız.' };
        }
        this.db.updateGuildConfig(guild.id, {
            badwords_enabled: enabled ? 1 : 0,
        });
        return {
            success: true,
            message: enabled
                ? '🛡️ **Küfür / Argo Filtresi Aktif:** Sunucudaki küfür ve argo içerikli mesajlar otomatik olarak engellenecektir.'
                : '⚠️ **Küfür / Argo Filtresi Kapatıldı:** Sunucuda kelime denetimi devre dışı bırakıldı.',
        };
    }
    toggleDefault(guild, invoker, enabled) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return { success: false, message: '❌ Bu ayarı değiştirmek için **Sunucuyu Yönet (MANAGE_GUILD)** yetkisine sahip olmalısınız.' };
        }
        this.db.updateGuildConfig(guild.id, {
            badwords_filter_default: enabled ? 1 : 0,
        });
        return {
            success: true,
            message: enabled
                ? '🇹🇷 **Genel Türkçe Küfür Filtresi Aktif:** Botun yerleşik küfür ve argo veritabanı denetlenecektir.'
                : 'ℹ️ **Genel Türkçe Küfür Filtresi Kapatıldı:** Yalnızca sunucuya özel eklenen kelimeler filtrelenecektir.',
        };
    }
    toggleExempt(guild, invoker, exempt) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return { success: false, message: '❌ Bu ayarı değiştirmek için **Sunucuyu Yönet (MANAGE_GUILD)** yetkisine sahip olmalısınız.' };
        }
        this.db.updateGuildConfig(guild.id, {
            badwords_exempt_mods: exempt ? 1 : 0,
        });
        return {
            success: true,
            message: exempt
                ? '🛡️ **Yetkili Muafiyeti Açık:** Sunucu yöneticileri ve moderatörleri küfür filtresinden muaf tutulacaktır.'
                : '⚠️ **Yetkili Muafiyeti Kapalı:** Yetkililer dahil tüm üyelerin mesajları filtrelenecektir.',
        };
    }
    setPunishment(guild, invoker, punishment) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return { success: false, message: '❌ Bu ayarı değiştirmek için **Sunucuyu Yönet (MANAGE_GUILD)** yetkisine sahip olmalısınız.' };
        }
        const norm = punishment.toLowerCase().trim();
        if (!['delete', 'warn', 'timeout'].includes(norm)) {
            return {
                success: false,
                message: '❌ Geçersiz ceza türü! Seçenekler: `delete` (sadece sil), `warn` (sil + uyar), `timeout` (sil + 5dk sustur)',
            };
        }
        this.db.updateGuildConfig(guild.id, {
            badwords_punishment: norm,
        });
        const label = norm === 'timeout'
            ? 'Mesajı Sil + 5 Dakika Zamanaşımı (Mute)'
            : norm === 'warn'
                ? 'Mesajı Sil + Resmi Uyarı Ekle (Warn)'
                : 'Yalnızca Mesajı Sil';
        return {
            success: true,
            message: `⚖️ **Küfür Filtresi Cezası Güncellendi:** \`${label}\``,
        };
    }
    addWord(guild, invoker, word) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return { success: false, message: '❌ Kelime eklemek için **Sunucuyu Yönet (MANAGE_GUILD)** yetkisine sahip olmalısınız.' };
        }
        const clean = word.toLowerCase().trim();
        if (!clean || clean.length < 2) {
            return { success: false, message: '❌ Eklemek istediğiniz kelime en az 2 karakter olmalıdır.' };
        }
        const config = this.db.getGuildConfig(guild.id);
        let list = [];
        try {
            list = JSON.parse(config.badwords_custom || '[]');
        }
        catch {
            list = [];
        }
        if (list.includes(clean)) {
            return { success: false, message: `⚠️ \`${clean}\` kelimesi zaten kara listede bulunuyor.` };
        }
        list.push(clean);
        this.db.updateGuildConfig(guild.id, {
            badwords_custom: JSON.stringify(list),
        });
        return {
            success: true,
            message: `✅ \`${clean}\` kelimesi sunucu kara listesine eklendi! Toplam özel kelime: \`${list.length}\``,
        };
    }
    removeWord(guild, invoker, word) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return { success: false, message: '❌ Kelime kaldırmak için **Sunucuyu Yönet (MANAGE_GUILD)** yetkisine sahip olmalısınız.' };
        }
        const clean = word.toLowerCase().trim();
        const config = this.db.getGuildConfig(guild.id);
        let list = [];
        try {
            list = JSON.parse(config.badwords_custom || '[]');
        }
        catch {
            list = [];
        }
        const idx = list.indexOf(clean);
        if (idx === -1) {
            return { success: false, message: `❌ \`${clean}\` kelimesi özel kara listede bulunamadı.` };
        }
        list.splice(idx, 1);
        this.db.updateGuildConfig(guild.id, {
            badwords_custom: JSON.stringify(list),
        });
        return {
            success: true,
            message: `🗑️ \`${clean}\` kelimesi kara listeden çıkarıldı. Kalan özel kelime: \`${list.length}\``,
        };
    }
    clearWords(guild, invoker) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return { success: false, message: '❌ Kelimeleri temizlemek için **Sunucuyu Yönet (MANAGE_GUILD)** yetkisine sahip olmalısınız.' };
        }
        this.db.updateGuildConfig(guild.id, {
            badwords_custom: '[]',
        });
        return {
            success: true,
            message: '🧹 **Kara Liste Temizlendi:** Sunucuya özel tüm yasaklı kelimeler silindi.',
        };
    }
    listWords(guild, invoker) {
        const config = this.db.getGuildConfig(guild.id);
        let list = [];
        try {
            list = JSON.parse(config.badwords_custom || '[]');
        }
        catch {
            list = [];
        }
        const isEnabled = (config.badwords_enabled ?? 0) === 1;
        const isDefault = (config.badwords_filter_default ?? 1) === 1;
        const isExempt = (config.badwords_exempt_mods ?? 1) === 1;
        const punishment = config.badwords_punishment || 'delete';
        const lines = [
            '🛡️ **Sunucu Küfür ve Yasaklı Kelime Filtresi**',
            '────────────────────────────────────────',
            `• **Durum:** ${isEnabled ? '🟢 Açık' : '🔴 Kapalı'}`,
            `• **Genel Türkçe Filtresi:** ${isDefault ? '🟢 Açık' : '🔴 Kapalı'}`,
            `• **Ceza Türü:** \`${punishment.toUpperCase()}\` (${punishment === 'timeout' ? 'Sil + 5dk Mute' : punishment === 'warn' ? 'Sil + Warn' : 'Sadece Sil'})`,
            `• **Yetkili Muafiyeti:** ${isExempt ? '🟢 Açık' : '🔴 Kapalı'}`,
            `• **Özel Yasaklı Kelimeler (${list.length} adet):**`,
        ];
        if (list.length === 0) {
            lines.push('*Henüz özel bir kelime eklenmemiş. `/badwords add <kelime>` ile ekleyebilirsiniz.*');
        }
        else {
            const display = list.map((w) => `\`${w}\``).join(', ');
            lines.push(display);
        }
        lines.push('────────────────────────────────────────');
        return {
            success: true,
            message: lines.join('\n'),
        };
    }
}
//# sourceMappingURL=BadWordsService.js.map