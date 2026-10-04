// SPDX-License-Identifier: AGPL-3.0-or-later

import { MusicManager } from './MusicManager.js';
import type { PlayerOptions, Snowflake, LoopMode } from './types.js';

/**
 * Müzik komutları için handler sınıfı
 */
export class MusicCommands {
  private musicManager: MusicManager;

  constructor(musicManager: MusicManager) {
    this.musicManager = musicManager;
  }

  /**
   * /play komutu
   */
  async handlePlay(
    options: PlayerOptions,
    query: string,
    requester: Snowflake,
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`[MusicCommands] Play komutu: ${query}`);

      // URL veya arama terimini çöz
      const resolveResult = await this.musicManager.resolve(query, requester);

      if (resolveResult.tracks.length === 0) {
        return {
          success: false,
          message: '❌ Parça bulunamadı veya çözülemedi.',
        };
      }

      // Player'ı al veya oluştur
      const player = this.musicManager.getOrCreatePlayer(options);

      // Parçaları kuyruğa ekle
      if (resolveResult.isPlaylist) {
        player.addTracks(resolveResult.tracks);
        return {
          success: true,
          message: `📋 **${resolveResult.playlistName || 'Playlist'}**'den ${resolveResult.tracks.length} parça kuyruğa eklendi.`,
        };
      } else {
        const track = resolveResult.tracks[0];
        player.addTrack(track);

        // Oynatmayı başlat
        await player.play();

        return {
          success: true,
          message: `✅ **${track.title}** kuyruğa eklendi ve çalınıyor.`,
        };
      }
    } catch (err: any) {
      console.error('[MusicCommands] Play hatası:', err);
      return {
        success: false,
        message: `❌ Hata: ${err.message}`,
      };
    }
  }

  /**
   * /skip komutu
   */
  async handleSkip(guildId: Snowflake): Promise<{ success: boolean; message: string }> {
    try {
      const player = this.musicManager.getPlayer(guildId);
      if (!player) {
        return {
          success: false,
          message: '❌ Bu sunucuda aktif bir oynatıcı yok.',
        };
      }

      if (!player.getCurrentTrack()) {
        return {
          success: false,
          message: '❌ Çalan parça yok.',
        };
      }

      await player.skip();

      return {
        success: true,
        message: '⏭️ Sıradaki parçaya geçildi.',
      };
    } catch (err: any) {
      console.error('[MusicCommands] Skip hatası:', err);
      return {
        success: false,
        message: `❌ Hata: ${err.message}`,
      };
    }
  }

  /**
   * /stop komutu
   */
  async handleStop(guildId: Snowflake): Promise<{ success: boolean; message: string }> {
    try {
      const player = this.musicManager.getPlayer(guildId);
      if (!player) {
        return {
          success: false,
          message: '❌ Bu sunucuda aktif bir oynatıcı yok.',
        };
      }

      player.stop();

      return {
        success: true,
        message: '⏹️ Oynatma durduruldu ve kuyruk temizlendi.',
      };
    } catch (err: any) {
      console.error('[MusicCommands] Stop hatası:', err);
      return {
        success: false,
        message: `❌ Hata: ${err.message}`,
      };
    }
  }

  /**
   * /pause komutu
   */
  async handlePause(guildId: Snowflake): Promise<{ success: boolean; message: string }> {
    try {
      const player = this.musicManager.getPlayer(guildId);
      if (!player) {
        return {
          success: false,
          message: '❌ Bu sunucuda aktif bir oynatıcı yok.',
        };
      }

      if (player.isPaused()) {
        return {
          success: false,
          message: '❌ Parça zaten duraklatılmış.',
        };
      }

      player.pause();

      return {
        success: true,
        message: '⏸️ Parça duraklatıldı.',
      };
    } catch (err: any) {
      console.error('[MusicCommands] Pause hatası:', err);
      return {
        success: false,
        message: `❌ Hata: ${err.message}`,
      };
    }
  }

  /**
   * /resume komutu
   */
  async handleResume(guildId: Snowflake): Promise<{ success: boolean; message: string }> {
    try {
      const player = this.musicManager.getPlayer(guildId);
      if (!player) {
        return {
          success: false,
          message: '❌ Bu sunucuda aktif bir oynatıcı yok.',
        };
      }

      if (!player.isPaused()) {
        return {
          success: false,
          message: '❌ Parça zaten çalıyor.',
        };
      }

      player.resume();

      return {
        success: true,
        message: '▶️ Parça devam ettirildi.',
      };
    } catch (err: any) {
      console.error('[MusicCommands] Resume hatası:', err);
      return {
        success: false,
        message: `❌ Hata: ${err.message}`,
      };
    }
  }

  /**
   * /queue komutu
   */
  async handleQueue(guildId: Snowflake, page: number = 1): Promise<{ success: boolean; message: string }> {
    try {
      const player = this.musicManager.getPlayer(guildId);
      if (!player) {
        return {
          success: false,
          message: '❌ Bu sunucuda aktif bir oynatıcı yok.',
        };
      }

      const queue = player.getQueue();
      const pageSize = 10;
      const totalPages = Math.ceil(queue.tracks.length / pageSize);

      if (page < 1 || page > totalPages) {
        page = 1;
      }

      const startIndex = (page - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, queue.tracks.length);
      const pageTracks = queue.tracks.slice(startIndex, endIndex);

      let message = '📋 **Kuyruk**\n\n';

      if (queue.current) {
        message += `🎵 **Şimdi Çalıyor:** ${queue.current.title} (${this.formatDuration(queue.current.duration)})\n\n`;
      }

      if (pageTracks.length === 0) {
        message += 'Kuyruk boş.';
      } else {
        message += '**Sıradaki Parçalar:**\n';
        for (let i = 0; i < pageTracks.length; i++) {
          const track = pageTracks[i];
          const index = startIndex + i + 1;
          message += `${index}. **${track.title}** (${this.formatDuration(track.duration)}) - <@${track.requester}>\n`;
        }

        if (totalPages > 1) {
          message += `\nSayfa ${page}/${totalPages}`;
        }
      }

      return {
        success: true,
        message,
      };
    } catch (err: any) {
      console.error('[MusicCommands] Queue hatası:', err);
      return {
        success: false,
        message: `❌ Hata: ${err.message}`,
      };
    }
  }

  /**
   * /nowplaying komutu
   */
  async handleNowPlaying(guildId: Snowflake): Promise<{ success: boolean; message: string }> {
    try {
      const player = this.musicManager.getPlayer(guildId);
      if (!player) {
        return {
          success: false,
          message: '❌ Bu sunucuda aktif bir oynatıcı yok.',
        };
      }

      const currentTrack = player.getCurrentTrack();
      if (!currentTrack) {
        return {
          success: false,
          message: '❌ Çalan parça yok.',
        };
      }

      const queue = player.getQueue();

      let message = '🎵 **Şimdi Çalıyor**\n\n';
      message += `**${currentTrack.title}**\n`;
      message += `${currentTrack.artist}\n`;
      message += `⏱️ Süre: ${this.formatDuration(currentTrack.duration)}\n`;
      message += `🔊 Ses: ${queue.volume}%\n`;
      message += `📋 Kuyruk: ${queue.tracks.length} parça\n`;
      message += `🔁 Döngü: ${queue.loopMode}\n`;
      message += `👤 İsteyen: <@${currentTrack.requester}>`;

      return {
        success: true,
        message,
      };
    } catch (err: any) {
      console.error('[MusicCommands] NowPlaying hatası:', err);
      return {
        success: false,
        message: `❌ Hata: ${err.message}`,
      };
    }
  }

  /**
   * /volume komutu
   */
  async handleVolume(guildId: Snowflake, volume: number): Promise<{ success: boolean; message: string }> {
    try {
      const player = this.musicManager.getPlayer(guildId);
      if (!player) {
        return {
          success: false,
          message: '❌ Bu sunucuda aktif bir oynatıcı yok.',
        };
      }

      if (volume < 0 || volume > 100) {
        return {
          success: false,
          message: '❌ Ses seviyesi 0-100 arasında olmalı.',
        };
      }

      player.setVolume(volume);

      return {
        success: true,
        message: `🔊 Ses seviyesi %${volume} olarak ayarlandı.`,
      };
    } catch (err: any) {
      console.error('[MusicCommands] Volume hatası:', err);
      return {
        success: false,
        message: `❌ Hata: ${err.message}`,
      };
    }
  }

  /**
   * /loop komutu
   */
  async handleLoop(guildId: Snowflake, mode: LoopMode): Promise<{ success: boolean; message: string }> {
    try {
      const player = this.musicManager.getPlayer(guildId);
      if (!player) {
        return {
          success: false,
          message: '❌ Bu sunucuda aktif bir oynatıcı yok.',
        };
      }

      player.setLoopMode(mode);

      const modeNames: Record<LoopMode, string> = {
        off: 'Kapalı',
        single: 'Tek Parça',
        queue: 'Tüm Kuyruk',
      };

      return {
        success: true,
        message: `🔁 Döngü modu: **${modeNames[mode]}**`,
      };
    } catch (err: any) {
      console.error('[MusicCommands] Loop hatası:', err);
      return {
        success: false,
        message: `❌ Hata: ${err.message}`,
      };
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
}
