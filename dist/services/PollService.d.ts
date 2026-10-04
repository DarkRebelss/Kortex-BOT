import type { MicupApiClient } from '../api/MicupApiClient.js';
import type { DatabaseClient, PollRecord } from '../database/DatabaseClient.js';
import type { FluxerGuild, FluxerMember } from '../types/fluxer.js';
export declare class PollService {
    private readonly api;
    private readonly db;
    private ticker?;
    constructor(api: MicupApiClient, db: DatabaseClient);
    private startTicker;
    stop(): void;
    /**
     * Periodic check for polls whose duration has expired.
     */
    checkExpiredPolls(): Promise<void>;
    /**
     * Concludes a poll: updates the original embed to closed state and announces the winner in channel.
     */
    concludePoll(poll: PollRecord): Promise<void>;
    /**
     * Manually ends a poll early by ID or message ID.
     */
    endPoll(guild: FluxerGuild, invoker: FluxerMember, targetId: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
