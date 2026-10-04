import type { MicupApiClient } from '../api/MicupApiClient.js';
import type { DatabaseClient } from '../database/DatabaseClient.js';
import type { FluxerGuild, FluxerMember, FluxerMessage, FluxerUser, Snowflake } from '../types/fluxer.js';
export declare class LevelingService {
    private readonly api;
    private readonly db;
    private readonly textCooldowns;
    private readonly voiceSessions;
    private voiceTicker?;
    private cooldownCleanupTimer?;
    constructor(api: MicupApiClient, db: DatabaseClient);
    /**
     * Required XP formula for level progression.
     * Level 0 -> 1: 100 XP
     * Level 1 -> 2: 155 XP
     * Level 2 -> 3: 220 XP
     * Level 3 -> 4: 295 XP ...
     */
    getXpForLevel(level: number): number;
    private startVoiceTicker;
    stop(): void;
    /**
     * Tracks user voice state changes (join / leave voice channels).
     * Prevents AFK voice XP farming if user is self-deafened.
     */
    handleVoiceStateUpdate(guildId: Snowflake, userId: Snowflake, channelId: Snowflake | null, selfDeaf?: boolean): void;
    /**
     * Periodic voice XP distributor (runs every 60 seconds).
     */
    private tickVoiceXP;
    /**
     * Handles text messages and awards text XP with 60-second cooldown.
     */
    handleTextMessage(guild: FluxerGuild, member: FluxerMember, message: FluxerMessage): Promise<void>;
    /**
     * Awards roles and sends level-up announcement.
     */
    private processLevelUpRewards;
    getRank(guild: FluxerGuild, targetUser: FluxerUser): {
        success: boolean;
        message: string;
    };
    getTopXP(guild: FluxerGuild, limit?: number, invokerId?: Snowflake): Promise<{
        success: boolean;
        message: string;
    }> & {
        success: boolean;
        message: string;
    };
    toggle(guild: FluxerGuild, invoker: FluxerMember, enabled: boolean): {
        success: boolean;
        message: string;
    };
    setChannel(guild: FluxerGuild, invoker: FluxerMember, channelId: Snowflake | null): {
        success: boolean;
        message: string;
    };
    addLevelRole(guild: FluxerGuild, invoker: FluxerMember, level: number, roleId: Snowflake): {
        success: boolean;
        message: string;
    };
    removeLevelRole(guild: FluxerGuild, invoker: FluxerMember, level: number): {
        success: boolean;
        message: string;
    };
    listLevelRoles(guild: FluxerGuild): {
        success: boolean;
        message: string;
    };
}
