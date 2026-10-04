import type { Snowflake } from '../types/fluxer.js';
export interface VoiceServerPayload {
    guild_id: Snowflake;
    channel_id?: Snowflake;
    endpoint: string;
    token: string;
    connection_id?: string;
}
export declare class MicupVoiceClient {
    private sessions;
    private guildVolumes;
    private guildFilters;
    private streamUrlCache;
    getCachedStreamUrl(key: string): string | undefined;
    setCachedStreamUrl(key: string, directUrl: string, ttlMs?: number): void;
    setVolume(guildId: Snowflake, volumePercent: number): void;
    getVolume(guildId: Snowflake): number;
    setAudioFilter(guildId: Snowflake, filterStr?: string): void;
    getAudioFilter(guildId: Snowflake): string | undefined;
    /**
     * Connects to the LiveKit voice room using the server credentials from Gateway VOICE_SERVER_UPDATE.
     */
    connect(serverData: VoiceServerPayload): Promise<void>;
    /**
     * Dispatches PCM audio chunks from queue to LiveKit AudioSource at precise 20ms intervals.
     * Handles backpressure and ensures all buffered audio plays out completely before signaling track end.
     */
    private startAudioDispatcher;
    /**
     * Streams audio from a URL (YouTube, SoundCloud, direct audio, or radio stream) into the LiveKit room.
     * Supports zero-wait cached stream resolution and seamless hot-swapping for filters & bass changes.
     */
    playAudio(guildId: Snowflake, inputUrl: string, onEnded?: () => void, seekSeconds?: number, isHotSwap?: boolean): Promise<string | undefined>;
    pauseAudio(guildId: Snowflake): void;
    resumeAudio(guildId: Snowflake): void;
    stopAudio(guildId: Snowflake): void;
    disconnect(guildId: Snowflake): void;
    disconnectAll(): void;
    isConnected(guildId: Snowflake): boolean;
}
