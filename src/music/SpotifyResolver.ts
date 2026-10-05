import { getYtDlpInstance, runYtDlp } from '../utils/mediaBinaries.js';
import type {
  SpotifyTrackMetadata,
  YouTubeSearchResult,
  MatchResult,
  ResolveResult,
  Track,
  AudioSource,
  Snowflake,
} from './types.js';

/**
 * Spotify linklerini metadata'ya ve YouTube'a eşleştiren servis
 */
export class SpotifyResolver {
  private readonly OEMBED_URL = 'https://open.spotify.com/oembed';

  /**
   * Spotify URL'sinden track ID'sini çıkarır
   */
  extractTrackId(spotifyUrl: string): string | null {
    try {
      const url = new URL(spotifyUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);

      // Track URL formatı: /track/{id}
      if (pathParts[0] === 'track' && pathParts[1]) {
        return pathParts[1];
      }

      // Short URL formatı: /{id}
      if (pathParts.length === 1 && pathParts[0].length === 22) {
        return pathParts[0];
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Spotify URL'sinden playlist ID'sini çıkarır
   */
  extractPlaylistId(spotifyUrl: string): string | null {
    try {
      const url = new URL(spotifyUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);

      if (pathParts[0] === 'playlist' && pathParts[1]) {
        return pathParts[1];
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Spotify track metadata'sını alır (oEmbed + HTML scraping)
   */
  async getTrackMetadata(spotifyUrl: string): Promise<SpotifyTrackMetadata | null> {
    const trackId = this.extractTrackId(spotifyUrl);
    if (!trackId) {
      console.warn('[SpotifyResolver] Geçersiz Spotify track URL formatı');
      return null;
    }

    // Önce oEmbed dene
    try {
      const oembedData = await this.fetchOEmbed(spotifyUrl);
      if (oembedData) {
        return this.parseOEmbedToMetadata(oembedData, trackId);
      }
    } catch (err: any) {
      console.warn(`[SpotifyResolver] oEmbed hatası: ${err.message}`);
    }

    // Fallback: HTML scraping
    try {
      const htmlData = await this.fetchSpotifyHTML(spotifyUrl);
      if (htmlData) {
        return this.parseHTMLToMetadata(htmlData, trackId);
      }
    } catch (err: any) {
      console.warn(`[SpotifyResolver] HTML scraping hatası: ${err.message}`);
    }

    return null;
  }

  /**
   * Spotify playlist metadata'sını alır
   */
  async getPlaylistMetadata(spotifyUrl: string): Promise<{ name: string; tracks: SpotifyTrackMetadata[] } | null> {
    const match = spotifyUrl.match(/(?:spotify\.com\/(?:intl-[a-z]{2}\/)?|spotify:)(playlist|album)[/:]([a-zA-Z0-9]{22})/i);
    if (!match) {
      console.warn('[SpotifyResolver] Geçersiz Spotify playlist/album URL formatı');
      return null;
    }
    const type = match[1].toLowerCase();
    const id = match[2];

    try {
      const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
      const res = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const html = await res.text();
        const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (m) {
          const data = JSON.parse(m[1]);
          const entity = data.props?.pageProps?.state?.data?.entity;
          if (entity) {
            const name = entity.title || entity.name || 'Spotify Playlist';
            const rawTracks = Array.isArray(entity.trackList) ? entity.trackList : [];
            const tracks: SpotifyTrackMetadata[] = rawTracks.map((item: any, idx: number) => {
              const trackId = item.uri ? item.uri.split(':').pop() : '';
              return {
                id: trackId || `sp_${idx}`,
                title: item.title || '',
                artist: item.subtitle || entity.subtitle || 'Spotify',
                album: entity.title || '',
                duration: typeof item.duration === 'number' ? Math.round(item.duration / 1000) : 195,
              };
            });
            return { name, tracks };
          }
        }
      }
    } catch (err: any) {
      console.warn(`[SpotifyResolver] Playlist embed çekme hatası: ${err.message}`);
    }

    try {
      const htmlData = await this.fetchSpotifyHTML(spotifyUrl);
      if (htmlData) {
        const nameMatch = htmlData.match(/<meta property="og:title" content="([^"]+)"/);
        const name = nameMatch?.[1] || 'Spotify Playlist';
        return { name, tracks: [] };
      }
    } catch (err: any) {
      console.warn(`[SpotifyResolver] Playlist HTML scraping hatası: ${err.message}`);
    }

    return null;
  }

  private async fetchOEmbed(spotifyUrl: string): Promise<any | null> {
    try {
      const res = await fetch(`${this.OEMBED_URL}?url=${encodeURIComponent(spotifyUrl)}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Timeout veya network hatası
    }
    return null;
  }

  private parseOEmbedToMetadata(oembed: any, trackId: string): SpotifyTrackMetadata {
    let title = oembed.title || 'Bilinmeyen Şarkı';
    let artist = oembed.author_name || 'Bilinmeyen Sanatçı';

    // "Artist - Title" formatını ayrıştır
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }

    return {
      id: trackId,
      title: this.cleanString(title),
      artist: this.cleanString(artist),
      duration: 195, // ~3:15 varsayılan
    };
  }

  private async fetchSpotifyHTML(spotifyUrl: string): Promise<string | null> {
    try {
      const res = await fetch(spotifyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        return await res.text();
      }
    } catch {
      // Timeout veya network hatası
    }
    return null;
  }

  private parseHTMLToMetadata(html: string, trackId: string): SpotifyTrackMetadata | null {
    try {
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
      const artistMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
      const durationMatch = html.match(/"duration":(\d+)/);
      const isrcMatch = html.match(/"isrc":"([^"]+)"/);

      let title = titleMatch?.[1] || 'Bilinmeyen Şarkı';
      let artist = artistMatch?.[1] || 'Bilinmeyen Sanatçı';

      // Description genellikle "Artist • Song" formatında
      if (artist.includes(' • ')) {
        const parts = artist.split(' • ');
        artist = parts[0].trim();
        title = parts[1]?.trim() || title;
      }

      const duration = durationMatch ? parseInt(durationMatch[1]) : 195;
      const isrc = isrcMatch?.[1];

      return {
        id: trackId,
        title: this.cleanString(title),
        artist: this.cleanString(artist),
        duration,
        isrc,
      };
    } catch (err: any) {
      console.warn(`[SpotifyResolver] HTML parsing hatası: ${err.message}`);
      return null;
    }
  }

  /**
   * Spotify track'ı YouTube'a eşleştirir
   */
  async matchToYouTube(metadata: SpotifyTrackMetadata): Promise<MatchResult> {
    const { title, artist, duration, isrc } = metadata;

    console.log(`[SpotifyResolver] 🔍 YouTube eşleştirme: "${artist} - ${title}" (${duration}s)`);

    // ISRC ile ara (en doğru eşleşme)
    if (isrc) {
      console.log(`[SpotifyResolver] ISRC ile arama: ${isrc}`);
      const isrcResult = await this.searchYouTubeByISRC(isrc);
      if (isrcResult) {
        const score = this.calculateMatchScore(metadata, isrcResult);
        return {
          success: true,
          youtubeUrl: isrcResult.url,
          youtubeTitle: isrcResult.title,
          youtubeDuration: isrcResult.duration,
          spotifyTitle: title,
          spotifyArtist: artist,
          spotifyDuration: duration,
          matchScore: score,
          matchReason: 'ISRC kodu ile tam eşleşme',
        };
      }
    }

    // Artist + title ile ara
    const searchQueries = this.generateSearchQueries(artist, title);

    for (const query of searchQueries) {
      console.log(`[SpotifyResolver] Arama sorgusu: "${query}"`);
      const results = await this.searchYouTube(query, 5);

      if (results && results.length > 0) {
        let bestMatch = results[0];
        let bestScore = 0;

        for (const result of results) {
          const score = this.calculateMatchScore(metadata, result);
          console.log(`[SpotifyResolver] Sonuç: "${result.title}" - Skor: ${score}`);

          if (score > bestScore) {
            bestScore = score;
            bestMatch = result;
          }
        }

        if (bestScore >= 50) {
          return {
            success: true,
            youtubeUrl: bestMatch.url,
            youtubeTitle: bestMatch.title,
            youtubeDuration: bestMatch.duration,
            spotifyTitle: title,
            spotifyArtist: artist,
            spotifyDuration: duration,
            matchScore: bestScore,
            matchReason: 'Akıllı eşleştirme algoritması',
          };
        }
      }
    }

    return {
      success: false,
      spotifyTitle: title,
      spotifyArtist: artist,
      spotifyDuration: duration,
      matchReason: 'Uygun YouTube videosu bulunamadı',
    };
  }

  private generateSearchQueries(artist: string, title: string): string[] {
    const cleanedArtist = this.cleanString(artist);
    const cleanedTitle = this.cleanString(title);

    return [
      `${cleanedArtist} ${cleanedTitle}`,
      `${cleanedArtist} - ${cleanedTitle}`,
      `${cleanedTitle} ${cleanedArtist}`,
      `"${cleanedTitle}" ${cleanedArtist}`,
    ];
  }

  private async searchYouTubeByISRC(isrc: string): Promise<YouTubeSearchResult | null> {
    try {
      const query = `ytsearch1:${isrc}`;
      const result: any = await runYtDlp(query, {
        dumpSingleJson: true,
        flatPlaylist: true,
      });

      const entry = result?.entries ? result.entries[0] : result;
      if (entry && (entry.id || entry.url)) {
        return {
          id: entry.id || entry.url,
          title: entry.title || '',
          uploader: entry.uploader || entry.channel || '',
          duration: typeof entry.duration === 'number' ? entry.duration : 0,
          url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
          thumbnail: entry.thumbnails?.[0]?.url,
        };
      }
    } catch (err: any) {
      console.warn(`[SpotifyResolver] ISRC arama hatası: ${err.message}`);
    }
    return null;
  }

  private async searchYouTube(query: string, maxResults: number = 5): Promise<YouTubeSearchResult[] | null> {
    try {
      const searchQuery = `ytsearch${maxResults}:${query}`;
      const result: any = await runYtDlp(searchQuery, {
        dumpSingleJson: true,
        flatPlaylist: true,
      });

      const entries = result?.entries || [];
      if (entries.length === 0) return null;

      return entries.map((entry: any) => ({
        id: entry.id || entry.url,
        title: entry.title || '',
        uploader: entry.uploader || entry.channel || '',
        duration: typeof entry.duration === 'number' ? entry.duration : 0,
        url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
        thumbnail: entry.thumbnails?.[0]?.url,
      }));
    } catch (err: any) {
      console.warn(`[SpotifyResolver] YouTube arama hatası: ${err.message}`);
      return null;
    }
  }

  private calculateMatchScore(spotify: SpotifyTrackMetadata, youtube: YouTubeSearchResult): number {
    let score = 0;
    const spotifyTitleLower = spotify.title.toLowerCase();
    const spotifyArtistLower = spotify.artist.toLowerCase();
    const youtubeTitleLower = youtube.title.toLowerCase();
    const youtubeUploaderLower = youtube.uploader.toLowerCase();

    // Title benzerliği (40 puan)
    if (youtubeTitleLower.includes(spotifyTitleLower) || spotifyTitleLower.includes(youtubeTitleLower)) {
      score += 40;
    } else {
      const spotifyWords = spotifyTitleLower.split(/\s+/);
      const youtubeWords = youtubeTitleLower.split(/\s+/);
      const commonWords = spotifyWords.filter(w => youtubeWords.some(yw => yw.includes(w)));
      const wordSimilarity = commonWords.length / spotifyWords.length;
      score += Math.round(wordSimilarity * 40);
    }

    // Artist benzerliği (30 puan)
    if (youtubeUploaderLower.includes(spotifyArtistLower) || spotifyArtistLower.includes(youtubeUploaderLower)) {
      score += 30;
    } else if (youtubeTitleLower.includes(spotifyArtistLower)) {
      score += 20;
    }

    // Duration benzerliği (30 puan)
    const durationDiff = Math.abs(spotify.duration - youtube.duration);
    const durationDiffPercent = durationDiff / spotify.duration;

    if (durationDiff <= 3) {
      score += 30;
    } else if (durationDiff <= 10) {
      score += 25;
    } else if (durationDiffPercent <= 0.1) {
      score += 20;
    } else if (durationDiffPercent <= 0.2) {
      score += 10;
    }

    // Official video bonusu (10 puan)
    if (youtubeTitleLower.includes('official') || youtubeTitleLower.includes('vevo')) {
      score += 10;
    }

    // Live video cezası (-20 puan)
    if (youtubeTitleLower.includes('live') || youtubeTitleLower.includes('konser')) {
      score -= 20;
    }

    // Cover/Remix cezası (-15 puan)
    if (youtubeTitleLower.includes('cover') || youtubeTitleLower.includes('remix')) {
      score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  private cleanString(str: string): string {
    return str
      .replace(/[^\p{L}\p{N}\s\-_,.()'&/]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Spotify URL'sini Track objesine dönüştürür
   */
  async resolveTrack(spotifyUrl: string, requester: Snowflake): Promise<Track | null> {
    console.log(`[SpotifyResolver] Track çözülüyor: ${spotifyUrl}`);

    const metadata = await this.getTrackMetadata(spotifyUrl);
    if (!metadata) {
      console.warn('[SpotifyResolver] Metadata alınamadı');
      return null;
    }

    console.log(`[SpotifyResolver] Metadata: ${metadata.artist} - ${metadata.title}`);

    const matchResult = await this.matchToYouTube(metadata);

    if (matchResult.success && matchResult.youtubeUrl) {
      console.log(`[SpotifyResolver] ✅ Eşleşme başarılı: ${matchResult.youtubeTitle}`);

      return {
        id: `sp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: matchResult.spotifyTitle || matchResult.youtubeTitle || 'Spotify Parçası',
        artist: matchResult.spotifyArtist || matchResult.youtubeArtist || 'Spotify',
        url: spotifyUrl,
        streamUrl: matchResult.youtubeUrl,
        duration: matchResult.youtubeDuration || matchResult.spotifyDuration || 195,
        source: 'spotify' as AudioSource,
        isrc: metadata.isrc,
        album: metadata.album,
        requester,
        addedAt: Date.now(),
      };
    }

    console.warn(`[SpotifyResolver] ❌ Eşleşme başarısız: ${matchResult.matchReason}`);
    return null;
  }

  /**
   * Spotify playlist URL'sini Track listesine dönüştürür
   */
  async resolvePlaylist(spotifyUrl: string, requester: Snowflake): Promise<ResolveResult> {
    console.log(`[SpotifyResolver] Playlist çözülüyor: ${spotifyUrl}`);

    const playlistMetadata = await this.getPlaylistMetadata(spotifyUrl);
    if (!playlistMetadata) {
      return { tracks: [], isPlaylist: false };
    }

    const tracks: any[] = playlistMetadata.tracks.map((t, idx) => ({
      id: `sp_pl_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      title: t.title,
      artist: t.artist,
      duration: t.duration,
      url: spotifyUrl,
      requester,
      source: 'spotify' as const,
      addedAt: Date.now() + idx,
    }));

    console.log(`[SpotifyResolver] ✅ Playlist başarıyla çözüldü: "${playlistMetadata.name}" (${tracks.length} parça)`);

    return {
      tracks,
      isPlaylist: true,
      playlistName: playlistMetadata.name,
      playlistUrl: spotifyUrl,
    };
  }
}
