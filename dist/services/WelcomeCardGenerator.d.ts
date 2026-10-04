export interface WelcomeCardOptions {
    username: string;
    avatarUrl?: string | null;
    subtitle?: string;
    welcomeText?: string;
    brandingText?: string;
    sloganText?: string;
    theme?: 'purple' | 'crimson' | 'welcome' | 'goodbye';
    customColor?: string;
    accentColor?: string;
    logoUrl?: string | null;
    logoBuffer?: Buffer | null;
}
export interface CardPalette {
    primaryHex: string;
    accentHex: string;
    r: number;
    g: number;
    b: number;
    aR: number;
    aG: number;
    aB: number;
    glowAlpha: (alpha: number) => string;
    accentGlowAlpha: (alpha: number) => string;
    bgGradStops: [string, string, string, string, string];
    borderGradStops: [string, string, string, string, string];
    ringGradStops: [string, string, string, string, string, string];
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    dotColor: string;
    sloganColor: string;
    brandingColor: string;
}
export declare function getCardPalette(options: WelcomeCardOptions): CardPalette;
export declare class WelcomeCardGenerator {
    private static cachedLogo;
    /**
     * Loads logo image from options (buffer or url) or falls back to disk logo.
     */
    private static getLogoImage;
    /**
     * Generates a modern, sleek banner card image (PNG buffer)
     * with procedural background, custom colors, and custom server logo.
     */
    static generateCard(options: WelcomeCardOptions): Promise<Buffer>;
    /**
     * Helper method for generating a goodbye card.
     */
    static generateGoodbyeCard(options: WelcomeCardOptions): Promise<Buffer>;
    private static drawUploadedLogo;
    private static drawCyberGrid;
    private static drawCircuitTraces;
    private static drawTechDotGrid;
    private static drawCyberRingBrackets;
    private static drawCyberEmblem;
}
