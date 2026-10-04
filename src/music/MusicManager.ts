// SPDX-License-Identifier: AGPL-3.0-or-later

import youtubedl from 'yt-dlp-exec';
import { Player } from './Player.js';
import { SpotifyResolver } from './SpotifyResolver.js';
import type {
  Track,
  PlayerOptions,
  ResolveResult,
  AudioSource,
  VoiceConnection,
  MusicApiClient,
  Snowflake,
  MusicEventData,
} from './types.js';
import { MusicEvent } from './types.js';

/**
 * Müzik sistemini yöneten ana sınıf
 */
export class MusicManager {
  private players: Map<Snowflake, Player>;
  private spotifyResolver: SpotifyResolver;
  private voiceConnection: VoiceConnection;
  private apiClient: MusicApiClient;

  constructor(voiceConnection: VoiceConnection, apiClient: MusicApiClient) {
    this.players = new Map();
    this.voiceConnection = voiceConnection;
    this.apiClient = apiClient;
    this.spotifyResolver = new SpotifyResolver();
  }

  /**
   * URL veya arama terimini çözer
   */
  async resolve(query: string, requester: Snowflake): Promise<ResolveResult> {
    const lowerQuery = query.toLowerCase();

    // Spotify Track
    if (lowerQuery.includes('spotify.com/track')) {
      const track = await this.spotifyResolver.resolveTrack(query, requester);
      if (track) {
        return { tracks: [track], isPlaylist: false };
      }
      return { tracks: [], isPlaylist: false };
    }

    // Spotify Playlist
    if (lowerQuery.includes('spotify.com/playlist')) {
      return await this.spotifyResolver.resolvePlaylist(query, requester);
    }

    // YouTube URL
    if (lowerQuery.includes('youtube.com') || lowerQuery.includes('youtu.be')) {
      const track = await this.resolveYouTube(query, requester);
      if (track) {
        return { tracks: [track], isPlaylist: false };
      }
      return { tracks: [], isPlaylist: false };
    }

    // SoundCloud URL
    if (lowerQuery.includes('soundcloud.com')) {
      const track = await this.resolveSoundCloud(query, requester);
      if (track) {
        return { tracks: [track], isPlaylist: false };
      }
      return { tracks: [], isPlaylist: false };
    }

    // Arama terimi (YouTube)
    const track = await this.searchYouTube(query, requester);
    if (track) {
      return { tracks: [track], isPlaylist: false };
    }

    return { tracks: [], isPlaylist: false };
  }

