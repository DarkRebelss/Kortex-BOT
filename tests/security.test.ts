// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import { isSafeHttpUrl, isSafeAudioTarget, safeFetch } from '../src/utils/security.js';
import http from 'node:http';

describe('Security Hardening & Vulnerability Verification', () => {
  describe('SSRF Protection (isSafeHttpUrl)', () => {
    it('allows valid public HTTP and HTTPS URLs', () => {
      expect(isSafeHttpUrl('https://example.com/avatar.png')).toBe(true);
      expect(isSafeHttpUrl('https://cdn.discordapp.com/avatars/12345/abcdef.png')).toBe(true);
      expect(isSafeHttpUrl('http://radio.zeno.fm/stream.mp3')).toBe(true);
      expect(isSafeHttpUrl('https://images.unsplash.com/photo-123')).toBe(true);
    });

    it('rejects invalid or non-HTTP protocols', () => {
      expect(isSafeHttpUrl('')).toBe(false);
      expect(isSafeHttpUrl('not-a-url')).toBe(false);
      expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeHttpUrl('ftp://example.com/file')).toBe(false);
      expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('rejects localhost, loopback, and zero addresses', () => {
      expect(isSafeHttpUrl('http://localhost')).toBe(false);
      expect(isSafeHttpUrl('http://localhost:3000')).toBe(false);
      expect(isSafeHttpUrl('http://127.0.0.1')).toBe(false);
      expect(isSafeHttpUrl('http://127.0.0.1:8080/admin')).toBe(false);
      expect(isSafeHttpUrl('http://127.255.0.1')).toBe(false);
      expect(isSafeHttpUrl('http://0.0.0.0')).toBe(false);
      expect(isSafeHttpUrl('http://0.0.0.0:3000')).toBe(false);
    });

    it('rejects cloud metadata IP addresses (AWS, GCP, Azure, etc.)', () => {
      expect(isSafeHttpUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
      expect(isSafeHttpUrl('http://169.254.1.1')).toBe(false);
    });

    it('rejects private IPv4 networks (RFC 1918)', () => {
      // 10.0.0.0/8
      expect(isSafeHttpUrl('http://10.0.0.1/')).toBe(false);
      expect(isSafeHttpUrl('http://10.255.255.255/internal')).toBe(false);
      // 172.16.0.0/12
      expect(isSafeHttpUrl('http://172.16.0.1/')).toBe(false);
      expect(isSafeHttpUrl('http://172.31.255.254/')).toBe(false);
      // 192.168.0.0/16
      expect(isSafeHttpUrl('http://192.168.0.1/admin')).toBe(false);
      expect(isSafeHttpUrl('http://192.168.1.254/router')).toBe(false);
      // Carrier-grade NAT 100.64.0.0/10
      expect(isSafeHttpUrl('http://100.64.0.1/')).toBe(false);
      // Multicast / Reserved
      expect(isSafeHttpUrl('http://224.0.0.1/')).toBe(false);
      expect(isSafeHttpUrl('http://240.0.0.1/')).toBe(false);
    });

    it('rejects IPv6 loopback, local, and mapped addresses', () => {
      expect(isSafeHttpUrl('http://[::1]/')).toBe(false);
      expect(isSafeHttpUrl('http://[::]/')).toBe(false);
      expect(isSafeHttpUrl('http://[::ffff:127.0.0.1]/')).toBe(false);
      expect(isSafeHttpUrl('http://[fe80::1]/')).toBe(false);
      expect(isSafeHttpUrl('http://[fd00::1]/')).toBe(false);
    });

    it('rejects internal and private domain TLDs', () => {
      expect(isSafeHttpUrl('http://myrouter.local')).toBe(false);
      expect(isSafeHttpUrl('http://database.internal')).toBe(false);
      expect(isSafeHttpUrl('http://server.lan')).toBe(false);
      expect(isSafeHttpUrl('http://service.localhost')).toBe(false);
    });
  });

  describe('Audio Input Sanitization (isSafeAudioTarget)', () => {
    it('rejects local file paths and path traversal attempts', () => {
      expect(isSafeAudioTarget('C:\\Windows\\System32\\calc.exe')).toBe(false);
      expect(isSafeAudioTarget('D:/Music/private.mp3')).toBe(false);
      expect(isSafeAudioTarget('/etc/passwd')).toBe(false);
      expect(isSafeAudioTarget('/var/log/syslog')).toBe(false);
      expect(isSafeAudioTarget('../../secret.key')).toBe(false);
      expect(isSafeAudioTarget('~/database.sqlite')).toBe(false);
      expect(isSafeAudioTarget('file:///home/user/song.mp3')).toBe(false);
    });

    it('rejects private network streams', () => {
      expect(isSafeAudioTarget('http://127.0.0.1:8000/stream.mp3')).toBe(false);
      expect(isSafeAudioTarget('http://localhost:3000/audio.ogg')).toBe(false);
      expect(isSafeAudioTarget('http://192.168.1.10:8080/live')).toBe(false);
    });

    it('allows valid internet streams and search queries', () => {
      expect(isSafeAudioTarget('https://stream.zeno.fm/f3wvbbqmdg8uv')).toBe(true);
      expect(isSafeAudioTarget('https://example.com/audio/track.mp3')).toBe(true);
      expect(isSafeAudioTarget('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
      expect(isSafeAudioTarget('duman kirmis kalbini')).toBe(true);
      expect(isSafeAudioTarget('ytsearch1:tarkan geccek')).toBe(true);
    });
  });

  describe('Redirect SSRF Immunity (safeFetch)', () => {
    it('blocks immediate unsafe target', async () => {
      await expect(safeFetch('http://127.0.0.1:9999/secret')).rejects.toThrow('SSRF Koruması');
      await expect(safeFetch('http://169.254.169.254/metadata')).rejects.toThrow('SSRF Koruması');
    });

    it('intercepts redirect attempting to bounce to loopback address', async () => {
      // Create a temporary redirect server that bounces to 127.0.0.1
      let serverPort = 0;
      const redirectServer = http.createServer((_req, res) => {
        res.writeHead(302, { Location: 'http://127.0.0.1:80/admin/secret' });
        res.end();
      });

      await new Promise<void>((resolve) => {
        redirectServer.listen(0, '127.0.0.1', () => {
          serverPort = (redirectServer.address() as any).port;
          resolve();
        });
      });

      try {
        // Even if requested target redirected, safeFetch validates the redirect destination
        await expect(safeFetch(`http://127.0.0.1:${serverPort}/bounce`)).rejects.toThrow('SSRF Koruması');
      } finally {
        await new Promise<void>((resolve) => redirectServer.close(() => resolve()));
      }
    });
  });
});
