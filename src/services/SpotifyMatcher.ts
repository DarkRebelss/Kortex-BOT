// SPDX-License-Identifier: AGPL-3.0-or-later

import youtubedl from 'yt-dlp-exec';

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

export class SpotifyMatcher {
  private readonly SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
  private readonly OAUTH_TOKEN_URL = 'https://accounts.spotify.com/api/token';
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  /**
   * Spotify track ID'sini URL'den çıkarır
   * Örnek: https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC -> 4uLU6hMCjMI75M1A2tKUQC
   */
  extractTrackId(spotifyUrl: string): string | null {
    try {
      const match = spotifyUrl.match(/\/track\/([a-zA-Z0-9]{22})/);
      if (match) {
        return match[1];
      }

      const url = new URL(spotifyUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const last = pathParts[pathParts.length - 1];
      if (last && last.length === 22) {
        return last;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Spotify'dan track metadata'sını alır
   * İlk olarak oEmbed'i dener, başarısız olursa Web API'ye geçer (client credentials flow olmadan)
   */
  async getSpotifyMetadata(spotifyUrl: string): Promise<SpotifyTrackMetadata | null> {
    const trackId = this.extractTrackId(spotifyUrl);
    if (!trackId) {
      console.warn('[SpotifyMatcher] Geçersiz Spotify URL formatı');
      return null;
    }

    // 1. Önce doğrudan crawler HTML scraping ile metadata almayı dene (en zengin ve doğru yöntem)
    try {
      const htmlData = await this.fetchSpotifyHTML(spotifyUrl);
      if (htmlData) {
        const parsed = this.parseHTMLToMetadata(htmlData, trackId);
        if (parsed && parsed.artist && parsed.artist !== 'Bilinmeyen Sanatçı' && parsed.title && parsed.title !== 'Bilinmeyen Şarkı') {
          return parsed;
        }
      }
    } catch (err: any) {
      console.warn(`[SpotifyMatcher] HTML scraping hatası: ${err.message}`);
    }

    // 2. oEmbed API'sini dene (ikinci fallback)
    try {
      const oembedData = await this.fetchOEmbed(spotifyUrl);
      if (oembedData) {
        return this.parseOEmbedToMetadata(oembedData, trackId);
      }
    } catch (err: any) {
      console.warn(`[SpotifyMatcher] oEmbed hatası: ${err.message}`);
    }

    return null;
  }

  private async fetchOEmbed(spotifyUrl: string): Promise<any | null> {
    try {
      const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`, {
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

    // OEmbed'de duration genellikle yok, tahmini değer kullan
    const durationMs = 195000; // ~3:15 varsayılan

    return {
      id: trackId,
      title: this.cleanString(title),
      artist: this.cleanString(artist),
      durationMs,
    };
  }

  private async fetchSpotifyHTML(spotifyUrl: string): Promise<string | null> {
    try {
      const res = await fetch(spotifyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discord.app)',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        signal: AbortSignal.timeout(6000),
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
      // 1. Title
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/)
        || html.match(/<meta name="twitter:title" content="([^"]+)"/);
      let title = titleMatch?.[1] || 'Bilinmeyen Şarkı';

      // 2. Artist
      let artist = 'Bilinmeyen Sanatçı';
      const musicianDesc = html.match(/<meta name="music:musician_description" content="([^"]+)"/);
      if (musicianDesc?.[1]) {
        artist = musicianDesc[1].trim();
      }

      let album = '';
      const ogDesc = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1]
        || html.match(/<meta name="twitter:description" content="([^"]+)"/)?.[1];
      if (ogDesc) {
        // Format: "Artist1, Artist2 · Album · Şarkı · 2021"
        const parts = ogDesc.split(' · ');
        if (artist === 'Bilinmeyen Sanatçı' && parts.length >= 2) {
          artist = parts[0].trim();
        }
        if (parts.length >= 3) {
          album = parts[1].trim();
        }
      }

      // Fallback JSON-LD
      if (artist === 'Bilinmeyen Sanatçı') {
        const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
        if (jsonLdMatch?.[1]) {
          try {
            const data = JSON.parse(jsonLdMatch[1]);
            if (data.name && (!title || title === 'Bilinmeyen Şarkı')) title = data.name;
            if (data.byArtist && Array.isArray(data.byArtist)) {
              artist = data.byArtist.map((a: any) => a.name).join(', ');
            }
          } catch { }
        }
      }

      // Title'da artist varsa temizle
      if (title.includes(' - ')) {
        const parts = title.split(' - ');
        const potentialArtist = parts[0].trim();
        if (potentialArtist.toLowerCase() === artist.toLowerCase()) {
          title = parts.slice(1).join(' - ').trim();
        }
      }

      // 3. Duration
      const durationSecMatch = html.match(/<meta name="music:duration" content="(\d+)"/);
      const durationMs = durationSecMatch ? parseInt(durationSecMatch[1], 10) * 1000 : 195000;

      const isrcMatch = html.match(/"isrc":"([^"]+)"/);
      const isrc = isrcMatch?.[1];

      console.log(`[SpotifyMatcher] 📋 Metadata ayrıştırıldı: Artist="${artist}", Title="${title}", Album="${album || 'yok'}", ISRC="${isrc || 'yok'}", Duration=${durationMs}ms`);

      return {
        id: trackId,
        title: this.cleanString(title),
        artist: this.cleanString(artist),
        durationMs,
        isrc,
        album,
      };
    } catch (err: any) {
      console.warn(`[SpotifyMatcher] HTML parsing hatası: ${err.message}`);
      return null;
    }
  }

  /**
   * YouTube'da en uygun videoyu bulur
   */
  async findBestYouTubeMatch(spotifyMetadata: SpotifyTrackMetadata): Promise<MatchResult> {
    const { title, artist, durationMs, isrc, album } = spotifyMetadata;
    const durationSec = Math.round(durationMs / 1000);

    console.log(`[SpotifyMatcher] 🔍 Arama başlatılıyor: "${artist} - ${title}" (${durationSec}s, Album: ${album || 'yok'})`);

    // ISRC kodu varsa, önce onunla ara (en doğru eşleşme)
    if (isrc) {
      console.log(`[SpotifyMatcher] ISRC ile arama: ${isrc}`);
      const isrcResult = await this.searchYouTubeByISRC(isrc);
      if (isrcResult) {
        const score = this.calculateMatchScore(spotifyMetadata, isrcResult);
        console.log(`[SpotifyMatcher] ISRC eşleşme skoru: ${score}`);
        // ISRC eşleşmesi her zaman kabul edilir
        return {
          success: true,
          youtubeUrl: isrcResult.url,
          youtubeTitle: isrcResult.title,
          youtubeArtist: isrcResult.uploader,
          youtubeDuration: isrcResult.duration,
          spotifyTitle: title,
          spotifyArtist: artist,
          spotifyDuration: durationSec,
          matchScore: score,
          matchReason: 'ISRC kodu ile tam eşleşme',
        };
      }
    }

    // ISRC yoksa veya sonuç bulunamadısa, artist + title + album ile ara
    const searchQueries = this.generateSearchQueries(artist, title, album);

    let allResults: YouTubeSearchResult[] = [];

    for (const query of searchQueries) {
      console.log(`[SpotifyMatcher] Arama sorgusu: "${query}"`);
      const results = await this.searchYouTube(query, 5);

      if (results && results.length > 0) {
        // Tekrarları filtrele
        for (const result of results) {
          if (!allResults.some(r => r.id === result.id)) {
            allResults.push(result);
          }
        }
      }
    }

    if (allResults.length > 0) {
      // En yüksek skorlu sonucu seç
      let bestMatch = allResults[0];
      let bestScore = 0;

      for (const result of allResults) {
        const score = this.calculateMatchScore(spotifyMetadata, result);
        console.log(`[SpotifyMatcher] Sonuç: "${result.title}" - Skor: ${score}`);

        if (score > bestScore) {
          bestScore = score;
          bestMatch = result;
        }
      }

      // Eşleşme eşiğini düşür (daha toleranslı)
      if (bestScore >= 40) {
        return {
          success: true,
          youtubeUrl: bestMatch.url,
          youtubeTitle: bestMatch.title,
          youtubeArtist: bestMatch.uploader,
          youtubeDuration: bestMatch.duration,
          spotifyTitle: title,
          spotifyArtist: artist,
          spotifyDuration: durationSec,
          matchScore: bestScore,
          matchReason: 'Akıllı eşleştirme algoritması',
        };
      } else {
        console.log(`[SpotifyMatcher] ⚠️ En iyi eşleşme skoru çok düşük: ${bestScore}`);
      }
    }

    // Hiçbir eşleşme bulunamadı
    return {
      success: false,
      spotifyTitle: title,
      spotifyArtist: artist,
      spotifyDuration: durationSec,
      matchReason: 'Uygun YouTube videosu bulunamadı (eşleşme skoru çok düşük)',
    };
  }

  private generateSearchQueries(artist: string, title: string, album?: string): string[] {
    const cleanedArtist = this.cleanString(artist);
    const cleanedTitle = this.cleanString(title);
    const cleanedAlbum = album ? this.cleanString(album) : null;

    const queries: string[] = [
      `${cleanedArtist} ${cleanedTitle}`, // En temiz sorgu
      `${cleanedArtist} - ${cleanedTitle}`, // Tire ile ayrılmış
      `${cleanedTitle} ${cleanedArtist}`, // Ters sıralama
      `"${cleanedTitle}" ${cleanedArtist}`, // Title tırnak içinde
    ];

    // Album varsa, album ile de ara
    if (cleanedAlbum) {
      queries.push(`${cleanedArtist} ${cleanedTitle} ${cleanedAlbum}`);
      queries.push(`${cleanedAlbum} ${cleanedTitle}`);
    }

    // "Official" kelimesi ile ara (official video bulmak için)
    queries.push(`${cleanedArtist} ${cleanedTitle} official`);
    queries.push(`${cleanedArtist} ${cleanedTitle} official music video`);

    return queries;
  }

  private async searchYouTubeByISRC(isrc: string): Promise<YouTubeSearchResult | null> {
    try {
      const query = `ytsearch1:${isrc}`;
      const result: any = await youtubedl(query, {
        dumpSingleJson: true,
        flatPlaylist: true,
        noWarnings: true,
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
      console.warn(`[SpotifyMatcher] ISRC arama hatası: ${err.message}`);
    }
    return null;
  }

  private async searchYouTube(query: string, maxResults: number = 5): Promise<YouTubeSearchResult[] | null> {
    try {
      const searchQuery = `ytsearch${maxResults}:${query}`;
      const result: any = await youtubedl(searchQuery, {
        dumpSingleJson: true,
        flatPlaylist: true,
        noWarnings: true,
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
      console.warn(`[SpotifyMatcher] YouTube arama hatası: ${err.message}`);
      return null;
    }
  }

  /**
   * Eşleşme skoru hesaplar (0-100 arası)
   * Daha yüksek skor = daha iyi eşleşme
   */
  private calculateMatchScore(spotify: SpotifyTrackMetadata, youtube: YouTubeSearchResult): number {
    let score = 0;
    const spotifyTitleLower = spotify.title.toLowerCase();
    const spotifyArtistLower = spotify.artist.toLowerCase();
    const youtubeTitleLower = youtube.title.toLowerCase();
    const youtubeUploaderLower = youtube.uploader.toLowerCase();
    const spotifyDurationSec = Math.round(spotify.durationMs / 1000);

    // 1. Artist benzerliği (45 puan) - ARTIK ÖNCELİK
    if (youtubeUploaderLower.includes(spotifyArtistLower) || spotifyArtistLower.includes(youtubeUploaderLower)) {
      score += 45; // Tam artist eşleşmesi
    } else if (youtubeTitleLower.includes(spotifyArtistLower)) {
      score += 35; // Title'da artist geçiyor
    } else {
      // Kelime bazlı artist benzerliği
      const spotifyArtistWords = spotifyArtistLower.split(/\s+/);
      const youtubeTitleWords = youtubeTitleLower.split(/\s+/);
      const youtubeUploaderWords = youtubeUploaderLower.split(/\s+/);
      const commonArtistWords = spotifyArtistWords.filter(w =>
        youtubeTitleWords.some(yw => yw.includes(w)) || youtubeUploaderWords.some(yw => yw.includes(w))
      );
      const artistSimilarity = commonArtistWords.length / spotifyArtistWords.length;
      score += Math.round(artistSimilarity * 30);
    }

    // 2. Title benzerliği (35 puan)
    if (youtubeTitleLower.includes(spotifyTitleLower) || spotifyTitleLower.includes(youtubeTitleLower)) {
      score += 35; // Tam title eşleşmesi
    } else {
      // Kelime bazlı title benzerliği
      const spotifyWords = spotifyTitleLower.split(/\s+/);
      const youtubeWords = youtubeTitleLower.split(/\s+/);
      const commonWords = spotifyWords.filter(w => youtubeWords.some(yw => yw.includes(w)));
      const wordSimilarity = commonWords.length / spotifyWords.length;
      score += Math.round(wordSimilarity * 25);
    }

    // 3. Duration benzerliği (20 puan)
    const durationDiff = Math.abs(spotifyDurationSec - youtube.duration);
    const durationDiffPercent = durationDiff / spotifyDurationSec;

    if (durationDiff <= 3) {
      score += 20; // 3 saniye fark = mükemmel
    } else if (durationDiff <= 10) {
      score += 15; // 10 saniye fark = çok iyi
    } else if (durationDiffPercent <= 0.1) {
      score += 12; // %10 fark = iyi
    } else if (durationDiffPercent <= 0.2) {
      score += 8; // %20 fark = kabul edilebilir
    }

    // 4. Official video bonusu (15 puan)
    if (youtubeTitleLower.includes('official') || youtubeTitleLower.includes('vevo')) {
      score += 15;
    }

    // 5. Audio/Lyrics video bonusu (10 puan)
    if (youtubeTitleLower.includes('audio') || youtubeTitleLower.includes('lyrics')) {
      score += 10;
    }

    // 6. Live video cezası (-30 puan)
    if (youtubeTitleLower.includes('live') || youtubeTitleLower.includes('konser')) {
      score -= 30;
    }

    // 7. Cover/Remix cezası (-25 puan)
    if (youtubeTitleLower.includes('cover') || youtubeTitleLower.includes('remix')) {
      score -= 25;
    }

    // 8. Reaction/Response video cezası (-20 puan)
    if (youtubeTitleLower.includes('reaction') || youtubeTitleLower.includes('response')) {
      score -= 20;
    }

    // 9. Nightcore/Slowed cezası (-15 puan)
    if (youtubeTitleLower.includes('nightcore') || youtubeTitleLower.includes('slowed')) {
      score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  private cleanString(str: string): string {
    return str
      .replace(/[^\p{L}\p{N}\s\-_,.()'&/]/gu, '') // Unicode ve Türkçe karakterleri koru
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Ana eşleştirme fonksiyonu
   */
  async match(spotifyUrl: string): Promise<MatchResult> {
    console.log(`[SpotifyMatcher] 🎵 Spotify eşleştirme başlatılıyor: ${spotifyUrl}`);

    // 1. Spotify metadata'sını al
    const metadata = await this.getSpotifyMetadata(spotifyUrl);
    if (!metadata) {
      console.log(`[SpotifyMatcher] ❌ Spotify metadata alınamadı`);
      return {
        success: false,
        matchReason: 'Spotify metadata alınamadı',
      };
    }

    console.log(`[SpotifyMatcher] 📋 Spotify metadata: ${metadata.artist} - ${metadata.title} (${metadata.durationMs}ms, ISRC: ${metadata.isrc || 'yok'})`);

    // 2. YouTube'da en uygun videoyu bul
    const matchResult = await this.findBestYouTubeMatch(metadata);

    if (matchResult.success) {
      console.log(`[SpotifyMatcher] ✅ Eşleşme başarılı: ${matchResult.youtubeTitle} (Skor: ${matchResult.matchScore})`);
      console.log(`[SpotifyMatcher] 🎯 YouTube URL: ${matchResult.youtubeUrl}`);
    } else {
      console.log(`[SpotifyMatcher] ❌ Eşleşme başarısız: ${matchResult.matchReason}`);
    }

    return matchResult;
  }

  /**
   * Spotify Playlist veya Album metadata'sını ve tüm parçalarını çeker (Token gerektirmez)
   */
  async getSpotifyPlaylistMetadata(spotifyUrl: string): Promise<{
    title: string;
    type: 'playlist' | 'album';
    thumbnailUrl?: string;
    tracks: Array<{
      title: string;
      artist: string;
      durationSeconds: number;
      url: string;
    }>;
  } | null> {
    const match = spotifyUrl.match(/(?:spotify\.com\/(?:intl-[a-z]{2}\/)?|spotify:)(playlist|album)[/:]([a-zA-Z0-9]{22})/i);
    if (!match) return null;
    const type = match[1].toLowerCase() as 'playlist' | 'album';
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

      if (!res.ok) {
        console.warn(`[SpotifyMatcher] Playlist embed yanıtı başarısız (${res.status}): ${embedUrl}`);
        return null;
      }

      const html = await res.text();
      const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (!m) {
        console.warn(`[SpotifyMatcher] Playlist embed __NEXT_DATA__ bulunamadı: ${embedUrl}`);
        return null;
      }

      const data = JSON.parse(m[1]);
      const entity = data.props?.pageProps?.state?.data?.entity;
      if (!entity) return null;

      const playlistTitle = entity.title || entity.name || (type === 'album' ? 'Spotify Albümü' : 'Spotify Çalma Listesi');
      const thumbnailUrl = entity.coverArt?.sources?.[0]?.url || '';
      const rawTracks = Array.isArray(entity.trackList) ? entity.trackList : [];

      const tracks = rawTracks.map((item: any, idx: number) => {
        const trackId = item.uri ? item.uri.split(':').pop() : '';
        const trackUrl = trackId ? `https://open.spotify.com/track/${trackId}` : spotifyUrl;
        return {
          title: item.title || `Parça #${idx + 1}`,
          artist: item.subtitle || entity.subtitle || 'Spotify',
          durationSeconds: typeof item.duration === 'number' ? Math.round(item.duration / 1000) : 210,
          url: trackUrl,
        };
      });

      console.log(`[SpotifyMatcher] 📑 Spotify ${type} başarıyla çekildi: "${playlistTitle}" (${tracks.length} parça)`);

      return {
        title: playlistTitle,
        type,
        thumbnailUrl,
        tracks,
      };
    } catch (err: any) {
      console.warn(`[SpotifyMatcher] Spotify playlist çekme hatası: ${err.message}`);
      return null;
    }
  }
}

