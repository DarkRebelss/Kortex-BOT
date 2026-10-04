# Yeni Müzik Modülü - Kurulum ve Entegrasyon Kılavuzu

## 📋 Dizin Yapısı

```
src/music/
├── types.ts           # TypeScript tipleri ve arayüzler
├── SpotifyResolver.ts # Spotify linklerini çözen servis
├── Player.ts          # Tek sunucu için oynatıcı sınıfı
├── MusicManager.ts    # Ana müzik yöneticisi
├── commands.ts        # Komut handler'ları
└── README.md          # Bu dosya
```

## 📦 Gerekli Bağımlılıklar

Mevcut `package.json` dosyanızda zaten şu paketler var:
- `@distube/ytdl-core` - YouTube indirme
- `play-dl` - Alternatif YouTube/SoundCloud indirme
- `yt-dlp-exec` - yt-dlp wrapper
- `ffmpeg-static` - FFmpeg binary

**Ek paket gerekmiyor** - mevcut paketler yeterli.

## 🔧 Entegrasyon Adımları

### 1. VoiceConnection Arayüzünü Uygulama

Mevcut ses bağlantı sisteminizi `VoiceConnection` arayüzüne uyarlayın:

```typescript
// src/music/adapter.ts
import type { VoiceConnection } from './types.js';
import type { Snowflake } from './types.js';

export class FluxerVoiceAdapter implements VoiceConnection {
  constructor(private gateway: any, private voiceClient: any) {}

  isConnected(guildId: Snowflake): boolean {
    return this.voiceClient?.isConnected(guildId) || false;
  }

  async disconnect(guildId: Snowflake): Promise<void> {
    // Mevcut ses bağlantısını kes
    this.gateway?.sendVoiceStateUpdate(guildId, null, false, false);
  }

  play(guildId: Snowflake, streamUrl: string, volume: number): void {
    // Ses akışını başlat
    // Mevcut ses sistemi ile entegrasyon gerekli
  }

  pause(guildId: Snowflake): void {
    // Akışı duraklat
  }

  resume(guildId: Snowflake): void {
    // Akışı devam ettir
  }

  stop(guildId: Snowflake): void {
    // Akışı durdur
  }

  setVolume(guildId: Snowflake, volume: number): void {
    // Ses seviyesini ayarla
  }
}
```

### 2. MusicApiClient Arayüzünü Uygulama

```typescript
// src/music/apiAdapter.ts
import type { MusicApiClient } from './types.js';
import type { Snowflake } from './types.js';
import { MicupApiClient } from '../api/MicupApiClient.js';

export class ApiClientAdapter implements MusicApiClient {
  constructor(private api: MicupApiClient) {}

  async sendMessage(channelId: Snowflake, content: string, options?: any) {
    return this.api.sendMessage(channelId, content, options);
  }

  async editMessage(channelId: Snowflake, messageId: Snowflake, content: string, options?: any) {
    return this.api.editMessage(channelId, messageId, content, options);
  }

  async deleteMessage(channelId: Snowflake, messageId: Snowflake, reason?: string) {
    return this.api.deleteMessage(channelId, messageId, reason);
  }
}
```

### 3. MusicManager'ı Başlatma

```typescript
// src/index.ts veya uygun yer
import { MusicManager } from './music/MusicManager.js';
import { MusicCommands } from './music/commands.js';
import { FluxerVoiceAdapter } from './music/adapter.js';
import { ApiClientAdapter } from './music/apiAdapter.js';

// Voice adapter oluştur
const voiceAdapter = new FluxerVoiceAdapter(gateway, voiceClient);

// API adapter oluştur
const apiAdapter = new ApiClientAdapter(api);

// MusicManager oluştur
const musicManager = new MusicManager(voiceAdapter, apiAdapter);

// MusicCommands oluştur
const musicCommands = new MusicCommands(musicManager);

// Global olarak erişilebilir yap
global.musicManager = musicManager;
global.musicCommands = musicCommands;
```

### 4. Komutları Entegre Etme

Mevcut komut sisteminize yeni müzik komutlarını ekleyin:

