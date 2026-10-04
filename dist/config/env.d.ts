export interface BotConfig {
    botToken: string;
    apiBaseUrl: string;
    gatewayUrl?: string;
    databasePath: string;
    commandPrefix: string;
    defaultLanguage: 'tr' | 'en';
    ownerId?: string;
    spotifyToken?: string;
}
export declare const config: BotConfig;
/**
 * Mask secret token for safe logging
 */
export declare function maskToken(token: string): string;
