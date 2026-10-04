import { MicupApiClient } from '../api/MicupApiClient.js';
import { DatabaseClient } from '../database/DatabaseClient.js';
import { ModerationService } from './ModerationService.js';
import { ModLogService } from './ModLogService.js';
import type { FluxerGuild, FluxerMember, FluxerMessage } from '../types/fluxer.js';
export declare class AntiSpamService {
    private readonly api;
    private readonly db;
    private readonly modService?;
    private readonly modLogService?;
    private trackers;
    private cleanupTimer?;
    constructor(api: MicupApiClient, db: DatabaseClient, modService?: ModerationService | undefined, modLogService?: ModLogService | undefined);
    stop(): void;
    /**
     * Process an incoming message and check for spam violations.
     * Returns true if message was spam and handled.
     */
    handleMessage(guild: FluxerGuild, member: FluxerMember, message: FluxerMessage): Promise<boolean>;
    configure(guild: FluxerGuild, invoker: FluxerMember, options: {
        enabled?: boolean;
        maxMessages?: number;
        intervalSeconds?: number;
        exemptMods?: boolean;
    }): {
        success: boolean;
        message: string;
    };
    getStatus(guild: FluxerGuild): {
        success: boolean;
        message: string;
    };
}
