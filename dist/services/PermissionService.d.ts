import type { FluxerGuild, FluxerMember, FluxerRole } from '../types/fluxer.js';
export interface PermissionCheckResult {
    allowed: boolean;
    errorKey?: string;
    params?: Record<string, string | number>;
}
export declare class PermissionService {
    /**
     * Compute total permissions for a guild member
     */
    static computePermissions(guild: FluxerGuild, member: FluxerMember): bigint;
    /**
     * Check if a member has a specific permission bit
     */
    static hasPermission(guild: FluxerGuild, member: FluxerMember, permission: bigint): boolean;
    /**
     * Check if a member has administrative or moderation privileges (Owner, Admin, or Moderator permissions/roles)
     */
    static isModeratorOrAdmin(guild: FluxerGuild, member: FluxerMember): boolean;
    /**
     * Get the highest role for a member.
     */
    static getHighestRole(guild: FluxerGuild, member: FluxerMember): FluxerRole | null;
    /**
     * Get the highest role position for a member.
     * Owner gets Number.POSITIVE_INFINITY so they always rank highest.
     */
    static getHighestRolePosition(guild: FluxerGuild, member: FluxerMember): number;
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
    static validateModerationAction(guild: FluxerGuild, actorMember: FluxerMember, botMember: FluxerMember, targetMember: FluxerMember, requiredPermission: bigint, permissionName?: string): PermissionCheckResult;
    /**
     * Strict Role Management Hierarchy Validation
     * Checks:
     * 1. Actor has MANAGE_ROLES
     * 2. Bot has MANAGE_ROLES
     * 3. Actor ranks higher than target role
     * 4. Bot ranks higher than target role
     * 5. Bot ranks higher than target member
     */
    static validateRoleAssignment(guild: FluxerGuild, actorMember: FluxerMember, botMember: FluxerMember, targetMember: FluxerMember, targetRole: FluxerRole): PermissionCheckResult;
}