```typescript
// src/commands/modules/musicCommands.ts
import { musicCommands } from '../../music/commands.js';
import type { CommandContext } from '../CommandHandler.js';

export async function handleMusicCommands(ctx: CommandContext): Promise<boolean> {
  const { commandName, args, guild, invoker, message } = ctx;

  // Ses kanalı kontrolü
  const voiceChannel = invoker.voiceState?.channelId;
  if (!voiceChannel) {
    await ctx.api.sendMessage(message.channel_id, '❌ Önce bir ses kanalına katılmalısın.');
    return true;
  }

  const playerOptions = {
    guildId: guild.id,
    voiceChannelId: voiceChannel,
    textChannelId: message.channel_id,
    defaultVolume: 75,
  };

  switch (commandName) {
    case 'play':
    case 'çal': {
      const query = args.join(' ');
      if (!query) {
        await ctx.api.sendMessage(message.channel_id, '❌ Lütfen bir URL veya arama terimi belirtin.');
        return true;
      }
      const result = await musicCommands.handlePlay(playerOptions, query, invoker.user.id);
      await ctx.api.sendMessage(message.channel_id, result.message);
      return true;
    }

    case 'skip':
    case 'geç': {
      const result = await musicCommands.handleSkip(guild.id);
      await ctx.api.sendMessage(message.channel_id, result.message);
      return true;
    }

    case 'stop':
    case 'dur': {
      const result = await musicCommands.handleStop(guild.id);
      await ctx.api.sendMessage(message.channel_id, result.message);
      return true;
    }

    case 'pause':
    case 'duraklat': {
      const result = await musicCommands.handlePause(guild.id);
      await ctx.api.sendMessage(message.channel_id, result.message);
      return true;
    }

    case 'resume':
    case 'devam': {
      const result = await musicCommands.handleResume(guild.id);
      await ctx.api.sendMessage(message.channel_id, result.message);
      return true;
    }

    case 'queue':
    case 'liste': {
      const page = parseInt(args[0]) || 1;
      const result = await musicCommands.handleQueue(guild.id, page);
      await ctx.api.sendMessage(message.channel_id, result.message);
      return true;
    }

    case 'nowplaying':
    case 'np':
    case 'çalan': {
      const result = await musicCommands.handleNowPlaying(guild.id);
      await ctx.api.sendMessage(message.channel_id, result.message);
      return true;
    }

    case 'volume':
    case 'ses': {
      const volume = parseInt(args[0]);
      if (isNaN(volume)) {
        await ctx.api.sendMessage(message.channel_id, '❌ Lütfen geçerli bir ses seviyesi belirtin (0-100).');
        return true;
      }
      const result = await musicCommands.handleVolume(guild.id, volume);
      await ctx.api.sendMessage(message.channel_id, result.message);
      return true;
    }

    case 'loop':
    case 'döngü': {
      const mode = args[0]?.toLowerCase() || 'off';
      const validModes = ['off', 'single', 'queue'];
      if (!validModes.includes(mode)) {
        await ctx.api.sendMessage(message.channel_id, '❌ Geçersiz döngü modu. Kullanılabilir: off, single, queue');
        return true;
      }
      const result = await musicCommands.handleLoop(guild.id, mode as any);
      await ctx.api.sendMessage(message.channel_id, result.message);
      return true;
    }

    default:
      return false;
  }
}
```

### 5. CommandHandler'a Entegrasyon

```typescript
// src/commands/CommandHandler.ts
import { handleMusicCommands } from './modules/musicCommands.js';

// routeCommand metodunda:
if (await handleMusicCommands(ctx)) return;
```

## 🎯 Özellikler

### Desteklenen Kaynaklar
- ✅ Spotify Track (otomatik YouTube eşleştirme)
- ✅ YouTube URL'leri
- ✅ YouTube arama terimleri
- ✅ SoundCloud URL'leri
- ⚠️ Spotify Playlist (sınırlı - Web API gerekli)

### Komutlar
- `/play <url|arama>` - Şarkı çal
- `/skip` - Sıradaki parçaya geç
- `/stop` - Durdur ve kuyruğu temizle
- `/pause` - Duraklat
- `/resume` - Devam ettir
- `/queue [sayfa]` - Kuyruğu görüntüle
- `/nowplaying` - Çalan parçayı göster
- `/volume <0-100>` - Ses seviyesini ayarla
- `/loop <off|single|queue>` - Döngü modunu ayarla

### Döngü Modları
- **off**: Döngü kapalı
- **single**: Tek parça döngüsü
- **queue**: Tüm kuyruk döngüsü

## 🔍 Spotify Entegrasyonu Notları

Spotify Web API'si olmadan:
- ✅ Track metadata'sı (oEmbed + HTML scraping)
- ✅ YouTube eşleştirme (ISRC + akıllı algoritma)
- ⚠️ Playlist metadata'sı (sınırlı)
- ❌ Playlist track listesi (Web API gerekli)

**Öneri:** Daha iyi Spotify desteği için Spotify Web API entegrasyonu ekleyin.

## 🐛 Hata Ayıklama

Debug logları konsola yazdırılır. Sorun yaşarsanız:
1. Konsol loglarını kontrol edin
2. Spotify eşleşme skorlarını inceleyin
3. yt-dlp kurulumunu doğrulayın
4. FFmpeg kurulumunu kontrol edin

## 📝 Gelecek İyileştirmeler

- [ ] Spotify Web API entegrasyonu
- [ ] Lavalink desteği
- [ ] Ses filtreleri (bass boost, nightcore vb.)
- [ ] Şarkı sözleri entegrasyonu
- [ ] Favori parçalar sistemi
- [ ] İstatistikler ve analitik

## ⚠️ Önemli Notlar

1. **VoiceConnection** arayüzü mevcut ses sisteminize göre uyarlanmalı
2. **FFmpeg** sisteminde kurulu olmalı (`ffmpeg-static` ile otomatik)
3. **yt-dlp** sisteminde kurulu olmalı
4. Spotify playlist desteği için Web API gerekli
5. Rate limit'e karşı batch işleme stratejisi önerilir

## 🔄 Mevcut Sistem ile Geçiş

Eski `MusicService.ts`'yi koruyabilir veya yavaş yavaş geçiş yapabilirsiniz:

1. Yeni modülü test ortamında kurun
2. Komutları paralel çalıştırın
3. Stabil olduğunda eski sistemi devre dışı bırakın
4. Eski dosyaları silin
