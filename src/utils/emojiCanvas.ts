// SPDX-License-Identifier: AGPL-3.0-or-later

import { loadImage, type Image, type SKRSContext2D } from '@napi-rs/canvas';
import { safeFetch } from './security.js';

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

const EMOJI_REGEX =
  /(<a?:[a-zA-Z0-9_]+:(\d+)>)|((?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\uFE0E)?(?:\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\uFE0E)?)*(?:[\u{1F3FB}-\u{1F3FF}])?)/gu;

export class EmojiCanvasHelper {
  private static emojiCache = new Map<string, Image | null>();

  /**
   * Converts a unicode emoji sequence to a Twemoji codepoint hex string.
   */
  static toTwemojiCodePoint(emoji: string): string {
    const codePoints: string[] = [];
    for (const char of emoji) {
      const cp = char.codePointAt(0);
      if (cp !== undefined && cp !== 0xfe0f && cp !== 0xfe0e) {
        codePoints.push(cp.toString(16));
      }
    }
    return codePoints.join('-');
  }

  /**
   * Parses string into text and emoji tokens.
   */
  static parse(text: string): EmojiToken[] {
    const tokens: EmojiToken[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    EMOJI_REGEX.lastIndex = 0;
    while ((match = EMOJI_REGEX.exec(text)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      }

      if (match[1]) {
        // Custom Discord emoji: <:name:id> or <a:name:id>
        tokens.push({
          type: 'custom_emoji',
          content: match[1],
          emojiId: match[2],
        });
      } else if (match[3]) {
        // Unicode emoji
        tokens.push({
          type: 'unicode_emoji',
          content: match[3],
          codePoint: this.toTwemojiCodePoint(match[3]),
        });
      }
      lastIndex = EMOJI_REGEX.lastIndex;
    }

    if (lastIndex < text.length) {
      tokens.push({ type: 'text', content: text.slice(lastIndex) });
    }

    return tokens;
  }

  /**
   * Loads an emoji image into memory with caching.
   */
  static async loadEmojiImage(token: EmojiToken): Promise<Image | null> {
    let url = '';
    if (token.type === 'custom_emoji' && token.emojiId) {
      url = `https://cdn.discordapp.com/emojis/${token.emojiId}.png?size=64`;
    } else if (token.type === 'unicode_emoji' && token.codePoint) {
      url = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${token.codePoint}.png`;
    } else {
      return null;
    }

    if (this.emojiCache.has(url)) {
      return this.emojiCache.get(url) || null;
    }

    try {
      let res = await safeFetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok && token.type === 'unicode_emoji' && token.codePoint) {
        // Fallback to Cloudflare Twemoji CDN
        const fallbackUrl = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/${token.codePoint}.png`;
        res = await safeFetch(fallbackUrl, { signal: AbortSignal.timeout(3000) });
      }

      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const img = await loadImage(buf);
        if (img && img.width > 0) {
          this.emojiCache.set(url, img);
          return img;
        }
      }
    } catch {
      // Ignore network errors
    }

    this.emojiCache.set(url, null);
    return null;
  }

  /**
   * Pre-fetches all emoji images in a token list in parallel.
   */
  static async preloadTokens(tokens: EmojiToken[]): Promise<void> {
    const promises = tokens
      .filter((t) => t.type !== 'text')
      .map(async (t) => {
        t.image = await this.loadEmojiImage(t);
      });
    await Promise.all(promises);
  }

  /**
   * Measures the total display width of text including emojis.
   */
  static measureWidth(
    ctx: SKRSContext2D,
    tokens: EmojiToken[],
    fontSize: number,
  ): number {
    let total = 0;
    const emojiSize = fontSize * 1.05;
    const emojiSpacing = fontSize * 0.12;

    for (const t of tokens) {
      if (t.type === 'text') {
        total += ctx.measureText(t.content).width;
      } else {
        total += emojiSize + emojiSpacing;
      }
    }
    return total;
  }

  /**
   * Truncates tokens if total width exceeds maxWidth, appending '...'.
   */
  static truncateToMaxWidth(
    ctx: SKRSContext2D,
    tokens: EmojiToken[],
    fontSize: number,
    maxWidth: number,
  ): EmojiToken[] {
    const currentW = this.measureWidth(ctx, tokens, fontSize);
    if (currentW <= maxWidth) return tokens;

    const ellipsisW = ctx.measureText('...').width;
    const targetW = maxWidth - ellipsisW;

    const result: EmojiToken[] = [];
    let accW = 0;
    const emojiSize = fontSize * 1.05;
    const emojiSpacing = fontSize * 0.12;

    for (const t of tokens) {
      if (t.type === 'text') {
        let sub = '';
        for (const char of t.content) {
          const charW = ctx.measureText(char).width;
          if (accW + charW > targetW) {
            if (sub.length > 0) {
              result.push({ type: 'text', content: sub });
            }
            result.push({ type: 'text', content: '...' });
            return result;
          }
          sub += char;
          accW += charW;
        }
        if (sub.length > 0) {
          result.push({ type: 'text', content: sub });
        }
      } else {
        const itemW = emojiSize + emojiSpacing;
        if (accW + itemW > targetW) {
          result.push({ type: 'text', content: '...' });
          return result;
        }
        result.push(t);
        accW += itemW;
      }
    }

    result.push({ type: 'text', content: '...' });
    return result;
  }

  /**
   * Draws text with full emoji support on a 2D canvas context.
   */
  static async drawText(
    ctx: SKRSContext2D,
    text: string,
    x: number,
    y: number,
    options: EmojiDrawOptions,
  ): Promise<number> {
    if (!text) return 0;

    let tokens = this.parse(text);
    await this.preloadTokens(tokens);

    if (options.maxWidth && options.maxWidth > 0) {
      tokens = this.truncateToMaxWidth(ctx, tokens, options.fontSize, options.maxWidth);
    }

    const totalWidth = this.measureWidth(ctx, tokens, options.fontSize);
    let startX = x;
    if (options.align === 'center') {
      startX = x - totalWidth / 2;
    } else if (options.align === 'right') {
      startX = x - totalWidth;
    }

    ctx.save();
    if (options.color) {
      ctx.fillStyle = options.color;
    }
    if (options.shadowColor) {
      ctx.shadowColor = options.shadowColor;
      ctx.shadowBlur = options.shadowBlur || 0;
      ctx.shadowOffsetY = options.shadowOffsetY || 0;
    }

    const emojiSize = options.fontSize * 1.05;
    const emojiSpacing = options.fontSize * 0.12;

    // Calculate vertical emoji Y position based on baseline
    let emojiY = y - emojiSize * 0.85;
    if (options.baseline === 'middle') {
      emojiY = y - emojiSize / 2;
    } else if (options.baseline === 'top') {
      emojiY = y;
    }

    let curX = startX;
    for (const t of tokens) {
      if (t.type === 'text') {
        ctx.fillText(t.content, curX, y);
        curX += ctx.measureText(t.content).width;
      } else {
        if (t.image) {
          ctx.drawImage(t.image, curX + emojiSpacing / 2, emojiY, emojiSize, emojiSize);
        } else {
          // Graceful fallback to text if image couldn't be loaded
          ctx.fillText(t.content, curX, y);
        }
        curX += emojiSize + emojiSpacing;
      }
    }

    ctx.restore();
    return totalWidth;
  }
}
