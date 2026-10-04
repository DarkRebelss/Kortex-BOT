import { MusicManager } from './MusicManager.js';
import type { PlayerOptions, Snowflake, LoopMode } from './types.js';
/**
 * Müzik komutları için handler sınıfı
 */
export declare class MusicCommands {
    private musicManager;
    constructor(musicManager: MusicManager);
    /**
     * /play komutu
     */
    handlePlay(options: PlayerOptions, query: string, requester: Snowflake): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * /skip komutu
     */
    handleSkip(guildId: Snowflake): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * /stop komutu
     */
    handleStop(guildId: Snowflake): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * /pause komutu
     */
    handlePause(guildId: Snowflake): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * /resume komutu
     */
    handleResume(guildId: Snowflake): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * /queue komutu
     */
    handleQueue(guildId: Snowflake, page?: number): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * /nowplaying komutu
     */
    handleNowPlaying(guildId: Snowflake): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * /volume komutu
     */
    handleVolume(guildId: Snowflake, volume: number): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * /loop komutu
     */
    handleLoop(guildId: Snowflake, mode: LoopMode): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Süreyi formatlar
     */
    private formatDuration;
}
