export interface SpotifyTrack {
    id: string;
    name: string;
    artists: Array<{
        name: string;
        id: string;
    }>;
    album: {
        name: string;
        release_date: string;
        images: Array<{
            url: string;
        }>;
    };
    duration_ms: number;
    external_ids: {
        isrc?: string;
    };
    external_urls: {
        spotify: string;
    };
}
export interface SpotifyPlaylist {
    id: string;
    name: string;
    tracks: {
        items: Array<{
            track: SpotifyTrack;
        }>;
    };
    external_urls: {
        spotify: string;
    };
}
/**
 * Spotify Web API Client
 */
export declare class SpotifyWebAPI {
    private token;
    private isTokenValid;
    private baseUrl;
    constructor();
    hasToken(): boolean;
    private fetchWebApi;
    /**
     * Track ID'sinden track bilgilerini alır
     */
    getTrack(trackId: string): Promise<SpotifyTrack | null>;
    /**
     * Spotify URL'sinden track ID'sini çıkarır ve track bilgilerini alır
     */
    getTrackFromUrl(spotifyUrl: string): Promise<SpotifyTrack | null>;
    /**
     * Playlist ID'sinden playlist bilgilerini alır
     */
    getPlaylist(playlistId: string): Promise<SpotifyPlaylist | null>;
    /**
     * Spotify URL'sinden playlist ID'sini çıkarır ve playlist bilgilerini alır
     */
    getPlaylistFromUrl(spotifyUrl: string): Promise<SpotifyPlaylist | null>;
    /**
     * Arama yapar
     */
    search(query: string, type?: string, limit?: number): Promise<any>;
    /**
     * Spotify URL'sinden track ID'sini çıkarır (intl-xx ve query parametreleri dahil)
     */
    private extractTrackId;
    /**
     * Spotify URL'sinden playlist ID'sini çıkarır
     */
    private extractPlaylistId;
    /**
     * Token'ın geçerli olup olmadığını kontrol eder
     */
    validateToken(): Promise<boolean>;
}
