// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, it, expect} from 'vitest';
import {maskToken} from '../src/config/env.js';
import {ModerationService} from '../src/services/ModerationService.js';
import {WelcomeGoodbyeService} from '../src/services/WelcomeGoodbyeService.js';
import type {FluxerGuild, FluxerUser} from '../src/types/fluxer.js';

describe('Services & Security Utility Tests', () => {
  // -------------------------------------------------------------
  // Test 12: Bot token frontend veya loglarda görünüyor mu? Görünmemeli!
  // -------------------------------------------------------------
  it('masks sensitive bot tokens safely', () => {
    const rawToken = '1553891682385133568.secret_key_long_string_1234567890';
    const masked = maskToken(rawToken);

    expect(masked).not.toContain('secret_key_long_string_1234567890');
    expect(masked).toBe('1553891682385133568.secr...7890');

    expect(maskToken('')).toBe('[NO_TOKEN_SET]');
  });

  // -------------------------------------------------------------
  // Test 7 & 8: Welcome / Goodbye dynamic template formatting
  // -------------------------------------------------------------
  it('formats welcome template correctly with all variables', () => {
    const user: FluxerUser = {
      id: '998877',
      username: 'Ahmet',
      discriminator: '1234',
    };

    const guild: FluxerGuild = {
      id: 'guild_1',
      name: 'Micup Türkiye',
      owner_id: '1',
      members: [],
      roles: [],
      channels: [],
      member_count: 1248,
    };

    const template = '👋 Hoş geldin {user}! Sunucuya katılan {memberCount}. üyemizsin. ({guildName})';
    const result = WelcomeGoodbyeService.formatTemplate(template, user, guild);

    expect(result).toBe('👋 Hoş geldin <@998877>! Sunucuya katılan 1248. üyemizsin. (Micup Türkiye)');
  });

  it('formats goodbye template correctly with all variables', () => {
    const user: FluxerUser = {
      id: '998877',
      username: 'Mehmet',
      discriminator: '5678',
    };

    const guild: FluxerGuild = {
      id: 'guild_1',
      name: 'Micup Gaming',
      owner_id: '1',
      members: [],
      roles: [],
      channels: [],
      member_count: 1247,
    };

    const template = '👋 **{username}** sunucudan ayrıldı. Kalan üye sayısı: {memberCount}.';
    const result = WelcomeGoodbyeService.formatTemplate(template, user, guild);

    expect(result).toBe('👋 **Mehmet** sunucudan ayrıldı. Kalan üye sayısı: 1247.');
  });

  // -------------------------------------------------------------
  // Test: Duration Parsing (seconds, minutes, hours, days, weeks)
  // -------------------------------------------------------------
  it('parses timeout durations into seconds correctly', () => {
    // Seconds variations
    expect(ModerationService.parseDuration('10s')).toBe(10);
    expect(ModerationService.parseDuration('10sn')).toBe(10);
    expect(ModerationService.parseDuration('10saniye')).toBe(10);
    expect(ModerationService.parseDuration('10sec')).toBe(10);
    expect(ModerationService.parseDuration('10 seconds')).toBe(10);
    expect(ModerationService.parseDuration('10')).toBe(10); // Plain digits default to seconds

    // Minutes
    expect(ModerationService.parseDuration('5m')).toBe(300);
    expect(ModerationService.parseDuration('5dk')).toBe(300);
    expect(ModerationService.parseDuration('5 dakika')).toBe(300);

    // Hours, Days, Weeks
    expect(ModerationService.parseDuration('1h')).toBe(3600);
    expect(ModerationService.parseDuration('1saat')).toBe(3600);
    expect(ModerationService.parseDuration('1d')).toBe(86400);
    expect(ModerationService.parseDuration('1 gün')).toBe(86400);
    expect(ModerationService.parseDuration('7d')).toBe(604800);
    expect(ModerationService.parseDuration('1 hafta')).toBe(604800);

    expect(ModerationService.parseDuration('invalid')).toBeNull();

    // Friendly duration formatting
    expect(ModerationService.formatDuration(10)).toBe('10 saniye');
    expect(ModerationService.formatDuration(300)).toBe('5 dakika');
    expect(ModerationService.formatDuration(3600)).toBe('1 saat');
  });
});
