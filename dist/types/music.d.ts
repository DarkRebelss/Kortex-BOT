export type TrackSource = 'youtube' | 'spotify' | 'soundcloud' | 'applemusic' | 'deezer' | 'direct' | 'radio';
export interface Track {
    id: string;
    title: string;
    artist: string;
    url: string;
    streamUrl?: string;
    durationSeconds: number;
    thumbnailUrl?: string;
    source: TrackSource;
    requester: {
        id: string;
        username: string;
        discriminator?: string;
    };
    addedAt: number;
}
export type LoopMode = 'off' | 'track' | 'queue';
export type PlayerState = 'playing' | 'paused' | 'stopped';
export interface GuildPlayer {
    guildId: string;
    channelId: string;
    voiceChannelId: string | null;
    voiceChannelName?: string | null;
    queue: Track[];
    currentTrack: Track | null;
    state: PlayerState;
    volume: number;
    loopMode: LoopMode;
    playbackStartTime: number;
    playbackElapsedSeconds: number;
    lastMessageId?: string;
    isMixActive?: boolean;
    playlistTitle?: string;
    filter?: string | null;
    filterName?: string | null;
}
export interface VoiceGatewayHandler {
    sendVoiceStateUpdate(guildId: string, channelId: string | null, selfMute?: boolean, selfDeaf?: boolean): void;
}
export interface RadioStation {
    key: string;
    name: string;
    genre: string;
    url: string;
    logoUrl?: string;
}
