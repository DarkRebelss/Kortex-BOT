import type { DiscordActionRowComponent } from '../types/fluxer.js';
export interface PollOptionItem {
    text: string;
    votes: number;
}
export interface PollCardOptions {
    question: string;
    options: PollOptionItem[];
    totalVotes: number;
    isClosed?: boolean;
}
export declare class PollCardGenerator {
    static generatePollCard(opts: PollCardOptions): Promise<Buffer>;
}
/**
 * Generates sleek Unicode percentage progress bar (e.g. ▰▰▰▰▰▱▱▱▱▱)
 */
export declare function renderProgressBar(percent: number, length?: number): string;
/**
 * Parse human duration string (e.g. '30s', '10m', '2h', '1d', '30dk') into seconds.
 */
export declare function parsePollDuration(input: string): number | null;
export declare function formatDurationHuman(seconds: number): string;
/**
 * Parses user input for /poll:
 * Format A: /poll Soru "seçenek1" "seçenek2"
 * Format B: /poll 10m Soru "seçenek1" "seçenek2"
 * Format C: /poll Soru "seçenek1" "seçenek2" 10m
 * Format D: /poll Soru "seçenek1" "seçenek2" süre:10m
 * Format E: /poll Soru (defaults to ["Evet", "Hayır"])
 */
export declare function parsePollInput(raw: string): {
    question: string;
    options: string[];
    durationSeconds?: number | null;
} | null;
export declare const OPTION_EMOJIS: string[];
export declare const NUMBER_EMOJIS: string[];
/**
 * Formats poll data as a Discord Rich Embed with percentage progress bars.
 */
export declare function formatPollEmbed(opts: {
    question: string;
    options: Array<{
        text: string;
        votes: number;
    }>;
    totalVotes: number;
    isClosed?: boolean;
    userVotedIndex?: number | null;
    expireUnix?: number | null;
}): {
    title: string;
    description: string;
    color: number;
    footer: {
        text: string;
    };
    timestamp: string;
};
/**
 * Formats poll data as plain Markdown text with percentage progress bars.
 */
export declare function formatPollText(opts: {
    question: string;
    options: Array<{
        text: string;
        votes: number;
    }>;
    totalVotes: number;
    isClosed?: boolean;
    userVotedIndex?: number | null;
    expireUnix?: number | null;
}): string;
/**
 * Builds interactive button components for a poll
 */
export declare function buildPollComponents(pollId: number, options: string[], isClosed?: boolean, userVotedIndex?: number | null): DiscordActionRowComponent[];
