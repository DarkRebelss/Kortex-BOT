// SPDX-License-Identifier: AGPL-3.0-or-later
import { Permissions } from '../config/constants.js';
import { PermissionService } from './PermissionService.js';
import { t } from '../locales/i18n.js';
import { WelcomeCardGenerator } from './WelcomeCardGenerator.js';
export class WelcomeGoodbyeService {
    api;
    db;
    constructor(api, db) {
        this.api = api;
        this.db = db;
    }
    /**
     * Format message template replacing dynamic placeholders:
     * {user}, {username}, {id}, {memberCount}, {guildName}
     */
    static formatTemplate(template, user, guild, memberCount) {
        const count = memberCount ?? guild.member_count ?? guild.members?.length ?? 1;
        const resolvedUsername = user?.username || user?.global_name || user?.nick || 'Üye';
        const resolvedId = user?.id || '';
        return template
            .replaceAll('{user}', resolvedId ? `<@${resolvedId}>` : `@${resolvedUsername}`)
            .replaceAll('{username}', resolvedUsername)
            .replaceAll('{id}', resolvedId)
            .replaceAll('{memberCount}', String(count))
            .replaceAll('{guildName}', guild?.name || 'Sunucu');
    }
    // -------------------------------------------------------------
    // Event Handlers
    // -------------------------------------------------------------
    async onMemberJoin(guild, member) {
        const config = this.db.getGuildConfig(guild.id);
        if (!config.welcome_enabled || !config.welcome_channel_id)
            return;
        try {
            await this.sendWelcomeCardMessage(config.welcome_channel_id, member.user, guild, undefined, '', member);
        }
        catch (err) {
            console.error(`[WelcomeGoodbyeService] Failed to send welcome message in guild ${guild.id}:`, err);
        }
    }
    async onMemberLeave(guild, user, member) {
        const config = this.db.getGuildConfig(guild.id);
        if (!config.goodbye_enabled || !config.goodbye_channel_id)
            return;
        try {
            await this.sendGoodbyeCardMessage(config.goodbye_channel_id, user, guild, undefined, '', member);
        }
        catch (err) {
            console.error(`[WelcomeGoodbyeService] Failed to send goodbye message in guild ${guild.id}:`, err);
        }
    }
    /**
     * Resolves the user's avatar URL from member avatar, user avatar/avatar_hash,
     * or fetches fresh profile if needed, falling back to Micup default avatar index.
     */
    async resolveAvatarUrl(user, member, guildId) {
        let memberAvatar = member?.avatar;
        let userAvatar = user.avatar || user.avatar_hash;
        // If neither is present, try fetching fresh member/user data
        if (!memberAvatar && !userAvatar && user.id) {
            try {
                if (guildId) {
                    const freshMember = await this.api.getGuildMember(guildId, user.id);
                    if (freshMember?.avatar)
                        memberAvatar = freshMember.avatar;
                    if (freshMember?.user?.avatar)
                        userAvatar = freshMember.user.avatar;
                    if (freshMember?.user?.avatar_hash)
                        userAvatar = freshMember.user.avatar_hash;
                }
                if (!userAvatar) {
                    const freshUser = await this.api.request(`/users/${user.id}`);
                    if (freshUser?.avatar)
                        userAvatar = freshUser.avatar;
                    if (freshUser?.avatar_hash)
                        userAvatar = freshUser.avatar_hash;
                }
            }
            catch {
                // Silently continue to fallback
            }
        }
        if (memberAvatar) {
            if (memberAvatar.startsWith('http://') || memberAvatar.startsWith('https://')) {
                return memberAvatar;
            }
            const clean = memberAvatar.replace(/\.(png|gif|webp|jpe?g)$/i, '');
            const isAnimated = clean.startsWith('a_') || memberAvatar.toLowerCase().includes('gif');
            const ext = isAnimated ? 'gif' : 'png';
            if (guildId) {
                return `https://micup.gg/media/guilds/${guildId}/users/${user.id}/avatars/${clean}.${ext}`;
            }
            return `https://micup.gg/media/avatars/${user.id}/${clean}.${ext}`;
        }
        if (userAvatar) {
            if (userAvatar.startsWith('http://') || userAvatar.startsWith('https://')) {
                return userAvatar;
            }
            const clean = userAvatar.replace(/\.(png|gif|webp|jpe?g)$/i, '');
            const isAnimated = clean.startsWith('a_') || userAvatar.toLowerCase().includes('gif');
            const ext = isAnimated ? 'gif' : 'png';
            return `https://micup.gg/media/avatars/${user.id}/${clean}.${ext}`;
        }
        try {
            const idx = Number(BigInt(user.id) % 6n);
            return `https://micup.gg/avatars/${idx}.png`;
        }
        catch {
            return `https://micup.gg/avatars/0.png`;
        }
    }
    /**
     * Sends the rich embed welcome card message matching MAXGuard UI layout.
     */
    async sendWelcomeCardMessage(channelId, user, guild, memberCount, prefixNotice = '', member) {
        const config = this.db.getGuildConfig(guild.id);
        const count = memberCount ?? guild.member_count ?? guild.members?.length ?? 1;
        const avatarUrl = await this.resolveAvatarUrl(user, member, guild.id);
        let cardBuffer = null;
        try {
            const welcomeSentence = config.welcome_message
                ? WelcomeGoodbyeService.formatTemplate(config.welcome_message, user, guild, count)
                    .replace(/<@!?\d+>/g, `@${user.username}`)
                    .split('\n')[0]
                : `${guild.name || 'BROFIST'} Kabilesine Hoş geldin! 👊`;
            cardBuffer = await WelcomeCardGenerator.generateCard({
                username: user.username,
                avatarUrl,
                subtitle: config.welcome_card_subtitle || 'TOPLULUĞA KATILDI',
                welcomeText: welcomeSentence,
                brandingText: 'Kyron',
                sloganText: config.welcome_card_slogan || 'Karanlıkta parlayan yeni bir yıldız.',
                customColor: config.welcome_card_color || undefined,
                accentColor: config.welcome_card_accent_color || undefined,
                logoUrl: config.welcome_card_logo_url || undefined,
            });
        }
        catch (err) {
            console.error('[WelcomeGoodbyeService] Error generating welcome card image:', err);
        }
        if (cardBuffer) {
            // Send ONLY the visual image (no embed, no outer text)
            await this.api.sendMessage(channelId, prefixNotice || '', {
                files: [
                    {
                        name: 'welcome.png',
                        buffer: cardBuffer,
                        contentType: 'image/png',
                    },
                ],
            });
        }
        else {
            // Fallback message if image generation fails
            const fallbackMsg = prefixNotice ? `${prefixNotice}\nHoş geldin <@${user.id}>!` : `Hoş geldin <@${user.id}>!`;
            await this.api.sendMessage(channelId, fallbackMsg);
        }
    }
    /**
     * Sends the rich embed goodbye message.
     */
    async sendGoodbyeCardMessage(channelId, user, guild, memberCount, prefixNotice = '', member) {
        const config = this.db.getGuildConfig(guild.id);
        const count = memberCount ?? guild.member_count ?? guild.members?.length ?? 1;
        const avatarUrl = await this.resolveAvatarUrl(user, member, guild.id);
        let cardBuffer = null;
        const resolvedUsername = user?.username || user?.global_name || user?.nick || member?.nick || member?.user?.username || 'Üye';
        try {
            const goodbyeSentence = config.goodbye_message
                ? WelcomeGoodbyeService.formatTemplate(config.goodbye_message, user, guild, count)
                    .replace(/<@!?\d+>/g, `@${resolvedUsername}`)
                    .split('\n')[0]
                : 'Yolun açık olsun, tekrar bekleriz! 👋';
            cardBuffer = await WelcomeCardGenerator.generateGoodbyeCard({
                username: resolvedUsername,
                avatarUrl,
                subtitle: config.goodbye_card_subtitle || 'TOPLULUKTAN AYRILDI',
                welcomeText: goodbyeSentence,
                brandingText: 'Kyron',
                sloganText: config.goodbye_card_slogan || 'Disconnecting... ama izler kalır.',
                customColor: config.goodbye_card_color || '#f43f5e',
                accentColor: config.goodbye_card_accent_color || '#fb7185',
                theme: 'crimson',
                logoUrl: config.goodbye_card_logo_url || config.welcome_card_logo_url || undefined,
            });
        }
        catch (err) {
            console.error('[WelcomeGoodbyeService] Error generating goodbye card image:', err);
        }
        if (cardBuffer) {
            // Send ONLY the visual image (no embed, no outer text)
            await this.api.sendMessage(channelId, prefixNotice || '', {
                files: [
                    {
                        name: 'goodbye.png',
                        buffer: cardBuffer,
                        contentType: 'image/png',
                    },
                ],
            });
        }
        else {
            // Fallback message if image generation fails
            const fallbackMsg = prefixNotice ? `${prefixNotice}\n**${resolvedUsername}** sunucumuzdan ayrıldı.` : `**${resolvedUsername}** sunucumuzdan ayrıldı.`;
            await this.api.sendMessage(channelId, fallbackMsg);
        }
    }
    // -------------------------------------------------------------
    // Configuration Commands
    // -------------------------------------------------------------
    setWelcomeChannel(guild, invoker, channelId, channelName) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return { success: false, message: t('errors.no_permission') };
        }
        this.db.updateGuildConfig(guild.id, {
            welcome_channel_id: channelId,
            welcome_enabled: 1,
        });
        return {
            success: true,
            message: t('welcome_goodbye.welcome_set', { channel: channelName }),
        };
    }
    setWelcomeMessage(guild, invoker, messageTemplate) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return { success: false, message: t('errors.no_permission') };
        }
        this.db.updateGuildConfig(guild.id, {
            welcome_message: messageTemplate,
        });
        return {
            success: true,
            message: t('welcome_goodbye.welcome_msg_set', { message: messageTemplate }),
        };
    }
    toggleWelcome(guild, invoker, enable) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return { success: false, message: t('errors.no_permission') };
        }
        this.db.updateGuildConfig(guild.id, {
            welcome_enabled: enable ? 1 : 0,
        });
        const status = enable ? 'Aktif' : 'Devre Dışı';
        const cfg = this.db.getGuildConfig(guild.id);
        return {
            success: true,
            message: t('welcome_goodbye.welcome_status', {
                status,
                channel: cfg.welcome_channel_id ? `<#${cfg.welcome_channel_id}>` : 'Belirtilmedi',
            }),
        };
    }
    setGoodbyeChannel(guild, invoker, channelId, channelName) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return { success: false, message: t('errors.no_permission') };
        }
        this.db.updateGuildConfig(guild.id, {
            goodbye_channel_id: channelId,
            goodbye_enabled: 1,
        });
        return {
            success: true,
            message: t('welcome_goodbye.goodbye_set', { channel: channelName }),
        };
    }
    setGoodbyeMessage(guild, invoker, messageTemplate) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return { success: false, message: t('errors.no_permission') };
        }
        this.db.updateGuildConfig(guild.id, {
            goodbye_message: messageTemplate,
        });
        return {
            success: true,
            message: t('welcome_goodbye.goodbye_msg_set', { message: messageTemplate }),
        };
    }
    toggleGoodbye(guild, invoker, enable) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return { success: false, message: t('errors.no_permission') };
        }
        this.db.updateGuildConfig(guild.id, {
            goodbye_enabled: enable ? 1 : 0,
        });
        const status = enable ? 'Aktif' : 'Devre Dışı';
        const cfg = this.db.getGuildConfig(guild.id);
        return {
            success: true,
            message: t('welcome_goodbye.goodbye_status', {
                status,
                channel: cfg.goodbye_channel_id ? `<#${cfg.goodbye_channel_id}>` : 'Belirtilmedi',
            }),
        };
    }
    // -------------------------------------------------------------
    // Card Design Customization (Community & Command-based)
    // -------------------------------------------------------------
    setCardDesign(type, guild, invoker, updates) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return { success: false, message: t('errors.no_permission') };
        }
        const isWelcome = type === 'welcome';
        const prefix = isWelcome ? 'welcome_card' : 'goodbye_card';
        const label = isWelcome ? 'Hoş Geldin' : 'Görüşürüz';
        const dbUpdates = {};
        if (updates.color !== undefined) {
            dbUpdates[`${prefix}_color`] = updates.color;
        }
        if (updates.accentColor !== undefined) {
            dbUpdates[`${prefix}_accent_color`] = updates.accentColor;
        }
        if (updates.subtitle !== undefined) {
            dbUpdates[`${prefix}_subtitle`] = updates.subtitle;
        }
        if (updates.slogan !== undefined) {
            dbUpdates[`${prefix}_slogan`] = updates.slogan;
        }
        if (updates.logoUrl !== undefined) {
            dbUpdates[`${prefix}_logo_url`] = updates.logoUrl;
        }
        this.db.updateGuildConfig(guild.id, dbUpdates);
        return {
            success: true,
            message: `🎨 **${label} Kart Tasarımı Güncellendi!**\nDeğişiklikleri önizlemek için \`/${type} test\` komutunu kullanabilirsiniz.`,
        };
    }
    resetCardDesign(type, guild, invoker) {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
            return { success: false, message: t('errors.no_permission') };
        }
        const isWelcome = type === 'welcome';
        const prefix = isWelcome ? 'welcome_card' : 'goodbye_card';
        const label = isWelcome ? 'Hoş Geldin' : 'Görüşürüz';
        this.db.updateGuildConfig(guild.id, {
            [`${prefix}_color`]: null,
            [`${prefix}_accent_color`]: null,
            [`${prefix}_subtitle`]: null,
            [`${prefix}_slogan`]: null,
            [`${prefix}_logo_url`]: null,
        });
        return {
            success: true,
            message: `🔄 **${label} Kart Tasarımı Sıfırlandı!** Varsayılan ayarlara döndürüldü.`,
        };
    }
    getCardDesignStatus(type, guild) {
        const config = this.db.getGuildConfig(guild.id);
        const isWelcome = type === 'welcome';
        const label = isWelcome ? 'Hoş Geldin' : 'Görüşürüz';
        const channelId = isWelcome ? config.welcome_channel_id : config.goodbye_channel_id;
        const isEnabled = isWelcome ? config.welcome_enabled : config.goodbye_enabled;
        const color = isWelcome
            ? (config.welcome_card_color || '#10b981 (Varsayılan Zümrüt Yeşili)')
            : (config.goodbye_card_color || '#f43f5e (Varsayılan Gül Kırmızı)');
        const accent = isWelcome
            ? (config.welcome_card_accent_color || '#34d399 (Varsayılan Açık Yeşil)')
            : (config.goodbye_card_accent_color || '#fb7185 (Varsayılan Pembe)');
        const subtitle = isWelcome
            ? (config.welcome_card_subtitle || 'TOPLULUĞA KATILDI')
            : (config.goodbye_card_subtitle || 'TOPLULUKTAN AYRILDI');
        const slogan = isWelcome
            ? (config.welcome_card_slogan || 'Karanlıkta parlayan yeni bir yıldız.')
            : (config.goodbye_card_slogan || 'Disconnecting... ama izler kalır.');
        const logo = isWelcome
            ? (config.welcome_card_logo_url || 'Yok (Logosuz — /welcome logo <URL> ile eklenebilir)')
            : (config.goodbye_card_logo_url || 'Yok (Logosuz — /goodbye logo <URL> ile eklenebilir)');
        return (`🎨 **${label} Kart Tasarımı & Yapılandırması:**\n\n` +
            `• **Durum:** ${isEnabled ? '🟢 Açık' : '🔴 Kapalı'}\n` +
            `• **Kanal:** ${channelId ? `<#${channelId}>` : '*Belirtilmedi*'}\n` +
            `• **Ana Renk:** \`${color}\`\n` +
            `• **Vurgu Rengi:** \`${accent}\`\n` +
            `• **Alt Başlık:** \`${subtitle}\`\n` +
            `• **Slogan:** \`${slogan}\`\n` +
            `• **Özel Logo:** \`${logo}\`\n\n` +
            `🛠️ **Tasarım Komutları:**\n` +
            `• \`/${type} renk <#hex>\` — Ana rengi ayarla (Örn: \`#3b82f6\`)\n` +
            `• \`/${type} vurgu <#hex>\` — Vurgu rengini ayarla\n` +
            `• \`/${type} baslik <metin>\` — Rozet alt başlığını ayarla\n` +
            `• \`/${type} slogan <metin>\` — Kart sloganını ayarla\n` +
            `• \`/${type} logo <URL|kaldir>\` — Kart logosunu ayarla veya kaldır\n` +
            `• \`/${type} sifirla\` — Kart tasarımını sıfırla\n` +
            `• \`/${type} test\` — Güncel tasarımı test et`);
    }
}
//# sourceMappingURL=WelcomeGoodbyeService.js.map