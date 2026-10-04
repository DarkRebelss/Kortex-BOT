import type { FluxerBan, FluxerChannel, FluxerGuild, FluxerMember, FluxerMessage, FluxerRole, FluxerUser, Snowflake, DiscordPollCreate } from '../types/fluxer.js';
export interface GatewayBotInfo {
    url: string;
    shards: number;
    session_start_limit: {
        total: number;
        remaining: number;
        reset_after: number;
        max_concurrency: number;
    };
}
export declare class MicupApiClient {
    private baseUrl;
    private token;
    constructor(customBaseUrl?: string, customToken?: string);
    private request;
    getGatewayBot(): Promise<GatewayBotInfo>;
    getCurrentUser(): Promise<FluxerUser>;
    getUser(userId: Snowflake): Promise<FluxerUser>;
    getGuild(guildId: Snowflake): Promise<FluxerGuild>;
    getGuildRoles(guildId: Snowflake): Promise<FluxerRole[]>;
    getGuildMembers(guildId: Snowflake, limit?: number): Promise<FluxerMember[]>;
    getGuildMember(guildId: Snowflake, userId: Snowflake): Promise<FluxerMember>;
    updateGuildMember(guildId: Snowflake, userId: Snowflake, data: {
        nick?: string | null;
        roles?: Snowflake[];
        communication_disabled_until?: string | null;
        timeout_reason?: string | null;
    }, auditReason?: string): Promise<FluxerMember>;
    addMemberRole(guildId: Snowflake, userId: Snowflake, roleId: Snowflake, auditReason?: string): Promise<void>;
    removeMemberRole(guildId: Snowflake, userId: Snowflake, roleId: Snowflake, auditReason?: string): Promise<void>;
    banMember(guildId: Snowflake, userId: Snowflake, reason?: string, deleteMessageSeconds?: number): Promise<void>;
    getGuildBans(guildId: Snowflake): Promise<FluxerBan[]>;
    getGuildBan(guildId: Snowflake, userId: Snowflake): Promise<FluxerBan>;
    unbanMember(guildId: Snowflake, userId: Snowflake, reason?: string): Promise<void>;
    kickMember(guildId: Snowflake, userId: Snowflake, reason?: string): Promise<void>;
    timeoutMember(guildId: Snowflake, userId: Snowflake, durationSeconds: number, reason?: string): Promise<FluxerMember>;
    untimeoutMember(guildId: Snowflake, userId: Snowflake, reason?: string): Promise<FluxerMember>;
    getGuildChannels(guildId: Snowflake): Promise<FluxerChannel[]>;
    getChannel(channelId: Snowflake): Promise<FluxerChannel>;
    modifyChannel(channelId: Snowflake, data: {
        name?: string;
        topic?: string | null;
        position?: number;
        rate_limit_per_user?: number | null;
        parent_id?: Snowflake | null;
        permission_overwrites?: any[];
        [key: string]: unknown;
    }, auditReason?: string): Promise<FluxerChannel>;
    editChannelPermissions(channelId: Snowflake, overwriteId: Snowflake, data: {
        type: number;
        allow?: string;
        deny?: string;
    }, auditReason?: string): Promise<void>;
    deleteChannelPermission(channelId: Snowflake, overwriteId: Snowflake, auditReason?: string): Promise<void>;
    createDM(recipientId: Snowflake): Promise<FluxerChannel>;
    sendDirectMessage(recipientId: Snowflake, content: string, extra?: {
        tts?: boolean;
        embeds?: Array<any>;
        components?: any[];
    }): Promise<FluxerMessage>;
    sendMessage(channelId: Snowflake, content: string, extra?: {
        tts?: boolean;
        embeds?: Array<{
            title?: string;
            description?: string;
            color?: number;
            url?: string;
            timestamp?: string;
            author?: {
                name: string;
                icon_url?: string;
                url?: string;
            };
            thumbnail?: {
                url: string;
            };
            image?: {
                url: string;
            };
            footer?: {
                text: string;
                icon_url?: string;
            };
            fields?: Array<{
                name: string;
                value: string;
                inline?: boolean;
            }>;
        }>;
        files?: Array<{
            name: string;
            buffer: Buffer | Uint8Array;
            contentType?: string;
        }>;
        components?: any[];
        poll?: DiscordPollCreate;
    }): Promise<FluxerMessage>;
    expirePoll(channelId: Snowflake, messageId: Snowflake): Promise<FluxerMessage>;
    getMessages(channelId: Snowflake, limit?: number, before?: Snowflake): Promise<FluxerMessage[]>;
    deleteMessage(channelId: Snowflake, messageId: Snowflake, reason?: string): Promise<void>;
    editMessage(channelId: Snowflake, messageId: Snowflake, content: string, extra?: {
        embeds?: Array<any>;
        components?: any[];
        files?: Array<{
            name: string;
            buffer: Buffer | Uint8Array;
            contentType?: string;
        }>;
    }): Promise<FluxerMessage>;
    bulkDeleteMessages(channelId: Snowflake, messageIds: Snowflake[], reason?: string): Promise<void>;
    addReaction(channelId: Snowflake, messageId: Snowflake, emoji: string): Promise<void>;
    deleteUserReaction(channelId: Snowflake, messageId: Snowflake, emoji: string, userId: Snowflake): Promise<void>;
    createInteractionResponse(interactionId: Snowflake, interactionToken: string, response: {
        type: number;
        data?: {
            content?: string;
            embeds?: any[];
            components?: any[];
            flags?: number;
        };
    }): Promise<void>;
    updateCurrentVoiceState(guildId: Snowflake, channelId: Snowflake | null, suppress?: boolean): Promise<void>;
}
