// SPDX-License-Identifier: AGPL-3.0-or-later
export const RADIO_STATIONS = [
    {
        key: 'powerfm',
        name: 'Power FM',
        genre: 'Yabancı Hit & Pop',
        url: 'http://powerfm.listenpowerapp.com/powerfm/mpeg/icecast.audio',
    },
    {
        key: 'kralpop',
        name: 'Kral Pop',
        genre: 'Türkçe Pop',
        url: 'https://kralpop.listenkralpop.com/kralpop/mpeg/icecast.audio',
    },
    {
        key: 'slowturk',
        name: 'Slow Türk',
        genre: 'Türkçe Slow & Akustik',
        url: 'https://radyo.duhnet.tv/slowturk',
    },
    {
        key: 'virgin',
        name: 'Virgin Radio',
        genre: 'Yabancı Rock & Pop',
        url: 'http://virginradio.listenpowerapp.com/virginradio/mpeg/icecast.audio',
    },
    {
        key: 'lofi',
        name: 'Lofi Hip Hop',
        genre: 'Chill Beats & Relax',
        url: 'http://stream.zeno.fm/f3wvbbqmdg8uv',
    },
    {
        key: 'chill',
        name: 'Chillout Lounge',
        genre: 'Ambient & Downtempo',
        url: 'https://stream.zeno.fm/4v8u8wvmg8uv',
    },
    {
        key: 'retro',
        name: '80s Synthwave',
        genre: 'Retro & Synth',
        url: 'https://stream.zeno.fm/75k7v9yhg8uv',
    },
    {
        key: 'fenomen',
        name: 'Radyo Fenomen',
        genre: 'Hit & Dance',
        url: 'https://listen.radyofenomen.com/fenomenturk/128/icecast.audio',
    },
];
import fs from 'fs';
import path from 'path';
import { runYtDlp, isYouTubeBlocked } from '../utils/mediaBinaries.js';
import { SpotifyWebAPI } from './SpotifyWebAPI.js';
import { isSafeAudioTarget } from '../utils/security.js';
import { SpotifyMatcher } from './SpotifyMatcher.js';
export class MusicService {
    api;
    gateway;
    players = new Map();
    timers = new Map();
    idleTimers = new Map();
    userVoiceStates = new Map();
    voiceClient;
    spotifyMatcher = new SpotifyMatcher();
    spotifyWebAPI = new SpotifyWebAPI();
    constructor(api, gateway) {
        this.api = api;
        this.gateway = gateway;
    }
    setGateway(gateway) {
        this.gateway = gateway;
    }
    setVoiceClient(voiceClient) {
        this.voiceClient = voiceClient;
    }
    isVoiceConnected(guildId) {
        return this.voiceClient ? this.voiceClient.isConnected(guildId) : false;
    }
    clearIdleTimer(guildId) {
        const timer = this.idleTimers.get(guildId);
        if (timer) {
            clearTimeout(timer);
            this.idleTimers.delete(guildId);
        }
    }
    // -------------------------------------------------------------
    // Voice State Tracking & Gateway Opcode 4
    // -------------------------------------------------------------
    updateVoiceState(guildId, userId, channelId) {
        const key = `${guildId}:${userId}`;
        if (!channelId) {
            this.userVoiceStates.delete(key);
        }
        else {
            this.userVoiceStates.set(key, channelId);
        }
    }
    getUserVoiceChannel(guildId, userId) {
        return this.userVoiceStates.get(`${guildId}:${userId}`);
    }
    connectToVoice(guildId, voiceChannelId, voiceChannelName) {
        const player = this.getOrCreatePlayer(guildId, '');
        const alreadyConnected = player.voiceChannelId === voiceChannelId &&
            (this.voiceClient ? this.voiceClient.isConnected(guildId) : false);
        player.voiceChannelId = voiceChannelId;
        if (voiceChannelName) {
            player.voiceChannelName = voiceChannelName;
        }
        this.clearIdleTimer(guildId);
        if (alreadyConnected) {
            console.log(`[MusicService] Bot zaten ${voiceChannelId} ses kanalına bağlı, tekrar bağlanma isteği atlandı.`);
            return;
        }
        console.log(`[MusicService] Ses kanalına bağlanılıyor: Sunucu ${guildId} -> Kanal ${voiceChannelId} (${voiceChannelName || 'Bilinmiyor'})`);
        try {
            this.gateway?.sendVoiceStateUpdate(guildId, voiceChannelId, false, false);
        }
        catch (err) {
            console.warn(`[MusicService] Gateway voice state hatası:`, err.message);
        }
    }
    disconnectFromVoice(guildId) {
        this.clearIdleTimer(guildId);
        const player = this.players.get(guildId);
        if (player) {
            player.voiceChannelId = null;
            player.voiceChannelName = null;
        }
        console.log(`[MusicService] Ses kanalından ayrılınıyor: Sunucu ${guildId}`);
        try {
            this.gateway?.sendVoiceStateUpdate(guildId, null);
        }
        catch { }
        this.voiceClient?.disconnect(guildId);
    }
    handleBotVoiceDisconnect(guildId) {
        this.clearIdleTimer(guildId);
        const player = this.players.get(guildId);
        if (player) {
            player.voiceChannelId = null;
            player.voiceChannelName = null;
            if (player.state === 'playing') {
                this.stop(guildId);
            }
        }
        this.voiceClient?.disconnect(guildId);
    }
    join(guildId, textChannelId, voiceChannelId, voiceChannelName) {
        this.connectToVoice(guildId, voiceChannelId, voiceChannelName);
        const player = this.getOrCreatePlayer(guildId, textChannelId);
        player.voiceChannelId = voiceChannelId;
        player.voiceChannelName = voiceChannelName || voiceChannelId;
        const nameStr = voiceChannelName ? `\`#${voiceChannelName}\`` : `<#${voiceChannelId}>`;
        return {
            success: true,
            message: `🔊 **Ses Kanalına Katılınıldı:** ${nameStr} odasına başarıyla bağlandım. Şarkı çalmak için \`/play <link>\` kullanabilirsiniz!`,
        };
    }
    leave(guildId) {
        const player = this.players.get(guildId);
        const chName = player?.voiceChannelName ? `\`#${player.voiceChannelName}\`` : 'ses kanalından';
        this.disconnectFromVoice(guildId);
        if (player) {
            player.queue = [];
            player.currentTrack = null;
            player.state = 'stopped';
            player.playbackStartTime = 0;
            player.playbackElapsedSeconds = 0;
            this.stopPlayerTicker(guildId);
        }
        return {
            success: true,
            message: `👋 **Ses Kanalından Ayrılındı:** ${chName} ayrıldım ve müzik çalar kapatıldı.`,
        };
    }
    // -------------------------------------------------------------
    // Player Retrieval & Lifecycle
    // -------------------------------------------------------------
    getOrCreatePlayer(guildId, channelId) {
        let player = this.players.get(guildId);
        if (!player) {
            player = {
                guildId,
                channelId,
                voiceChannelId: null,
                voiceChannelName: null,
                queue: [],
                currentTrack: null,
                state: 'stopped',
                volume: 100,
                loopMode: 'off',
                playbackStartTime: 0,
                playbackElapsedSeconds: 0,
            };
            this.players.set(guildId, player);
        }
        else if (channelId) {
            player.channelId = channelId;
        }
        return player;
    }
    getPlayer(guildId) {
        return this.players.get(guildId);
    }
    startPlayerTicker(guildId) {
        if (this.timers.has(guildId))
            return;
        const timer = setInterval(() => {
            void this.tickPlayer(guildId);
        }, 1500);
        this.timers.set(guildId, timer);
    }
    stopPlayerTicker(guildId) {
        const timer = this.timers.get(guildId);
        if (timer) {
            clearInterval(timer);
            this.timers.delete(guildId);
        }
    }
    async tickPlayer(guildId) {
        const player = this.players.get(guildId);
        if (!player || player.state !== 'playing' || !player.currentTrack)
            return;
        // Live streams have duration = 0, so they don't expire automatically
        if (player.currentTrack.durationSeconds <= 0)
            return;
        // When voiceClient is active, track completion is governed by the actual audio stream ending.
        // Only fall back to ticker-based ending if no voice client is configured (e.g. offline unit tests).
        if (!this.voiceClient) {
            const elapsed = this.getElapsedSeconds(player);
            if (elapsed >= player.currentTrack.durationSeconds) {
                await this.handleTrackEnd(guildId);
            }
        }
    }
    triggerPlayback(guildId, track, seekSeconds = 0, isHotSwap = false) {
        const doPlay = async () => {
            // Eğer Spotify parçasıysa ve streamUrl henüz çözülmediyse (örneğin playlist kuyruğundan geldiyse), hızlıca çöz
            if (track.source === 'spotify' && !track.streamUrl) {
                try {
                    track.streamUrl = await this.resolveSpotifyDirectAudioStream(track.artist || '', track.title, '', track.durationSeconds);
                }
                catch (err) {
                    console.warn(`[MusicService] Spotify akışı çözümlenemedi (${track.title}): ${err.message}`);
                }
            }
            const streamTarget = track.streamUrl || track.url;
            if (track.source === 'spotify') {
                console.log(`[MusicService] 🟢 Spotify parçası oynatılıyor: ${track.title} (${track.artist}) [Spotify: ${track.url}]${seekSeconds > 0 ? ` [seek: ${seekSeconds}s]` : ''}${isHotSwap ? ' [hot-swap: aktif]' : ''}`);
            }
            else if (track.source === 'youtube') {
                console.log(`[MusicService] ▶️ YouTube parçası oynatılıyor: ${track.title} (${track.url})${seekSeconds > 0 ? ` [seek: ${seekSeconds}s]` : ''}${isHotSwap ? ' [hot-swap: aktif]' : ''}`);
            }
            else {
                console.log(`[MusicService] 🔊 Ses oynatma tetiklendi: ${track.title} (${track.url})${seekSeconds > 0 ? ` [seek: ${seekSeconds}s]` : ''}${isHotSwap ? ' [hot-swap: aktif]' : ''}`);
            }
            const player = this.players.get(guildId);
            if (player && this.voiceClient) {
                this.voiceClient.setVolume(guildId, player.volume);
            }
            void this.voiceClient?.playAudio(guildId, streamTarget, () => {
                console.log(`[MusicService] Parça akışı tamamlandı: ${track.title}`);
                void this.handleTrackEnd(guildId);
            }, seekSeconds, isHotSwap).then((resolvedDirectUrl) => {
                if (resolvedDirectUrl && !track.streamUrl) {
                    track.streamUrl = resolvedDirectUrl;
                }
            });
            // Arka planda kuyruktaki bir sonraki Spotify parçasının akışını önceden çöz (Pre-fetch: 0ms gecikme)
            const nextTrack = player?.queue?.[0];
            if (nextTrack && nextTrack.source === 'spotify' && !nextTrack.streamUrl) {
                this.resolveSpotifyDirectAudioStream(nextTrack.artist || '', nextTrack.title, '', nextTrack.durationSeconds).then((resUrl) => {
                    if (resUrl) {
                        nextTrack.streamUrl = resUrl;
                        console.log(`[MusicService] ⚡ Sıradaki şarkı önceden hazırlandı: "${nextTrack.artist} - ${nextTrack.title}"`);
                    }
                }).catch(() => { });
            }
        };
        void doPlay();
    }
    async handleTrackEnd(guildId) {
        const player = this.players.get(guildId);
        if (!player)
            return;
        const finished = player.currentTrack;
        if (player.loopMode === 'track' && finished) {
            // Replay same track
            player.playbackStartTime = Date.now();
            player.playbackElapsedSeconds = 0;
            this.triggerPlayback(guildId, finished);
            await this.sendNowPlaying(player, true);
            return;
        }
        if (player.loopMode === 'queue' && finished) {
            // Push back to queue
            player.queue.push(finished);
        }
        // Play next
        if (player.queue.length > 0) {
            const next = player.queue.shift();
            player.currentTrack = next;
            player.state = 'playing';
            player.playbackStartTime = Date.now();
            player.playbackElapsedSeconds = 0;
            this.triggerPlayback(guildId, next);
            await this.sendNowPlaying(player);
        }
        else {
            player.currentTrack = null;
            player.state = 'stopped';
            player.playbackStartTime = 0;
            player.playbackElapsedSeconds = 0;
            this.stopPlayerTicker(guildId);
            this.voiceClient?.stopAudio(guildId);
            // Start an idle timer (90s) before leaving the channel, giving users time to add more songs
            this.clearIdleTimer(guildId);
            const idleTimer = setTimeout(() => {
                const curPlayer = this.players.get(guildId);
                if (curPlayer && curPlayer.state === 'stopped') {
                    this.disconnectFromVoice(guildId);
                    const msg = '⏹️ **Boşta Kalma Süresi Doldu:** 90 saniye boyunca yeni şarkı çalınmadığı için ses kanalından ayrıldım.';
                    void this.api.sendMessage(curPlayer.channelId, msg).catch(() => { });
                }
            }, 90000);
            this.idleTimers.set(guildId, idleTimer);
            const msg = '⏹️ **Kuyruk Tamamlandı:** Çalınacak başka şarkı kalmadı. Yeni şarkı eklemek için `/play <şarkı>` kullanabilirsiniz (90 sn sonra kanaldan ayrılacak).';
            try {
                await this.api.sendMessage(player.channelId, msg);
            }
            catch { }
        }
    }
    // -------------------------------------------------------------
    // Link Resolver & Metadata Parser
    // -------------------------------------------------------------
    async resolveInput(input, requester) {
        const trimmed = input.trim();
        if (!isSafeAudioTarget(trimmed)) {
            throw new Error('Güvenlik nedeniyle yalnızca genel internet bağlantıları (http/https) veya arama terimleri çalınabilir. Yerel dosya yolları veya özel ağ adresleri desteklenmez.');
        }
        const isUrl = /^https?:\/\//i.test(trimmed);
        if (!isUrl) {
            // Search query mode: if YouTube is blocked, search SoundCloud immediately (zero wait)
            if (isYouTubeBlocked()) {
                try {
                    console.log(`[MusicService] 🔍 YouTube engelli, doğrudan SoundCloud araması yapılıyor: "${trimmed}"`);
                    const scRes = await runYtDlp(`scsearch1:${trimmed}`, {
                        dumpSingleJson: true,
                        flatPlaylist: true,
                    });
                    const scEntry = scRes?.entries ? scRes.entries[0] : scRes;
                    if (scEntry && (scEntry.id || scEntry.url)) {
                        return {
                            id: 'sc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                            title: scEntry.title || this.cleanSearchTitle(trimmed),
                            artist: scEntry.uploader || 'SoundCloud Artist',
                            url: scEntry.url || scEntry.webpage_url,
                            durationSeconds: typeof scEntry.duration === 'number' && scEntry.duration > 0 ? scEntry.duration : 210,
                            thumbnailUrl: scEntry.thumbnails?.[0]?.url,
                            source: 'soundcloud',
                            requester,
                            addedAt: Date.now(),
                        };
                    }
                }
                catch (scErr) {
                    console.warn(`[MusicService] SoundCloud araması uyarısı:`, scErr.message);
                }
            }
            // Try YouTube search via yt-dlp
            try {
                console.log(`[MusicService] 🔍 YouTube araması yapılıyor: "${trimmed}"`);
                const searchRes = await runYtDlp(`ytsearch1:${trimmed}`, {
                    dumpSingleJson: true,
                    flatPlaylist: true,
                });
                const entry = searchRes?.entries ? searchRes.entries[0] : searchRes;
                if (entry && (entry.id || entry.url)) {
                    const videoId = entry.id || entry.url;
                    const videoUrl = videoId.startsWith('http') ? videoId : `https://www.youtube.com/watch?v=${videoId}`;
                    return {
                        id: 'yt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                        title: entry.title || this.cleanSearchTitle(trimmed),
                        artist: entry.uploader || entry.channel || 'YouTube',
                        url: videoUrl,
                        durationSeconds: typeof entry.duration === 'number' && entry.duration > 0 ? entry.duration : 210,
                        thumbnailUrl: entry.thumbnails?.[0]?.url,
                        source: 'youtube',
                        requester,
                        addedAt: Date.now(),
                    };
                }
            }
            catch (err) {
                console.warn(`[MusicService] YouTube araması başarısız (${err.message}). SoundCloud deneniyor...`);
                try {
                    const scRes = await runYtDlp(`scsearch1:${trimmed}`, {
                        dumpSingleJson: true,
                        flatPlaylist: true,
                    });
                    const scEntry = scRes?.entries ? scRes.entries[0] : scRes;
                    if (scEntry && (scEntry.id || scEntry.url)) {
                        return {
                            id: 'sc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                            title: scEntry.title || this.cleanSearchTitle(trimmed),
                            artist: scEntry.uploader || 'SoundCloud Artist',
                            url: scEntry.url || scEntry.webpage_url,
                            durationSeconds: typeof scEntry.duration === 'number' && scEntry.duration > 0 ? scEntry.duration : 210,
                            thumbnailUrl: scEntry.thumbnails?.[0]?.url,
                            source: 'soundcloud',
                            requester,
                            addedAt: Date.now(),
                        };
                    }
                }
                catch (scErr) {
                    console.warn(`[MusicService] SoundCloud araması da başarısız (${scErr.message}).`);
                }
            }
            return {
                id: 'track_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                title: this.cleanSearchTitle(trimmed),
                artist: 'YouTube Audio',
                url: `https://www.youtube.com/results?search_query=${encodeURIComponent(trimmed)}`,
                durationSeconds: 210, // ~3.5 min default
                source: 'youtube',
                requester,
                addedAt: Date.now(),
            };
        }
        const urlLower = trimmed.toLowerCase();
        // 1. YouTube Link
        if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
            const oembed = await this.fetchOembed(`https://www.youtube.com/oembed?url=${encodeURIComponent(trimmed)}&format=json`);
            const title = oembed?.title || this.extractYouTubeTitleFallback(trimmed);
            const artist = oembed?.author_name || 'YouTube';
            const thumbnail = oembed?.thumbnail_url;
            return {
                id: 'yt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                title,
                artist,
                url: trimmed,
                durationSeconds: 220, // default 3:40
                thumbnailUrl: thumbnail,
                source: 'youtube',
                requester,
                addedAt: Date.now(),
            };
        }
        // 2. Spotify Link
        if (urlLower.includes('spotify.com')) {
            console.log(`[MusicService] 🎵 Spotify URL tespit edildi: ${trimmed}`);
            // Önce Spotify Web API'yi dene (en doğru metadata)
            let spotifyTitle = '';
            let spotifyArtist = '';
            let spotifyAlbum = '';
            let spotifyDuration = 195;
            let spotifyThumbnail = '';
            let spotifyISRC = '';
            if (this.spotifyWebAPI.hasToken()) {
                try {
                    const spotifyTrack = await this.spotifyWebAPI.getTrackFromUrl(trimmed);
                    if (spotifyTrack) {
                        spotifyTitle = spotifyTrack.name;
                        spotifyArtist = spotifyTrack.artists.map(a => a.name).join(', ');
                        spotifyAlbum = spotifyTrack.album?.name || '';
                        spotifyDuration = Math.round(spotifyTrack.duration_ms / 1000);
                        spotifyThumbnail = spotifyTrack.album?.images?.[0]?.url || '';
                        spotifyISRC = spotifyTrack.external_ids?.isrc || '';
                        console.log(`[MusicService] ✅ Spotify Web API metadata: Artist="${spotifyArtist}", Title="${spotifyTitle}", Album="${spotifyAlbum}", Duration=${spotifyDuration}s, ISRC="${spotifyISRC || 'yok'}"`);
                    }
                }
                catch (err) {
                    console.log(`[MusicService] ⚠️ Spotify Web API başarısız: ${err.message}`);
                }
            }
            // Web API başarısız olursa, matcher (HTML scraping) kullan
            if (!spotifyTitle || !spotifyArtist || spotifyArtist === 'Spotify') {
                try {
                    const meta = await this.spotifyMatcher.getSpotifyMetadata(trimmed);
                    if (meta) {
                        if (meta.title && meta.title !== 'Bilinmeyen Şarkı')
                            spotifyTitle = meta.title;
                        if (meta.artist && meta.artist !== 'Bilinmeyen Sanatçı')
                            spotifyArtist = meta.artist;
                        if (meta.album)
                            spotifyAlbum = meta.album;
                        if (meta.durationMs)
                            spotifyDuration = Math.round(meta.durationMs / 1000);
                        if (meta.isrc)
                            spotifyISRC = meta.isrc;
                    }
                }
                catch { }
                if (!spotifyTitle || !spotifyArtist || spotifyArtist === 'Spotify') {
                    const oembed = await this.fetchOembed(`https://open.spotify.com/oembed?url=${encodeURIComponent(trimmed)}`);
                    let title = oembed?.title || 'Spotify Parçası';
                    let artist = oembed?.author_name || '';
                    if (title.includes(' - ')) {
                        const parts = title.split(' - ');
                        artist = parts[0].trim();
                        title = parts.slice(1).join(' - ').trim();
                    }
                    if (title && !spotifyTitle)
                        spotifyTitle = title;
                    if (artist && (!spotifyArtist || spotifyArtist === 'Spotify'))
                        spotifyArtist = artist;
                    if (oembed?.thumbnail_url && !spotifyThumbnail)
                        spotifyThumbnail = oembed.thumbnail_url;
                }
            }
            // Doğrudan stüdyo ses akışını şarkı süresi ve albüm doğrulamasıyla çöz
            const directStreamUrl = await this.resolveSpotifyDirectAudioStream(spotifyArtist, spotifyTitle, spotifyAlbum, spotifyDuration, spotifyISRC);
            console.log(`[MusicService] 🟢 Spotify parçası hazırlandı: "${spotifyArtist} - ${spotifyTitle}" (Süre: ${spotifyDuration}s)`);
            return {
                id: 'sp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                title: spotifyTitle,
                artist: spotifyArtist,
                url: trimmed,
                streamUrl: directStreamUrl,
                durationSeconds: spotifyDuration,
                thumbnailUrl: spotifyThumbnail,
                source: 'spotify',
                requester,
                addedAt: Date.now(),
            };
        }
        // 3. SoundCloud Link
        if (urlLower.includes('soundcloud.com')) {
            const oembed = await this.fetchOembed(`https://soundcloud.com/oembed?url=${encodeURIComponent(trimmed)}&format=json`);
            const title = oembed?.title || this.extractPathTitle(trimmed);
            const artist = oembed?.author_name || 'SoundCloud Artist';
            return {
                id: 'sc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                title,
                artist,
                url: trimmed,
                durationSeconds: 240,
                thumbnailUrl: oembed?.thumbnail_url,
                source: 'soundcloud',
                requester,
                addedAt: Date.now(),
            };
        }
        // 4. Apple Music
        if (urlLower.includes('music.apple.com')) {
            const pathTitle = this.extractPathTitle(trimmed);
            return {
                id: 'am_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                title: pathTitle || 'Apple Music Parçası',
                artist: 'Apple Music',
                url: trimmed,
                durationSeconds: 210,
                source: 'applemusic',
                requester,
                addedAt: Date.now(),
            };
        }
        // 5. Deezer
        if (urlLower.includes('deezer.com')) {
            return {
                id: 'dz_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                title: this.extractPathTitle(trimmed) || 'Deezer Parçası',
                artist: 'Deezer',
                url: trimmed,
                durationSeconds: 200,
                source: 'deezer',
                requester,
                addedAt: Date.now(),
            };
        }
        // 6. Direct Audio File Link (.mp3, .ogg, .wav, .m4a, .aac, .flac)
        if (/\.(mp3|ogg|wav|m4a|aac|flac)(\?.*)?$/i.test(trimmed)) {
            const filename = this.extractFilename(trimmed);
            return {
                id: 'dir_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                title: filename,
                artist: 'Doğrudan Ses Dosyası',
                url: trimmed,
                streamUrl: trimmed,
                durationSeconds: 180,
                source: 'direct',
                requester,
                addedAt: Date.now(),
            };
        }
        // 7. General Web Audio / Radio Stream
        return {
            id: 'rad_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            title: this.extractPathTitle(trimmed) || 'Canlı Ses Akışı',
            artist: 'Web Radio Stream',
            url: trimmed,
            streamUrl: trimmed,
            durationSeconds: 0, // Live stream
            source: 'radio',
            requester,
            addedAt: Date.now(),
        };
    }
    async fetchOembed(oembedUrl) {
        try {
            const res = await fetch(oembedUrl, {
                headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 MicupMusicBot/1.0' },
                signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
                return await res.json();
            }
        }
        catch {
            // Network timeout or blocked, use fallbacks
        }
        return null;
    }
    extractYouTubeTitleFallback(url) {
        try {
            const u = new URL(url);
            const v = u.searchParams.get('v');
            if (v)
                return `YouTube Video (${v})`;
            const parts = u.pathname.split('/').filter(Boolean);
            if (parts.length > 0)
                return `YouTube Video (${parts[parts.length - 1]})`;
        }
        catch { }
        return 'YouTube Video';
    }
    extractPathTitle(url) {
        try {
            const u = new URL(url);
            const segments = u.pathname.split('/').filter(Boolean);
            if (segments.length > 0) {
                const last = decodeURIComponent(segments[segments.length - 1])
                    .replace(/[-_]/g, ' ')
                    .replace(/\.(mp3|wav|ogg|m4a)$/i, '');
                return last.charAt(0).toUpperCase() + last.slice(1);
            }
        }
        catch { }
        return 'Ses Parçası';
    }
    extractFilename(url) {
        try {
            const u = new URL(url);
            const segments = u.pathname.split('/').filter(Boolean);
            if (segments.length > 0) {
                return decodeURIComponent(segments[segments.length - 1]);
            }
        }
        catch { }
        return 'audio_stream.mp3';
    }
    cleanSearchTitle(query) {
        return query
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }
    async resolveSpotifyDirectAudioStream(artist, title, album, expectedDuration = 195, isrc) {
        const cleanArtist = artist || '';
        const cleanTitle = title || '';
        const searchQuery = `${cleanArtist} ${cleanTitle}`.trim();
        const cookiePath = path.resolve(process.cwd(), 'cookies.txt');
        const hasCookies = fs.existsSync(cookiePath) && fs.statSync(cookiePath).size > 0;
        // 0. Eğer YouTube IP bot koruması devredeyse veya cookies.txt yoksa,
        // sunucu IP'sinin bot doğrulamasına takılmaması için doğrudan SoundCloud üzerinden anında eşle
        if (!hasCookies || isYouTubeBlocked()) {
            try {
                console.log(`[MusicService] ⚡ Spotify parçası doğrudan SoundCloud ile eşleniyor: "${searchQuery}"`);
                const scRes = await runYtDlp(`scsearch1:${searchQuery}`, {
                    dumpSingleJson: true,
                    flatPlaylist: true,
                });
                const scEntry = scRes?.entries ? scRes.entries[0] : scRes;
                if (scEntry && (scEntry.url || scEntry.id)) {
                    const scUrl = scEntry.url || scEntry.webpage_url;
                    if (scUrl) {
                        console.log(`[MusicService] ☁️ Spotify parçası anında SoundCloud üzerinden eşlendi: "${scEntry.title}"`);
                        return scUrl;
                    }
                }
            }
            catch (err) {
                console.warn(`[MusicService] SoundCloud doğrudan eşleme uyarısı:`, err.message);
            }
            return `scsearch1:${searchQuery}`;
        }
        // 1. ISRC ile doğrudan stüdyo kaydı ara (varsa)
        if (isrc) {
            try {
                const isrcResults = await runYtDlp(`ytsearch1:${isrc}`, {
                    dumpSingleJson: true,
                    flatPlaylist: true,
                });
                const entries = Array.isArray(isrcResults?.entries) ? isrcResults.entries : [isrcResults];
                const bestIsrc = entries[0];
                if (bestIsrc?.id) {
                    return `https://www.youtube.com/watch?v=${bestIsrc.id}`;
                }
            }
            catch {
                // Devam et
            }
        }
        // 2. Yüksek hassasiyetli arama: Sanatçı + Şarkı + Albüm
        const query = album && album !== title && !title.toLowerCase().includes(album.toLowerCase())
            ? `${cleanArtist} ${cleanTitle} ${album}`
            : searchQuery;
        try {
            // Hızlı arama için flatPlaylist kullan (format decrypt beklemez, 1-2 sn içinde döner)
            const searchRes = await runYtDlp(`ytsearch3:${query}`, {
                dumpSingleJson: true,
                flatPlaylist: true,
            });
            const entries = Array.isArray(searchRes?.entries) ? searchRes.entries : [searchRes];
            if (entries.length > 0) {
                // En yakın süreye ve doğru sanatçıya sahip stüdyo kaydını seç
                let bestEntry = entries[0];
                let minDurationDiff = 9999;
                for (const e of entries) {
                    const dur = typeof e?.duration === 'number' ? e.duration : 0;
                    const diff = expectedDuration > 0 && dur > 0 ? Math.abs(dur - expectedDuration) : 0;
                    if (diff < minDurationDiff) {
                        minDurationDiff = diff;
                        bestEntry = e;
                    }
                }
                console.log(`[MusicService] 🎯 En yakın stüdyo kaydı seçildi: "${bestEntry.title}" (${bestEntry.uploader || 'Bilinmeyen'}) [Süre Farkı: ${minDurationDiff}s]`);
                const candidateId = bestEntry?.id;
                if (candidateId) {
                    return `https://www.youtube.com/watch?v=${candidateId}`;
                }
                const directCandidate = bestEntry?.url;
                if (directCandidate && /^https?:\/\//i.test(directCandidate)) {
                    return directCandidate;
                }
            }
        }
        catch (err) {
            console.warn(`[MusicService] Spotify doğrudan ses akışı alma uyarısı: ${err.message}. SoundCloud yedek eşlemesine geçiliyor...`);
        }
        // 3. SoundCloud Yedek Eşleme Fallback
        try {
            const scRes = await runYtDlp(`scsearch1:${searchQuery}`, {
                dumpSingleJson: true,
                flatPlaylist: true,
            });
            const scEntry = scRes?.entries ? scRes.entries[0] : scRes;
            if (scEntry && (scEntry.url || scEntry.id)) {
                const scUrl = scEntry.url || scEntry.webpage_url;
                if (scUrl) {
                    console.log(`[MusicService] ☁️ Spotify parçası SoundCloud üzerinden yedek olarak eşlendi: "${scEntry.title}"`);
                    return scUrl;
                }
            }
        }
        catch { }
        // 4. Arka plan ses motoru fallback
        return `scsearch1:${searchQuery}`;
    }
    async resolvePlaylist(input, requester, maxTracks = 50, isExplicitMixCommand = false) {
        const trimmed = input.trim();
        // 0. Spotify Playlist / Album kontrolü
        const isSpotifyPlaylist = /(?:spotify\.com\/(?:intl-[a-z]{2}\/)?|spotify:)(playlist|album)[/:]([a-zA-Z0-9]{22})/i.test(trimmed);
        if (isSpotifyPlaylist) {
            try {
                console.log(`[MusicService] 📑 Spotify Çalma Listesi / Albüm taranıyor: ${trimmed}`);
                const spData = await this.spotifyMatcher.getSpotifyPlaylistMetadata(trimmed);
                if (spData && spData.tracks.length > 0) {
                    const rawTracks = spData.tracks.slice(0, maxTracks);
                    const tracks = rawTracks.map((item, idx) => ({
                        id: `pl_sp_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
                        title: item.title,
                        artist: item.artist,
                        url: item.url,
                        durationSeconds: item.durationSeconds,
                        thumbnailUrl: spData.thumbnailUrl,
                        source: 'spotify',
                        requester,
                        addedAt: Date.now() + idx,
                    }));
                    // İlk parçanın ses akışını hemen hazırla ki anında çalmaya başlasın
                    if (tracks.length > 0) {
                        try {
                            tracks[0].streamUrl = await this.resolveSpotifyDirectAudioStream(tracks[0].artist || '', tracks[0].title, spData.title, tracks[0].durationSeconds);
                        }
                        catch (err) {
                            console.warn(`[MusicService] İlk parçanın akışı çözülemedi: ${err.message}`);
                        }
                    }
                    return {
                        playlistTitle: spData.title,
                        tracks,
                    };
                }
            }
            catch (err) {
                console.warn(`[MusicService] Spotify playlist çözümleme hatası: ${err.message}`);
            }
        }
        const isPurePlaylist = trimmed.includes('playlist?list=');
        const isYouTubeMix = trimmed.includes('list=RD') || trimmed.includes('list=UL') || trimmed.includes('list=RDMM') || trimmed.includes('list=RDCLAK');
        const isWatchWithList = trimmed.includes('&list=') || trimmed.includes('?list=');
        // If user provided a specific video URL containing standard &list= (not a mix),
        // and didn't use an explicit /mix command, don't hijack it as a 25-track mix unless it's a pure playlist or RD mix
        if (isWatchWithList && !isYouTubeMix && !isExplicitMixCommand && !isPurePlaylist) {
            return null;
        }
        const isPlaylist = isPurePlaylist ||
            isYouTubeMix ||
            isExplicitMixCommand ||
            trimmed.includes('&list=') ||
            trimmed.includes('?list=');
        if (!isPlaylist)
            return null;
        try {
            console.log(`[MusicService] 📑 Toplu playlist / mix taranıyor: ${trimmed}`);
            const cookiePath = path.resolve(process.cwd(), 'cookies.txt');
            const hasCookies = fs.existsSync(cookiePath);
            let targetUrl = trimmed;
            if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
                const query = targetUrl.toLowerCase().includes('mix') || targetUrl.toLowerCase().includes('playlist')
                    ? targetUrl
                    : `${targetUrl} mix`;
                targetUrl = `ytsearch${maxTracks}:${query}`;
            }
            const res = await runYtDlp(targetUrl, {
                dumpSingleJson: true,
                flatPlaylist: true,
                playlistEnd: maxTracks,
                yesPlaylist: true,
            });
            const entries = Array.isArray(res?.entries) ? res.entries : [];
            if (entries.length === 0)
                return null;
            const tracks = entries
                .filter((e) => e && (e.title || e.url || e.id))
                .map((e, idx) => {
                let videoUrl = e.url;
                if (!videoUrl || !videoUrl.startsWith('http')) {
                    const vidId = e.id || e.url;
                    videoUrl = `https://www.youtube.com/watch?v=${vidId}`;
                }
                return {
                    id: `pl_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
                    title: e.title || `Parça #${idx + 1}`,
                    artist: e.uploader || e.channel || res.title || 'YouTube Mix',
                    url: videoUrl,
                    durationSeconds: typeof e.duration === 'number' && e.duration > 0 ? e.duration : 210,
                    thumbnailUrl: e.thumbnails?.[0]?.url,
                    source: 'youtube',
                    requester,
                    addedAt: Date.now() + idx,
                };
            });
            if (tracks.length === 0)
                return null;
            return {
                playlistTitle: res.title || 'YouTube Çalma Listesi / Mix',
                tracks,
            };
        }
        catch (err) {
            console.warn(`[MusicService] Playlist çözme uyarısı (${err.message}).`);
            return null;
        }
    }
    // -------------------------------------------------------------
    // Core Music Commands
    // -------------------------------------------------------------
    async play(guildId, channelId, input, invoker) {
        const player = this.getOrCreatePlayer(guildId, channelId);
        this.clearIdleTimer(guildId);
        const requester = {
            id: invoker.user.id,
            username: invoker.user.username,
            discriminator: invoker.user.discriminator,
        };
        // 1. Check if the input is a batch Playlist / Mix URL
        const playlistResult = await this.resolvePlaylist(input, requester);
        if (playlistResult && playlistResult.tracks.length > 0) {
            const { playlistTitle, tracks } = playlistResult;
            const firstTrack = tracks[0];
            const remainingTracks = tracks.slice(1);
            player.isMixActive = true;
            player.playlistTitle = playlistTitle;
            if (player.state === 'stopped' || !player.currentTrack) {
                player.currentTrack = firstTrack;
                player.state = 'playing';
                player.playbackStartTime = Date.now();
                player.playbackElapsedSeconds = 0;
                this.startPlayerTicker(guildId);
                this.triggerPlayback(guildId, firstTrack);
                for (const t of remainingTracks) {
                    player.queue.push(t);
                }
                const totalSecs = tracks.reduce((acc, t) => acc + (t.durationSeconds || 0), 0);
                const msg = [
                    `📑 **Toplu Çalma Listesi / Mix Başlatıldı!**`,
                    `• **Mix / Liste Adı:** \`${playlistTitle}\``,
                    `• **Toplam Şarkı Sayısı:** \`${tracks.length} adet\` • **Toplam Süre:** \`~${this.formatDuration(totalSecs)}\``,
                    `• **Şimdi Çalıyor:** [${firstTrack.title}](${firstTrack.url})`,
                    `• **Kuyruğa Eklenen:** \`${remainingTracks.length} adet parça sıraya alındı\``,
                    `• **İsteyen:** <@${requester.id}>`,
                ].join('\n');
                return {
                    track: firstTrack,
                    isPlayingNow: true,
                    position: 1,
                    message: msg,
                    components: this.buildPlayerButtons(),
                };
            }
            // If already playing, append all playlist tracks to the queue
            const startPos = player.queue.length + 1;
            for (const t of tracks) {
                player.queue.push(t);
            }
            const endPos = player.queue.length;
            const totalSecs = tracks.reduce((acc, t) => acc + (t.durationSeconds || 0), 0);
            const msg = [
                `📑 **Toplu Çalma Listesi / Mix Kuyruğa Eklendi!**`,
                `• **Mix / Liste Adı:** \`${playlistTitle}\``,
                `• **Eklenen Şarkı:** \`${tracks.length} adet\` • **Toplam Süre:** \`~${this.formatDuration(totalSecs)}\``,
                `• **Kuyruk Sırası:** \`#${startPos} ➔ #${endPos}\``,
                `• **İsteyen:** <@${requester.id}>`,
            ].join('\n');
            return {
                track: firstTrack,
                isPlayingNow: false,
                position: startPos,
                message: msg,
                components: this.buildPlayerButtons(),
            };
        }
        // 2. Single track resolution (original logic)
        const track = await this.resolveInput(input, requester);
        if (player.state === 'stopped' || !player.currentTrack) {
            // Start immediately
            player.currentTrack = track;
            player.state = 'playing';
            player.playbackStartTime = Date.now();
            player.playbackElapsedSeconds = 0;
            this.startPlayerTicker(guildId);
            this.triggerPlayback(guildId, track);
            const embed = this.buildNowPlayingEmbed(player);
            const components = this.buildPlayerButtons();
            return {
                track,
                isPlayingNow: true,
                position: 1,
                message: embed,
                components,
            };
        }
        // Normal queue addition: place at END of queue (FIFO order)
        player.queue.push(track);
        const position = player.queue.length;
        const badge = this.getSourceBadge(track.source);
        const durStr = this.formatDuration(track.durationSeconds);
        const msg = [
            `🎵 **Kuyruğa Eklendi:**`,
            `• **Parça:** [${track.title}](${track.url})`,
            `• **Kanal / Sanatçı:** \`${track.artist}\` | ${badge}`,
            `• **Süre:** \`${durStr}\` • **Sıra:** \`#${position}\``,
            `• **İsteyen:** <@${requester.id}>`,
            `💡 *Beklemeden hemen dinlemek için \`/playnow <şarkı>\` kullanabilirsiniz.*`,
        ].join('\n');
        return {
            track,
            isPlayingNow: false,
            position,
            message: msg,
            components: this.buildPlayerButtons(),
        };
    }
    async playMix(guildId, channelId, input, invoker) {
        const requester = {
            id: invoker.user.id,
            username: invoker.user.username,
            discriminator: invoker.user.discriminator,
        };
        const playlistResult = await this.resolvePlaylist(input, requester, 25, true);
        if (!playlistResult || playlistResult.tracks.length === 0) {
            return {
                isPlayingNow: false,
                position: 0,
                message: '❌ Belirtilen mix veya çalma listesi bulunamadı ya da okunamadı.',
            };
        }
        const player = this.getOrCreatePlayer(guildId, channelId);
        this.clearIdleTimer(guildId);
        player.isMixActive = true;
        player.playlistTitle = playlistResult.playlistTitle;
        const firstTrack = playlistResult.tracks[0];
        const remainingTracks = playlistResult.tracks.slice(1);
        if (player.state === 'stopped' || !player.currentTrack) {
            player.currentTrack = firstTrack;
            player.state = 'playing';
            player.playbackStartTime = Date.now();
            player.playbackElapsedSeconds = 0;
            this.startPlayerTicker(guildId);
            this.triggerPlayback(guildId, firstTrack);
            for (const t of remainingTracks) {
                player.queue.push(t);
            }
            const totalSecs = playlistResult.tracks.reduce((acc, t) => acc + (t.durationSeconds || 0), 0);
            return {
                track: firstTrack,
                isPlayingNow: true,
                position: 1,
                message: [
                    `📑 **Toplu Çalma Listesi / Mix Başlatıldı!**`,
                    `• **Mix / Liste Adı:** \`${playlistResult.playlistTitle}\``,
                    `• **Toplam Şarkı Sayısı:** \`${playlistResult.tracks.length} adet\` • **Toplam Süre:** \`~${this.formatDuration(totalSecs)}\``,
                    `• **Şimdi Çalıyor:** [${firstTrack.title}](${firstTrack.url})`,
                    `• **Kuyruğa Eklenen:** \`${remainingTracks.length} adet parça sıraya alındı\``,
                    `• **İsteyen:** <@${requester.id}>`,
                ].join('\n'),
                components: this.buildPlayerButtons(),
            };
        }
        const startPos = player.queue.length + 1;
        for (const t of playlistResult.tracks) {
            player.queue.push(t);
        }
        const endPos = player.queue.length;
        const totalSecs = playlistResult.tracks.reduce((acc, t) => acc + (t.durationSeconds || 0), 0);
        return {
            track: firstTrack,
            isPlayingNow: false,
            position: startPos,
            message: [
                `📑 **Toplu Çalma Listesi / Mix Kuyruğa Eklendi!**`,
                `• **Mix / Liste Adı:** \`${playlistResult.playlistTitle}\``,
                `• **Eklenen Şarkı:** \`${playlistResult.tracks.length} adet\` • **Toplam Süre:** \`~${this.formatDuration(totalSecs)}\``,
                `• **Kuyruk Sırası:** \`#${startPos} ➔ #${endPos}\``,
                `• **İsteyen:** <@${requester.id}>`,
            ].join('\n'),
            components: this.buildPlayerButtons(),
        };
    }
    async playNow(guildId, channelId, input, invoker) {
        const player = this.getOrCreatePlayer(guildId, channelId);
        this.clearIdleTimer(guildId);
        const requester = {
            id: invoker.user.id,
            username: invoker.user.username,
            discriminator: invoker.user.discriminator,
        };
        const track = await this.resolveInput(input, requester);
        // Stop current track and immediately play this new track
        player.currentTrack = track;
        player.state = 'playing';
        player.playbackStartTime = Date.now();
        player.playbackElapsedSeconds = 0;
        this.startPlayerTicker(guildId);
        this.triggerPlayback(guildId, track);
        const embed = this.buildNowPlayingEmbed(player);
        const components = this.buildPlayerButtons();
        return {
            track,
            isPlayingNow: true,
            position: 1,
            message: `⚡ **Hemen Çalınıyor:** Mevcut şarkı kesildi ve istediğiniz parça hemen başlatıldı!\n\n${embed}`,
            components,
        };
    }
    async playNext(guildId, channelId, input, invoker) {
        const player = this.getOrCreatePlayer(guildId, channelId);
        this.clearIdleTimer(guildId);
        const requester = {
            id: invoker.user.id,
            username: invoker.user.username,
            discriminator: invoker.user.discriminator,
        };
        const track = await this.resolveInput(input, requester);
        if (player.state === 'stopped' || !player.currentTrack) {
            player.currentTrack = track;
            player.state = 'playing';
            player.playbackStartTime = Date.now();
            player.playbackElapsedSeconds = 0;
            this.startPlayerTicker(guildId);
            this.triggerPlayback(guildId, track);
            return {
                track,
                isPlayingNow: true,
                position: 1,
                message: this.buildNowPlayingEmbed(player),
                components: this.buildPlayerButtons(),
            };
        }
        // Insert at index 0 of the queue (first in line)
        player.queue.unshift(track);
        const badge = this.getSourceBadge(track.source);
        const durStr = this.formatDuration(track.durationSeconds);
        const msg = [
            `⏭️ **Sıradaki Şarkı Olarak Eklendi:**`,
            `• **Parça:** [${track.title}](${track.url})`,
            `• **Kanal / Sanatçı:** \`${track.artist}\` | ${badge}`,
            `• **Süre:** \`${durStr}\` • **Sıra:** \`#1 (Şimdiki şarkı bitince veya /skip yapınca çalacak)\``,
            `• **İsteyen:** <@${requester.id}>`,
        ].join('\n');
        return {
            track,
            isPlayingNow: false,
            position: 1,
            message: msg,
            components: this.buildPlayerButtons(),
        };
    }
    async skipTo(guildId, position) {
        const player = this.players.get(guildId);
        if (!player || !player.currentTrack) {
            return { success: false, message: '❌ Atlanacak bir parça bulunmuyor.' };
        }
        if (position < 1 || position > player.queue.length) {
            return { success: false, message: `❌ Geçersiz sıra numarası. Kuyrukta 1 ile ${player.queue.length} arasında şarkı var.` };
        }
        const targetIdx = position - 1;
        player.queue.splice(0, targetIdx);
        return this.skip(guildId);
    }
    pause(guildId) {
        const player = this.players.get(guildId);
        if (!player || !player.currentTrack) {
            return { success: false, message: '❌ Şu anda çalan bir parça yok.' };
        }
        if (player.state === 'paused') {
            return { success: false, message: '⚠️ Müzik zaten duraklatılmış durumda. Devam ettirmek için `/resume` kullanın.' };
        }
        // Accumulate elapsed
        player.playbackElapsedSeconds += (Date.now() - player.playbackStartTime) / 1000;
        player.state = 'paused';
        this.voiceClient?.pauseAudio(guildId);
        return {
            success: true,
            message: `⏸️ **Duraklatıldı:** [${player.currentTrack.title}](${player.currentTrack.url})\nDevam etmek için \`/resume\` veya aşağıdaki butona basın.`,
            components: this.buildPlayerButtons(),
        };
    }
    resume(guildId) {
        const player = this.players.get(guildId);
        if (!player || !player.currentTrack) {
            return { success: false, message: '❌ Şu anda çalan veya duraklatılmış bir parça yok.' };
        }
        if (player.state === 'playing') {
            return { success: false, message: '⚠️ Müzik zaten çalıyor.' };
        }
        player.playbackStartTime = Date.now();
        player.state = 'playing';
        this.voiceClient?.resumeAudio(guildId);
        return {
            success: true,
            message: `▶️ **Devam Ediyor:** [${player.currentTrack.title}](${player.currentTrack.url})`,
            components: this.buildPlayerButtons(),
        };
    }
    async skip(guildId) {
        const player = this.players.get(guildId);
        if (!player || !player.currentTrack) {
            return { success: false, message: '❌ Atlanacak bir parça bulunmuyor.' };
        }
        const skipped = player.currentTrack;
        if (player.queue.length > 0) {
            const next = player.queue.shift();
            player.currentTrack = next;
            player.state = 'playing';
            player.playbackStartTime = Date.now();
            player.playbackElapsedSeconds = 0;
            this.triggerPlayback(guildId, next);
            return {
                success: true,
                message: `⏭️ **Parça Atlandı:** \`${skipped.title}\`\n\n${this.buildNowPlayingEmbed(player)}`,
                components: this.buildPlayerButtons(),
            };
        }
        // Queue ended
        player.currentTrack = null;
        player.state = 'stopped';
        player.playbackStartTime = 0;
        player.playbackElapsedSeconds = 0;
        this.stopPlayerTicker(guildId);
        this.voiceClient?.stopAudio(guildId);
        return {
            success: true,
            message: `⏭️ **Parça Atlandı:** \`${skipped.title}\`\nKuyrukta başka parça kalmadı. Müzik çalar durduruldu.`,
        };
    }
    stop(guildId) {
        const player = this.players.get(guildId);
        if (!player || player.state === 'stopped') {
            return { success: false, message: '❌ Şu anda aktif bir müzik oturumu yok.' };
        }
        this.voiceClient?.stopAudio(guildId);
        this.disconnectFromVoice(guildId);
        player.queue = [];
        player.currentTrack = null;
        player.state = 'stopped';
        player.playbackStartTime = 0;
        player.playbackElapsedSeconds = 0;
        this.stopPlayerTicker(guildId);
        return {
            success: true,
            message: '⏹️ **Müzik Çalar Durduruldu:** Çalma durduruldu, kuyruk temizlendi ve ses kanalından ayrıldım.',
        };
    }
    getQueue(guildId, page = 1) {
        const player = this.players.get(guildId);
        if (!player || (!player.currentTrack && player.queue.length === 0)) {
            return { message: '📜 **Müzik Kuyruğu:** Şu anda kuyrukta hiçbir şarkı yok. `/play <link>` ile ekleyebilirsiniz.' };
        }
        const pageSize = 10;
        const totalPages = Math.max(1, Math.ceil(player.queue.length / pageSize));
        const currentPage = Math.max(1, Math.min(page, totalPages));
        const lines = [];
        lines.push('🎧 **Jockie Music — Şarkı Kuyruğu**');
        lines.push('────────────────────────────────────────');
        if (player.currentTrack) {
            const elapsed = this.formatDuration(this.getElapsedSeconds(player));
            const total = this.formatDuration(player.currentTrack.durationSeconds);
            const badge = this.getSourceBadge(player.currentTrack.source);
            const statusIcon = player.state === 'playing' ? '▶️' : '⏸️';
            lines.push(`${statusIcon} **Şimdi Çalıyor:**`);
            lines.push(`• [${player.currentTrack.title}](${player.currentTrack.url}) — \`${player.currentTrack.artist}\``);
            lines.push(`  \`[${elapsed} / ${total}]\` • ${badge} • İsteyen: <@${player.currentTrack.requester.id}>`);
            lines.push('────────────────────────────────────────');
        }
        if (player.queue.length === 0) {
            lines.push('*Kuyrukta bekleyen parça yok.*');
        }
        else {
            lines.push(`**Sıradaki Parçalar (${player.queue.length} adet):**`);
            const startIdx = (currentPage - 1) * pageSize;
            const pageTracks = player.queue.slice(startIdx, startIdx + pageSize);
            for (let i = 0; i < pageTracks.length; i++) {
                const t = pageTracks[i];
                const num = startIdx + i + 1;
                const dur = this.formatDuration(t.durationSeconds);
                lines.push(`**${num}.** [${t.title}](${t.url}) — \`${dur}\` | <@${t.requester.id}>`);
            }
        }
        lines.push('────────────────────────────────────────');
        const totalQueueSecs = player.queue.reduce((acc, t) => acc + (t.durationSeconds || 0), 0);
        lines.push(`📑 **Sayfa:** ${currentPage}/${totalPages} • **Toplam Kuyruk Süresi:** \`${this.formatDuration(totalQueueSecs)}\` • **Döngü:** \`${player.loopMode.toUpperCase()}\``);
        return {
            message: lines.join('\n'),
            components: this.buildPlayerButtons(),
        };
    }
    getNowPlaying(guildId) {
        const player = this.players.get(guildId);
        if (!player || !player.currentTrack) {
            return { message: '❌ Şu anda hiçbir parça çalmıyor.' };
        }
        return {
            message: this.buildNowPlayingEmbed(player),
            components: this.buildPlayerButtons(),
        };
    }
    setVolume(guildId, volume) {
        const player = this.getOrCreatePlayer(guildId, '');
        const clamped = Math.max(0, Math.min(200, volume));
        const old = player.volume;
        player.volume = clamped;
        this.voiceClient?.setVolume(guildId, clamped);
        const icon = clamped === 0 ? '🔇' : clamped < 50 ? '🔉' : '🔊';
        return {
            success: true,
            message: `${icon} **Ses Düzeyi Ayarlandı:** \`%${old}\` ➔ \`%${clamped}\``,
        };
    }
    // -------------------------------------------------------------
    // Audio Filters (FFmpeg Filters & Sound Effects)
    // -------------------------------------------------------------
    setFilter(guildId, filterType, param) {
        const player = this.getOrCreatePlayer(guildId, '');
        const norm = filterType.toLowerCase().trim();
        if (norm === 'off' || norm === 'clear' || norm === 'none' || norm === 'reset') {
            return this.clearFilter(guildId);
        }
        let filterStr = '';
        let displayName = norm;
        switch (norm) {
            case 'bassboost':
            case 'bass': {
                const level = (param || 'medium').toLowerCase();
                let gain = 10;
                if (level === 'low')
                    gain = 5;
                else if (level === 'medium' || level === 'med')
                    gain = 10;
                else if (level === 'high')
                    gain = 16;
                else if (level === 'extreme' || level === 'earrape')
                    gain = 24;
                else if (!isNaN(Number(level))) {
                    gain = Math.max(1, Math.min(30, Number(level)));
                }
                filterStr = `bass=g=${gain}:f=100,alimiter=limit=0.95:attack=5:release=50:asc=1`;
                displayName = `BassBoost (${gain}dB)`;
                break;
            }
            case 'nightcore':
            case 'nc': {
                filterStr = 'asetrate=48000*1.25,aresample=48000,atempo=1.0,alimiter=limit=0.95:attack=5:release=50:asc=1';
                displayName = 'Nightcore (1.25x Pitch)';
                break;
            }
            case 'vaporwave':
            case 'slowed': {
                filterStr = 'asetrate=48000*0.82,aresample=48000,atempo=1.0,alimiter=limit=0.95:attack=5:release=50:asc=1';
                displayName = 'Vaporwave / Slowed';
                break;
            }
            case '8d':
            case '3d': {
                if (param && (param.toLowerCase() === 'off' || param.toLowerCase() === 'kapat')) {
                    return this.clearFilter(guildId);
                }
                filterStr = 'apulsator=hz=0.125:amount=1:offset_r=0.5,stereotools=mlev=0.015,extrastereo=m=1.3,alimiter=limit=0.95:attack=5:release=50:asc=1';
                displayName = '8D Audio (Uzamsal Ses)';
                break;
            }
            case 'tremolo': {
                filterStr = 'tremolo=f=5:d=0.5,alimiter=limit=0.95:attack=5:release=50:asc=1';
                displayName = 'Tremolo';
                break;
            }
            case 'speed': {
                const speedVal = param ? parseFloat(param) : 1.25;
                const clamped = Math.max(0.5, Math.min(2.0, isNaN(speedVal) ? 1.25 : speedVal));
                filterStr = `atempo=${clamped},alimiter=limit=0.95:attack=5:release=50:asc=1`;
                displayName = `Hız (${clamped}x)`;
                break;
            }
            default:
                return {
                    success: false,
                    message: `❌ Bilinmeyen ses filtresi: \`${filterType}\`\nKullanılabilir filtreler: \`bassboost\`, \`nightcore\`, \`vaporwave\`, \`8d\`, \`tremolo\`, \`speed\`, \`clear\``,
                };
        }
        player.filter = filterStr;
        player.filterName = displayName;
        this.voiceClient?.setAudioFilter(guildId, filterStr);
        // If currently playing, seamlessly restart track from current position with the new filter (0ms freeze)
        if (player.state === 'playing' && player.currentTrack) {
            const elapsed = this.getElapsedSeconds(player);
            player.playbackStartTime = Date.now();
            player.playbackElapsedSeconds = elapsed;
            this.triggerPlayback(guildId, player.currentTrack, elapsed, true);
        }
        return {
            success: true,
            filterName: displayName,
            message: `🎛️ **Ses Filtresi Uygulandı:** \`${displayName}\` efekti aktif edildi!`,
        };
    }
    clearFilter(guildId) {
        const player = this.getOrCreatePlayer(guildId, '');
        const hadFilter = !!player.filter;
        player.filter = null;
        player.filterName = null;
        this.voiceClient?.setAudioFilter(guildId, undefined);
        if (hadFilter && player.state === 'playing' && player.currentTrack) {
            const elapsed = this.getElapsedSeconds(player);
            player.playbackStartTime = Date.now();
            player.playbackElapsedSeconds = elapsed;
            this.triggerPlayback(guildId, player.currentTrack, elapsed, true);
        }
        return {
            success: true,
            message: '🎛️ **Ses Filtresi Sıfırlandı:** Tüm aktif ses efektleri kaldırıldı, standart sese dönüldü.',
        };
    }
    getFilter(guildId) {
        const player = this.players.get(guildId);
        return {
            filterName: player?.filterName || null,
            rawFilter: player?.filter || null,
        };
    }
    setLoop(guildId, targetMode) {
        const player = this.players.get(guildId);
        if (!player) {
            return { success: false, loopMode: 'off', message: '❌ Aktif bir müzik oturumu bulunamadı.' };
        }
        if (targetMode) {
            player.loopMode = targetMode;
        }
        else {
            // Cycle: off -> track -> queue -> off
            if (player.loopMode === 'off')
                player.loopMode = 'track';
            else if (player.loopMode === 'track')
                player.loopMode = 'queue';
            else
                player.loopMode = 'off';
        }
        const desc = player.loopMode === 'track'
            ? '🔂 **Tek Şarkı Döngüsü:** Mevcut şarkı bittiğinde baştan çalacak.'
            : player.loopMode === 'queue'
                ? '🔁 **Kuyruk Döngüsü:** Şarkılar bittikçe kuyruğun sonuna eklenecek.'
                : '➡️ **Döngü Kapalı:** Şarkılar sırayla çalınıp tamamlanacak.';
        return {
            success: true,
            loopMode: player.loopMode,
            message: desc,
            components: this.buildPlayerButtons(),
        };
    }
    shuffle(guildId) {
        const player = this.players.get(guildId);
        if (!player || player.queue.length <= 1) {
            return { success: false, message: '⚠️ Karıştırmak için kuyrukta en az 2 parça olmalıdır.' };
        }
        // Fisher-Yates shuffle
        for (let i = player.queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [player.queue[i], player.queue[j]] = [player.queue[j], player.queue[i]];
        }
        return {
            success: true,
            message: `🔀 **Kuyruk Karıştırıldı:** \`${player.queue.length}\` adet parça rastgele sıralandı.`,
        };
    }
    remove(guildId, index) {
        const player = this.players.get(guildId);
        if (!player || player.queue.length === 0) {
            return { success: false, message: '❌ Kuyrukta kaldırılacak parça yok.' };
        }
        if (index < 1 || index > player.queue.length) {
            return {
                success: false,
                message: `❌ Geçersiz sıra numarası! 1 ile ${player.queue.length} arasında bir sayı girmelisiniz.`,
            };
        }
        const removed = player.queue.splice(index - 1, 1)[0];
        return {
            success: true,
            message: `🗑️ **Kuyruktan Kaldırıldı:** #${index} [${removed.title}](${removed.url})`,
        };
    }
    clearQueue(guildId) {
        const player = this.players.get(guildId);
        if (!player || player.queue.length === 0) {
            return { success: false, message: '⚠️ Kuyruk zaten boş.' };
        }
        const count = player.queue.length;
        player.queue = [];
        return {
            success: true,
            message: `🧹 **Kuyruk Temizlendi:** \`${count}\` adet şarkı kuyruktan silindi. Çalan parça devam ediyor.`,
        };
    }
    seek(guildId, seconds) {
        const player = this.players.get(guildId);
        if (!player || !player.currentTrack) {
            return { success: false, message: '❌ Şu anda çalan bir parça yok.' };
        }
        if (player.currentTrack.durationSeconds <= 0) {
            return { success: false, message: '⚠️ Canlı yayınlarda ve radyo akışlarında süre atlaması yapılamaz.' };
        }
        const clamped = Math.max(0, Math.min(player.currentTrack.durationSeconds - 2, seconds));
        player.playbackStartTime = Date.now();
        player.playbackElapsedSeconds = clamped;
        if (player.state === 'playing') {
            this.triggerPlayback(guildId, player.currentTrack, clamped, true);
        }
        return {
            success: true,
            message: `⏩ **Zaman Atlandı:** Parça \`${this.formatDuration(clamped)}\` konumuna alındı.`,
        };
    }
    async playRadio(guildId, channelId, stationKey, invoker) {
        const target = RADIO_STATIONS.find((r) => r.key.toLowerCase() === stationKey.toLowerCase() || r.name.toLowerCase().includes(stationKey.toLowerCase()));
        if (!target) {
            const list = RADIO_STATIONS.map((r) => `• \`/radio ${r.key}\` — **${r.name}** (${r.genre})`).join('\n');
            return {
                success: false,
                message: `❌ İstasyon bulunamadı. Kullanılabilir Canlı Radyolar:\n\n${list}`,
            };
        }
        const player = this.getOrCreatePlayer(guildId, channelId);
        const track = {
            id: 'radio_' + target.key + '_' + Date.now(),
            title: `${target.name} Canlı Yayını`,
            artist: target.genre,
            url: target.url,
            streamUrl: target.url,
            durationSeconds: 0, // Live
            source: 'radio',
            requester: {
                id: invoker.user.id,
                username: invoker.user.username,
                discriminator: invoker.user.discriminator,
            },
            addedAt: Date.now(),
        };
        player.currentTrack = track;
        player.state = 'playing';
        player.playbackStartTime = Date.now();
        player.playbackElapsedSeconds = 0;
        this.startPlayerTicker(guildId);
        this.triggerPlayback(guildId, track);
        const embed = this.buildNowPlayingEmbed(player);
        return {
            success: true,
            message: `📻 **Radyo Başlatıldı:**\n\n${embed}`,
            components: this.buildPlayerButtons(),
        };
    }
    // -------------------------------------------------------------
    // Helpers & Embed Builders
    // -------------------------------------------------------------
    getElapsedSeconds(player) {
        if (player.state === 'stopped')
            return 0;
        if (player.state === 'paused')
            return Math.floor(player.playbackElapsedSeconds);
        const running = (Date.now() - player.playbackStartTime) / 1000;
        return Math.floor(player.playbackElapsedSeconds + running);
    }
    buildNowPlayingEmbed(player) {
        const track = player.currentTrack;
        if (!track)
            return '❌ Şu anda çalan bir parça yok.';
        const elapsed = this.getElapsedSeconds(player);
        const total = track.durationSeconds;
        const badge = this.getSourceBadge(track.source);
        const progressBar = this.createProgressBar(elapsed, total);
        const stateStr = player.state === 'playing' ? '▶️ Oynatılıyor' : '⏸️ Duraklatıldı';
        const lines = [
            `🎵 **Jockie Music — Şimdi Çalıyor**`,
            `────────────────────────────────────────`,
            `**[${track.title}](${track.url})**`,
            `• **Sanatçı / Yayıncı:** \`${track.artist}\``,
            `• **Platform:** ${badge}`,
            `• **Ses Kanalı:** 🔊 \`${player.voiceChannelName || player.voiceChannelId || 'Ses Bağlantısı'}\``,
            `• **İsteyen:** <@${track.requester.id}>`,
            ``,
            `${progressBar}`,
            `• **Durum:** \`${stateStr}\` | **Ses:** \`%${player.volume}\` | **Döngü:** \`${player.loopMode.toUpperCase()}\`${player.filterName ? ` | **Filtre:** \`${player.filterName}\`` : ''}`,
            `────────────────────────────────────────`,
        ];
        return lines.join('\n');
    }
    buildPlayerButtons() {
        return [
            {
                type: 1, // ActionRow
                components: [
                    {
                        type: 2,
                        style: 2, // Secondary
                        custom_id: 'music_toggle',
                        label: 'Duraklat / Devam',
                        emoji: { name: '⏯️' },
                    },
                    {
                        type: 2,
                        style: 2,
                        custom_id: 'music_skip',
                        label: 'Geç',
                        emoji: { name: '⏭️' },
                    },
                    {
                        type: 2,
                        style: 2,
                        custom_id: 'music_stop',
                        label: 'Durdur',
                        emoji: { name: '⏹️' },
                    },
                    {
                        type: 2,
                        style: 2,
                        custom_id: 'music_loop',
                        label: 'Döngü',
                        emoji: { name: '🔁' },
                    },
                    {
                        type: 2,
                        style: 2,
                        custom_id: 'music_queue',
                        label: 'Kuyruk',
                        emoji: { name: '📜' },
                    },
                ],
            },
        ];
    }
    async sendNowPlaying(player, isRepeat = false) {
        const embed = this.buildNowPlayingEmbed(player);
        const prefix = isRepeat ? '🔁 **Tekrar Çalıyor:**\n\n' : '';
        try {
            await this.api.sendMessage(player.channelId, prefix + embed, {
                components: this.buildPlayerButtons(),
            });
        }
        catch { }
    }
    createProgressBar(elapsed, total, size = 14) {
        if (total <= 0) {
            return `🔴 **CANLI YAYIN** \`[🔘${'─'.repeat(size)}]\``;
        }
        const clampedElapsed = Math.min(elapsed, total);
        const progress = Math.min(1, Math.max(0, clampedElapsed / total));
        const circlePos = Math.round(progress * size);
        const before = '─'.repeat(circlePos);
        const after = '─'.repeat(Math.max(0, size - circlePos));
        const bar = `${before}🔘${after}`;
        const elapsedText = this.formatDuration(clampedElapsed);
        const totalText = this.formatDuration(total);
        return `\`${elapsedText}\` ┃${bar}┃ \`${totalText}\``;
    }
    formatDuration(seconds) {
        if (seconds <= 0)
            return 'CANLI';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const pad = (n) => n.toString().padStart(2, '0');
        if (hrs > 0) {
            return `${hrs}:${pad(mins)}:${pad(secs)}`;
        }
        return `${pad(mins)}:${pad(secs)}`;
    }
    getSourceBadge(source) {
        switch (source) {
            case 'youtube':
                return '▶️ `[YouTube]`';
            case 'spotify':
                return '🟢 `[Spotify]`';
            case 'soundcloud':
                return '🟠 `[SoundCloud]`';
            case 'applemusic':
                return '🍎 `[Apple Music]`';
            case 'deezer':
                return '🟣 `[Deezer]`';
            case 'direct':
                return '🎵 `[Doğrudan Ses]`';
            case 'radio':
                return '📻 `[Canlı Radyo]`';
            default:
                return '🎶 `[Müzik]`';
        }
    }
}
//# sourceMappingURL=MusicService.js.map