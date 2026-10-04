import type { CommandContext } from '../types.js';
import type { DiscordPollCreate, FluxerMessage } from '../../types/fluxer.js';
import { CommunityService } from '../../services/CommunityService.js';
import { PermissionService } from '../../services/PermissionService.js';
import { Permissions } from '../../config/constants.js';
import { config } from '../../config/env.js';
import { parsePollInput, buildPollComponents, formatPollEmbed, NUMBER_EMOJIS } from '../../services/PollCardGenerator.js';

export function parseBirthdayInput(args: string[]): { day: number; month: number; year?: number } | null {
  const MONTH_NAMES: Record<string, number> = {
    ocak: 1, jan: 1, january: 1,
    subat: 2, şubat: 2, feb: 2, february: 2,
    mart: 3, mar: 3, march: 3,
    nisan: 4, apr: 4, april: 4,
    mayis: 5, mayıs: 5, may: 5,
    haziran: 6, jun: 6, june: 6,
    temmuz: 7, jul: 7, july: 7,
    agustos: 8, ağustos: 8, aug: 8, august: 8,
    eylul: 9, eylül: 9, sep: 9, september: 9,
    ekim: 10, oct: 10, october: 10,
    kasim: 11, kasım: 11, nov: 11, november: 11,
    aralik: 12, aralık: 12, dec: 12, december: 12,
  };

  const raw = args.slice(1).join(' ').trim();
  if (!raw) return null;

  // Pattern 1: Delimited like "04.10", "4.10.2008", "04/10/1998", "4-10"
  const delimited = raw.match(/^(\d{1,2})[./\-](\d{1,2})(?:[./\-](\d{4}))?$/);
  if (delimited) {
    const day = Number.parseInt(delimited[1], 10);
    const month = Number.parseInt(delimited[2], 10);
    const year = delimited[3] ? Number.parseInt(delimited[3], 10) : undefined;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { day, month, year };
    }
  }

  // Pattern 2: Month name like "4 ekim", "4 ekim 2008", "15 mayıs 1995"
  const monthNameMatch = raw.match(/^(\d{1,2})\s+([a-zA-ZçğıöşüÇĞİÖŞÜ]+)(?:\s+(\d{4}))?$/i);
  if (monthNameMatch) {
    const day = Number.parseInt(monthNameMatch[1], 10);
    const mName = monthNameMatch[2].toLowerCase();
    const month = MONTH_NAMES[mName];
    const year = monthNameMatch[3] ? Number.parseInt(monthNameMatch[3], 10) : undefined;
    if (month && day >= 1 && day <= 31) {
      return { day, month, year };
    }
  }

  // Pattern 3: Space-separated like "4 10", "4 10 2008"
  const numMatch = raw.match(/^(\d{1,2})\s+(\d{1,2})(?:\s+(\d{4}))?$/);
  if (numMatch) {
    const day = Number.parseInt(numMatch[1], 10);
    const month = Number.parseInt(numMatch[2], 10);
    const year = numMatch[3] ? Number.parseInt(numMatch[3], 10) : undefined;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { day, month, year };
    }
  }

  return null;
}

