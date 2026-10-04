// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, it, expect} from 'vitest';
import {Permissions} from '../src/config/constants.js';
import {PermissionService} from '../src/services/PermissionService.js';
import type {FluxerGuild, FluxerMember, FluxerRole} from '../src/types/fluxer.js';

describe('Permission and Role Hierarchy Tests', () => {
  const adminRole: FluxerRole = {
    id: 'role_admin',
    name: 'Admin',
    color: 0,
    hoist: true,
    position: 10,
    permissions: (Permissions.ADMINISTRATOR | Permissions.BAN_MEMBERS).toString(),
  };

  const botRole: FluxerRole = {
    id: 'role_bot',
    name: 'Bot Manager',
    color: 0,
    hoist: true,
    position: 8,
    permissions: (
      Permissions.BAN_MEMBERS |
      Permissions.KICK_MEMBERS |
      Permissions.MODERATE_MEMBERS |
      Permissions.MANAGE_ROLES |
      Permissions.MANAGE_MESSAGES
    ).toString(),
  };

  const modRole: FluxerRole = {
    id: 'role_mod',
    name: 'Moderator',
    color: 0,
    hoist: true,
    position: 5,
    permissions: (Permissions.BAN_MEMBERS | Permissions.KICK_MEMBERS | Permissions.MODERATE_MEMBERS).toString(),
  };

  const memberRole: FluxerRole = {
    id: 'role_member',
    name: 'Member',
    color: 0,
    hoist: false,
    position: 1,
    permissions: Permissions.SEND_MESSAGES.toString(),
  };

  const ownerMember: FluxerMember = {
    user: {id: 'user_owner', username: 'GuildOwner', discriminator: '0001'},
    roles: [],
    joined_at: new Date().toISOString(),
  };

  const adminMember: FluxerMember = {
    user: {id: 'user_admin', username: 'AdminUser', discriminator: '0002'},
    roles: ['role_admin'],
    joined_at: new Date().toISOString(),
  };

  const botMember: FluxerMember = {
    user: {id: 'user_bot', username: 'MicupBot', discriminator: '0000', bot: true},
    roles: ['role_bot'],
    joined_at: new Date().toISOString(),
  };

  const modMember: FluxerMember = {
    user: {id: 'user_mod', username: 'ModUser', discriminator: '0003'},
    roles: ['role_mod'],
    joined_at: new Date().toISOString(),
  };

  const normalMember: FluxerMember = {
    user: {id: 'user_normal', username: 'NormalUser', discriminator: '0004'},
    roles: ['role_member'],
    joined_at: new Date().toISOString(),
  };

  const mockGuild: FluxerGuild = {
    id: 'guild_1',
    name: 'Test Community',
    owner_id: 'user_owner',
    roles: [adminRole, botRole, modRole, memberRole],
    members: [ownerMember, adminMember, botMember, modMember, normalMember],
    channels: [],
  };

  // -------------------------------------------------------------
  // Test 1: Admin normal kullanıcıyı banlayabiliyor mu?
  // -------------------------------------------------------------
  it('Admin can ban normal user', () => {
    const res = PermissionService.validateModerationAction(
      mockGuild,
      adminMember,
      botMember,
      normalMember,
      Permissions.BAN_MEMBERS,
      'BAN_MEMBERS',
    );
    expect(res.allowed).toBe(true);
  });

  // -------------------------------------------------------------
  // Test 2: Moderator Admin\'i banlamaya çalışırsa engelleniyor mu?
  // -------------------------------------------------------------
  it('Moderator attempting to ban Admin is blocked due to role hierarchy', () => {
    const res = PermissionService.validateModerationAction(
      mockGuild,
      modMember,
      botMember,
      adminMember,
      Permissions.BAN_MEMBERS,
      'BAN_MEMBERS',
    );
    expect(res.allowed).toBe(false);
    expect(res.errorKey).toBe('errors.user_hierarchy');
  });

  // -------------------------------------------------------------
  // Test 3: Bot kendi rolünden yüksek rolü verebiliyor mu? Verememeli!
  // -------------------------------------------------------------
  it('Bot cannot grant a role higher in hierarchy than its own highest role', () => {
    const res = PermissionService.validateRoleAssignment(
      mockGuild,
      ownerMember, // Owner has permission
      botMember,   // Bot's position is 8
      normalMember,
      adminRole,   // Admin role position is 10 > 8
    );
    expect(res.allowed).toBe(false);
    expect(res.errorKey).toBe('errors.role_hierarchy_bot');
  });

  it('Bot can grant a role lower in hierarchy than its own highest role', () => {
    const res = PermissionService.validateRoleAssignment(
      mockGuild,
      ownerMember,
      botMember,
      normalMember,
      modRole, // Mod role position is 5 < 8
    );
    expect(res.allowed).toBe(true);
  });

  // -------------------------------------------------------------
  // Test 4: Owner banlanabiliyor mu? Banlanamamalı!
  // -------------------------------------------------------------
  it('Owner cannot be banned even by an Administrator', () => {
    const res = PermissionService.validateModerationAction(
      mockGuild,
      adminMember,
      botMember,
      ownerMember,
      Permissions.BAN_MEMBERS,
      'BAN_MEMBERS',
    );
    expect(res.allowed).toBe(false);
    expect(res.errorKey).toBe('errors.target_owner');
  });

  // -------------------------------------------------------------
  // Test 5: Yetkisiz kullanıcı moderasyon komutu kullanabiliyor mu? Kullanamamalı!
  // -------------------------------------------------------------
  it('Unauthorized normal user cannot ban or moderate', () => {
    const res = PermissionService.validateModerationAction(
      mockGuild,
      normalMember,
      botMember,
      normalMember,
      Permissions.BAN_MEMBERS,
      'BAN_MEMBERS',
    );
    expect(res.allowed).toBe(false);
  });

  // -------------------------------------------------------------
  // Test: Bot cannot ban target higher than bot itself
  // -------------------------------------------------------------
  it('Bot cannot moderate a user who outranks the bot', () => {
    const res = PermissionService.validateModerationAction(
      mockGuild,
      ownerMember,
      botMember,   // Bot position = 8
      adminMember, // Admin position = 10
      Permissions.BAN_MEMBERS,
      'BAN_MEMBERS',
    );
    expect(res.allowed).toBe(false);
    expect(res.errorKey).toBe('errors.bot_hierarchy');
  });
});
