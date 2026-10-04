// SPDX-License-Identifier: AGPL-3.0-or-later
import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { fetchAndLoadSafeImage, loadBufferAsSafeImage, registerProjectFonts } from '../utils/imageUtils.js';
export class OwoLevelCardGenerator {
    static localAvatarCache = null;
    static localBannerCache = null;
    static async getLocalAsset(filename) {
        const possiblePaths = [
            path.resolve(process.cwd(), 'src/assets', filename),
            path.resolve(process.cwd(), 'dist/assets', filename),
            path.resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '../assets', filename),
        ];
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                try {
                    return await loadBufferAsSafeImage(fs.readFileSync(p));
                }
                catch {
                    // ignore
                }
            }
        }
        return null;
    }
    static async fetchImage(url) {
        return fetchAndLoadSafeImage(url);
    }
    /**
     * Generates a sleek, authentic OwO style level up banner card.
     * Matches the visual card format:
     * [Avatar] | LEVEL UP! {Level} | [Rewards: Cash, Lootbox, Crate]
     */
    static async generateCard(options) {
        registerProjectFonts();
        const width = 600;
        const height = 200;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        const cardRadius = 14;
        // 1. Clip canvas to rounded rectangle
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(0, 0, width, height, cardRadius);
        ctx.clip();
        // 2. Load images (Banner & Avatar)
        let bannerImg = null;
        let avatarImg = null;
        if (options.bannerUrl) {
            bannerImg = await this.fetchImage(options.bannerUrl);
        }
        if (options.avatarUrl) {
            avatarImg = await this.fetchImage(options.avatarUrl);
        }
        if (!avatarImg) {
            if (!this.localAvatarCache) {
                this.localAvatarCache = await this.getLocalAsset('avatar.jpg');
            }
            avatarImg = this.localAvatarCache;
        }
        if (!bannerImg) {
            if (options.bannerUrl) {
                // try local if remote failed
                if (!this.localBannerCache) {
                    this.localBannerCache = await this.getLocalAsset('banner.jpg');
                }
                bannerImg = this.localBannerCache;
            }
            else if (avatarImg) {
                // Discord / OwO fallback: use avatar as background when no banner is set
                bannerImg = avatarImg;
            }
        }
        // 3. Draw Background
        if (bannerImg) {
            // Draw banner cover
            const imgRatio = bannerImg.width / bannerImg.height;
            const canvasRatio = width / height;
            let sx = 0;
            let sy = 0;
            let sWidth = bannerImg.width;
            let sHeight = bannerImg.height;
            if (imgRatio > canvasRatio) {
                sWidth = bannerImg.height * canvasRatio;
                sx = (bannerImg.width - sWidth) / 2;
            }
            else {
                sHeight = bannerImg.width / canvasRatio;
                sy = (bannerImg.height - sHeight) / 2;
            }
            ctx.drawImage(bannerImg, sx, sy, sWidth, sHeight, 0, 0, width, height);
        }
        else {
            // Ambient dark gradient fallback
            const bgGrad = ctx.createLinearGradient(0, 0, width, height);
            bgGrad.addColorStop(0, '#181824');
            bgGrad.addColorStop(0.5, '#2e2544');
            bgGrad.addColorStop(1, '#11121a');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, width, height);
        }
        // Background dark tint overlay for readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(0, 0, width, height);
        // 4. Inner Card Panel
        const innerX = 18;
        const innerY = 18;
        const innerW = width - 36;
        const innerH = height - 36;
        const innerRadius = 10;
        ctx.fillStyle = 'rgba(18, 20, 28, 0.74)';
        ctx.beginPath();
        ctx.roundRect(innerX, innerY, innerW, innerH, innerRadius);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
        // 5. Left: Avatar Box
        const avSize = 126;
        const avX = innerX + 18;
        const avY = innerY + (innerH - avSize) / 2;
        const avRadius = 8;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(avX, avY, avSize, avSize, avRadius);
        ctx.clip();
        if (avatarImg) {
            const aRatio = avatarImg.width / avatarImg.height;
            let asx = 0;
            let asy = 0;
            let asW = avatarImg.width;
            let asH = avatarImg.height;
            if (aRatio > 1) {
                asW = avatarImg.height;
                asx = (avatarImg.width - asW) / 2;
            }
            else {
                asH = avatarImg.width;
                asy = (avatarImg.height - asH) / 2;
            }
            ctx.drawImage(avatarImg, asx, asy, asW, asH, avX, avY, avSize, avSize);
        }
        else {
            ctx.fillStyle = '#4f46e5';
            ctx.fillRect(avX, avY, avSize, avSize);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((options.username || 'U').charAt(0).toUpperCase(), avX + avSize / 2, avY + avSize / 2);
        }
        ctx.restore();
        // Avatar border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(avX, avY, avSize, avSize, avRadius);
        ctx.stroke();
        // 6. Middle Column: "LEVEL UP!" and Big Number
        const midLeft = avX + avSize;
        const dividerX = 365;
        const midCenterX = (midLeft + dividerX) / 2;
        const FONT_FAMILY = '"Segoe UI", "Inter", -apple-system, BlinkMacSystemFont, Arial, sans-serif';
        // Header: "LEVEL UP!"
        ctx.save();
        ctx.font = `bold 19px ${FONT_FAMILY}`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 6;
        ctx.fillText('LEVEL UP!', midCenterX, innerY + 44);
        // Big Level Number
        const levelStr = options.level.toString();
        const levelFontSize = levelStr.length >= 3 ? 52 : 64;
        ctx.font = `bold ${levelFontSize}px ${FONT_FAMILY}`;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 8;
        ctx.fillText(levelStr, midCenterX, innerY + 104);
        ctx.restore();
        // 7. Vertical Divider Line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dividerX, innerY + 16);
        ctx.lineTo(dividerX, innerY + innerH - 16);
        ctx.stroke();
        // 8. Right Column: Rewards (Cash, Lootbox, Crate)
        const rightX = dividerX + 22;
        const iconSize = 28;
        // Helper: Draw Banknote Stack Icon (Cyan with layered depth)
        const drawCashIcon = (cx, cy, s) => {
            ctx.save();
            const w = s * 1.05;
            const h = s * 0.65;
            // Bottom bill shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.beginPath();
            ctx.roundRect(cx + 2, cy + 5, w, h, 2.5);
            ctx.fill();
            // Lower banknote (peeking behind)
            ctx.fillStyle = '#0284c7';
            ctx.beginPath();
            ctx.roundRect(cx + 1, cy + 2, w, h, 2.5);
            ctx.fill();
            ctx.strokeStyle = '#0369a1';
            ctx.lineWidth = 1;
            ctx.stroke();
            // Main banknote (top)
            const billGrad = ctx.createLinearGradient(cx, cy, cx, cy + h);
            billGrad.addColorStop(0, '#38bdf8');
            billGrad.addColorStop(1, '#0ea5e9');
            ctx.fillStyle = billGrad;
            ctx.beginPath();
            ctx.roundRect(cx, cy, w, h, 2.5);
            ctx.fill();
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            // Inner banknote border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = 1;
            ctx.strokeRect(cx + 2.5, cy + 2.5, w - 5, h - 5);
            // Center dark blue security band
            ctx.fillStyle = '#0369a1';
            ctx.fillRect(cx + w * 0.36, cy, w * 0.28, h);
            // White currency symbol ($)
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.floor(s * 0.42)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', cx + w * 0.5, cy + h * 0.52);
            ctx.restore();
        };
        // Helper: Draw 3D Isometric Cardboard Lootbox Icon (Matching reference image)
        const drawLootboxIcon = (cx, cy, s) => {
            ctx.save();
            const w = s;
            const h = s;
            // Drop shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.beginPath();
            ctx.ellipse(cx + w * 0.5, cy + h + 2, w * 0.45, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();
            // Isometric coordinates
            const pTop = { x: cx + w * 0.5, y: cy + 1 };
            const pRight = { x: cx + w - 1, y: cy + h * 0.28 };
            const pCenter = { x: cx + w * 0.5, y: cy + h * 0.54 };
            const pLeft = { x: cx + 1, y: cy + h * 0.28 };
            const pBottom = { x: cx + w * 0.5, y: cy + h };
            const pBottomLeft = { x: cx + 1, y: cy + h * 0.74 };
            const pBottomRight = { x: cx + w - 1, y: cy + h * 0.74 };
            // 1. Top face (Light Kraft Tan)
            ctx.fillStyle = '#dfb589';
            ctx.beginPath();
            ctx.moveTo(pTop.x, pTop.y);
            ctx.lineTo(pRight.x, pRight.y);
            ctx.lineTo(pCenter.x, pCenter.y);
            ctx.lineTo(pLeft.x, pLeft.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#855228';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            // Top packing tape (across center seam)
            ctx.fillStyle = '#fff4db';
            ctx.beginPath();
            ctx.moveTo(cx + w * 0.44, cy + h * 0.08);
            ctx.lineTo(cx + w * 0.56, cy + h * 0.08);
            ctx.lineTo(cx + w * 0.56, cy + h * 0.52);
            ctx.lineTo(cx + w * 0.44, cy + h * 0.52);
            ctx.closePath();
            ctx.fill();
            // 2. Left face (Shadowed Kraft Brown)
            ctx.fillStyle = '#ab784c';
            ctx.beginPath();
            ctx.moveTo(pLeft.x, pLeft.y);
            ctx.lineTo(pCenter.x, pCenter.y);
            ctx.lineTo(pBottom.x, pBottom.y);
            ctx.lineTo(pBottomLeft.x, pBottomLeft.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#7c481e';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            // 3. Right face (Medium Kraft Tan)
            ctx.fillStyle = '#c89464';
            ctx.beginPath();
            ctx.moveTo(pCenter.x, pCenter.y);
            ctx.lineTo(pRight.x, pRight.y);
            ctx.lineTo(pBottomRight.x, pBottomRight.y);
            ctx.lineTo(pBottom.x, pBottom.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#7c481e';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            // Vertical tape down front seam
            ctx.fillStyle = '#fff4db';
            ctx.beginPath();
            ctx.moveTo(pCenter.x - 2, pCenter.y);
            ctx.lineTo(pCenter.x + 2, pCenter.y);
            ctx.lineTo(pBottom.x + 2, pBottom.y - 1);
            ctx.lineTo(pBottom.x - 2, pBottom.y - 1);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        };
        // Helper: Draw 3D Isometric Wooden Crate Icon (Matching reference image)
        const drawCrateIcon = (cx, cy, s) => {
            ctx.save();
            const w = s;
            const h = s;
            // Drop shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath();
            ctx.ellipse(cx + w * 0.5, cy + h + 2, w * 0.45, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();
            // Isometric coordinates
            const pTop = { x: cx + w * 0.5, y: cy + 1 };
            const pRight = { x: cx + w - 1, y: cy + h * 0.28 };
            const pCenter = { x: cx + w * 0.5, y: cy + h * 0.54 };
            const pLeft = { x: cx + 1, y: cy + h * 0.28 };
            const pBottom = { x: cx + w * 0.5, y: cy + h };
            const pBottomLeft = { x: cx + 1, y: cy + h * 0.74 };
            const pBottomRight = { x: cx + w - 1, y: cy + h * 0.74 };
            // 1. Top face (Warm honey wood planks)
            ctx.fillStyle = '#cb8f54';
            ctx.beginPath();
            ctx.moveTo(pTop.x, pTop.y);
            ctx.lineTo(pRight.x, pRight.y);
            ctx.lineTo(pCenter.x, pCenter.y);
            ctx.lineTo(pLeft.x, pLeft.y);
            ctx.closePath();
            ctx.fill();
            // Top wood plank grooves
            ctx.strokeStyle = '#7c4819';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx + w * 0.28, cy + h * 0.16);
            ctx.lineTo(cx + w * 0.78, cy + h * 0.42);
            ctx.moveTo(cx + w * 0.22, cy + h * 0.38);
            ctx.lineTo(cx + w * 0.72, cy + h * 0.14);
            ctx.stroke();
            ctx.strokeStyle = '#522e0f';
            ctx.lineWidth = 1.3;
            ctx.stroke();
            // 2. Left face (Shadowed wood with frame & diagonal brace)
            ctx.fillStyle = '#895425';
            ctx.beginPath();
            ctx.moveTo(pLeft.x, pLeft.y);
            ctx.lineTo(pCenter.x, pCenter.y);
            ctx.lineTo(pBottom.x, pBottom.y);
            ctx.lineTo(pBottomLeft.x, pBottomLeft.y);
            ctx.closePath();
            ctx.fill();
            // Inset wood panel
            ctx.fillStyle = '#75431b';
            ctx.beginPath();
            ctx.moveTo(pLeft.x + 2.5, pLeft.y + 1.5);
            ctx.lineTo(pCenter.x - 2, pCenter.y + 1);
            ctx.lineTo(pBottom.x - 2, pBottom.y - 2);
            ctx.lineTo(pBottomLeft.x + 2.5, pBottomLeft.y - 1.5);
            ctx.closePath();
            ctx.fill();
            // Diagonal cross brace on left face
            ctx.strokeStyle = '#895425';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(pLeft.x + 3, pLeft.y + 2);
            ctx.lineTo(pBottom.x - 3, pBottom.y - 2);
            ctx.stroke();
            ctx.strokeStyle = '#4e2a0c';
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(pLeft.x, pLeft.y);
            ctx.lineTo(pCenter.x, pCenter.y);
            ctx.lineTo(pBottom.x, pBottom.y);
            ctx.lineTo(pBottomLeft.x, pBottomLeft.y);
            ctx.closePath();
            ctx.stroke();
            // 3. Right face (Lit warm wood with frame & diagonal brace)
            ctx.fillStyle = '#aa6f38';
            ctx.beginPath();
            ctx.moveTo(pCenter.x, pCenter.y);
            ctx.lineTo(pRight.x, pRight.y);
            ctx.lineTo(pBottomRight.x, pBottomRight.y);
            ctx.lineTo(pBottom.x, pBottom.y);
            ctx.closePath();
            ctx.fill();
            // Inset wood panel
            ctx.fillStyle = '#965d29';
            ctx.beginPath();
            ctx.moveTo(pCenter.x + 2, pCenter.y + 1);
            ctx.lineTo(pRight.x - 2.5, pRight.y + 1.5);
            ctx.lineTo(pBottomRight.x - 2.5, pBottomRight.y - 1.5);
            ctx.lineTo(pBottom.x + 2, pBottom.y - 2);
            ctx.closePath();
            ctx.fill();
            // Diagonal cross brace on right face
            ctx.strokeStyle = '#aa6f38';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(pCenter.x + 3, pCenter.y + 2);
            ctx.lineTo(pBottomRight.x - 3, pBottomRight.y - 2);
            ctx.stroke();
            ctx.strokeStyle = '#4e2a0c';
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(pCenter.x, pCenter.y);
            ctx.lineTo(pRight.x, pRight.y);
            ctx.lineTo(pBottomRight.x, pBottomRight.y);
            ctx.lineTo(pBottom.x, pBottom.y);
            ctx.closePath();
            ctx.stroke();
            // Metal corner studs/bolts
            ctx.fillStyle = '#261506';
            const drawStud = (sx, sy) => {
                ctx.beginPath();
                ctx.arc(sx, sy, 1, 0, Math.PI * 2);
                ctx.fill();
            };
            drawStud(pLeft.x + 2, pLeft.y + 2);
            drawStud(pCenter.x, pCenter.y + 3);
            drawStud(pRight.x - 2, pRight.y + 2);
            drawStud(pBottomLeft.x + 2, pBottomLeft.y - 2);
            drawStud(pBottom.x, pBottom.y - 3);
            drawStud(pBottomRight.x - 2, pBottomRight.y - 2);
            ctx.restore();
        };
        // Row 1: Cash
        const row1Y = innerY + 36;
        drawCashIcon(rightX, row1Y - 9, iconSize);
        ctx.save();
        ctx.font = `bold 19px ${FONT_FAMILY}`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 4;
        ctx.fillText(`+${options.cowoncyReward.toLocaleString('en-US')}`, rightX + iconSize + 14, row1Y);
        ctx.restore();
        // Row 2: Lootbox
        const row2Y = innerY + 82;
        drawLootboxIcon(rightX, row2Y - 12, iconSize);
        ctx.save();
        ctx.font = `bold 19px ${FONT_FAMILY}`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 4;
        ctx.fillText(`+${options.lootboxReward.toLocaleString('en-US')}`, rightX + iconSize + 14, row2Y);
        ctx.restore();
        // Row 3: Crate
        const row3Y = innerY + 128;
        drawCrateIcon(rightX, row3Y - 12, iconSize);
        ctx.save();
        ctx.font = `bold 19px ${FONT_FAMILY}`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 4;
        ctx.fillText(`+${options.crateReward.toLocaleString('en-US')}`, rightX + iconSize + 14, row3Y);
        ctx.restore();
        ctx.restore();
        return canvas.toBuffer('image/png');
    }
}
//# sourceMappingURL=OwoLevelCardGenerator.js.map