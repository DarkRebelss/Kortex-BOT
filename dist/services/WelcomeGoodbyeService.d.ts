import { MicupApiClient } from '../api/MicupApiClient.js';
import { DatabaseClient } from '../database/DatabaseClient.js';
import type { FluxerGuild, FluxerMember, FluxerUser, Snowflake } from '../types/fluxer.js';
export declare class WelcomeGoodbyeService {
    private readonly api;
    private readonly db;
    constructor(api: MicupApiClient, db: DatabaseClient);
    /**
     * Format message template replacing dynamic placeholders:
     * {user}, {username}, {id}, {memberCount}, {guildName}
     */
    static formatTemplate(template: string, user: FluxerUser, guild: FluxerGuild, memberCount?: number): string;
    onMemberJoin(guild: FluxerGuild, member: FluxerMember): Promise<void>;
    onMemberLeave(guild: FluxerGuild, user: FluxerUser, member?: FluxerMember): Promise<void>;
    /**
     * Resolves the user's avatar URL from member avatar, user avatar/avatar_hash,
     * or fetches fresh profile if needed, falling back to Micup default avatar index.
     */
    resolveAvatarUrl(user: FluxerUser, member?: FluxerMember, guildId?: Snowflake): Promise<string>;
    /**
     * Sends the rich embed welcome card message matching MAXGuard UI layout.
     */
    sendWelcomeCardMessage(channelId: Snowflake, user: FluxerUser, guild: FluxerGuild, memberCount?: number, prefixNotice?: string, member?: FluxerMember): Promise<void>;
    /**
     * Sends the rich embed goodbye message.
     */
    sendGoodbyeCardMessage(channelId: Snowflake, user: FluxerUser, guild: FluxerGuild, memberCount?: number, prefixNotice?: string, member?: FluxerMember): Promise<void>;
    setWelcomeChannel(guild: FluxerGuild, invoker: FluxerMember, channelId: Snowflake, channelName: string): {
        success: boolean;
        message: string;
    };
    setWelcomeMessage(guild: FluxerGuild, invoker: FluxerMember, messageTemplate: string): {
        success: boolean;
        message: string;
    };
    toggleWelcome(guild: FluxerGuild, invoker: FluxerMember, enable: boolean): {
        success: boolean;
        message: string;
    };
    setGoodbyeChannel(guild: FluxerGuild, invoker: FluxerMember, channelId: Snowflake, channelName: string): {
        success: boolean;
        message: string;
    };
    setGoodbyeMessage(guild: FluxerGuild, invoker: FluxerMember, messageTemplate: string): {
        success: boolean;
        message: string;
    };
    toggleGoodbye(guild: FluxerGuild, invoker: FluxerMember, enable: boolean): {
        success: boolean;
        message: string;
    };
    setCardDesign(type: 'welcome' | 'goodbye', guild: FluxerGuild, invoker: FluxerMember, updates: {
        color?: string | null;
        accentColor?: string | null;
        subtitle?: string | null;
        slogan?: string | null;
        logoUrl?: string | null;
    }): {
        success: boolean;
        message: string;
    };
    resetCardDesign(type: 'welcome' | 'goodbye', guild: FluxerGuild, invoker: FluxerMember): {
        success: boolean;
        message: string;
    };
    getCardDesignStatus(type: 'welcome' | 'goodbye', guild: FluxerGuild): string;
}
