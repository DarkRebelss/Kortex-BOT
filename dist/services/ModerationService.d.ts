import { MicupApiClient } from '../api/MicupApiClient.js';
import { DatabaseClient } from '../database/DatabaseClient.js';
import type { FluxerChannel, FluxerGuild, FluxerMember, Snowflake } from '../types/fluxer.js';
export interface CommandExecutionResult {
    success: boolean;
    message: string;
    data?: any;
}
export interface ActiveTimeoutMessageRef {
    channelId: Snowflake;
    messageId: Snowflake;
    type: 'mute' | 'info';
}
export interface ActiveTimeoutEntry {
    guildId: Snowflake;
    userId: Snowflake;
    username: string;
    reason: string;
    durationText: string;
    expireUnix: number;
    timer: NodeJS.Timeout;
    messageRefs: ActiveTimeoutMessageRef[];
}
export declare class ModerationService {
    private readonly api;
    private readonly db;
    private readonly activeTimeouts;
    private readonly activeTempBans;
    constructor(api: MicupApiClient, db: DatabaseClient);
    private restoreActiveTempBans;
    private onTempBanExpired;
    private restoreActiveTimeouts;
    /**
     * Parse duration string like 10s, 10sn, 10, 5m, 5dk, 1h, 1saat, 1d, 7d into seconds.
     * If only digits provided (e.g. "10"), defaults to seconds.
     */
    static parseDuration(input: string): number | null;
    /**
     * Format seconds into a friendly Turkish description.
     */
    static formatDuration(seconds: number): string;
    ban(guild: FluxerGuild, invoker: FluxerMember, botMember: FluxerMember, target: FluxerMember, reason?: string, durationInput?: string): Promise<CommandExecutionResult>;
    unban(guild: FluxerGuild, invoker: FluxerMember, botMember: FluxerMember, targetUserId: Snowflake, targetTag?: string): Promise<CommandExecutionResult>;
    kick(guild: FluxerGuild, invoker: FluxerMember, botMember: FluxerMember, target: FluxerMember, reason?: string): Promise<CommandExecutionResult>;
    timeout(guild: FluxerGuild, invoker: FluxerMember, botMember: FluxerMember, target: FluxerMember, durationInput: string, reason?: string): Promise<CommandExecutionResult>;
    untimeout(guild: FluxerGuild, invoker: FluxerMember, botMember: FluxerMember, target: FluxerMember): Promise<CommandExecutionResult>;
    /**
     * Check if a member has an active timeout/mute and return detailed remaining countdown.
     */
    getTimeoutStatus(guild: FluxerGuild, target: FluxerMember): Promise<CommandExecutionResult>;
    /**
     * Check if a member has an active timeout registered in memory or DB.
     */
    hasActiveTimeout(guildId: Snowflake, userId: Snowflake): boolean;
    /**
     * Register a sent timeout/mute message to automatically edit it when the timeout expires.
     */
    registerTimeoutMessage(params: {
        guildId: Snowflake;
        userId: Snowflake;
        username: string;
        reason: string;
        durationText: string;
        durationSeconds: number;
        expireUnix: number;
        channelId: Snowflake;
        messageId: Snowflake;
    }): void;
    /**
     * Register an info/status check message to also update when the penalty finishes.
     */
    registerInfoMessage(guildId: Snowflake, userId: Snowflake, channelId: Snowflake, messageId: Snowflake): void;
    /**
     * Handler when a timeout's timer reaches 0 naturally.
     */
    onTimeoutExpired(guildId: Snowflake, userId: Snowflake): Promise<void>;
    /**
     * Handler when a timeout is manually removed before the timer expires.
     */
    handleEarlyUntimeout(guildId: Snowflake, userId: Snowflake, moderatorUsername: string): Promise<void>;
    clearMessages(guild: FluxerGuild, channelId: Snowflake, invoker: FluxerMember, botMember: FluxerMember, amount: number, targetUserId?: Snowflake): Promise<CommandExecutionResult>;
    lockChannel(guild: FluxerGuild, invoker: FluxerMember, botMember: FluxerMember, channel: FluxerChannel, reason?: string): Promise<CommandExecutionResult>;
    unlockChannel(guild: FluxerGuild, invoker: FluxerMember, botMember: FluxerMember, channel: FluxerChannel, reason?: string): Promise<CommandExecutionResult>;
    setSlowmode(guild: FluxerGuild, invoker: FluxerMember, botMember: FluxerMember, channel: FluxerChannel, seconds: number, reason?: string): Promise<CommandExecutionResult>;
}
