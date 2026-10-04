/**
 * Müzik modülü için temel TypeScript tipleri
 */
export type Snowflake = string;
/**
 * Ses kaynağı türleri
 */
export declare enum AudioSource {
    YOUTUBE = "youtube",
    SPOTIFY = "spotify",
    SOUNDCLOUD = "soundcloud",
    DIRECT = "direct"
}
/**
 * Döngü modları
 */
export declare enum LoopMode {
    OFF = "off",
    SINGLE = "single",
    QUEUE = "queue"
}
/**
 * Oynatıcı durumu
 */
export declare enum PlayerState {
    IDLE = "idle",
    PLAYING = "playing",
    PAUSED = "paused",
    BUFFERING = "buffering",
    ERROR = "error"
}
/**
 * Parça metadata'sı
 */
export interface Track {
    /** Benzersiz kimlik */
    id: string;
    /** Şarkı adı */
    title: string;
    /** Sanatçı adı */
    artist: string;
    /** Orijinal URL (Spotify/YouTube vb.) */
    url: string;
    /** Ses akış URL'i (YouTube/SoundCloud vb.) */
    streamUrl: string;
    /** Süre (saniye) */
    duration: number;
    /** Küçük resim URL'i */
    thumbnail?: string;
    /** Kaynak türü */
    source: AudioSource;
    /** İsteyen kullanıcı ID'si */
    requester: Snowflake;
    /** Kuyruğa eklenme zamanı */
    addedAt: number;
    /** ISRC kodu (Spotify için) */
    isrc?: string;
    /** Albüm adı */
    album?: string;
}
/**
 * Kuyruk yapısı
 */
export interface Queue {
    /** Şu an çalan parça */
    current: Track | null;
    /** Sıradaki parçalar */
    tracks: Track[];
    /** Döngü modu */
    loopMode: LoopMode;
    /** Ses seviyesi (0-100) */
    volume: number;
    /** Duraklatılmış mı */
    paused: boolean;
}
/**
 * Oynatıcı seçenekleri
 */
export interface PlayerOptions {
    /** Sunucu ID'si */
    guildId: Snowflake;
    /** Ses kanalı ID'si */
    voiceChannelId: Snowflake;
    /** Ses kanalı adı */
    voiceChannelName?: string;
    /** Metin kanalı ID'si (bildirimler için) */
    textChannelId?: Snowflake;
    /** Varsayılan ses seviyesi */
    defaultVolume?: number;
    /** Otomatik ayrılma süresi (ms) */
    autoLeaveTimeout?: number;
}
/**
 * Olay tipleri
 */
export declare enum MusicEvent {
    TRACK_START = "trackStart",
    TRACK_END = "trackEnd",
    TRACK_ERROR = "trackError",
    QUEUE_ADD = "queueAdd",
    QUEUE_EMPTY = "queueEmpty",
    PLAYER_PAUSE = "playerPause",
    PLAYER_RESUME = "playerResume",
    VOICE_DISCONNECT = "voiceDisconnect"
}
/**
 * Olay verisi
 */
export interface MusicEventData {
    guildId: Snowflake;
    track?: Track;
    error?: Error;
    reason?: string;
}
/**
 * Spotify track metadata'sı
 */
export interface SpotifyTrackMetadata {
    id: string;
    title: string;
    artist: string;
    album?: string;
    duration: number;
    isrc?: string;
    releaseDate?: string;
}
/**
 * YouTube arama sonucu
 */
export interface YouTubeSearchResult {
    id: string;
    title: string;
    uploader: string;
    duration: number;
    url: string;
    thumbnail?: string;
}
/**
 * Eşleştirme sonucu
 */
export interface MatchResult {
    success: boolean;
    youtubeUrl?: string;
    youtubeTitle?: string;
    youtubeArtist?: string;
    youtubeDuration?: number;
    spotifyTitle?: string;
    spotifyArtist?: string;
    spotifyDuration?: number;
    matchScore?: number;
    matchReason?: string;
}
/**
 * Çözümleyici sonucu
 */
export interface ResolveResult {
    tracks: Track[];
    isPlaylist: boolean;
    playlistName?: string;
    playlistUrl?: string;
}
/**
 * Ses bağlantısı için arayüz
 */
export interface VoiceConnection {
    isConnected(guildId: Snowflake): boolean;
    disconnect(guildId: Snowflake): Promise<void>;
    play(guildId: Snowflake, streamUrl: string, volume: number): void;
    pause(guildId: Snowflake): void;
    resume(guildId: Snowflake): void;
    stop(guildId: Snowflake): void;
    setVolume(guildId: Snowflake, volume: number): void;
}
/**
 * API istemcisi için arayüz
 */
export interface MusicApiClient {
    sendMessage(channelId: Snowflake, content: string, options?: any): Promise<any>;
    editMessage(channelId: Snowflake, messageId: Snowflake, content: string, options?: any): Promise<any>;
    deleteMessage(channelId: Snowflake, messageId: Snowflake, reason?: string): Promise<void>;
}
