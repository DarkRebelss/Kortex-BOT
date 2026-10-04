import { Player } from './Player.js';
import type { PlayerOptions, ResolveResult, VoiceConnection, MusicApiClient, Snowflake } from './types.js';
/**
 * Müzik sistemini yöneten ana sınıf
 */
export declare class MusicManager {
    private players;
    private spotifyResolver;
    private voiceConnection;
    private apiClient;
    constructor(voiceConnection: VoiceConnection, apiClient: MusicApiClient);
    /**
     * URL veya arama terimini çözer
     */
    resolve(query: string, requester: Snowflake): Promise<ResolveResult>;
    /**
     * YouTube URL'sini çözer
     */
    private resolveYouTube;
    /**
     * YouTube'da arama yapar
     */
    private searchYouTube;
    /**
     * SoundCloud URL'sini çözer
     */
    private resolveSoundCloud;
    /**
     * Sunucu için player oluşturur veya mevcut olanı döndürür
     */
    getOrCreatePlayer(options: PlayerOptions): Player;
    /**
     * Sunucu için player'ı döndürür
     */
    getPlayer(guildId: Snowflake): Player | undefined;
    /**
     * Sunucu için player'ı siler
     */
    deletePlayer(guildId: Snowflake): void;
    /**
     * Track başlangıç bildirimi gönderir
     */
    private sendTrackStartNotification;
    /**
     * Track bitiş bildirimi gönderir
     */
    private sendTrackEndNotification;
    /**
     * Track hata bildirimi gönderir
     */
    private sendTrackErrorNotification;
    /**
     * Kuyruk boş bildirimi gönderir
     */
    private sendQueueEmptyNotification;
    /**
     * Süreyi formatlar
     */
    private formatDuration;
    /**
     * Tüm player'ları temizler
     */
    destroy(): void;
}
