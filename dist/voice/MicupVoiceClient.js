// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { getFfmpegBinary, getYtDlpInstance } from '../utils/mediaBinaries.js';
import { AudioFrame, AudioSource, LocalAudioTrack, Room, RoomEvent, TrackPublishOptions, TrackSource, } from '@livekit/rtc-node';
import { AudioEncoding } from '@livekit/rtc-ffi-bindings';
import { isSafeAudioTarget } from '../utils/security.js';
export class MicupVoiceClient {
    sessions = new Map();
    guildVolumes = new Map();
    guildFilters = new Map();
    streamUrlCache = new Map();
    getCachedStreamUrl(key) {
        const item = this.streamUrlCache.get(key);
        if (!item)
            return undefined;
        if (Date.now() > item.expiresAt) {
            this.streamUrlCache.delete(key);
            return undefined;
        }
        return item.directUrl;
    }
    setCachedStreamUrl(key, directUrl, ttlMs = 4 * 3600 * 1000) {
        this.streamUrlCache.set(key, { directUrl, expiresAt: Date.now() + ttlMs });
    }
    setVolume(guildId, volumePercent) {
        const factor = Math.max(0, Math.min(200, volumePercent)) / 100;
        this.guildVolumes.set(guildId, factor);
        const session = this.sessions.get(guildId);
        if (session) {
            session.volume = factor;
            console.log(`[MicupVoiceClient] 🔊 Ses düzeyi ayarlandı (Sunucu: ${guildId}): %${volumePercent} (çarpan: ${factor})`);
        }
    }
    getVolume(guildId) {
        return (this.guildVolumes.get(guildId) ?? 1.0) * 100;
    }
    setAudioFilter(guildId, filterStr) {
        if (filterStr) {
            this.guildFilters.set(guildId, filterStr);
        }
        else {
            this.guildFilters.delete(guildId);
        }
        const session = this.sessions.get(guildId);
        if (session) {
            session.audioFilter = filterStr || undefined;
            console.log(`[MicupVoiceClient] 🎛️ Ses filtresi kaydedildi (Sunucu: ${guildId}): ${filterStr || 'Kapalı'}`);
        }
    }
    getAudioFilter(guildId) {
        const session = this.sessions.get(guildId);
        return session?.audioFilter || this.guildFilters.get(guildId);
    }
    /**
     * Connects to the LiveKit voice room using the server credentials from Gateway VOICE_SERVER_UPDATE.
     */
    async connect(serverData) {
        const { guild_id, channel_id, endpoint, token } = serverData;
        const existing = this.sessions.get(guild_id);
        if (existing && existing.room?.connectionState === 1) {
            if (!channel_id || existing.channelId === channel_id) {
                console.log(`[MicupVoiceClient] LiveKit ses odası (${channel_id || 'mevcut'}) zaten bağlı ve aktif. Yeniden bağlanma atlandı.`);
                return;
            }
        }
        // Disconnect any existing session for this guild
        this.disconnect(guild_id);
        const base = endpoint.startsWith('ws://') || endpoint.startsWith('wss://')
            ? endpoint
            : `wss://${endpoint}`;
        const cleanBase = base.replace(/\/+$/, '');
        console.log(`[MicupVoiceClient] LiveKit ses odasına bağlanılıyor (${cleanBase})... Sunucu: ${guild_id}`);
        const initialVolume = this.guildVolumes.get(guild_id) ?? 1.0;
        const session = {
            endpoint: cleanBase,
            channelId: channel_id,
            audioQueue: [],
            isPaused: false,
            playId: 0,
            ffmpegFinished: false,
            audioStarted: false,
            volume: initialVolume,
        };
        this.sessions.set(guild_id, session);
        // Establish WebRTC connection via @livekit/rtc-node Room
        try {
            const room = new Room();
            session.room = room;
            room.on(RoomEvent.Connected, () => {
                console.log(`[MicupVoiceClient] 🔊 WebRTC Oda Bağlantısı BAŞARILI! (Oda: ${room.name})`);
            });
            room.on(RoomEvent.Disconnected, (reason) => {
                console.log(`[MicupVoiceClient] WebRTC Oda Bağlantısı kapandı (Sunucu: ${guild_id}, Sebep: ${reason})`);
                this.stopAudio(guild_id);
            });
            await room.connect(cleanBase, token, {
                autoSubscribe: true,
                dynacast: false,
                adaptiveStream: false,
            });
            // Set up AudioSource & LocalAudioTrack to publish audio to the room
            const source = new AudioSource(48000, 2);
            session.source = source;
            const track = LocalAudioTrack.createAudioTrack('micup_music_track', source);
            session.track = track;
            const publishOpts = new TrackPublishOptions();
            publishOpts.source = TrackSource.SOURCE_MICROPHONE;
            // Micup Ses İşleme ("Özel"):
            // Bas konuş: KAPALI -> dtx (Discontinuous Transmission) devre dışı, kesintisiz yüksek sadakatli ses akışı
            publishOpts.dtx = false;
            // Ağ paket kaybı koruması (RED - Redundant Audio Data)
            publishOpts.red = true;
            // 128 kbps stereo yüksek kalite ses kodlama
            publishOpts.audioEncoding = new AudioEncoding({
                maxBitrate: 128000n,
            });
            const pub = await room.localParticipant?.publishTrack(track, publishOpts);
            console.log(`[MicupVoiceClient] 🎙️ Ses kanalı yayını aktif! (Yayın ID: ${pub?.sid || 'hazır'}) [Ses İşleme: Bas-Konuş Kapalı, 128kbps Stereo, RED Aktif]`);
            // Start the audio frame dispatcher ticker for this session
            this.startAudioDispatcher(guild_id, session);
        }
        catch (err) {
            console.error(`[MicupVoiceClient] WebRTC Room.connect hatası:`, err.message);
        }
    }
    /**
     * Dispatches PCM audio chunks from queue to LiveKit AudioSource at precise 20ms intervals.
     * Handles backpressure and ensures all buffered audio plays out completely before signaling track end.
     */
    startAudioDispatcher(guildId, session) {
        if (session.audioInterval)
            clearInterval(session.audioInterval);
        // Frame size: 48000 samples/sec * 0.02s = 960 samples per channel.
        // 2 channels * 2 bytes/sample = 3840 bytes.
        const FRAME_SIZE = 3840;
        const SAMPLES_PER_CHANNEL = 960;
        let framesDispatched = 0;
        session.audioInterval = setInterval(async () => {
            if (session.isPaused || !session.source)
                return;
            // Resume ffmpeg stdout if paused and queue has drained below threshold
            if (session.ffmpegProcess?.stdout?.isPaused() && session.audioQueue.length < 500) {
                session.ffmpegProcess.stdout.resume();
            }
            // Check if audio has completely finished playing
            if (session.audioQueue.length === 0) {
                if (session.audioStarted && session.ffmpegFinished && !session.isStopping) {
                    session.audioStarted = false;
                    session.ffmpegFinished = false;
                    const cb = session.onEndedCallback;
                    session.onEndedCallback = undefined;
                    console.log(`[MicupVoiceClient] 🎵 Şarkı baştan sona kesintisiz çalındı ve bitti (Sunucu: ${guildId})`);
                    if (cb)
                        cb();
                }
                return;
            }
            const chunk = session.audioQueue.shift();
            if (!chunk || chunk.length < FRAME_SIZE)
                return;
            try {
                const totalSamples = SAMPLES_PER_CHANNEL * 2;
                // Allocate a dedicated Int16Array with byteOffset 0 so LiveKit FFI gets the exact audio chunk
                const int16Array = new Int16Array(totalSamples);
                const aligned = chunk.byteOffset % 2 === 0 ? chunk : Buffer.from(chunk);
                const src = new Int16Array(aligned.buffer, aligned.byteOffset, totalSamples);
                // Apply perceptual volume scaling where 100% volume is scaled to what was previously 25%
                // (Comfortable listening level: 100% sounds like the former 25%)
                const factor = (session.volume !== undefined ? session.volume : 1.0) * 0.25;
                const vol = factor <= 0 ? 0 : Math.pow(factor, 1.8);
                for (let i = 0; i < totalSamples; i++) {
                    const scaled = Math.round(src[i] * vol);
                    int16Array[i] = scaled > 32767 ? 32767 : scaled < -32768 ? -32768 : scaled;
                }
                const frame = new AudioFrame(int16Array, 48000, 2, SAMPLES_PER_CHANNEL);
                await session.source.captureFrame(frame);
                framesDispatched++;
                if (framesDispatched === 50) {
                    console.log(`[MicupVoiceClient] 🔊 Ses verisi LiveKit kanalına başarıyla akıyor (Sunucu: ${guildId})`);
                }
            }
            catch (err) {
                console.error('[MicupVoiceClient] captureFrame hatası:', err.message);
            }
        }, 20);
    }
    /**
     * Streams audio from a URL (YouTube, SoundCloud, direct audio, or radio stream) into the LiveKit room.
     * Supports zero-wait cached stream resolution and seamless hot-swapping for filters & bass changes.
     */
    async playAudio(guildId, inputUrl, onEnded, seekSeconds = 0, isHotSwap = false) {
        // If session is not ready yet, wait up to 10 seconds for WebRTC room connection to complete
        let session = this.sessions.get(guildId);
        if (!session || !session.source || !session.room || session.room.connectionState !== 1) {
            console.log(`[MicupVoiceClient] Ses bağlantısı henüz hazır değil, bağlantı bekleniyor... (Sunucu: ${guildId})`);
            const waitStart = Date.now();
            while (Date.now() - waitStart < 10000) {
                await new Promise((r) => setTimeout(r, 200));
                session = this.sessions.get(guildId);
                if (session && session.source && session.room && session.room.connectionState === 1) {
                    break;
                }
            }
        }
        session = this.sessions.get(guildId);
        if (!session || !session.source) {
            console.warn(`[MicupVoiceClient] Ses oturumu zaman aşımına uğradı (${guildId}).`);
            return undefined;
        }
        if (!isSafeAudioTarget(inputUrl)) {
            console.warn(`[MicupVoiceClient] ⚠️ Güvenlik engeli: Güvensiz ses hedefi engellendi: ${inputUrl}`);
            return undefined;
        }
        // Advance playId to invalidate any previous track completion callbacks
        session.playId = (session.playId || 0) + 1;
        const currentPlayId = session.playId;
        const isSameInput = session.currentInputUrl === inputUrl;
        const shouldHotSwap = isHotSwap || (isSameInput && seekSeconds > 0);
        const oldFfmpeg = session.ffmpegProcess;
        if (!shouldHotSwap) {
            this.stopAudio(guildId);
            session.audioQueue = [];
        }
        session.currentInputUrl = inputUrl;
        session.isPaused = false;
        session.isStopping = false;
        session.ffmpegFinished = false;
        session.audioStarted = false;
        session.onEndedCallback = onEnded;
        const ffmpegBinary = getFfmpegBinary();
        try {
            let playbackUrl = inputUrl;
            // Handle YouTube Mix playlists, Spotify, and search queries
            let queryTarget = inputUrl;
            // Clean single video URLs by stripping mix/playlist params so yt-dlp doesn't download 50-track mixes
            if (queryTarget.includes('youtube.com/watch?') || queryTarget.includes('youtu.be/')) {
                try {
                    const u = new URL(queryTarget);
                    const videoId = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop();
                    if (videoId && videoId.length === 11) {
                        queryTarget = `https://www.youtube.com/watch?v=${videoId}`;
                    }
                }
                catch { }
            }
            const isSearchOrSpotify = queryTarget.includes('open.spotify.com') ||
                queryTarget.includes('youtube.com/results') ||
                !queryTarget.startsWith('http');
            if (queryTarget.includes('open.spotify.com')) {
                try {
                    const spotifyHtmlRes = await fetch(queryTarget, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discord.app)' },
                        signal: AbortSignal.timeout(4000),
                    });
                    if (spotifyHtmlRes.ok) {
                        const html = await spotifyHtmlRes.text();
                        const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
                        const descMatch = html.match(/<meta name="description" content="([^"]+)"/) || html.match(/<meta property="og:description" content="([^"]+)"/);
                        const artistMatch = html.match(/<meta property="music:musician_description" content="([^"]+)"/);
                        let title = titleMatch?.[1]?.replace(/\s*-\s*song and lyrics by.*$/i, '') || '';
                        let artist = artistMatch?.[1] || '';
                        if (!artist && descMatch?.[1]) {
                            const dm = descMatch[1].match(/^(?:Listen to [^·]+ on Spotify\.\s*)?([^·]+)·/i);
                            if (dm?.[1])
                                artist = dm[1].trim();
                        }
                        if (title) {
                            const safe = (artist ? `${artist} - ${title}` : title).replace(/[^\p{L}\p{N}\s\-_,.()'&/]/gu, '').trim();
                            queryTarget = `ytsearch1:${safe}`;
                            console.log(`[MicupVoiceClient] 🟢 Spotify parçası ses akışı çözümleniyor: "${safe}"`);
                        }
                    }
                }
                catch (err) {
                    console.warn(`[MicupVoiceClient] Spotify metadata çözme uyarısı:`, err.message);
                }
            }
            else if (isSearchOrSpotify) {
                const cleanQuery = queryTarget
                    .replace(/^https?:\/\/(?:www\.)?youtube\.com\/results\?search_query=/i, '')
                    .trim() || queryTarget;
                const alreadyHasPrefix = /^ytsearch\d*:/i.test(cleanQuery);
                queryTarget = alreadyHasPrefix ? decodeURIComponent(cleanQuery) : `ytsearch1:${decodeURIComponent(cleanQuery)}`;
            }
            const isDirectOrRadio = !isSearchOrSpotify &&
                (queryTarget.includes('icecast') ||
                    queryTarget.includes('zeno.fm') ||
                    queryTarget.includes('listenpowerapp') ||
                    queryTarget.includes('duhnet') ||
                    /\.(mp3|aac|ogg|wav|m4a|flac)(\?.*)?$/i.test(queryTarget));
            // Fast-path: Check memory cache first to eliminate the 5-second freeze on bass/filter changes
            const cachedDirectUrl = this.getCachedStreamUrl(inputUrl) || this.getCachedStreamUrl(queryTarget);
            if (cachedDirectUrl) {
                playbackUrl = cachedDirectUrl;
                console.log(`[MicupVoiceClient] ⚡ Doğrudan akış URL'si önbellekten anında alındı (0ms bekleme)`);
            }
            else if (!isDirectOrRadio) {
                // Resolve direct stream URL using yt-dlp-exec with noPlaylist to ensure fast response
                const displayTarget = queryTarget.startsWith('ytsearch1:') ? 'Arka Plan Doğrudan Ses Motoru' : queryTarget.slice(0, 80);
                console.log(`[MicupVoiceClient] Medya akış URL'si çözülüyor: ${displayTarget}`);
                try {
                    const cookiePath = path.resolve(process.cwd(), 'cookies.txt');
                    const hasCookies = fs.existsSync(cookiePath);
                    const ytExec = getYtDlpInstance();
                    const ytdlData = await ytExec(queryTarget, {
                        dumpSingleJson: true,
                        noWarnings: true,
                        noPlaylist: true,
                        format: 'bestaudio/best',
                        ...(hasCookies ? { cookies: cookiePath } : {}),
                    });
                    const directCandidate = ytdlData?.url || (Array.isArray(ytdlData?.entries) && ytdlData.entries[0]?.url);
                    if (directCandidate) {
                        playbackUrl = directCandidate;
                    }
                    else if (Array.isArray(ytdlData?.formats)) {
                        const audioFormats = ytdlData.formats.filter((f) => f.resolution === 'audio only' || f.acodec !== 'none');
                        const best = audioFormats[audioFormats.length - 1];
                        if (best?.url) {
                            playbackUrl = best.url;
                        }
                    }
                    // Cache resolved URL for 4 hours
                    if (playbackUrl && playbackUrl !== inputUrl) {
                        this.setCachedStreamUrl(inputUrl, playbackUrl);
                        if (queryTarget !== inputUrl) {
                            this.setCachedStreamUrl(queryTarget, playbackUrl);
                        }
                    }
                }
                catch (err) {
                    console.warn(`[MicupVoiceClient] yt-dlp ses akışı çözme uyarısı (${err.message}).`);
                }
            }
            // ⚠️ SON KONTROL: Doğrudan ses akışı doğrulaması
            // Eğer YouTube, Spotify veya arama URL'i çözümlenemeyip hâlâ web sayfası URL'i olarak kaldıysa FFmpeg'e verme
            const isUnresolvedWebUrl = playbackUrl.includes('youtube.com/watch') ||
                playbackUrl.includes('youtu.be/') ||
                playbackUrl.includes('youtube.com/results') ||
                playbackUrl.includes('open.spotify.com') ||
                playbackUrl.startsWith('ytsearch');
            if (!/^https?:\/\//i.test(playbackUrl) || isUnresolvedWebUrl) {
                const errMsg = `Ses akışı çözümlemesi başarısız: "${String(playbackUrl).slice(0, 80)}" doğrudan ses akışına çevrilemedi. (yt-dlp veya FFmpeg ikili dosyası eksik olabilir)`;
                console.error(`[MicupVoiceClient] ❌ ${errMsg}`);
                if (typeof onEnded === 'function') {
                    try {
                        onEnded();
                    }
                    catch { }
                }
                this.setCachedStreamUrl(inputUrl, '');
                this.setCachedStreamUrl(queryTarget, '');
                if (!shouldHotSwap)
                    this.stopAudio(guildId);
                return undefined;
            }
            console.log(`[MicupVoiceClient] ✅ Geçerli ses URL'i çözüldü: ${String(playbackUrl).slice(0, 80)}...`);
            console.log(`[MicupVoiceClient] FFmpeg PCM kodlayıcı başlatılıyor... (seek: ${seekSeconds}s, filtre: ${this.getAudioFilter(guildId) || 'Standart'})`);
            const activeFilter = this.getAudioFilter(guildId);
            const ffmpegArgs = [
                '-reconnect', '1',
                '-reconnect_streamed', '1',
                '-reconnect_delay_max', '5',
                '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            ];
            if (seekSeconds > 0) {
                ffmpegArgs.push('-ss', Math.floor(seekSeconds).toString());
            }
            ffmpegArgs.push('-i', playbackUrl);
            if (activeFilter) {
                ffmpegArgs.push('-af', activeFilter);
                console.log(`[MicupVoiceClient] 🎛️ FFmpeg ses filtresi uygulandı: ${activeFilter}`);
            }
            else {
                // Default clean audio processing with Otomatik Kazanç Kontrolü (AGC) & Anti-clipping limiter
                ffmpegArgs.push('-af', 'alimiter=limit=0.95:attack=5:release=50:asc=1');
            }
            ffmpegArgs.push('-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');
            const ffmpegProc = spawn(ffmpegBinary, ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
            session.ffmpegProcess = ffmpegProc;
            let leftover = Buffer.alloc(0);
            const CHUNK_SIZE = 3840;
            let isFirstChunk = true;
            let ffmpegErrBuffer = '';
            ffmpegProc.stderr?.on('data', (chunk) => {
                ffmpegErrBuffer += chunk.toString('utf8');
                const lines = ffmpegErrBuffer.split('\n');
                ffmpegErrBuffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.trim())
                        continue;
                    if (/error|invalid|403|404|failed|cannot|unable|denied|protocol not found/i.test(line)) {
                        console.warn(`[FFmpeg stderr] ${line.trim()}`);
                    }
                }
            });
            ffmpegProc.stdout?.on('data', (data) => {
                if (session.playId !== currentPlayId)
                    return;
                if (isFirstChunk) {
                    isFirstChunk = false;
                    if (shouldHotSwap) {
                        if (oldFfmpeg && oldFfmpeg !== ffmpegProc) {
                            try {
                                oldFfmpeg.kill();
                            }
                            catch { }
                        }
                        session.audioQueue = [];
                        console.log(`[MicupVoiceClient] ⚡ Kesintisiz ses geçişi sağlandı (Filtre anında uygulandı, donma 0ms)`);
                    }
                    session.audioStarted = true;
                }
                const combined = Buffer.concat([leftover, data]);
                let offset = 0;
                while (offset + CHUNK_SIZE <= combined.length) {
                    session.audioQueue.push(combined.subarray(offset, offset + CHUNK_SIZE));
                    offset += CHUNK_SIZE;
                }
                leftover = combined.subarray(offset);
                // Apply backpressure if buffer gets too large (> 500 chunks = 10 seconds of audio)
                if (session.audioQueue.length > 500 && ffmpegProc.stdout && !ffmpegProc.stdout.isPaused()) {
                    ffmpegProc.stdout.pause();
                }
            });
            ffmpegProc.on('close', (code) => {
                if (session.playId !== currentPlayId)
                    return;
                console.log(`[MicupVoiceClient] FFmpeg akış okuması tamamlandı (Sunucu: ${guildId}, Kalan kuyruk: ${session.audioQueue.length} parça)`);
                session.ffmpegFinished = true;
            });
            ffmpegProc.on('error', (err) => {
                console.error(`[MicupVoiceClient] ❌ FFmpeg çalıştırma hatası:`, err.message);
                if (err.code === 'ENOENT') {
                    console.error(`[MicupVoiceClient] 💡 ÇÖZÜM: FFmpeg ikili dosyası bulunamadı ("${ffmpegBinary}").\n` +
                        `Sunucunuzda (Pterodactyl/Linux) 'ffmpeg' sistem paketinin kurulu olduğundan emin olun veya bot dizininde:\n` +
                        `"node node_modules/ffmpeg-static/install.js" komutunu çalıştırın.`);
                }
                if (session.playId === currentPlayId) {
                    session.ffmpegFinished = true;
                    if (typeof session.onEndedCallback === 'function') {
                        try {
                            session.onEndedCallback();
                        }
                        catch { }
                    }
                }
            });
            return playbackUrl;
        }
        catch (err) {
            console.error(`[MicupVoiceClient] playAudio genel hatası:`, err.message);
            return undefined;
        }
    }
    pauseAudio(guildId) {
        const session = this.sessions.get(guildId);
        if (session) {
            session.isPaused = true;
        }
    }
    resumeAudio(guildId) {
        const session = this.sessions.get(guildId);
        if (session) {
            session.isPaused = false;
        }
    }
    stopAudio(guildId) {
        const session = this.sessions.get(guildId);
        if (session) {
            session.isStopping = true;
            session.audioStarted = false;
            session.onEndedCallback = undefined;
            session.ffmpegFinished = false;
            session.audioQueue = [];
            session.isPaused = false;
            session.currentInputUrl = undefined;
            if (session.ffmpegProcess) {
                try {
                    session.ffmpegProcess.kill();
                }
                catch { }
                session.ffmpegProcess = undefined;
            }
        }
    }
    disconnect(guildId) {
        const session = this.sessions.get(guildId);
        if (session) {
            console.log(`[MicupVoiceClient] Ses oturumu kapatılıyor (${guildId})`);
            this.stopAudio(guildId);
            if (session.audioInterval)
                clearInterval(session.audioInterval);
            if (session.room) {
                try {
                    session.room.disconnect();
                }
                catch { }
            }
            this.sessions.delete(guildId);
        }
    }
    disconnectAll() {
        for (const gid of this.sessions.keys()) {
            this.disconnect(gid);
        }
    }
    isConnected(guildId) {
        const session = this.sessions.get(guildId);
        return !!session && session.room?.connectionState === 1;
    }
}
//# sourceMappingURL=MicupVoiceClient.js.map