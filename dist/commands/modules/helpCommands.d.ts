import type { CommandContext } from '../types.js';
import type { DiscordActionRowComponent, Snowflake } from '../../types/fluxer.js';
export interface HelpSession {
    messageId: Snowflake;
    channelId: Snowflake;
    currentPage: number;
    userId: Snowflake;
    createdAt: number;
    mode: 'user' | 'admin';
}
export declare const HELP_USER_TOTAL_PAGES = 3;
export declare const HELP_ADMIN_TOTAL_PAGES = 5;
export declare const HELP_TOTAL_PAGES = 3;
export declare function buildNavLine(current: number, total: number): string;
export declare function buildHelpPage(pageNum: number, mode?: 'user' | 'admin'): string;
export declare function buildHelpComponents(pageNum: number, totalPages: number): DiscordActionRowComponent[];
export declare function handleHelpCommand(ctx: CommandContext, activeHelpSessions: Map<Snowflake, HelpSession>, addHelpReactions: (channelId: Snowflake, messageId: Snowflake) => Promise<void>): Promise<boolean>;
