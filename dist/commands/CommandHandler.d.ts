import { MicupApiClient } from '../api/MicupApiClient.js';
import { ModerationService } from '../services/ModerationService.js';
import { WarnService } from '../services/WarnService.js';
import { RoleService } from '../services/RoleService.js';
import { WelcomeGoodbyeService } from '../services/WelcomeGoodbyeService.js';
import { ModLogService } from '../services/ModLogService.js';
import { AntiSpamService } from '../services/AntiSpamService.js';
import { AntiLinkService } from '../services/AntiLinkService.js';
import { BadWordsService } from '../services/BadWordsService.js';
import { LevelingService } from '../services/LevelingService.js';
import { OwoService } from '../services/OwoService.js';
import { MusicService } from '../services/MusicService.js';
import { AntiRaidService } from '../services/AntiRaidService.js';
import { CommunityService } from '../services/CommunityService.js';
import { GiveawayService } from '../services/GiveawayService.js';
import { BirthdayService } from '../services/BirthdayService.js';
import { PollService } from '../services/PollService.js';
import type { DatabaseClient } from '../database/DatabaseClient.js';
import type { FluxerChannel, FluxerGuild, FluxerInteraction, FluxerMember, FluxerMessage, FluxerPollVoteEvent, FluxerReactionEvent, FluxerRole, FluxerUser, Snowflake } from '../types/fluxer.js';
export declare class CommandHandler {
    private readonly api;
    private readonly modService;
    private readonly warnService;
    private readonly roleService;
    private readonly welcomeService;
    private readonly modLogService;
    private readonly antiSpamService;
    private readonly antiLinkService;
    private readonly owoService;
    private readonly musicService;
    private readonly badWordsService?;
    private readonly levelingService?;
    private readonly antiRaidService?;
    private readonly communityService?;
    private readonly giveawayService?;
    private readonly db?;
    private readonly birthdayService?;
    private readonly pollService?;
    private activeHelpSessions;
    private commandCooldowns;
    constructor(api: MicupApiClient, modService: ModerationService, warnService: WarnService, roleService: RoleService, welcomeService: WelcomeGoodbyeService, modLogService: ModLogService, antiSpamService: AntiSpamService, antiLinkService: AntiLinkService, owoService: OwoService, musicService: MusicService, badWordsService?: BadWordsService | undefined, levelingService?: LevelingService | undefined, antiRaidService?: AntiRaidService | undefined, communityService?: CommunityService | undefined, giveawayService?: GiveawayService | undefined, db?: DatabaseClient | undefined, birthdayService?: BirthdayService | undefined, pollService?: PollService | undefined);
    /**
     * Helper to parse user mention or ID string: <@12345>, <@!12345> or 12345
     */
    static extractUserId(raw: string): Snowflake | null;
    /**
     * Synchronous helper to parse role mention, ID or name from cached roles
     */
    static extractRole(raw: string, guild: FluxerGuild): FluxerRole | null;
    /**
     * Synchronous helper to parse channel mention, ID or name from cached channels
     */
    static extractChannel(raw: string, guild: FluxerGuild): FluxerChannel | null;
    /**
     * Asynchronous helper to resolve a member by mention (<@id>, <@!id>), ID, full tag (Name#1234),
     * or username/nickname. If not cached, fetches from API.
     */
    resolveMember(guild: FluxerGuild, raw: string): Promise<FluxerMember | null>;
    /**
     * Helper to resolve a banned user by full tag (Kortex#0164), username (Kortex),
     * discriminator (#0164 or 0164), Snowflake ID (1553179766511632384), or mention (<@id>).
     */
    resolveBannedUser(guild: FluxerGuild, raw: string): Promise<{
        id: Snowflake;
        user?: FluxerUser;
        tag: string;
    } | null>;
    /**
     * Asynchronous helper to resolve a role by mention (<@&id>), pure ID, or role name (supports spaces).
     * If not found in cache, fetches fresh roles from API.
     */
    resolveRole(guild: FluxerGuild, raw: string): Promise<FluxerRole | null>;
    /**
     * Asynchronous helper to resolve a channel by mention (<#id>), ID, or name (#name, # name, name).
     * If not found in cache, queries API to ensure newly created channels are always recognized.
     */
    resolveChannel(guild: FluxerGuild, raw: string): Promise<FluxerChannel | null>;
    /**
     * Refresh guild roles and member objects from the API to guarantee 100% accurate, live hierarchy.
     */
    private refreshHierarchy;
    /**
     * Helper to check and display remaining timeout duration for a member.
     */
    private handleTimeoutStatus;
    /**
     * Intelligently resolves the voice channel to join:
     * 1. If explicitChannelName is provided (e.g. `/join Sohbet`, `/play <link> #Sohbet`), resolves it.
     * 2. Checks active in-memory userVoiceStates.
     * 3. Fallback: Fetches fresh guild data via API to discover active voice_states.
     * 4. Smart single voice channel auto-detection: If guild has only 1 voice channel (type 2), uses it.
     */
    private resolveTargetVoiceChannel;
    handleMessage(guild: FluxerGuild, member: FluxerMember, botMember: FluxerMember, message: FluxerMessage): Promise<void>;
    /**
     * Safe chunked message sender that guarantees message content never exceeds Discord/Fluxer 2000 character limit.
     */
    private sendChunkedMessage;
    /**
     * Helper that sends a temporary notification and deletes it after N seconds,
     * keeping server chat clutter-free. Optionally deletes the invoking command message.
     */
    sendAutoExpiringMessage(channelId: Snowflake, content: string, seconds?: number, triggerMessageId?: Snowflake): Promise<FluxerMessage | null>;
    /**
     * Helper that sends a temporary error / command usage notification and deletes it
     * along with the triggering user command after N seconds, preventing chat clutter.
     */
    sendUsageError(message: FluxerMessage, content: string, seconds?: number): Promise<FluxerMessage | null>;
    /**
     * Dispatcher that delegates execution to specialized command modules
     */
    private routeCommand;
    /**
     * Helper to locate an active help session by channelId or messageId
     */
    private findHelpSession;
    /**
     * Automatically adds ◀️ and ▶️ reactions to the help message
     */
    private addHelpReactions;
    /**
     * Handles button click interaction (INTERACTION_CREATE) from Discord/Fluxer UI
     */
    handleInteraction(interaction: FluxerInteraction): Promise<boolean>;
    /**
     * Handles reaction click (MESSAGE_REACTION_ADD) as emoji button click
     */
    handleReactionAdd(event: FluxerReactionEvent, botUserId?: Snowflake): Promise<boolean>;
    /**
     * Fallback: handles text / chat emoji navigation
     */
    private handleHelpNavigation;
    /**
     * Handles reaction removal (MESSAGE_REACTION_REMOVE) for poll voting
     */
    handleReactionRemove(event: FluxerReactionEvent, botUserId?: Snowflake): Promise<boolean>;
    /**
     * Handles native poll vote add (MESSAGE_POLL_VOTE_ADD) from Discord/Micup gateway
     */
    handlePollVoteAdd(event: FluxerPollVoteEvent): Promise<boolean>;
    /**
     * Handles native poll vote remove (MESSAGE_POLL_VOTE_REMOVE) from Discord/Micup gateway
     */
    handlePollVoteRemove(event: FluxerPollVoteEvent): Promise<boolean>;
}
