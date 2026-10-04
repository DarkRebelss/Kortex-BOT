export interface GuildConfigRecord {
    guild_id: string;
    welcome_channel_id: string | null;
    welcome_message: string;
    welcome_enabled: number;
    goodbye_channel_id: string | null;
    goodbye_message: string;
    goodbye_enabled: number;
    modlog_channel_id: string | null;
    autorole_id: string | null;
    autorole_enabled: number;
    antispam_enabled: number;
    antispam_max_messages: number;
    antispam_interval_seconds: number;
    antispam_punishment: string;
    antilink_enabled: number;
    antilink_whitelist: string;
    antilink_exempt_mods?: number;
    antispam_exempt_mods?: number;
    badwords_enabled?: number;
    badwords_filter_default?: number;
    badwords_custom?: string;
    badwords_exempt_mods?: number;
    badwords_punishment?: string;
    leveling_enabled?: number;
    leveling_channel_id?: string | null;
    leveling_message?: string;
    antiraid_enabled?: number;
    antiraid_threshold?: number;
    antiraid_action?: string;
    massmention_enabled?: number;
    massmention_limit?: number;
    capslock_enabled?: number;
    capslock_percentage?: number;
    tags_enabled?: number;
    bot_language: 'tr' | 'en';
    bot_channel_id?: string | null;
    bot_channel_id_2?: string | null;
    bot_channel_id_3?: string | null;
    bot_channel_id_4?: string | null;
    bot_channel_id_5?: string | null;
    owo_channel_id?: string | null;
    music_channel_id?: string | null;
    giveaway_channel_id?: string | null;
    poll_channel_id?: string | null;
    birthday_channel_id?: string | null;
    birthday_message?: string | null;
    birthday_enabled?: number;
    welcome_card_color?: string | null;
    welcome_card_accent_color?: string | null;
    welcome_card_logo_url?: string | null;
    welcome_card_slogan?: string | null;
    welcome_card_subtitle?: string | null;
    goodbye_card_color?: string | null;
    goodbye_card_accent_color?: string | null;
    goodbye_card_logo_url?: string | null;
    goodbye_card_slogan?: string | null;
    goodbye_card_subtitle?: string | null;
    created_at: string;
    updated_at: string;
}
export interface BirthdayRecord {
    guild_id: string;
    user_id: string;
    day: number;
    month: number;
    year?: number | null;
    last_celebrated_year: number;
    created_at: string;
    username?: string | null;
}
export interface WarningRecord {
    id: number;
    guild_id: string;
    user_id: string;
    moderator_id: string;
    reason: string;
    active: number;
    created_at: string;
}
export interface ModerationLogRecord {
    id: number;
    guild_id: string;
    action_type: string;
    target_user_id: string;
    moderator_id: string;
    channel_id: string | null;
    reason: string | null;
    details: string | null;
    created_at: string;
}
export interface ActiveTimeoutRecord {
    id: number;
    guild_id: string;
    user_id: string;
    username: string;
    reason: string;
    duration_text: string;
    duration_seconds: number;
    expire_unix: number;
    channel_id: string;
    message_id: string;
    message_type: 'mute' | 'info';
    created_at: string;
}
export interface TempBanRecord {
    id: number;
    guild_id: string;
    user_id: string;
    moderator_id: string;
    reason: string;
    duration_text: string;
    duration_seconds: number;
    expire_unix: number;
    created_at: string;
}
export interface PollRecord {
    id: number;
    guild_id: string;
    channel_id: string;
    message_id: string;
    author_id: string;
    question: string;
    options_json: string;
    is_closed: number;
    duration_seconds?: number | null;
    expire_unix?: number | null;
    created_at: string;
}
export interface PollVoteRecord {
    poll_id: number;
    user_id: string;
    option_index: number;
    voted_at: string;
}
export interface UserGuildRecord {
    guild_id: string;
    guild_name: string;
    user_id: string;
    updated_at: string;
}
export interface OwoUserRecord {
    user_id: string;
    cowoncy: number;
    xp: number;
    level: number;
    hp: number;
    max_hp: number;
    strength: number;
    weapon: string;
    weapon_level: number;
    ring: string | null;
    married_to: string | null;
    married_at: string | null;
    daily_reminder: number;
    last_guild_id?: string | null;
    last_guild_name?: string | null;
    pray_count: number;
    curse_count: number;
    last_hunt_unix: number;
    last_battle_unix: number;
    last_pray_unix: number;
    last_daily_unix: number;
    daily_streak: number;
    total_hunts: number;
    total_battles: number;
    battles_won: number;
    crates: number;
    lootboxes: number;
    created_at: string;
    updated_at: string;
}
export interface OwoQuestRecord {
    id: number;
    user_id: string;
    quest_date: string;
    quest_type: string;
    description: string;
    target_count: number;
    current_count: number;
    reward_cowoncy: number;
    reward_xp: number;
    claimed: number;
    created_at: string;
}
export interface OwoTeamRecord {
    user_id: string;
    slot1: string | null;
    slot2: string | null;
    slot3: string | null;
    updated_at: string;
}
export interface GuildUserLevelRecord {
    guild_id: string;
    user_id: string;
    username?: string | null;
    xp: number;
    level: number;
    message_count: number;
    voice_seconds: number;
    last_message_unix: number;
    updated_at: string;
}
export interface GuildLevelRoleRecord {
    id: number;
    guild_id: string;
    level: number;
    role_id: string;
    created_at: string;
}
export interface OwoZooRecord {
    id: number;
    user_id: string;
    animal_id: string;
    animal_name: string;
    tier: string;
    count: number;
    created_at: string;
    updated_at: string;
}
export interface AfkRecord {
    guild_id: string;
    user_id: string;
    reason: string;
    afk_since_unix: number;
}
export interface GiveawayRecord {
    id: number;
    guild_id: string;
    channel_id: string;
    message_id: string;
    prize: string;
    winner_count: number;
    end_unix: number;
    status: 'active' | 'ended';
    host_id: string;
    participants: string;
    winners: string;
    created_at: string;
}
export interface CustomTagRecord {
    id: number;
    guild_id: string;
    name: string;
    content: string;
    creator_id: string;
    created_at: string;
}
export declare class DatabaseClient {
    private db;
    private dbFilePath;
    constructor(customPath?: string);
    private init;
    private static readonly ALLOWED_GUILD_CONFIG_COLUMNS;
    private static readonly ALLOWED_OWO_USER_COLUMNS;
    private static readonly ALLOWED_LEVEL_COLUMNS;
    getGuildConfig(guildId: string): GuildConfigRecord;
    updateGuildConfig(guildId: string, updates: Partial<Omit<GuildConfigRecord, 'guild_id' | 'created_at'>>): void;
    getAllConfiguredGuildIds(): string[];
    addWarning(guildId: string, userId: string, moderatorId: string, reason: string): WarningRecord;
    getActiveWarnings(guildId: string, userId: string): WarningRecord[];
    getWarningById(guildId: string, warningId: number): WarningRecord | null;
    dismissWarning(guildId: string, warningId: number): boolean;
    dismissWarningsByUser(guildId: string, userId: string, count?: number): WarningRecord[];
    addModerationLog(guildId: string, actionType: string, targetUserId: string, moderatorId: string, reason?: string | null, channelId?: string | null, details?: Record<string, unknown> | null): ModerationLogRecord;
    getLatestModerationLog(guildId: string, targetUserId: string, actionType?: string): ModerationLogRecord | null;
    getGuildModerationLogs(guildId: string, limit?: number): ModerationLogRecord[];
    saveActiveTimeoutMessage(entry: {
        guildId: string;
        userId: string;
        username: string;
        reason: string;
        durationText: string;
        durationSeconds: number;
        expireUnix: number;
        channelId: string;
        messageId: string;
        messageType?: 'mute' | 'info';
    }): void;
    getActiveTimeoutMessages(guildId: string, userId: string): ActiveTimeoutRecord[];
    getAllActiveTimeoutMessages(): ActiveTimeoutRecord[];
    deleteActiveTimeoutMessages(guildId: string, userId: string): void;
    getOwoUser(userId: string): OwoUserRecord;
    updateOwoUser(userId: string, updates: Partial<Omit<OwoUserRecord, 'user_id' | 'created_at'>>): void;
    /**
     * Atomically transfers Cowoncy between two users using an immediate SQLite transaction.
     * Completely immune to async double-spend race conditions.
     */
    transferOwoCowoncy(senderId: string, receiverId: string, amount: number): {
        success: boolean;
        senderBalance: number;
        receiverBalance: number;
        error?: string;
    };
    getOwoZoo(userId: string): OwoZooRecord[];
    addOwoAnimals(userId: string, animals: Array<{
        id: string;
        name: string;
        emoji: string;
        tier: string;
    }>): void;
    sellOwoAnimals(userId: string, filter: string, animalPriceMap: Record<string, number>): {
        totalCount: number;
        totalCowoncy: number;
        details: string;
    };
    consumeAnimal(userId: string, animalId: string): boolean;
    getTopOwoUsersByCash(limit?: number): Array<{
        user_id: string;
        cowoncy: number;
    }>;
    getTopOwoUsersByZoo(limit?: number): Array<{
        user_id: string;
        total_animals: number;
    }>;
    getOrCreateDailyQuests(userId: string, questDate: string): OwoQuestRecord[];
    incrementQuestProgress(userId: string, questDate: string, questType: string, amount?: number): OwoQuestRecord[];
    claimQuestRewards(userId: string, questDate: string): {
        totalCowoncy: number;
        totalXp: number;
        claimedCount: number;
        claimedQuests: OwoQuestRecord[];
    };
    getOwoTeam(userId: string): OwoTeamRecord | null;
    setOwoTeam(userId: string, slot1: string | null, slot2: string | null, slot3: string | null): void;
    setMarriage(userId1: string, userId2: string): void;
    divorceMarriage(userId: string): string | null;
    setDailyReminder(userId: string, enabled: boolean): void;
    getUsersPendingDailyReminder(currentUnix: number): OwoUserRecord[];
    getGuildUserLevel(guildId: string, userId: string, initialUsername?: string): GuildUserLevelRecord;
    updateGuildUserLevel(guildId: string, userId: string, updates: Partial<Omit<GuildUserLevelRecord, 'guild_id' | 'user_id'>>): void;
    getTopGuildUserLevels(guildId: string, limit?: number, excludeUserIds?: string[]): GuildUserLevelRecord[];
    getGuildUserRank(guildId: string, userId: string): {
        rank: number;
        total: number;
    };
    getLevelRoles(guildId: string): GuildLevelRoleRecord[];
    addLevelRole(guildId: string, level: number, roleId: string): void;
    removeLevelRole(guildId: string, level: number): boolean;
    setAfk(guildId: string, userId: string, reason: string): void;
    getAfk(guildId: string, userId: string): AfkRecord | null;
    removeAfk(guildId: string, userId: string): boolean;
    createGiveaway(guildId: string, channelId: string, messageId: string, prize: string, winnerCount: number, endUnix: number, hostId: string): GiveawayRecord;
    getGiveaway(id: number): GiveawayRecord | null;
    getGiveawayByMessage(channelId: string, messageId: string): GiveawayRecord | null;
    getActiveGiveaways(): GiveawayRecord[];
    getGuildGiveaways(guildId: string): GiveawayRecord[];
    addGiveawayParticipant(id: number, userId: string): {
        success: boolean;
        total: number;
        alreadyJoined: boolean;
    };
    endGiveaway(id: number, winners: string[]): void;
    addTag(guildId: string, name: string, content: string, creatorId: string): void;
    getTag(guildId: string, name: string): CustomTagRecord | null;
    removeTag(guildId: string, name: string): boolean;
    listTags(guildId: string): CustomTagRecord[];
    clearTags(guildId: string): void;
    /**
     * Safely flushes the WAL log and creates a timestamped backup of the database.
     * Automatically cleans up backups older than 7 days (retaining at least 3 latest backups).
     */
    backupDatabase(customDestDir?: string): {
        success: boolean;
        backupPath?: string;
        error?: string;
    };
    setBirthday(guildId: string, userId: string, day: number, month: number, year?: number | null, username?: string | null): void;
    getBirthday(guildId: string, userId: string): BirthdayRecord | null;
    deleteBirthday(guildId: string, userId: string): boolean;
    getGuildBirthdays(guildId: string): BirthdayRecord[];
    getTodaysBirthdays(day: number, month: number, currentYear: number): BirthdayRecord[];
    markBirthdayCelebrated(guildId: string, userId: string, year: number): void;
    addTempBan(guildId: string, userId: string, moderatorId: string, reason: string, durationText: string, durationSeconds: number, expireUnix: number): void;
    removeTempBan(guildId: string, userId: string): void;
    getTempBan(guildId: string, userId: string): TempBanRecord | null;
    getAllActiveTempBans(): TempBanRecord[];
    createPoll(guildId: string, channelId: string, messageId: string, authorId: string, question: string, options: string[], durationSeconds?: number | null, expireUnix?: number | null): number;
    updatePollMessageId(pollId: number, messageId: string): void;
    getPoll(pollId: number): PollRecord | null;
    getPollByMessageId(messageId: string): PollRecord | null;
    getActiveExpiringPolls(nowUnix?: number): PollRecord[];
    getOpenPollsForGuild(guildId: string): PollRecord[];
    votePoll(pollId: number, userId: string, optionIndex: number): {
        changed: boolean;
        optionIndex: number;
    };
    getPollVotes(pollId: number): Array<{
        option_index: number;
        count: number;
    }>;
    getUserPollVote(pollId: number, userId: string): number | null;
    closePoll(pollId: number): void;
    trackUserGuild(guildId: string, guildName: string, userId: string): void;
    getUserCommonGuilds(userId: string): Array<{
        guild_id: string;
        guild_name: string;
    }>;
    saveUserName(userId: string, username: string, displayName?: string | null): void;
    getUserName(userId: string): {
        username: string;
        display_name: string | null;
    } | null;
    findUserIdByUsername(username: string): string | null;
    close(): void;
}
