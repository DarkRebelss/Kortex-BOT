import type { MicupApiClient } from '../api/MicupApiClient.js';
import type { DatabaseClient, CustomTagRecord } from '../database/DatabaseClient.js';
import { ModLogService } from './ModLogService.js';
import type { FluxerGuild, FluxerMember, FluxerMessage } from '../types/fluxer.js';
export declare class CommunityService {
    private readonly api;
    private readonly db;
    private readonly modLogService?;
    constructor(api: MicupApiClient, db: DatabaseClient, modLogService?: ModLogService | undefined);
    /**
     * Sets user as AFK with a reason.
     */
    setAfk(guild: FluxerGuild, member: FluxerMember, reason: string): {
        success: boolean;
        message: string;
    };
    /**
     * Checks if an incoming message speaker was previously AFK.
     * If yes, clears AFK status and sends welcome back message.
     */
    handleAfkSpeaker(guild: FluxerGuild, member: FluxerMember, message: FluxerMessage): Promise<boolean>;
    /**
     * Checks if message mentions any user who is currently AFK.
     * If yes, notifies the channel.
     */
    handleAfkMentions(guild: FluxerGuild, message: FluxerMessage): Promise<void>;
    private tagCooldowns;
    /**
     * Checks if the tag / auto-responder system is enabled for the guild (defaults to true).
     */
    isTagsEnabled(guildId: string): boolean;
    /**
     * Toggles the tag / auto-responder system on or off.
     */
    setTagsEnabled(guild: FluxerGuild, invoker: FluxerMember, enabled: boolean): {
        success: boolean;
        message: string;
    };
    /**
     * Gets the current status of the auto-responder system.
     */
    getStatus(guild: FluxerGuild): {
        success: boolean;
        message: string;
    };
    /**
     * Formats dynamic template placeholders:
     * - User: {user}, {mention}, {username}, {id}, {userId}
     * - Server: {server}, {guild}, {guildName}, {serverName}, {memberCount}, {owner}
     * - Channel: {channel}, {channelId}
     * - Time & Date: {date}, {time}, {timestamp}
     * - Random: {random:min-max}, {random}
     */
    static formatTagTemplate(template: string, guild: FluxerGuild, member: FluxerMember, channelId?: string): string;
    addTag(guild: FluxerGuild, invoker: FluxerMember, name: string, content: string): {
        success: boolean;
        message: string;
    };
    removeTag(guild: FluxerGuild, invoker: FluxerMember, name: string): {
        success: boolean;
        message: string;
    };
    listTags(guild: FluxerGuild): {
        success: boolean;
        message: string;
    };
    getTag(guild: FluxerGuild, name: string): CustomTagRecord | null;
    /**
     * Automatically handles chat messages matching custom tags without requiring `/` or `!`.
     * Also handles classic `!tag` triggers for backwards compatibility.
     */
    handleAutoResponse(guild: FluxerGuild, member: FluxerMember, message: FluxerMessage): Promise<boolean>;
    handleMassMention(guild: FluxerGuild, member: FluxerMember, message: FluxerMessage): Promise<boolean>;
    handleCapslock(guild: FluxerGuild, member: FluxerMember, message: FluxerMessage): Promise<boolean>;
}
