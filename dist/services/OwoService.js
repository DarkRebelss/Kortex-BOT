// SPDX-License-Identifier: AGPL-3.0-or-later
import { resolveUserDisplayName } from '../utils/userResolver.js';
import { OwoLevelCardGenerator } from './OwoLevelCardGenerator.js';
import { ANIMALS, ANIMAL_TIER_POWER, MONSTERS, OWO_EXPRESSIONS, TIER_COLORS, WEAPONS, } from './owoData.js';
export class OwoService {
    api;
    db;
    activeBlackjacks = new Map();
    animalPriceMap = {};
    gamblingCooldowns = new Map();
    pendingProposals = new Map();
    userLastChannel = new Map();
    userLastGuild = new Map();
    remindedUsers = new Set();
    MAX_GAMBLE_BET = 50_000_000;
    MAX_GIVE_AMOUNT = 100_000_000;
    constructor(api, db) {
        this.api = api;
        this.db = db;
        // Cache animal sell prices
        for (const a of ANIMALS) {
            this.animalPriceMap[a.id] = a.sellPrice;
        }
        // Clean up or auto-resolve stale blackjack games older than 60 seconds
        setInterval(async () => {
            const now = Date.now();
            for (const [key, game] of this.activeBlackjacks.entries()) {
                if (now - game.startTime > 60000) {
                    this.activeBlackjacks.delete(key);
                    try {
                        await this.autoStandTimeoutBlackjack(game);
                    }
                    catch (err) {
                        console.error('[OwoService] Blackjack timeout auto-stand hatası:', err?.message);
                    }
                }
            }
        }, 15000);
        // Clean up stale marriage proposals older than 60 seconds
        setInterval(() => {
            const now = Date.now();
            for (const [targetId, prop] of this.pendingProposals.entries()) {
                if (now - prop.timestamp > 60000) {
                    this.pendingProposals.delete(targetId);
                }
            }
        }, 15000);
        // Check pending daily reminders every 60 seconds
        setInterval(async () => {
            await this.checkDailyReminders();
        }, 60000);
    }
    async sendAutoExpiring(channelId, content, seconds = 7, triggerMsgId) {
        try {
            const sent = await this.api.sendMessage(channelId, content);
            if (sent?.id) {
                setTimeout(() => {
                    void this.api.deleteMessage(channelId, sent.id, 'Owo Notice Auto Cleanup').catch(() => { });
                }, seconds * 1000);
            }
            if (triggerMsgId) {
                setTimeout(() => {
                    void this.api.deleteMessage(channelId, triggerMsgId, 'Owo Trigger Auto Cleanup').catch(() => { });
                }, seconds * 1000);
            }
        }
        catch { }
    }
    /**
     * Checks users whose 24-hour daily reward is ready and sends DM notifications mentioning the community.
     */
    async checkDailyReminders() {
        const nowUnix = Math.floor(Date.now() / 1000);
        const pendingUsers = this.db.getUsersPendingDailyReminder(nowUnix);
        for (const u of pendingUsers) {
            if (this.remindedUsers.has(u.user_id))
                continue;
            this.remindedUsers.add(u.user_id);
            const cachedGuild = this.userLastGuild.get(u.user_id);
            let communityName = cachedGuild?.name || u.last_guild_name || '';
            if (!communityName && (u.last_guild_id || cachedGuild?.id)) {
                try {
                    const fetchedGuild = await this.api.getGuild(u.last_guild_id || cachedGuild.id);
                    if (fetchedGuild?.name)
                        communityName = fetchedGuild.name;
                }
                catch { }
            }
            if (!communityName) {
                communityName = 'Micup Topluluğu';
            }
            const embed = {
                title: `🪙 Günlük Ödülün Hazır! — ${communityName}`,
                description: `Merhaba! **${communityName}** topluluğunda aldığın günlük ödülün üzerinden 24 saat geçti!\n\n` +
                    `🏰 **Topluluk:** **${communityName}**\n` +
                    `🎁 **Kullanılacak Komut:** \`/w daily\`\n` +
                    `💰 **Kazanılacak Ödül:** 500+ Cowoncy & Günlük Seri Bonusu\n\n` +
                    `👉 Hemen **${communityName}** topluluğundaki bir sohbet kanalına giderek \`/w daily\` yaz ve ödülünü kap! 🎉`,
                color: 0xf1c40f,
                footer: { text: `Kortex • ${communityName} Günlük Bildirim Sistemi` },
            };
            let dmDelivered = false;
            try {
                await this.api.sendDirectMessage(u.user_id, '', { embeds: [embed] });
                dmDelivered = true;
            }
            catch {
                try {
                    await this.api.sendDirectMessage(u.user_id, embed.description);
                    dmDelivered = true;
                }
                catch { }
            }
            if (!dmDelivered) {
                const channelId = this.userLastChannel.get(u.user_id);
                if (channelId) {
                    try {
                        await this.api.sendMessage(channelId, `⏰ | <@${u.user_id}>, **${communityName}** topluluğundaki 24 saatlik süren doldu! Günlük ödülün (\`/w daily\`) hazır! 🪙`);
                    }
                    catch { }
                }
            }
        }
    }
    checkGamblingCooldown(userId, username) {
        const now = Date.now();
        const lastTime = this.gamblingCooldowns.get(userId) || 0;
        const COOLDOWN_MS = 2500;
        if (now - lastTime < COOLDOWN_MS) {
            const remainingSec = ((COOLDOWN_MS - (now - lastTime)) / 1000).toFixed(1);
            return `⏳ **${username}**, çok hızlı kumar oynuyorsun! Lütfen **${remainingSec}** saniye bekle.`;
        }
        this.gamblingCooldowns.set(userId, now);
        return null;
    }
    /**
     * Sends a random cute OwO face expression when /owo or /uwu is used without arguments.
     */
    async sendExpression(channelId) {
        const face = OWO_EXPRESSIONS[Math.floor(Math.random() * OWO_EXPRESSIONS.length)];
        await this.api.sendMessage(channelId, face);
    }
    // -------------------------------------------------------------
    // Message Ingestion & Routing
    // -------------------------------------------------------------
    async handleMessage(guild, member, message) {
        const rawContent = (message.content || '').trim();
        if (!rawContent)
            return false;
        this.userLastChannel.set(member.user.id, message.channel_id);
        this.userLastGuild.set(member.user.id, { id: guild.id, name: guild.name });
        this.db.updateOwoUser(member.user.id, {
            last_guild_id: guild.id,
            last_guild_name: guild.name,
        });
        // Check if user has an active blackjack hand waiting for hit/stand
        const bjGame = this.activeBlackjacks.get(member.user.id);
        if (bjGame && bjGame.channelId === message.channel_id) {
            const lower = rawContent.toLowerCase();
            if (['h', 'hit', 'çek', 'kart'].includes(lower)) {
                await this.stepBlackjack(guild, member, message, 'hit');
                return true;
            }
            if (['s', 'stand', 'kal', 'dur'].includes(lower)) {
                await this.stepBlackjack(guild, member, message, 'stand');
                return true;
            }
        }
        // Check if user has an active marriage proposal waiting for acceptance
        const pendingMarriage = this.pendingProposals.get(member.user.id);
        if (pendingMarriage && pendingMarriage.channelId === message.channel_id) {
            const lower = rawContent.toLowerCase();
            if (['evet', 'kabul', 'accept', 'yes'].includes(lower)) {
                await this.handleMarry(guild, member, message, ['accept']);
                return true;
            }
        }
        // All OwO commands require prefix (/owo, /uwu, or /w handled by CommandHandler).
        // Regular chat messages ("owo", "uwu") are not intercepted.
        return false;
    }
    /**
     * Resolves a target member by mention (<@id>), Snowflake ID, username, nickname,
     * or by inspecting message.mentions. If not cached, fetches from API.
     */
    async resolveMember(guild, raw, message) {
        if (!raw)
            return null;
        const trimmed = raw.trim();
        // 1. Direct mention regex: <@123456789012345678> or <@!123456789012345678> or pure Snowflake ID
        const mentionMatch = trimmed.match(/<@!?([^>]+)>/);
        const targetId = mentionMatch ? mentionMatch[1] : (/^\d{15,22}$/.test(trimmed) ? trimmed : null);
        if (targetId) {
            // Check in message.mentions first
            const msgMention = message?.mentions?.find((u) => u.id === targetId);
            // Check cached members
            const cached = guild.members?.find((m) => m.user.id === targetId);
            if (cached)
                return cached;
            // Try fetching from API
            try {
                const fetched = await this.api.getGuildMember(guild.id, targetId);
                if (fetched) {
                    if (!guild.members)
                        guild.members = [];
                    guild.members.push(fetched);
                    return fetched;
                }
            }
            catch { }
            if (msgMention) {
                const synthetic = {
                    user: msgMention,
                    roles: [],
                    joined_at: new Date().toISOString(),
                };
                if (!guild.members)
                    guild.members = [];
                guild.members.push(synthetic);
                return synthetic;
            }
            // If user has a record in DB, allow interaction
            const resolvedName = await resolveUserDisplayName(this.api, this.db, guild, targetId);
            const dbUser = this.db.getOwoUser(targetId);
            if (dbUser || (resolvedName && !resolvedName.startsWith('Kullanıcı_'))) {
                return {
                    user: {
                        id: targetId,
                        username: resolvedName && !resolvedName.startsWith('Kullanıcı_') ? resolvedName : `User_${targetId.slice(-4)}`,
                        discriminator: '0000',
                    },
                    roles: [],
                    joined_at: new Date().toISOString(),
                };
            }
        }
        // 2. Check by name or clean mention (e.g. "@BatuneX", "BatuneX")
        const cleanRaw = trimmed.replace(/^@\s*/, '').trim();
        const cleanLowerTr = cleanRaw.toLocaleLowerCase('tr');
        const cleanLowerEn = cleanRaw.toLowerCase();
        // Check message.mentions by username, nickname, or global_name
        if (message?.mentions && message.mentions.length > 0) {
            const match = message.mentions.find((u) => {
                const uTr = u.username.toLocaleLowerCase('tr');
                const uEn = u.username.toLowerCase();
                const gTr = u.global_name ? u.global_name.toLocaleLowerCase('tr') : '';
                const gEn = u.global_name ? u.global_name.toLowerCase() : '';
                return uTr === cleanLowerTr || uEn === cleanLowerEn || gTr === cleanLowerTr || gEn === cleanLowerEn;
            });
            if (match) {
                const cached = guild.members?.find((m) => m.user.id === match.id);
                if (cached)
                    return cached;
                const synthetic = {
                    user: match,
                    roles: [],
                    joined_at: new Date().toISOString(),
                };
                if (!guild.members)
                    guild.members = [];
                guild.members.push(synthetic);
                return synthetic;
            }
        }
        // Check cached guild members
        if (guild.members && guild.members.length > 0) {
            const cached = guild.members.find((m) => {
                const uTr = m.user.username.toLocaleLowerCase('tr');
                const uEn = m.user.username.toLowerCase();
                const nTr = m.nick ? m.nick.toLocaleLowerCase('tr') : '';
                const nEn = m.nick ? m.nick.toLowerCase() : '';
                const gTr = m.user.global_name ? m.user.global_name.toLocaleLowerCase('tr') : '';
                const gEn = m.user.global_name ? m.user.global_name.toLowerCase() : '';
                return (uTr === cleanLowerTr ||
                    uEn === cleanLowerEn ||
                    nTr === cleanLowerTr ||
                    nEn === cleanLowerEn ||
                    gTr === cleanLowerTr ||
                    gEn === cleanLowerEn);
            });
            if (cached)
                return cached;
        }
        // 3. Fetch all members from API if not cached
        try {
            const allMembers = await this.api.getGuildMembers(guild.id);
            if (Array.isArray(allMembers) && allMembers.length > 0) {
                guild.members = allMembers;
                const found = allMembers.find((m) => {
                    const uTr = m.user.username.toLocaleLowerCase('tr');
                    const uEn = m.user.username.toLowerCase();
                    const nTr = m.nick ? m.nick.toLocaleLowerCase('tr') : '';
                    const nEn = m.nick ? m.nick.toLowerCase() : '';
                    const gTr = m.user.global_name ? m.user.global_name.toLocaleLowerCase('tr') : '';
                    const gEn = m.user.global_name ? m.user.global_name.toLowerCase() : '';
                    return (uTr === cleanLowerTr ||
                        uEn === cleanLowerEn ||
                        nTr === cleanLowerTr ||
                        nEn === cleanLowerEn ||
                        gTr === cleanLowerTr ||
                        gEn === cleanLowerEn);
                });
                if (found)
                    return found;
            }
        }
        catch { }
        return null;
    }
    async resolveAvatarUrl(user, member, guildId) {
        let memberAvatar = member?.avatar;
        let userAvatar = user.avatar || user.avatar_hash;
        if (!memberAvatar && !userAvatar && user.id && guildId) {
            try {
                const freshMember = await this.api.getGuildMember(guildId, user.id);
                if (freshMember?.avatar)
                    memberAvatar = freshMember.avatar;
                if (freshMember?.user?.avatar)
                    userAvatar = freshMember.user.avatar;
                if (freshMember?.user?.avatar_hash)
                    userAvatar = freshMember.user.avatar_hash;
            }
            catch { }
        }
        if (memberAvatar) {
            if (memberAvatar.startsWith('http'))
                return memberAvatar;
            const clean = memberAvatar.replace(/\.(png|gif|webp|jpe?g)$/i, '');
            const ext = (clean.startsWith('a_') || clean.toLowerCase().includes('gif')) ? 'gif' : 'png';
            if (guildId)
                return `https://micup.gg/media/guilds/${guildId}/users/${user.id}/avatars/${clean}.${ext}`;
        }
        if (userAvatar) {
            if (userAvatar.startsWith('http'))
                return userAvatar;
            const clean = userAvatar.replace(/\.(png|gif|webp|jpe?g)$/i, '');
            const ext = (clean.startsWith('a_') || clean.toLowerCase().includes('gif')) ? 'gif' : 'png';
            return `https://micup.gg/media/avatars/${user.id}/${clean}.${ext}`;
        }
        try {
            const idx = Number(BigInt(user.id) % 6n);
            return `https://micup.gg/avatars/${idx}.png`;
        }
        catch {
            return `https://micup.gg/avatars/0.png`;
        }
    }
    async resolveBannerUrl(user, member, guildId) {
        let memberBanner = member?.banner;
        let userBanner = user.banner || user.banner_hash;
        if (!memberBanner && !userBanner && user.id && guildId) {
            try {
                const freshMember = await this.api.getGuildMember(guildId, user.id);
                if (freshMember?.banner)
                    memberBanner = freshMember.banner;
                if (freshMember?.user?.banner)
                    userBanner = freshMember.user.banner;
            }
            catch { }
        }
        if (memberBanner) {
            if (memberBanner.startsWith('http'))
                return memberBanner;
            const clean = memberBanner.replace(/\.(png|gif|webp|jpe?g)$/i, '');
            const ext = (clean.startsWith('a_') || clean.toLowerCase().includes('gif')) ? 'gif' : 'png';
            if (guildId)
                return `https://micup.gg/media/guilds/${guildId}/users/${user.id}/banners/${clean}.${ext}`;
        }
        if (userBanner) {
            if (userBanner.startsWith('http'))
                return userBanner;
            const clean = userBanner.replace(/\.(png|gif|webp|jpe?g)$/i, '');
            const ext = (clean.startsWith('a_') || clean.toLowerCase().includes('gif')) ? 'gif' : 'png';
            return `https://micup.gg/media/banners/${user.id}/${clean}.${ext}`;
        }
        return null;
    }
    /**
     * Returns the XP required to complete the given level and advance to the next.
     * Level 1: 100 XP
     * Level 2: 200 XP
     * Level 3: 300 XP
     * Level N: N * 100 XP
     */
    getXpNeededForLevel(level) {
        return Math.max(100, level * 100);
    }
    /**
     * Balanced OwO level rewards curve:
     * Level 2: 250 Cowoncy, 1 Lootbox, 1 Crate
     * Level 3: 300 Cowoncy, 1 Lootbox, 1 Crate
     * Level 4: 400 Cowoncy, 1 Lootbox, 1 Crate
     * Level 5: 550 Cowoncy, 2 Lootboxes, 2 Crates (Milestone)
     * Higher levels scale smoothly up without inflating the game economy.
     */
    calculateLevelRewards(level) {
        let cowoncy;
        if (level === 2) {
            cowoncy = 250;
        }
        else if (level === 3) {
            cowoncy = 300;
        }
        else if (level === 4) {
            cowoncy = 400;
        }
        else if (level === 5) {
            cowoncy = 550;
        }
        else {
            // Smooth gentle progression: 200 + 40 * level + 15 * level^1.7, rounded to 25
            cowoncy = Math.round((200 + 40 * level + Math.pow(level, 1.7) * 15) / 25) * 25;
        }
        // Lootboxes: 1 at low levels, +1 on milestone levels (every 5 levels), capped at 5
        const isMilestone = level % 5 === 0;
        const baseLootbox = Math.min(4, Math.max(1, Math.floor(level / 8) + 1));
        const lootboxes = Math.min(5, baseLootbox + (isMilestone ? 1 : 0));
        // Crates: 1 at low levels, milestone bonuses, capped at 4
        const baseCrates = Math.min(3, Math.max(1, Math.floor(level / 10) + 1));
        const crates = Math.min(4, baseCrates + (isMilestone ? 1 : 0));
        return { cowoncy, lootboxes, crates };
    }
    /**
     * Awards XP, checks for level-ups, updates user rewards/stats in database,
     * resets current XP per level (carrying over remainder), and sends a visual Level Up card.
     * Rewards scale per level gained:
     * - Cowoncy: Level 2 -> 250, Level 3 -> 300, Level 4 -> 400... gradual progression
     * - Lootboxes: 1-5 boxes based on level and milestone
     * - Weapon Crates: 1-4 crates based on level and milestone
     * - Max HP: +15 per level
     * - Strength: +3 per level
     * - HP fully restored on level up
     */
    async applyXpAndCheckLevelUp(guild, member, channelId, user, xpGain, additionalUpdates = {}) {
        let currentXp = user.xp + xpGain;
        let finalLevel = user.level;
        let leveledUp = false;
        let totalCowoncyReward = 0;
        let totalLootboxReward = 0;
        let totalCrateReward = 0;
        let hpBoost = 0;
        let strengthBoost = 0;
        let xpNeeded = this.getXpNeededForLevel(finalLevel);
        while (currentXp >= xpNeeded) {
            currentXp -= xpNeeded;
            finalLevel += 1;
            leveledUp = true;
            const rewards = this.calculateLevelRewards(finalLevel);
            totalCowoncyReward += rewards.cowoncy;
            totalLootboxReward += rewards.lootboxes;
            totalCrateReward += rewards.crates;
            hpBoost += 15;
            strengthBoost += 3;
            xpNeeded = this.getXpNeededForLevel(finalLevel);
        }
        const baseMaxHp = additionalUpdates.max_hp ?? user.max_hp;
        const baseStrength = additionalUpdates.strength ?? user.strength;
        const baseCowoncy = additionalUpdates.cowoncy ?? user.cowoncy;
        const baseLootboxes = additionalUpdates.lootboxes ?? user.lootboxes;
        const baseCrates = additionalUpdates.crates ?? user.crates;
        const newMaxHp = baseMaxHp + hpBoost;
        const newStrength = baseStrength + strengthBoost;
        const newHp = leveledUp ? newMaxHp : (additionalUpdates.hp ?? user.hp);
        const newCowoncy = baseCowoncy + totalCowoncyReward;
        const newLootboxes = baseLootboxes + totalLootboxReward;
        const newCrates = baseCrates + totalCrateReward;
        this.db.updateOwoUser(member.user.id, {
            ...additionalUpdates,
            xp: currentXp,
            level: finalLevel,
            hp: newHp,
            max_hp: newMaxHp,
            strength: newStrength,
            cowoncy: newCowoncy,
            lootboxes: newLootboxes,
            crates: newCrates,
        });
        if (leveledUp) {
            await this.sendLevelUpCard(guild, member, channelId, finalLevel, totalCowoncyReward, totalLootboxReward, totalCrateReward);
        }
        return { leveledUp, finalLevel, remainingXp: currentXp };
    }
    async sendLevelUpCard(guild, member, channelId, level, cowoncyReward, lootboxReward, crateReward) {
        try {
            const avatarUrl = await this.resolveAvatarUrl(member.user, member, guild.id);
            const bannerUrl = await this.resolveBannerUrl(member.user, member, guild.id);
            const cardBuffer = await OwoLevelCardGenerator.generateCard({
                username: member.user.username,
                level,
                cowoncyReward,
                lootboxReward,
                crateReward,
                avatarUrl,
                bannerUrl,
            });
            await this.api.sendMessage(channelId, `🎉 | **${member.user.username}** leveled up!`, {
                files: [
                    {
                        name: 'levelup.png',
                        buffer: cardBuffer,
                        contentType: 'image/png',
                    },
                ],
            });
        }
        catch (err) {
            console.error('[OwoService] Error generating/sending level-up card image:', err);
            await this.api.sendMessage(channelId, `🎉 | **${member.user.username}** leveled up! Artık **Seviye ${level}**'sin!\n` +
                `🎁 **Ödüller:** +${cowoncyReward.toLocaleString('tr-TR')} 🪙 Cowoncy | +${lootboxReward} 📦 Lootbox | +${crateReward} 🧰 Silah Sandığı (+15 Max Can, +3 Güç)`);
        }
    }
    async handleCommand(subcommand, args, guild, member, message) {
        const cmd = subcommand.toLowerCase();
        switch (cmd) {
            case 'hunt':
            case 'h':
            case 'av':
                await this.handleHunt(guild, member, message);
                break;
            case 'zoo':
            case 'z':
            case 'hayvanlar':
                await this.handleZoo(guild, member, message);
                break;
            case 'cash':
            case 'money':
            case 'bal':
            case 'c':
            case 'para':
            case 'bakiye':
                await this.handleCash(guild, member, message, args);
                break;
            case 'daily':
            case 'd':
            case 'gunluk':
                await this.handleDaily(guild, member, message);
                break;
            case 'coinflip':
            case 'cf':
            case 'yazitura':
                await this.handleCoinflip(guild, member, message, args);
                break;
            case 'slots':
            case 's':
            case 'slot':
                await this.handleSlots(guild, member, message, args);
                break;
            case 'blackjack':
            case 'bj':
            case '21':
                await this.handleBlackjack(guild, member, message, args);
                break;
            case 'battle':
            case 'b':
            case 'fight':
            case 'savas':
                await this.handleBattle(guild, member, message);
                break;
            case 'pray':
            case 'dua':
                await this.handlePray(guild, member, message, args);
                break;
            case 'curse':
            case 'lanet':
                await this.handleCurse(guild, member, message, args);
                break;
            case 'give':
            case 'send':
            case 'pay':
            case 'gonder':
                await this.handleGive(guild, member, message, args);
                break;
            case 'sell':
            case 'sat':
                await this.handleSell(guild, member, message, args);
                break;
            case 'shop':
            case 'market':
            case 'magaza':
                await this.handleShop(guild, member, message);
                break;
            case 'buy':
            case 'al':
            case 'satinal':
                await this.handleBuy(guild, member, message, args);
                break;
            case 'inv':
            case 'inventory':
            case 'envanter':
                await this.handleInventory(guild, member, message);
                break;
            case 'open':
            case 'crate':
            case 'box':
            case 'ac':
                await this.handleOpen(guild, member, message, args);
                break;
            case 'top':
            case 'lb':
            case 'leaderboard':
            case 'siralamasi':
                await this.handleTop(guild, member, message, args);
                break;
            case 'profile':
            case 'me':
            case 'profil':
            case 'stats':
                await this.handleProfile(guild, member, message, args);
                break;
            case 'cookie':
            case 'kurabiye':
                await this.handleSocial('cookie', guild, member, message, args);
                break;
            case 'hug':
            case 'saril':
                await this.handleSocial('hug', guild, member, message, args);
                break;
            case 'kiss':
            case 'op':
                await this.handleSocial('kiss', guild, member, message, args);
                break;
            case 'slap':
            case 'tokat':
                await this.handleSocial('slap', guild, member, message, args);
                break;
            case 'pat':
            case 'sev':
            case 'oksa':
                await this.handleSocial('pat', guild, member, message, args);
                break;
            case 'quest':
            case 'q':
            case 'gorev':
                await this.handleQuest(guild, member, message, args);
                break;
            case 'team':
            case 'takim':
                await this.handleTeam(guild, member, message, args);
                break;
            case 'zoobattle':
            case 'zb':
            case 'arena':
                await this.handleZooBattle(guild, member, message, args);
                break;
            case 'forge':
            case 'upgrade':
            case 'demirhane':
                await this.handleForge(guild, member, message, args);
                break;
            case 'marry':
            case 'evlen':
                await this.handleMarry(guild, member, message, args);
                break;
            case 'divorce':
            case 'bosan':
                await this.handleDivorce(guild, member, message);
                break;
            case 'remind':
            case 'hatirlat':
                await this.handleRemind(guild, member, message, args);
                break;
            case 'help':
            case 'yardim':
            default:
                await this.handleHelp(guild, member, message);
                break;
        }
    }
    // -------------------------------------------------------------
    // 1. Hunt (Avcılık)
    // -------------------------------------------------------------
    async handleHunt(guild, member, message) {
        const user = this.db.getOwoUser(member.user.id);
        const now = Math.floor(Date.now() / 1000);
        const COOLDOWN = 15; // 15 seconds
        const elapsed = now - user.last_hunt_unix;
        if (elapsed < COOLDOWN) {
            const remaining = COOLDOWN - elapsed;
            await this.sendAutoExpiring(message.channel_id, `⏱️ | **${member.user.username}**, biraz soluklan! **${remaining} saniye** sonra tekrar avlanabilirsin.`, 5, message.id);
            return;
        }
        // Determine how many animals are caught: 1 (70%), 2 (24%), 3 (6%)
        const rollCount = Math.random();
        const count = rollCount < 0.7 ? 1 : rollCount < 0.94 ? 2 : 3;
        const caught = [];
        const hasRing = user.ring === 'lucky_ring';
        for (let i = 0; i < count; i++) {
            const animal = this.rollAnimal(hasRing);
            caught.push(animal);
        }
        // Save caught animals to zoo
        this.db.addOwoAnimals(member.user.id, caught);
        // Calculate XP and Cowoncy gained
        const xpGain = Math.floor(Math.random() * 16) + 10; // 10-25 XP
        const cowoncyGain = Math.floor(Math.random() * 31) + 15; // 15-45 Cowoncy
        // Marriage bonuses: +15% XP and +10% Cowoncy
        let bonusXp = 0;
        let bonusCowoncy = 0;
        if (user.married_to) {
            bonusXp = Math.max(1, Math.floor(xpGain * 0.15));
            bonusCowoncy = Math.max(1, Math.floor(cowoncyGain * 0.10));
        }
        const totalXp = xpGain + bonusXp;
        const totalCowoncy = cowoncyGain + bonusCowoncy;
        const caughtLines = caught
            .map((a) => `> ${a.emoji} **${a.name}** (${TIER_COLORS[a.tier]})`)
            .join('\n');
        const bonusTag = bonusXp > 0 ? ` *(💍 +${bonusXp} XP, +${bonusCowoncy} Cowoncy Evlilik Bonusu)*` : '';
        const reply = `🌿 | **${member.user.username}**, çalılıklarda gizlice avlandın ve yakaladın:\n${caughtLines}\n⭐ **+${totalXp}** XP | 🪙 **+${totalCowoncy}** Cowoncy${bonusTag}`;
        await this.api.sendMessage(message.channel_id, reply);
        await this.applyXpAndCheckLevelUp(guild, member, message.channel_id, user, totalXp, {
            cowoncy: user.cowoncy + totalCowoncy,
            last_hunt_unix: now,
            total_hunts: user.total_hunts + 1,
        });
        await this.progressQuest(guild, member, message.channel_id, 'hunt', 1);
    }
    rollAnimal(luckyRing) {
        const roll = Math.random();
        let tier;
        if (luckyRing) {
            if (roll < 0.015)
                tier = 'legendary';
            else if (roll < 0.06)
                tier = 'mythical';
            else if (roll < 0.16)
                tier = 'epic';
            else if (roll < 0.33)
                tier = 'rare';
            else if (roll < 0.60)
                tier = 'uncommon';
            else
                tier = 'common';
        }
        else {
            if (roll < 0.008)
                tier = 'legendary';
            else if (roll < 0.04)
                tier = 'mythical';
            else if (roll < 0.11)
                tier = 'epic';
            else if (roll < 0.24)
                tier = 'rare';
            else if (roll < 0.50)
                tier = 'uncommon';
            else
                tier = 'common';
        }
        const filtered = ANIMALS.filter((a) => a.tier === tier);
        return filtered[Math.floor(Math.random() * filtered.length)];
    }
    // -------------------------------------------------------------
    // 2. Zoo (Hayvanat Bahçesi)
    // -------------------------------------------------------------
    async handleZoo(guild, member, message) {
        const zoo = this.db.getOwoZoo(member.user.id);
        if (zoo.length === 0) {
            await this.api.sendMessage(message.channel_id, `🐾 | **${member.user.username}**, hayvanat bahçen bomboş! Çalılıklarda hayvan yakalamak için \`/w hunt\` yaz.`);
            return;
        }
        const tiers = ['legendary', 'mythical', 'epic', 'rare', 'uncommon', 'common'];
        const lines = [
            `🐾 **${member.user.username}** Kullanıcısının Hayvanat Bahçesi:`,
            '────────────────────────────────────────',
        ];
        let totalAnimals = 0;
        let totalWorth = 0;
        for (const t of tiers) {
            const inTier = zoo.filter((z) => z.tier === t);
            if (inTier.length > 0) {
                const countInTier = inTier.reduce((sum, item) => sum + item.count, 0);
                totalAnimals += countInTier;
                const animalItems = inTier.map((item) => {
                    totalWorth += item.count * (this.animalPriceMap[item.animal_id] || 15);
                    return `${item.animal_name} x${item.count}`;
                });
                lines.push(`**${TIER_COLORS[t]} [${countInTier}]:** ${animalItems.join(', ')}`);
            }
        }
        lines.push('────────────────────────────────────────');
        lines.push(`📊 Toplam: **${totalAnimals}** Hayvan | Tahmini Değer: **${totalWorth.toLocaleString('tr-TR')}** 🪙`);
        lines.push('💡 Hayvanlarını satmak için: `/w sell all` veya `/w sell common`');
        await this.api.sendMessage(message.channel_id, lines.join('\n'));
    }
    // -------------------------------------------------------------
    // 3. Cash / Balance
    // -------------------------------------------------------------
    async handleCash(guild, member, message, args) {
        let targetUser = member.user;
        if (args.length > 0) {
            const foundMember = await this.resolveMember(guild, args[0], message);
            if (foundMember) {
                targetUser = foundMember.user;
            }
        }
        const user = this.db.getOwoUser(targetUser.id);
        await this.api.sendMessage(message.channel_id, `👛 | **${targetUser.username}**, şu an cebinde **${user.cowoncy.toLocaleString('tr-TR')}** 🪙 Cowoncy var!`);
    }
    // -------------------------------------------------------------
    // 4. Daily Reward
    // -------------------------------------------------------------
    async handleDaily(guild, member, message) {
        const user = this.db.getOwoUser(member.user.id);
        const now = Math.floor(Date.now() / 1000);
        const DAY_SECONDS = 86400;
        const elapsed = now - user.last_daily_unix;
        if (elapsed < DAY_SECONDS) {
            const remainingSec = DAY_SECONDS - elapsed;
            const hours = Math.floor(remainingSec / 3600);
            const minutes = Math.floor((remainingSec % 3600) / 60);
            await this.sendAutoExpiring(message.channel_id, `📅 | **${member.user.username}**, günlük ödülünü zaten aldın! Sonraki ödül için **${hours} saat ${minutes} dakika** beklemelisin.`, 6, message.id);
            return;
        }
        // Calculate streak and gradual rewards starting from 500
        let streak = user.daily_streak;
        if (elapsed <= DAY_SECONDS * 2) {
            streak += 1;
        }
        else {
            streak = 1;
        }
        const baseReward = 500;
        const streakBonus = Math.min((streak - 1) * 50, 1500);
        const levelBonus = Math.floor(Math.max(0, (user.level || 1) - 1) * 10);
        const totalReward = baseReward + streakBonus + levelBonus;
        const newBalance = user.cowoncy + totalReward;
        await this.api.sendMessage(message.channel_id, `📅 | **${member.user.username}**, günlük ödülünü aldın! **+${totalReward.toLocaleString('tr-TR')}** 🪙 Cowoncy!\n` +
            `🔥 Günlük Seri: **${streak} gün** *(Başlangıç: 500 🪙 + Seri Bonusu: ${streakBonus} 🪙${levelBonus > 0 ? ` + Seviye Bonusu: ${levelBonus} 🪙` : ''})*\n` +
            `💰 Yeni Bakiye: **${newBalance.toLocaleString('tr-TR')}** 🪙`);
        await this.applyXpAndCheckLevelUp(guild, member, message.channel_id, user, 25, {
            cowoncy: newBalance,
            last_daily_unix: now,
            daily_streak: streak,
            last_guild_id: guild.id,
            last_guild_name: guild.name,
        });
        this.remindedUsers.delete(member.user.id);
    }
    // -------------------------------------------------------------
    // 5. Coinflip (Yazı Tura)
    // -------------------------------------------------------------
    async handleCoinflip(guild, member, message, args) {
        const user = this.db.getOwoUser(member.user.id);
        if (args.length === 0) {
            await this.api.sendMessage(message.channel_id, '🪙 | Kullanım: `/w cf <miktar> [y/t]` (Örn: `/w cf 500 y` veya `/w cf all t`)');
            return;
        }
        let bet = 0;
        const rawAmount = args[0].toLowerCase();
        if (rawAmount === 'all' || rawAmount === 'allin' || rawAmount === 'hepsi') {
            bet = user.cowoncy;
        }
        else {
            bet = Number.parseInt(rawAmount, 10);
        }
        if (Number.isNaN(bet) || bet <= 0) {
            await this.sendAutoExpiring(message.channel_id, '❌ Geçersiz bahis miktarı!', 6, message.id);
            return;
        }
        if (bet > user.cowoncy) {
            await this.sendAutoExpiring(message.channel_id, `❌ Yetersiz bakiye! Cebinde sadece **${user.cowoncy.toLocaleString('tr-TR')}** 🪙 Cowoncy var.`, 6, message.id);
            return;
        }
        if (bet > this.MAX_GAMBLE_BET) {
            bet = this.MAX_GAMBLE_BET;
        }
        const cooldownMsg = this.checkGamblingCooldown(member.user.id, member.user.username);
        if (cooldownMsg) {
            await this.sendAutoExpiring(message.channel_id, cooldownMsg, 6, message.id);
            return;
        }
        const choice = (args[1] || 'y').toLowerCase();
        const isHeads = ['y', 'yazi', 'yazı', 'h', 'heads'].includes(choice);
        // Roll coin
        const hasRing = user.ring === 'lucky_ring';
        const winThreshold = hasRing ? 0.52 : 0.50;
        const win = Math.random() < winThreshold;
        const coinResult = win ? (isHeads ? 'Yazı' : 'Tura') : (isHeads ? 'Tura' : 'Yazı');
        if (win) {
            const newBal = user.cowoncy + bet;
            this.db.updateOwoUser(member.user.id, { cowoncy: newBal });
            await this.api.sendMessage(message.channel_id, `🪙 | **${member.user.username}** parayı fırlattı... **${coinResult}** geldi!\n🎉 Kazandın! **+${bet.toLocaleString('tr-TR')}** 🪙 Cowoncy! (Bakiye: **${newBal.toLocaleString('tr-TR')}** 🪙)`);
            await this.progressQuest(guild, member, message.channel_id, 'cf_win', 1);
        }
        else {
            const newBal = Math.max(0, user.cowoncy - bet);
            this.db.updateOwoUser(member.user.id, { cowoncy: newBal });
            await this.api.sendMessage(message.channel_id, `🪙 | **${member.user.username}** parayı fırlattı... **${coinResult}** geldi!\n😢 Kaybettin... **-${bet.toLocaleString('tr-TR')}** 🪙 Cowoncy. (Kalan: **${newBal.toLocaleString('tr-TR')}** 🪙)`);
        }
    }
    // -------------------------------------------------------------
    // 6. Slots (Slot Makinesi)
    // -------------------------------------------------------------
    async handleSlots(guild, member, message, args) {
        const user = this.db.getOwoUser(member.user.id);
        if (args.length === 0) {
            await this.api.sendMessage(message.channel_id, '🎰 | Kullanım: `/w slots <miktar>` (Örn: `/w slots 100` veya `/w s all`)');
            return;
        }
        let bet = 0;
        const rawAmount = args[0].toLowerCase();
        if (rawAmount === 'all' || rawAmount === 'allin') {
            bet = user.cowoncy;
        }
        else {
            bet = Number.parseInt(rawAmount, 10);
        }
        if (Number.isNaN(bet) || bet <= 0) {
            await this.sendAutoExpiring(message.channel_id, '❌ Geçersiz bahis miktarı!', 6, message.id);
            return;
        }
        if (bet > user.cowoncy) {
            await this.sendAutoExpiring(message.channel_id, `❌ Yetersiz bakiye! Cebinde sadece **${user.cowoncy.toLocaleString('tr-TR')}** 🪙 Cowoncy var.`, 6, message.id);
            return;
        }
        if (bet > this.MAX_GAMBLE_BET) {
            bet = this.MAX_GAMBLE_BET;
        }
        const cooldownMsg = this.checkGamblingCooldown(member.user.id, member.user.username);
        if (cooldownMsg) {
            await this.sendAutoExpiring(message.channel_id, cooldownMsg, 6, message.id);
            return;
        }
        // Slot symbols and weights
        const symbols = ['🍇', '🍒', '🍋', '🍉', '💎', '7️⃣'];
        const pickSymbol = () => {
            const r = Math.random();
            if (r < 0.04)
                return '7️⃣';
            if (r < 0.12)
                return '💎';
            if (r < 0.32)
                return '🍉';
            if (r < 0.54)
                return '🍋';
            if (r < 0.77)
                return '🍒';
            return '🍇';
        };
        const s1 = pickSymbol();
        const s2 = pickSymbol();
        const s3 = pickSymbol();
        let multiplier = 0;
        let messageOutcome = '';
        if (s1 === '7️⃣' && s2 === '7️⃣' && s3 === '7️⃣') {
            multiplier = 10;
            messageOutcome = '💥 **MEGA JACKPOT (777)!**';
        }
        else if (s1 === '💎' && s2 === '💎' && s3 === '💎') {
            multiplier = 7;
            messageOutcome = '💎 **ELMAS BÜYÜK İKRAMİYE!**';
        }
        else if (s1 === s2 && s2 === s3) {
            multiplier = 4;
            messageOutcome = '🎉 **ÜÇLÜ EŞLEŞME!**';
        }
        else if (s1 === s2 || s2 === s3 || s1 === s3) {
            multiplier = 1.5;
            messageOutcome = '✨ **İKİLİ EŞLEŞME!**';
        }
        else {
            multiplier = 0;
            messageOutcome = '😢 Hiç eşleşme yok...';
        }
        const won = multiplier > 0;
        const profit = won ? Math.floor(bet * multiplier) - bet : -bet;
        const newBal = Math.max(0, user.cowoncy + profit);
        this.db.updateOwoUser(member.user.id, { cowoncy: newBal });
        const reply = [
            `🎰 | **${member.user.username}** kollu kumar makinesini çevirdi!`,
            '  ╭───────────────╮',
            `  │  ${s1}  │  ${s2}  │  ${s3}  │`,
            '  ╰───────────────╯',
            `${messageOutcome} ${won ? `**+${profit.toLocaleString('tr-TR')}** 🪙 Cowoncy kazandın!` : `**-${bet.toLocaleString('tr-TR')}** 🪙 Cowoncy kaybettin.`}`,
            `👛 Yeni Bakiye: **${newBal.toLocaleString('tr-TR')}** 🪙`,
        ].join('\n');
        await this.api.sendMessage(message.channel_id, reply);
        await this.progressQuest(guild, member, message.channel_id, 'slots', 1);
    }
    // -------------------------------------------------------------
    // 7. Blackjack (21)
    // -------------------------------------------------------------
    async handleBlackjack(guild, member, message, args) {
        if (this.activeBlackjacks.has(member.user.id)) {
            await this.api.sendMessage(message.channel_id, `❌ **${member.user.username}**, zaten devam eden bir Blackjack oyunun var! Lütfen \`hit\` veya \`stand\` yazarak elini tamamla.`);
            return;
        }
        const user = this.db.getOwoUser(member.user.id);
        if (args.length === 0) {
            await this.api.sendMessage(message.channel_id, '🃏 | Kullanım: `/w bj <miktar>` (Örn: `/w bj 100` veya `/w bj all`)');
            return;
        }
        let bet = 0;
        const rawAmount = args[0].toLowerCase();
        if (rawAmount === 'all' || rawAmount === 'allin' || rawAmount === 'hepsi') {
            bet = user.cowoncy;
        }
        else {
            bet = Number.parseInt(rawAmount, 10);
        }
        if (Number.isNaN(bet) || bet <= 0) {
            await this.sendAutoExpiring(message.channel_id, '❌ Geçersiz bahis miktarı!', 6, message.id);
            return;
        }
        if (bet > user.cowoncy) {
            await this.sendAutoExpiring(message.channel_id, `❌ Yetersiz bakiye! Cebinde sadece **${user.cowoncy.toLocaleString('tr-TR')}** 🪙 Cowoncy var.`, 6, message.id);
            return;
        }
        if (bet > this.MAX_GAMBLE_BET) {
            bet = this.MAX_GAMBLE_BET;
        }
        const cooldownMsg = this.checkGamblingCooldown(member.user.id, member.user.username);
        if (cooldownMsg) {
            await this.sendAutoExpiring(message.channel_id, cooldownMsg, 6, message.id);
            return;
        }
        // ESCROW: Deduct bet immediately at game start to prevent double-spending / zero-loss exploit
        const escrowBalance = user.cowoncy - bet;
        this.db.updateOwoUser(member.user.id, { cowoncy: escrowBalance });
        const drawCard = () => {
            const suits = ['♠', '♥', '♦', '♣'];
            const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
            const suit = suits[Math.floor(Math.random() * suits.length)];
            const val = values[Math.floor(Math.random() * values.length)];
            return `${val}${suit}`;
        };
        const playerCards = [drawCard(), drawCard()];
        const dealerCards = [drawCard(), drawCard()];
        const playerTotal = this.calculateHand(playerCards);
        const dealerTotal = this.calculateHand(dealerCards);
        // Natural 21 (Blackjack) check
        if (playerTotal === 21) {
            const winProfit = Math.floor(bet * 1.5);
            const totalPayout = bet + winProfit;
            const newBal = escrowBalance + totalPayout;
            this.db.updateOwoUser(member.user.id, { cowoncy: newBal });
            await this.api.sendMessage(message.channel_id, `🃏 **DOĞAL BLACKJACK (21)!** | **${member.user.username}**\n> 🧑 Senin Elin: [ ${playerCards.join(' ')} ] (**21**)\n> 🤖 Krupiye: [ ${dealerCards.join(' ')} ] (**${dealerTotal}**)\n🎉 **+${winProfit.toLocaleString('tr-TR')}** 🪙 Cowoncy kazandın! (Bakiye: **${newBal.toLocaleString('tr-TR')}** 🪙)`);
            return;
        }
        // Save active game with escrowed bet
        this.activeBlackjacks.set(member.user.id, {
            userId: member.user.id,
            channelId: message.channel_id,
            guildId: guild.id,
            bet,
            playerCards,
            dealerCards,
            startTime: Date.now(),
        });
        await this.api.sendMessage(message.channel_id, `🃏 **BLACKJACK (21)** | **${member.user.username}**\n> 🧑 Senin Elin: [ ${playerCards.join(' ')} ] (Toplam: **${playerTotal}**)\n> 🤖 Krupiye: [ ${dealerCards[0]} 🂠 ]\n💡 Devam etmek için: \`hit\` (kart çek) veya \`stand\` (kal) yaz!`);
    }
    async stepBlackjack(guild, member, message, action) {
        const game = this.activeBlackjacks.get(member.user.id);
        if (!game)
            return;
        const user = this.db.getOwoUser(member.user.id);
        const drawCard = () => {
            const suits = ['♠', '♥', '♦', '♣'];
            const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
            const suit = suits[Math.floor(Math.random() * suits.length)];
            const val = values[Math.floor(Math.random() * values.length)];
            return `${val}${suit}`;
        };
        if (action === 'hit') {
            const newCard = drawCard();
            game.playerCards.push(newCard);
            const total = this.calculateHand(game.playerCards);
            if (total > 21) {
                // Player busted
                this.activeBlackjacks.delete(member.user.id);
                const currentBal = this.db.getOwoUser(member.user.id).cowoncy;
                await this.api.sendMessage(message.channel_id, `💥 **BUSTED! 21'i aştın!** | **${member.user.username}**\n> 🧑 Senin Elin: [ ${game.playerCards.join(' ')} ] (Toplam: **${total}**)\n😢 **-${game.bet.toLocaleString('tr-TR')}** 🪙 Cowoncy kaybettin. (Kalan: **${currentBal.toLocaleString('tr-TR')}** 🪙)`);
                return;
            }
            if (total === 21) {
                // Automatically stand on 21
                action = 'stand';
            }
            else {
                await this.api.sendMessage(message.channel_id, `🃏 | **${member.user.username}** bir kart çekti: ${newCard}\n> 🧑 Elin: [ ${game.playerCards.join(' ')} ] (Toplam: **${total}**)\n💡 \`hit\` veya \`stand\` yaz!`);
                return;
            }
        }
        if (action === 'stand') {
            this.activeBlackjacks.delete(member.user.id);
            // Dealer plays (hits until >= 17)
            while (this.calculateHand(game.dealerCards) < 17) {
                game.dealerCards.push(drawCard());
            }
            const playerTotal = this.calculateHand(game.playerCards);
            const dealerTotal = this.calculateHand(game.dealerCards);
            const lines = [
                `🃏 **BLACKJACK SONUCU** | **${member.user.username}**`,
                `> 🧑 Senin Elin: [ ${game.playerCards.join(' ')} ] (Toplam: **${playerTotal}**)`,
                `> 🤖 Krupiye: [ ${game.dealerCards.join(' ')} ] (Toplam: **${dealerTotal}**)`,
            ];
            const currentUser = this.db.getOwoUser(member.user.id);
            if (dealerTotal > 21 || playerTotal > dealerTotal) {
                // Player wins -> payout 2x bet (refund + 1x win)
                const newBal = currentUser.cowoncy + (game.bet * 2);
                this.db.updateOwoUser(member.user.id, { cowoncy: newBal });
                lines.push(`🎉 **KAZANDIN!** +**${game.bet.toLocaleString('tr-TR')}** 🪙 Cowoncy! (Bakiye: **${newBal.toLocaleString('tr-TR')}** 🪙)`);
            }
            else if (playerTotal === dealerTotal) {
                // Push -> refund 1x bet
                const newBal = currentUser.cowoncy + game.bet;
                this.db.updateOwoUser(member.user.id, { cowoncy: newBal });
                lines.push(`🤝 **BERABERE (PUSH)!** Paran iade edildi. (Bakiye: **${newBal.toLocaleString('tr-TR')}** 🪙)`);
            }
            else {
                // Dealer wins -> bet was already deducted at start
                lines.push(`😢 **KAYBETTİN...** Krupiye kazandı. -**${game.bet.toLocaleString('tr-TR')}** 🪙 Cowoncy. (Kalan: **${currentUser.cowoncy.toLocaleString('tr-TR')}** 🪙)`);
            }
            await this.api.sendMessage(message.channel_id, lines.join('\n'));
        }
    }
    async autoStandTimeoutBlackjack(game) {
        const drawCard = () => {
            const suits = ['♠', '♥', '♦', '♣'];
            const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
            const suit = suits[Math.floor(Math.random() * suits.length)];
            const val = values[Math.floor(Math.random() * values.length)];
            return `${val}${suit}`;
        };
        while (this.calculateHand(game.dealerCards) < 17) {
            game.dealerCards.push(drawCard());
        }
        const playerTotal = this.calculateHand(game.playerCards);
        const dealerTotal = this.calculateHand(game.dealerCards);
        const user = this.db.getOwoUser(game.userId);
        const lines = [
            `⏰ **BLACKJACK ZAMAN AŞIMI (60s)** | Oyuncu hareketsiz kaldığı için otomatik \`stand\` yapıldı.`,
            `> 🧑 Oyuncu Eli: [ ${game.playerCards.join(' ')} ] (Toplam: **${playerTotal}**)`,
            `> 🤖 Krupiye: [ ${game.dealerCards.join(' ')} ] (Toplam: **${dealerTotal}**)`,
        ];
        if (dealerTotal > 21 || playerTotal > dealerTotal) {
            const newBal = user.cowoncy + (game.bet * 2);
            this.db.updateOwoUser(game.userId, { cowoncy: newBal });
            lines.push(`🎉 **KAZANDIN!** +**${game.bet.toLocaleString('tr-TR')}** 🪙 Cowoncy! (Bakiye: **${newBal.toLocaleString('tr-TR')}** 🪙)`);
        }
        else if (playerTotal === dealerTotal) {
            const newBal = user.cowoncy + game.bet;
            this.db.updateOwoUser(game.userId, { cowoncy: newBal });
            lines.push(`🤝 **BERABERE (PUSH)!** Bahsin iade edildi. (Bakiye: **${newBal.toLocaleString('tr-TR')}** 🪙)`);
        }
        else {
            lines.push(`😢 **KAYBETTİN...** Krupiye kazandı. -**${game.bet.toLocaleString('tr-TR')}** 🪙 Cowoncy. (Kalan: **${user.cowoncy.toLocaleString('tr-TR')}** 🪙)`);
        }
        await this.api.sendMessage(game.channelId, lines.join('\n'));
    }
    calculateHand(cards) {
        let total = 0;
        let aces = 0;
        for (const card of cards) {
            const val = card.slice(0, -1);
            if (['J', 'Q', 'K'].includes(val)) {
                total += 10;
            }
            else if (val === 'A') {
                aces += 1;
                total += 11;
            }
            else {
                total += Number.parseInt(val, 10);
            }
        }
        while (total > 21 && aces > 0) {
            total -= 10;
            aces -= 1;
        }
        return total;
    }
    // -------------------------------------------------------------
    // 8. Battle (Canavarlarla Savaş)
    // -------------------------------------------------------------
    async handleBattle(guild, member, message) {
        const user = this.db.getOwoUser(member.user.id);
        const now = Math.floor(Date.now() / 1000);
        const COOLDOWN = 20;
        const elapsed = now - user.last_battle_unix;
        if (elapsed < COOLDOWN) {
            const remaining = COOLDOWN - elapsed;
            await this.sendAutoExpiring(message.channel_id, `⚔️ | **${member.user.username}**, savaş yaralarını sarıyorsun! **${remaining} saniye** sonra tekrar savaşabilirsin.`, 5, message.id);
            return;
        }
        // Select monster based on player level
        const maxMonsterIdx = Math.min(user.level - 1, MONSTERS.length - 1);
        const monster = MONSTERS[Math.floor(Math.random() * (maxMonsterIdx + 1))];
        // Compute player power
        const weaponDef = WEAPONS[user.weapon] || WEAPONS.punch;
        const zoo = this.db.getOwoZoo(member.user.id);
        // Zoo bonuses: Epic (+1), Mythical (+3), Legendary (+8)
        let zooBonus = 0;
        for (const z of zoo) {
            if (z.tier === 'epic')
                zooBonus += z.count * 1;
            if (z.tier === 'mythical')
                zooBonus += z.count * 3;
            if (z.tier === 'legendary')
                zooBonus += z.count * 8;
        }
        const totalStrength = user.strength + weaponDef.bonusStrength + (user.weapon_level || 0) * 5 + zooBonus;
        let playerHp = user.max_hp;
        let monsterHp = monster.hp;
        // Simulate turns
        let rounds = 0;
        while (playerHp > 0 && monsterHp > 0 && rounds < 10) {
            rounds++;
            // Player attacks
            const crit = Math.random() < 0.2;
            const playerDmg = Math.floor(totalStrength * (crit ? 1.6 : 1.0) * (0.8 + Math.random() * 0.4));
            monsterHp -= playerDmg;
            if (monsterHp <= 0)
                break;
            // Monster attacks
            const monsterDmg = Math.floor(monster.strength * (0.8 + Math.random() * 0.4));
            playerHp -= monsterDmg;
        }
        const victory = playerHp > 0 && monsterHp <= 0;
        if (victory) {
            const [minC, maxC] = monster.cowoncyReward;
            const cowoncyReward = Math.floor(Math.random() * (maxC - minC + 1)) + minC;
            const xpReward = monster.xpReward;
            // Drop chance for lootbox (25%) or weapon crate (10%)
            const rollDrop = Math.random();
            let dropText = '';
            let lootboxInc = 0;
            let crateInc = 0;
            if (rollDrop < 0.10) {
                crateInc = 1;
                dropText = '\n🎁 **Nadir Eşya:** Canavarın ininden bir **Silah Sandığı** ele geçirdin!';
            }
            else if (rollDrop < 0.35) {
                lootboxInc = 1;
                dropText = '\n📦 **Ödül:** Bir **Gizemli Lootbox** buldun!';
            }
            const weaponDisplayName = user.weapon_level > 0 ? `+${user.weapon_level} ${weaponDef.name}` : weaponDef.name;
            const reply = `⚔️ | **${member.user.username}** [${weaponDef.emoji} ${weaponDisplayName}], **${monster.emoji} ${monster.name}** ile karşılaştı ve zafer kazandı!\n🏆 **+${xpReward}** XP | 🪙 **+${cowoncyReward.toLocaleString('tr-TR')}** Cowoncy${dropText}`;
            await this.api.sendMessage(message.channel_id, reply);
            await this.applyXpAndCheckLevelUp(guild, member, message.channel_id, user, xpReward, {
                cowoncy: user.cowoncy + cowoncyReward,
                last_battle_unix: now,
                total_battles: user.total_battles + 1,
                battles_won: user.battles_won + 1,
                crates: user.crates + crateInc,
                lootboxes: user.lootboxes + lootboxInc,
            });
        }
        else {
            await this.api.sendMessage(message.channel_id, `⚔️ | **${member.user.username}**, **${monster.emoji} ${monster.name}** karşısında ağır darbe aldı ve geri çekilmek zorunda kaldı...\n⭐ Teselli ödülü: **+5 XP**`);
            await this.applyXpAndCheckLevelUp(guild, member, message.channel_id, user, 5, {
                last_battle_unix: now,
                total_battles: user.total_battles + 1,
            });
        }
        await this.progressQuest(guild, member, message.channel_id, 'battle', 1);
    }
    // -------------------------------------------------------------
    // 9. Pray & Curse (Dua & Lanet)
    // -------------------------------------------------------------
    async handlePray(guild, member, message, args) {
        const user = this.db.getOwoUser(member.user.id);
        const now = Math.floor(Date.now() / 1000);
        const COOLDOWN = 300; // 5 mins
        const elapsed = now - user.last_pray_unix;
        if (elapsed < COOLDOWN) {
            const remainingMin = Math.ceil((COOLDOWN - elapsed) / 60);
            await this.sendAutoExpiring(message.channel_id, `🙏 | **${member.user.username}**, biraz önce dua ettin! **${remainingMin} dakika** sonra tekrar dua edebilirsin.`, 5, message.id);
            return;
        }
        let targetName = member.user.username;
        if (args.length > 0) {
            const resolved = await this.resolveMember(guild, args[0], message);
            targetName = resolved ? resolved.user.username : args.join(' ').replace(/[<@!>]/g, '');
        }
        const reward = Math.floor(Math.random() * 101) + 50; // 50 - 150 cowoncy
        await this.api.sendMessage(message.channel_id, `🙏 | **${member.user.username}**, **${targetName}** için içtenlikle dua etti! Tanrılar bu duayı duydu ve **+${reward}** 🪙 Cowoncy lütfetti. (Toplam Dua: **${user.pray_count + 1}**)`);
        await this.applyXpAndCheckLevelUp(guild, member, message.channel_id, user, 10, {
            cowoncy: user.cowoncy + reward,
            pray_count: user.pray_count + 1,
            last_pray_unix: now,
        });
        await this.progressQuest(guild, member, message.channel_id, 'pray', 1);
    }
    async handleCurse(guild, member, message, args) {
        const user = this.db.getOwoUser(member.user.id);
        const now = Math.floor(Date.now() / 1000);
        const COOLDOWN = 300; // 5 mins
        const elapsed = now - user.last_pray_unix;
        if (elapsed < COOLDOWN) {
            const remainingMin = Math.ceil((COOLDOWN - elapsed) / 60);
            await this.sendAutoExpiring(message.channel_id, `😈 | **${member.user.username}**, kara büyü enerjin tükenmiş! **${remainingMin} dakika** sonra tekrar lanetleyebilirsin.`, 5, message.id);
            return;
        }
        let targetName = 'düşmanlarını';
        if (args.length > 0) {
            const resolved = await this.resolveMember(guild, args[0], message);
            targetName = resolved ? resolved.user.username : args.join(' ').replace(/[<@!>]/g, '');
        }
        await this.api.sendMessage(message.channel_id, `😈 | **${member.user.username}**, karanlık güçleri çağırarak **${targetName}** üzerine uğursuz bir lanet okudu! 👻 (Toplam Lanet: **${user.curse_count + 1}**)`);
        await this.applyXpAndCheckLevelUp(guild, member, message.channel_id, user, 10, {
            curse_count: user.curse_count + 1,
            last_pray_unix: now,
        });
        await this.progressQuest(guild, member, message.channel_id, 'pray', 1);
    }
    // -------------------------------------------------------------
    // 10. Give / Send Cowoncy
    // -------------------------------------------------------------
    async handleGive(guild, member, message, args) {
        if (args.length === 0) {
            await this.api.sendMessage(message.channel_id, '💸 | Kullanım: `/w give cash @kullanıcı <miktar>` veya `/w give @kullanıcı <miktar>`\nÖrnekler:\n• `/w give cash @BatuneX 218`\n• `/w give @BatuneX 218`\n• `/w give @BatuneX all`');
            return;
        }
        // Filter out common filler keywords like 'cash', 'cowoncy', 'para', 'coin', 'coins'
        const filteredTokens = [];
        for (const a of args) {
            const lower = a.toLowerCase();
            if (!['cash', 'cowoncy', 'para', 'coin', 'coins'].includes(lower)) {
                filteredTokens.push(a);
            }
        }
        if (filteredTokens.length === 0) {
            await this.api.sendMessage(message.channel_id, '💸 | Kullanım: `/w give cash @kullanıcı <miktar>` (Örn: `/w give cash @BatuneX 218` veya `/w give @BatuneX 218`)');
            return;
        }
        // Amount detector regex: matches 'all', 'hepsi', or numbers like '218', '5k', '2m'
        const isAmount = (s) => /^(all|hepsi|\d+(\.\d+)?[km]?)$/i.test(s.trim());
        let targetRaw;
        let amountRaw;
        if (filteredTokens.length === 1) {
            if (isAmount(filteredTokens[0])) {
                amountRaw = filteredTokens[0];
            }
            else {
                targetRaw = filteredTokens[0];
            }
        }
        else {
            // Find the index of the amount token
            const amountIdx = filteredTokens.findIndex(isAmount);
            if (amountIdx !== -1) {
                amountRaw = filteredTokens[amountIdx];
                const remaining = filteredTokens.filter((_, idx) => idx !== amountIdx);
                targetRaw = remaining.join(' ');
            }
            else {
                targetRaw = filteredTokens[0];
                amountRaw = filteredTokens.slice(1).join(' ');
            }
        }
        if (!targetRaw) {
            await this.api.sendMessage(message.channel_id, '❌ Lütfen Cowoncy göndermek istediğiniz kullanıcıyı etiketleyin veya adını yazın! (Örn: `/w give cash @kullanıcı 218`)');
            return;
        }
        if (!amountRaw) {
            await this.api.sendMessage(message.channel_id, '❌ Lütfen göndermek istediğiniz Cowoncy miktarını belirtin! (Örn: `/w give cash @BatuneX 218` veya `/w give @BatuneX all`)');
            return;
        }
        const targetMember = await this.resolveMember(guild, targetRaw, message);
        if (!targetMember) {
            await this.api.sendMessage(message.channel_id, `❌ Gönderilecek kullanıcı bulunamadı! (\`${targetRaw}\`)\nLütfen kullanıcıyı etiketleyin (@kullanıcı) veya tam kullanıcı adını yazın.`);
            return;
        }
        if (targetMember.user.id === member.user.id) {
            await this.api.sendMessage(message.channel_id, '❌ Kendine Cowoncy gönderemezsin!');
            return;
        }
        if (targetMember.user.bot) {
            await this.api.sendMessage(message.channel_id, '❌ Botlara Cowoncy gönderemezsin!');
            return;
        }
        const user = this.db.getOwoUser(member.user.id);
        let amount = 0;
        const lowerAmount = amountRaw.toLowerCase().trim();
        if (lowerAmount === 'all' || lowerAmount === 'hepsi') {
            amount = user.cowoncy;
        }
        else if (lowerAmount.endsWith('k')) {
            const val = Number.parseFloat(lowerAmount.slice(0, -1));
            amount = Math.floor(val * 1000);
        }
        else if (lowerAmount.endsWith('m')) {
            const val = Number.parseFloat(lowerAmount.slice(0, -1));
            amount = Math.floor(val * 1000000);
        }
        else {
            amount = Number.parseInt(lowerAmount, 10);
        }
        if (Number.isNaN(amount) || amount <= 0) {
            await this.api.sendMessage(message.channel_id, '❌ Geçersiz miktar! Lütfen 0\'dan büyük bir sayı girin (Örn: `218`, `5k`, `all`).');
            return;
        }
        if (amount > this.MAX_GIVE_AMOUNT) {
            amount = this.MAX_GIVE_AMOUNT;
        }
        const result = this.db.transferOwoCowoncy(member.user.id, targetMember.user.id, amount);
        if (!result.success) {
            if (result.error === 'INSUFFICIENT_FUNDS') {
                await this.api.sendMessage(message.channel_id, `❌ Yetersiz bakiye! Cebinde sadece **${result.senderBalance.toLocaleString('tr-TR')}** 🪙 Cowoncy var.`);
            }
            else {
                await this.api.sendMessage(message.channel_id, `❌ Transfer gerçekleştirilemedi: ${result.error || 'Bilinmeyen hata'}`);
            }
            return;
        }
        await this.api.sendMessage(message.channel_id, `💸 | **${member.user.username}**, **${targetMember.user.username}** kullanıcısına **${amount.toLocaleString('tr-TR')}** 🪙 Cowoncy gönderdi!\n👛 Kalan bakiyen: **${result.senderBalance.toLocaleString('tr-TR')}** 🪙`);
    }
    // -------------------------------------------------------------
    // 11. Sell Animals
    // -------------------------------------------------------------
    async handleSell(guild, member, message, args) {
        if (args.length === 0) {
            await this.api.sendMessage(message.channel_id, '💰 | Kullanım: `/w sell all` veya `/w sell <tier/hayvan>` (Örn: `/w sell common`, `/w sell all`, `/w sell dog`)');
            return;
        }
        const filter = args.join(' ');
        const result = this.db.sellOwoAnimals(member.user.id, filter, this.animalPriceMap);
        await this.api.sendMessage(message.channel_id, `💰 | **${member.user.username}**, ${result.details}`);
    }
    // -------------------------------------------------------------
    // 12. Shop, Buy, Inventory, Open
    // -------------------------------------------------------------
    async handleShop(guild, member, message) {
        const lines = [
            '🛒 **OWO MAĞAZASI (SHOP)**',
            '────────────────────────────────────────',
            '📦 **Lootbox** — `500` 🪙 Cowoncy',
            '  └ *İçinden rastgele 200 - 1,500 Cowoncy ve 1 hayvan çıkar.* (Satın al: `/w buy lootbox`)',
            '',
            '🎁 **Silah Sandığı (Crate)** — `1,500` 🪙 Cowoncy',
            '  └ *Savaş gücünü artıran efsanevi silahlar içerir.* (Satın al: `/w buy crate`)',
            '',
            '💍 **Şans Yüzüğü (Ring)** — `5,000` 🪙 Cowoncy',
            '  └ *Kumar ve avlanmada kalıcı ekstra şans kazandırır!* (Satın al: `/w buy ring`)',
            '────────────────────────────────────────',
            '💡 Satın almak için: `/w buy <ürün> [adet]` (Örn: `/w buy lootbox 3`)',
        ];
        await this.api.sendMessage(message.channel_id, lines.join('\n'));
    }
    async handleBuy(guild, member, message, args) {
        if (args.length === 0) {
            await this.api.sendMessage(message.channel_id, '🛒 | Satın almak istediğin ürünü yaz! (Örn: `/w buy lootbox 2`)');
            return;
        }
        const user = this.db.getOwoUser(member.user.id);
        const item = args[0].toLowerCase();
        const count = args[1] ? Math.max(1, Math.min(100, Number.parseInt(args[1], 10) || 1)) : 1;
        if (item === 'lootbox' || item === 'kutu') {
            const totalCost = 500 * count;
            if (user.cowoncy < totalCost) {
                await this.api.sendMessage(message.channel_id, `❌ Yetersiz Cowoncy! **${totalCost}** 🪙 gerekli.`);
                return;
            }
            this.db.updateOwoUser(member.user.id, {
                cowoncy: user.cowoncy - totalCost,
                lootboxes: user.lootboxes + count,
            });
            await this.api.sendMessage(message.channel_id, `📦 | **${member.user.username}**, **${count}** adet Lootbox satın aldı! Açmak için: \`/w open lootbox\``);
            return;
        }
        if (item === 'crate' || item === 'sandik' || item === 'sandık') {
            const totalCost = 1500 * count;
            if (user.cowoncy < totalCost) {
                await this.api.sendMessage(message.channel_id, `❌ Yetersiz Cowoncy! **${totalCost}** 🪙 gerekli.`);
                return;
            }
            this.db.updateOwoUser(member.user.id, {
                cowoncy: user.cowoncy - totalCost,
                crates: user.crates + count,
            });
            await this.api.sendMessage(message.channel_id, `🎁 | **${member.user.username}**, **${count}** adet **Silah Sandığı** satın aldı! Açmak için: \`/w open crate\``);
            return;
        }
        if (item === 'ring' || item === 'yuzuk' || item === 'yüzük') {
            if (user.ring === 'lucky_ring') {
                await this.api.sendMessage(message.channel_id, '💍 | Zaten parmağında bir **Şans Yüzüğü** takılı!');
                return;
            }
            if (user.cowoncy < 5000) {
                await this.api.sendMessage(message.channel_id, '❌ Yetersiz Cowoncy! Yüzük için **5,000** 🪙 gerekli.');
                return;
            }
            this.db.updateOwoUser(member.user.id, {
                cowoncy: user.cowoncy - 5000,
                ring: 'lucky_ring',
            });
            await this.api.sendMessage(message.channel_id, `💍 | **${member.user.username}**, **Şans Yüzüğü**'nü parmağına taktı! Artık avlanmada ve kumarda şansın çok daha yüksek!`);
            return;
        }
        await this.api.sendMessage(message.channel_id, '❌ Mağazada böyle bir ürün bulunamadı! (`lootbox`, `crate`, `ring`)');
    }
    async handleInventory(guild, member, message) {
        const user = this.db.getOwoUser(member.user.id);
        const weapon = WEAPONS[user.weapon] || WEAPONS.punch;
        const forgeLevel = user.weapon_level || 0;
        const forgeText = forgeLevel > 0 ? ` (+${forgeLevel})` : '';
        const forgePower = forgeLevel * 5;
        const totalPower = weapon.bonusStrength + forgePower;
        const spouseText = user.married_to ? `💍 <@${user.married_to}>` : '*Bekar*';
        const reminderText = user.daily_reminder === 1 ? '🔔 **Açık**' : '🔕 *Kapalı*';
        const lines = [
            `🎒 **${member.user.username}** Kullanıcısının Envanteri:`,
            '────────────────────────────────────────',
            `👛 Cowoncy: **${user.cowoncy.toLocaleString('tr-TR')}** 🪙`,
            `📦 Lootbox: **${user.lootboxes}** adet (Açmak için: \`/w open lootbox\`)`,
            `🎁 Silah Sandığı: **${user.crates}** adet (Açmak için: \`/w open crate\`)`,
            `🗡️ Kuşanılan Silah: **${weapon.emoji} ${weapon.name}${forgeText}** (+${totalPower} Güç${forgePower > 0 ? ` [Demirhane: +${forgePower}]` : ''})`,
            `💍 Yüzük: ${user.ring === 'lucky_ring' ? '💍 **Şans Yüzüğü (Aktif)**' : '*Yok*'}`,
            `💒 Evlilik Durumu: ${spouseText}`,
            `⏰ Günlük Hatırlatıcı: ${reminderText}`,
            '────────────────────────────────────────',
        ];
        await this.api.sendMessage(message.channel_id, lines.join('\n'));
    }
    async handleOpen(guild, member, message, args) {
        const user = this.db.getOwoUser(member.user.id);
        let targetType = 'lootbox';
        let count = 1;
        let isAll = false;
        // Detect target type and count from arguments (e.g. /w open lootbox 5, /w open 5, /w open crate all)
        for (const arg of args) {
            const lower = arg.toLowerCase().trim();
            if (['crate', 'sandik', 'sandık', 'silah'].includes(lower)) {
                targetType = 'crate';
            }
            else if (['lootbox', 'lb', 'kasa', 'kutu'].includes(lower)) {
                targetType = 'lootbox';
            }
            else if (lower === 'all' || lower === 'hepsi') {
                isAll = true;
            }
            else if (/^\d+$/.test(lower)) {
                const num = Number.parseInt(lower, 10);
                if (!Number.isNaN(num) && num > 0) {
                    count = num;
                }
            }
        }
        if (isAll) {
            count = targetType === 'crate' ? user.crates : user.lootboxes;
        }
        if (targetType === 'crate') {
            if (user.crates <= 0) {
                await this.api.sendMessage(message.channel_id, '❌ Hiç Silah Sandığın yok! `/w shop` ile satın alabilirsin.');
                return;
            }
            if (count <= 0) {
                await this.api.sendMessage(message.channel_id, '❌ Lütfen geçerli bir sandık sayısı belirtin! (Örn: `/w open crate 3`)');
                return;
            }
            if (count > user.crates) {
                await this.api.sendMessage(message.channel_id, `❌ Yeterli Silah Sandığın yok! Envanterinde **${user.crates}** adet sandık var.`);
                return;
            }
            if (count > 50) {
                await this.api.sendMessage(message.channel_id, '❌ Tek seferde en fazla 50 adet sandık açabilirsin!');
                return;
            }
            const weaponList = Object.values(WEAPONS).filter((w) => w.id !== 'punch');
            const rolledWeapons = [];
            for (let i = 0; i < count; i++) {
                rolledWeapons.push(weaponList[Math.floor(Math.random() * weaponList.length)]);
            }
            const bestRolled = rolledWeapons.reduce((best, cur) => (cur.bonusStrength > best.bonusStrength ? cur : best), rolledWeapons[0]);
            const currentWeapon = WEAPONS[user.weapon] || WEAPONS.punch;
            const willEquip = bestRolled.bonusStrength > currentWeapon.bonusStrength;
            const remainingCrates = user.crates - count;
            this.db.updateOwoUser(member.user.id, {
                crates: remainingCrates,
                weapon: willEquip ? bestRolled.id : user.weapon,
            });
            if (count === 1) {
                let reply = `🎁 | **${member.user.username}**, Silah Sandığını açtı ve içinden **${bestRolled.emoji} ${bestRolled.name}** (+${bestRolled.bonusStrength} Güç) çıktı!`;
                if (willEquip) {
                    reply += `\n⚔️ Bu silah eskisinden daha güçlü olduğu için otomatik olarak kuşandın!`;
                }
                else {
                    reply += `\n🛡️ Mevcut silahın daha güçlü olduğu için eskisini kullanmaya devam ediyorsun.`;
                }
                reply += `\n🎁 Kalan Sandık: **${remainingCrates}** adet`;
                await this.api.sendMessage(message.channel_id, reply);
                await this.progressQuest(guild, member, message.channel_id, 'open', 1);
                return;
            }
            const weaponMap = new Map();
            for (const w of rolledWeapons) {
                const existing = weaponMap.get(w.id);
                if (existing)
                    existing.count += 1;
                else
                    weaponMap.set(w.id, { weapon: w, count: 1 });
            }
            const sortedWeapons = Array.from(weaponMap.values()).sort((a, b) => b.weapon.bonusStrength - a.weapon.bonusStrength);
            const weaponLines = sortedWeapons.map((entry) => {
                const countStr = entry.count > 1 ? ` **x${entry.count}**` : '';
                return `${entry.weapon.emoji} **${entry.weapon.name}** (+${entry.weapon.bonusStrength})${countStr}`;
            });
            const lines = [
                `🎁 | **${member.user.username}**, **${count}** adet Silah Sandığı açtı!`,
                `────────────────────────────────────────`,
                `🏆 **En Yüksek Seviyeli Silah:** ${bestRolled.emoji} **${bestRolled.name}** (+${bestRolled.bonusStrength} Güç)`,
                willEquip
                    ? `⚔️ **Yeni silah otomatik kuşandı!** (Eski: ${currentWeapon.emoji} ${currentWeapon.name} ➔ Yeni: ${bestRolled.emoji} ${bestRolled.name})`
                    : `🛡️ Mevcut silahın (${currentWeapon.emoji} ${currentWeapon.name}, +${currentWeapon.bonusStrength} Güç) daha güçlü olduğu için aktif silahın değişmedi.`,
                `📦 **Çıkan Tüm Silahlar (${rolledWeapons.length} adet):**`,
                `> ${weaponLines.join(', ')}`,
                `────────────────────────────────────────`,
                `🎁 Kalan Sandık: **${remainingCrates}** adet`,
            ];
            await this.api.sendMessage(message.channel_id, lines.join('\n'));
            await this.progressQuest(guild, member, message.channel_id, 'open', count);
            return;
        }
        // Default to Lootbox
        if (user.lootboxes <= 0) {
            await this.api.sendMessage(message.channel_id, '❌ Hiç Lootboxun yok! `/w shop` ile satın alabilirsin.');
            return;
        }
        if (count <= 0) {
            await this.api.sendMessage(message.channel_id, '❌ Lütfen geçerli bir Lootbox sayısı belirtin! (Örn: `/w open lootbox 5`)');
            return;
        }
        if (count > user.lootboxes) {
            await this.api.sendMessage(message.channel_id, `❌ Yeterli Lootboxun yok! Envanterinde **${user.lootboxes}** adet var. (Açmak için: \`/w open lootbox ${user.lootboxes}\`)`);
            return;
        }
        if (count > 50) {
            await this.api.sendMessage(message.channel_id, '❌ Tek seferde en fazla 50 adet Lootbox açabilirsin!');
            return;
        }
        const wonAnimals = [];
        let totalWonCowoncy = 0;
        const hasRing = user.ring === 'lucky_ring';
        for (let i = 0; i < count; i++) {
            const cowoncy = Math.floor(Math.random() * 1201) + 300; // 300 - 1500
            totalWonCowoncy += cowoncy;
            wonAnimals.push(this.rollAnimal(hasRing));
        }
        this.db.addOwoAnimals(member.user.id, wonAnimals);
        const newCowoncy = user.cowoncy + totalWonCowoncy;
        const remainingBoxes = user.lootboxes - count;
        this.db.updateOwoUser(member.user.id, {
            lootboxes: remainingBoxes,
            cowoncy: newCowoncy,
        });
        if (count === 1) {
            const wonAnimal = wonAnimals[0];
            await this.api.sendMessage(message.channel_id, `📦 | **${member.user.username}**, bir Lootbox açtı!\n> 🪙 **+${totalWonCowoncy.toLocaleString('tr-TR')}** Cowoncy (Yeni Bakiye: **${newCowoncy.toLocaleString('tr-TR')}** 🪙)\n> ${wonAnimal.emoji} **${wonAnimal.name}** (${TIER_COLORS[wonAnimal.tier]}) hayvanat bahçene eklendi!\n📦 Kalan Lootbox: **${remainingBoxes}** adet`);
            await this.progressQuest(guild, member, message.channel_id, 'open', 1);
            return;
        }
        // Group animals by ID
        const animalMap = new Map();
        for (const a of wonAnimals) {
            const existing = animalMap.get(a.id);
            if (existing) {
                existing.count += 1;
            }
            else {
                animalMap.set(a.id, { animal: a, count: 1 });
            }
        }
        const tierOrder = {
            legendary: 1,
            mythical: 2,
            epic: 3,
            rare: 4,
            uncommon: 5,
            common: 6,
        };
        const sortedAnimals = Array.from(animalMap.values()).sort((a, b) => tierOrder[a.animal.tier] - tierOrder[b.animal.tier]);
        const animalSummary = sortedAnimals.map((entry) => {
            const countStr = entry.count > 1 ? ` **x${entry.count}**` : '';
            const tierBadge = TIER_COLORS[entry.animal.tier];
            return `${entry.animal.emoji} **${entry.animal.name}**${countStr} (${tierBadge})`;
        });
        const lines = [
            `📦 | **${member.user.username}**, **${count}** adet Lootbox açtı!`,
            `────────────────────────────────────────`,
            `🪙 **Kazanılan Cowoncy:** **+${totalWonCowoncy.toLocaleString('tr-TR')}** (Yeni Bakiye: **${newCowoncy.toLocaleString('tr-TR')}** 🪙)`,
            `🐾 **Kazanılan Hayvanlar (${wonAnimals.length} adet):**`,
            `> ${animalSummary.join(', ')}`,
            `────────────────────────────────────────`,
            `📦 Kalan Lootbox: **${remainingBoxes}** adet`,
        ];
        await this.api.sendMessage(message.channel_id, lines.join('\n'));
        await this.progressQuest(guild, member, message.channel_id, 'open', count);
    }
    // -------------------------------------------------------------
    // 13. Leaderboard (Top)
    // -------------------------------------------------------------
    async handleTop(guild, member, message, args) {
        const mode = (args[0] || 'cash').toLowerCase();
        if (mode === 'zoo' || mode === 'hayvan') {
            const topZoo = this.db.getTopOwoUsersByZoo(10);
            const lines = [
                '🏆 **EN BÜYÜK HAYVANAT BAHÇELERİ (TOP 10)**',
                '────────────────────────────────────────',
            ];
            for (let idx = 0; idx < topZoo.length; idx++) {
                const entry = topZoo[idx];
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                const name = await resolveUserDisplayName(this.api, this.db, guild, entry.user_id);
                lines.push(`${medal} **${name}** — ${entry.total_animals.toLocaleString('tr-TR')} Hayvan 🐾`);
            }
            await this.api.sendMessage(message.channel_id, lines.join('\n'));
            return;
        }
        const topCash = this.db.getTopOwoUsersByCash(10);
        const lines = [
            '🏆 **EN ZENGİN OWO OYUNCULARI (TOP 10)**',
            '────────────────────────────────────────',
        ];
        for (let idx = 0; idx < topCash.length; idx++) {
            const entry = topCash[idx];
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
            const name = await resolveUserDisplayName(this.api, this.db, guild, entry.user_id);
            lines.push(`${medal} **${name}** — ${entry.cowoncy.toLocaleString('tr-TR')} 🪙 Cowoncy`);
        }
        await this.api.sendMessage(message.channel_id, lines.join('\n'));
        return;
    }
    // -------------------------------------------------------------
    // 14. Profile
    // -------------------------------------------------------------
    async handleProfile(guild, member, message, args) {
        let targetUser = member.user;
        if (args.length > 0) {
            const resolved = await this.resolveMember(guild, args[0], message);
            if (resolved)
                targetUser = resolved.user;
        }
        const user = this.db.getOwoUser(targetUser.id);
        const weapon = WEAPONS[user.weapon] || WEAPONS.punch;
        const zoo = this.db.getOwoZoo(targetUser.id);
        const totalAnimals = zoo.reduce((acc, curr) => acc + curr.count, 0);
        const winRate = user.total_battles > 0
            ? Math.round((user.battles_won / user.total_battles) * 100)
            : 0;
        const forgeLevel = user.weapon_level || 0;
        const forgeText = forgeLevel > 0 ? `+${forgeLevel} ` : '';
        const forgePower = forgeLevel * 5;
        const totalStrength = user.strength + weapon.bonusStrength + forgePower;
        const spouseText = user.married_to ? `💍 <@${user.married_to}>` : '*Bekar*';
        this.db.trackUserGuild(guild.id, guild.name, targetUser.id);
        const commonGuilds = this.db.getUserCommonGuilds(targetUser.id);
        let guildLine = '';
        if (commonGuilds.length <= 1) {
            const gName = commonGuilds[0]?.guild_name || guild.name || 'Mevcut Topluluk';
            guildLine = `🌐 Bulunduğu Topluluk: **${gName}**`;
        }
        else if (commonGuilds.length <= 5) {
            const names = commonGuilds.map((g) => `\`${g.guild_name}\``).join(', ');
            guildLine = `🌐 Ortak Topluluklar (${commonGuilds.length}): ${names}`;
        }
        else {
            const topNames = commonGuilds.slice(0, 4).map((g) => `\`${g.guild_name}\``).join(', ');
            const extraCount = commonGuilds.length - 4;
            guildLine = `🌐 Ortak Topluluklar (${commonGuilds.length}): ${topNames} *(+${extraCount} diğer topluluk)*`;
        }
        const lines = [
            `📜 **${targetUser.username}** Kullanıcısının OwO Profili:`,
            '────────────────────────────────────────',
            `⭐ Seviye: **${user.level}** (XP: **${user.xp}** / ${this.getXpNeededForLevel(user.level)})`,
            `❤️ Can (HP): **${user.hp}** / **${user.max_hp}**`,
            `🗡️ Güç: **${totalStrength}** (${weapon.emoji} ${forgeText}${weapon.name})`,
            `👛 Cowoncy: **${user.cowoncy.toLocaleString('tr-TR')}** 🪙`,
            `🐾 Toplam Hayvan: **${totalAnimals}** adet`,
            `💒 Evlilik: ${spouseText}`,
            `⚔️ Savaşlar: **${user.battles_won}** Galibiyet / **${user.total_battles}** Maç (%${winRate})`,
            `🙏 Dualar: **${user.pray_count}** | 😈 Lanetler: **${user.curse_count}**`,
            `🔥 Günlük Seri: **${user.daily_streak}** gün`,
            guildLine,
            '────────────────────────────────────────',
            '🌐 *Ekonomi & Günlük Ödüller botun bulunduğu tüm topluluklarda ortaktır.*',
        ];
        await this.api.sendMessage(message.channel_id, lines.join('\n'));
    }
    // -------------------------------------------------------------
    // 15. Social Actions
    // -------------------------------------------------------------
    async handleSocial(action, guild, member, message, args) {
        const targetName = args.length > 0 ? args.join(' ').replace(/[<@!>]/g, '') : 'kendisine';
        switch (action) {
            case 'cookie':
                await this.api.sendMessage(message.channel_id, `🍪 | **${member.user.username}**, **${targetName}** için fırından yeni çıkmış sıcak bir kurabiye ikram etti!`);
                break;
            case 'hug':
                await this.api.sendMessage(message.channel_id, `🤗 | **${member.user.username}**, **${targetName}** kullanıcısına sımsıkı sarıldı! uwu`);
                break;
            case 'kiss':
                await this.api.sendMessage(message.channel_id, `💋 | **${member.user.username}**, **${targetName}** kullanıcısını sevgiyle öptü! owo`);
                break;
            case 'slap':
                await this.api.sendMessage(message.channel_id, `👋 | **${member.user.username}**, **${targetName}** kullanıcısına şaklatmalı bir tokat patlattı! ouch!`);
                break;
            case 'pat':
                await this.api.sendMessage(message.channel_id, `💆 | **${member.user.username}**, **${targetName}** kullanıcısının başını şefkatle okşadı! pat pat~`);
                break;
        }
    }
    // -------------------------------------------------------------
    // 16. Daily Quests
    // -------------------------------------------------------------
    async progressQuest(guild, member, channelId, questType, amount = 1) {
        try {
            const today = new Date().toISOString().slice(0, 10);
            this.db.getOrCreateDailyQuests(member.user.id, today);
            this.db.incrementQuestProgress(member.user.id, today, questType, amount);
        }
        catch (err) {
            console.error('[OwoService] progressQuest hatası:', err?.message);
        }
    }
    async handleQuest(guild, member, message, args) {
        const today = new Date().toISOString().slice(0, 10);
        const sub = (args[0] || '').toLowerCase();
        if (sub === 'claim' || sub === 'al' || sub === 'topla') {
            const result = this.db.claimQuestRewards(member.user.id, today);
            if (result.claimedCount === 0) {
                await this.api.sendMessage(message.channel_id, `ℹ️ | **${member.user.username}**, şu anda ödülü alınabilecek tamamlanmış bir görev bulunmuyor! Görevlerini incelemek için: \`/w quest\``);
                return;
            }
            const user = this.db.getOwoUser(member.user.id);
            await this.api.sendMessage(message.channel_id, `🎉 | **${member.user.username}**, **${result.claimedCount}** adet günlük görevi tamamladın ve ödüllerini topladın!\n🪙 **+${result.totalCowoncy.toLocaleString('tr-TR')}** Cowoncy | ⭐ **+${result.totalXp}** XP`);
            await this.applyXpAndCheckLevelUp(guild, member, message.channel_id, user, result.totalXp, { cowoncy: user.cowoncy + result.totalCowoncy });
            return;
        }
        const quests = this.db.getOrCreateDailyQuests(member.user.id, today);
        const lines = [
            `📜 | **${member.user.username}** kullanıcısının Günlük Görevleri (${today}):`,
            '────────────────────────────────────────',
        ];
        for (let i = 0; i < quests.length; i++) {
            const q = quests[i];
            const isDone = q.current_count >= q.target_count;
            const statusIcon = q.claimed ? '🎁 *(Ödül Alındı)*' : isDone ? '✅ **TAMAMLANDI**' : '⏳ Devam Ediyor';
            const percent = Math.min(100, Math.floor((q.current_count / q.target_count) * 100));
            const filledBars = Math.round(percent / 10);
            const emptyBars = 10 - filledBars;
            const bar = '▓'.repeat(filledBars) + '░'.repeat(emptyBars);
            lines.push(`${i + 1}. **${q.description}** [${statusIcon}]`);
            lines.push(`   İlerleme: [${bar}] **${q.current_count}/${q.target_count}** (%${percent}) | Ödül: +${q.reward_cowoncy.toLocaleString('tr-TR')} 🪙 Cowoncy, +${q.reward_xp} ⭐ XP`);
        }
        lines.push('────────────────────────────────────────');
        lines.push('💡 Tamamlanan görevlerin ödüllerini toplamak için: `/w quest claim`');
        await this.api.sendMessage(message.channel_id, lines.join('\n'));
    }
    // -------------------------------------------------------------
    // 17. Zoo Team & Arena Battle
    // -------------------------------------------------------------
    getEffectiveTeam(userId) {
        const zoo = this.db.getOwoZoo(userId);
        if (zoo.length === 0)
            return null;
        const availableAnimals = [];
        for (const z of zoo) {
            const def = ANIMALS.find((a) => a.id === z.animal_id);
            if (def) {
                for (let i = 0; i < z.count; i++) {
                    availableAnimals.push(def);
                }
            }
        }
        if (availableAnimals.length === 0)
            return null;
        availableAnimals.sort((a, b) => {
            const pA = ANIMAL_TIER_POWER[a.tier]?.base || 0;
            const pB = ANIMAL_TIER_POWER[b.tier]?.base || 0;
            return pB - pA;
        });
        const savedTeam = this.db.getOwoTeam(userId);
        let s1;
        let s2;
        let s3;
        if (savedTeam && savedTeam.slot1 && savedTeam.slot2 && savedTeam.slot3) {
            s1 = availableAnimals.find((a) => a.id === savedTeam.slot1);
            s2 = availableAnimals.find((a) => a.id === savedTeam.slot2);
            s3 = availableAnimals.find((a) => a.id === savedTeam.slot3);
        }
        if (!s1)
            s1 = availableAnimals[0];
        if (!s2)
            s2 = availableAnimals[1] || availableAnimals[0];
        if (!s3)
            s3 = availableAnimals[2] || availableAnimals[1] || availableAnimals[0];
        const p1 = ANIMAL_TIER_POWER[s1.tier].base;
        const p2 = ANIMAL_TIER_POWER[s2.tier].base;
        const p3 = ANIMAL_TIER_POWER[s3.tier].base;
        return { slot1: s1, slot2: s2, slot3: s3, totalPower: p1 + p2 + p3 };
    }
    async handleTeam(guild, member, message, args) {
        const sub = (args[0] || '').toLowerCase();
        if (sub === 'set' || sub === 'ayarla') {
            const id1 = args[1];
            const id2 = args[2];
            const id3 = args[3];
            if (!id1 || !id2 || !id3) {
                await this.api.sendMessage(message.channel_id, '❌ | Kullanım: `/w team set <hayvan1> <hayvan2> <hayvan3>` (Örn: `/w team set dragon tiger eagle`)');
                return;
            }
            const zoo = this.db.getOwoZoo(member.user.id);
            const targetIds = [id1.toLowerCase(), id2.toLowerCase(), id3.toLowerCase()];
            for (const tid of targetIds) {
                const hasAnimal = zoo.some((z) => z.animal_id.toLowerCase() === tid && z.count > 0);
                if (!hasAnimal) {
                    await this.api.sendMessage(message.channel_id, `❌ | Hayvanat bahçende **${tid}** adında bir hayvan bulunamadı! Hayvanlarını görmek için: \`/w zoo\``);
                    return;
                }
            }
            this.db.setOwoTeam(member.user.id, targetIds[0], targetIds[1], targetIds[2]);
            const a1 = ANIMALS.find((a) => a.id === targetIds[0]);
            const a2 = ANIMALS.find((a) => a.id === targetIds[1]);
            const a3 = ANIMALS.find((a) => a.id === targetIds[2]);
            await this.api.sendMessage(message.channel_id, `✅ | **${member.user.username}**, Arena Takımın başarıyla güncellendi!\n1️⃣ ${a1?.emoji} **${a1?.name}** | 2️⃣ ${a2?.emoji} **${a2?.name}** | 3️⃣ ${a3?.emoji} **${a3?.name}**`);
            return;
        }
        const team = this.getEffectiveTeam(member.user.id);
        if (!team) {
            await this.api.sendMessage(message.channel_id, `🐾 | **${member.user.username}**, henüz hiç hayvanın yok! Önce avlanmalısın: \`/w hunt\``);
            return;
        }
        const lines = [
            `🦁 | **${member.user.username}** kullanıcısının Arena Takımı:`,
            '────────────────────────────────────────',
            `1️⃣ Slot 1: ${team.slot1.emoji} **${team.slot1.name}** (${TIER_COLORS[team.slot1.tier]}) — Güç: **${ANIMAL_TIER_POWER[team.slot1.tier].base}**`,
            `2️⃣ Slot 2: ${team.slot2.emoji} **${team.slot2.name}** (${TIER_COLORS[team.slot2.tier]}) — Güç: **${ANIMAL_TIER_POWER[team.slot2.tier].base}**`,
            `3️⃣ Slot 3: ${team.slot3.emoji} **${team.slot3.name}** (${TIER_COLORS[team.slot3.tier]}) — Güç: **${ANIMAL_TIER_POWER[team.slot3.tier].base}**`,
            '────────────────────────────────────────',
            `⚔️ **Toplam Takım Gücü:** **${team.totalPower}**`,
            '💡 Özel takım kurmak için: `/w team set <hayvan1> <hayvan2> <hayvan3>` (Örn: `/w team set dragon lion eagle`)',
            '⚔️ Başka birine meydan okumak için: `/w zoobattle @üye [bahis]`',
        ];
        await this.api.sendMessage(message.channel_id, lines.join('\n'));
    }
    async handleZooBattle(guild, member, message, args) {
        if (args.length === 0) {
            await this.api.sendMessage(message.channel_id, '🦁 | Kullanım: `/w zoobattle @üye [bahis]` (Örn: `/w zb @BatuneX 1000`)');
            return;
        }
        const targetMember = await this.resolveMember(guild, args[0], message);
        if (!targetMember) {
            await this.api.sendMessage(message.channel_id, '❌ | Meydan okumak için geçerli bir üye etiketlemelisin!');
            return;
        }
        if (targetMember.user.id === member.user.id) {
            await this.api.sendMessage(message.channel_id, '❌ | Kendi kendine hayvan arenasında meydan okuyamazsın!');
            return;
        }
        let bet = 0;
        if (args[1]) {
            const rawBet = args[1].toLowerCase();
            const parsed = Number.parseInt(rawBet, 10);
            if (!Number.isNaN(parsed) && parsed > 0) {
                bet = Math.min(parsed, this.MAX_GAMBLE_BET);
            }
            else if (rawBet !== '0') {
                await this.api.sendMessage(message.channel_id, '❌ | Geçersiz bahis miktarı!');
                return;
            }
        }
        const user1Db = this.db.getOwoUser(member.user.id);
        const user2Db = this.db.getOwoUser(targetMember.user.id);
        if (bet > 0) {
            if (user1Db.cowoncy < bet) {
                await this.api.sendMessage(message.channel_id, `❌ | Yetersiz bakiye! Bahis için **${bet.toLocaleString('tr-TR')}** 🪙 Cowoncy gerekli, sende **${user1Db.cowoncy.toLocaleString('tr-TR')}** 🪙 var.`);
                return;
            }
            if (user2Db.cowoncy < bet) {
                await this.api.sendMessage(message.channel_id, `❌ | **${targetMember.user.username}** kullanıcısının bu bahsi karşılayacak kadar bakiyesi yok!`);
                return;
            }
        }
        const team1 = this.getEffectiveTeam(member.user.id);
        const team2 = this.getEffectiveTeam(targetMember.user.id);
        if (!team1) {
            await this.api.sendMessage(message.channel_id, `❌ | **${member.user.username}**, arenada savaşacak hiç hayvanın yok! (\`/w hunt\`)`);
            return;
        }
        if (!team2) {
            await this.api.sendMessage(message.channel_id, `❌ | **${targetMember.user.username}** kullanıcısının arenada savaşacak hiç hayvanı yok!`);
            return;
        }
        const p1Animals = [team1.slot1, team1.slot2, team1.slot3];
        const p2Animals = [team2.slot1, team2.slot2, team2.slot3];
        let p1Wins = 0;
        let p2Wins = 0;
        let p1TotalPower = 0;
        let p2TotalPower = 0;
        const roundLogs = [];
        for (let r = 0; r < 3; r++) {
            const a1 = p1Animals[r];
            const a2 = p2Animals[r];
            const roll1 = Math.floor(Math.random() * 15) + 1;
            const roll2 = Math.floor(Math.random() * 15) + 1;
            const base1 = ANIMAL_TIER_POWER[a1.tier].base;
            const base2 = ANIMAL_TIER_POWER[a2.tier].base;
            const finalPower1 = base1 + roll1;
            const finalPower2 = base2 + roll2;
            p1TotalPower += finalPower1;
            p2TotalPower += finalPower2;
            let roundWinner = '';
            if (finalPower1 > finalPower2) {
                p1Wins++;
                roundWinner = `🏆 **${member.user.username}** kazandı!`;
            }
            else if (finalPower2 > finalPower1) {
                p2Wins++;
                roundWinner = `🏆 **${targetMember.user.username}** kazandı!`;
            }
            else {
                roundWinner = '🤝 Berabere!';
            }
            roundLogs.push(`**Raund ${r + 1}:** ${a1.emoji} ${a1.name} (${finalPower1} Güç) ⚔️ ${a2.emoji} ${a2.name} (${finalPower2} Güç) ➔ ${roundWinner}`);
        }
        const p1WonOverall = p1Wins > p2Wins || (p1Wins === p2Wins && p1TotalPower >= p2TotalPower);
        const winnerMember = p1WonOverall ? member : targetMember;
        const loserMember = p1WonOverall ? targetMember : member;
        const winnerScore = p1WonOverall ? p1Wins : p2Wins;
        const loserScore = p1WonOverall ? p2Wins : p1Wins;
        let rewardText = '';
        if (bet > 0) {
            this.db.transferOwoCowoncy(loserMember.user.id, winnerMember.user.id, bet);
            rewardText = `💰 Bahis Ödülü: **+${bet.toLocaleString('tr-TR')}** 🪙 Cowoncy (<@${loserMember.user.id}> hesabından aktarıldı) | ⭐ **+50** XP`;
            const wDb = this.db.getOwoUser(winnerMember.user.id);
            await this.applyXpAndCheckLevelUp(guild, winnerMember, message.channel_id, wDb, 50);
        }
        else {
            const wDb = this.db.getOwoUser(winnerMember.user.id);
            const lDb = this.db.getOwoUser(loserMember.user.id);
            rewardText = `🎁 Dostluk Ödülü: **${winnerMember.user.username}** +500 🪙 & +40 XP | **${loserMember.user.username}** +150 🪙 & +15 XP`;
            await this.applyXpAndCheckLevelUp(guild, winnerMember, message.channel_id, wDb, 40, { cowoncy: wDb.cowoncy + 500 });
            await this.applyXpAndCheckLevelUp(guild, loserMember, message.channel_id, lDb, 15, { cowoncy: lDb.cowoncy + 150 });
        }
        const battleMessage = [
            `🏟️ **ZOO ARENA KARŞILAŞMASI** 🏟️`,
            `👥 **${member.user.username}** ⚔️ **${targetMember.user.username}**`,
            '────────────────────────────────────────',
            ...roundLogs,
            '────────────────────────────────────────',
            `👑 **ARENA ŞAMPİYONU:** <@${winnerMember.user.id}> (${winnerScore} - ${loserScore})!`,
            rewardText,
        ].join('\n');
        await this.api.sendMessage(message.channel_id, battleMessage);
    }
    // -------------------------------------------------------------
    // 18. Forge (Demirhane / Silah Geliştirme)
    // -------------------------------------------------------------
    async handleForge(guild, member, message, args) {
        const user = this.db.getOwoUser(member.user.id);
        const currentWeapon = WEAPONS[user.weapon] || WEAPONS.punch;
        if (user.weapon === 'punch') {
            await this.api.sendMessage(message.channel_id, '❌ | Yumruk geliştirilemez! Demirhaneyi kullanmak için önce bir silah kuşanmalısın (`/w shop` & `/w buy`).');
            return;
        }
        const currentLevel = user.weapon_level || 0;
        if (currentLevel >= 5) {
            await this.api.sendMessage(message.channel_id, `🌟 | **${member.user.username}**, ${currentWeapon.emoji} **${currentWeapon.name} (+5)** silahın zaten maksimum seviyede!`);
            return;
        }
        const nextLevel = currentLevel + 1;
        const upgradeCosts = {
            1: 2000,
            2: 5000,
            3: 12000,
            4: 25000,
            5: 50000,
        };
        const baseChances = {
            1: 85,
            2: 70,
            3: 50,
            4: 35,
            5: 20,
        };
        const cost = upgradeCosts[nextLevel];
        let chance = baseChances[nextLevel];
        const hasRing = user.ring === 'lucky_ring';
        if (hasRing)
            chance += 10;
        const zoo = this.db.getOwoZoo(member.user.id);
        if (zoo.length === 0) {
            await this.api.sendMessage(message.channel_id, '❌ | Demirhane ocağını körüklemek için 1 kurban hayvana ihtiyacın var! Hayvanat bahçende hiç hayvan yok (`/w hunt`).');
            return;
        }
        const tierOrder = ['common', 'uncommon', 'rare', 'epic', 'mythical', 'legendary'];
        let sacrificeEntry;
        for (const t of tierOrder) {
            sacrificeEntry = zoo.find((z) => z.tier === t && z.count > 0);
            if (sacrificeEntry)
                break;
        }
        if (!sacrificeEntry) {
            sacrificeEntry = zoo.find((z) => z.count > 0);
        }
        if (user.cowoncy < cost) {
            await this.api.sendMessage(message.channel_id, `❌ | Yetersiz Cowoncy! Silahını **+${nextLevel}** yapmak için **${cost.toLocaleString('tr-TR')}** 🪙 gerekli. Sende olan: **${user.cowoncy.toLocaleString('tr-TR')}** 🪙.`);
            return;
        }
        if (sacrificeEntry) {
            this.db.consumeAnimal(member.user.id, sacrificeEntry.animal_id);
        }
        const roll = Math.random() * 100;
        const success = roll < chance;
        if (success) {
            const newLevel = nextLevel;
            const newStrength = user.strength + 5;
            const newCowoncy = user.cowoncy - cost;
            this.db.updateOwoUser(member.user.id, {
                weapon_level: newLevel,
                strength: newStrength,
                cowoncy: newCowoncy,
            });
            await this.api.sendMessage(message.channel_id, `🔨✨ | **TEBRİKLER ${member.user.username}!** Demirhanedeki kadim alevler parıldadı!\n` +
                `🗡️ Silahın başarıyla **${currentWeapon.emoji} ${currentWeapon.name} (+${newLevel})** seviyesine yükseltildi!\n` +
                `💪 **+5 Kalıcı Güç** kazandın! (Yeni Güç: **${newStrength + currentWeapon.bonusStrength}**)\n` +
                `🔥 Harcanan: **${cost.toLocaleString('tr-TR')}** 🪙 ve 1x **${sacrificeEntry?.animal_name || 'Hayvan'}**`);
        }
        else {
            const newCowoncy = user.cowoncy - cost;
            this.db.updateOwoUser(member.user.id, { cowoncy: newCowoncy });
            await this.api.sendMessage(message.channel_id, `🔨💥 | **${member.user.username}**, demirhanede dövme işlemi başarısız oldu! Silahın zarar görmedi ancak malzemeler ve para tükendi. (Şans: %${chance}${hasRing ? ' [+%10 Şans Yüzüğü]' : ''})\n` +
                `🔥 Harcanan: **${cost.toLocaleString('tr-TR')}** 🪙 ve 1x **${sacrificeEntry?.animal_name || 'Hayvan'}**`);
        }
    }
    // -------------------------------------------------------------
    // 19. Marriage & Divorce
    // -------------------------------------------------------------
    async handleMarry(guild, member, message, args) {
        const sub = (args[0] || '').toLowerCase();
        if (sub === 'accept' || sub === 'kabul' || sub === 'evet') {
            const prop = this.pendingProposals.get(member.user.id);
            if (!prop) {
                await this.api.sendMessage(message.channel_id, `❌ | **${member.user.username}**, sana yönelik bekleyen bir evlilik teklifi bulunmuyor!`);
                return;
            }
            const proposerDb = this.db.getOwoUser(prop.proposerId);
            const targetDb = this.db.getOwoUser(member.user.id);
            if (proposerDb.married_to || targetDb.married_to) {
                this.pendingProposals.delete(member.user.id);
                await this.api.sendMessage(message.channel_id, '💔 | Taraflardan biri zaten evli olduğu için bu teklif artık geçersiz!');
                return;
            }
            this.db.setMarriage(prop.proposerId, member.user.id);
            this.pendingProposals.delete(member.user.id);
            await this.api.sendMessage(message.channel_id, `🎊💒 | **TEBRİKLER!** <@${prop.proposerId}> ve <@${member.user.id}> artık resmen EVLENDİLER! 💍✨\n` +
                `💖 Birlikte avlanırken (\`/w hunt\`) **+%15 XP** ve **+%10 Cowoncy** evlilik bonusu kazanırsınız!`);
            return;
        }
        const user = this.db.getOwoUser(member.user.id);
        if (user.married_to) {
            await this.api.sendMessage(message.channel_id, `💍 | **${member.user.username}**, zaten <@${user.married_to}> ile evlisin! Yeni bir teklif için önce boşanmalısın (\`/w divorce\`).`);
            return;
        }
        if (args.length === 0) {
            await this.api.sendMessage(message.channel_id, '💍 | Kullanım: `/w marry @üye` (Evlilik teklifi edebilmek için marketten Şans Yüzüğü almış olmalısın!)');
            return;
        }
        const targetMember = await this.resolveMember(guild, args[0], message);
        if (!targetMember) {
            await this.api.sendMessage(message.channel_id, '❌ | Evlilik teklifi etmek için geçerli bir kullanıcı etiketlemelisin!');
            return;
        }
        if (targetMember.user.id === member.user.id) {
            await this.api.sendMessage(message.channel_id, '💔 | Kendinle evlenemezsin!');
            return;
        }
        const targetDb = this.db.getOwoUser(targetMember.user.id);
        if (targetDb.married_to) {
            await this.api.sendMessage(message.channel_id, `💔 | **${targetMember.user.username}** zaten başka biriyle evli!`);
            return;
        }
        if (user.ring !== 'lucky_ring') {
            await this.api.sendMessage(message.channel_id, '💍 | Evlilik teklifi edebilmek için parmağında bir **Şans Yüzüğü** (`lucky_ring`) bulunmalı! (\`/w shop\` & \`/w buy lucky_ring\`)');
            return;
        }
        this.pendingProposals.set(targetMember.user.id, {
            proposerId: member.user.id,
            proposerUsername: member.user.username,
            channelId: message.channel_id,
            timestamp: Date.now(),
        });
        await this.api.sendMessage(message.channel_id, `💍💖 | **${targetMember.user.username}**, <@${member.user.id}> sana elinde pırıl pırıl parlayan bir **Şans Yüzüğü** ile evlilik teklif etti!\n` +
            `Kabul etmek için 60 saniye içinde bu kanala **\`evet\`** yazabilir veya \`/w marry accept\` komutunu kullanabilirsin!`);
    }
    async handleDivorce(guild, member, message) {
        const spouseId = this.db.divorceMarriage(member.user.id);
        if (!spouseId) {
            await this.api.sendMessage(message.channel_id, '💔 | Şu anda evli değilsin.');
            return;
        }
        await this.api.sendMessage(message.channel_id, `💔 | **${member.user.username}**, <@${spouseId}> ile olan evliliğin sona erdi. Artık bekarsın.`);
    }
    // -------------------------------------------------------------
    // 20. Daily Reminder
    // -------------------------------------------------------------
    async handleRemind(guild, member, message, args) {
        let action = (args[0] || '').toLowerCase();
        if (action === 'daily' || action === 'gunluk') {
            action = (args[1] || '').toLowerCase();
        }
        const user = this.db.getOwoUser(member.user.id);
        const currentEnabled = user.daily_reminder === 1;
        let nextEnabled;
        if (action === 'on' || action === 'ac' || action === 'aç' || action === 'aktif' || action === 'enable') {
            nextEnabled = true;
        }
        else if (action === 'off' || action === 'kapat' || action === 'kapa' || action === 'pasif' || action === 'disable') {
            nextEnabled = false;
        }
        else if (!action || action === 'toggle') {
            nextEnabled = !currentEnabled;
        }
        else {
            await this.sendAutoExpiring(message.channel_id, '⏰ | Kullanım: `/w remind daily [on/off]` veya `/w remind [on/off]` (Günlük ödül süresi dolduğunda bildirim)', 5, message.id);
            return;
        }
        this.db.setDailyReminder(member.user.id, nextEnabled);
        this.db.updateOwoUser(member.user.id, {
            last_guild_id: guild.id,
            last_guild_name: guild.name,
        });
        const notifyText = nextEnabled
            ? `🔔 | **${member.user.username}**, Günlük Ödül Hatırlatıcısı **AÇILDI**! **${guild.name}** topluluğundaki 24 saatlik süren dolduğunda sana DM üzerinden haber vereceğim. 🪙`
            : `🔕 | **${member.user.username}**, Günlük Ödül Hatırlatıcısı **KAPATILDI**.`;
        await this.sendAutoExpiring(message.channel_id, notifyText, 5, message.id);
    }
    // -------------------------------------------------------------
    // 21. Help Menu
    // -------------------------------------------------------------
    async handleHelp(guild, member, message) {
        const lines = [
            '🐾 **OWO BOT REHBERİ & KOMUTLARI** 🐾',
            '*(Tüm OwO komutları `/owo <komut>`, `/uwu <komut>` veya `/w <komut>` şeklinde kullanılır)*',
            '────────────────────────────────────────',
            '📜 **Günlük Görevler & Hatırlatıcı:**',
            '• `/owo quest` / `/owo q` — Günlük 3 görevi ve ilerleme çubuğunu listeler.',
            '• `/owo quest claim` — Tamamlanan görev ödüllerini toplar (Cowoncy & XP).',
            '• `/owo remind daily` — 24 saat dolunca günlük ödül hatırlatıcısını açar/kapatır.',
            '',
            '🦁 **Zoo Arena & Demirhane:**',
            '• `/owo team` — Arena takımını ve toplam gücünü görüntüler.',
            '• `/owo team set <h1 h2 h3>` — 3 hayvanlık özel arena takımını kurar.',
            '• `/owo zoobattle @üye [bahis]` — Hayvanat bahçesi arenasında 3 rauntluk düello yapar (Kısayol: `/owo zb`).',
            '• `/owo forge` — Silahını demirhanede geliştirir (+0 ile +5 arası, her seviye +5 kalıcı güç!).',
            '',
            '💍 **Evlilik Sistemi:**',
            '• `/owo marry @üye` — Şans Yüzüğü ile evlilik teklifi eder (Avlanırken +%15 XP ve +%10 Cowoncy!).',
            '• `/owo marry accept` — Gelen evlilik teklifini kabul eder (Kanalda `evet` de yazılabilir).',
            '• `/owo divorce` — Boşanır.',
            '',
            '🌿 **Avcılık & Hayvanlar:**',
            '• `/owo hunt` — Çalılıklardan 1-3 hayvan yakalar, XP ve Cowoncy kazandırır.',
            '• `/owo zoo` — Yakaladığın tüm hayvanları ve değerlerini listeler.',
            '• `/owo sell <all/common/hayvan>` — Hayvanlarını satarak Cowoncy kazanır.',
            '',
            '👛 **Ekonomi & Mağaza:**',
            '• `/owo cash` — Cowoncy bakiyeni gösterir.',
            '• `/owo daily` — Günlük 1.000+ Cowoncy bonusunu alır (Her gün artan seri!).',
            '• `/owo give cash @üye <miktar>` — Başka bir kullanıcıya Cowoncy transfer eder (Kısayol: `/owo give @üye <miktar>`).',
            '• `/owo shop` — Mağazayı açar (Lootbox, Sandık, Şans Yüzüğü).',
            '• `/owo buy <ürün> [adet]` — Mağazadan eşya satın alır.',
            '• `/owo inv` — Envanterini, kuşanılan silah seviyesini ve evlilik durumunu görüntüler.',
            '• `/owo open <lootbox/crate>` — Sandık veya Lootbox açar.',
            '',
            '🎲 **Kumar & Şans Oyunları:**',
            '• `/owo cf <miktar> [y/t]` — Yazı Tura atar (2 katı kazanç!).',
            '• `/owo slots <miktar>` — Kollu slot makinesini çevirir (10x Jackpot!).',
            '• `/owo bj <miktar>` — 21 Blackjack masasına oturur.',
            '',
            '⚔️ **RPG & Savaş:**',
            '• `/owo battle` — Canavarlarla savaşır, seviye atlar ve sandık düşürür.',
            '• `/owo pray [@üye]` — Dua eder, lütuf ve şans kazanır.',
            '• `/owo curse [@üye]` — Birine uğursuz bir lanet okur.',
            '• `/owo profile` — Detaylı istatistik kartını görüntüler.',
            '• `/owo top` — Sunucudaki en zengin oyuncuların sıralaması.',
            '',
            '💖 **Sosyal:**',
            '• `/owo` / `/uwu` — Sevimli tepki verir.',
            '• `/owo hug`, `kiss`, `slap`, `pat`, `cookie` [@üye] — Sosyal etkileşim eylemleri.',
            '────────────────────────────────────────',
        ];
        await this.api.sendMessage(message.channel_id, lines.join('\n'));
    }
}
//# sourceMappingURL=OwoService.js.map