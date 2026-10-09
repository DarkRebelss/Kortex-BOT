import { type ChildProcess } from 'child_process';
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
/**
 * Automatically prepares cookies.txt if provided via environment variable (YOUTUBE_COOKIE or YOUTUBE_COOKIES).
 */
export declare function ensureCookiesFile(): void;
/**
 * Returns true if YouTube is currently blocked due to datacenter IP bot challenges.
 */
export declare function isYouTubeBlocked(): boolean;
/**
 * Marks YouTube as blocked for a cooldown period (default 15 minutes),
 * allowing the bot to instantly use SoundCloud / alternatives without waiting 30 seconds.
 */
export declare function markYouTubeBlocked(cooldownMs?: number): void;
export declare function clearYouTubeBlock(): void;
/**
 * Resolves the path to the yt-dlp executable binary.
 */
export declare function getYtDlpBinary(): string;
/**
 * Deletes any orphaned .part or -Frag*.part temporary files in the current working directory
 * to prevent audio corruption or fragment mixing across songs.
 */
export declare function cleanOrphanedPartFiles(): void;
/**
 * Spawns a yt-dlp child process streaming audio directly to stdout ('-o', '-').
 * This is fed directly into FFmpeg stdin ('pipe:0') for zero-latency, reliable playback.
 * Disables part files and caching to guarantee that songs never leave fragments on disk.
 */
export declare function spawnYtDlpStream(target: string, extraArgs?: string[]): ChildProcess;
/**
 * Returns optimized base options for yt-dlp to bypass YouTube datacenter IP rate-limits
 * and bot-detection challenges ("Sign in to confirm you're not a bot").
 */
export declare function getYtDlpBaseOptions(): Record<string, any>;
/**
 * Executes a yt-dlp request with anti-bot bypass and fast-fail fallback.
 */
export declare function runYtDlp(target: string, options?: Record<string, any>): Promise<any>;
