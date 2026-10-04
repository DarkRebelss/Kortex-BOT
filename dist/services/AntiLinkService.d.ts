import { MicupApiClient } from '../api/MicupApiClient.js';
import { DatabaseClient } from '../database/DatabaseClient.js';
import type { FluxerGuild, FluxerMember, FluxerMessage } from '../types/fluxer.js';
export declare class AntiLinkService {
    private readonly api;
    private readonly db;
    constructor(api: MicupApiClient, db: DatabaseClient);
    /**
     * Process message for unauthorized links.
     * Returns true if link was detected and deleted.
     */
    handleMessage(guild: FluxerGuild, member: FluxerMember, message: FluxerMessage): Promise<boolean>;
    toggle(guild: FluxerGuild, invoker: FluxerMember, enable: boolean): {
        success: boolean;
        message: string;
    };
    setExemptMods(guild: FluxerGuild, invoker: FluxerMember, exempt: boolean): {
        success: boolean;
        message: string;
    };
    getStatus(guild: FluxerGuild): {
        success: boolean;
        message: string;
    };
    addWhitelistDomain(guild: FluxerGuild, invoker: FluxerMember, domain: string): {
        success: boolean;
        message: string;
    };
    removeWhitelistDomain(guild: FluxerGuild, invoker: FluxerMember, domain: string): {
        success: boolean;
        message: string;
    };
}
