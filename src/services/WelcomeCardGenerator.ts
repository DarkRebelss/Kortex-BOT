// SPDX-License-Identifier: AGPL-3.0-or-later

import { createCanvas, type Image } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { isSafeHttpUrl, safeFetch } from '../utils/security.js';
import { loadBufferAsSafeImage, registerProjectFonts } from '../utils/imageUtils.js';

export interface WelcomeCardOptions {
  username: string;
  avatarUrl?: string | null;
  subtitle?: string;
  welcomeText?: string;
  brandingText?: string;
  sloganText?: string;
  theme?: 'purple' | 'crimson' | 'welcome' | 'goodbye';
  customColor?: string;
  accentColor?: string;
  logoUrl?: string | null;
  logoBuffer?: Buffer | null;
}

export interface CardPalette {
  primaryHex: string;
  accentHex: string;
  r: number;
  g: number;
  b: number;
  aR: number;
  aG: number;
  aB: number;
  glowAlpha: (alpha: number) => string;
  accentGlowAlpha: (alpha: number) => string;
  bgGradStops: [string, string, string, string, string];
  borderGradStops: [string, string, string, string, string];
  ringGradStops: [string, string, string, string, string, string];
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  dotColor: string;
  sloganColor: string;
  brandingColor: string;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) {
    return { r: 139, g: 92, b: 246 };
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function getCardPalette(options: WelcomeCardOptions): CardPalette {
  const isCrimson = options.theme === 'crimson' || options.theme === 'goodbye';
  const primaryHex = options.customColor || (isCrimson ? '#f43f5e' : '#10b981');
  const rgb = parseHex(primaryHex);
  const { r, g, b } = rgb;

  let accentHex = options.accentColor;
  if (!accentHex) {
    if (isCrimson) {
      accentHex = '#fb7185';
    } else {
      accentHex = options.customColor
        ? `#${((1 << 24) + (Math.min(255, Math.round(r * 1.15 + 40)) << 16) + (Math.min(255, Math.round(g * 1.15 + 40)) << 8) + Math.min(255, Math.round(b * 1.15 + 40))).toString(16).slice(1)}`
        : '#34d399';
    }
  }
  const accentRgb = parseHex(accentHex);
  const { r: aR, g: aG, b: aB } = accentRgb;

  const glowAlpha = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
  const accentGlowAlpha = (alpha: number) => `rgba(${aR}, ${aG}, ${aB}, ${alpha})`;

  return {
    primaryHex,
    accentHex,
    r,
    g,
    b,
    aR,
    aG,
    aB,
    glowAlpha,
    accentGlowAlpha,
    bgGradStops: [
      `rgb(${Math.max(6, Math.round(r * 0.06))}, ${Math.max(6, Math.round(g * 0.06))}, ${Math.max(10, Math.round(b * 0.06))})`,
      `rgb(${Math.max(10, Math.round(r * 0.09))}, ${Math.max(10, Math.round(g * 0.09))}, ${Math.max(16, Math.round(b * 0.09))})`,
      `rgb(${Math.max(14, Math.round(r * 0.15))}, ${Math.max(12, Math.round(g * 0.15))}, ${Math.max(24, Math.round(b * 0.15))})`,
      `rgb(${Math.max(18, Math.round(r * 0.20))}, ${Math.max(14, Math.round(g * 0.20))}, ${Math.max(32, Math.round(b * 0.20))})`,
      '#07080d',
    ],
    borderGradStops: [
      `rgb(${Math.round(r * 0.65)}, ${Math.round(g * 0.65)}, ${Math.round(b * 0.65)})`,
      primaryHex,
      `rgb(${Math.round(r * 0.4)}, ${Math.round(g * 0.4)}, ${Math.round(b * 0.4)})`,
      accentHex,
      `rgb(${Math.round(r * 0.3)}, ${Math.round(g * 0.3)}, ${Math.round(b * 0.3)})`,
    ],
    ringGradStops: [
      '#f8fafc',
      accentHex,
      `rgb(${Math.round(r * 0.4)}, ${Math.round(g * 0.4)}, ${Math.round(b * 0.4)})`,
      primaryHex,
      `rgb(${Math.round(r * 0.6)}, ${Math.round(g * 0.6)}, ${Math.round(b * 0.6)})`,
      '#ffffff',
    ],
    badgeBg: glowAlpha(0.18),
    badgeBorder: glowAlpha(0.42),
    badgeText: `rgb(${Math.min(255, Math.round(r * 0.35 + 175))}, ${Math.min(255, Math.round(g * 0.35 + 175))}, ${Math.min(255, Math.round(b * 0.35 + 175))})`,
    dotColor: accentHex,
    sloganColor: `rgb(${Math.min(255, Math.round(r * 0.3 + 180))}, ${Math.min(255, Math.round(g * 0.3 + 180))}, ${Math.min(255, Math.round(b * 0.3 + 180))})`,
    brandingColor: accentHex,
  };
}

export class WelcomeCardGenerator {
  private static cachedLogo: Image | null = null;

  /**
   * Loads logo image from options (buffer or url) or falls back to disk logo.
   */
  private static async getLogoImage(options?: WelcomeCardOptions): Promise<{ img: Image; isCustom: boolean } | null> {
    // 1. Direct buffer
    if (options?.logoBuffer) {
      try {
        const img = await loadBufferAsSafeImage(options.logoBuffer);
        if (img) return { img, isCustom: true };
      } catch (err) {
        console.warn('[WelcomeCardGenerator] Could not load logo from buffer:', err);
      }
    }

    // 2. Custom logo URL / Data URI / file path
    if (options?.logoUrl) {
      const url = options.logoUrl.trim();
      if (url.startsWith('data:image/')) {
        try {
          const base64Data = url.includes(',') ? url.split(',')[1] : url;
          const buf = Buffer.from(base64Data, 'base64');
          const img = await loadBufferAsSafeImage(buf);
          if (img) return { img, isCustom: true };
        } catch (err) {
          console.warn('[WelcomeCardGenerator] Could not parse base64 logo:', err);
        }
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        if (!isSafeHttpUrl(url)) {
          console.warn('[WelcomeCardGenerator] ⚠️ Güvenlik engeli: Güvensiz veya yerel ağ logo URL adresi engellendi (SSRF koruması):', url);
        } else {
          try {
            const res = await safeFetch(url, { signal: AbortSignal.timeout(5000) });
            if (res.ok) {
              const buf = Buffer.from(await res.arrayBuffer());
              const img = await loadBufferAsSafeImage(buf);
              if (img) return { img, isCustom: true };
            }
          } catch (err) {
            console.warn('[WelcomeCardGenerator] Could not fetch remote logo URL:', err);
          }
        }
      }
    }

    // 3. Fallback: Logosuz by default unless user sets a custom logo
    return null;
  }

  /**
   * Generates a modern, sleek banner card image (PNG buffer)
   * with procedural background, custom colors, and custom server logo.
   */
  static async generateCard(options: WelcomeCardOptions): Promise<Buffer> {
    registerProjectFonts();
    const palette = getCardPalette(options);

    const width = 1024;
    const height = 360;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.imageSmoothingEnabled = true;

    // 1. Base card container with rounded corners
    const cardX = 12;
    const cardY = 12;
    const cardW = width - 24;
    const cardH = height - 24;
    const cardRadius = 24;

    // Outer border & background clipping
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.clip();

    // Dark cybernetic multi-stop gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, palette.bgGradStops[0]);
    bgGrad.addColorStop(0.3, palette.bgGradStops[1]);
    bgGrad.addColorStop(0.65, palette.bgGradStops[2]);
    bgGrad.addColorStop(0.9, palette.bgGradStops[3]);
    bgGrad.addColorStop(1, palette.bgGradStops[4]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(cardX, cardY, cardW, cardH);

    // Background subtle diagonal high-tech grid lines
    this.drawCyberGrid(ctx, cardX, cardY, cardW, cardH, palette);

    // Soft ambient radial glows
    // Left ambient spotlight behind avatar
    const radGlow1 = ctx.createRadialGradient(165, 180, 20, 165, 180, 250);
    radGlow1.addColorStop(0, palette.glowAlpha(0.32));
    radGlow1.addColorStop(0.5, palette.glowAlpha(0.14));
    radGlow1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radGlow1;
    ctx.fillRect(cardX, cardY, cardW, cardH);


    // Top edge ambient rim light
    const topGlow = ctx.createLinearGradient(width / 2, 0, width / 2, 90);
    topGlow.addColorStop(0, palette.accentGlowAlpha(0.14));
    topGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(cardX, cardY, cardW, 90);

    // Programmatic cyber circuit traces
    this.drawCircuitTraces(ctx, width, height, palette);

    // Dot matrix tech pattern
    this.drawTechDotGrid(ctx, 300, 35, 680, 265, palette);

    // Right-side Logo drawing (only if custom logo is provided by user)
    const logoResult = await this.getLogoImage(options);
    if (logoResult) {
      this.drawUploadedLogo(ctx, logoResult.img, 865, 175, palette, logoResult.isCustom);
    }

    ctx.restore();

    // 2. Card frame border with glowing gradient
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);

    const borderGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    borderGrad.addColorStop(0, palette.borderGradStops[0]);
    borderGrad.addColorStop(0.25, palette.borderGradStops[1]);
    borderGrad.addColorStop(0.5, palette.borderGradStops[2]);
    borderGrad.addColorStop(0.8, palette.borderGradStops[3]);
    borderGrad.addColorStop(1, palette.borderGradStops[4]);

    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = palette.glowAlpha(0.5);
    ctx.shadowBlur = 18;
    ctx.stroke();

    // Subtle inner 1px glass border
    ctx.beginPath();
    ctx.roundRect(cardX + 1.5, cardY + 1.5, cardW - 3, cardH - 3, cardRadius - 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();

    // 3. Avatar Ring & Clipping
    const cx = 165;
    const cy = 180;
    const avatarRadius = 92;

    // Outer ambient neon glow around the avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, avatarRadius + 18, 0, Math.PI * 2);
    const ringOuterGlow = ctx.createRadialGradient(cx, cy, avatarRadius, cx, cy, avatarRadius + 22);
    ringOuterGlow.addColorStop(0, palette.glowAlpha(0.68));
    ringOuterGlow.addColorStop(0.6, palette.glowAlpha(0.24));
    ringOuterGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = ringOuterGlow;
    ctx.fill();
    ctx.restore();

    // Metallic Bevel Ring
    const ringThickness = 13;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, avatarRadius + ringThickness, 0, Math.PI * 2);
    ctx.arc(cx, cy, avatarRadius, 0, Math.PI * 2, true);

    const ringGrad = ctx.createLinearGradient(cx - avatarRadius, cy - avatarRadius, cx + avatarRadius, cy + avatarRadius);
    ringGrad.addColorStop(0, palette.ringGradStops[0]);
    ringGrad.addColorStop(0.18, palette.ringGradStops[1]);
    ringGrad.addColorStop(0.4, palette.ringGradStops[2]);
    ringGrad.addColorStop(0.65, palette.ringGradStops[3]);
    ringGrad.addColorStop(0.85, palette.ringGradStops[4]);
    ringGrad.addColorStop(1, palette.ringGradStops[5]);

    ctx.fillStyle = ringGrad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 12;
    ctx.fill();

    // Outer rim highlight
    ctx.beginPath();
    ctx.arc(cx, cy, avatarRadius + ringThickness, 0, Math.PI * 2);
    ctx.strokeStyle = palette.accentGlowAlpha(0.65);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Inner ring border
    ctx.beginPath();
    ctx.arc(cx, cy, avatarRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(10, 5, 20, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 4 Tech accent brackets around the ring (0°, 90°, 180°, 270°)
    this.drawCyberRingBrackets(ctx, cx, cy, avatarRadius + ringThickness + 5, palette.accentHex);

    // Draw Avatar (Supports GIF, PNG, WebP with automatic fallback)
    let avatarLoaded = false;
    if (options.avatarUrl) {
      const urlsToTry: string[] = [options.avatarUrl];

      const cleanUrl = options.avatarUrl.replace(/\.(png|gif|webp|jpe?g)(\?.*)?$/i, '');
      const isAnimated = options.avatarUrl.includes('a_') || options.avatarUrl.toLowerCase().includes('gif');

      if (isAnimated) {
        if (!urlsToTry.includes(`${cleanUrl}.gif`)) urlsToTry.unshift(`${cleanUrl}.gif`);
        if (!urlsToTry.includes(`${cleanUrl}.png`)) urlsToTry.push(`${cleanUrl}.png`);
        if (!urlsToTry.includes(`${cleanUrl}.webp`)) urlsToTry.push(`${cleanUrl}.webp`);
      } else {
        if (!urlsToTry.includes(`${cleanUrl}.png`)) urlsToTry.unshift(`${cleanUrl}.png`);
        if (!urlsToTry.includes(`${cleanUrl}.gif`)) urlsToTry.push(`${cleanUrl}.gif`);
        if (!urlsToTry.includes(`${cleanUrl}.webp`)) urlsToTry.push(`${cleanUrl}.webp`);
      }

      // Also try Discord CDN if it's a media URL hash
      const mediaMatch = options.avatarUrl.match(/avatars\/([^/]+)\/([^/.]+)/);
      if (mediaMatch) {
        const uId = mediaMatch[1];
        const aHash = mediaMatch[2];
        const aExt = 'png';
        urlsToTry.push(`https://cdn.discordapp.com/avatars/${uId}/${aHash}.${aExt}?size=512`);
      }

      for (const url of urlsToTry) {
        if (!isSafeHttpUrl(url)) continue;
        try {
          const res = await safeFetch(url, { signal: AbortSignal.timeout(5000) });
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            const avatarImg = await loadBufferAsSafeImage(buf);
            if (avatarImg) {
              ctx.save();
              ctx.beginPath();
              ctx.arc(cx, cy, avatarRadius - 1, 0, Math.PI * 2);
              ctx.clip();

              const imgRatio = avatarImg.width / avatarImg.height;
              let sWidth = avatarImg.width;
              let sHeight = avatarImg.height;
              let sx = 0;
              let sy = 0;
              if (imgRatio > 1) {
                sWidth = avatarImg.height;
                sx = (avatarImg.width - sWidth) / 2;
              } else if (imgRatio < 1) {
                sHeight = avatarImg.width;
                sy = (avatarImg.height - sHeight) / 2;
              }

              ctx.drawImage(avatarImg, sx, sy, sWidth, sHeight, cx - avatarRadius, cy - avatarRadius, avatarRadius * 2, avatarRadius * 2);
              ctx.restore();
              avatarLoaded = true;
              break;
            }
          }
        } catch {
          // Silently try next candidate format
        }
      }

      if (!avatarLoaded) {
        console.warn(`[WelcomeCardGenerator] Could not load avatar from any format for: ${options.avatarUrl}`);
      }
    }

    // Fallback procedural silhouette if avatar not loaded
    if (!avatarLoaded) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, avatarRadius - 1, 0, Math.PI * 2);
      ctx.clip();

      const avGrad = ctx.createLinearGradient(cx - avatarRadius, cy - avatarRadius, cx + avatarRadius, cy + avatarRadius);
      avGrad.addColorStop(0, palette.glowAlpha(0.25));
      avGrad.addColorStop(1, '#0e0b16');
      ctx.fillStyle = avGrad;
      ctx.fill();

      ctx.fillStyle = palette.glowAlpha(0.45);
      ctx.beginPath();
      ctx.arc(cx, cy - 14, 38, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy + 78, 68, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = palette.accentHex;
      ctx.shadowColor = palette.primaryHex;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(cx - 13, cy - 14, 4.5, 0, Math.PI * 2);
      ctx.arc(cx + 13, cy - 14, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Texts and typography
    const FONT_FAMILY = '"Inter", "Noto Color Emoji", "Segoe UI Emoji", "Apple Color Emoji", Arial, sans-serif';

    // Subtitle / Category Badge
    const defaultSubtitle = options.theme === 'crimson' || options.theme === 'goodbye' ? 'TOPLULUKTAN AYRILDI' : 'TOPLULUĞA KATILDI';
    const subtitle = options.subtitle || defaultSubtitle;
    const textX = 295;

    // Subtitle Pill Badge
    ctx.save();
    ctx.font = `bold 12px ${FONT_FAMILY}`;
    const subWidth = ctx.measureText(subtitle).width + 30;

    ctx.fillStyle = palette.badgeBg;
    ctx.beginPath();
    ctx.roundRect(textX, 102, subWidth, 24, 12);
    ctx.fill();
    ctx.strokeStyle = palette.badgeBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Glowing status dot
    ctx.fillStyle = palette.dotColor;
    ctx.shadowColor = palette.primaryHex;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(textX + 13, 114, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = palette.badgeText;
    ctx.fillText(subtitle, textX + 23, 118);
    ctx.restore();

    // Large Username with 3D drop shadow
    const defaultName = options.theme === 'crimson' || options.theme === 'goodbye' ? 'Eski Üye' : 'Yeni Üye';
    const username = options.username || defaultName;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 44px ${FONT_FAMILY}`;

    let displayUsername = username;
    const maxUserW = 440;
    if (ctx.measureText(displayUsername).width > maxUserW) {
      while (ctx.measureText(displayUsername + '...').width > maxUserW && displayUsername.length > 0) {
        displayUsername = displayUsername.slice(0, -1);
      }
      displayUsername += '...';
    }
    ctx.fillText(displayUsername, textX, 178);
    ctx.restore();

    // Welcome / Goodbye sentence
    const defaultText = options.theme === 'crimson' || options.theme === 'goodbye' ? 'Yolun açık olsun, tekrar bekleriz! 👋' : 'BROFIST Kabilesine Hoş geldin! 👊';
    const mainText = options.welcomeText || defaultText;
    ctx.save();
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `18px ${FONT_FAMILY}`;
    ctx.fillText(mainText, textX, 226);
    ctx.restore();

    // Sleek cyber divider line with glowing center node
    ctx.save();
    const sepGrad = ctx.createLinearGradient(textX, 268, width - 60, 268);
    sepGrad.addColorStop(0, palette.glowAlpha(0.68));
    sepGrad.addColorStop(0.5, palette.glowAlpha(0.25));
    sepGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.strokeStyle = sepGrad;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(textX, 268);
    ctx.lineTo(width - 60, 268);
    ctx.stroke();

    // Tech diamond node on the line
    ctx.fillStyle = palette.accentHex;
    ctx.shadowColor = palette.primaryHex;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(textX + 2, 268);
    ctx.lineTo(textX + 6, 264);
    ctx.lineTo(textX + 10, 268);
    ctx.lineTo(textX + 6, 272);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Bottom left branding
    const brandingText = options.brandingText || 'Kortex';
    ctx.save();
    ctx.fillStyle = palette.brandingColor;
    ctx.font = `bold 14px ${FONT_FAMILY}`;
    ctx.fillText(brandingText, textX, 308);

    // Bottom right slogan / stats
    const defaultSlogan = options.theme === 'crimson' || options.theme === 'goodbye' ? 'Disconnecting... ama izler kalır.' : 'Karanlıkta parlayan yeni bir yıldız.';
    const sloganText = options.sloganText || defaultSlogan;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = palette.sloganColor;
    ctx.font = `600 13.5px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.fillText(sloganText, width - 60, 308);
    ctx.restore();

    return canvas.toBuffer('image/png');
  }

  /**
   * Helper method for generating a goodbye card.
   */
  static async generateGoodbyeCard(options: WelcomeCardOptions): Promise<Buffer> {
    return this.generateCard({
      subtitle: 'TOPLULUKTAN AYRILDI',
      welcomeText: 'Yolun açık olsun, tekrar bekleriz! 👋',
      sloganText: 'Disconnecting... ama izler kalır.',
      theme: 'crimson',
      ...options,
    });
  }

  // Draw the uploaded or custom server logo neatly sized and centered without artificial light glare
  private static drawUploadedLogo(
    ctx: any,
    logo: Image,
    cx: number,
    cy: number,
    palette: CardPalette,
    isCustom = false
  ): void {
    ctx.save();

    let x: number;
    let y: number;
    let renderW: number;
    let renderH: number;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;

    if (isCustom) {
      // Custom uploaded logo: scale proportionally without cropping
      const maxW = 210;
      const maxH = 145;
      const ratio = logo.width / logo.height;
      if (ratio > maxW / maxH) {
        renderW = maxW;
        renderH = maxW / ratio;
      } else {
        renderH = maxH;
        renderW = maxH * ratio;
      }
      x = cx - renderW / 2;
      y = cy - renderH / 2;
      ctx.drawImage(logo, 0, 0, logo.width, logo.height, x, y, renderW, renderH);
    } else {
      // Default logo crop from src/assets/logo.png
      const srcX = 60;
      const srcY = 58;
      const srcW = 865;
      const srcH = 530;
      renderW = 220;
      renderH = (renderW / srcW) * srcH;
      x = cx - renderW / 2;
      y = cy - renderH / 2;
      ctx.drawImage(logo, srcX, srcY, srcW, srcH, x, y, renderW, renderH);
    }
    ctx.restore();

    ctx.restore();
  }

  // Draw faint diagonal cyber grid lines
  private static drawCyberGrid(ctx: any, x: number, y: number, w: number, h: number, palette: CardPalette): void {
    ctx.save();
    ctx.strokeStyle = palette.glowAlpha(0.04);
    ctx.lineWidth = 1;

    const spacing = 36;
    for (let i = -h; i < w + h; i += spacing) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i + h, y + h);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Procedural Circuit Traces
  private static drawCircuitTraces(ctx: any, w: number, h: number, palette: CardPalette): void {
    ctx.save();
    ctx.strokeStyle = palette.glowAlpha(0.24);
    ctx.fillStyle = palette.accentGlowAlpha(0.36);
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const circuits: Array<{ points: [number, number][]; endDot?: boolean }> = [
      // Top-right circuit network
      {
        points: [[w - 340, 22], [w - 240, 22], [w - 190, 72], [w - 80, 72]],
        endDot: true,
      },
      {
        points: [[w - 380, 52], [w - 290, 52], [w - 240, 102], [w - 140, 102], [w - 90, 152]],
        endDot: true,
      },
      {
        points: [[w - 240, 122], [w - 190, 122], [w - 150, 162], [w - 70, 162]],
        endDot: true,
      },
      {
        points: [[w - 190, 192], [w - 140, 242], [w - 70, 242]],
        endDot: true,
      },
      {
        points: [[w - 340, 82], [w - 300, 122], [w - 300, 182], [w - 260, 222]],
        endDot: true,
      },

      // Bottom center circuit traces
      {
        points: [[260, h - 34], [340, h - 34], [380, h - 74], [490, h - 74]],
        endDot: true,
      },
      {
        points: [[510, h - 48], [580, h - 48], [630, h - 98], [710, h - 98]],
        endDot: true,
      },

      // Left ambient circuits behind avatar
      {
        points: [[35, 60], [90, 60], [130, 100]],
        endDot: true,
      },
      {
        points: [[40, h - 70], [95, h - 70], [135, h - 110]],
        endDot: true,
      },
    ];

    for (const c of circuits) {
      ctx.beginPath();
      ctx.moveTo(c.points[0][0], c.points[0][1]);
      for (let i = 1; i < c.points.length; i++) {
        ctx.lineTo(c.points[i][0], c.points[i][1]);
      }
      ctx.stroke();

      if (c.endDot) {
        const last = c.points[c.points.length - 1];
        ctx.beginPath();
        ctx.arc(last[0], last[1], 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(last[0], last[1], 6.5, 0, Math.PI * 2);
        ctx.strokeStyle = palette.glowAlpha(0.32);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // Tech dot matrix pattern
  private static drawTechDotGrid(ctx: any, xStart: number, yStart: number, w: number, h: number, palette: CardPalette): void {
    ctx.save();
    ctx.fillStyle = palette.glowAlpha(0.11);
    const step = 28;
    for (let x = xStart; x < xStart + w; x += step) {
      for (let y = yStart; y < yStart + h; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 4 Tech brackets around the avatar ring
  private static drawCyberRingBrackets(ctx: any, cx: number, cy: number, r: number, color: string): void {
    ctx.save();
    const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    const arcLen = Math.PI / 16;

    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2.5;

    for (const a of angles) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, a - arcLen, a + arcLen);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Fallback geometric emblem if logo file is absent
  private static drawCyberEmblem(ctx: any, cx: number, cy: number, palette: CardPalette): void {
    ctx.save();
    ctx.translate(cx, cy);

    const s = 1.35;
    ctx.scale(s, s);

    ctx.beginPath();
    ctx.moveTo(-48, -32);
    ctx.lineTo(26, -32);
    ctx.lineTo(44, -18);
    ctx.lineTo(12, -18);
    ctx.lineTo(2, -18);
    ctx.lineTo(-32, -18);
    ctx.closePath();

    const wingGrad = ctx.createLinearGradient(-48, -32, 44, -18);
    wingGrad.addColorStop(0, '#f8fafc');
    wingGrad.addColorStop(0.3, palette.accentHex);
    wingGrad.addColorStop(0.7, palette.primaryHex);
    wingGrad.addColorStop(1, palette.glowAlpha(0.4));
    ctx.fillStyle = wingGrad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 10;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-48, -13);
    ctx.lineTo(-20, -13);
    ctx.lineTo(-4, 0);
    ctx.lineTo(28, 0);
    ctx.lineTo(44, 4);
    ctx.lineTo(48, 11);
    ctx.lineTo(38, 14);
    ctx.lineTo(48, 17);
    ctx.lineTo(44, 24);
    ctx.lineTo(28, 26);
    ctx.lineTo(-8, 26);
    ctx.lineTo(-18, 16);
    ctx.lineTo(-34, 30);
    ctx.lineTo(-48, 18);
    ctx.lineTo(-32, 5);
    ctx.closePath();

    const bodyGrad = ctx.createLinearGradient(-48, -13, 48, 28);
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(0.22, palette.accentHex);
    bodyGrad.addColorStop(0.65, palette.primaryHex);
    bodyGrad.addColorStop(1, palette.glowAlpha(0.5));
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(14, 13, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#0e0817';
    ctx.fill();
    ctx.strokeStyle = palette.accentHex;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }
}
