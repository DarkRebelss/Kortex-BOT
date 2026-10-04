import type { MicupApiClient } from '../api/MicupApiClient.js';
import type { DiscordActionRowComponent, FluxerMember, Snowflake } from '../types/fluxer.js';
import type { GuildPlayer, LoopMode, RadioStation, Track, TrackSource, VoiceGatewayHandler } from '../types/music.js';
export declare const RADIO_STATIONS: RadioStation[];
import { MicupVoiceClient } from '../voice/MicupVoiceClient.js';
export declare class MusicService {
    private readonly api;
    private gateway?;
    private players;
    private timers;
    private idleTimers;
    private userVoiceStates;
    private voiceClient?;
    private spotifyMatcher;
    private spotifyWebAPI;
    constructor(api: MicupApiClient, gateway?: VoiceGatewayHandler | undefined);
    setGateway(gateway: VoiceGatewayHandler): void;
    setVoiceClient(voiceClient: MicupVoiceClient): void;
    isVoiceConnected(guildId: string): boolean;
    clearIdleTimer(guildId: string): void;
    updateVoiceState(guildId: Snowflake, userId: Snowflake, channelId: Snowflake | null): void;
    getUserVoiceChannel(guildId: Snowflake, userId: Snowflake): Snowflake | undefined;
    connectToVoice(guildId: string, voiceChannelId: string, voiceChannelName?: string): void;
    disconnectFromVoice(guildId: string): void;
    handleBotVoiceDisconnect(guildId: string): void;
    join(guildId: string, textChannelId: string, voiceChannelId: string, voiceChannelName?: string): {
        success: boolean;
        message: string;
    };
    leave(guildId: string): {
        success: boolean;
        message: string;
    };
    getOrCreatePlayer(guildId: string, channelId: string): GuildPlayer;
    getPlayer(guildId: string): GuildPlayer | undefined;
    private startPlayerTicker;
    private stopPlayerTicker;
    private tickPlayer;
    private triggerPlayback;
    private handleTrackEnd;
    resolveInput(input: string, requester: {
        id: string;
        username: string;
        discriminator?: string;
    }): Promise<Track>;
    private fetchOembed;
    private extractYouTubeTitleFallback;
    private extractPathTitle;
    private extractFilename;
    private cleanSearchTitle;
    private resolveSpotifyDirectAudioStream;
    resolvePlaylist(input: string, requester: {
        id: string;
        username: string;
        discriminator?: string;
    }, maxTracks?: number, isExplicitMixCommand?: boolean): Promise<{
        playlistTitle: string;
        tracks: Track[];
    } | null>;
    play(guildId: string, channelId: string, input: string, invoker: FluxerMember): Promise<{
        track?: Track;
        isPlayingNow: boolean;
        position: number;
        message: string;
        components?: DiscordActionRowComponent[];
    }>;
    playMix(guildId: string, channelId: string, input: string, invoker: FluxerMember): Promise<{
        track?: Track;
        isPlayingNow: boolean;
        position: number;
        message: string;
        components?: DiscordActionRowComponent[];
    }>;
    playNow(guildId: string, channelId: string, input: string, invoker: FluxerMember): Promise<{
        track?: Track;
        isPlayingNow: boolean;
        position: number;
        message: string;
        components?: DiscordActionRowComponent[];
    }>;
    playNext(guildId: string, channelId: string, input: string, invoker: FluxerMember): Promise<{
        track?: Track;
        isPlayingNow: boolean;
        position: number;
        message: string;
        components?: DiscordActionRowComponent[];
    }>;
    skipTo(guildId: string, position: number): Promise<{
        success: boolean;
        message: string;
        components?: DiscordActionRowComponent[];
    }>;
    pause(guildId: string): {
        success: boolean;
        message: string;
        components?: DiscordActionRowComponent[];
    };
    resume(guildId: string): {
        success: boolean;
        message: string;
        components?: DiscordActionRowComponent[];
    };
    skip(guildId: string): Promise<{
        success: boolean;
        message: string;
        components?: DiscordActionRowComponent[];
    }>;
    stop(guildId: string): {
        success: boolean;
        message: string;
    };
    getQueue(guildId: string, page?: number): {
        message: string;
        components?: DiscordActionRowComponent[];
    };
    getNowPlaying(guildId: string): {
        message: string;
        components?: DiscordActionRowComponent[];
    };
    setVolume(guildId: string, volume: number): {
        success: boolean;
        message: string;
    };
    setFilter(guildId: string, filterType: string, param?: string): {
        success: boolean;
        message: string;
        filterName?: string;
    };
    clearFilter(guildId: string): {
        success: boolean;
        message: string;
    };
    getFilter(guildId: string): {
        filterName: string | null;
        rawFilter?: string | null;
    };
    setLoop(guildId: string, targetMode?: LoopMode): {
        success: boolean;
        loopMode: LoopMode;
        message: string;
        components?: DiscordActionRowComponent[];
    };
    shuffle(guildId: string): {
        success: boolean;
        message: string;
    };
    remove(guildId: string, index: number): {
        success: boolean;
        message: string;
    };
    clearQueue(guildId: string): {
        success: boolean;
        message: string;
    };
    seek(guildId: string, seconds: number): {
        success: boolean;
        message: string;
    };
    playRadio(guildId: string, channelId: string, stationKey: string, invoker: FluxerMember): Promise<{
        success: boolean;
        message: string;
        components?: DiscordActionRowComponent[];
    }>;
    getElapsedSeconds(player: GuildPlayer): number;
    buildNowPlayingEmbed(player: GuildPlayer): string;
    buildPlayerButtons(): DiscordActionRowComponent[];
    private sendNowPlaying;
    createProgressBar(elapsed: number, total: number, size?: number): string;
    formatDuration(seconds: number): string;
    getSourceBadge(source: TrackSource): string;
}
