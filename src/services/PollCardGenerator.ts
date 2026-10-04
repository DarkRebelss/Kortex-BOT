// SPDX-License-Identifier: AGPL-3.0-or-later

import { createCanvas } from '@napi-rs/canvas';
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

const OPTION_COLORS = [
  '#23a55a', // Green
  '#da373c', // Red
  '#5865f2', // Blurple
  '#f0b232', // Yellow
  '#eb459e', // Pink
  '#00a8fc', // Cyan
  '#8b5cf6', // Purple
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#64748b', // Slate
];

export class PollCardGenerator {
  static async generatePollCard(opts: PollCardOptions): Promise<Buffer> {
    const { question, options, totalVotes, isClosed = false } = opts;

    const width = 640;
    const padding = 24;
    const itemHeight = 52;
    const itemGap = 12;

    const headerHeight = 44;
    const footerHeight = 36;
    const contentHeight = headerHeight + options.length * (itemHeight + itemGap) + footerHeight;
    const height = padding * 2 + contentHeight;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Background Card
    ctx.save();
    ctx.fillStyle = '#2b2d31';
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, 16);
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = '#383a40';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // 2. Question Title
    let currentY = padding + 28;
    ctx.save();
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#f2f3f5';
    ctx.textBaseline = 'middle';

    // Truncate question if it exceeds max width
    let displayTitle = question;
    const maxTitleW = width - padding * 2;
    if (ctx.measureText(displayTitle).width > maxTitleW) {
      while (ctx.measureText(displayTitle + '...').width > maxTitleW && displayTitle.length > 5) {
        displayTitle = displayTitle.slice(0, -1);
      }
      displayTitle += '...';
    }
    ctx.fillText(displayTitle, padding, currentY);
    ctx.restore();

    currentY += 24;

    // Find highest vote count
    const maxVotes = Math.max(0, ...options.map((o) => o.votes));

    // 3. Option Bars
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const optY = currentY + i * (itemHeight + itemGap);
      const optW = width - padding * 2;
      const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
      const isLeading = maxVotes > 0 && opt.votes === maxVotes;
      const circleColor = OPTION_COLORS[i % OPTION_COLORS.length];

      ctx.save();

      // Outer Option Box
      ctx.beginPath();
      ctx.roundRect(padding, optY, optW, itemHeight, 10);

      if (isLeading) {
        ctx.fillStyle = 'rgba(35, 165, 90, 0.12)';
        ctx.fill();
        ctx.strokeStyle = '#23a55a';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#313338';
        ctx.fill();
        ctx.strokeStyle = '#3f4147';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Progress Fill Bar
      if (percent > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(padding, optY, optW, itemHeight, 10);
        ctx.clip();

        const progressW = (percent / 100) * optW;
        ctx.fillStyle = isLeading ? 'rgba(35, 165, 90, 0.28)' : 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(padding, optY, progressW, itemHeight);
        ctx.restore();
      }

      // Color Circle Icon
      const circleX = padding + 22;
      const circleY = optY + itemHeight / 2;
      ctx.beginPath();
      ctx.arc(circleX, circleY, 10, 0, Math.PI * 2);
      ctx.fillStyle = circleColor;
      ctx.fill();

      // Option Text
      const textX = padding + 44;
      const textY = optY + itemHeight / 2;
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#f2f3f5';
      ctx.textBaseline = 'middle';

      // Truncate option text if it clashes with right-aligned vote count
      let optText = opt.text;
      const maxTextW = optW - 190;
      if (ctx.measureText(optText).width > maxTextW) {
        while (ctx.measureText(optText + '...').width > maxTextW && optText.length > 3) {
          optText = optText.slice(0, -1);
        }
        optText += '...';
      }
      ctx.fillText(optText, textX, textY);

      // Right Stats: "X oy  Y% [✓]"
      const rightStats = `${opt.votes} oy  ${percent}%${isLeading && isClosed ? '  ✓' : ''}`;
      ctx.textAlign = 'right';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = isLeading ? '#23a55a' : '#dbdee1';
      ctx.fillText(rightStats, padding + optW - 16, textY);

      ctx.restore();
    }

    // 4. Footer Line
    const footerY = currentY + options.length * (itemHeight + itemGap) + 18;
    ctx.save();
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#949ba4';
    ctx.textBaseline = 'middle';
    const statusText = isClosed ? 'Anket kapandı.' : 'Anket devam ediyor';
    ctx.fillText(`${totalVotes} oy  •  ${statusText}`, padding, footerY);
    ctx.restore();

    return canvas.toBuffer('image/png');
  }
}

/**
 * Generates sleek Unicode percentage progress bar (e.g. ▰▰▰▰▰▱▱▱▱▱)
 */
