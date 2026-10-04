import type { SpotifyTrackMetadata, MatchResult, ResolveResult, Track, Snowflake } from './types.js';
/**
 * Spotify linklerini metadata'ya ve YouTube'a eşleştiren servis
 */
export declare class SpotifyResolver {
    private readonly OEMBED_URL;
    /**
     * Spotify URL'sinden track ID'sini çıkarır
     */
    extractTrackId(spotifyUrl: string): string | null;
    /**
     * Spotify URL'sinden playlist ID'sini çıkarır
     */
    extractPlaylistId(spotifyUrl: string): string | null;
    /**
     * Spotify track metadata'sını alır (oEmbed + HTML scraping)
     */
    getTrackMetadata(spotifyUrl: string): Promise<SpotifyTrackMetadata | null>;
    /**
     * Spotify playlist metadata'sını alır
     */
    getPlaylistMetadata(spotifyUrl: string): Promise<{
        name: string;
        tracks: SpotifyTrackMetadata[];
    } | null>;
    private fetchOEmbed;
    private parseOEmbedToMetadata;
    private fetchSpotifyHTML;
    private parseHTMLToMetadata;
    /**
     * Spotify track'ı YouTube'a eşleştirir
     */
    matchToYouTube(metadata: SpotifyTrackMetadata): Promise<MatchResult>;
    private generateSearchQueries;
    private searchYouTubeByISRC;
    private searchYouTube;
    private calculateMatchScore;
    private cleanString;
    /**
     * Spotify URL'sini Track objesine dönüştürür
     */
    resolveTrack(spotifyUrl: string, requester: Snowflake): Promise<Track | null>;
    /**
     * Spotify playlist URL'sini Track listesine dönüştürür
     */
    resolvePlaylist(spotifyUrl: string, requester: Snowflake): Promise<ResolveResult>;
}
