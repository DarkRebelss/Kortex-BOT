// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  Track,
  Queue,
  PlayerOptions,
  MusicEventData,
  VoiceConnection,
  MusicApiClient,
  Snowflake,
} from './types.js';
import { PlayerState, LoopMode, MusicEvent } from './types.js';

/**
 * Tek bir sunucu için müzik oynatıcı sınıfı
 */
export class Player {
  private guildId: Snowflake;
  private voiceChannelId: Snowflake;
  private voiceChannelName?: string;
  private textChannelId?: Snowflake;
  private queue: Queue;
  private state: PlayerState;
  private voiceConnection: VoiceConnection;
  private apiClient: MusicApiClient;
  private eventListeners: Map<MusicEvent, Set<(data: MusicEventData) => void>>;
  private autoLeaveTimeout?: NodeJS.Timeout;
  private autoLeaveMs: number;
  private currentStreamUrl?: string;

  constructor(
    options: PlayerOptions,
    voiceConnection: VoiceConnection,
    apiClient: MusicApiClient,
  ) {
    this.guildId = options.guildId;
    this.voiceChannelId = options.voiceChannelId;
    this.voiceChannelName = options.voiceChannelName;
    this.textChannelId = options.textChannelId;
    this.voiceConnection = voiceConnection;
    this.apiClient = apiClient;
    this.autoLeaveMs = options.autoLeaveTimeout || 300000; // 5 dakika varsayılan

    this.queue = {
      current: null,
      tracks: [],
      loopMode: LoopMode.OFF,
      volume: options.defaultVolume || 75,
      paused: false,
    };

    this.state = PlayerState.IDLE;
    this.eventListeners = new Map();
  }

  /**
   * Kuyruğa parça ekler
   */
  addTrack(track: Track): void {
    this.queue.tracks.push(track);
    this.emit(MusicEvent.QUEUE_ADD, {
      guildId: this.guildId,
      track,
    });

    console.log(`[Player] Kuyruğa eklendi: ${track.title} (Toplam: ${this.queue.tracks.length})`);
  }

  /**
   * Kuyruğa birden fazla parça ekler
   */
  addTracks(tracks: Track[]): void {
    for (const track of tracks) {
      this.addTrack(track);
    }
  }

  /**
   * Oynatmayı başlatır
   */
  async play(): Promise<void> {
    if (this.state === PlayerState.PLAYING && !this.queue.paused) {
      console.log('[Player] Zaten çalıyor');
      return;
    }

    if (this.queue.paused) {
      this.resume();
      return;
    }

    if (this.queue.tracks.length === 0 && !this.queue.current) {
      console.log('[Player] Kuyruk boş, oynatılacak parça yok');
      this.emit(MusicEvent.QUEUE_EMPTY, { guildId: this.guildId });
      return;
    }

    // Şu an çalan parça yoksa, kuyruktan al
    if (!this.queue.current) {
      const nextTrack = this.queue.tracks.shift();
      if (!nextTrack) {
        console.log('[Player] Kuyruk boş');
        this.emit(MusicEvent.QUEUE_EMPTY, { guildId: this.guildId });
        return;
      }
      this.queue.current = nextTrack;
    }

    this.state = PlayerState.BUFFERING;
    this.currentStreamUrl = this.queue.current.streamUrl;

    console.log(`[Player] Çalınıyor: ${this.queue.current.title}`);

    try {
      this.voiceConnection.play(
        this.guildId,
        this.currentStreamUrl,
        this.queue.volume / 100,
      );

      this.state = PlayerState.PLAYING;
      this.queue.paused = false;

      this.emit(MusicEvent.TRACK_START, {
        guildId: this.guildId,
        track: this.queue.current,
      });

      this.clearAutoLeave();
    } catch (err: any) {
      console.error('[Player] Çalma hatası:', err);
      this.state = PlayerState.ERROR;
      this.emit(MusicEvent.TRACK_ERROR, {
        guildId: this.guildId,
        track: this.queue.current,
        error: err,
      });

      // Hata durumunda sıradaki parçaya geç
      await this.next();
    }
  }

  /**
   * Sıradaki parçaya geçer
   */
  async next(): Promise<void> {
    console.log('[Player] Sıradaki parçaya geçiliyor');

    // Şu anki parçayı durdur
    this.voiceConnection.stop(this.guildId);

    // Döngü moduna göre davranış
    if (this.queue.loopMode === LoopMode.SINGLE && this.queue.current) {
      // Tek parça döngüsü - aynı parçayı tekrar kuyruğa ekle
      this.queue.tracks.unshift(this.queue.current);
    } else if (this.queue.loopMode === LoopMode.QUEUE && this.queue.current) {
      // Tüm kuyruk döngüsü - parçayı kuyruğun sonuna ekle
      this.queue.tracks.push(this.queue.current);
    }

    // Şu anki parçayı sıfırla
    this.queue.current = null;

    // Sıradaki parçayı çal
    await this.play();
  }