  /**
   * YouTube URL'sini çözer
   */
  private async resolveYouTube(url: string, requester: Snowflake): Promise<Track | null> {
    try {
      const result: any = await youtubedl(url, {
        dumpSingleJson: true,
        noWarnings: true,
      });

      return {
        id: `yt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: result.title || 'YouTube Video',
        artist: result.uploader || result.channel || 'YouTube',
        url: url,
        streamUrl: url,
        duration: typeof result.duration === 'number' ? result.duration : 0,
        thumbnail: result.thumbnails?.[0]?.url,
        source: 'youtube' as AudioSource,
        requester,
        addedAt: Date.now(),
      };
    } catch (err: any) {
      console.error('[MusicManager] YouTube çözme hatası:', err);
      return null;
    }
  }

  /**
   * YouTube'da arama yapar
   */
  private async searchYouTube(query: string, requester: Snowflake): Promise<Track | null> {
    try {
      const searchQuery = `ytsearch1:${query}`;
      const result: any = await youtubedl(searchQuery, {
        dumpSingleJson: true,
        flatPlaylist: true,
        noWarnings: true,
      });

      const entry = result?.entries ? result.entries[0] : result;
      if (!entry) {
        return null;
      }

      const url = entry.url || `https://www.youtube.com/watch?v=${entry.id}`;

      return {
        id: `yt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: entry.title || 'YouTube Video',
        artist: entry.uploader || entry.channel || 'YouTube',
        url: url,
        streamUrl: url,
        duration: typeof entry.duration === 'number' ? entry.duration : 0,
        thumbnail: entry.thumbnails?.[0]?.url,
        source: 'youtube' as AudioSource,
        requester,
        addedAt: Date.now(),
      };
    } catch (err: any) {
      console.error('[MusicManager] YouTube arama hatası:', err);
      return null;
    }
  }

  /**
   * SoundCloud URL'sini çözer
   */
  private async resolveSoundCloud(url: string, requester: Snowflake): Promise<Track | null> {
    try {
      const result: any = await youtubedl(url, {
        dumpSingleJson: true,
        noWarnings: true,
      });

      return {
        id: `sc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: result.title || 'SoundCloud Track',
        artist: result.uploader || 'SoundCloud',
        url: url,
        streamUrl: url,
        duration: typeof result.duration === 'number' ? result.duration : 0,
        thumbnail: result.thumbnails?.[0]?.url,
        source: 'soundcloud' as AudioSource,
        requester,
        addedAt: Date.now(),
      };
    } catch (err: any) {
      console.error('[MusicManager] SoundCloud çözme hatası:', err);
      return null;
    }
  }

  /**
   * Sunucu için player oluşturur veya mevcut olanı döndürür
   */
  getOrCreatePlayer(options: PlayerOptions): Player {
    const existing = this.players.get(options.guildId);
    if (existing) {
      return existing;
    }

    const player = new Player(options, this.voiceConnection, this.apiClient);

    // Event listeners'ı ayarla
    player.on(MusicEvent.TRACK_START, async (data) => {
      await this.sendTrackStartNotification(data);
    });

    player.on(MusicEvent.TRACK_END, async (data) => {
      await this.sendTrackEndNotification(data);
    });

    player.on(MusicEvent.TRACK_ERROR, async (data) => {
      await this.sendTrackErrorNotification(data);
    });

    player.on(MusicEvent.QUEUE_EMPTY, async (data) => {
      await this.sendQueueEmptyNotification(data);
    });

    this.players.set(options.guildId, player);
    console.log(`[MusicManager] Player oluşturuldu: ${options.guildId}`);

    return player;
  }

  /**
   * Sunucu için player'ı döndürür
   */
  getPlayer(guildId: Snowflake): Player | undefined {
    return this.players.get(guildId);
  }

  /**
   * Sunucu için player'ı siler
   */
  deletePlayer(guildId: Snowflake): void {
    const player = this.players.get(guildId);
    if (player) {
      player.disconnect();
      this.players.delete(guildId);
      console.log(`[MusicManager] Player silindi: ${guildId}`);
    }
  }

  /**
   * Track başlangıç bildirimi gönderir
   */
  private async sendTrackStartNotification(data: MusicEventData): Promise<void> {
    const player = this.players.get(data.guildId);
    if (!player || !data.track || !player.getTextChannelId()) {
      return;
    }

    const embed = {
      title: '🎵 Şimdi Çalıyor',
      description: `**${data.track.title}**\n${data.track.artist}`,
      color: 0x00ff00,
      fields: [
        { name: 'Süre', value: this.formatDuration(data.track.duration), inline: true },
        { name: 'İsteyen', value: `<@${data.track.requester}>`, inline: true },
      ],
      thumbnail: { url: data.track.thumbnail },
    };

    try {
      await this.apiClient.sendMessage(player.getTextChannelId()!, '', { embeds: [embed] });
    } catch (err: any) {
      console.error('[MusicManager] Bildirim gönderme hatası:', err);
    }
  }

  /**
   * Track bitiş bildirimi gönderir
   */
  private async sendTrackEndNotification(data: MusicEventData): Promise<void> {
    const player = this.players.get(data.guildId);
    if (!player || !player.getTextChannelId()) {
      return;
    }

    try {
      await this.apiClient.sendMessage(
        player.getTextChannelId()!,
        `⏹️ Parça bitti: ${data.reason || 'Doğal bitiş'}`,
      );
    } catch (err: any) {
      console.error('[MusicManager] Bildirim gönderme hatası:', err);
    }
  }

  /**
   * Track hata bildirimi gönderir
   */
  private async sendTrackErrorNotification(data: MusicEventData): Promise<void> {
    const player = this.players.get(data.guildId);
    if (!player || !data.track || !player.getTextChannelId()) {
      return;
    }

    try {
      await this.apiClient.sendMessage(
        player.getTextChannelId()!,
        `❌ Parça çalınamadı: ${data.track.title}\nHata: ${data.error?.message || 'Bilinmeyen hata'}`,
      );
    } catch (err: any) {
      console.error('[MusicManager] Bildirim gönderme hatası:', err);
    }
  }

  /**
   * Kuyruk boş bildirimi gönderir
   */
  private async sendQueueEmptyNotification(data: MusicEventData): Promise<void> {
    const player = this.players.get(data.guildId);
    if (!player || !player.getTextChannelId()) {
      return;
    }

    try {
      await this.apiClient.sendMessage(
        player.getTextChannelId()!,
        '📭 Kuyruk boş, ses kanalından ayrılıyorum...',
      );
    } catch (err: any) {
      console.error('[MusicManager] Bildirim gönderme hatası:', err);
    }
  }

  /**
   * Süreyi formatlar
   */
  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Tüm player'ları temizler
   */
  destroy(): void {
    for (const [guildId, player] of this.players) {
      player.disconnect();
    }
    this.players.clear();
    console.log('[MusicManager] Tüm playerlar temizlendi');
  }
}
