// SPDX-License-Identifier: AGPL-3.0-or-later

import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

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

function getEnv(key: string, defaultValue = ''): string {
  return process.env[key]?.trim() || defaultValue;
}

export const config: BotConfig = {
  // Format: <applicationId>.<secret>
  botToken: getEnv('BOT_TOKEN'),
  // Default to local or standard Micup API endpoint
  apiBaseUrl: getEnv('MICUP_API_URL', 'http://127.0.0.1:3000/api/v1').replace(/\/+$/, ''),
  gatewayUrl: getEnv('MICUP_GATEWAY_URL') || undefined,
  databasePath: getEnv('DATABASE_PATH', path.resolve(process.cwd(), 'data', 'micup_bot.db')),
  commandPrefix: getEnv('COMMAND_PREFIX', '/'),
  defaultLanguage: (getEnv('DEFAULT_LANGUAGE', 'tr') as 'tr' | 'en'),
  ownerId: getEnv('BOT_OWNER_ID') || undefined,
  spotifyToken: getEnv('SPOTIFY_TOKEN') || undefined,
};

/**
 * Mask secret token for safe logging
 */
export function maskToken(token: string): string {
  if (!token) return '[NO_TOKEN_SET]';
  const parts = token.split('.');
  if (parts.length === 2) {
    return `${parts[0]}.${parts[1].slice(0, 4)}...${parts[1].slice(-4)}`;
  }
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}
