// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Checks whether a given string is a safe, public HTTP/HTTPS URL.
 * Protects against Server-Side Request Forgery (SSRF) and local network probing.
 */
export function isSafeHttpUrl(urlStr) {
    if (!urlStr || typeof urlStr !== 'string')
        return false;
    const trimmed = urlStr.trim();
    let parsed;
    try {
        parsed = new URL(trimmed);
    }
    catch {
        return false;
    }
    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    // Block localhost, zero IP, and loopback
    if (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        hostname === '[::1]' ||
        hostname === '::' ||
        hostname === '[::]' ||
        hostname.startsWith('127.')) {
        return false;
    }
    // Handle IPv6 address bracketed notation
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
        const ip6 = hostname.slice(1, -1).toLowerCase();
        if (ip6 === '::1' ||
            ip6 === '::' ||
            ip6.startsWith('::ffff:') ||
            ip6.startsWith('fe80:') ||
            ip6.startsWith('fc') ||
            ip6.startsWith('fd') ||
            ip6.startsWith('::')) {
            return false;
        }
    }
    // Block cloud metadata IP (AWS, GCP, Azure, OpenStack, etc.)
    if (hostname === '169.254.169.254' || hostname.startsWith('169.254.')) {
        return false;
    }
    // Block internal domain TLDs
    if (hostname.endsWith('.localhost') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal') ||
        hostname.endsWith('.lan') ||
        hostname.endsWith('.home') ||
        hostname.endsWith('.corp')) {
        return false;
    }
    // Check IPv4 ranges:
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
        const octet1 = parseInt(ipv4Match[1], 10);
        const octet2 = parseInt(ipv4Match[2], 10);
        // 0.0.0.0/8 (Broadcast/Current network)
        if (octet1 === 0)
            return false;
        // 10.0.0.0/8 (Private)
        if (octet1 === 10)
            return false;
        // 100.64.0.0/10 (Carrier-grade NAT)
        if (octet1 === 100 && octet2 >= 64 && octet2 <= 127)
            return false;
        // 127.0.0.0/8 (Loopback)
        if (octet1 === 127)
            return false;
        // 169.254.0.0/16 (Link Local / Cloud Metadata)
        if (octet1 === 169 && octet2 === 254)
            return false;
        // 172.16.0.0 - 172.31.255.255 (Private)
        if (octet1 === 172 && octet2 >= 16 && octet2 <= 31)
            return false;
        // 192.168.0.0/16 (Private)
        if (octet1 === 192 && octet2 === 168)
            return false;
        // 224.0.0.0/4 (Multicast) and 240.0.0.0/4 (Reserved)
        if (octet1 >= 224)
            return false;
    }
    return true;
}
/**
 * Validates audio input targets to prevent local file inclusion (LFI)
 * or opening sensitive local files via FFmpeg or yt-dlp.
 */
export function isSafeAudioTarget(target) {
    if (!target || typeof target !== 'string')
        return false;
    const trimmed = target.trim();
    // Reject file:// protocol
    if (trimmed.toLowerCase().startsWith('file:'))
        return false;
    // Reject windows drive letters like C:\ or D:\ or unix root paths like /etc/ or /var/
    if (/^[a-zA-Z]:[/\\]/.test(trimmed))
        return false;
    if (/^(\.\.|\/|~)/.test(trimmed))
        return false;
    // If it's a URL, verify safe HTTP URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return isSafeHttpUrl(trimmed);
    }
    // Search queries (ytsearch1:... or free text) are safe
    return true;
}
/**
 * Performs a secure HTTP request, automatically inspecting redirects
 * to prevent SSRF via open redirects.
 */
export async function safeFetch(urlStr, init, maxRedirects = 3) {
    let currentUrl = urlStr;
    let redirects = 0;
    while (true) {
        if (!isSafeHttpUrl(currentUrl)) {
            throw new Error(`Güvensiz veya engellenmiş URL hedefi (SSRF Koruması): ${currentUrl}`);
        }
        const fetchInit = {
            ...init,
            redirect: 'manual',
        };
        const res = await fetch(currentUrl, fetchInit);
        // If HTTP redirect status
        if ([301, 302, 303, 307, 308].includes(res.status)) {
            const location = res.headers.get('location');
            if (!location) {
                return res;
            }
            redirects++;
            if (redirects > maxRedirects) {
                throw new Error('Çok fazla yönlendirme (redirect limit exceeded).');
            }
            const nextUrl = new URL(location, currentUrl).toString();
            currentUrl = nextUrl;
            continue;
        }
        return res;
    }
}
//# sourceMappingURL=security.js.map