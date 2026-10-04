export type Snowflake = string;
export interface FluxerUser {
    id: Snowflake;
    username: string;
    discriminator: string;
    avatar?: string | null;
    avatar_hash?: string | null;
    banner?: string | null;
    banner_hash?: string | null;
    global_name?: string | null;
    bot?: boolean;
    system?: boolean;
    created_at?: string;
}
export interface FluxerRole {
    id: Snowflake;
    name: string;
    color: number;
    hoist: boolean;
    position: number;
    permissions: string;
    managed?: boolean;
    mentionable?: boolean;
}
export interface FluxerMember {
    user: FluxerUser;
    nick?: string | null;
    roles: Snowflake[];
    joined_at: string;
    communication_disabled_until?: string | null;
    avatar?: string | null;
    banner?: string | null;
}
export interface FluxerOverwrite {
    id: Snowflake;
    type: number;
    allow: string;
    deny: string;
}
export interface FluxerChannel {
    id: Snowflake;
    guild_id?: Snowflake;
    name: string;
    type: number;
    position?: number;
    topic?: string | null;
    parent_id?: Snowflake | null;
    rate_limit_per_user?: number | null;
    permission_overwrites?: FluxerOverwrite[];
}
export interface FluxerGuild {
    id: Snowflake;
    name: string;
    owner_id: Snowflake;
    system_channel_id?: Snowflake | null;
    rules_channel_id?: Snowflake | null;
    members: FluxerMember[];
    roles: FluxerRole[];
    channels: FluxerChannel[];
    member_count?: number;
    unavailable?: boolean;
}
export interface FluxerMessage {
    id: Snowflake;
    channel_id: Snowflake;
    guild_id?: Snowflake;
    author: FluxerUser;
    content: string;
    timestamp: string;
    edited_timestamp?: string | null;
    tts?: boolean;
    mention_everyone?: boolean;
    mentions?: FluxerUser[];
    mention_roles?: Snowflake[];
    pinned?: boolean;
    type?: number;
}
export interface GatewayPayload<T = unknown> {
    op: number;
    d: T;
    s?: number | null;
    t?: string | null;
}
export interface GatewayHelloData {
    heartbeat_interval: number;
}
export interface GatewayReadyData {
    v: number;
    user: FluxerUser;
    guilds: Array<{
        id: Snowflake;
        unavailable?: boolean;
    }>;
    session_id: string;
    resume_gateway_url?: string;
    shard?: [number, number];
}
export interface GatewayIdentifyProperties {
    os: string;
    browser: string;
    device: string;
}
export interface GatewayIdentifyData {
    token: string;
    properties: GatewayIdentifyProperties;
    compress?: boolean;
    large_threshold?: number;
    shard?: [number, number];
    intents?: number;
}
export interface GatewayResumeData {
    token: string;
    session_id: string;
    seq: number;
}
export interface FluxerBan {
    user: FluxerUser;
    reason?: string | null;
}
export interface DiscordEmoji {
    id?: Snowflake | null;
    name: string;
    animated?: boolean;
}
export interface DiscordButtonComponent {
    type: 2;
    style: number;
    custom_id?: string;
    label?: string;
    emoji?: DiscordEmoji;
    disabled?: boolean;
    url?: string;
}
export interface DiscordActionRowComponent {
    type: 1;
    components: DiscordButtonComponent[];
}
export type DiscordComponent = DiscordActionRowComponent | DiscordButtonComponent;
export interface FluxerInteraction {
    id: Snowflake;
    application_id?: Snowflake;
    type: number;
    data?: {
        id?: Snowflake;
        name?: string;
        component_type?: number;
        custom_id?: string;
        values?: string[];
    };
    guild_id?: Snowflake;
    channel_id?: Snowflake;
    member?: FluxerMember;
    user?: FluxerUser;
    token: string;
    version?: number;
    message?: FluxerMessage;
}
export interface FluxerReactionEvent {
    user_id: Snowflake;
    channel_id: Snowflake;
    message_id: Snowflake;
    guild_id?: Snowflake;
    emoji: DiscordEmoji;
    member?: FluxerMember;
}
export interface FluxerVoiceState {
    guild_id?: Snowflake;
    channel_id: Snowflake | null;
    user_id: Snowflake;
    member?: FluxerMember;
    session_id: string;
    deaf?: boolean;
    mute?: boolean;
    self_deaf?: boolean;
    self_mute?: boolean;
    self_video?: boolean;
    suppress?: boolean;
}
export interface DiscordPollMedia {
    text?: string;
    emoji?: DiscordEmoji;
}
export interface DiscordPollAnswer {
    answer_id?: number;
    poll_media: DiscordPollMedia;
}
export interface DiscordPollCreate {
    question: DiscordPollMedia;
    answers: DiscordPollAnswer[];
    duration?: number;
    allow_multiselect?: boolean;
    layout_type?: number;
}
export interface FluxerPollVoteEvent {
    user_id: Snowflake;
    channel_id: Snowflake;
    message_id: Snowflake;
    guild_id?: Snowflake;
    answer_id: number;
}