export function renderProgressBar(percent: number, length = 10): string {
  const clamped = Math.max(0, Math.min(100, isNaN(percent) ? 0 : percent));
  const filled = Math.round((clamped / 100) * length);
  const empty = length - filled;
  return `${'▰'.repeat(filled)}${'▱'.repeat(empty)}`;
}

/**
 * Parse human duration string (e.g. '30s', '10m', '2h', '1d', '30dk') into seconds.
 */
export function parsePollDuration(input: string): number | null {
  const match = input.toLowerCase().match(/^(\d+)\s*(s|m|h|d|sn|dk|sa|gun|gün)$/);
  if (!match) return null;
  const val = Number.parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
    case 'sn':
      return val;
    case 'm':
    case 'dk':
      return val * 60;
    case 'h':
    case 'sa':
      return val * 3600;
    case 'd':
    case 'gun':
    case 'gün':
      return val * 86400;
    default:
      return null;
  }
}

export function formatDurationHuman(seconds: number): string {
  if (seconds < 60) return `${seconds} saniye`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dakika`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} saat`;
  return `${Math.floor(seconds / 86400)} gün`;
}

/**
 * Parses user input for /poll:
 * Format A: /poll Soru "seçenek1" "seçenek2"
 * Format B: /poll 10m Soru "seçenek1" "seçenek2"
 * Format C: /poll Soru "seçenek1" "seçenek2" 10m
 * Format D: /poll Soru "seçenek1" "seçenek2" süre:10m
 * Format E: /poll Soru (defaults to ["Evet", "Hayır"])
 */
