import type { MicupApiClient } from '../api/MicupApiClient.js';
import type { DatabaseClient, GiveawayRecord } from '../database/DatabaseClient.js';
import type { DiscordActionRowComponent, FluxerGuild, FluxerMember, Snowflake } from '../types/fluxer.js';
export declare class GiveawayService {
    private readonly api;
    private readonly db;
    private ticker?;
    constructor(api: MicupApiClient, db: DatabaseClient);
    private startTicker;
    stop(): void;
    /**
     * Parse human duration string (e.g. '30s', '10m', '2h', '1d') into seconds.
     */
    static parseDuration(input: string): number | null;
    /**
     * Builds action row component with 🎉 Katıl button.
     */
    buildGiveawayButton(giveawayId: number | string, participantCount: number, disabled?: boolean): DiscordActionRowComponent[];
    /**
     * Starts a new giveaway.
     */
    startGiveaway(guild: FluxerGuild, channelId: Snowflake, hostMember: FluxerMember, durationInput: string, winnerCount: number, prize: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Handles user clicking the join button.
     */
    handleJoinInteraction(giveawayId: number | null, arg2?: string | FluxerMember, messageId?: string, arg4?: FluxerMember): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Periodic check for expired active giveaways.
     */
    private checkExpiredGiveaways;
    /**
     * Concludes a giveaway, selects winners randomly, edits original message to say ÇEKİLİŞ BİTTİ and posts announcement.
     */
    concludeGiveaway(giveaway: GiveawayRecord): Promise<void>;
    /**
     * Rerolls winner(s) for an ended giveaway.
     */
    reroll(guild: FluxerGuild, invoker: FluxerMember, messageId: Snowflake): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Ends an active giveaway early.
     */
    endEarly(guild: FluxerGuild, invoker: FluxerMember, messageIdOrId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Lists guild giveaways.
     */
    list(guild: FluxerGuild): {
        success: boolean;
        message: string;
    };
}
