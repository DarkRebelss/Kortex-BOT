// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import youtubedl from 'yt-dlp-exec';
let cachedFfmpegBinary = null;
let cachedYtDlpInstance = null;
/**
 * Ensures a binary path has executable permissions on Unix systems (chmod +x / 0o755).
 */
function ensureExecutablePermission(filePath) {
    if (process.platform === 'win32')
        return;
    try {
        const stats = fs.statSync(filePath);
        // If not executable by user/group/others, add executable bits
        if ((stats.mode & 0o111) === 0) {
            fs.chmodSync(filePath, 0o755);
            console.log(`[MediaBinaries] 🔑 "${filePath}" için çalıştırma izinleri verildi (chmod 755).`);
        }
    }
    catch { }
}
/**
 * Checks if a command can be executed in system PATH.
 */
function isCommandAvailable(command, testArg = '-version') {
    try {
        const res = spawnSync(command, [testArg], {
            stdio: 'ignore',
            timeout: 2000,
            windowsHide: true,
        });
        return res.status === 0;
    }
    catch {
        return false;
    }
}
/**
 * Resolves the most appropriate FFmpeg binary path available on the current system.
 * Supports:
 * 1. FFMPEG_PATH or FFMPEG_BIN environment variables
 * 2. ffmpeg-static bundle (with auto-chmod on Linux/Mac)
 * 3. Standard Linux system paths (/usr/bin/ffmpeg, /usr/local/bin/ffmpeg, /bin/ffmpeg)
 * 4. System PATH 'ffmpeg'
 * 5. Dynamic auto-recovery via ffmpeg-static install.js if binary is missing
 */
export function getFfmpegBinary() {
    if (cachedFfmpegBinary) {
        return cachedFfmpegBinary;
    }
    // 1. Explicit environment variable
    const envPath = process.env.FFMPEG_PATH || process.env.FFMPEG_BIN;
    if (envPath && fs.existsSync(envPath)) {
        ensureExecutablePermission(envPath);
        cachedFfmpegBinary = envPath;
        console.log(`[MediaBinaries] 🎬 FFmpeg ortam değişkeninden yüklendi: ${envPath}`);
        return envPath;
    }
    // 2. ffmpeg-static module path
    const staticPath = typeof ffmpegStatic === 'string' ? ffmpegStatic : ffmpegStatic?.default;
    if (staticPath && typeof staticPath === 'string' && fs.existsSync(staticPath)) {
        ensureExecutablePermission(staticPath);
        cachedFfmpegBinary = staticPath;
        console.log(`[MediaBinaries] 🎬 FFmpeg statik ikili dosyasından yüklendi: ${staticPath}`);
        return staticPath;
    }
    // 3. Common Linux host/container paths (Pterodactyl, Docker, Ubuntu/Debian)
    const commonLinuxPaths = [
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        '/bin/ffmpeg',
    ];
    for (const linuxPath of commonLinuxPaths) {
        if (fs.existsSync(linuxPath)) {
            ensureExecutablePermission(linuxPath);
            cachedFfmpegBinary = linuxPath;
            console.log(`[MediaBinaries] 🎬 FFmpeg sistem yolundan yüklendi: ${linuxPath}`);
            return linuxPath;
        }
    }
    // 4. Test system PATH 'ffmpeg'
    if (isCommandAvailable('ffmpeg', '-version')) {
        cachedFfmpegBinary = 'ffmpeg';
        console.log(`[MediaBinaries] 🎬 FFmpeg sistem PATH üzerinden tespit edildi: "ffmpeg"`);
        return 'ffmpeg';
    }
    // 5. Auto-recovery: If ffmpeg-static exists but binary was not downloaded (e.g. uploaded Windows node_modules to Linux)
    try {
        const installScript = path.resolve(process.cwd(), 'node_modules', 'ffmpeg-static', 'install.js');
        if (fs.existsSync(installScript)) {
            console.log(`[MediaBinaries] ⏳ Sistemde FFmpeg bulunamadı, ffmpeg-static otomatik indiriliyor...`);
            execSync(`node "${installScript}"`, { stdio: 'inherit', timeout: 45000 });
            if (staticPath && fs.existsSync(staticPath)) {
                ensureExecutablePermission(staticPath);
                cachedFfmpegBinary = staticPath;
                console.log(`[MediaBinaries] ✅ FFmpeg ikili dosyası başarıyla indirildi: ${staticPath}`);
                return staticPath;
            }
        }
    }
    catch (err) {
        console.warn(`[MediaBinaries] FFmpeg otomatik indirme denemesi başarısız oldu: ${err.message}`);
    }
    // Fallback to 'ffmpeg' with helpful log
    console.warn(`[MediaBinaries] ⚠️ DİKKAT: FFmpeg binary dosyası doğrudan doğrulanamadı. "ffmpeg" komutu deneniyor.\n` +
        `💡 Barındırma sunucunuzda (Pterodactyl vb.) ses oynatabilmek için sunucu paneline "ffmpeg" kurulu olmalıdır ` +
        `veya "node node_modules/ffmpeg-static/install.js" çalıştırılmalıdır.`);
    cachedFfmpegBinary = 'ffmpeg';
    return 'ffmpeg';
}
/**
 * Resolves an active yt-dlp instance.
 * Automatically checks for system binaries, permissions, and fallback recovery.
 */
