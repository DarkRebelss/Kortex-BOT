import { MicupApiClient } from '../api/MicupApiClient.js';
import { DatabaseClient, type WarningRecord } from '../database/DatabaseClient.js';
import type { FluxerGuild, FluxerMember, Snowflake } from '../types/fluxer.js';
export interface WarnActionOutcome {
    success: boolean;
    message: string;
    warning?: WarningRecord;
    escalationNotice?: string;
}
export declare class WarnService {
    private readonly api;
    private readonly db;
    constructor(api: MicupApiClient, db: DatabaseClient);
    warnUser(guild: FluxerGuild, invoker: FluxerMember, botMember: FluxerMember, target: FluxerMember, reason?: string): Promise<WarnActionOutcome>;
    getWarnings(guildId: Snowflake, targetUser: {
        id: Snowflake;
        username: string;
    }): string;
    removeWarning(guild: FluxerGuild, invoker: FluxerMember, warningId: number): {
        success: boolean;
        message: string;
    };
    removeWarningsByUser(guild: FluxerGuild, invoker: FluxerMember, target: FluxerMember, count?: number): {
        success: boolean;
        message: string;
        removedCount: number;
        remainingCount: number;
    };
}
