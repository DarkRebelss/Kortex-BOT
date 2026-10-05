/**
 * Resolves the most appropriate FFmpeg binary path available on the current system.
 * Supports:
 * 1. FFMPEG_PATH or FFMPEG_BIN environment variables
 * 2. ffmpeg-static bundle (with auto-chmod on Linux/Mac)
 * 3. Standard Linux system paths (/usr/bin/ffmpeg, /usr/local/bin/ffmpeg, /bin/ffmpeg)
 * 4. System PATH 'ffmpeg'
 * 5. Dynamic auto-recovery via ffmpeg-static install.js if binary is missing
 */
export declare function getFfmpegBinary(): string;
/**
 * Resolves an active yt-dlp instance.
 * Automatically checks for system binaries, permissions, and fallback recovery.
 */
export declare function getYtDlpInstance(): any;
