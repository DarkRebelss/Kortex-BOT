import { MicupApiClient } from '../api/MicupApiClient.js';
import { DatabaseClient } from '../database/DatabaseClient.js';
import type { FluxerGuild, FluxerMember, FluxerRole, Snowflake } from '../types/fluxer.js';
export declare class RoleService {
    private readonly api;
    private readonly db;
    constructor(api: MicupApiClient, db: DatabaseClient);
    addRole(guild: FluxerGuild, invoker: FluxerMember, botMember: FluxerMember, target: FluxerMember, role: FluxerRole): Promise<{
        success: boolean;
        message: string;
    }>;
    removeRole(guild: FluxerGuild, invoker: FluxerMember, botMember: FluxerMember, target: FluxerMember, role: FluxerRole): Promise<{
        success: boolean;
        message: string;
    }>;
    setAutorole(guild: FluxerGuild, invoker: FluxerMember, botMember: FluxerMember, role: FluxerRole): {
        success: boolean;
        message: string;
    };
    removeAutorole(guild: FluxerGuild, invoker: FluxerMember): {
        success: boolean;
        message: string;
    };
    getAutoroleStatus(guild: FluxerGuild): string;
    /**
     * Handle auto-role when a new member joins (GUILD_MEMBER_ADD)
     */
    handleMemberJoin(guildId: Snowflake, userId: Snowflake): Promise<void>;
}
