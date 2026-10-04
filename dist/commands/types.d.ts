import type { MicupApiClient } from '../api/MicupApiClient.js';
import type { ModerationService } from '../services/ModerationService.js';
import type { WarnService } from '../services/WarnService.js';
import type { RoleService } from '../services/RoleService.js';
import type { WelcomeGoodbyeService } from '../services/WelcomeGoodbyeService.js';
import type { ModLogService } from '../services/ModLogService.js';
import type { AntiSpamService } from '../services/AntiSpamService.js';
import type { AntiLinkService } from '../services/AntiLinkService.js';
import type { BadWordsService } from '../services/BadWordsService.js';
import type { LevelingService } from '../services/LevelingService.js';
import type { OwoService } from '../services/OwoService.js';
import type { MusicService } from '../services/MusicService.js';
import type { AntiRaidService } from '../services/AntiRaidService.js';
import type { CommunityService } from '../services/CommunityService.js';
import type { GiveawayService } from '../services/GiveawayService.js';
import type { BirthdayService } from '../services/BirthdayService.js';
import type { PollService } from '../services/PollService.js';
import type { DatabaseClient } from '../database/DatabaseClient.js';
import type { FluxerChannel, FluxerGuild, FluxerMember, FluxerMessage, FluxerRole, FluxerUser, Snowflake } from '../types/fluxer.js';
export interface CommandHelpers {
    resolveMember: (guild: FluxerGuild, raw: string) => Promise<FluxerMember | null>;
    resolveBannedUser: (guild: FluxerGuild, raw: string) => Promise<{
        id: Snowflake;
        user?: FluxerUser;
        tag: string;
    } | null>;
    resolveRole: (guild: FluxerGuild, raw: string) => Promise<FluxerRole | null>;
    resolveChannel: (guild: FluxerGuild, raw: string) => Promise<FluxerChannel | null>;
    refreshHierarchy: (guild: FluxerGuild, invoker: FluxerMember, botMember: FluxerMember, targetMember?: FluxerMember | null) => Promise<{
        invoker: FluxerMember;
        botMember: FluxerMember;
        targetMember: FluxerMember | null;
    }>;
    handleTimeoutStatus: (guild: FluxerGuild, invoker: FluxerMember, channelId: Snowflake, targetRaw?: string) => Promise<void>;
    resolveTargetVoiceChannel: (guild: FluxerGuild, invoker: FluxerMember, explicitChannelName?: string) => Promise<{
        channelId: Snowflake;
        channelName: string;
    } | null>;
    sendChunkedMessage: (channelId: Snowflake, text: string) => Promise<void>;
    sendAutoExpiringMessage: (channelId: Snowflake, content: string, seconds?: number, triggerMessageId?: Snowflake) => Promise<FluxerMessage | null>;
    sendUsageError: (message: FluxerMessage, content: string, seconds?: number) => Promise<FluxerMessage | null>;
    showHelp: (channelId: Snowflake, userId: Snowflake, pageNum?: number, mode?: 'user' | 'admin') => Promise<void>;
}
export interface CommandContext {
    commandName: string;
    args: string[];
    guild: FluxerGuild;
    invoker: FluxerMember;
    botMember: FluxerMember;
    message: FluxerMessage;
    api: MicupApiClient;
    modService: ModerationService;
    warnService: WarnService;
    roleService: RoleService;
    welcomeService: WelcomeGoodbyeService;
    modLogService: ModLogService;
    antiSpamService: AntiSpamService;
    antiLinkService: AntiLinkService;
    owoService: OwoService;
    musicService: MusicService;
    badWordsService?: BadWordsService;
    levelingService?: LevelingService;
    antiRaidService?: AntiRaidService;
    communityService?: CommunityService;
    giveawayService?: GiveawayService;
    db?: DatabaseClient;
    birthdayService?: BirthdayService;
    pollService?: PollService;
    helpers: CommandHelpers;
}
