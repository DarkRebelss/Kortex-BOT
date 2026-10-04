export interface OwoLevelCardOptions {
    username: string;
    level: number;
    cowoncyReward: number;
    lootboxReward: number;
    crateReward: number;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
}
export declare class OwoLevelCardGenerator {
    private static localAvatarCache;
    private static localBannerCache;
    private static getLocalAsset;
    private static fetchImage;
    /**
     * Generates a sleek, authentic OwO style level up banner card.
     * Matches the visual card format:
     * [Avatar] | LEVEL UP! {Level} | [Rewards: Cash, Lootbox, Crate]
     */
    static generateCard(options: OwoLevelCardOptions): Promise<Buffer>;
}
