// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {LevelingService} from '../src/services/LevelingService.js';
import {DatabaseClient} from '../src/database/DatabaseClient.js';
import type {FluxerGuild, FluxerMember, FluxerMessage} from '../src/types/fluxer.js';

describe('LevelingService (Server Text & Voice XP, Rank & Level Roles)', () => {
  let db: DatabaseClient;
  let mockApi: any;
  let service: LevelingService;
  let guild: FluxerGuild;
  let ownerMember: FluxerMember;
  let regularMember: FluxerMember;

  beforeEach(() => {
    db = new DatabaseClient(':memory:');

    mockApi = {
      sendMessage: vi.fn(async (chId: string, content: string) => ({
        id: 'msg_level_notice',
        channel_id: chId,
        content,
      })),
      addMemberRole: vi.fn(async () => {}),
    };

    service = new LevelingService(mockApi, db);

    guild = {
      id: 'guild_lvl_1',
      name: 'Oyun Kulübü',
      owner_id: 'user_owner',
      roles: [
        {id: 'role_lvl_1', name: 'Çaylak (Seviye 1)', color: 0, hoist: false, position: 1, permissions: '0'},
        {id: 'role_lvl_5', name: 'Usta (Seviye 5)', color: 0, hoist: false, position: 2, permissions: '0'},
      ],
      channels: [
        {id: 'ch_general', name: 'genel-sohbet', type: 0},
        {id: 'ch_announcements', name: 'seviye-kutlamalari', type: 0},
      ],
      members: [],
    };

    ownerMember = {
      user: {id: 'user_owner', username: 'SunucuSahibi', discriminator: '0001', bot: false},
      roles: [],
      joined_at: new Date().toISOString(),
    };

    regularMember = {
      user: {id: 'user_reg', username: 'AktifUye', discriminator: '0002', bot: false},
      roles: [],
      joined_at: new Date().toISOString(),
    };
  });

  afterEach(() => {
    service.stop();
  });

  it('calculates proper XP required for level progression', () => {
    expect(service.getXpForLevel(0)).toBe(100);
    expect(service.getXpForLevel(1)).toBe(155);
    expect(service.getXpForLevel(2)).toBe(220);
    expect(service.getXpForLevel(5)).toBe(475);
  });

  it('awards text XP, updates message_count, and enforces 60-second cooldown', async () => {
    const msg1: FluxerMessage = {
      id: 'msg_1',
      channel_id: 'ch_general',
      guild_id: guild.id,
      author: regularMember.user,
      content: 'Herkese selam!',
      timestamp: new Date().toISOString(),
    };

    // First message awards 15-25 XP and sets message_count = 1
    await service.handleTextMessage(guild, regularMember, msg1);
    let record = db.getGuildUserLevel(guild.id, regularMember.user.id);
    expect(record.message_count).toBe(1);
    expect(record.xp).toBeGreaterThanOrEqual(15);
    expect(record.xp).toBeLessThanOrEqual(25);
    const firstXp = record.xp;

    // Immediate second message (within 60s) updates message_count to 2 but does not award extra XP
    const msg2: FluxerMessage = {
      id: 'msg_2',
      channel_id: 'ch_general',
      guild_id: guild.id,
      author: regularMember.user,
      content: 'Nasılsınız?',
      timestamp: new Date().toISOString(),
    };
    await service.handleTextMessage(guild, regularMember, msg2);
    record = db.getGuildUserLevel(guild.id, regularMember.user.id);
    expect(record.message_count).toBe(2);
    expect(record.xp).toBe(firstXp);
  });

  it('levels up user and automatically grants configured level roles', async () => {
    // Add level role for level 1
    db.addLevelRole(guild.id, 1, 'role_lvl_1');

    // Give user 95 XP (close to level 1 requirement 100 XP)
    db.updateGuildUserLevel(guild.id, regularMember.user.id, {
      xp: 95,
      level: 0,
      message_count: 5,
    });

    const msg: FluxerMessage = {
      id: 'msg_levelup',
      channel_id: 'ch_general',
      guild_id: guild.id,
      author: regularMember.user,
      content: 'Seviye atlamak üzereyim!',
      timestamp: new Date().toISOString(),
    };

    await service.handleTextMessage(guild, regularMember, msg);

    const record = db.getGuildUserLevel(guild.id, regularMember.user.id);
    expect(record.level).toBe(1);

    // Verified role was automatically awarded via API
    expect(mockApi.addMemberRole).toHaveBeenCalledWith(guild.id, regularMember.user.id, 'role_lvl_1', expect.any(String));

    // Verified announcement was sent to chat
    expect(mockApi.sendMessage).toHaveBeenCalledWith('ch_general', expect.stringContaining('Seviye 1'));
  });

  it('sends level-up announcement to configured leveling channel when set', async () => {
    db.updateGuildConfig(guild.id, {leveling_channel_id: 'ch_announcements'});

    db.updateGuildUserLevel(guild.id, regularMember.user.id, {
      xp: 95,
      level: 0,
      message_count: 5,
    });

    const msg: FluxerMessage = {
      id: 'msg_lvl_test',
      channel_id: 'ch_general',
      guild_id: guild.id,
      author: regularMember.user,
      content: 'Kanal testi',
      timestamp: new Date().toISOString(),
    };

    await service.handleTextMessage(guild, regularMember, msg);
    expect(mockApi.sendMessage).toHaveBeenCalledWith('ch_announcements', expect.stringContaining('Seviye 1'));
  });

  it('returns formatted rank card and leaderboard', () => {
    db.updateGuildUserLevel(guild.id, regularMember.user.id, {
      xp: 45,
      level: 2,
      message_count: 88,
      voice_seconds: 7200, // 2 hours
    });

    const rankRes = service.getRank(guild, regularMember.user);
    expect(rankRes.success).toBe(true);
    expect(rankRes.message).toContain('Seviye 2');
    expect(rankRes.message).toContain('45 / 220 XP');
    expect(rankRes.message).toContain('88 adet');
    expect(rankRes.message).toContain('2 saat 0 dakika');

    const topRes = service.getTopXP(guild);
    expect(topRes.success).toBe(true);
    expect(topRes.message).toContain('🥇');
    expect(topRes.message).toContain('<@user_reg>');
  });

  it('handles level role management commands: add, remove, and list', () => {
    // Add level role
    const addRes = service.addLevelRole(guild, ownerMember, 5, 'role_lvl_5');
    expect(addRes.success).toBe(true);

    const listRes = service.listLevelRoles(guild);
    expect(listRes.message).toContain('Seviye 5');
    expect(listRes.message).toContain('role_lvl_5');

    // Remove level role
    const remRes = service.removeLevelRole(guild, ownerMember, 5);
    expect(remRes.success).toBe(true);

    const listEmpty = service.listLevelRoles(guild);
    expect(listEmpty.message).toContain('Henüz hiçbir seviye rolü ayarlanmamış');
  });
});
