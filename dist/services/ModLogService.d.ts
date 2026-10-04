import { MicupApiClient } from '../api/MicupApiClient.js';
import { DatabaseClient } from '../database/DatabaseClient.js';
import type { FluxerGuild, FluxerMember, Snowflake } from '../types/fluxer.js';
export interface LogEntryPayload {
    action: string;
    target: {
        id: Snowflake;
        username: string;
    };
    moderator?: {
        id: Snowflake;
        username: string;
    };
    reason?: string | null;
    channelId?: Snowflake | null;
    extraDetails?: Record<string, unknown>;
}
export declare class ModLogService {
    private readonly api;
    private readonly db;
    constructor(api: MicupApiClient, db: DatabaseClient);
    setLogChannel(guild: FluxerGuild, invoker: FluxerMember, channelId: Snowflake, channelName: string): {
        success: boolean;
        message: string;
    };
    sendModLog(guildId: Snowflake, entry: LogEntryPayload): Promise<void>;
}
