// SPDX-License-Identifier: AGPL-3.0-or-later

import {Permissions} from '../config/constants.js';
import type {FluxerGuild, FluxerMember, FluxerRole, Snowflake} from '../types/fluxer.js';

export interface PermissionCheckResult {
  allowed: boolean;
  errorKey?: string;
  params?: Record<string, string | number>;
}

export class PermissionService {
  /**
   * Compute total permissions for a guild member
   */
  static computePermissions(guild: FluxerGuild, member: FluxerMember): bigint {
    // Guild owner has all permissions
    if (member.user.id === guild.owner_id) {
      return ~0n;
    }

    let permissions = 0n;

    // Start with @everyone role permissions if found
    const everyoneRole = guild.roles.find((r) => r.id === guild.id);
    if (everyoneRole) {
      permissions |= BigInt(everyoneRole.permissions);
    }

    // Add permissions from each assigned role
    for (const roleId of member.roles) {
      const role = guild.roles.find((r) => r.id === roleId);
      if (role) {
        permissions |= BigInt(role.permissions);
      }
    }

    // If ADMINISTRATOR is granted, member effectively has all permissions
    if ((permissions & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR) {
      return ~0n;
    }

    return permissions;
  }

  /**
   * Check if a member has a specific permission bit
   */
  static hasPermission(guild: FluxerGuild, member: FluxerMember, permission: bigint): boolean {
    const total = this.computePermissions(guild, member);
    return (total & permission) === permission;
  }

  /**
   * Check if a member has administrative or moderation privileges (Owner, Admin, or Moderator permissions/roles)
   */
  static isModeratorOrAdmin(guild: FluxerGuild, member: FluxerMember): boolean {
    if (member.user.id === guild.owner_id) {
      return true;
    }
    if (this.hasPermission(guild, member, Permissions.ADMINISTRATOR)) {
      return true;
    }
    const modPerms =
      Permissions.MANAGE_GUILD |
      Permissions.BAN_MEMBERS |
      Permissions.KICK_MEMBERS |
      Permissions.MANAGE_MESSAGES |
      Permissions.MODERATE_MEMBERS |
      Permissions.MANAGE_ROLES |
      Permissions.MANAGE_CHANNELS;

    const total = this.computePermissions(guild, member);
    if ((total & modPerms) !== 0n) {
      return true;
    }

    if (member.roles && guild.roles) {
      for (const roleId of member.roles) {
        const role = guild.roles.find((r) => r.id === roleId);
        if (role?.name) {
          const lower = role.name.toLowerCase();
          if (
            lower.includes('admin') ||
            lower.includes('moderat') ||
            lower.includes('yönetici') ||
            lower.includes('yonetici') ||
            lower === 'mod' ||
            lower.startsWith('mod ') ||
            lower.endsWith(' mod')
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Get the highest role for a member.
   */
  static getHighestRole(guild: FluxerGuild, member: FluxerMember): FluxerRole | null {
    if (!member.roles || member.roles.length === 0 || !guild.roles || guild.roles.length === 0) {
      return null;
    }

    let highestRole: FluxerRole | null = null;
    let highestPos = -1;

    for (const roleId of member.roles) {
      const roleIdx = guild.roles.findIndex((r) => r.id === roleId);
      if (roleIdx !== -1) {
        const role = guild.roles[roleIdx];
        let pos = Number(role.position);
        if (Number.isNaN(pos)) {
          pos = roleIdx;
        }
        if (pos > highestPos) {
          highestPos = pos;
          highestRole = role;
        }
      }
    }

    return highestRole;
  }

  /**
   * Get the highest role position for a member.
   * Owner gets Number.POSITIVE_INFINITY so they always rank highest.
   */
  static getHighestRolePosition(guild: FluxerGuild, member: FluxerMember): number {
    if (member.user.id === guild.owner_id) {
      return Number.POSITIVE_INFINITY;
    }

    if (!member.roles || member.roles.length === 0 || !guild.roles || guild.roles.length === 0) {
      return 0;
    }

    let highest = 0;
    for (const roleId of member.roles) {
      const roleIdx = guild.roles.findIndex((r) => r.id === roleId);
      if (roleIdx !== -1) {
        const role = guild.roles[roleIdx];
        let pos = Number(role.position);
        if (Number.isNaN(pos)) {
          pos = roleIdx;
        }
        if (pos > highest) {
          highest = pos;
        }
      }
    }
    return highest;
  }

  /**
   * Strict Moderation Hierarchy Validation
   * Checks:
   * 1. Target cannot be Owner
   * 2. Target cannot be actor or bot itself
   * 3. Actor must have required permission
   * 4. Bot must have required permission
   * 5. Actor must rank strictly higher than target (unless actor is Owner)
   * 6. Bot must rank strictly higher than target
   */
  static validateModerationAction(
    guild: FluxerGuild,
    actorMember: FluxerMember,
    botMember: FluxerMember,
    targetMember: FluxerMember,
    requiredPermission: bigint,
    permissionName = 'MODERATE_MEMBERS',
  ): PermissionCheckResult {
    const isUntimeout = permissionName === 'UNTIMEOUT';

    // 1. Owner protection
    if (targetMember.user.id === guild.owner_id) {
      if (isUntimeout && actorMember.user.id === guild.owner_id) {
        // Sunucu sahibi kendi üzerindeki zamanaşımını / aktif ceza kaydını kaldırabilir
      } else {
        return {allowed: false, errorKey: 'errors.target_owner'};
      }
    }

    // 2. Self / Bot checks
    if (targetMember.user.id === actorMember.user.id) {
      if (isUntimeout && (actorMember.user.id === guild.owner_id || this.hasPermission(guild, actorMember, Permissions.ADMINISTRATOR))) {
        // Sunucu sahibi veya yönetici kendi üzerindeki mute/timeout kaydını temizleyebilir
      } else {
        return {allowed: false, errorKey: 'errors.target_self'};
      }
    }
    if (targetMember.user.id === botMember.user.id) {
      return {allowed: false, errorKey: 'errors.target_bot'};
    }

    // 3. Actor permission check
    if (!this.hasPermission(guild, actorMember, requiredPermission)) {
      return {allowed: false, errorKey: 'errors.no_permission'};
    }

    // 4. Bot permission check
    if (!this.hasPermission(guild, botMember, requiredPermission)) {
      return {
        allowed: false,
        errorKey: 'errors.bot_missing_permission',
        params: {permission: permissionName},
      };
    }

    // 5. Actor hierarchy vs target (En üstteki rol alt rollere ceza verebilir; alt veya eşit roller ceza veremez)
    const actorPos = this.getHighestRolePosition(guild, actorMember);
    const targetPos = this.getHighestRolePosition(guild, targetMember);

    if (actorMember.user.id !== guild.owner_id && actorPos <= targetPos) {
      const actorRole = this.getHighestRole(guild, actorMember);
      const targetRole = this.getHighestRole(guild, targetMember);
      return {
        allowed: false,
        errorKey: 'errors.user_hierarchy',
        params: {
          userRole: actorRole ? `@${actorRole.name}` : '@everyone',
          targetRole: targetRole ? `@${targetRole.name}` : '@everyone',
        },
      };
    }

    // 6. Bot hierarchy vs target
    const botPos = this.getHighestRolePosition(guild, botMember);
    if (!isUntimeout && botPos <= targetPos) {
      const botRole = this.getHighestRole(guild, botMember);
      const targetRole = this.getHighestRole(guild, targetMember);
      return {
        allowed: false,
        errorKey: 'errors.bot_hierarchy',
        params: {
          botRole: botRole ? `@${botRole.name}` : '@everyone',
          targetRole: targetRole ? `@${targetRole.name}` : '@everyone',
        },
      };
    }

    // 7. Administrator protection (Discord hard restriction: administrators cannot be timed out or moderated by bots)
    if (!isUntimeout && this.hasPermission(guild, targetMember, Permissions.ADMINISTRATOR)) {
      return {allowed: false, errorKey: 'errors.target_admin'};
    }

    return {allowed: true};
  }

  /**
   * Strict Role Management Hierarchy Validation
   * Checks:
   * 1. Actor has MANAGE_ROLES
   * 2. Bot has MANAGE_ROLES
   * 3. Actor ranks higher than target role
   * 4. Bot ranks higher than target role
   * 5. Bot ranks higher than target member
   */
  static validateRoleAssignment(
    guild: FluxerGuild,
    actorMember: FluxerMember,
    botMember: FluxerMember,
    targetMember: FluxerMember,
    targetRole: FluxerRole,
  ): PermissionCheckResult {
    // Actor permission
    if (!this.hasPermission(guild, actorMember, Permissions.MANAGE_ROLES)) {
      return {allowed: false, errorKey: 'errors.no_permission'};
    }

    // Bot permission
    if (!this.hasPermission(guild, botMember, Permissions.MANAGE_ROLES)) {
      return {
        allowed: false,
        errorKey: 'errors.bot_missing_permission',
        params: {permission: 'MANAGE_ROLES'},
      };
    }

    const actorPos = this.getHighestRolePosition(guild, actorMember);
    const botPos = this.getHighestRolePosition(guild, botMember);
    const targetMemberPos = this.getHighestRolePosition(guild, targetMember);

    // Actor vs Role position
    if (actorMember.user.id !== guild.owner_id && actorPos <= targetRole.position) {
      return {allowed: false, errorKey: 'errors.user_hierarchy'};
    }

    // Bot vs Role position
    if (botPos <= targetRole.position) {
      return {allowed: false, errorKey: 'errors.role_hierarchy_bot'};
    }

    // Bot vs Target member position (cannot modify member who outranks bot)
    if (botPos <= targetMemberPos && targetMember.user.id !== botMember.user.id) {
      return {allowed: false, errorKey: 'errors.bot_hierarchy'};
    }

    return {allowed: true};
  }
}
