// SPDX-License-Identifier: AGPL-3.0-or-later
import { t } from '../../locales/i18n.js';
export async function handleCardCommands(ctx) {
    const { commandName, args, guild, invoker, message, api, welcomeService, helpers } = ctx;
    switch (commandName) {
        case 'welcome':
        case 'hosgeldin': {
            const sub = args[0]?.toLowerCase();
            if (sub === 'channel' || sub === 'kanal') {
                const channelRaw = args.slice(1).join(' ');
                const channel = await helpers.resolveChannel(guild, channelRaw);
                if (!channel) {
                    await helpers.sendUsageError(message, t('errors.channel_not_found'));
                    return true;
                }
                const res = welcomeService.setWelcomeChannel(guild, invoker, channel.id, channel.name);
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'message' || sub === 'mesaj') {
                const msg = args.slice(1).join(' ');
                if (!msg) {
                    await helpers.sendUsageError(message, '❌ Lütfen bir karşılama mesajı şablonu girin.\nKullanılabilir değişkenler: `{user}`, `{username}`, `{id}`, `{memberCount}`, `{guildName}`');
                    return true;
                }
                const res = welcomeService.setWelcomeMessage(guild, invoker, msg);
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'enable' || sub === 'ac' || sub === 'aç' || sub === 'aktif') {
                const res = welcomeService.toggleWelcome(guild, invoker, true);
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'disable' || sub === 'kapat' || sub === 'kapa' || sub === 'pasif') {
                const res = welcomeService.toggleWelcome(guild, invoker, false);
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'color' || sub === 'renk') {
                const hex = args[1];
                if (!hex) {
                    await helpers.sendUsageError(message, '❌ Lütfen geçerli bir HEX renk kodu girin. Örn: `/welcome renk #6366f1`');
                    return true;
                }
                const res = welcomeService.setCardDesign('welcome', guild, invoker, { color: hex });
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'accent' || sub === 'vurgu') {
                const hex = args[1];
                if (!hex) {
                    await helpers.sendUsageError(message, '❌ Lütfen geçerli bir HEX renk kodu girin. Örn: `/welcome vurgu #a855f7`');
                    return true;
                }
                const res = welcomeService.setCardDesign('welcome', guild, invoker, { accentColor: hex });
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'subtitle' || sub === 'baslik' || sub === 'başlık' || sub === 'altbaslik') {
                const text = args.slice(1).join(' ');
                if (!text) {
                    await helpers.sendUsageError(message, '❌ Lütfen rozet alt başlığı girin. Örn: `/welcome baslik TOPLULUĞA KATILDI`');
                    return true;
                }
                const res = welcomeService.setCardDesign('welcome', guild, invoker, { subtitle: text });
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'slogan') {
                const text = args.slice(1).join(' ');
                if (!text) {
                    await helpers.sendUsageError(message, '❌ Lütfen kart sloganı girin. Örn: `/welcome slogan Karanlıkta parlayan yeni bir yıldız.`');
                    return true;
                }
                const res = welcomeService.setCardDesign('welcome', guild, invoker, { slogan: text });
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'logo') {
                const url = args[1];
                const logoVal = !url || url === 'sil' || url === 'kaldir' || url === 'none' ? null : url;
                const res = welcomeService.setCardDesign('welcome', guild, invoker, { logoUrl: logoVal });
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'reset' || sub === 'sifirla' || sub === 'sıfırla') {
                const res = welcomeService.resetCardDesign('welcome', guild, invoker);
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'info' || sub === 'durum' || sub === 'status') {
                const status = welcomeService.getCardDesignStatus('welcome', guild);
                await api.sendMessage(message.channel_id, status);
            }
            else if (sub === 'test' || sub === 'dene') {
                const cfg = welcomeService.db.getGuildConfig(guild.id);
                const targetChannelId = cfg.welcome_channel_id || message.channel_id;
                await welcomeService.sendWelcomeCardMessage(targetChannelId, invoker.user, guild, undefined, '🧪 **[TEST KARŞILAMA MESAJI]**', invoker);
                if (targetChannelId !== message.channel_id) {
                    await helpers.sendAutoExpiringMessage(message.channel_id, `✅ Test karşılama mesajı <#${targetChannelId}> kanalına gönderildi.`, 7, message.id);
                }
            }
            else {
                await helpers.sendUsageError(message, '❌ Kullanım: `/welcome channel #kanal`, `/welcome message <şablon>`, `/welcome enable`, `/welcome disable`, `/welcome test`, `/welcome renk <#hex>`, `/welcome vurgu <#hex>`, `/welcome baslik <metin>`, `/welcome slogan <metin>`, `/welcome logo <url>`, `/welcome sifirla`, `/welcome durum`');
            }
            return true;
        }
        case 'goodbye':
        case 'gorusuruz': {
            const sub = args[0]?.toLowerCase();
            if (sub === 'channel' || sub === 'kanal') {
                const channelRaw = args.slice(1).join(' ');
                const channel = await helpers.resolveChannel(guild, channelRaw);
                if (!channel) {
                    await helpers.sendUsageError(message, t('errors.channel_not_found'));
                    return true;
                }
                const res = welcomeService.setGoodbyeChannel(guild, invoker, channel.id, channel.name);
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'message' || sub === 'mesaj') {
                const msg = args.slice(1).join(' ');
                if (!msg) {
                    await helpers.sendUsageError(message, '❌ Lütfen bir ayrılma mesajı şablonu girin.\nKullanılabilir değişkenler: `{user}`, `{username}`, `{id}`, `{memberCount}`, `{guildName}`');
                    return true;
                }
                const res = welcomeService.setGoodbyeMessage(guild, invoker, msg);
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'enable' || sub === 'ac' || sub === 'aç' || sub === 'aktif') {
                const res = welcomeService.toggleGoodbye(guild, invoker, true);
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'disable' || sub === 'kapat' || sub === 'kapa' || sub === 'pasif') {
                const res = welcomeService.toggleGoodbye(guild, invoker, false);
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'color' || sub === 'renk') {
                const hex = args[1];
                if (!hex) {
                    await helpers.sendUsageError(message, '❌ Lütfen geçerli bir HEX renk kodu girin. Örn: `/goodbye renk #f43f5e`');
                    return true;
                }
                const res = welcomeService.setCardDesign('goodbye', guild, invoker, { color: hex });
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'accent' || sub === 'vurgu') {
                const hex = args[1];
                if (!hex) {
                    await helpers.sendUsageError(message, '❌ Lütfen geçerli bir HEX renk kodu girin. Örn: `/goodbye vurgu #fb7185`');
                    return true;
                }
                const res = welcomeService.setCardDesign('goodbye', guild, invoker, { accentColor: hex });
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'subtitle' || sub === 'baslik' || sub === 'başlık' || sub === 'altbaslik') {
                const text = args.slice(1).join(' ');
                if (!text) {
                    await helpers.sendUsageError(message, '❌ Lütfen rozet alt başlığı girin. Örn: `/goodbye baslik TOPLULUKTAN AYRILDI`');
                    return true;
                }
                const res = welcomeService.setCardDesign('goodbye', guild, invoker, { subtitle: text });
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'slogan') {
                const text = args.slice(1).join(' ');
                if (!text) {
                    await helpers.sendUsageError(message, '❌ Lütfen kart sloganı girin. Örn: `/goodbye slogan Disconnecting... ama izler kalır.`');
                    return true;
                }
                const res = welcomeService.setCardDesign('goodbye', guild, invoker, { slogan: text });
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'logo') {
                const url = args[1];
                const logoVal = !url || url === 'sil' || url === 'kaldir' || url === 'none' ? null : url;
                const res = welcomeService.setCardDesign('goodbye', guild, invoker, { logoUrl: logoVal });
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'reset' || sub === 'sifirla' || sub === 'sıfırla') {
                const res = welcomeService.resetCardDesign('goodbye', guild, invoker);
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
            }
            else if (sub === 'info' || sub === 'durum' || sub === 'status') {
                const status = welcomeService.getCardDesignStatus('goodbye', guild);
                await api.sendMessage(message.channel_id, status);
            }
            else if (sub === 'test' || sub === 'dene') {
                const cfg = welcomeService.db.getGuildConfig(guild.id);
                const targetChannelId = cfg.goodbye_channel_id || message.channel_id;
                await welcomeService.sendGoodbyeCardMessage(targetChannelId, invoker.user, guild, undefined, '🧪 **[TEST AYRILMA MESAJI]**', invoker);
                if (targetChannelId !== message.channel_id) {
                    await helpers.sendAutoExpiringMessage(message.channel_id, `✅ Test ayrılma mesajı <#${targetChannelId}> kanalına gönderildi.`, 7, message.id);
                }
            }
            else {
                await helpers.sendUsageError(message, '❌ Kullanım: `/goodbye channel #kanal`, `/goodbye message <şablon>`, `/goodbye enable`, `/goodbye disable`, `/goodbye test`, `/goodbye renk <#hex>`, `/goodbye vurgu <#hex>`, `/goodbye baslik <metin>`, `/goodbye slogan <metin>`, `/goodbye logo <url>`, `/goodbye sifirla`, `/goodbye durum`');
            }
            return true;
        }
        case 'karttasarim':
        case 'kart-tasarim':
        case 'carddesign':
        case 'card-design': {
            const targetType = (args[0] || '').toLowerCase();
            if (targetType === 'hosgeldin' || targetType === 'welcome') {
                const sub = (args[1] || '').toLowerCase();
                const subArgs = args.slice(2);
                if (!sub || sub === 'durum' || sub === 'info' || sub === 'status') {
                    const status = welcomeService.getCardDesignStatus('welcome', guild);
                    await api.sendMessage(message.channel_id, status);
                    return true;
                }
                if (sub === 'test') {
                    await welcomeService.sendWelcomeCardMessage(message.channel_id, invoker.user, guild, undefined, '🧪 **[TEST HOŞ GELDİN KARTI]**', invoker);
                    return true;
                }
                if (sub === 'sifirla' || sub === 'reset') {
                    const res = welcomeService.resetCardDesign('welcome', guild, invoker);
                    await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
                    return true;
                }
                if (sub === 'renk' || sub === 'color') {
                    const hex = subArgs[0];
                    if (!hex) {
                        await helpers.sendUsageError(message, '❌ Lütfen bir renk kodu girin. Örn: `/kart-tasarim hosgeldin renk #6366f1`');
                        return true;
                    }
                    const res = welcomeService.setCardDesign('welcome', guild, invoker, { color: hex });
                    await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
                    return true;
                }
                if (sub === 'vurgu' || sub === 'accent') {
                    const hex = subArgs[0];
                    if (!hex) {
                        await helpers.sendUsageError(message, '❌ Lütfen bir vurgu renk kodu girin. Örn: `/kart-tasarim hosgeldin vurgu #a855f7`');
                        return true;
                    }
                    const res = welcomeService.setCardDesign('welcome', guild, invoker, { accentColor: hex });
                    await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
                    return true;
                }
                if (sub === 'baslik' || sub === 'başlık' || sub === 'subtitle') {
                    const text = subArgs.join(' ');
                    const res = welcomeService.setCardDesign('welcome', guild, invoker, { subtitle: text });
                    await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
                    return true;
                }
                if (sub === 'slogan') {
                    const text = subArgs.join(' ');
                    const res = welcomeService.setCardDesign('welcome', guild, invoker, { slogan: text });
                    await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
                    return true;
                }
                if (sub === 'logo') {
                    const url = subArgs[0];
                    const logoVal = !url || url === 'sil' || url === 'kaldir' || url === 'none' ? null : url;
                    const res = welcomeService.setCardDesign('welcome', guild, invoker, { logoUrl: logoVal });
                    await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
                    return true;
                }
            }
            if (targetType === 'gorusuruz' || targetType === 'goodbye') {
                const sub = (args[1] || '').toLowerCase();
                const subArgs = args.slice(2);
                if (!sub || sub === 'durum' || sub === 'info' || sub === 'status') {
                    const status = welcomeService.getCardDesignStatus('goodbye', guild);
                    await api.sendMessage(message.channel_id, status);
                    return true;
                }
                if (sub === 'test') {
                    await welcomeService.sendGoodbyeCardMessage(message.channel_id, invoker.user, guild, undefined, '🧪 **[TEST GÖRÜŞÜRÜZ KARTI]**', invoker);
                    return true;
                }
                if (sub === 'sifirla' || sub === 'reset') {
                    const res = welcomeService.resetCardDesign('goodbye', guild, invoker);
                    await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
                    return true;
                }
                if (sub === 'renk' || sub === 'color') {
                    const hex = subArgs[0];
                    if (!hex) {
                        await helpers.sendUsageError(message, '❌ Lütfen bir renk kodu girin. Örn: `/kart-tasarim gorusuruz renk #ef4444`');
                        return true;
                    }
                    const res = welcomeService.setCardDesign('goodbye', guild, invoker, { color: hex });
                    await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
                    return true;
                }
                if (sub === 'vurgu' || sub === 'accent') {
                    const hex = subArgs[0];
                    if (!hex) {
                        await helpers.sendUsageError(message, '❌ Lütfen bir vurgu renk kodu girin. Örn: `/kart-tasarim gorusuruz vurgu #fb7185`');
                        return true;
                    }
                    const res = welcomeService.setCardDesign('goodbye', guild, invoker, { accentColor: hex });
                    await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
                    return true;
                }
                if (sub === 'baslik' || sub === 'başlık' || sub === 'subtitle') {
                    const text = subArgs.join(' ');
                    const res = welcomeService.setCardDesign('goodbye', guild, invoker, { subtitle: text });
                    await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
                    return true;
                }
                if (sub === 'slogan') {
                    const text = subArgs.join(' ');
                    const res = welcomeService.setCardDesign('goodbye', guild, invoker, { slogan: text });
                    await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
                    return true;
                }
                if (sub === 'logo') {
                    const url = subArgs[0];
                    const logoVal = !url || url === 'sil' || url === 'kaldir' || url === 'none' ? null : url;
                    const res = welcomeService.setCardDesign('goodbye', guild, invoker, { logoUrl: logoVal });
                    await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
                    return true;
                }
            }
            // Genel Tasarım Bilgi ve Rehber Menüsü
            await api.sendMessage(message.channel_id, `🎨 **Kortex Karşılama & Uğurlama Kart Tasarım Menüsü**\n\n` +
                `Kart tasarımlarınızı doğrudan aşağıdaki komutlarla kolayca özelleştirebilirsiniz:\n\n` +
                `🔹 **Hoş Geldin Kartı Tasarımı:**\n` +
                `• \`/kart-tasarim hosgeldin renk <#hex>\` veya \`/welcome renk <#hex>\`\n` +
                `• \`/kart-tasarim hosgeldin vurgu <#hex>\` veya \`/welcome vurgu <#hex>\`\n` +
                `• \`/kart-tasarim hosgeldin baslik <metin>\` veya \`/welcome baslik <metin>\`\n` +
                `• \`/kart-tasarim hosgeldin slogan <metin>\` veya \`/welcome slogan <metin>\`\n` +
                `• \`/kart-tasarim hosgeldin logo <url|kaldir>\` veya \`/welcome logo <url>\`\n` +
                `• \`/kart-tasarim hosgeldin test\` veya \`/welcome test\`\n` +
                `• \`/kart-tasarim hosgeldin durum\` veya \`/welcome durum\`\n\n` +
                `🔸 **Görüşürüz Kartı Tasarımı:**\n` +
                `• \`/kart-tasarim gorusuruz renk <#hex>\` veya \`/goodbye renk <#hex>\`\n` +
                `• \`/kart-tasarim gorusuruz vurgu <#hex>\` veya \`/goodbye vurgu <#hex>\`\n` +
                `• \`/kart-tasarim gorusuruz baslik <metin>\` veya \`/goodbye baslik <metin>\`\n` +
                `• \`/kart-tasarim gorusuruz slogan <metin>\` veya \`/goodbye slogan <metin>\`\n` +
                `• \`/kart-tasarim gorusuruz logo <url|kaldir>\` veya \`/goodbye logo <url>\`\n` +
                `• \`/kart-tasarim gorusuruz test\` veya \`/goodbye test\`\n` +
                `• \`/kart-tasarim gorusuruz durum\` veya \`/goodbye durum\``);
            return true;
        }
        default:
            return false;
    }
}
//# sourceMappingURL=cardCommands.js.map