// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, it, expect, beforeEach, vi} from 'vitest';
import {BadWordsService} from '../src/services/BadWordsService.js';
import {DatabaseClient} from '../src/database/DatabaseClient.js';
import {ModLogService} from '../src/services/ModLogService.js';
import type {FluxerGuild, FluxerMember, FluxerMessage} from '../src/types/fluxer.js';

describe('BadWordsService (Auto-Mod Profanity & Custom Word Filter)', () => {
  let db: DatabaseClient;
  let mockApi: any;
  let modLogService: ModLogService;
  let service: BadWordsService;
  let guild: FluxerGuild;
  let ownerMember: FluxerMember;
  let regularMember: FluxerMember;
  let adminMember: FluxerMember;

  beforeEach(() => {
    db = new DatabaseClient(':memory:');

    mockApi = {
      deleteMessage: vi.fn(async () => {}),
      sendMessage: vi.fn(async (chId: string, content: string) => ({
        id: 'msg_bot_notice',
        channel_id: chId,
        content,
      })),
      timeoutMember: vi.fn(async () => ({
        communication_disabled_until: new Date(Date.now() + 300000).toISOString(),
      })),
    };

    modLogService = new ModLogService(mockApi, db);
    service = new BadWordsService(mockApi, db, modLogService);

    guild = {
      id: 'guild_bw_1',
      name: 'Test Sunucusu',
      owner_id: 'user_owner',
      roles: [
        {id: 'role_admin', name: 'Admin', color: 0, hoist: false, position: 2, permissions: (1n << 3n).toString()}, // ADMINISTRATOR
        {id: 'role_member', name: 'Üye', color: 0, hoist: false, position: 1, permissions: '0'},
      ],
      channels: [{id: 'ch_chat', name: 'sohbet', type: 0}],
      members: [],
    };

    ownerMember = {
      user: {id: 'user_owner', username: 'Owner', discriminator: '0001', bot: false},
      roles: [],
      joined_at: new Date().toISOString(),
    };

    adminMember = {
      user: {id: 'user_admin', username: 'AdminUser', discriminator: '0002', bot: false},
      roles: ['role_admin'],
      joined_at: new Date().toISOString(),
    };

    regularMember = {
      user: {id: 'user_regular', username: 'RegularUser', discriminator: '0003', bot: false},
      roles: ['role_member'],
      joined_at: new Date().toISOString(),
    };

    // Initialize guild config with bad words enabled
    db.updateGuildConfig(guild.id, {
      badwords_enabled: 1,
      badwords_filter_default: 1,
      badwords_punishment: 'delete',
      badwords_exempt_mods: 1,
    });
  });

  it('normalizes Turkish characters, leetspeak, and character repetitions', () => {
    expect(service.normalizeText('SİKTİR')).toBe('siktir');
    expect(service.normalizeText('0r0spu')).toBe('orospu');
    expect(service.normalizeText('p1ç')).toBe('pic');
    expect(service.normalizeText('y@rr@k')).toBe('yarrak');
  });

  it('detects default Turkish profanities and leetspeak variations', () => {
    expect(service.findBadWord('burası çok amk bir yer', [], true)).toBe('amk');
    expect(service.findBadWord('sen ne biçim bir 0r0spusun', [], true)).toBe('orospu');
    expect(service.findBadWord('s.i.k.t.i.r git buradan', [], true)).toBe('siktir');
    expect(['piç', 'pic']).toContain(service.findBadWord('piiiiç herif', [], true));
    expect(service.findBadWord('temiz ve güzel bir mesaj', [], true)).toBeNull();
  });

  it('deletes message and sends warning when bad word is detected', async () => {
    const msg: FluxerMessage = {
      id: 'msg_bad_1',
      channel_id: 'ch_chat',
      guild_id: guild.id,
      author: regularMember.user,
      content: 'bu ne amk böyle',
      timestamp: new Date().toISOString(),
    };

    const detected = await service.handleMessage(guild, regularMember, msg);
    expect(detected).toBe(true);
    expect(mockApi.deleteMessage).toHaveBeenCalledWith('ch_chat', 'msg_bad_1', expect.stringContaining('amk'));
    expect(mockApi.sendMessage).toHaveBeenCalledWith('ch_chat', expect.stringContaining('küfür ve argo'));
  });

  it('applies timeout punishment when badwords_punishment is set to timeout', async () => {
    db.updateGuildConfig(guild.id, {badwords_punishment: 'timeout'});

    const msg: FluxerMessage = {
      id: 'msg_bad_2',
      channel_id: 'ch_chat',
      guild_id: guild.id,
      author: regularMember.user,
      content: 'sen tam bir orospu çocuğusun',
      timestamp: new Date().toISOString(),
    };

    const detected = await service.handleMessage(guild, regularMember, msg);
    expect(detected).toBe(true);
    expect(mockApi.deleteMessage).toHaveBeenCalled();
    expect(mockApi.timeoutMember).toHaveBeenCalledWith(guild.id, regularMember.user.id, 300, expect.any(String));
  });

  it('adds warning to database when badwords_punishment is set to warn', async () => {
    db.updateGuildConfig(guild.id, {badwords_punishment: 'warn'});

    const msg: FluxerMessage = {
      id: 'msg_bad_3',
      channel_id: 'ch_chat',
      guild_id: guild.id,
      author: regularMember.user,
      content: 'lan siktir git',
      timestamp: new Date().toISOString(),
    };

    const detected = await service.handleMessage(guild, regularMember, msg);
    expect(detected).toBe(true);
    expect(mockApi.deleteMessage).toHaveBeenCalled();

    const warnings = db.getActiveWarnings(guild.id, regularMember.user.id);
    expect(warnings.length).toBe(1);
    expect(warnings[0].reason).toContain('siktir');
  });

  it('exempts server owner and administrators from bad words filter', async () => {
    const ownerMsg: FluxerMessage = {
      id: 'msg_owner',
      channel_id: 'ch_chat',
      guild_id: guild.id,
      author: ownerMember.user,
      content: 'orospu filtresi testi',
      timestamp: new Date().toISOString(),
    };

    const detected = await service.handleMessage(guild, ownerMember, ownerMsg);
    expect(detected).toBe(false);
    expect(mockApi.deleteMessage).not.toHaveBeenCalled();

    const adminMsg: FluxerMessage = {
      id: 'msg_admin',
      channel_id: 'ch_chat',
      guild_id: guild.id,
      author: adminMember.user,
      content: 'amk testi',
      timestamp: new Date().toISOString(),
    };

    const adminDetected = await service.handleMessage(guild, adminMember, adminMsg);
    expect(adminDetected).toBe(false);
  });

  it('allows adding, removing, listing, and clearing custom words', () => {
    // Add custom word
    const addRes = service.addWord(guild, ownerMember, 'reklamci');
    expect(addRes.success).toBe(true);

    const listRes = service.listWords(guild, ownerMember);
    expect(listRes.message).toContain('reklamci');

    // Detects custom word in chat
    expect(service.findBadWord('sen bir reklamci misin?', ['reklamci'], false)).toBe('reklamci');

    // Remove custom word
    const remRes = service.removeWord(guild, ownerMember, 'reklamci');
    expect(remRes.success).toBe(true);

    const listAfter = service.listWords(guild, ownerMember);
    expect(listAfter.message).toContain('Henüz özel bir kelime eklenmemiş');
  });
});
