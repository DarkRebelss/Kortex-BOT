/**
 * Checks whether a given string is a safe, public HTTP/HTTPS URL.
 * Protects against Server-Side Request Forgery (SSRF) and local network probing.
 */
export declare function isSafeHttpUrl(urlStr: string): boolean;
/**
 * Validates audio input targets to prevent local file inclusion (LFI)
 * or opening sensitive local files via FFmpeg or yt-dlp.
 */
export declare function isSafeAudioTarget(target: string): boolean;
/**
 * Performs a secure HTTP request, automatically inspecting redirects
 * to prevent SSRF via open redirects.
 */
export declare function safeFetch(urlStr: string, init?: RequestInit, maxRedirects?: number): Promise<Response>;
