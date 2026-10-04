export interface SpotifyTrackMetadata {
    id: string;
    title: string;
    artist: string;
    album?: string;
    durationMs: number;
    isrc?: string;
    releaseDate?: string;
}
export interface YouTubeSearchResult {
    id: string;
    title: string;
    uploader: string;
    duration: number;
    url: string;
    thumbnail?: string;
}
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
export declare class SpotifyMatcher {
    private readonly SPOTIFY_API_BASE;
    private readonly OAUTH_TOKEN_URL;
    private accessToken;
    private tokenExpiry;
    /**
     * Spotify track ID'sini URL'den çıkarır
     * Örnek: https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC -> 4uLU6hMCjMI75M1A2tKUQC
     */
    extractTrackId(spotifyUrl: string): string | null;
    /**
     * Spotify'dan track metadata'sını alır
     * İlk olarak oEmbed'i dener, başarısız olursa Web API'ye geçer (client credentials flow olmadan)
     */
    getSpotifyMetadata(spotifyUrl: string): Promise<SpotifyTrackMetadata | null>;
    private fetchOEmbed;
    private parseOEmbedToMetadata;
    private fetchSpotifyHTML;
    private parseHTMLToMetadata;
    /**
     * YouTube'da en uygun videoyu bulur
     */
    findBestYouTubeMatch(spotifyMetadata: SpotifyTrackMetadata): Promise<MatchResult>;
    private generateSearchQueries;
    private searchYouTubeByISRC;
    private searchYouTube;
    /**
     * Eşleşme skoru hesaplar (0-100 arası)
     * Daha yüksek skor = daha iyi eşleşme
     */
    private calculateMatchScore;
    private cleanString;
    /**
     * Ana eşleştirme fonksiyonu
     */
    match(spotifyUrl: string): Promise<MatchResult>;
    /**
     * Spotify Playlist veya Album metadata'sını ve tüm parçalarını çeker (Token gerektirmez)
     */
    getSpotifyPlaylistMetadata(spotifyUrl: string): Promise<{
        title: string;
        type: 'playlist' | 'album';
        thumbnailUrl?: string;
        tracks: Array<{
            title: string;
            artist: string;
            durationSeconds: number;
            url: string;
        }>;
    } | null>;
}
