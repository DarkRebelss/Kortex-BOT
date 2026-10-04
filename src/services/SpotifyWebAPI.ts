// SPDX-License-Identifier: AGPL-3.0-or-later

import { config } from '../config/env.js';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string; id: string }>;
  album: {
    name: string;
    release_date: string;
    images: Array<{ url: string }>;
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
export class SpotifyWebAPI {
  private token: string;
  private isTokenValid = true;
  private baseUrl = 'https://api.spotify.com/v1';

  constructor() {
    this.token = config.spotifyToken || '';
    if (!this.token) {
      this.isTokenValid = false;
      console.warn('[SpotifyWebAPI] SPOTIFY_TOKEN bulunamadı - API kullanılamayacak');
    } else {
      console.log('[SpotifyWebAPI] Spotify token yüklendi');
    }
  }

  hasToken(): boolean {
    return Boolean(this.token && this.isTokenValid);
  }

  private async fetchWebApi(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    if (!this.hasToken()) {
      throw new Error('Spotify token bulunamadı veya geçersiz');
    }

    const url = `${this.baseUrl}/${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    try {
      const res = await fetch(url, options);

      if (res.status === 401) {
        this.isTokenValid = false;
        throw new Error('Spotify token süresi doldu veya geçersiz');
      }

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        throw new Error(`Rate limit. Retry after: ${retryAfter}s`);
      }

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Spotify API hatası [${res.status}]: ${errorText}`);
      }

      return await res.json();
    } catch (err: any) {
      console.error(`[SpotifyWebAPI] API isteği başarısız (${endpoint}):`, err.message);
      throw err;
    }
  }

  /**
   * Track ID'sinden track bilgilerini alır
   */
  async getTrack(trackId: string): Promise<SpotifyTrack | null> {
    try {
      console.log(`[SpotifyWebAPI] Track alınıyor: ${trackId}`);
      const data = await this.fetchWebApi(`tracks/${trackId}`);
      console.log(`[SpotifyWebAPI] Track alındı: ${data.name} by ${data.artists?.[0]?.name}`);
      return data;
    } catch (err: any) {
      console.error(`[SpotifyWebAPI] Track alma hatası:`, err.message);
      return null;
    }
  }

  /**
   * Spotify URL'sinden track ID'sini çıkarır ve track bilgilerini alır
   */
  async getTrackFromUrl(spotifyUrl: string): Promise<SpotifyTrack | null> {
    try {
      const trackId = this.extractTrackId(spotifyUrl);
      if (!trackId) {
        console.warn('[SpotifyWebAPI] Geçersiz Spotify URL formatı');
        return null;
      }
      return await this.getTrack(trackId);
    } catch (err: any) {
      console.error('[SpotifyWebAPI] URL\'den track alma hatası:', err.message);
      return null;
    }
  }

  /**
   * Playlist ID'sinden playlist bilgilerini alır
   */
  async getPlaylist(playlistId: string): Promise<SpotifyPlaylist | null> {
    try {
      console.log(`[SpotifyWebAPI] Playlist alınıyor: ${playlistId}`);
      const data = await this.fetchWebApi(`playlists/${playlistId}`);
      console.log(`[SpotifyWebAPI] Playlist alındı: ${data.name} (${data.tracks?.total} tracks)`);
      return data;
    } catch (err: any) {
      console.error('[SpotifyWebAPI] Playlist alma hatası:', err.message);
      return null;
    }
  }

  /**
   * Spotify URL'sinden playlist ID'sini çıkarır ve playlist bilgilerini alır
   */
  async getPlaylistFromUrl(spotifyUrl: string): Promise<SpotifyPlaylist | null> {
    try {
      const playlistId = this.extractPlaylistId(spotifyUrl);
      if (!playlistId) {
        console.warn('[SpotifyWebAPI] Geçersiz Spotify playlist URL formatı');
        return null;
      }
      return await this.getPlaylist(playlistId);
    } catch (err: any) {
      console.error('[SpotifyWebAPI] URL\'den playlist alma hatası:', err.message);
      return null;
    }
  }

  /**
   * Arama yapar
   */
  async search(query: string, type: string = 'track', limit: number = 10): Promise<any> {
    try {
      console.log(`[SpotifyWebAPI] Arama yapılıyor: ${query} (type: ${type})`);
      const data = await this.fetchWebApi(`search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`);
      return data;
    } catch (err: any) {
      console.error('[SpotifyWebAPI] Arama hatası:', err.message);
      return null;
    }
  }

  /**
   * Spotify URL'sinden track ID'sini çıkarır (intl-xx ve query parametreleri dahil)
   */
  private extractTrackId(spotifyUrl: string): string | null {
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
   * Spotify URL'sinden playlist ID'sini çıkarır
   */
  private extractPlaylistId(spotifyUrl: string): string | null {
    try {
      const match = spotifyUrl.match(/\/playlist\/([a-zA-Z0-9]{22})/);
      if (match) {
        return match[1];
      }

      const url = new URL(spotifyUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const pIdx = pathParts.indexOf('playlist');
      if (pIdx !== -1 && pathParts[pIdx + 1]) {
        return pathParts[pIdx + 1].split('?')[0];
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Token'ın geçerli olup olmadığını kontrol eder
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.fetchWebApi('me', 'GET');
      console.log('[SpotifyWebAPI] Token geçerli');
      return true;
    } catch (err: any) {
      console.error('[SpotifyWebAPI] Token geçersiz:', err.message);
      return false;
    }
  }
}
