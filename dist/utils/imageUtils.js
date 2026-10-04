// SPDX-License-Identifier: AGPL-3.0-or-later
import { loadImage, GlobalFonts } from '@napi-rs/canvas';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { isSafeHttpUrl, safeFetch } from './security.js';
let fontsRegistered = false;
/**
 * Registers bundled fonts like Noto Color Emoji into Skia / @napi-rs/canvas
 */
export function registerProjectFonts() {
    if (fontsRegistered)
        return;
    fontsRegistered = true;
    const possibleFontPaths = [
        path.resolve(process.cwd(), 'src/assets/fonts/NotoColorEmoji.ttf'),
        path.resolve(process.cwd(), 'dist/assets/fonts/NotoColorEmoji.ttf'),
        path.resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '../assets/fonts/NotoColorEmoji.ttf'),
        path.resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '../../src/assets/fonts/NotoColorEmoji.ttf'),
    ];
    for (const fp of possibleFontPaths) {
        if (fs.existsSync(fp)) {
            try {
                GlobalFonts.registerFromPath(fp, 'Noto Color Emoji');
                break;
            }
            catch (err) {
                console.warn(`[imageUtils] Noto Color Emoji fontu yüklenemedi: ${err.message}`);
            }
        }
    }
}
/**
 * Checks if a buffer represents a GIF image by reading its magic bytes
 */
export function isGifBuffer(buf) {
    return buf.length >= 3 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46; // 'GIF'
}
/**
 * Converts a GIF buffer (static or animated) into a clean single-frame PNG buffer using FFmpeg.
 */
export function convertGifToPng(gifBuffer) {
    return new Promise((resolve, reject) => {
        const binaryPath = typeof ffmpegPath === 'string' ? ffmpegPath : (ffmpegPath?.default || 'ffmpeg');
        const proc = spawn(binaryPath, ['-i', 'pipe:0', '-vframes', '1', '-f', 'image2', '-c:v', 'png', 'pipe:1']);
        const outChunks = [];
        if (proc.stdout) {
            proc.stdout.on('data', (chunk) => outChunks.push(chunk));
        }
        proc.on('close', (code) => {
            if (code === 0 && outChunks.length > 0) {
                resolve(Buffer.concat(outChunks));
            }
            else {
                reject(new Error(`FFmpeg GIF dönüşümü ${code} kodu ile başarısız oldu`));
            }
        });
        proc.on('error', reject);
        if (proc.stdin) {
            proc.stdin.write(gifBuffer);
            proc.stdin.end();
        }
    });
}
/**
 * Safely fetches an image from URL and loads it into a @napi-rs/canvas Image instance.
 * Automatically handles animated/static GIF avatars by converting frame 0 to PNG,
 * preventing 'Unsupported image type' errors and corrupted card renders.
 */
export async function fetchAndLoadSafeImage(url, timeoutMs = 4000) {
    if (!isSafeHttpUrl(url))
        return null;
    // 1. If URL ends with .gif, try requesting the static .png version from CDN first
    if (/\.gif(\?.*)?$/i.test(url)) {
        const pngCandidateUrl = url.replace(/\.gif(\?.*)?$/i, '.png$1');
        try {
            const res = await safeFetch(pngCandidateUrl, { signal: AbortSignal.timeout(timeoutMs) });
            if (res.ok) {
                const arrayBuf = await res.arrayBuffer();
                let buf = Buffer.from(arrayBuf);
                if (isGifBuffer(buf)) {
                    buf = await convertGifToPng(buf);
                }
                return await loadImage(buf);
            }
        }
        catch { }
    }
    // 2. Fetch original URL
    try {
        const res = await safeFetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok)
            return null;
        const arrayBuf = await res.arrayBuffer();
        let buf = Buffer.from(arrayBuf);
        if (isGifBuffer(buf)) {
            buf = await convertGifToPng(buf);
        }
        return await loadImage(buf);
    }
    catch (err) {
        console.warn(`[imageUtils] Görsel yükleme başarısız (${url}): ${err.message}`);
        return null;
    }
}
/**
 * Loads a Buffer into a Canvas Image, converting GIF to PNG if needed.
 */
export async function loadBufferAsSafeImage(buf) {
    try {
        let processed = buf;
        if (isGifBuffer(buf)) {
            processed = await convertGifToPng(buf);
        }
        return await loadImage(processed);
    }
    catch (err) {
        console.warn(`[imageUtils] Buffer görsel yükleme başarısız: ${err.message}`);
        return null;
    }
}
//# sourceMappingURL=imageUtils.js.map