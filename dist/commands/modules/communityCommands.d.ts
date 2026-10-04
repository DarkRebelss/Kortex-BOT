import type { CommandContext } from '../types.js';
export declare function parseBirthdayInput(args: string[]): {
    day: number;
    month: number;
    year?: number;
} | null;
export declare function handleCommunityCommands(ctx: CommandContext): Promise<boolean>;
