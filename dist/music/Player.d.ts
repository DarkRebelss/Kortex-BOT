import type { Track, Queue, PlayerOptions, MusicEventData, VoiceConnection, MusicApiClient, Snowflake } from './types.js';
import { PlayerState, LoopMode, MusicEvent } from './types.js';
/**
 * Tek bir sunucu için müzik oynatıcı sınıfı
 */
export declare class Player {
    private guildId;
    private voiceChannelId;
    private voiceChannelName?;
    private textChannelId?;
    private queue;
    private state;
    private voiceConnection;
    private apiClient;
    private eventListeners;
    private autoLeaveTimeout?;
    private autoLeaveMs;
    private currentStreamUrl?;
    constructor(options: PlayerOptions, voiceConnection: VoiceConnection, apiClient: MusicApiClient);
    /**
     * Kuyruğa parça ekler
     */
    addTrack(track: Track): void;
    /**
     * Kuyruğa birden fazla parça ekler
     */
    addTracks(tracks: Track[]): void;
    /**
     * Oynatmayı başlatır
     */
    play(): Promise<void>;
    /**
     * Sıradaki parçaya geçer
     */
    next(): Promise<void>;
    /**
     * Oynatmayı duraklatır
     */
    pause(): void;
    /**
     * Oynatmayı devam ettirir
     */
    resume(): void;
    /**
     * Oynatmayı durdurur ve kuyruğu temizler
     */
    stop(): void;
    /**
     * Ses seviyesini ayarlar
     */
    setVolume(volume: number): void;
    /**
     * Döngü modunu ayarlar
     */
    setLoopMode(mode: LoopMode): void;
    /**
     * Parçayı atlar (skip)
     */
    skip(): Promise<void>;
    /**
     * Kuyruğu temizler
     */
    clearQueue(): void;
    /**
     * Şu anki parçayı kaldırır
     */
    removeCurrentTrack(): void;
    /**
     * Kuyruktan belirli bir parçayı kaldırır
     */
    removeTrack(index: number): Track | null;
    /**
     * Olay dinleyici ekler
     */
    on(event: MusicEvent, listener: (data: MusicEventData) => void): void;
    /**
     * Olay dinleyici kaldırır
     */
    off(event: MusicEvent, listener: (data: MusicEventData) => void): void;
    /**
     * Olay tetikler
     */
    private emit;
    /**
     * Otomatik ayrılma zamanlayıcısını başlatır
     */
    private startAutoLeave;
    /**
     * Otomatik ayrılma zamanlayıcısını temizler
     */
    private clearAutoLeave;
    /**
     * Ses kanalından ayrılır
     */
    disconnect(): Promise<void>;
    /**
     * Getter'lar
     */
    getGuildId(): Snowflake;
    getVoiceChannelId(): Snowflake;
    getTextChannelId(): Snowflake | undefined;
    getQueue(): Queue;
    getCurrentTrack(): Track | null;
    getState(): PlayerState;
    isPlaying(): boolean;
    isPaused(): boolean;
    isIdle(): boolean;
}