export function parsePollInput(raw: string): {
  question: string;
  options: string[];
  durationSeconds?: number | null;
} | null {
  let trimmed = raw.trim();
  if (!trimmed) return null;

  let durationSeconds: number | null = null;

  // 1. Check explicit keyword e.g. "süre:10m", "sure:10m", "duration:10m", "time:10m"
  const kwMatch = trimmed.match(/(?:^|\s)(?:süre|sure|duration|time):([0-9]+[a-zA-ZçğıöşüÇĞİÖŞÜ]+)(?:\s|$)/i);
  if (kwMatch) {
    const parsed = parsePollDuration(kwMatch[1]);
    if (parsed) {
      durationSeconds = parsed;
      trimmed = trimmed.replace(kwMatch[0], ' ').trim();
    }
  }

  // 2. Check duration token at the beginning e.g. "10m Soru..." or "start 10m Soru..."
  const startMatch = trimmed.match(/^(?:start\s+|baslat\s+|başlat\s+)?([0-9]+\s*(?:s|m|h|d|sn|dk|sa|gun|gün))\s+/i);
  if (!durationSeconds && startMatch) {
    const parsed = parsePollDuration(startMatch[1]);
    if (parsed) {
      durationSeconds = parsed;
      trimmed = trimmed.slice(startMatch[0].length).trim();
    }
  }

  // 3. Check duration token at the very end e.g. '... "seçenek2" 10m'
  const endMatch = trimmed.match(/\s+([0-9]+\s*(?:s|m|h|d|sn|dk|sa|gun|gün))$/i);
  if (!durationSeconds && endMatch) {
    const parsed = parsePollDuration(endMatch[1]);
    if (parsed) {
      durationSeconds = parsed;
      trimmed = trimmed.slice(0, -endMatch[0].length).trim();
    }
  }

  // Extract all quoted segments: "...", '...', “...”, «...»
  const quoteRegex = /["'“”«»]([^"'“”«»]+)["'“”«»]/g;
  const quotes: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = quoteRegex.exec(trimmed)) !== null) {
    const opt = match[1].trim();
    if (opt) quotes.push(opt);
  }

  if (quotes.length >= 2) {
    const firstQuotePos = trimmed.search(/["'“”«»]/);
    const textBefore = trimmed.slice(0, firstQuotePos).trim();
    if (textBefore.length >= 2) {
      return {
        question: textBefore,
        options: quotes.slice(0, 10),
        durationSeconds,
      };
    } else {
      return {
        question: quotes[0],
        options: quotes.slice(1, 11),
        durationSeconds,
      };
    }
  } else if (quotes.length === 1) {
    const firstQuotePos = trimmed.search(/["'“”«»]/);
    const textBefore = trimmed.slice(0, firstQuotePos).trim();
    if (textBefore.length >= 2) {
      return {
        question: textBefore,
        options: [quotes[0], 'Diğer'],
        durationSeconds,
      };
    }
  }

  // No quotes or single unquoted question
  const clean = trimmed.replace(/["'“”«»]/g, '').trim();
  if (clean.length > 0) {
    return {
      question: clean,
      options: ['Evet', 'Hayır'],
      durationSeconds,
    };
  }

  return null;
}

export const OPTION_EMOJIS = ['🟢', '🔴', '🔵', '🟡', '🟣', '🟠', '⚪', '🟤', '⚫', '🟩'];
export const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

/**
 * Formats poll data as a Discord Rich Embed with percentage progress bars.
 */
export function formatPollEmbed(opts: {
  question: string;
  options: Array<{ text: string; votes: number }>;
  totalVotes: number;
  isClosed?: boolean;
  userVotedIndex?: number | null;
  expireUnix?: number | null;
}) {
  const { question, options, totalVotes, isClosed = false, userVotedIndex, expireUnix } = opts;
  const maxVotes = Math.max(0, ...options.map((o) => o.votes));

  const optionBlocks: string[] = [];

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
    const isLeading = maxVotes > 0 && opt.votes === maxVotes;

    const checkMark = isClosed && isLeading && maxVotes > 0 ? '  ✓' : '';
    const bar = renderProgressBar(percent, 10);

    optionBlocks.push(
      `> **${opt.text}**\n> \`${bar}\` **${percent}%** (${opt.votes} oy)${checkMark}`
    );
  }

  let statusText: string;
  if (isClosed) {
    statusText = 'Anket kapandı.';
  } else if (expireUnix) {
    statusText = `Anket devam ediyor  •  ⏳ Bitiş: <t:${expireUnix}:R>`;
  } else {
    statusText = 'Anket devam ediyor';
  }

  const footerText = `${totalVotes} oy  •  ${statusText}`;

  return {
    title: question,
    description: optionBlocks.join('\n\n'),
    color: isClosed ? 0x64748b : maxVotes > 0 ? 0x23a55a : 0x5865f2,
    footer: {
      text: footerText,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Formats poll data as plain Markdown text with percentage progress bars.
 */
export function formatPollText(opts: {
  question: string;
  options: Array<{ text: string; votes: number }>;
  totalVotes: number;
  isClosed?: boolean;
  userVotedIndex?: number | null;
  expireUnix?: number | null;
}): string {
  const { question, options, totalVotes, isClosed = false, expireUnix } = opts;
  const maxVotes = Math.max(0, ...options.map((o) => o.votes));

  const lines: string[] = [
    `**${question}**`,
    '────────────────────────────────────────',
  ];

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
    const isLeading = maxVotes > 0 && opt.votes === maxVotes;

    const checkMark = isClosed && isLeading && maxVotes > 0 ? '  ✓' : '';
    const bar = renderProgressBar(percent, 10);

    lines.push(`> **${opt.text}**\n> \`${bar}\` **${percent}%** (${opt.votes} oy)${checkMark}`);
  }

  let statusText: string;
  if (isClosed) {
    statusText = 'Anket kapandı.';
  } else if (expireUnix) {
    statusText = `Anket devam ediyor  •  ⏳ Bitiş: <t:${expireUnix}:R>`;
  } else {
    statusText = 'Anket devam ediyor';
  }

  lines.push('────────────────────────────────────────');
  lines.push(`${totalVotes} oy  •  ${statusText}`);

  return lines.join('\n');
}

/**
 * Builds interactive button components for a poll
 */
export function buildPollComponents(
  pollId: number,
  options: string[],
  isClosed = false,
  userVotedIndex?: number | null,
): DiscordActionRowComponent[] {
  const rows: DiscordActionRowComponent[] = [];
  let currentRow: DiscordActionRowComponent = { type: 1, components: [] };

  for (let i = 0; i < options.length; i++) {
    const isVoted = userVotedIndex === i;
    const style = isVoted ? 3 : 2; // Green if voted, secondary grey otherwise
    const emojiName = NUMBER_EMOJIS[i % NUMBER_EMOJIS.length];
    const label = options[i].length > 60 ? options[i].slice(0, 57) + '...' : options[i];

    if (currentRow.components.length >= 5) {
      rows.push(currentRow);
      currentRow = { type: 1, components: [] };
    }

    currentRow.components.push({
      type: 2,
      style,
      custom_id: `poll_vote_${pollId}_${i}`,
      label,
      emoji: { name: emojiName },
      disabled: isClosed,
    });
  }

  // End poll button
  if (currentRow.components.length >= 5) {
    rows.push(currentRow);
    currentRow = { type: 1, components: [] };
  }

  currentRow.components.push({
    type: 2,
    style: 4, // DANGER
    custom_id: `poll_end_${pollId}`,
    label: isClosed ? 'Anket Kapandı' : 'Anketi Bitir',
    emoji: { name: isClosed ? '🔒' : '⏹️' },
    disabled: isClosed,
  });

  if (currentRow.components.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}