export function getYtDlpInstance() {
    if (cachedYtDlpInstance) {
        return cachedYtDlpInstance;
    }
    // 1. Explicit environment variable
    const envPath = process.env.YTDLP_PATH || process.env.YOUTUBE_DL_PATH;
    if (envPath && fs.existsSync(envPath)) {
        ensureExecutablePermission(envPath);
        console.log(`[MediaBinaries] 📦 yt-dlp ortam değişkeninden yüklendi: ${envPath}`);
        cachedYtDlpInstance = youtubedl.create(envPath);
        return cachedYtDlpInstance;
    }
    // 2. Default yt-dlp-exec binary path
    const defaultBin = path.resolve(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
    if (fs.existsSync(defaultBin)) {
        ensureExecutablePermission(defaultBin);
        cachedYtDlpInstance = youtubedl;
        return cachedYtDlpInstance;
    }
    // 3. Common Linux system paths
    const commonLinuxPaths = [
        '/usr/bin/yt-dlp',
        '/usr/local/bin/yt-dlp',
        '/bin/yt-dlp',
    ];
    for (const linuxPath of commonLinuxPaths) {
        if (fs.existsSync(linuxPath)) {
            ensureExecutablePermission(linuxPath);
            console.log(`[MediaBinaries] 📦 yt-dlp sistem yolundan yüklendi: ${linuxPath}`);
            cachedYtDlpInstance = youtubedl.create(linuxPath);
            return cachedYtDlpInstance;
        }
    }
    // 4. Test system PATH 'yt-dlp'
    if (isCommandAvailable('yt-dlp', '--version')) {
        console.log(`[MediaBinaries] 📦 yt-dlp sistem PATH üzerinden tespit edildi: "yt-dlp"`);
        cachedYtDlpInstance = youtubedl.create('yt-dlp');
        return cachedYtDlpInstance;
    }
    // 5. Auto-recovery: If postinstall exists but binary wasn't downloaded (e.g. uploaded Windows node_modules to Linux)
    try {
        const postinstallScript = path.resolve(process.cwd(), 'node_modules', 'yt-dlp-exec', 'scripts', 'postinstall.js');
        if (fs.existsSync(postinstallScript)) {
            console.log(`[MediaBinaries] ⏳ Sistemde yt-dlp ikili dosyası bulunamadı, otomatik indiriliyor...`);
            execSync(`node "${postinstallScript}"`, { stdio: 'inherit', timeout: 45000 });
            if (fs.existsSync(defaultBin)) {
                ensureExecutablePermission(defaultBin);
                console.log(`[MediaBinaries] ✅ yt-dlp ikili dosyası başarıyla indirildi: ${defaultBin}`);
                cachedYtDlpInstance = youtubedl;
                return cachedYtDlpInstance;
            }
        }
    }
    catch (err) {
        console.warn(`[MediaBinaries] yt-dlp otomatik indirme denemesi başarısız oldu: ${err.message}`);
    }
    cachedYtDlpInstance = youtubedl;
    return youtubedl;
}
//# sourceMappingURL=mediaBinaries.js.map