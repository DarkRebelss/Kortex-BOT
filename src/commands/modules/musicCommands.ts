// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CommandContext } from '../types.js';
import { RADIO_STATIONS } from '../../services/MusicService.js';
import { PermissionService } from '../../services/PermissionService.js';
import { Permissions } from '../../config/constants.js';

export async function handleMusicCommands(ctx: CommandContext): Promise<boolean> {
  const { commandName, args, guild, invoker, message, api, musicService, db, helpers } = ctx;

  switch (commandName) {
    case 'join':
    case 'connect': {
      const explicitTarget = args.join(' ').trim();
      const targetVoice = await helpers.resolveTargetVoiceChannel(guild, invoker, explicitTarget);
      if (!targetVoice) {
        const voiceChannels = guild.channels?.filter((c) => Number(c.type) === 2 || Number(c.type) === 13) || [];
        const channelList =
          voiceChannels.length > 0
            ? `\n\n📌 **Mevcut Ses Kanalları:**\n${voiceChannels.map((c) => `• \`/join #${c.name}\``).join('\n')}`
            : '';

        await api.sendMessage(
          message.channel_id,
          `❌ **Bir ses kanalında değilsiniz!**\nSizi takip edebilmem için lütfen önce bir ses kanalına katılın veya odayı belirtin: \`/join <oda_adı>\`${channelList}`,
        );
        return true;
      }
      const res = musicService.join(guild.id, message.channel_id, targetVoice.channelId, targetVoice.channelName);
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      return true;
    }

    case 'leave':
    case 'disconnect': {
      const res = musicService.leave(guild.id);
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      return true;
    }

    case 'play':
    case 'p':
    case 'mix':
    case 'playlist': {
      const fullInput = args.join(' ').trim();
      if (!fullInput) {
        await helpers.sendUsageError(
          message,
          '❌ Kullanım: `/play <link / şarkı / mix>` veya `/mix <link / arama>`\nÖrnekler:\n• `/play https://www.youtube.com/watch?v=...&list=RD...` (Toplu Mix)\n• `/play https://www.youtube.com/playlist?list=...` (Çalma Listesi)\n• `/play https://open.spotify.com/track/...`\n• `/play duman kırmış kalbini`',
        );
        return true;
      }

      let query = fullInput;
      let explicitChannel: string | undefined;

      const channelMentionMatch = fullInput.match(/<#(\d+)>$/);
      if (channelMentionMatch) {
        explicitChannel = channelMentionMatch[1];
        query = fullInput.replace(/<#\d+>$/, '').trim();
      }

      const targetVoice = await helpers.resolveTargetVoiceChannel(guild, invoker, explicitChannel);
      if (!targetVoice) {
        const voiceChannels = guild.channels?.filter((c) => Number(c.type) === 2 || Number(c.type) === 13) || [];
        const channelList =
          voiceChannels.length > 0
            ? `\n\n📌 **Mevcut Ses Kanalları:**\n${voiceChannels.map((c) => `• \`/join #${c.name}\``).join('\n')}`
            : '';

        await helpers.sendUsageError(
          message,
          `❌ **Bir ses kanalında değilsiniz!**\nŞarkı çalabilmem için lütfen önce sunucuda bir ses kanalına katılın veya odayı belirtin (Örn: \`/join <oda_adı>\` veya \`/play <link> #oda\`)${channelList}`,
        );
        return true;
      }

      const isAlreadyInVoice =
        musicService.isVoiceConnected(guild.id) &&
        musicService.getPlayer(guild.id)?.voiceChannelId === targetVoice.channelId;

      if (!isAlreadyInVoice) {
        musicService.connectToVoice(guild.id, targetVoice.channelId, targetVoice.channelName);
      }

      const res = await musicService.play(guild.id, message.channel_id, query, invoker);
      await api.sendMessage(message.channel_id, res.message, { components: res.components });
      return true;
    }

    case 'playnow':
    case 'pn':
    case 'pnow':
    case 'calhemen':
    case 'çalhemen': {
      const fullInput = args.join(' ').trim();
      if (!fullInput) {
        await helpers.sendUsageError(
          message,
          '❌ Kullanım: `/playnow <link veya şarkı adı>`\nÖrnek: `/playnow orchi alıştım` (Çalan şarkıyı hemen kesip bunu başlatır)',
        );
        return true;
      }

      const targetVoice = await helpers.resolveTargetVoiceChannel(guild, invoker);
      if (!targetVoice) {
        await helpers.sendUsageError(message, '❌ **Bir ses kanalında değilsiniz!**');
        return true;
      }

      const isAlreadyInVoice =
        musicService.isVoiceConnected(guild.id) &&
        musicService.getPlayer(guild.id)?.voiceChannelId === targetVoice.channelId;

      if (!isAlreadyInVoice) {
        musicService.connectToVoice(guild.id, targetVoice.channelId, targetVoice.channelName);
      }

      const res = await musicService.playNow(guild.id, message.channel_id, fullInput, invoker);
      await api.sendMessage(message.channel_id, res.message, { components: res.components });
      return true;
    }

    case 'playnext':
    case 'pnext':
    case 'siradaki':
    case 'sıradaki': {
      const fullInput = args.join(' ').trim();
      if (!fullInput) {
        await helpers.sendUsageError(
          message,
          '❌ Kullanım: `/playnext <link veya şarkı adı>`\nÖrnek: `/playnext ezhel geceler` (Kuyruğun en başına ekler, sonraki parça olarak çalar)',
        );
        return true;
      }

      const targetVoice = await helpers.resolveTargetVoiceChannel(guild, invoker);
      if (!targetVoice) {
        await helpers.sendUsageError(message, '❌ **Bir ses kanalında değilsiniz!**');
        return true;
      }

      const isAlreadyInVoice =
        musicService.isVoiceConnected(guild.id) &&
        musicService.getPlayer(guild.id)?.voiceChannelId === targetVoice.channelId;

      if (!isAlreadyInVoice) {
        musicService.connectToVoice(guild.id, targetVoice.channelId, targetVoice.channelName);
      }

      const res = await musicService.playNext(guild.id, message.channel_id, fullInput, invoker);
      await api.sendMessage(message.channel_id, res.message, { components: res.components });
      return true;
    }

    case 'skipto':
    case 'jump': {
      const pos = parseInt(args[0], 10);
      if (isNaN(pos) || pos < 1) {
        await helpers.sendUsageError(message, '❌ Kullanım: `/skipto <sıra_no>` (Örn: `/skipto 3`)');
        return true;
      }
      const res = await musicService.skipTo(guild.id, pos);
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      return true;
    }

    case 'pause': {
      const res = musicService.pause(guild.id);
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      return true;
    }

    case 'resume': {
      const res = musicService.resume(guild.id);
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      return true;
    }

    case 'skip':
    case 's':
    case 'next': {
      const res = await musicService.skip(guild.id);
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      return true;
    }

    case 'stop':
    case 'dc': {
      const res = musicService.stop(guild.id);
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      return true;
    }

    case 'queue':
    case 'q':
    case 'list': {
      const page = Number.parseInt(args[0], 10) || 1;
      const res = musicService.getQueue(guild.id, page);
      await api.sendMessage(message.channel_id, res.message, { components: res.components });
      return true;
    }

    case 'nowplaying':
    case 'np': {
      const res = musicService.getNowPlaying(guild.id);
      await api.sendMessage(message.channel_id, res.message, { components: res.components });
      return true;
    }

    case 'volume':
    case 'vol': {
      const vol = Number.parseInt(args[0], 10);
      if (Number.isNaN(vol)) {
        await helpers.sendUsageError(message, '❌ Kullanım: `/volume <0-200>` (Örn: `/volume 80`)');
        return true;
      }
      const res = musicService.setVolume(guild.id, vol);
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      return true;
    }

    case 'filter': {
      const filterType = args[0];
      if (!filterType) {
        const active = musicService.getFilter(guild.id);
        const activeStr = active.filterName ? `\`${active.filterName}\`` : 'Yok (Standart)';
        await api.sendMessage(
          message.channel_id,
          `🎛️ **Ses Filtreleri & Efektler:**\n` +
          `• **Aktif Filtre:** ${activeStr}\n\n` +
          `**Kullanılabilir Filtreler:**\n` +
          `• \`/filter bassboost [low/medium/high/extreme]\` — Derin ve güçlü bas artırımı\n` +
          `• \`/filter nightcore\` — Hızlandırılmış tiz ve enerjik nightcore efekti\n` +
          `• \`/filter vaporwave\` — Yavaşlatılmış ve derin slowed/lofi efekti\n` +
          `• \`/filter 8d\` — Kulaklıkta dönen uzamsal ses efekti\n` +
          `• \`/filter tremolo\` — Dalgalı ve titreşimli ses efekti\n` +
          `• \`/filter speed <0.5 - 2.0>\` — Oynatma hızı ayarı\n` +
          `• \`/filter clear\` — Aktif efektleri kapatır`,
        );
        return true;
      }
      const param = args[1];
      const res = musicService.setFilter(guild.id, filterType, param);
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      return true;
    }

    case 'bassboost':
    case 'bass': {
      const arg = (args[0] || '').toLowerCase();
      const isOff = arg === 'off' || arg === 'kapat' || arg === 'kapali' || arg === 'kapalı' || arg === 'clear';
      const active = musicService.getFilter(guild.id);
      if (isOff || (active.rawFilter?.includes('bass=') && !args[0])) {
        const res = musicService.clearFilter(guild.id);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
        return true;
      }
      const level = args[0] || 'medium';
      const res = musicService.setFilter(guild.id, 'bassboost', level);
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      return true;
    }

    case 'nightcore':
    case 'nc': {
      const arg = (args[0] || '').toLowerCase();
      const isOff = arg === 'off' || arg === 'kapat' || arg === 'kapali' || arg === 'kapalı' || arg === 'clear';
      const active = musicService.getFilter(guild.id);
      if (isOff || (active.filterName?.includes('Nightcore') && !args[0])) {
        const res = musicService.clearFilter(guild.id);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
        return true;
      }
      const res = musicService.setFilter(guild.id, 'nightcore');
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      return true;
    }

    case 'vaporwave':
    case 'slowed': {
      const arg = (args[0] || '').toLowerCase();
      const isOff = arg === 'off' || arg === 'kapat' || arg === 'kapali' || arg === 'kapalı' || arg === 'clear';
      const active = musicService.getFilter(guild.id);
      if (isOff || (active.filterName?.includes('Vaporwave') && !args[0])) {
        const res = musicService.clearFilter(guild.id);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
        return true;
      }
      const res = musicService.setFilter(guild.id, 'vaporwave');
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      return true;
    }

    case '8d':
    case '3d': {
      const arg = (args[0] || '').toLowerCase();
      const isOff = arg === 'off' || arg === 'kapat' || arg === 'kapali' || arg === 'kapalı' || arg === 'clear';
      const active = musicService.getFilter(guild.id);
      if (isOff || (active.filterName?.includes('8D') && !args[0])) {
        const res = musicService.clearFilter(guild.id);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
        return true;
      }
      const res = musicService.setFilter(guild.id, '8d');
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      return true;
    }

    case 'clearfilter':
    case 'resetfilter': {
      const res = musicService.clearFilter(guild.id);
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      return true;
    }

    case 'loop':
    case 'repeat': {
      const modeArg = (args[0] || '').toLowerCase();
      let mode: 'track' | 'queue' | 'off' | undefined;
      if (['track', 'tek', 'sarki', 'şarkı', 'single'].includes(modeArg)) {
        mode = 'track';
      } else if (['queue', 'kuyruk', 'liste', 'all'].includes(modeArg)) {
        mode = 'queue';
      } else if (['off', 'kapali', 'kapalı', 'kapat', 'disable', 'false', '0'].includes(modeArg)) {
        mode = 'off';
      } else if (['on', 'ac', 'aç', 'aktif', 'enable', 'true', '1'].includes(modeArg)) {
        mode = 'track';
      } else if (!modeArg) {
        mode = undefined;
      } else {
        await helpers.sendUsageError(
          message,
          '❌ Kullanım: `/loop [tek|kuyruk|off|on]`\n• `/loop tek` (veya `/loop on`) — Şarkıyı döngüye alır\n• `/loop kuyruk` — Tüm sırayı döngüye alır\n• `/loop off` — Döngüyü kapatır\n• `/loop` — Modlar arasında geçiş yapar',
        );
        return true;
      }
      const res = musicService.setLoop(guild.id, mode);
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      return true;
    }

    case 'shuffle': {
      const res = musicService.shuffle(guild.id);
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      return true;
    }

    case 'clearqueue':
    case 'cq':
    case 'clearq': {
      const res = musicService.clearQueue(guild.id);
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      return true;
    }

    case 'seek': {
      const target = args[0];
      if (!target) {
        await helpers.sendUsageError(message, '❌ Kullanım: `/seek <dakika:saniye>` (Örn: `/seek 1:45`)');
        return true;
      }
      let secs = 0;
      if (target.includes(':')) {
        const parts = target.split(':');
        secs = Number.parseInt(parts[0], 10) * 60 + Number.parseInt(parts[1], 10);
      } else {
        secs = Number.parseInt(target, 10);
      }
      const res = musicService.seek(guild.id, secs || 0);
      await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      return true;
    }

    case 'radio': {
      const station = args[0];
      if (!station) {
        const list = RADIO_STATIONS.map((r) => `• \`/radio ${r.key}\` — **${r.name}** (\`${r.genre}\`)`).join('\n');
        await api.sendMessage(
          message.channel_id,
          `📻 **Jockie Canlı Radyo İstasyonları:**\n\n${list}\n\nOynatmak için: \`/radio <istasyon_kodu>\` (Örn: \`/radio lofi\`)`,
        );
        return true;
      }

      const explicitChannel = args[1];
      const targetVoice = await helpers.resolveTargetVoiceChannel(guild, invoker, explicitChannel);
      if (!targetVoice) {
        await api.sendMessage(
          message.channel_id,
          '❌ **Bir ses kanalında değilsiniz!**\nRadyo çalabilmem için lütfen önce bir ses kanalına katılın veya odayı belirtin: `/join <oda_adı>`',
        );
        return true;
      }

      musicService.connectToVoice(guild.id, targetVoice.channelId, targetVoice.channelName);
      const res = await musicService.playRadio(guild.id, message.channel_id, station, invoker);
      await api.sendMessage(message.channel_id, res.message, { components: res.components });
      return true;
    }

    case 'music':
    case 'muzik':
    case 'müzik':
    case 'm':
    case 'jockie': {
      const sub = (args[0] || '').toLowerCase();
      const subArgs = args.slice(1);

      if (sub === 'kanal' || sub === 'channel') {
        const isOwner = invoker.user.id === guild.owner_id;
        const isAdmin = PermissionService.hasPermission(guild, invoker, Permissions.ADMINISTRATOR);
        const isManageGuild = PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD);

        if (!isManageGuild && !isAdmin && !isOwner) {
          await helpers.sendUsageError(message, '❌ Müzik kanalını ayarlamak için **Sunucuyu Yönet** veya **Yönetici** yetkisine sahip olmalısınız.');
          return true;
        }

        const chRaw = subArgs[0];
        if (!chRaw || chRaw === 'sil' || chRaw === 'delete' || chRaw === 'sifirla' || chRaw === 'reset') {
          db?.updateGuildConfig(guild.id, { music_channel_id: null });
          await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **Müzik kanalı kısıtlaması kaldırıldı.** Müzik komutları tüm kanallarda serbest.', 6, message.id);
          return true;
        }

        const ch = await helpers.resolveChannel(guild, chRaw);
        if (!ch) {
          await helpers.sendUsageError(message, '❌ Lütfen geçerli bir kanal etiketleyin. Örn: `/music kanal #muzik-kanali` (Kaldırmak için: `/music kanal sil`)');
          return true;
        }

        db?.updateGuildConfig(guild.id, { music_channel_id: ch.id });
        await helpers.sendAutoExpiringMessage(
          message.channel_id,
          `✅ **Müzik Kanalı Ayarlandı:** <#${ch.id}>. Standart üyeler müzik komutlarını yalnızca bu kanalda kullanabilir.`,
          7,
          message.id,
        );
        return true;
      }

      if (sub === 'play' || sub === 'p') {
        const fullInput = subArgs.join(' ').trim();
        if (!fullInput) {
          await api.sendMessage(message.channel_id, '❌ Kullanım: `/m play <link / şarkı adı>`');
          return true;
        }

        let query = fullInput;
        let explicitChannel: string | undefined;
        const channelMentionMatch = fullInput.match(/<#(\d+)>$/);
        if (channelMentionMatch) {
          explicitChannel = channelMentionMatch[1];
          query = fullInput.replace(/<#\d+>$/, '').trim();
        }

        const targetVoice = await helpers.resolveTargetVoiceChannel(guild, invoker, explicitChannel);
        if (!targetVoice) {
          await api.sendMessage(
            message.channel_id,
            '❌ **Bir ses kanalında değilsiniz!**\nŞarkı çalabilmem için lütfen önce sunucuda bir ses kanalına katılın veya `/join <oda_adı>` kullanın.',
          );
          return true;
        }

        const isAlreadyInVoice =
          musicService.isVoiceConnected(guild.id) &&
          musicService.getPlayer(guild.id)?.voiceChannelId === targetVoice.channelId;

        if (!isAlreadyInVoice) {
          musicService.connectToVoice(guild.id, targetVoice.channelId, targetVoice.channelName);
        }
        const res = await musicService.play(guild.id, message.channel_id, query, invoker);
        await api.sendMessage(message.channel_id, res.message, { components: res.components });
      } else if (sub === 'join' || sub === 'connect') {
        const explicitTarget = subArgs.join(' ').trim();
        const targetVoice = await helpers.resolveTargetVoiceChannel(guild, invoker, explicitTarget);
        if (!targetVoice) {
          await helpers.sendUsageError(message, '❌ **Bir ses kanalında değilsiniz!**\nLütfen bir ses kanalına katılın veya `/m join <oda_adı>` belirtin.');
          return true;
        }
        const res = musicService.join(guild.id, message.channel_id, targetVoice.channelId, targetVoice.channelName);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'leave' || sub === 'disconnect') {
        const res = musicService.leave(guild.id);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'pause') {
        const res = musicService.pause(guild.id);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'resume') {
        const res = musicService.resume(guild.id);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'skip' || sub === 's' || sub === 'next') {
        const res = await musicService.skip(guild.id);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'stop') {
        const res = musicService.stop(guild.id);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'queue' || sub === 'q') {
        const p = Number.parseInt(subArgs[0], 10) || 1;
        const res = musicService.getQueue(guild.id, p);
        await api.sendMessage(message.channel_id, res.message, { components: res.components });
      } else if (sub === 'np' || sub === 'nowplaying') {
        const res = musicService.getNowPlaying(guild.id);
        await api.sendMessage(message.channel_id, res.message, { components: res.components });
      } else if (sub === 'volume' || sub === 'vol') {
        const vol = Number.parseInt(subArgs[0], 10);
        if (Number.isNaN(vol)) {
          await helpers.sendUsageError(message, '❌ Kullanım: `/m volume <0-200>`');
          return true;
        }
        const res = musicService.setVolume(guild.id, vol);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'loop' || sub === 'repeat') {
        const modeArg = (subArgs[0] || '').toLowerCase();
        const mode =
          modeArg === 'track' || modeArg === 'tek'
            ? 'track'
            : modeArg === 'queue' || modeArg === 'kuyruk'
              ? 'queue'
              : modeArg === 'off' || modeArg === 'kapali'
                ? 'off'
                : undefined;
        const res = musicService.setLoop(guild.id, mode);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'shuffle') {
        const res = musicService.shuffle(guild.id);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'remove') {
        const idx = Number.parseInt(subArgs[0], 10);
        if (Number.isNaN(idx)) {
          await helpers.sendUsageError(message, '❌ Kullanım: `/m remove <sıra_numarası>`');
          return true;
        }
        const res = musicService.remove(guild.id, idx);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'clearqueue' || sub === 'cq') {
        const res = musicService.clearQueue(guild.id);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'seek') {
        const target = subArgs[0];
        let secs = 0;
        if (target && target.includes(':')) {
          const parts = target.split(':');
          secs = Number.parseInt(parts[0], 10) * 60 + Number.parseInt(parts[1], 10);
        } else if (target) {
          secs = Number.parseInt(target, 10);
        }
        const res = musicService.seek(guild.id, secs || 0);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'radio') {
        const st = subArgs[0];
        if (!st) {
          const list = RADIO_STATIONS.map((r) => `• \`/m radio ${r.key}\` — **${r.name}** (\`${r.genre}\`)`).join('\n');
          await api.sendMessage(message.channel_id, `📻 **Jockie Canlı Radyolar:**\n\n${list}`);
          return true;
        }
        const explicitChannel = subArgs[1];
        const targetVoice = await helpers.resolveTargetVoiceChannel(guild, invoker, explicitChannel);
        if (!targetVoice) {
          await api.sendMessage(
            message.channel_id,
            '❌ **Bir ses kanalında değilsiniz!**\nRadyo çalabilmem için lütfen önce bir ses kanalına katılın veya `/m join <oda_adı>` belirtin.',
          );
          return true;
        }

        musicService.connectToVoice(guild.id, targetVoice.channelId, targetVoice.channelName);
        const res = await musicService.playRadio(guild.id, message.channel_id, st, invoker);
        await api.sendMessage(message.channel_id, res.message, { components: res.components });
      } else {
        await api.sendMessage(
          message.channel_id,
          '🎵 **Jockie Müzik Komutları:**\n`/play <link>` • `/pause` • `/resume` • `/skip` • `/stop` • `/queue` • `/np` • `/volume` • `/loop` • `/shuffle` • `/radio` • `/seek` • `/join` • `/leave`',
        );
      }
      return true;
    }

    default:
      return false;
  }
}