  /**
   * Oynatmayı duraklatır
   */
  pause(): void {
    if (this.state !== PlayerState.PLAYING) {
      console.log('[Player] Duraklatılamıyor - çalmıyor');
      return;
    }

    this.voiceConnection.pause(this.guildId);
    this.state = PlayerState.PAUSED;
    this.queue.paused = true;

    console.log('[Player] Duraklatıldı');
    this.emit(MusicEvent.PLAYER_PAUSE, { guildId: this.guildId });

    this.startAutoLeave();
  }

  /**
   * Oynatmayı devam ettirir
   */
  resume(): void {
    if (this.state !== PlayerState.PAUSED) {
      console.log('[Player] Devam ettirilemiyor - duraklatılmadı');
      return;
    }

    this.voiceConnection.resume(this.guildId);
    this.state = PlayerState.PLAYING;
    this.queue.paused = false;

    console.log('[Player] Devam ettirildi');
    this.emit(MusicEvent.PLAYER_RESUME, { guildId: this.guildId });

    this.clearAutoLeave();
  }

  /**
   * Oynatmayı durdurur ve kuyruğu temizler
   */
  stop(): void {
    console.log('[Player] Durduruluyor');

    this.voiceConnection.stop(this.guildId);

    this.queue.current = null;
    this.queue.tracks = [];
    this.queue.paused = false;
    this.state = PlayerState.IDLE;

    this.emit(MusicEvent.TRACK_END, { guildId: this.guildId, reason: 'Manuel durdurma' });
  }

  /**
   * Ses seviyesini ayarlar
   */
  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(100, volume));
    this.queue.volume = clampedVolume;

    if (this.state === PlayerState.PLAYING) {
      this.voiceConnection.setVolume(this.guildId, clampedVolume / 100);
    }

    console.log(`[Player] Ses seviyesi: ${clampedVolume}%`);
  }

  /**
   * Döngü modunu ayarlar
   */
  setLoopMode(mode: LoopMode): void {
    this.queue.loopMode = mode;
    console.log(`[Player] Döngü modu: ${mode}`);
  }

  /**
   * Parçayı atlar (skip)
   */
  async skip(): Promise<void> {
    await this.next();
  }

  /**
   * Kuyruğu temizler
   */
  clearQueue(): void {
    this.queue.tracks = [];
    console.log('[Player] Kuyruk temizlendi');
  }

  /**
   * Şu anki parçayı kaldırır
   */
  removeCurrentTrack(): void {
    this.queue.current = null;
    this.voiceConnection.stop(this.guildId);
  }

  /**
   * Kuyruktan belirli bir parçayı kaldırır
   */
  removeTrack(index: number): Track | null {
    if (index < 0 || index >= this.queue.tracks.length) {
      return null;
    }

    const removed = this.queue.tracks.splice(index, 1)[0];
    console.log(`[Player] Kuyruktan kaldırıldı: ${removed.title}`);
    return removed;
  }

  /**
   * Olay dinleyici ekler
   */
  on(event: MusicEvent, listener: (data: MusicEventData) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * Olay dinleyici kaldırır
   */
  off(event: MusicEvent, listener: (data: MusicEventData) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Olay tetikler
   */
  private emit(event: MusicEvent, data: MusicEventData): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (err: any) {
          console.error(`[Player] Olay dinleyici hatası (${event}):`, err);
        }
      }
    }
 }

  /**
   * Otomatik ayrılma zamanlayıcısını başlatır
   */
  private startAutoLeave(): void {
    this.clearAutoLeave();

    this.autoLeaveTimeout = setTimeout(() => {
      console.log('[Player] Otomatik ayrılma süresi doldu');
      this.disconnect();
    }, this.autoLeaveMs);
  }

  /**
   * Otomatik ayrılma zamanlayıcısını temizler
   */
  private clearAutoLeave(): void {
    if (this.autoLeaveTimeout) {
      clearTimeout(this.autoLeaveTimeout);
      this.autoLeaveTimeout = undefined;
    }
  }

  /**
   * Ses kanalından ayrılır
   */
  async disconnect(): Promise<void> {
    console.log('[Player] Ses kanalından ayrılıyor');

    this.stop();
    this.clearAutoLeave();

    try {
      await this.voiceConnection.disconnect(this.guildId);
      this.emit(MusicEvent.VOICE_DISCONNECT, { guildId: this.guildId });
    } catch (err: any) {
      console.error('[Player] Ayrılma hatası:', err);
    }
  }

  /**
   * Getter'lar
   */
  getGuildId(): Snowflake {
    return this.guildId;
  }

  getVoiceChannelId(): Snowflake {
    return this.voiceChannelId;
  }

  getTextChannelId(): Snowflake | undefined {
    return this.textChannelId;
  }

  getQueue(): Queue {
    return { ...this.queue };
  }

  getCurrentTrack(): Track | null {
    return this.queue.current;
  }

  getState(): PlayerState {
    return this.state;
  }

  isPlaying(): boolean {
    return this.state === PlayerState.PLAYING;
  }

  isPaused(): boolean {
    return this.state === PlayerState.PAUSED;
  }

  isIdle(): boolean {
    return this.state === PlayerState.IDLE;
  }
}
