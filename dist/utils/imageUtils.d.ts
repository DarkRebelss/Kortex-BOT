import { type Image } from '@napi-rs/canvas';
/**
 * Registers bundled fonts like Noto Color Emoji into Skia / @napi-rs/canvas
 */
export declare function registerProjectFonts(): void;
/**
 * Checks if a buffer represents a GIF image by reading its magic bytes
 */
export declare function isGifBuffer(buf: Buffer): boolean;
/**
 * Converts a GIF buffer (static or animated) into a clean single-frame PNG buffer using FFmpeg.
 */
export declare function convertGifToPng(gifBuffer: Buffer): Promise<Buffer>;
/**
 * Safely fetches an image from URL and loads it into a @napi-rs/canvas Image instance.
 * Automatically handles animated/static GIF avatars by converting frame 0 to PNG,
 * preventing 'Unsupported image type' errors and corrupted card renders.
 */
export declare function fetchAndLoadSafeImage(url: string, timeoutMs?: number): Promise<Image | null>;
/**
 * Loads a Buffer into a Canvas Image, converting GIF to PNG if needed.
 */
export declare function loadBufferAsSafeImage(buf: Buffer): Promise<Image | null>;
