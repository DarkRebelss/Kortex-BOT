// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, it, expect, beforeEach, vi} from 'vitest';
import {AntiRaidService} from '../src/services/AntiRaidService.js';
import {DatabaseClient} from '../src/database/DatabaseClient.js';
import type {FluxerGuild, FluxerMember} from '../src/types/fluxer.js';

describe('Anti-Raid / Join Gate System', () => {
  let db: DatabaseClient;
  let mockApi: any;
  let service: AntiRaidService;
  let guild: FluxerGuild;
  let adminMember: FluxerMember;

  beforeEach(() => {
    db = new DatabaseClient(':memory:');
    mockApi = {
      kickMember: vi.fn(async () => {}),
      timeoutMember: vi.fn(async () => ({})),
      sendMessage: vi.fn(async () => ({id: 'msg_alert'})),
    };

    service = new AntiRaidService(mockApi as any, db);

    guild = {
      id: 'guild_raid_1',
      name: 'Raid Test Sunucusu',
      owner_id: 'user_owner',
      roles: [
        {id: 'role_admin', name: 'Admin', color: 0, hoist: false, position: 2, permissions: (1n << 3n).toString()},
      ],
      channels: [],
      members: [],
    };

    adminMember = {
      user: {id: 'user_admin', username: 'AdminUser', discriminator: '0001', bot: false},
      roles: ['role_admin'],
      joined_at: new Date().toISOString(),
    };
  });

  it('does not trigger when antiraid is disabled', async () => {
    db.updateGuildConfig(guild.id, {antiraid_enabled: 0, antiraid_threshold: 3});

    for (let i = 0; i < 5; i++) {
      const member: FluxerMember = {
        user: {id: `bot_user_${i}`, username: `Bot${i}`, discriminator: '0001', bot: false},
        roles: [],
        joined_at: new Date().toISOString(),
      };
      const res = await service.handleMemberJoin(guild, member);
      expect(res.isRaid).toBe(false);
    }

    expect(mockApi.kickMember).not.toHaveBeenCalled();
  });

  it('triggers raid mode when joins exceed threshold and kicks raid accounts', async () => {
    db.updateGuildConfig(guild.id, {
      antiraid_enabled: 1,
      antiraid_threshold: 4,
      antiraid_action: 'kick',
    });

    // 3 joins: below threshold
    for (let i = 1; i <= 3; i++) {
      const member: FluxerMember = {
        user: {id: `user_${i}`, username: `User${i}`, discriminator: '0001', bot: false},
        roles: [],
        joined_at: new Date().toISOString(),
      };
      const res = await service.handleMemberJoin(guild, member);
      expect(res.isRaid).toBe(false);
    }
    expect(mockApi.kickMember).not.toHaveBeenCalled();

    // 4th join reaches threshold -> triggers raid mode and kicks
    const fourthMember: FluxerMember = {
      user: {id: 'user_4', username: 'User4', discriminator: '0001', bot: false},
      roles: [],
      joined_at: new Date().toISOString(),
    };
    const res4 = await service.handleMemberJoin(guild, fourthMember);
    expect(res4.isRaid).toBe(true);
    expect(res4.actionTaken).toBe('kick');
    expect(mockApi.kickMember).toHaveBeenCalledWith(guild.id, 'user_4', expect.stringContaining('Raid'));

    // Subsequent 5th join during active raid mode is automatically kicked
    const fifthMember: FluxerMember = {
      user: {id: 'user_5', username: 'User5', discriminator: '0001', bot: false},
      roles: [],
      joined_at: new Date().toISOString(),
    };
    const res5 = await service.handleMemberJoin(guild, fifthMember);
    expect(res5.isRaid).toBe(true);
    expect(res5.actionTaken).toBe('kick');
    expect(mockApi.kickMember).toHaveBeenCalledWith(guild.id, 'user_5', expect.stringContaining('Raid'));
  });

  it('applies timeout when antiraid_action is timeout', async () => {
    db.updateGuildConfig(guild.id, {
      antiraid_enabled: 1,
      antiraid_threshold: 2,
      antiraid_action: 'timeout',
    });

    const m1: FluxerMember = {
      user: {id: 'u1', username: 'U1', discriminator: '0001', bot: false},
      roles: [],
      joined_at: new Date().toISOString(),
    };
    await service.handleMemberJoin(guild, m1);

    const m2: FluxerMember = {
      user: {id: 'u2', username: 'U2', discriminator: '0001', bot: false},
      roles: [],
      joined_at: new Date().toISOString(),
    };
    const res2 = await service.handleMemberJoin(guild, m2);
    expect(res2.isRaid).toBe(true);
    expect(res2.actionTaken).toBe('timeout');
    expect(mockApi.timeoutMember).toHaveBeenCalledWith(guild.id, 'u2', 86400, expect.any(String));
  });

  it('allows administrator to toggle, set threshold, and set action', () => {
    const tRes = service.toggle(guild, adminMember, true);
    expect(tRes.success).toBe(true);
    expect(db.getGuildConfig(guild.id).antiraid_enabled).toBe(1);

    const limRes = service.setThreshold(guild, adminMember, 12);
    expect(limRes.success).toBe(true);
    expect(db.getGuildConfig(guild.id).antiraid_threshold).toBe(12);

    const actRes = service.setAction(guild, adminMember, 'timeout');
    expect(actRes.success).toBe(true);
    expect(db.getGuildConfig(guild.id).antiraid_action).toBe('timeout');

    const status = service.getStatus(guild);
    expect(status.message).toContain('Aktif');
    expect(status.message).toContain('12');
  });
});
