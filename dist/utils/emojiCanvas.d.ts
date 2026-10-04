import { type Image, type SKRSContext2D } from '@napi-rs/canvas';
export interface EmojiToken {
    type: 'text' | 'unicode_emoji' | 'custom_emoji';
    content: string;
    codePoint?: string;
    emojiId?: string;
    image?: Image | null;
}
export interface EmojiDrawOptions {
    fontSize: number;
    fontFamily?: string;
    color?: string;
    align?: 'left' | 'center' | 'right';
    baseline?: 'alphabetic' | 'middle' | 'top';
    maxWidth?: number;
    shadowColor?: string;
    shadowBlur?: number;
    shadowOffsetY?: number;
}
export declare class EmojiCanvasHelper {
    private static emojiCache;
    /**
     * Converts a unicode emoji sequence to a Twemoji codepoint hex string.
     */
    static toTwemojiCodePoint(emoji: string): string;
    /**
     * Parses string into text and emoji tokens.
     */
    static parse(text: string): EmojiToken[];
    /**
     * Loads an emoji image into memory with caching.
     */
    static loadEmojiImage(token: EmojiToken): Promise<Image | null>;
    /**
     * Pre-fetches all emoji images in a token list in parallel.
     */
    static preloadTokens(tokens: EmojiToken[]): Promise<void>;
    /**
     * Measures the total display width of text including emojis.
     */
    static measureWidth(ctx: SKRSContext2D, tokens: EmojiToken[], fontSize: number): number;
    /**
     * Truncates tokens if total width exceeds maxWidth, appending '...'.
     */
    static truncateToMaxWidth(ctx: SKRSContext2D, tokens: EmojiToken[], fontSize: number, maxWidth: number): EmojiToken[];
    /**
     * Draws text with full emoji support on a 2D canvas context.
     */
    static drawText(ctx: SKRSContext2D, text: string, x: number, y: number, options: EmojiDrawOptions): Promise<number>;
}
