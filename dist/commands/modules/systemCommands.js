// SPDX-License-Identifier: AGPL-3.0-or-later
import { PermissionService } from '../../services/PermissionService.js';
import { Permissions } from '../../config/constants.js';
import { t } from '../../locales/i18n.js';
export async function handleSystemCommands(ctx) {
    const { commandName, args, guild, invoker, botMember, message, api, roleService, db, helpers } = ctx;
    switch (commandName) {
        case 'role': {
            const sub = args[0]?.toLowerCase();
            if (sub === 'add' || sub === 'remove') {
                let targetMember = await helpers.resolveMember(guild, args[1]);
                let role = await helpers.resolveRole(guild, args.slice(2).join(' '));
                // Also allow swapped format: /role add @rol @kullanıcı
                if (!targetMember || !role) {
                    const swappedRole = await helpers.resolveRole(guild, args[1]);
                    const swappedMember = await helpers.resolveMember(guild, args.slice(2).join(' '));
                    if (swappedRole && swappedMember) {
                        role = swappedRole;
                        targetMember = swappedMember;
                    }
                }
                if (!targetMember || !role) {
                    await helpers.sendUsageError(message, `❌ Kullanım: \`/role ${sub} @kullanıcı @rol\``);
                    return true;
                }
                const res = sub === 'add'
                    ? await roleService.addRole(guild, invoker, botMember, targetMember, role)
                    : await roleService.removeRole(guild, invoker, botMember, targetMember, role);
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 7, message.id);
            }
            else {
                await helpers.sendUsageError(message, '❌ Kullanım: `/role add @kullanıcı @rol` veya `/role remove @kullanıcı @rol`');
            }
            return true;
        }
        case 'autorole': {
            const sub = args[0]?.toLowerCase();
            if (sub === 'set') {
                const roleRaw = args.slice(1).join(' ');
                const role = await helpers.resolveRole(guild, roleRaw);
                if (!role) {
                    await helpers.sendUsageError(message, t('errors.role_not_found'));
                    return true;
                }
                const res = roleService.setAutorole(guild, invoker, botMember, role);
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 7, message.id);
            }
            else if (sub === 'remove') {
                const res = roleService.removeAutorole(guild, invoker);
                await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 7, message.id);
            }
            else if (sub === 'status') {
                const text = roleService.getAutoroleStatus(guild);
                await api.sendMessage(message.channel_id, text);
            }
            else {
                await helpers.sendUsageError(message, '❌ Kullanım: `/autorole set @rol`, `/autorole remove`, `/autorole status`');
            }
            return true;
        }
        case 'botkanal':
        case 'botchannel': {
            const sub = (args[0] || '').toLowerCase();
            const cfg = db?.getGuildConfig(guild.id);
            if (!sub || sub === 'durum' || sub === 'status' || sub === 'info') {
                const ch1Text = cfg?.bot_channel_id ? `<#${cfg.bot_channel_id}>` : '*Ayarlanmadı (Tüm kanallarda izinli)*';
                const ch2Text = cfg?.bot_channel_id_2 ? `<#${cfg.bot_channel_id_2}>` : '*Ayarlanmadı*';
                const ch3Text = cfg?.bot_channel_id_3 ? `<#${cfg.bot_channel_id_3}>` : '*Ayarlanmadı*';
                const ch4Text = cfg?.bot_channel_id_4 ? `<#${cfg.bot_channel_id_4}>` : '*Ayarlanmadı*';
                const ch5Text = cfg?.bot_channel_id_5 ? `<#${cfg.bot_channel_id_5}>` : '*Ayarlanmadı*';
                const musicText = cfg?.music_channel_id ? `<#${cfg.music_channel_id}>` : '*Ayarlanmadı (Tüm kanallarda serbest)*';
                const owoText = cfg?.owo_channel_id ? `<#${cfg.owo_channel_id}>` : '*Ayarlanmadı (Tüm kanallarda)*';
                const giveawayText = cfg?.giveaway_channel_id ? `<#${cfg.giveaway_channel_id}>` : '*Ayarlanmadı*';
                const pollText = cfg?.poll_channel_id ? `<#${cfg.poll_channel_id}>` : '*Ayarlanmadı*';
                const levelText = cfg?.leveling_channel_id ? `<#${cfg.leveling_channel_id}>` : '*Anlık kanalda*';
                const bdayText = cfg?.birthday_channel_id ? `<#${cfg.birthday_channel_id}>` : '*Ayarlanmadı*';
                await api.sendMessage(message.channel_id, `🤖 **Kyron Sistem Kanalları Yapılandırması:**\n\n` +
                    `• **1. Genel Bot Kanalı:** ${ch1Text}\n` +
                    `• **2. Genel Bot Kanalı:** ${ch2Text}\n` +
                    `• **3. Genel Bot Kanalı:** ${ch3Text}\n` +
                    `• **4. Genel Bot Kanalı:** ${ch4Text}\n` +
                    `• **5. Genel Bot Kanalı:** ${ch5Text}\n` +
                    `• **🎵 Özel Müzik Kanalı:** ${musicText}\n` +
                    `• **🐾 OwO Ekonomi Kanalı:** ${owoText}\n` +
                    `• **🎁 Çekiliş Kanalı:** ${giveawayText}\n` +
                    `• **📊 Oylama Kanalı:** ${pollText}\n` +
                    `• **📈 Seviye / XP Kanalı:** ${levelText}\n` +
                    `• **🎂 Doğum Günü Kanalı:** ${bdayText}\n\n` +
                    `ℹ️ *Not: Yöneticiler ve Moderatörler botu tüm kanallarda kısıtlama olmaksızın kullanabilir.*\n\n` +
                    `🛠️ **Ayar Komutları:**\n` +
                    `• \`/botkanal #kanal\` — Sıradaki boş slota yeni bot kanalı ekler (Max 5 kanal)\n` +
                    `• \`/botkanal <1-5> #kanal\` — Belirtilen slota bot kanalı ayarlar\n` +
                    `• \`/botkanal muzik #kanal\` (veya \`/muzikkanal #kanal\`) — Özel müzik kanalını ayarlar\n` +
                    `• \`/botkanal owo #kanal\` (veya \`/w kanal #kanal\`) — OwO ekonomi kanalını ayarla\n` +
                    `• \`/botkanal level #kanal\` — Seviye atlama bildirim kanalını ayarla\n` +
                    `• \`/botkanal cekilis #kanal\` — Çekiliş kanalını ayarla\n` +
                    `• \`/botkanal oylama #kanal\` — Oylama kanalını ayarla\n` +
                    `• \`/botkanal sil [1-5|muzik|owo|level|cekilis|oylama|hepsi]\` — Kanal kısıtlamasını sıfırla`);
                return true;
            }
            const isOwner = invoker.user.id === guild.owner_id;
            const isAdmin = PermissionService.hasPermission(guild, invoker, Permissions.ADMINISTRATOR);
            const isManageGuild = PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD);
            if (!isManageGuild && !isAdmin && !isOwner) {
                await helpers.sendUsageError(message, '❌ Bu ayarları değiştirmek için **Sunucuyu Yönet** veya **Yönetici** yetkisine sahip olmalısınız.');
                return true;
            }
            // 1. Reset / Delete
            if (sub === 'sifirla' || sub === 'reset' || sub === 'temizle' || sub === 'kaldir' || sub === 'delete' || sub === 'sil' || sub === 'remove') {
                const target = (args[1] || '').toLowerCase();
                if (target === 'owo') {
                    db?.updateGuildConfig(guild.id, { owo_channel_id: null });
                    await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **OwO kanalı kısıtlaması kaldırıldı.** OwO oyunları tüm kanallarda serbest.', 6, message.id);
                    return true;
                }
                if (target === 'muzik' || target === 'music') {
                    db?.updateGuildConfig(guild.id, { music_channel_id: null });
                    await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **Müzik kanalı kısıtlaması kaldırıldı.** Müzik komutları tüm kanallarda serbest.', 6, message.id);
                    return true;
                }
                if (target === '1') {
                    db?.updateGuildConfig(guild.id, { bot_channel_id: null });
                    await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **1. Bot kanalı kaldırıldı.**', 6, message.id);
                    return true;
                }
                if (target === '2') {
                    db?.updateGuildConfig(guild.id, { bot_channel_id_2: null });
                    await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **2. Bot kanalı kaldırıldı.**', 6, message.id);
                    return true;
                }
                if (target === '3') {
                    db?.updateGuildConfig(guild.id, { bot_channel_id_3: null });
                    await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **3. Bot kanalı kaldırıldı.**', 6, message.id);
                    return true;
                }
                if (target === '4') {
                    db?.updateGuildConfig(guild.id, { bot_channel_id_4: null });
                    await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **4. Bot kanalı kaldırıldı.**', 6, message.id);
                    return true;
                }
                if (target === '5') {
                    db?.updateGuildConfig(guild.id, { bot_channel_id_5: null });
                    await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **5. Bot kanalı kaldırıldı.**', 6, message.id);
                    return true;
                }
                if (target === 'cekilis' || target === 'giveaway') {
                    db?.updateGuildConfig(guild.id, { giveaway_channel_id: null });
                    await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **Çekiliş kanalı sıfırlandı.**', 6, message.id);
                    return true;
                }
                if (target === 'oylama' || target === 'poll') {
                    db?.updateGuildConfig(guild.id, { poll_channel_id: null });
                    await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **Oylama kanalı sıfırlandı.**', 6, message.id);
                    return true;
                }
                if (target === 'level' || target === 'seviye') {
                    db?.updateGuildConfig(guild.id, { leveling_channel_id: null });
                    await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **Seviye bildirim kanalı sıfırlandı.**', 6, message.id);
                    return true;
                }
                if (target === 'hepsi' || target === 'all') {
                    db?.updateGuildConfig(guild.id, {
                        bot_channel_id: null,
                        bot_channel_id_2: null,
                        bot_channel_id_3: null,
                        bot_channel_id_4: null,
                        bot_channel_id_5: null,
                        owo_channel_id: null,
                        music_channel_id: null,
                        giveaway_channel_id: null,
                        poll_channel_id: null,
                        leveling_channel_id: null,
                        birthday_channel_id: null,
                    });
                    await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **Tüm sistem kanalı kısıtlamaları sıfırlandı.**', 6, message.id);
                    return true;
                }
                // Default delete/sil: reset all 5 general bot channels
                db?.updateGuildConfig(guild.id, {
                    bot_channel_id: null,
                    bot_channel_id_2: null,
                    bot_channel_id_3: null,
                    bot_channel_id_4: null,
                    bot_channel_id_5: null,
                });
                await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **Genel bot kanalı kısıtlamaları kaldırıldı.** Bot artık tüm kanallarda kullanılabilir.', 6, message.id);
                return true;
            }
            // 2. OwO Channel Set
            if (sub === 'owo') {
                const chRaw = args[1];
                if (!chRaw || chRaw === 'sil' || chRaw === 'delete' || chRaw === 'sifirla' || chRaw === 'reset') {
                    db?.updateGuildConfig(guild.id, { owo_channel_id: null });
                    await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **OwO kanalı kısıtlaması kaldırıldı.**', 6, message.id);
                    return true;
                }
                const ch = await helpers.resolveChannel(guild, chRaw);
                if (!ch) {
                    await helpers.sendUsageError(message, '❌ Lütfen geçerli bir kanal etiketleyin. Örn: `/botkanal owo #owo-kanali`');
                    return true;
                }
                db?.updateGuildConfig(guild.id, { owo_channel_id: ch.id });
                await helpers.sendAutoExpiringMessage(message.channel_id, `✅ **OwO Kanalı Ayarlandı:** <#${ch.id}>. Üyeler OwO oyunlarını yalnızca bu kanalda oynayabilir.`, 6, message.id);
                return true;
            }
            // 3. Music Channel Set
            if (sub === 'muzik' || sub === 'music') {
                const chRaw = args[1];
                if (!chRaw || chRaw === 'sil' || chRaw === 'delete' || chRaw === 'sifirla' || chRaw === 'reset') {
                    db?.updateGuildConfig(guild.id, { music_channel_id: null });
                    await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **Müzik kanalı kısıtlaması kaldırıldı.** Müzik komutları tüm kanallarda serbest.', 6, message.id);
                    return true;
                }
                const ch = await helpers.resolveChannel(guild, chRaw);
                if (!ch) {
                    await helpers.sendUsageError(message, '❌ Lütfen geçerli bir kanal etiketleyin. Örn: `/botkanal muzik #muzik-kanali` (Kaldırmak için: `/botkanal sil muzik`)');
                    return true;
                }
                db?.updateGuildConfig(guild.id, { music_channel_id: ch.id });
                await helpers.sendAutoExpiringMessage(message.channel_id, `✅ **Müzik Kanalı Ayarlandı:** <#${ch.id}>. Standart üyeler müzik komutlarını yalnızca bu kanalda kullanabilir.`, 6, message.id);
                return true;
            }
            // 4. Level Channel Set
            if (sub === 'level' || sub === 'seviye') {
                const chRaw = args[1];
                if (!chRaw || chRaw === 'sil' || chRaw === 'delete' || chRaw === 'sifirla' || chRaw === 'reset') {
                    db?.updateGuildConfig(guild.id, { leveling_channel_id: null });
                    await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **Seviye bildirim kanalı sıfırlandı.**', 6, message.id);
                    return true;
                }
                const ch = await helpers.resolveChannel(guild, chRaw);
                if (!ch) {
                    await helpers.sendUsageError(message, '❌ Lütfen geçerli bir kanal etiketleyin. Örn: `/botkanal level #level-atlama`');
                    return true;
                }
                db?.updateGuildConfig(guild.id, { leveling_channel_id: ch.id });
                await helpers.sendAutoExpiringMessage(message.channel_id, `✅ **Seviye Bildirim Kanalı Ayarlandı:** <#${ch.id}>.`, 6, message.id);
                return true;
            }
            // 5. Giveaway Channel Set
            if (sub === 'cekilis' || sub === 'giveaway') {
                const chRaw = args[1];
                if (!chRaw || chRaw === 'sil' || chRaw === 'delete' || chRaw === 'sifirla' || chRaw === 'reset') {
                    db?.updateGuildConfig(guild.id, { giveaway_channel_id: null });
                    await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **Çekiliş kanalı sıfırlandı.**', 6, message.id);
                    return true;
                }
                const ch = await helpers.resolveChannel(guild, chRaw);
                if (!ch) {
                    await helpers.sendUsageError(message, '❌ Lütfen geçerli bir kanal etiketleyin. Örn: `/botkanal cekilis #cekilis`');
                    return true;
                }
                db?.updateGuildConfig(guild.id, { giveaway_channel_id: ch.id });
                await helpers.sendAutoExpiringMessage(message.channel_id, `✅ **Çekiliş Kanalı Ayarlandı:** <#${ch.id}>.`, 6, message.id);
                return true;
            }
            // 6. Poll Channel Set
            if (sub === 'oylama' || sub === 'poll') {
                const chRaw = args[1];
                if (!chRaw || chRaw === 'sil' || chRaw === 'delete' || chRaw === 'sifirla' || chRaw === 'reset') {
                    db?.updateGuildConfig(guild.id, { poll_channel_id: null });
                    await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **Oylama kanalı sıfırlandı.**', 6, message.id);
                    return true;
                }
                const ch = await helpers.resolveChannel(guild, chRaw);
                if (!ch) {
                    await helpers.sendUsageError(message, '❌ Lütfen geçerli bir kanal etiketleyin. Örn: `/botkanal oylama #anketler`');
                    return true;
                }
                db?.updateGuildConfig(guild.id, { poll_channel_id: ch.id });
                await helpers.sendAutoExpiringMessage(message.channel_id, `✅ **Oylama Kanalı Ayarlandı:** <#${ch.id}>.`, 6, message.id);
                return true;
            }
            // 7. Slots 1 to 5 specifically
            if (['1', '2', '3', '4', '5'].includes(sub)) {
                const slotNum = parseInt(sub, 10);
                const slotKey = slotNum === 1 ? 'bot_channel_id' : `bot_channel_id_${slotNum}`;
                const chRaw = args[1];
                if (!chRaw || chRaw === 'sifirla' || chRaw === 'reset' || chRaw === 'sil' || chRaw === 'delete') {
                    db?.updateGuildConfig(guild.id, { [slotKey]: null });
                    await helpers.sendAutoExpiringMessage(message.channel_id, `✅ **${slotNum}. Bot kanalı kaldırıldı.**`, 6, message.id);
                    return true;
                }
                const cleanId = chRaw.trim().replace(/^<#/, '').replace(/>$/, '');
                const ch = (await helpers.resolveChannel(guild, chRaw)) || (/^\d+$/.test(cleanId) ? { id: cleanId, name: 'kanal' } : null);
                if (!ch) {
                    await helpers.sendUsageError(message, `❌ Lütfen geçerli bir kanal etiketleyin. Örn: \`/botkanal ${slotNum} #bot-kanali\``);
                    return true;
                }
                db?.updateGuildConfig(guild.id, { [slotKey]: ch.id });
                await helpers.sendAutoExpiringMessage(message.channel_id, `✅ **${slotNum}. Bot Kanalı Ayarlandı:** <#${ch.id}>. Artık üyeler bu kanalda da botu kullanabilir.`, 6, message.id);
                return true;
            }
            // 8. Auto-slotting: /botkanal #kanal or /botkanal ekle #kanal
            const targetChannelRaw = sub === 'ekle' || sub === 'add' ? args[1] : args[0];
            if (targetChannelRaw === 'sifirla' || targetChannelRaw === 'reset' || targetChannelRaw === 'sil' || targetChannelRaw === 'delete') {
                db?.updateGuildConfig(guild.id, {
                    bot_channel_id: null,
                    bot_channel_id_2: null,
                    bot_channel_id_3: null,
                    bot_channel_id_4: null,
                    bot_channel_id_5: null,
                });
                await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **Tüm genel bot kanalı kısıtlamaları kaldırıldı.** Bot artık tüm kanallarda kullanılabilir.', 6, message.id);
                return true;
            }
            const cleanTarget = targetChannelRaw?.trim().replace(/^<#/, '').replace(/>$/, '');
            const ch = (await helpers.resolveChannel(guild, targetChannelRaw)) || (/^\d+$/.test(cleanTarget) ? { id: cleanTarget, name: 'kanal' } : null);
            if (!ch) {
                await helpers.sendUsageError(message, '❌ **Geçersiz komut kullanımı!** Lütfen geçerli bir kanal veya alt komut belirtin. (Örn: `/botkanal #bot-komut`, `/botkanal 2 #kanal`, `/botkanal muzik #kanal`, `/botkanal sil`)\n💡 Detaylı liste için: `/botkanal durum`');
                return true;
            }
            // Check if channel is already registered in one of the slots
            const currentSlots = [
                cfg?.bot_channel_id,
                cfg?.bot_channel_id_2,
                cfg?.bot_channel_id_3,
                cfg?.bot_channel_id_4,
                cfg?.bot_channel_id_5,
            ];
            const existingSlotIndex = currentSlots.findIndex((id) => id === ch.id);
            if (existingSlotIndex !== -1) {
                await helpers.sendAutoExpiringMessage(message.channel_id, `ℹ️ <#${ch.id}> kanalı zaten **${existingSlotIndex + 1}. Bot Kanalı** olarak ayarlı!`, 6, message.id);
                return true;
            }
            // Find first empty slot (1..5)
            const emptySlotIndex = currentSlots.findIndex((id) => !id);
            if (emptySlotIndex === -1) {
                await helpers.sendUsageError(message, '❌ **Maksimum bot kanalı limitine ulaşıldı (En fazla 5 kanal)!**\n' +
                    'Tüm 5 bot kanalı slotu dolu. Belirli bir slotu değiştirmek için: `/botkanal <1-5> #kanal` veya sıfırlamak için: `/botkanal sil <1-5>`.');
                return true;
            }
            const assignedSlot = emptySlotIndex + 1;
            const slotKey = assignedSlot === 1 ? 'bot_channel_id' : `bot_channel_id_${assignedSlot}`;
            db?.updateGuildConfig(guild.id, { [slotKey]: ch.id });
            const newActiveCount = currentSlots.filter(Boolean).length + 1;
            await helpers.sendAutoExpiringMessage(message.channel_id, `✅ **${assignedSlot}. Bot Kanalı Ayarlandı:** <#${ch.id}>. (Toplam ${newActiveCount}/5 bot kanalı aktif).`, 6, message.id);
            return true;
        }
        case 'muzikkanal':
        case 'musickanal': {
            const isOwner = invoker.user.id === guild.owner_id;
            const isAdmin = PermissionService.hasPermission(guild, invoker, Permissions.ADMINISTRATOR);
            const isManageGuild = PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD);
            if (!isManageGuild && !isAdmin && !isOwner) {
                await helpers.sendUsageError(message, '❌ Müzik kanalını ayarlamak için **Sunucuyu Yönet** veya **Yönetici** yetkisine sahip olmalısınız.');
                return true;
            }
            const chRaw = args[0];
            if (!chRaw || chRaw === 'sil' || chRaw === 'delete' || chRaw === 'sifirla' || chRaw === 'reset') {
                db?.updateGuildConfig(guild.id, { music_channel_id: null });
                await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **Müzik kanalı kısıtlaması kaldırıldı.** Müzik komutları tüm kanallarda serbest.', 6, message.id);
                return true;
            }
            const ch = await helpers.resolveChannel(guild, chRaw);
            if (!ch) {
                await helpers.sendUsageError(message, '❌ Lütfen geçerli bir kanal etiketleyin. Örn: `/muzikkanal #muzik-kanali` (Kaldırmak için: `/muzikkanal sil`)');
                return true;
            }
            db?.updateGuildConfig(guild.id, { music_channel_id: ch.id });
            await helpers.sendAutoExpiringMessage(message.channel_id, `✅ **Müzik Kanalı Ayarlandı:** <#${ch.id}>. Standart üyeler müzik komutlarını yalnızca bu kanalda kullanabilir.`, 7, message.id);
            return true;
        }
        case 'ping': {
            await helpers.sendAutoExpiringMessage(message.channel_id, '🏓 **Pong!** Bot aktif ve tüm sistemler çalışıyor.', 6, message.id);
            return true;
        }
        default:
            return false;
    }
}
//# sourceMappingURL=systemCommands.js.map