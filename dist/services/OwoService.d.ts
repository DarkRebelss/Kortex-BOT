import type { DatabaseClient, OwoUserRecord } from '../database/DatabaseClient.js';
import type { MicupApiClient } from '../api/MicupApiClient.js';
import type { FluxerGuild, FluxerMember, FluxerMessage, FluxerUser, Snowflake } from '../types/fluxer.js';
export declare class OwoService {
    private api;
    private db;
    private activeBlackjacks;
    private animalPriceMap;
    private gamblingCooldowns;
    private pendingProposals;
    private userLastChannel;
    private userLastGuild;
    private remindedUsers;
    private readonly MAX_GAMBLE_BET;
    private readonly MAX_GIVE_AMOUNT;
    constructor(api: MicupApiClient, db: DatabaseClient);
    private sendAutoExpiring;
    /**
     * Checks users whose 24-hour daily reward is ready and sends DM notifications mentioning the community.
     */
    checkDailyReminders(): Promise<void>;
    private checkGamblingCooldown;
    /**
     * Sends a random cute OwO face expression when /owo or /uwu is used without arguments.
     */
    sendExpression(channelId: Snowflake): Promise<void>;
    handleMessage(guild: FluxerGuild, member: FluxerMember, message: FluxerMessage): Promise<boolean>;
    /**
     * Resolves a target member by mention (<@id>), Snowflake ID, username, nickname,
     * or by inspecting message.mentions. If not cached, fetches from API.
     */
    resolveMember(guild: FluxerGuild, raw: string, message?: FluxerMessage): Promise<FluxerMember | null>;
    resolveAvatarUrl(user: FluxerUser, member?: FluxerMember, guildId?: Snowflake): Promise<string>;
    resolveBannerUrl(user: FluxerUser, member?: FluxerMember, guildId?: Snowflake): Promise<string | null>;
    /**
     * Returns the XP required to complete the given level and advance to the next.
     * Level 1: 100 XP
     * Level 2: 200 XP
     * Level 3: 300 XP
     * Level N: N * 100 XP
     */
    getXpNeededForLevel(level: number): number;
    /**
     * Balanced OwO level rewards curve:
     * Level 2: 250 Cowoncy, 1 Lootbox, 1 Crate
     * Level 3: 300 Cowoncy, 1 Lootbox, 1 Crate
     * Level 4: 400 Cowoncy, 1 Lootbox, 1 Crate
     * Level 5: 550 Cowoncy, 2 Lootboxes, 2 Crates (Milestone)
     * Higher levels scale smoothly up without inflating the game economy.
     */
    calculateLevelRewards(level: number): {
        cowoncy: number;
        lootboxes: number;
        crates: number;
    };
    /**
     * Awards XP, checks for level-ups, updates user rewards/stats in database,
     * resets current XP per level (carrying over remainder), and sends a visual Level Up card.
     * Rewards scale per level gained:
     * - Cowoncy: Level 2 -> 250, Level 3 -> 300, Level 4 -> 400... gradual progression
     * - Lootboxes: 1-5 boxes based on level and milestone
     * - Weapon Crates: 1-4 crates based on level and milestone
     * - Max HP: +15 per level
     * - Strength: +3 per level
     * - HP fully restored on level up
     */
    applyXpAndCheckLevelUp(guild: FluxerGuild, member: FluxerMember, channelId: string, user: OwoUserRecord, xpGain: number, additionalUpdates?: Partial<OwoUserRecord>): Promise<{
        leveledUp: boolean;
        finalLevel: number;
        remainingXp: number;
    }>;
    sendLevelUpCard(guild: FluxerGuild, member: FluxerMember, channelId: string, level: number, cowoncyReward: number, lootboxReward: number, crateReward: number): Promise<void>;
    handleCommand(subcommand: string, args: string[], guild: FluxerGuild, member: FluxerMember, message: FluxerMessage): Promise<void>;
    private handleHunt;
    private rollAnimal;
    private handleZoo;
    private handleCash;
    private handleDaily;
    private handleCoinflip;
    private handleSlots;
    private handleBlackjack;
    private stepBlackjack;
    private autoStandTimeoutBlackjack;
    private calculateHand;
    private handleBattle;
    private handlePray;
    private handleCurse;
    private handleGive;
    private handleSell;
    private handleShop;
    private handleBuy;
    private handleInventory;
    private handleOpen;
    private handleTop;
    private handleProfile;
    private handleSocial;
    private progressQuest;
    private handleQuest;
    private getEffectiveTeam;
    private handleTeam;
    private handleZooBattle;
    private handleForge;
    private handleMarry;
    private handleDivorce;
    private handleRemind;
    private handleHelp;
}
