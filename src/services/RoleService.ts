// SPDX-License-Identifier: AGPL-3.0-or-later

import {Permissions} from '../config/constants.js';
import {MicupApiClient} from '../api/MicupApiClient.js';
import {DatabaseClient} from '../database/DatabaseClient.js';
import {PermissionService} from './PermissionService.js';
import {t} from '../locales/i18n.js';
import type {FluxerGuild, FluxerMember, FluxerRole, Snowflake} from '../types/fluxer.js';

export class RoleService {
  constructor(
    private readonly api: MicupApiClient,
    private readonly db: DatabaseClient,
  ) {}

  async addRole(
    guild: FluxerGuild,
    invoker: FluxerMember,
    botMember: FluxerMember,
    target: FluxerMember,
    role: FluxerRole,
  ): Promise<{success: boolean; message: string}> {
    const validation = PermissionService.validateRoleAssignment(
      guild,
      invoker,
      botMember,
      target,
      role,
    );

    if (!validation.allowed) {
      return {success: false, message: t(validation.errorKey!, validation.params)};
    }

    if (target.roles.includes(role.id)) {
      return {success: false, message: t('roles.already_has_role')};
    }

    try {
      await this.api.addMemberRole(guild.id, target.user.id, role.id, `Role added by ${invoker.user.username}`);

      this.db.addModerationLog(
        guild.id,
        'ROLE_ADD',
        target.user.id,
        invoker.user.id,
        `Added role: ${role.name}`,
        null,
        {roleId: role.id, roleName: role.name},
      );

      return {
        success: true,
        message: t('roles.add_success', {
          target: target.user.username,
          role: role.name,
        }),
      };
    } catch (err: any) {
      return {success: false, message: t('errors.command_error', {error: err.message})};
    }
  }

  async removeRole(
    guild: FluxerGuild,
    invoker: FluxerMember,
    botMember: FluxerMember,
    target: FluxerMember,
    role: FluxerRole,
  ): Promise<{success: boolean; message: string}> {
    const validation = PermissionService.validateRoleAssignment(
      guild,
      invoker,
      botMember,
      target,
      role,
    );

    if (!validation.allowed) {
      return {success: false, message: t(validation.errorKey!, validation.params)};
    }

    if (!target.roles.includes(role.id)) {
      return {success: false, message: t('roles.does_not_have_role')};
    }

    try {
      await this.api.removeMemberRole(guild.id, target.user.id, role.id, `Role removed by ${invoker.user.username}`);

      this.db.addModerationLog(
        guild.id,
        'ROLE_REMOVE',
        target.user.id,
        invoker.user.id,
        `Removed role: ${role.name}`,
        null,
        {roleId: role.id, roleName: role.name},
      );

      return {
        success: true,
        message: t('roles.remove_success', {
          target: target.user.username,
          role: role.name,
        }),
      };
    } catch (err: any) {
      return {success: false, message: t('errors.command_error', {error: err.message})};
    }
  }

  setAutorole(
    guild: FluxerGuild,
    invoker: FluxerMember,
    botMember: FluxerMember,
    role: FluxerRole,
  ): {success: boolean; message: string} {
    if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_ROLES)) {
      return {success: false, message: t('errors.no_permission')};
    }

    const botPos = PermissionService.getHighestRolePosition(guild, botMember);
    if (botPos <= role.position) {
      return {success: false, message: t('errors.role_hierarchy_bot')};
    }

    this.db.updateGuildConfig(guild.id, {
      autorole_id: role.id,
      autorole_enabled: 1,
    });

    return {
      success: true,
      message: t('roles.autorole_set', {role: role.name}),
    };
  }

  removeAutorole(
    guild: FluxerGuild,
    invoker: FluxerMember,
  ): {success: boolean; message: string} {
    if (!PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_ROLES)) {
      return {success: false, message: t('errors.no_permission')};
    }

    this.db.updateGuildConfig(guild.id, {
      autorole_id: null,
      autorole_enabled: 0,
    });

    return {
      success: true,
      message: t('roles.autorole_removed'),
    };
  }

  getAutoroleStatus(guild: FluxerGuild): string {
    const config = this.db.getGuildConfig(guild.id);
    if (!config.autorole_enabled || !config.autorole_id) {
      return t('roles.autorole_status', {role: 'Yok', status: 'Devre Dışı'});
    }

    const role = guild.roles.find((r) => r.id === config.autorole_id);
    return t('roles.autorole_status', {
      role: role ? role.name : config.autorole_id,
      status: 'Aktif',
    });
  }

  /**
   * Handle auto-role when a new member joins (GUILD_MEMBER_ADD)
   */
  async handleMemberJoin(guildId: Snowflake, userId: Snowflake): Promise<void> {
    const config = this.db.getGuildConfig(guildId);
    if (!config.autorole_enabled || !config.autorole_id) return;

    try {
      await this.api.addMemberRole(guildId, userId, config.autorole_id, 'Automated AutoRole on join');
      console.log(`[RoleService] Auto-role ${config.autorole_id} granted to new member ${userId} in guild ${guildId}`);
    } catch (err) {
      console.error(`[RoleService] Failed to assign auto-role to ${userId} in ${guildId}:`, err);
    }
  }
}