export async function handleCommunityCommands(ctx: CommandContext): Promise<boolean> {
  const { commandName, args, guild, invoker, botMember, message, api, communityService, giveawayService, birthdayService, pollService, db, helpers } = ctx;

  switch (commandName) {
    case 'afk': {
      if (!communityService) return true;
      const reason = args.join(' ');
      const res = communityService.setAfk(guild, invoker, reason);
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 8, message.id);
      return true;
    }

    case 'tag':
    case 'customcmd':
    case 'etiket': {
      if (!communityService) return true;
      const sub = (args[0] || '').toLowerCase();
      if (sub === 'on' || sub === 'ac' || sub === 'aç' || sub === 'enable') {
        const res = communityService.setTagsEnabled(guild, invoker, true);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'off' || sub === 'kapat' || sub === 'kapa' || sub === 'disable') {
        const res = communityService.setTagsEnabled(guild, invoker, false);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'toggle') {
        const current = communityService.isTagsEnabled(guild.id);
        const res = communityService.setTagsEnabled(guild, invoker, !current);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'status' || sub === 'durum') {
        const res = communityService.getStatus(guild);
        await api.sendMessage(message.channel_id, res.message);
      } else if (sub === 'add' || sub === 'ekle') {
        let tagName = '';
        let tagContent = '';
        const fullAddArgs = args.slice(1).join(' ').trim();
        const quotedMatch = fullAddArgs.match(/^"([^"]+)"\s+([\s\S]+)$/);
        if (quotedMatch) {
          tagName = quotedMatch[1];
          tagContent = quotedMatch[2];
        } else {
          tagName = args[1] || '';
          tagContent = args.slice(2).join(' ');
        }
        const res = communityService.addTag(guild, invoker, tagName, tagContent);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'remove' || sub === 'sil' || sub === 'delete') {
        const rawArg = args.slice(1).join(' ').trim().replace(/^"|"$/g, '');
        const res = communityService.removeTag(guild, invoker, rawArg);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'list' || sub === 'liste' || !sub) {
        const res = communityService.listTags(guild);
        await api.sendMessage(message.channel_id, res.message);
      } else {
        if (communityService.isTagsEnabled(guild.id)) {
          const tag = communityService.getTag(guild, sub);
          if (tag) {
            const formatted = CommunityService.formatTagTemplate(tag.content, guild, invoker, message.channel_id);
            await api.sendMessage(message.channel_id, formatted);
            return true;
          }
        }
        await api.sendMessage(
          message.channel_id,
          '❌ Kullanım:\n' +
          '• `/tag on` veya `/tag off` — Otomatik yanıt sistemini aç / kapat\n' +
          '• `/tag add <isim veya "cümle"> <cevap>` — Yeni otomatik yanıt ekle\n' +
          '• `/tag remove <isim>` — Otomatik yanıtı sil\n' +
          '• `/tag list` — Otomatik yanıtları listele ve durumu gör\n' +
          '• `/tag status` — Sistemin açık/kapalı durumunu gör\n\n' +
          '💡 *Kullanabileceğiniz değişkenler: `{user}`, `{username}`, `{server}`, `{memberCount}`, `{channel}`, `{date}`, `{time}`, `{random:1-100}`*',
        );
      }
      return true;
    }

    case 'giveaway':
    case 'cekilis':
    case 'çekiliş': {
      if (!giveawayService) return true;
      const sub = (args[0] || '').toLowerCase();
      if (sub === 'kanal' || sub === 'channel') {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
          await api.sendMessage(message.channel_id, '❌ Bu ayarı değiştirmek için **Sunucuyu Yönet** yetkisine sahip olmalısınız.');
          return true;
        }
        const chRaw = args[1];
        if (!chRaw || chRaw === 'sifirla' || chRaw === 'clear' || chRaw === 'kaldir') {
          db?.updateGuildConfig(guild.id, { giveaway_channel_id: null });
          await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **Çekiliş kanalı sıfırlandı.** Çekilişler komutun kullanıldığı kanalda açılacak.', 7, message.id);
          return true;
        }
        const ch = await helpers.resolveChannel(guild, chRaw);
        if (!ch) {
          await helpers.sendUsageError(message, '❌ Lütfen geçerli bir kanal etiketleyin. Örn: `/giveaway kanal #cekilis`');
          return true;
        }
        db?.updateGuildConfig(guild.id, { giveaway_channel_id: ch.id });
        await helpers.sendAutoExpiringMessage(message.channel_id, `✅ **Çekiliş Kanalı Ayarlandı:** <#${ch.id}>. Artık tüm çekilişler bu kanala gönderilecektir.`, 7, message.id);
        return true;
      }

      const isDirectDuration = /^\d+[smhd]$/i.test(sub);
      if (sub === 'start' || sub === 'baslat' || sub === 'başlat' || isDirectDuration) {
        const duration = isDirectDuration ? args[0] : args[1];
        const winners = Number.parseInt(isDirectDuration ? args[1] : args[2], 10);
        const prizeTokens = isDirectDuration ? args.slice(2) : args.slice(3);

        if (!duration || isNaN(winners) || prizeTokens.length === 0) {
          await helpers.sendUsageError(
            message,
            '❌ Kullanım: `/giveaway start <süre: 10m/2h/1d> <kazanan_sayisi> <ödül>` (Örn: `/giveaway start 30m 1 Micup VIP`)\n💡 *Sabit çekiliş kanalı:* `/giveaway kanal #kanal`',
          );
          return true;
        }

        const cfg = db?.getGuildConfig(guild.id);
        let targetChannelId = cfg?.giveaway_channel_id || message.channel_id;

        // Check if last token is an explicit channel mention or channel name
        const lastToken = prizeTokens[prizeTokens.length - 1];
        if (lastToken) {
          const explicitCh = await helpers.resolveChannel(guild, lastToken);
          if (explicitCh) {
            targetChannelId = explicitCh.id;
            prizeTokens.pop();
          }
        }
        const prize = prizeTokens.join(' ');

        const res = await giveawayService.startGiveaway(guild, targetChannelId, invoker, duration, winners, prize);
        if (res.success) {
          await helpers.sendAutoExpiringMessage(
            message.channel_id,
            res.message,
            8,
            message.id,
          );
        } else {
          await helpers.sendUsageError(message, res.message, 8);
        }
      } else if (sub === 'end' || sub === 'bitir' || sub === 'stop') {
        const targetMsgId = args[1];
        if (!targetMsgId) {
          await helpers.sendUsageError(message, '❌ Kullanım: `/giveaway end <mesaj_id_veya_id>`');
          return true;
        }
        const res = await giveawayService.endEarly(guild, invoker, targetMsgId);
        await api.sendMessage(message.channel_id, res.message);
      } else if (sub === 'reroll' || sub === 'yeniden') {
        const targetMsgId = args[1];
        if (!targetMsgId) {
          await helpers.sendUsageError(message, '❌ Kullanım: `/giveaway reroll <mesaj_id_veya_id>`');
          return true;
        }
        const res = await giveawayService.reroll(guild, invoker, targetMsgId);
        await api.sendMessage(message.channel_id, res.message);
      } else if (sub === 'list' || sub === 'liste' || !sub) {
        const res = giveawayService.list(guild);
        await api.sendMessage(message.channel_id, res.message);
      } else {
        await helpers.sendUsageError(
          message,
          '❌ Kullanım: `/giveaway start <süre> <kazanan_sayisi> <ödül>`, `/giveaway end <id>`, `/giveaway reroll <mesaj_id>`, `/giveaway list`, `/giveaway kanal #kanal`',
        );
      }
      return true;
    }

    case 'poll':
    case 'anket':
    case 'oylama': {
      const sub = (args[0] || '').toLowerCase();
      if (sub === 'kanal' || sub === 'channel') {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD)) {
          await helpers.sendUsageError(message, '❌ Bu ayarı değiştirmek için **Sunucuyu Yönet** yetkisine sahip olmalısınız.');
          return true;
        }
        const chRaw = args[1];
        if (!chRaw || chRaw === 'sifirla' || chRaw === 'clear' || chRaw === 'kaldir') {
          db?.updateGuildConfig(guild.id, { poll_channel_id: null });
          await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **Oylama kanalı sıfırlandı.** Oylamalar komutun kullanıldığı kanalda açılacak.', 7, message.id);
          return true;
        }
        const ch = await helpers.resolveChannel(guild, chRaw);
        if (!ch) {
          await helpers.sendUsageError(message, '❌ Lütfen geçerli bir kanal etiketleyin. Örn: `/oylama kanal #anketler`');
          return true;
        }
        db?.updateGuildConfig(guild.id, { poll_channel_id: ch.id });
        await helpers.sendAutoExpiringMessage(message.channel_id, `✅ **Oylama Kanalı Ayarlandı:** <#${ch.id}>. Artık tüm anketler bu kanala gönderilecektir.`, 7, message.id);
        return true;
      }

      if (sub === 'bitir' || sub === 'end' || sub === 'sonlandir' || sub === 'stop') {
        const targetId = args[1];
        if (!targetId) {
          await helpers.sendUsageError(message, '❌ Kullanım: `/poll bitir <anket_id_veya_mesaj_id>`\n💡 *Örn:* `/poll bitir 3` *(Aktif anketleri `/poll liste` ile görebilirsiniz)*');
          return true;
        }
        if (pollService) {
          const res = await pollService.endPoll(guild, invoker, targetId);
          await api.sendMessage(message.channel_id, res.message);
        } else if (db) {
          const numId = Number.parseInt(targetId, 10);
          const poll = (!isNaN(numId) ? db.getPoll(numId) : null) || db.getPollByMessageId(targetId);
          if (!poll) {
            await helpers.sendUsageError(message, '❌ Belirtilen anket bulunamadı.');
            return true;
          }
          db.closePoll(poll.id);
          await helpers.sendAutoExpiringMessage(message.channel_id, `✅ **"${poll.question}"** anketi sonlandırıldı.`, 7, message.id);
        }
        return true;
      }

      if (sub === 'liste' || sub === 'list') {
        const openPolls = db?.getOpenPollsForGuild(guild.id) || [];
        if (openPolls.length === 0) {
          await api.sendMessage(message.channel_id, 'ℹ️ Sunucuda şu anda aktif açık bir anket bulunmuyor.');
          return true;
        }
        const lines = openPolls.map((p) => {
          const expirePart = p.expire_unix ? ` • ⏳ Bitiş: <t:${p.expire_unix}:R>` : ' • Süresiz (Manuel Sonlandırma)';
          return `• **#${p.id}** — **${p.question}** (<#${p.channel_id}>${expirePart})`;
        });
        await api.sendMessage(message.channel_id, `📊 **Aktif Anketler (${openPolls.length}):**\n${lines.join('\n')}\n💡 *Sonlandırmak için:* \`/poll bitir <id>\``);
        return true;
      }

      const fullInput = args.join(' ').trim();
      if (!fullInput || fullInput.toLowerCase() === 'yardım' || fullInput.toLowerCase() === 'help') {
        await helpers.sendUsageError(
          message,
          '📊 **Micup Anket Sistemi Kullanımı:**\n' +
          '• **Standart Anket:** `/poll Soru "seçenek1" "seçenek2"`\n' +
          '• **Süreli Anket:** `/poll 10m Soru "seçenek1" "seçenek2"` *(Örn: 30s, 10m, 2h, 1d)*\n' +
          '• **Süreyi Sona Yazma:** `/poll Soru "seçenek1" "seçenek2" süre:15m`\n' +
          '• **Hızlı Evet/Hayır:** `/poll Bu akşam film gecesi yapılsın mı?`\n' +
          '• **Anketi Manuel Bitir:** `/poll bitir <id>` *(veya alttaki ⏹️ emojisine tıklayın)*\n' +
          '• **Aktif Anketler:** `/poll liste`\n' +
          '• **Sabit Oylama Kanalı:** `/poll kanal #anketler` *(veya `/poll kanal sifirla`)*\n' +
          '💡 *Süre belirtilirse süre dolduğunda kazanan otomatik ilan edilir; süre belirtilmezse dilediğiniz zaman manuel sonlandırabilirsiniz.*',
        );
        return true;
      }

      const parsed = parsePollInput(fullInput);
      if (!parsed || parsed.options.length < 2) {
        await helpers.sendUsageError(
          message,
          '❌ Geçersiz anket formatı! Lütfen soru ve seçenekleri tırnak içinde belirtin.\n' +
          '**Örnekler:**\n' +
          '• `/poll Hayat sadece fakirlere mi zordur? "Evet" "Hayır"`\n' +
          '• `/poll 10m Akşama ne oynayalım? "Valorant" "Minecraft"`\n' +
          '• `/poll Film gecesi yapılsın mı? "Evet" "Hayır" süre:30m`\n' +
          '**Yardım için:** `/poll`',
        );
        return true;
      }

      if (parsed.options.length > 10) {
        await api.sendMessage(message.channel_id, '❌ En fazla 10 seçenek belirtebilirsiniz.');
        return true;
      }

      const cfg = db?.getGuildConfig(guild.id);
      const targetChannelId = cfg?.poll_channel_id || message.channel_id;

      const nowUnix = Math.floor(Date.now() / 1000);
      const expireUnix = parsed.durationSeconds ? nowUnix + parsed.durationSeconds : null;

      console.log(`[Poll] expireUnix hesaplandı: ${expireUnix} (şu an: ${nowUnix}, süre: ${parsed.durationSeconds}s)`);

      const pollId = db
        ? db.createPoll(
            guild.id,
            targetChannelId,
            '',
            invoker.user.id,
            parsed.question,
            parsed.options,
            parsed.durationSeconds,
            expireUnix,
          )
        : Math.floor(Math.random() * 100000);

      const initialOptions = parsed.options.map((opt) => ({ text: opt, votes: 0 }));
      const embed = formatPollEmbed({
        question: parsed.question,
        options: initialOptions,
        totalVotes: 0,
        isClosed: false,
        expireUnix,
      });

      const components = buildPollComponents(pollId, parsed.options, false);

      const sentMsg = await api.sendMessage(targetChannelId, '', {
        embeds: [embed],
        components,
      });

      if (sentMsg?.id) {
        if (db) {
          db.updatePollMessageId(pollId, sentMsg.id);
        }
        // Sequentially add number emoji reactions so users can vote by clicking the reaction emojis directly
        if (typeof api.addReaction === 'function') {
          // Emojileri sırayla ve bekleyerek ekleyerek Discord'da doğru sıralamayı sağla
          for (let i = 0; i < parsed.options.length; i++) {
            const emoji = NUMBER_EMOJIS[i % NUMBER_EMOJIS.length];
            await api.addReaction(targetChannelId, sentMsg.id, emoji).catch(() => {});
            // Her emoji arasına kısa bir bekleme süresi koyarak sıralamayı garanti et
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          await api.addReaction(targetChannelId, sentMsg.id, '⏹️').catch(() => {});
        }
      }

      if (targetChannelId !== message.channel_id) {
        await helpers.sendAutoExpiringMessage(message.channel_id, `📊 **Oylama başarıyla <#${targetChannelId}> kanalında paylaşıldı!**`, 7, message.id);
      }
      return true;
    }

    case 'davet':
    case 'invite': {
      const botId = botMember?.user?.id || config.botToken.split('.')[0] || '1553891682385133568';
      const micupInviteUrl = `https://micup.gg/oauth2/authorize?client_id=${botId}&permissions=8&scope=bot`;
      const embed = {
        title: '🤖 Kortex Topluluk Davet Sistemi',
        description:
          `Kortex'i kendi **Micup topluluğunuza** kolayca ekleyebilir, gelişmiş tüm yönetim, koruma ve eğlence modüllerini anında kullanmaya başlayabilirsiniz!\n\n` +
          `🔗 **[Kortex'i Topluluğuna Ekle](${micupInviteUrl})**\n\n` +
          `✨ **Öne Çıkan Özellikler:**\n` +
          `• 🎵 **Gelişmiş Müzik Sistemi:** Kesintisiz ses, canlı radyolar ve YouTube Mix desteği\n` +
          `• 🛡️ **Kapsamlı Güvenlik:** Anti-Spam, Anti-Link, Küfür, Capslock ve Anti-Raid koruması\n` +
          `• 🎁 **Topluluk Etkinlikleri:** Çekiliş (Giveaway) ve Oylama (Poll) sistemleri\n` +
          `• 🎂 **Doğum Günü Kutlamaları:** Otomatik doğum günü hatırlatması ve tebrikleri\n` +
          `• 🐾 **OwO Ekonomi Oyunu:** Günlük ödüller, avcılık, slot, blackjack ve liderlik tablosu\n` +
          `• 📊 **Seviye ve Liderlik:** Özelleştirilebilir seviye kanalı ve XP tablosu\n\n` +
          `*Yönetici veya Topluluğu Yönet yetkiniz olan Micup topluluklarına yukarıdaki bağlantıyı kullanarak botu yetkilendirebilirsiniz.*`,
        color: 0x5865f2,
        footer: { text: 'Kortex • Gelişmiş Çok Amaçlı Micup Topluluk Botu' },
      };

      const components = [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "Kortex'i Topluluğuna Ekle",
              url: micupInviteUrl,
            },
          ],
        },
      ];

      try {
        await api.sendMessage(message.channel_id, '', { embeds: [embed], components });
      } catch {
        await api.sendMessage(
          message.channel_id,
          `🤖 **Kortex Topluluk Davet Bağlantısı:**\n\n${micupInviteUrl}\n\n*Yukarıdaki bağlantıyı tarayıcınızda açarak botu istediğiniz Micup topluluğuna ekleyebilirsiniz.*`,
        );
      }
      return true;
    }

    case 'dogumgunu':
    case 'birthday': {
      if (!birthdayService) {
        await api.sendMessage(message.channel_id, '❌ Doğum günü servisi şu an aktif değil.');
        return true;
      }

      const sub = (args[0] || '').toLowerCase();

      if (sub === 'ayarla' || sub === 'set' || sub === 'ekle' || sub === 'add') {
        const parsed = parseBirthdayInput(args);

        if (!parsed) {
          await api.sendMessage(
            message.channel_id,
            '❌ Lütfen geçerli bir gün ve ay girin.\nÖrnekler:\n• `/dogumgunu ayarla 04.10`\n• `/dogumgunu ayarla 4 10 2008`\n• `/dogumgunu ayarla 4 ekim 2008`',
          );
          return true;
        }

        const res = birthdayService.setBirthday(
          guild.id,
          invoker.user.id,
          parsed.day,
          parsed.month,
          parsed.year,
          invoker.nick || invoker.user.username,
        );
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 8, message.id);
        return true;
      }

      if (sub === 'goster' || sub === 'bak' || sub === 'show') {
        const targetRaw = args[1];
        let targetId = invoker.user.id;
        if (targetRaw) {
          const memberCand = await helpers.resolveMember(guild, targetRaw);
          targetId = memberCand?.user?.id || targetRaw.trim().replace(/^<@!?/, '').replace(/>$/, '') || invoker.user.id;
        }

        const res = birthdayService.getBirthday(guild.id, targetId);
        await api.sendMessage(message.channel_id, res.message);
        return true;
      }

      if (sub === 'sil' || sub === 'delete' || sub === 'remove') {
        const targetRaw = args[1];
        if (targetRaw) {
          const memberCand = await helpers.resolveMember(guild, targetRaw);
          const targetId = memberCand?.user?.id || targetRaw.trim().replace(/^<@!?/, '').replace(/>$/, '');
          if (targetId && targetId !== invoker.user.id) {
            await helpers.sendUsageError(
              message,
              '❌ **Başka bir kullanıcının doğum gününü silemezsiniz!**\nYalnızca kendi kayıtlı doğum gününüzü silebilirsiniz: `/dogumgunu sil`',
            );
            return true;
          }
        }

        const res = birthdayService.deleteBirthday(guild.id, invoker.user.id);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
        return true;
      }

      if (sub === 'liste' || sub === 'list') {
        const res = await birthdayService.listBirthdays(guild, invoker.user.id);
        await helpers.sendChunkedMessage(message.channel_id, res.message);
        return true;
      }

      if (sub === 'kanal' || sub === 'channel') {
        const chRaw = args[1];
        if (!chRaw) {
          await api.sendMessage(message.channel_id, '❌ Lütfen bir kutlama kanalı etiketleyin. Örn: `/dogumgunu kanal #kutlamalar`');
          return true;
        }
        const cleanCh = chRaw.trim().replace(/^<#/, '').replace(/>$/, '');
        const ch = (await helpers.resolveChannel(guild, chRaw)) || (/^\d+$/.test(cleanCh) ? { id: cleanCh, name: 'kanal' } as any : null);
        if (!ch) {
          await api.sendMessage(message.channel_id, '❌ Geçersiz kanal! Lütfen sunucudaki bir kanalı etiketleyin.');
          return true;
        }
        const res = birthdayService.setBirthdayChannel(guild, invoker, ch.id, ch.name);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
        return true;
      }

      if (sub === 'mesaj' || sub === 'message') {
        const template = args.slice(1).join(' ').trim();
        if (!template) {
          await api.sendMessage(
            message.channel_id,
            '❌ Lütfen bir kutlama mesajı şablonu girin.\nKullanabileceğiniz değişkenler: `{user}`, `{day}`, `{month}`\nÖrnek: `/dogumgunu mesaj 🎉 Nice mutlu senelere {user}! İyi ki doğdun! 🎂`',
          );
          return true;
        }
        const res = birthdayService.setBirthdayMessage(guild, invoker, template);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
        return true;
      }

      if (sub === 'on' || sub === 'aktif' || sub === 'enable' || sub === 'ac') {
        const res = birthdayService.toggle(guild, invoker, true);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
        return true;
      }

      if (sub === 'off' || sub === 'kapat' || sub === 'disable' || sub === 'pasif') {
        const res = birthdayService.toggle(guild, invoker, false);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
        return true;
      }

      if (sub === 'kutla' || sub === 'kontrol' || sub === 'check' || sub === 'test') {
        if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD) && invoker.user.id !== guild.owner_id) {
          await helpers.sendUsageError(message, '❌ Bu komutu yalnızca **Sunucu Sahibi** ve **Yöneticiler** kullanabilir.');
          return true;
        }
        const announced = await birthdayService.checkAndAnnounceBirthdays(guild.id);
        if (announced > 0) {
          await helpers.sendAutoExpiringMessage(
            message.channel_id,
            `🎉 **Doğum Günü Kontrolü:** Bugün doğum günü olan **${announced}** üye için kutlama mesajı başarıyla gönderildi!`,
            8,
            message.id,
          );
        } else {
          await helpers.sendAutoExpiringMessage(
            message.channel_id,
            `ℹ️ **Doğum Günü Kontrolü:** Bugün için kutlanmamış bekleyen doğum günü bulunmuyor veya kutlama kanalı ayarlanmamış.`,
            8,
            message.id,
          );
        }
        return true;
      }

      // Default help for /dogumgunu
      const cfg = db?.getGuildConfig(guild.id);
      const myBirthday = birthdayService.getBirthday(guild.id, invoker.user.id);
      const myDateText = myBirthday.record
        ? `${String(myBirthday.record.day).padStart(2, '0')}/${String(myBirthday.record.month).padStart(2, '0')}${myBirthday.record.year ? `/${myBirthday.record.year}` : ''}`
        : 'Kayıtlı değil';

      await api.sendMessage(
        message.channel_id,
        `🎂 **Doğum Günü Kutlama Sistemi** 🎂\n\n` +
        `• **Sistem Durumu:** ${cfg?.birthday_enabled ? '🟢 Aktif' : '🔴 Pasif'}\n` +
        `• **Kutlama Kanalı:** ${cfg?.birthday_channel_id ? `<#${cfg.birthday_channel_id}>` : '*Ayarlanmadı*'}\n` +
        `• **Senin Doğum Günün:** **${myDateText}**\n\n` +
        `🎈 **Kullanıcı Komutları:**\n` +
        `• \`/dogumgunu ayarla <gün> <ay> [yıl]\` — Doğum gününüzü sisteme kaydedin\n` +
        `• \`/dogumgunu bak [@kullanıcı]\` — Kayıtlı doğum gününü görüntüleyin\n` +
        `• \`/dogumgunu sil\` — Kayıtlı doğum gününüzü kaldırın\n` +
        `• \`/dogumgunu liste\` — Sunucuda kayıtlı tüm doğum günlerini listeleyin\n\n` +
        `⚙️ **Yönetici Komutları:**\n` +
        `• \`/dogumgunu on / off\` — Sistemi açın veya kapatın\n` +
        `• \`/dogumgunu kanal #kanal\` — Kutlama tebriklerinin atılacağı kanalı belirleyin\n` +
        `• \`/dogumgunu mesaj <şablon>\` — Özel tebrik mesajı belirleyin ({user} etiketi)\n` +
        `• \`/dogumgunu kutla\` — Bekleyen kutlamaları hemen kontrol edip kanala gönderin`,
      );
      return true;
    }

    default:
      return false;
  }
}
