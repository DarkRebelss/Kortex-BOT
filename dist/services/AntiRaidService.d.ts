import type { MicupApiClient } from '../api/MicupApiClient.js';
import type { DatabaseClient } from '../database/DatabaseClient.js';
import { ModLogService } from './ModLogService.js';
import type { FluxerGuild, FluxerMember } from '../types/fluxer.js';
export declare class AntiRaidService {
    private readonly api;
    private readonly db;
    private readonly modLogService?;
    private trackers;
    private readonly RAID_WINDOW_MS;
    private readonly RAID_LOCK_DURATION_MS;
    constructor(api: MicupApiClient, db: DatabaseClient, modLogService?: ModLogService | undefined);
    /**
     * Evaluates incoming member join against raid thresholds.
     * Returns true if the join was part of a raid and handled (kicked or timed out).
     */
    handleMemberJoin(guild: FluxerGuild, member: FluxerMember): Promise<{
        isRaid: boolean;
        actionTaken?: 'kick' | 'timeout';
    }>;
    private punishRaidMember;
    toggle(guild: FluxerGuild, invoker: FluxerMember, enable: boolean): {
        success: boolean;
        message: string;
    };
    setThreshold(guild: FluxerGuild, invoker: FluxerMember, count: number): {
        success: boolean;
        message: string;
    };
    setAction(guild: FluxerGuild, invoker: FluxerMember, action: string): {
        success: boolean;
        message: string;
    };
    getStatus(guild: FluxerGuild): {
        success: boolean;
        message: string;
    };
}
