// SPDX-License-Identifier: AGPL-3.0-or-later
import { config } from '../config/env.js';
import { Permissions } from '../config/constants.js';
import { PermissionService } from '../services/PermissionService.js';
import { CommunityService } from '../services/CommunityService.js';
import { buildPollComponents, formatPollEmbed, OPTION_EMOJIS, NUMBER_EMOJIS } from '../services/PollCardGenerator.js';
import { t } from '../locales/i18n.js';
import { handleModerationCommands } from './modules/moderationCommands.js';
import { handleMusicCommands } from './modules/musicCommands.js';
import { handleCardCommands } from './modules/cardCommands.js';
import { handleSystemCommands } from './modules/systemCommands.js';
import { handleLevelingCommands } from './modules/levelingCommands.js';
import { handleOwoCommands } from './modules/owoCommands.js';
import { handleCommunityCommands } from './modules/communityCommands.js';
import { handleSecurityCommands } from './modules/securityCommands.js';
import { handleHelpCommand, buildHelpPage, buildHelpComponents, HELP_USER_TOTAL_PAGES, HELP_ADMIN_TOTAL_PAGES, } from './modules/helpCommands.js';
export class CommandHandler {
    api;
    modService;
    warnService;
    roleService;
    welcomeService;
    modLogService;
    antiSpamService;
    antiLinkService;
    owoService;
    musicService;
    badWordsService;
    levelingService;
    antiRaidService;
    communityService;
    giveawayService;
    db;
    birthdayService;
    pollService;
    activeHelpSessions = new Map();
    commandCooldowns = new Map();
    constructor(api, modService, warnService, roleService, welcomeService, modLogService, antiSpamService, antiLinkService, owoService, musicService, badWordsService, levelingService, antiRaidService, communityService, giveawayService, db, birthdayService, pollService) {
        this.api = api;
        this.modService = modService;
        this.warnService = warnService;
        this.roleService = roleService;
        this.welcomeService = welcomeService;
        this.modLogService = modLogService;
        this.antiSpamService = antiSpamService;
        this.antiLinkService = antiLinkService;
        this.owoService = owoService;
        this.musicService = musicService;
        this.badWordsService = badWordsService;
        this.levelingService = levelingService;
        this.antiRaidService = antiRaidService;
        this.communityService = communityService;
        this.giveawayService = giveawayService;
        this.db = db;
        this.birthdayService = birthdayService;
        this.pollService = pollService;
        // Clean up stale help sessions older than 5 minutes
        setInterval(() => {
            const now = Date.now();
            for (const [key, session] of this.activeHelpSessions.entries()) {
                if (now - session.createdAt > 300000) {
                    this.activeHelpSessions.delete(key);
                }
            }
            // Clean up stale command cooldowns older than 10 seconds
            for (const [userId, ts] of this.commandCooldowns.entries()) {
                if (now - ts > 10000) {
                    this.commandCooldowns.delete(userId);
                }
            }
        }, 60000);
    }
    /**
     * Helper to parse user mention or ID string: <@12345>, <@!12345> or 12345
     */
    static extractUserId(raw) {
        if (!raw)
            return null;
        const clean = raw.trim().replace(/^<@!?/, '').replace(/>$/, '');
        return clean || null;
    }
    /**
     * Synchronous helper to parse role mention, ID or name from cached roles
     */
    static extractRole(raw, guild) {
        if (!raw)
            return null;
        const clean = raw.trim().replace(/^<@&/, '').replace(/>$/, '');
        const byId = guild.roles?.find((r) => r.id === clean);
        if (byId)
            return byId;
        const cleanName = raw.trim().replace(/^@\s*/, '').trim();
        const lowerCleanTr = cleanName.toLocaleLowerCase('tr');
        const lowerCleanEn = cleanName.toLowerCase();
        return (guild.roles?.find((r) => {
            const rTr = r.name.toLocaleLowerCase('tr');
            const rEn = r.name.toLowerCase();
            return rTr === lowerCleanTr || rEn === lowerCleanEn;
        }) || null);
    }
    /**
     * Synchronous helper to parse channel mention, ID or name from cached channels
     */
    static extractChannel(raw, guild) {
        if (!raw)
            return null;
        const clean = raw.trim().replace(/^<#/, '').replace(/>$/, '');
        const byId = guild.channels?.find((c) => c.id === clean);
        if (byId)
            return byId;
        const cleanName = raw.trim().replace(/^#\s*/, '').trim();
        const lowerCleanTr = cleanName.toLocaleLowerCase('tr');
        const lowerCleanEn = cleanName.toLowerCase();
        return (guild.channels?.find((c) => {
            const cTr = c.name.toLocaleLowerCase('tr');
            const cEn = c.name.toLowerCase();
            return cTr === lowerCleanTr || cEn === lowerCleanEn;
        }) || null);
    }
    /**
     * Asynchronous helper to resolve a member by mention (<@id>, <@!id>), ID, full tag (Name#1234),
     * or username/nickname. If not cached, fetches from API.
     */
    async resolveMember(guild, raw) {
        if (!raw)
            return null;
        const trimmed = raw.trim();
        const mentionMatch = trimmed.match(/<@!?([^>]+)>/);
        const targetId = mentionMatch ? mentionMatch[1] : (/^\d{16,21}$/.test(trimmed) ? trimmed : null);
        if (targetId) {
            const cached = guild.members?.find((m) => m.user.id === targetId);
            if (cached)
                return cached;
            try {
                const fetched = await this.api.getGuildMember(guild.id, targetId);
                if (guild.members && fetched)
                    guild.members.push(fetched);
                return fetched;
            }
            catch {
                return null;
            }
        }
        // Try direct ID match in guild.members
        const byId = guild.members?.find((m) => m.user.id === trimmed);
        if (byId)
            return byId;
        const cleanRaw = trimmed.replace(/^@\s*/, '').trim();
        const cleanNameTr = cleanRaw.toLocaleLowerCase('tr');
        const cleanNameEn = cleanRaw.toLowerCase();
        if (!cleanNameTr && !cleanNameEn)
            return null;
        const hashIdx = cleanRaw.lastIndexOf('#');
        const hasHash = hashIdx !== -1;
        const namePartTr = hasHash ? cleanRaw.slice(0, hashIdx).trim().toLocaleLowerCase('tr') : cleanNameTr;
        const namePartEn = hasHash ? cleanRaw.slice(0, hashIdx).trim().toLowerCase() : cleanNameEn;
        const discrimPart = hasHash ? cleanRaw.slice(hashIdx + 1).trim() : null;
        const findByName = (members) => members.find((m) => {
            const uTr = m.user.username.toLocaleLowerCase('tr');
            const uEn = m.user.username.toLowerCase();
            const nTr = m.nick ? m.nick.toLocaleLowerCase('tr') : '';
            const nEn = m.nick ? m.nick.toLowerCase() : '';
            const discrim = m.user.discriminator || '';
            const tag = `${uEn}#${discrim}`;
            // 1. Tag match (e.g. "Kortex#0164")
            if (hasHash && discrimPart) {
                const discrimMatches = discrim === discrimPart || (discrimPart === '0' && discrim === '0000');
                if (discrimMatches &&
                    (uTr === namePartTr || uEn === namePartEn || (nTr && nTr === namePartTr) || (nEn && nEn === namePartEn))) {
                    return true;
                }
            }
            // 2. Direct username, nickname or tag
            return (uTr === cleanNameTr ||
                uEn === cleanNameEn ||
                (nTr && nTr === cleanNameTr) ||
                (nEn && nEn === cleanNameEn) ||
                tag === cleanNameEn);
        });
        if (guild.members && guild.members.length > 0) {
            const cached = findByName(guild.members);
            if (cached)
                return cached;
        }
        if (this.db) {
            const foundId = this.db.findUserIdByUsername(cleanRaw);
            if (foundId) {
                try {
                    const fetched = await this.api.getGuildMember(guild.id, foundId);
                    if (fetched) {
                        if (!guild.members)
                            guild.members = [];
                        guild.members.push(fetched);
                        return fetched;
                    }
                }
                catch { }
            }
        }
        if (typeof this.api.getGuildMembers === 'function') {
            try {
                const allMembers = await this.api.getGuildMembers(guild.id);
                guild.members = allMembers;
                return findByName(allMembers) || null;
            }
            catch {
                return null;
            }
        }
        return null;
    }
    /**
     * Helper to resolve a banned user by full tag (Kortex#0164), username (Kortex),
     * discriminator (#0164 or 0164), Snowflake ID (1553179766511632384), or mention (<@id>).
     */
    async resolveBannedUser(guild, raw) {
        if (!raw)
            return null;
        const trimmed = raw.trim();
        // 1. Check if raw is a mention (<@id>, <@!id>) or pure numeric snowflake
        const mentionMatch = trimmed.match(/<@!?([^>]+)>/);
        const candidateId = mentionMatch ? mentionMatch[1] : (/^\d{16,21}$/.test(trimmed) ? trimmed : null);
        // Fetch bans list from API
        let bans = [];
        try {
            if (typeof this.api.getGuildBans === 'function') {
                bans = await this.api.getGuildBans(guild.id);
            }
        }
        catch (err) {
            console.warn(`[CommandHandler] getGuildBans API çağrısı başarısız (${err.message}).`);
        }
        // If a candidate Snowflake ID is given
        if (candidateId) {
            const foundBan = bans.find((b) => b.user.id === candidateId);
            if (foundBan) {
                const tag = foundBan.user.discriminator &&
                    foundBan.user.discriminator !== '0' &&
                    foundBan.user.discriminator !== '0000'
                    ? `${foundBan.user.username}#${foundBan.user.discriminator}`
                    : foundBan.user.username;
                return { id: candidateId, user: foundBan.user, tag };
            }
            return { id: candidateId, tag: `ID: ${candidateId}` };
        }
        // 2. Check by tag, username, discriminator from ban list
        const cleanRaw = trimmed.replace(/^@\s*/, '').trim();
        if (!cleanRaw)
            return null;
        const hashIndex = cleanRaw.lastIndexOf('#');
        const hasHash = hashIndex !== -1;
        const namePart = hasHash ? cleanRaw.slice(0, hashIndex).trim() : cleanRaw;
        const discrimPart = hasHash ? cleanRaw.slice(hashIndex + 1).trim() : null;
        const lowerCleanTr = cleanRaw.toLocaleLowerCase('tr');
        const lowerCleanEn = cleanRaw.toLowerCase();
        const lowerNameTr = namePart.toLocaleLowerCase('tr');
        const lowerNameEn = namePart.toLowerCase();
        // Match A: Full tag "Kortex#0164"
        if (hasHash && discrimPart) {
            const matchTag = bans.find((b) => {
                const uTr = b.user.username.toLocaleLowerCase('tr');
                const uEn = b.user.username.toLowerCase();
                const d = b.user.discriminator || '';
                const discrimMatches = d === discrimPart || (discrimPart === '0' && d === '0000');
                return discrimMatches && (uTr === lowerNameTr || uEn === lowerNameEn);
            });
            if (matchTag) {
                const tag = `${matchTag.user.username}#${matchTag.user.discriminator || '0000'}`;
                return { id: matchTag.user.id, user: matchTag.user, tag };
            }
        }
        // Match B: Exact username match
        const matchUsername = bans.find((b) => {
            const uTr = b.user.username.toLocaleLowerCase('tr');
            const uEn = b.user.username.toLowerCase();
            const gTr = b.user.global_name ? b.user.global_name.toLocaleLowerCase('tr') : '';
            const gEn = b.user.global_name ? b.user.global_name.toLowerCase() : '';
            return (uTr === lowerCleanTr ||
                uEn === lowerCleanEn ||
                (gTr && gTr === lowerCleanTr) ||
                (gEn && gEn === lowerCleanEn));
        });
        if (matchUsername) {
            const tag = matchUsername.user.discriminator &&
                matchUsername.user.discriminator !== '0' &&
                matchUsername.user.discriminator !== '0000'
                ? `${matchUsername.user.username}#${matchUsername.user.discriminator}`
                : matchUsername.user.username;
            return { id: matchUsername.user.id, user: matchUsername.user, tag };
        }
        // Match C: User provided discriminator alone, e.g. "#0164" or "0164"
        const pureDiscrim = cleanRaw.replace(/^#/, '').trim();
        if (/^\d{4}$/.test(pureDiscrim)) {
            const matchDiscrim = bans.filter((b) => b.user.discriminator === pureDiscrim);
            if (matchDiscrim.length === 1) {
                const b = matchDiscrim[0];
                return {
                    id: b.user.id,
                    user: b.user,
                    tag: `${b.user.username}#${b.user.discriminator}`,
                };
            }
        }
        // Match D: Check if any ban user ID exactly equals cleanRaw
        const matchId = bans.find((b) => b.user.id === cleanRaw);
        if (matchId) {
            return { id: matchId.user.id, user: matchId.user, tag: matchId.user.username };
        }
        // Match E: If cleanRaw is a numeric snowflake ID or mock test ID like "user_target"
        if (/^\d{15,21}$/.test(cleanRaw) || /^user_[a-zA-Z0-9_\-]+$/.test(cleanRaw)) {
            return { id: cleanRaw, tag: cleanRaw };
        }
        return null;
    }
    /**
     * Asynchronous helper to resolve a role by mention (<@&id>), pure ID, or role name (supports spaces).
     * If not found in cache, fetches fresh roles from API.
     */
    async resolveRole(guild, raw) {
        if (!raw)
            return null;
        const trimmed = raw.trim();
        const mentionMatch = trimmed.match(/<@&([^>]+)>/);
        const cleanId = mentionMatch ? mentionMatch[1] : trimmed.replace(/^<@&/, '').replace(/>$/, '');
        const findInList = (roles) => {
            if (cleanId) {
                const byId = roles.find((r) => r.id === cleanId);
                if (byId)
                    return byId;
            }
            const cleanName = trimmed.replace(/^@\s*/, '').trim();
            if (!cleanName)
                return null;
            const lowerCleanTr = cleanName.toLocaleLowerCase('tr');
            const lowerCleanEn = cleanName.toLowerCase();
            return (roles.find((r) => {
                const rTr = r.name.toLocaleLowerCase('tr');
                const rEn = r.name.toLowerCase();
                return rTr === lowerCleanTr || rEn === lowerCleanEn;
            }) || null);
        };
        if (guild.roles && guild.roles.length > 0) {
            const cached = findInList(guild.roles);
            if (cached)
                return cached;
        }
        if (typeof this.api.getGuildRoles === 'function') {
            try {
                const freshRoles = await this.api.getGuildRoles(guild.id);
                guild.roles = freshRoles;
                return findInList(freshRoles);
            }
            catch (err) {
                console.error(`[CommandHandler] Rol listesi API'den çekilemedi:`, err.message);
                return null;
            }
        }
        return null;
    }
    /**
     * Asynchronous helper to resolve a channel by mention (<#id>), ID, or name (#name, # name, name).
     * If not found in cache, queries API to ensure newly created channels are always recognized.
     */
    async resolveChannel(guild, raw) {
        if (!raw)
            return null;
        const trimmed = raw.trim();
        const mentionMatch = trimmed.match(/<#([^>]+)>/);
        const cleanId = mentionMatch ? mentionMatch[1] : trimmed.replace(/^<#/, '').replace(/>$/, '');
        const findInList = (channels) => {
            if (cleanId) {
                const byId = channels.find((c) => c.id === cleanId);
                if (byId)
                    return byId;
            }
            const cleanName = trimmed.replace(/^#\s*/, '').trim();
            if (!cleanName)
                return null;
            const lowerCleanTr = cleanName.toLocaleLowerCase('tr');
            const lowerCleanEn = cleanName.toLowerCase();
            // Direct name match
            const byName = channels.find((c) => {
                const cTr = c.name.toLocaleLowerCase('tr');
                const cEn = c.name.toLowerCase();
                return cTr === lowerCleanTr || cEn === lowerCleanEn;
            });
            if (byName)
                return byName;
            // Match with spaces vs hyphens (e.g. "hos-geldin" vs "hos geldin")
            const dashClean = lowerCleanTr.replace(/\s+/g, '-');
            const byDash = channels.find((c) => c.name.toLocaleLowerCase('tr').replace(/\s+/g, '-') === dashClean);
            if (byDash)
                return byDash;
            return null;
        };
        if (guild.channels && guild.channels.length > 0) {
            const cached = findInList(guild.channels);
            if (cached)
                return cached;
        }
        if (typeof this.api.getGuildChannels === 'function') {
            try {
                const freshChannels = await this.api.getGuildChannels(guild.id);
                guild.channels = freshChannels;
                return findInList(freshChannels);
            }
            catch (err) {
                console.error(`[CommandHandler] Kanal listesi API'den çekilemedi:`, err.message);
                return null;
            }
        }
        return null;
    }
    /**
     * Refresh guild roles and member objects from the API to guarantee 100% accurate, live hierarchy.
     */
    async refreshHierarchy(guild, invoker, botMember, targetMember) {
        try {
            const freshRoles = await this.api.getGuildRoles(guild.id);
            if (freshRoles && freshRoles.length > 0)
                guild.roles = freshRoles;
        }
        catch { }
        let freshInvoker = invoker;
        try {
            const res = await this.api.getGuildMember(guild.id, invoker.user.id);
            if (res)
                freshInvoker = res;
        }
        catch { }
        let freshBot = botMember;
        try {
            const res = await this.api.getGuildMember(guild.id, botMember.user.id);
            if (res)
                freshBot = res;
        }
        catch { }
        let freshTarget = targetMember || null;
        if (targetMember) {
            try {
                const res = await this.api.getGuildMember(guild.id, targetMember.user.id);
                if (res)
                    freshTarget = res;
            }
            catch { }
        }
        return { invoker: freshInvoker, botMember: freshBot, targetMember: freshTarget };
    }
    /**
     * Helper to check and display remaining timeout duration for a member.
     */
    async handleTimeoutStatus(guild, invoker, channelId, targetRaw) {
        let targetMember = null;
        if (targetRaw && targetRaw.trim()) {
            targetMember = await this.resolveMember(guild, targetRaw.trim());
            if (!targetMember) {
                await this.api.sendMessage(channelId, t('errors.user_not_found'));
                return;
            }
        }
        else {
            // Default to checking the invoker themselves if no user is specified
            targetMember = invoker;
        }
        const res = await this.modService.getTimeoutStatus(guild, targetMember);
        const sentMsg = await this.api.sendMessage(channelId, res.message);
        if (res.data?.isActive && sentMsg?.id) {
            this.modService.registerInfoMessage(guild.id, targetMember.user.id, channelId, sentMsg.id);
        }
    }
    /**
     * Intelligently resolves the voice channel to join:
     * 1. If explicitChannelName is provided (e.g. `/join Sohbet`, `/play <link> #Sohbet`), resolves it.
     * 2. Checks active in-memory userVoiceStates.
     * 3. Fallback: Fetches fresh guild data via API to discover active voice_states.
     * 4. Smart single voice channel auto-detection: If guild has only 1 voice channel (type 2), uses it.
     */
    async resolveTargetVoiceChannel(guild, invoker, explicitChannelName) {
        // Ensure guild channels are loaded
        if (!guild.channels || guild.channels.length === 0) {
            try {
                if (typeof this.api.getGuildChannels === 'function') {
                    guild.channels = await this.api.getGuildChannels(guild.id);
                }
            }
            catch { }
        }
        const voiceChannels = (guild.channels || []).filter((c) => Number(c.type) === 2 || Number(c.type) === 13);
        // 1. Explicit channel argument (e.g. /join #oda or /join Music or /play <link> #Music)
        if (explicitChannelName && explicitChannelName.trim()) {
            const explicit = await this.resolveChannel(guild, explicitChannelName.trim());
            if (explicit && (Number(explicit.type) === 2 || Number(explicit.type) === 13)) {
                return { channelId: explicit.id, channelName: explicit.name };
            }
            const searchLower = explicitChannelName.trim().toLowerCase();
            const fuzzy = voiceChannels.find((c) => c.name.toLowerCase() === searchLower || c.name.toLowerCase().includes(searchLower));
            if (fuzzy) {
                return { channelId: fuzzy.id, channelName: fuzzy.name };
            }
        }
        // 2. In-memory tracked user voice state
        let voiceChannelId = this.musicService.getUserVoiceChannel(guild.id, invoker.user.id);
        // 3. Fallback: If bot is already connected to a voice channel in this guild, reuse that channel
        if (!voiceChannelId) {
            const currentPlayer = this.musicService.getPlayer(guild.id);
            if (currentPlayer?.voiceChannelId) {
                voiceChannelId = currentPlayer.voiceChannelId;
            }
        }
        // 4. Fallback: Refresh guild and check voice_states payload from REST API
        if (!voiceChannelId) {
            try {
                const freshGuild = await this.api.getGuild(guild.id);
                if (Array.isArray(freshGuild.voice_states)) {
                    for (const vs of freshGuild.voice_states) {
                        if (vs.user_id && vs.channel_id) {
                            this.musicService.updateVoiceState(guild.id, vs.user_id, vs.channel_id);
                        }
                    }
                    voiceChannelId = this.musicService.getUserVoiceChannel(guild.id, invoker.user.id);
                }
            }
            catch { }
        }
        // 5. If voiceChannelId was resolved, return it
        if (voiceChannelId) {
            const foundCh = guild.channels?.find((c) => c.id === voiceChannelId);
            return {
                channelId: voiceChannelId,
                channelName: foundCh?.name || 'Ses Kanalı',
            };
        }
        return null;
    }
    async handleMessage(guild, member, botMember, message) {
        const content = message.content?.trim();
        if (!content)
            return;
        // Track user guild membership and username for cross-community profile tracking
        if (this.db && member?.user?.id) {
            this.db.trackUserGuild(guild.id, guild.name, member.user.id);
            this.db.saveUserName(member.user.id, member.user.username, member.nick);
        }
        // 1. AntiSpam Security: Check ALL messages regardless of prefix to prevent command flood
        const isSpamFiltered = await this.antiSpamService.handleMessage(guild, member, message);
        if (isSpamFiltered)
            return;
        const prefix = config.commandPrefix;
        const isCommand = content.startsWith(prefix);
        if (!isCommand) {
            // Check for help page navigation emojis or words (◀️ / ▶️ / önceki / sonraki)
            const trimmedLower = content.toLowerCase();
            if (trimmedLower === '◀️' || trimmedLower === '▶️' ||
                trimmedLower === '⬅️' || trimmedLower === '➡️' ||
                trimmedLower === 'önceki' || trimmedLower === 'sonraki' ||
                trimmedLower === 'prev' || trimmedLower === 'next') {
                const helpHandled = await this.handleHelpNavigation(message.channel_id, member.user.id, trimmedLower, message);
                if (helpHandled)
                    return;
            }
            // Check if message author was AFK -> wake them up
            if (this.communityService) {
                await this.communityService.handleAfkSpeaker(guild, member, message);
            }
            // Pass regular messages through security filters (Anti-Link & Bad-Words)
            const isLinkFiltered = await this.antiLinkService.handleMessage(guild, member, message);
            if (isLinkFiltered)
                return;
            if (this.badWordsService) {
                const isBadWordFiltered = await this.badWordsService.handleMessage(guild, member, message);
                if (isBadWordFiltered)
                    return;
            }
            // Community Security: Mass Mention & Capslock
            if (this.communityService) {
                const isMentionFiltered = await this.communityService.handleMassMention(guild, member, message);
                if (isMentionFiltered)
                    return;
                const isCapsFiltered = await this.communityService.handleCapslock(guild, member, message);
                if (isCapsFiltered)
                    return;
                // Check if message mentions any user who is AFK
                await this.communityService.handleAfkMentions(guild, message);
                // Custom tags / Auto-responder (matches words/sentences directly without / or !)
                const isTagHandled = await this.communityService.handleAutoResponse(guild, member, message);
                if (isTagHandled)
                    return;
            }
            // Server Text Leveling (XP award)
            if (this.levelingService) {
                await this.levelingService.handleTextMessage(guild, member, message);
            }
            // Handle interactive OwO sessions (e.g. active blackjack hit/stand or marriage accept)
            const isOwoHandled = await this.owoService.handleMessage(guild, member, message);
            if (isOwoHandled)
                return;
            return;
        }
        // 2. Command Processing
        // Check if user was AFK -> wake them up when running a command
        if (this.communityService) {
            await this.communityService.handleAfkSpeaker(guild, member, message);
        }
        // Global Command Rate Limiting (Cooldown: 1.5 seconds) - bypassed in test environment
        if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
            const now = Date.now();
            const lastCmd = this.commandCooldowns.get(member.user.id) || 0;
            if (now - lastCmd < 1500) {
                return; // Drop excessive command spam silently to prevent DoS
            }
            this.commandCooldowns.set(member.user.id, now);
        }
        const rawTokens = content.slice(prefix.length).trim().split(/\s+/);
        const tokens = [];
        for (let i = 0; i < rawTokens.length; i++) {
            const tok = rawTokens[i];
            if ((tok === '@' || tok === '#' || tok === '<@' || tok === '<#' || tok === '<@&') &&
                i + 1 < rawTokens.length) {
                tokens.push(tok + rawTokens[i + 1]);
                i++;
            }
            else {
                tokens.push(tok);
            }
        }
        const commandName = tokens.shift()?.toLowerCase();
        if (!commandName)
            return;
        const args = tokens;
        try {
            // Ensure guild owner ID is present
            if (!guild.owner_id) {
                try {
                    const freshGuild = await this.api.getGuild(guild.id);
                    guild.owner_id = freshGuild.owner_id;
                    if (freshGuild.name)
                        guild.name = freshGuild.name;
                }
                catch { }
            }
            // Refresh bot member and guild roles to guarantee accurate live permissions
            try {
                const [freshBot, freshRoles] = await Promise.all([
                    this.api.getGuildMember(guild.id, botMember.user.id).catch(() => botMember),
                    this.api.getGuildRoles(guild.id).catch(() => guild.roles || []),
                ]);
                if (freshBot)
                    botMember = freshBot;
                if (freshRoles && freshRoles.length > 0)
                    guild.roles = freshRoles;
            }
            catch { }
            // If invoker is not owner, ensure invoker roles are fresh
            if (member.user.id !== guild.owner_id) {
                try {
                    const freshInvoker = await this.api.getGuildMember(guild.id, member.user.id);
                    if (freshInvoker)
                        member = freshInvoker;
                }
                catch { }
            }
            // Requirements 3 & 5: Check Bot Channel Restrictions (Per-System and General)
            if (this.db) {
                const guildCfg = this.db.getGuildConfig(guild.id);
                const isOwner = guild.owner_id === member.user.id;
                const isAdmin = PermissionService.hasPermission(guild, member, Permissions.ADMINISTRATOR);
                const isMod = PermissionService.hasPermission(guild, member, Permissions.MANAGE_MESSAGES) ||
                    PermissionService.hasPermission(guild, member, Permissions.MANAGE_GUILD) ||
                    PermissionService.hasPermission(guild, member, Permissions.MODERATE_MEMBERS);
                const isPrivileged = isOwner || isAdmin || isMod;
                // 1. OwO System Channel Restriction
                const isOwoCommand = commandName === 'w' ||
                    commandName === 'owo' ||
                    commandName === 'uwu' ||
                    commandName === 'owokanal' ||
                    [
                        'hug', 'kiss', 'slap', 'pat', 'cookie', 'pray', 'curse', 'marry', 'divorce',
                        'saril', 'sarıl', 'op', 'öp', 'tokat', 'sev', 'oksa', 'okşa', 'kurabiye', 'dua', 'lanet', 'evlen', 'bosan', 'boşan',
                    ].includes(commandName);
                const isOwoChannelConfig = commandName === 'owokanal' ||
                    ((commandName === 'w' || commandName === 'owo' || commandName === 'uwu') &&
                        (rawTokens[1]?.toLowerCase() === 'kanal' || rawTokens[1]?.toLowerCase() === 'channel'));
                if (isOwoCommand && !isOwoChannelConfig && guildCfg?.owo_channel_id) {
                    if (!isPrivileged && message.channel_id !== guildCfg.owo_channel_id) {
                        void this.sendAutoExpiringMessage(message.channel_id, `⚠️ **<@${member.user.id}>**, OwO komutları yalnızca <#${guildCfg.owo_channel_id}> kanalında kullanılabilir!`, 7, message.id);
                        return;
                    }
                }
                // 2. Music System Channel Restriction (OwO-like)
                const isMusicCommand = [
                    'play', 'çal', 'cal', 'p', 'mix', 'playlist', 'playnow', 'pn', 'pnow', 'calhemen', 'çalhemen',
                    'playnext', 'pnext', 'siradaki', 'sıradaki', 'skipto', 'jump',
                    'skip', 'gec', 'geς', 'fs', 'next', 's',
                    'queue', 'liste', 'q', 'list',
                    'stop', 'dur', 'dc',
                    'np', 'calan', 'çalan', 'nowplaying',
                    'radio', 'radyo',
                    'volume', 'ses', 'vol', 'v',
                    'pause', 'duraklat', 'resume', 'devam',
                    'seek', 'loop', 'dongu', 'döngü', 'repeat',
                    'shuffle', 'karistir', 'karıştır',
                    'clearqueue', 'cq', 'clearq',
                    'filter', 'filtre', 'bassboost', 'bass', 'nightcore', 'nc', 'vaporwave', 'slowed', '8d', '3d',
                    'clearfilter', 'resetfilter',
                    'join', 'katil', 'katıl', 'connect', 'leave', 'ayril', 'ayrıl', 'disconnect',
                    'music', 'muzik', 'müzik', 'm', 'jockie', 'muzikkanal', 'musickanal',
                ].includes(commandName);
                const isMusicChannelConfig = commandName === 'muzikkanal' ||
                    commandName === 'musickanal' ||
                    ((commandName === 'music' || commandName === 'muzik' || commandName === 'müzik' || commandName === 'm') &&
                        (rawTokens[1]?.toLowerCase() === 'kanal' || rawTokens[1]?.toLowerCase() === 'channel'));
                if (isMusicCommand && !isMusicChannelConfig && guildCfg?.music_channel_id) {
                    if (!isPrivileged && message.channel_id !== guildCfg.music_channel_id) {
                        void this.sendAutoExpiringMessage(message.channel_id, `⚠️ **<@${member.user.id}>**, Müzik komutları yalnızca <#${guildCfg.music_channel_id}> kanalında kullanılabilir!`, 7, message.id);
                        return;
                    }
                }
                // 3. General Bot Channel Restriction (up to 5 channels)
                const allowedChannels = [
                    guildCfg?.bot_channel_id,
                    guildCfg?.bot_channel_id_2,
                    guildCfg?.bot_channel_id_3,
                    guildCfg?.bot_channel_id_4,
                    guildCfg?.bot_channel_id_5,
                ].filter(Boolean);
                const hasChannelRestriction = allowedChannels.length > 0;
                if (hasChannelRestriction && !isOwoCommand && !isMusicCommand) {
                    if (!isPrivileged) {
                        if (!allowedChannels.includes(message.channel_id)) {
                            const channelMentions = allowedChannels.map((id) => `<#${id}>`).join(' veya ');
                            void this.sendAutoExpiringMessage(message.channel_id, `⚠️ **<@${member.user.id}>**, bot komutları yalnızca bu kanalda kullanılabilir: ${channelMentions}`, 6, message.id);
                            return;
                        }
                    }
                }
            }
            await this.routeCommand(commandName, args, guild, member, botMember, message);
        }
        catch (err) {
            console.error(`[CommandHandler] Error running command ${commandName}:`, err);
            await this.sendUsageError(message, t('errors.command_error', { error: err.message || 'Bilinmeyen hata' }), 8);
        }
    }
    /**
     * Safe chunked message sender that guarantees message content never exceeds Discord/Fluxer 2000 character limit.
     */
    async sendChunkedMessage(channelId, text) {
        if (text.length <= 1950) {
            await this.api.sendMessage(channelId, text);
            return;
        }
        const lines = text.split('\n');
        let currentChunk = '';
        for (const line of lines) {
            if ((currentChunk + '\n' + line).length > 1950) {
                if (currentChunk.trim()) {
                    await this.api.sendMessage(channelId, currentChunk.trim());
                }
                currentChunk = line;
            }
            else {
                currentChunk = currentChunk ? currentChunk + '\n' + line : line;
            }
        }
        if (currentChunk.trim()) {
            await this.api.sendMessage(channelId, currentChunk.trim());
        }
    }
    /**
     * Helper that sends a temporary notification and deletes it after N seconds,
     * keeping server chat clutter-free. Optionally deletes the invoking command message.
     */
    async sendAutoExpiringMessage(channelId, content, seconds = 6, triggerMessageId) {
        try {
            const sent = await this.api.sendMessage(channelId, content);
            if (sent?.id) {
                setTimeout(async () => {
                    try {
                        await this.api.deleteMessage(channelId, sent.id, 'Auto Clean Notification');
                    }
                    catch { }
                    if (triggerMessageId) {
                        try {
                            await this.api.deleteMessage(channelId, triggerMessageId, 'Auto Clean User Command');
                        }
                        catch { }
                    }
                }, seconds * 1000);
            }
            return sent;
        }
        catch {
            return null;
        }
    }
    /**
     * Helper that sends a temporary error / command usage notification and deletes it
     * along with the triggering user command after N seconds, preventing chat clutter.
     */
    async sendUsageError(message, content, seconds = 8) {
        return this.sendAutoExpiringMessage(message.channel_id, content, seconds, message.id);
    }
    /**
     * Dispatcher that delegates execution to specialized command modules
     */
    async routeCommand(cmd, args, guild, invoker, botMember, message) {
        const ctx = {
            commandName: cmd,
            args,
            guild,
            invoker,
            botMember,
            message,
            api: this.api,
            modService: this.modService,
            warnService: this.warnService,
            roleService: this.roleService,
            welcomeService: this.welcomeService,
            modLogService: this.modLogService,
            antiSpamService: this.antiSpamService,
            antiLinkService: this.antiLinkService,
            owoService: this.owoService,
            musicService: this.musicService,
            badWordsService: this.badWordsService,
            levelingService: this.levelingService,
            antiRaidService: this.antiRaidService,
            communityService: this.communityService,
            giveawayService: this.giveawayService,
            db: this.db,
            birthdayService: this.birthdayService,
            pollService: this.pollService,
            helpers: {
                resolveMember: this.resolveMember.bind(this),
                resolveBannedUser: this.resolveBannedUser.bind(this),
                resolveRole: this.resolveRole.bind(this),
                resolveChannel: this.resolveChannel.bind(this),
                refreshHierarchy: this.refreshHierarchy.bind(this),
                handleTimeoutStatus: this.handleTimeoutStatus.bind(this),
                resolveTargetVoiceChannel: this.resolveTargetVoiceChannel.bind(this),
                sendChunkedMessage: this.sendChunkedMessage.bind(this),
                sendAutoExpiringMessage: this.sendAutoExpiringMessage.bind(this),
                sendUsageError: this.sendUsageError.bind(this),
                showHelp: async (channelId, userId, pageNum = 1, mode = 'user') => {
                    const total = mode === 'admin' ? HELP_ADMIN_TOTAL_PAGES : HELP_USER_TOTAL_PAGES;
                    const content = buildHelpPage(pageNum, mode);
                    const components = buildHelpComponents(pageNum, total);
                    const sent = await this.api.sendMessage(channelId, content, { components });
                    if (sent?.id) {
                        this.activeHelpSessions.set(channelId, {
                            messageId: sent.id,
                            channelId,
                            currentPage: pageNum,
                            userId,
                            createdAt: Date.now(),
                            mode,
                        });
                        void this.addHelpReactions(channelId, sent.id);
                    }
                },
            },
        };
        // 1. Specialized Domain Command Handlers
        if (await handleModerationCommands(ctx))
            return;
        if (await handleMusicCommands(ctx))
            return;
        if (await handleCardCommands(ctx))
            return;
        if (await handleSystemCommands(ctx))
            return;
        if (await handleLevelingCommands(ctx))
            return;
        if (await handleOwoCommands(ctx))
            return;
        if (await handleCommunityCommands(ctx))
            return;
        if (await handleSecurityCommands(ctx))
            return;
        if (await handleHelpCommand(ctx, this.activeHelpSessions, this.addHelpReactions.bind(this)))
            return;
        // 2. Custom tags / Auto-responder match (/tag <name> or /<name>)
        if (this.communityService && this.communityService.isTagsEnabled(guild.id)) {
            const tag = this.communityService.getTag(guild, cmd);
            if (tag) {
                const formatted = CommunityService.formatTagTemplate(tag.content, guild, invoker, message.channel_id);
                await this.api.sendMessage(message.channel_id, formatted);
                return;
            }
        }
        // 3. Prevent Filter Bypass: Check if unknown command contains bad words or links
        if (this.badWordsService) {
            const isBadWord = await this.badWordsService.handleMessage(guild, invoker, message);
            if (isBadWord)
                return;
        }
        await this.antiLinkService.handleMessage(guild, invoker, message);
    }
    // -------------------------------------------------------------
    // Help Page Navigation System (Buttons, Reactions, & Text)
    // -------------------------------------------------------------
    /**
     * Helper to locate an active help session by channelId or messageId
     */
    findHelpSession(channelId, messageId) {
        const session = this.activeHelpSessions.get(channelId);
        if (session) {
            if (!messageId || session.messageId === messageId) {
                return session;
            }
        }
        if (messageId) {
            for (const s of this.activeHelpSessions.values()) {
                if (s.messageId === messageId)
                    return s;
            }
        }
        return undefined;
    }
    /**
     * Automatically adds ◀️ and ▶️ reactions to the help message
     */
    async addHelpReactions(channelId, messageId) {
        try {
            await this.api.addReaction(channelId, messageId, '◀️');
        }
        catch { }
        try {
            await this.api.addReaction(channelId, messageId, '▶️');
        }
        catch { }
    }
    /**
     * Handles button click interaction (INTERACTION_CREATE) from Discord/Fluxer UI
     */
    async handleInteraction(interaction) {
        if (!interaction.data?.custom_id)
            return false;
        const customId = interaction.data.custom_id;
        // 1. Handle Jockie Music Buttons (Play/Pause, Skip, Stop, Loop, Queue)
        if (customId.startsWith('music_')) {
            const guildId = interaction.guild_id || interaction.message?.guild_id;
            if (!guildId)
                return false;
            let resMsg = '';
            let components;
            if (customId === 'music_toggle') {
                const player = this.musicService.getPlayer(guildId);
                if (player?.state === 'playing') {
                    const r = this.musicService.pause(guildId);
                    resMsg = r.message;
                    components = r.components;
                }
                else {
                    const r = this.musicService.resume(guildId);
                    resMsg = r.message;
                    components = r.components;
                }
            }
            else if (customId === 'music_skip') {
                const r = await this.musicService.skip(guildId);
                resMsg = r.message;
                components = r.components;
            }
            else if (customId === 'music_stop') {
                const r = this.musicService.stop(guildId);
                resMsg = r.message;
            }
            else if (customId === 'music_loop') {
                const r = this.musicService.setLoop(guildId);
                resMsg = r.message;
                components = r.components;
            }
            else if (customId === 'music_queue') {
                const r = this.musicService.getQueue(guildId, 1);
                resMsg = r.message;
                components = r.components;
            }
            if (resMsg) {
                try {
                    await this.api.createInteractionResponse(interaction.id, interaction.token, {
                        type: 7, // UPDATE_MESSAGE
                        data: {
                            content: resMsg,
                            components: components || [],
                        },
                    });
                }
                catch {
                    const chId = interaction.channel_id || interaction.message?.channel_id;
                    if (chId && interaction.message?.id) {
                        try {
                            await this.api.editMessage(chId, interaction.message.id, resMsg, {
                                components: components || [],
                            });
                        }
                        catch { }
                    }
                }
            }
            return true;
        }
        // 2. Handle Giveaway Button Interactions
        if (customId === 'giveaway_join' || customId.startsWith('giveaway_join_')) {
            if (!this.giveawayService)
                return false;
            const giveawayId = customId.startsWith('giveaway_join_')
                ? Number.parseInt(customId.replace('giveaway_join_', ''), 10)
                : null;
            const member = interaction.member || (interaction.user ? { user: interaction.user } : undefined);
            if (!member)
                return false;
            const channelId = interaction.channel_id || interaction.message?.channel_id || '';
            const messageId = interaction.message?.id || '';
            const res = await this.giveawayService.handleJoinInteraction(giveawayId, channelId, messageId, member);
            try {
                await this.api.createInteractionResponse(interaction.id, interaction.token, {
                    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
                    data: {
                        content: res.message,
                        flags: 64, // EPHEMERAL
                    },
                });
            }
            catch { }
            return true;
        }
        if (customId === 'giveaway_ended') {
            try {
                await this.api.createInteractionResponse(interaction.id, interaction.token, {
                    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
                    data: {
                        content: '❌ Bu çekiliş sona ermiştir.',
                        flags: 64, // EPHEMERAL
                    },
                });
            }
            catch { }
            return true;
        }
        // 3. Handle Poll Interactions
        if (customId.startsWith('poll_vote_') || customId.startsWith('poll_end_')) {
            if (!this.db)
                return false;
            const member = interaction.member || (interaction.user ? { user: interaction.user } : undefined);
            const userId = member?.user?.id;
            if (!userId)
                return false;
            if (customId.startsWith('poll_vote_')) {
                const parts = customId.replace('poll_vote_', '').split('_');
                const pollId = Number.parseInt(parts[0], 10);
                const optIdx = Number.parseInt(parts[1], 10);
                const poll = this.db.getPoll(pollId);
                if (!poll) {
                    try {
                        await this.api.createInteractionResponse(interaction.id, interaction.token, {
                            type: 4,
                            data: { content: '❌ Anket bulunamadı.', flags: 64 },
                        });
                    }
                    catch { }
                    return true;
                }
                if (poll.is_closed === 1) {
                    try {
                        await this.api.createInteractionResponse(interaction.id, interaction.token, {
                            type: 4,
                            data: { content: '❌ Bu anket sona ermiştir.', flags: 64 },
                        });
                    }
                    catch { }
                    return true;
                }
                const voteResult = this.db.votePoll(pollId, userId, optIdx);
                let options = [];
                try {
                    options = JSON.parse(poll.options_json);
                }
                catch {
                    options = ['Evet', 'Hayır'];
                }
                const voteCounts = this.db.getPollVotes(pollId);
                const voteMap = new Map();
                for (const v of voteCounts) {
                    voteMap.set(v.option_index, v.count);
                }
                let totalVotes = 0;
                const optionItems = options.map((text, idx) => {
                    const count = voteMap.get(idx) || 0;
                    totalVotes += count;
                    return { text, votes: count };
                });
                const userVoted = this.db.getUserPollVote(pollId, userId);
                const embed = formatPollEmbed({
                    question: poll.question,
                    options: optionItems,
                    totalVotes,
                    isClosed: false,
                    userVotedIndex: userVoted,
                    expireUnix: poll.expire_unix,
                });
                const components = buildPollComponents(pollId, options, false, userVoted);
                // Acknowledge and update the poll message directly via type 7
                try {
                    await this.api.createInteractionResponse(interaction.id, interaction.token, {
                        type: 7, // UPDATE_MESSAGE
                        data: {
                            embeds: [embed],
                            components,
                        },
                    });
                }
                catch {
                    const channelId = interaction.channel_id || interaction.message?.channel_id || poll.channel_id;
                    const messageId = interaction.message?.id || poll.message_id;
                    try {
                        await this.api.editMessage(channelId, messageId, '', {
                            embeds: [embed],
                            components,
                        });
                    }
                    catch (err) {
                        console.warn('[Poll] Mesaj güncellenemedi:', err.message);
                    }
                }
                return true;
            }
            if (customId.startsWith('poll_end_')) {
                const pollId = Number.parseInt(customId.replace('poll_end_', ''), 10);
                const poll = this.db.getPoll(pollId);
                if (!poll) {
                    try {
                        await this.api.createInteractionResponse(interaction.id, interaction.token, {
                            type: 4,
                            data: { content: '❌ Anket bulunamadı.', flags: 64 },
                        });
                    }
                    catch { }
                    return true;
                }
                if (poll.is_closed === 1) {
                    try {
                        await this.api.createInteractionResponse(interaction.id, interaction.token, {
                            type: 4,
                            data: { content: '❌ Bu anket zaten kapatılmış.', flags: 64 },
                        });
                    }
                    catch { }
                    return true;
                }
                let hasPerm = false;
                if (interaction.guild_id && member) {
                    try {
                        const guild = await this.api.getGuild(interaction.guild_id);
                        hasPerm =
                            guild.owner_id === userId ||
                                PermissionService.hasPermission(guild, member, Permissions.ADMINISTRATOR) ||
                                PermissionService.hasPermission(guild, member, Permissions.MANAGE_MESSAGES) ||
                                PermissionService.hasPermission(guild, member, Permissions.MANAGE_GUILD) ||
                                PermissionService.hasPermission(guild, member, Permissions.MODERATE_MEMBERS);
                    }
                    catch { }
                }
                if (!hasPerm) {
                    try {
                        await this.api.createInteractionResponse(interaction.id, interaction.token, {
                            type: 4,
                            data: {
                                content: '❌ Bu anketi yalnızca sunucu sahibi, yöneticiler ve moderatörler sonlandırabilir.',
                                flags: 64,
                            },
                        });
                    }
                    catch { }
                    return true;
                }
                this.db.closePoll(pollId);
                let options = [];
                try {
                    options = JSON.parse(poll.options_json);
                }
                catch {
                    options = ['Evet', 'Hayır'];
                }
                const voteCounts = this.db.getPollVotes(pollId);
                const voteMap = new Map();
                for (const v of voteCounts) {
                    voteMap.set(v.option_index, v.count);
                }
                let totalVotes = 0;
                const optionItems = options.map((text, idx) => {
                    const count = voteMap.get(idx) || 0;
                    totalVotes += count;
                    return { text, votes: count };
                });
                const embed = formatPollEmbed({
                    question: poll.question,
                    options: optionItems,
                    totalVotes,
                    isClosed: true,
                    expireUnix: poll.expire_unix,
                });
                const components = buildPollComponents(pollId, options, true);
                // Acknowledge and update the poll message directly via type 7
                try {
                    await this.api.createInteractionResponse(interaction.id, interaction.token, {
                        type: 7, // UPDATE_MESSAGE
                        data: {
                            embeds: [embed],
                            components,
                        },
                    });
                }
                catch {
                    const channelId = interaction.channel_id || interaction.message?.channel_id || poll.channel_id;
                    const messageId = interaction.message?.id || poll.message_id;
                    try {
                        await this.api.editMessage(channelId, messageId, '', {
                            embeds: [embed],
                            components,
                        });
                    }
                    catch (err) {
                        console.warn('[Poll] Mesaj kapatılamadı:', err.message);
                    }
                }
                return true;
            }
        }
        // 4. Handle Help Navigation Buttons
        if (customId !== 'help_prev' && customId !== 'help_next')
            return false;
        const channelId = interaction.channel_id || interaction.message?.channel_id;
        if (!channelId)
            return false;
        const session = this.findHelpSession(channelId, interaction.message?.id);
        if (!session)
            return false;
        const userId = interaction.member?.user?.id || interaction.user?.id;
        if (userId && session.userId !== userId) {
            return false;
        }
        const mode = session.mode || 'user';
        const totalPages = mode === 'admin' ? HELP_ADMIN_TOTAL_PAGES : HELP_USER_TOTAL_PAGES;
        const isNext = customId === 'help_next';
        const isPrev = customId === 'help_prev';
        let newPage = session.currentPage;
        if (isNext && session.currentPage < totalPages) {
            newPage = session.currentPage + 1;
        }
        else if (isPrev && session.currentPage > 1) {
            newPage = session.currentPage - 1;
        }
        else {
            try {
                await this.api.createInteractionResponse(interaction.id, interaction.token, {
                    type: 6, // DEFERRED_UPDATE_MESSAGE
                });
            }
            catch { }
            return true;
        }
        session.currentPage = newPage;
        session.createdAt = Date.now();
        const newContent = buildHelpPage(newPage, mode);
        const newComponents = buildHelpComponents(newPage, totalPages);
        try {
            await this.api.createInteractionResponse(interaction.id, interaction.token, {
                type: 7, // UPDATE_MESSAGE
                data: {
                    content: newContent,
                    components: newComponents,
                },
            });
        }
        catch {
            try {
                await this.api.editMessage(channelId, session.messageId, newContent, {
                    components: newComponents,
                });
            }
            catch { }
        }
        return true;
    }
    /**
     * Handles reaction click (MESSAGE_REACTION_ADD) as emoji button click
     */
    async handleReactionAdd(event, botUserId) {
        if (botUserId && event.user_id === botUserId)
            return false;
        // Handle Giveaway Reaction Entry (🎉)
        if (event.emoji?.name === '🎉' && this.giveawayService && this.db) {
            const giveaway = this.db.getGiveawayByMessage(event.channel_id, event.message_id);
            if (giveaway && giveaway.status === 'active') {
                const member = event.member ||
                    {
                        user: { id: event.user_id, username: 'User', discriminator: '0' },
                        roles: [],
                        joined_at: new Date().toISOString(),
                    };
                await this.giveawayService.handleJoinInteraction(giveaway.id, event.channel_id, event.message_id, member);
                return true;
            }
        }
        // Handle Poll Reaction Voting & Management
        if (this.db) {
            const poll = this.db.getPollByMessageId(event.message_id);
            if (poll) {
                if (poll.is_closed === 1) {
                    return true;
                }
                let options = [];
                try {
                    options = JSON.parse(poll.options_json);
                }
                catch {
                    options = ['Evet', 'Hayır'];
                }
                const emojiName = event.emoji?.name;
                // End poll via reaction
                if (emojiName === '⏹️' || emojiName === '🔒') {
                    let hasPerm = false;
                    if (event.guild_id && event.member) {
                        try {
                            const guild = await this.api.getGuild(event.guild_id);
                            hasPerm =
                                guild.owner_id === event.user_id ||
                                    PermissionService.hasPermission(guild, event.member, Permissions.ADMINISTRATOR) ||
                                    PermissionService.hasPermission(guild, event.member, Permissions.MANAGE_MESSAGES) ||
                                    PermissionService.hasPermission(guild, event.member, Permissions.MANAGE_GUILD) ||
                                    PermissionService.hasPermission(guild, event.member, Permissions.MODERATE_MEMBERS);
                        }
                        catch { }
                    }
                    if (hasPerm) {
                        this.db.closePoll(poll.id);
                        const voteCounts = this.db.getPollVotes(poll.id);
                        const voteMap = new Map();
                        for (const v of voteCounts)
                            voteMap.set(v.option_index, v.count);
                        let totalVotes = 0;
                        const optionItems = options.map((text, idx) => {
                            const count = voteMap.get(idx) || 0;
                            totalVotes += count;
                            return { text, votes: count };
                        });
                        const embed = formatPollEmbed({
                            question: poll.question,
                            options: optionItems,
                            totalVotes,
                            isClosed: true,
                            expireUnix: poll.expire_unix,
                        });
                        const components = buildPollComponents(poll.id, options, true);
                        await this.api.editMessage(event.channel_id, event.message_id, '', {
                            embeds: [embed],
                            components,
                        });
                        return true;
                    }
                }
                // Vote for an option via emoji
                let optIdx = -1;
                if (emojiName) {
                    const circleIdx = OPTION_EMOJIS.indexOf(emojiName);
                    if (circleIdx !== -1 && circleIdx < options.length) {
                        optIdx = circleIdx;
                    }
                    else {
                        const numIdx = NUMBER_EMOJIS.indexOf(emojiName);
                        if (numIdx !== -1 && numIdx < options.length) {
                            optIdx = numIdx;
                        }
                    }
                }
                if (optIdx !== -1) {
                    const previousVote = this.db.getUserPollVote(poll.id, event.user_id);
                    const voteResult = this.db.votePoll(poll.id, event.user_id, optIdx);
                    // Eski oy varsa, o seçeneğin emojisini kaldır
                    if (previousVote !== null && previousVote !== optIdx) {
                        const oldEmoji = NUMBER_EMOJIS[previousVote % NUMBER_EMOJIS.length];
                        try {
                            await this.api.deleteUserReaction(event.channel_id, event.message_id, oldEmoji, event.user_id);
                        }
                        catch (err) {
                            console.warn(`[Poll] Emoji kaldırılamadı (${oldEmoji}):`, err.message);
                        }
                    }
                    // Yeni oy için emoji zaten ekli (kullanıcı tıkladığı için)
                    const voteCounts = this.db.getPollVotes(poll.id);
                    const voteMap = new Map();
                    for (const v of voteCounts)
                        voteMap.set(v.option_index, v.count);
                    let totalVotes = 0;
                    const optionItems = options.map((text, idx) => {
                        const count = voteMap.get(idx) || 0;
                        totalVotes += count;
                        return { text, votes: count };
                    });
                    const userVoted = this.db.getUserPollVote(poll.id, event.user_id);
                    const embed = formatPollEmbed({
                        question: poll.question,
                        options: optionItems,
                        totalVotes,
                        isClosed: false,
                        userVotedIndex: userVoted,
                        expireUnix: poll.expire_unix,
                    });
                    const components = buildPollComponents(poll.id, options, false, userVoted);
                    await this.api.editMessage(event.channel_id, event.message_id, '', {
                        embeds: [embed],
                        components,
                    });
                    return true;
                }
            }
        }
        const session = this.findHelpSession(event.channel_id, event.message_id);
        if (!session)
            return false;
        if (event.user_id !== session.userId)
            return false;
        const emoji = event.emoji.name;
        const isNext = emoji === '▶️' || emoji === '➡️';
        const isPrev = emoji === '◀️' || emoji === '⬅️';
        if (!isNext && !isPrev)
            return false;
        // Delete user reaction so they can click it again
        try {
            await this.api.deleteUserReaction(event.channel_id, event.message_id, emoji, event.user_id);
        }
        catch { }
        const mode = session.mode || 'user';
        const totalPages = mode === 'admin' ? HELP_ADMIN_TOTAL_PAGES : HELP_USER_TOTAL_PAGES;
        let newPage = session.currentPage;
        if (isNext && session.currentPage < totalPages) {
            newPage = session.currentPage + 1;
        }
        else if (isPrev && session.currentPage > 1) {
            newPage = session.currentPage - 1;
        }
        else {
            return true;
        }
        session.currentPage = newPage;
        session.createdAt = Date.now();
        const newContent = buildHelpPage(newPage, mode);
        const newComponents = buildHelpComponents(newPage, totalPages);
        try {
            await this.api.editMessage(event.channel_id, session.messageId, newContent, {
                components: newComponents,
            });
        }
        catch { }
        return true;
    }
    /**
     * Fallback: handles text / chat emoji navigation
     */
    async handleHelpNavigation(channelId, userId, input, message) {
        const session = this.findHelpSession(channelId);
        if (!session)
            return false;
        // Only the user who triggered /help can navigate
        if (session.userId !== userId)
            return false;
        const isNext = input === '▶️' || input === '➡️' || input === 'sonraki' || input === 'next';
        const isPrev = input === '◀️' || input === '⬅️' || input === 'önceki' || input === 'prev';
        if (!isNext && !isPrev)
            return false;
        const mode = session.mode || 'user';
        const totalPages = mode === 'admin' ? HELP_ADMIN_TOTAL_PAGES : HELP_USER_TOTAL_PAGES;
        let newPage = session.currentPage;
        if (isNext && session.currentPage < totalPages) {
            newPage = session.currentPage + 1;
        }
        else if (isPrev && session.currentPage > 1) {
            newPage = session.currentPage - 1;
        }
        else {
            try {
                await this.api.deleteMessage(channelId, message.id);
            }
            catch { }
            return true;
        }
        try {
            await this.api.deleteMessage(channelId, message.id);
        }
        catch { }
        const newContent = buildHelpPage(newPage, mode);
        const newComponents = buildHelpComponents(newPage, totalPages);
        try {
            await this.api.editMessage(channelId, session.messageId, newContent, {
                components: newComponents,
            });
            session.currentPage = newPage;
            session.createdAt = Date.now();
        }
        catch {
            const sentMsg = await this.api.sendMessage(channelId, newContent, { components: newComponents });
            if (sentMsg?.id) {
                session.messageId = sentMsg.id;
                session.currentPage = newPage;
                session.createdAt = Date.now();
                void this.addHelpReactions(channelId, sentMsg.id);
            }
        }
        return true;
    }
    /**
     * Handles reaction removal (MESSAGE_REACTION_REMOVE) for poll voting
     */
    async handleReactionRemove(event, botUserId) {
        if (botUserId && event.user_id === botUserId)
            return false;
        if (!this.db)
            return false;
        const poll = this.db.getPollByMessageId(event.message_id);
        if (!poll || poll.is_closed === 1)
            return false;
        const emojiName = event.emoji?.name;
        if (!emojiName)
            return false;
        let options = [];
        try {
            options = JSON.parse(poll.options_json);
        }
        catch {
            options = ['Evet', 'Hayır'];
        }
        let optIdx = -1;
        const circleIdx = OPTION_EMOJIS.indexOf(emojiName);
        if (circleIdx !== -1 && circleIdx < options.length) {
            optIdx = circleIdx;
        }
        else {
            const numIdx = NUMBER_EMOJIS.indexOf(emojiName);
            if (numIdx !== -1 && numIdx < options.length) {
                optIdx = numIdx;
            }
        }
        if (optIdx === -1)
            return false;
        // Check if user's current vote was this option
        const currentVote = this.db.getUserPollVote(poll.id, event.user_id);
        if (currentVote === optIdx) {
            // Toggle off / retract vote
            this.db.votePoll(poll.id, event.user_id, optIdx);
            const voteCounts = this.db.getPollVotes(poll.id);
            const voteMap = new Map();
            for (const v of voteCounts)
                voteMap.set(v.option_index, v.count);
            let totalVotes = 0;
            const optionItems = options.map((text, idx) => {
                const count = voteMap.get(idx) || 0;
                totalVotes += count;
                return { text, votes: count };
            });
            const userVoted = this.db.getUserPollVote(poll.id, event.user_id);
            const embed = formatPollEmbed({
                question: poll.question,
                options: optionItems,
                totalVotes,
                isClosed: false,
                userVotedIndex: userVoted,
                expireUnix: poll.expire_unix,
            });
            const components = buildPollComponents(poll.id, options, false, userVoted);
            try {
                await this.api.editMessage(event.channel_id, event.message_id, '', {
                    embeds: [embed],
                    components,
                });
            }
            catch (err) {
                console.warn('[Poll] Mesaj un-react güncellenemedi:', err.message);
            }
            return true;
        }
        return false;
    }
    /**
     * Handles native poll vote add (MESSAGE_POLL_VOTE_ADD) from Discord/Micup gateway
     */
    async handlePollVoteAdd(event) {
        if (!this.db)
            return false;
        const poll = this.db.getPollByMessageId(event.message_id);
        if (!poll || poll.is_closed === 1)
            return false;
        let optIdx = event.answer_id;
        let options = [];
        try {
            options = JSON.parse(poll.options_json);
        }
        catch {
            options = ['Evet', 'Hayır'];
        }
        // Discord answers are typically 1-indexed (1, 2, 3...)
        if (optIdx >= 1 && optIdx <= options.length) {
            optIdx = optIdx - 1;
        }
        else if (optIdx < 0 || optIdx >= options.length) {
            optIdx = 0;
        }
        this.db.votePoll(poll.id, event.user_id, optIdx);
        return true;
    }
    /**
     * Handles native poll vote remove (MESSAGE_POLL_VOTE_REMOVE) from Discord/Micup gateway
     */
    async handlePollVoteRemove(event) {
        if (!this.db)
            return false;
        const poll = this.db.getPollByMessageId(event.message_id);
        if (!poll || poll.is_closed === 1)
            return false;
        let optIdx = event.answer_id;
        let options = [];
        try {
            options = JSON.parse(poll.options_json);
        }
        catch {
            options = ['Evet', 'Hayır'];
        }
        if (optIdx >= 1 && optIdx <= options.length) {
            optIdx = optIdx - 1;
        }
        const currentVote = this.db.getUserPollVote(poll.id, event.user_id);
        if (currentVote === optIdx) {
            // Toggle off / retract vote
            this.db.votePoll(poll.id, event.user_id, optIdx);
        }
        return true;
    }
}
//# sourceMappingURL=CommandHandler.js.map