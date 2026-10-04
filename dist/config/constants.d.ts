/**
 * Fluxer Gateway Opcodes
 * Discord Gateway v1 protocol compatibility
 */
export declare const GatewayOpcodes: {
    readonly DISPATCH: 0;
    readonly HEARTBEAT: 1;
    readonly IDENTIFY: 2;
    readonly PRESENCE_UPDATE: 3;
    readonly VOICE_STATE_UPDATE: 4;
    readonly VOICE_SERVER_PING: 5;
    readonly RESUME: 6;
    readonly RECONNECT: 7;
    readonly REQUEST_GUILD_MEMBERS: 8;
    readonly INVALID_SESSION: 9;
    readonly HELLO: 10;
    readonly HEARTBEAT_ACK: 11;
    readonly GATEWAY_ERROR: 12;
    readonly LAZY_REQUEST: 14;
    readonly REQUEST_GUILD_COUNTS: 15;
    readonly REQUEST_CHANNEL_MEMBER_COUNTS: 16;
};
/**
 * Fluxer 64-bit Permission Bitmask Flags
 */
export declare const Permissions: {
    readonly CREATE_INSTANT_INVITE: bigint;
    readonly KICK_MEMBERS: bigint;
    readonly BAN_MEMBERS: bigint;
    readonly ADMINISTRATOR: bigint;
    readonly MANAGE_CHANNELS: bigint;
    readonly MANAGE_GUILD: bigint;
    readonly ADD_REACTIONS: bigint;
    readonly VIEW_AUDIT_LOG: bigint;
    readonly PRIORITY_SPEAKER: bigint;
    readonly STREAM: bigint;
    readonly VIEW_CHANNEL: bigint;
    readonly SEND_MESSAGES: bigint;
    readonly SEND_TTS_MESSAGES: bigint;
    readonly MANAGE_MESSAGES: bigint;
    readonly EMBED_LINKS: bigint;
    readonly ATTACH_FILES: bigint;
    readonly READ_MESSAGE_HISTORY: bigint;
    readonly MENTION_EVERYONE: bigint;
    readonly USE_EXTERNAL_EMOJIS: bigint;
    readonly CONNECT: bigint;
    readonly SPEAK: bigint;
    readonly MUTE_MEMBERS: bigint;
    readonly DEAFEN_MEMBERS: bigint;
    readonly MOVE_MEMBERS: bigint;
    readonly USE_VAD: bigint;
    readonly CHANGE_NICKNAME: bigint;
    readonly MANAGE_NICKNAMES: bigint;
    readonly MANAGE_ROLES: bigint;
    readonly MANAGE_WEBHOOKS: bigint;
    readonly MANAGE_EXPRESSIONS: bigint;
    readonly USE_EXTERNAL_STICKERS: bigint;
    readonly MODERATE_MEMBERS: bigint;
    readonly CREATE_EXPRESSIONS: bigint;
    readonly PIN_MESSAGES: bigint;
    readonly BYPASS_SLOWMODE: bigint;
    readonly UPDATE_RTC_REGION: bigint;
    readonly VIEW_CHANNEL_MEMBERS: bigint;
};
export declare const ElevatedPermissions: bigint;
export declare const AuditLogActionType: {
    readonly GUILD_UPDATE: 1;
    readonly CHANNEL_CREATE: 10;
    readonly CHANNEL_UPDATE: 11;
    readonly CHANNEL_DELETE: 12;
    readonly MEMBER_KICK: 20;
    readonly MEMBER_PRUNE: 21;
    readonly MEMBER_BAN_ADD: 22;
    readonly MEMBER_BAN_REMOVE: 23;
    readonly MEMBER_UPDATE: 24;
    readonly MEMBER_ROLE_UPDATE: 25;
    readonly BOT_ADD: 28;
    readonly ROLE_CREATE: 30;
    readonly ROLE_UPDATE: 31;
    readonly ROLE_DELETE: 32;
    readonly INVITE_CREATE: 40;
    readonly INVITE_UPDATE: 41;
    readonly INVITE_DELETE: 42;
    readonly MESSAGE_DELETE: 72;
    readonly MESSAGE_BULK_DELETE: 73;
};
