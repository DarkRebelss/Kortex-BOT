// SPDX-License-Identifier: AGPL-3.0-or-later
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/env.js';
export class DatabaseClient {
    db;
    dbFilePath;
    constructor(customPath) {
        const dbPath = customPath || config.databasePath;
        this.dbFilePath = dbPath;
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.db = new DatabaseSync(dbPath);
        this.init();
    }
    init() {
        this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS guild_configs (
        guild_id TEXT PRIMARY KEY,
        welcome_channel_id TEXT,
        welcome_message TEXT DEFAULT '👋 Hoş geldin {user}! Sunucuya katılan **{memberCount}.** üyemizsin.',
        welcome_enabled INTEGER DEFAULT 0,
        goodbye_channel_id TEXT,
        goodbye_message TEXT DEFAULT '👋 **{username}** sunucudan ayrıldı. Kalan üye sayısı: **{memberCount}**.',
        goodbye_enabled INTEGER DEFAULT 0,
        modlog_channel_id TEXT,
        autorole_id TEXT,
        autorole_enabled INTEGER DEFAULT 0,
        antispam_enabled INTEGER DEFAULT 0,
        antispam_max_messages INTEGER DEFAULT 8,
        antispam_interval_seconds INTEGER DEFAULT 5,
        antispam_punishment TEXT DEFAULT 'timeout',
        antispam_exempt_mods INTEGER DEFAULT 1,
        antilink_enabled INTEGER DEFAULT 0,
        antilink_whitelist TEXT DEFAULT '[]',
        antilink_exempt_mods INTEGER DEFAULT 0,
        welcome_card_color TEXT DEFAULT '#10b981',
        welcome_card_accent_color TEXT DEFAULT '#34d399',
        welcome_card_logo_url TEXT DEFAULT NULL,
        welcome_card_slogan TEXT DEFAULT NULL,
        welcome_card_subtitle TEXT DEFAULT NULL,
        goodbye_card_color TEXT DEFAULT '#f43f5e',
        goodbye_card_accent_color TEXT DEFAULT '#fb7185',
        goodbye_card_logo_url TEXT DEFAULT NULL,
        goodbye_card_slogan TEXT DEFAULT NULL,
        goodbye_card_subtitle TEXT DEFAULT NULL,
        owo_channel_id TEXT DEFAULT NULL,
        music_channel_id TEXT DEFAULT NULL,
        bot_language TEXT DEFAULT 'tr',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id, active);

      CREATE TABLE IF NOT EXISTS moderation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        target_user_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        channel_id TEXT,
        reason TEXT,
        details TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_modlogs_guild ON moderation_logs(guild_id, created_at);
      CREATE TABLE IF NOT EXISTS active_timeouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        reason TEXT NOT NULL,
        duration_text TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        expire_unix INTEGER NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        message_type TEXT DEFAULT 'mute',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_active_timeouts_guild_user ON active_timeouts(guild_id, user_id);

      CREATE TABLE IF NOT EXISTS owo_users (
        user_id TEXT PRIMARY KEY,
        cowoncy INTEGER DEFAULT 500,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        hp INTEGER DEFAULT 100,
        max_hp INTEGER DEFAULT 100,
        strength INTEGER DEFAULT 10,
        weapon TEXT DEFAULT 'punch',
        ring TEXT DEFAULT NULL,
        pray_count INTEGER DEFAULT 0,
        curse_count INTEGER DEFAULT 0,
        last_hunt_unix INTEGER DEFAULT 0,
        last_battle_unix INTEGER DEFAULT 0,
        last_pray_unix INTEGER DEFAULT 0,
        last_daily_unix INTEGER DEFAULT 0,
        daily_streak INTEGER DEFAULT 0,
        total_hunts INTEGER DEFAULT 0,
        total_battles INTEGER DEFAULT 0,
        battles_won INTEGER DEFAULT 0,
        crates INTEGER DEFAULT 0,
        lootboxes INTEGER DEFAULT 0,
        last_guild_id TEXT DEFAULT NULL,
        last_guild_name TEXT DEFAULT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS owo_zoo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        animal_id TEXT NOT NULL,
        animal_name TEXT NOT NULL,
        tier TEXT NOT NULL,
        count INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id, animal_id)
      );

      CREATE INDEX IF NOT EXISTS idx_owo_zoo_user ON owo_zoo(user_id);

      CREATE TABLE IF NOT EXISTS owo_quests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        quest_date TEXT NOT NULL,
        quest_type TEXT NOT NULL,
        description TEXT NOT NULL,
        target_count INTEGER NOT NULL,
        current_count INTEGER DEFAULT 0,
        reward_cowoncy INTEGER NOT NULL,
        reward_xp INTEGER NOT NULL,
        claimed INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_owo_quests_user_date ON owo_quests(user_id, quest_date);

      CREATE TABLE IF NOT EXISTS owo_teams (
        user_id TEXT PRIMARY KEY,
        slot1 TEXT,
        slot2 TEXT,
        slot3 TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS guild_user_levels (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT DEFAULT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        message_count INTEGER DEFAULT 0,
        voice_seconds INTEGER DEFAULT 0,
        last_message_unix INTEGER DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_guild_user_levels_rank ON guild_user_levels(guild_id, level DESC, xp DESC);

      CREATE TABLE IF NOT EXISTS guild_level_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        level INTEGER NOT NULL,
        role_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(guild_id, level)
      );

      CREATE INDEX IF NOT EXISTS idx_guild_level_roles ON guild_level_roles(guild_id);

      CREATE TABLE IF NOT EXISTS afk_users (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        afk_since_unix INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS giveaways (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        prize TEXT NOT NULL,
        winner_count INTEGER NOT NULL,
        end_unix INTEGER NOT NULL,
        status TEXT DEFAULT 'active',
        host_id TEXT NOT NULL,
        participants TEXT DEFAULT '[]',
        winners TEXT DEFAULT '[]',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_giveaways_status ON giveaways(status, end_unix);

      CREATE TABLE IF NOT EXISTS custom_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(guild_id, name)
      );

      CREATE INDEX IF NOT EXISTS idx_custom_tags_guild ON custom_tags(guild_id);
    `);
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN antilink_exempt_mods INTEGER DEFAULT 0;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN antispam_exempt_mods INTEGER DEFAULT 1;`);
        }
        catch { }
        try {
            this.db.exec(`UPDATE guild_configs SET antispam_exempt_mods = 1 WHERE antispam_exempt_mods IS NULL;`);
        }
        catch { }
        // Add badwords and leveling columns to guild_configs
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN badwords_enabled INTEGER DEFAULT 0;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN badwords_filter_default INTEGER DEFAULT 1;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN badwords_custom TEXT DEFAULT '[]';`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN badwords_exempt_mods INTEGER DEFAULT 1;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN badwords_punishment TEXT DEFAULT 'warn';`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN leveling_enabled INTEGER DEFAULT 1;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN leveling_channel_id TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN leveling_message TEXT DEFAULT '🎉 Tebrikler {user}! Sunucudaki sohbet ve etkinliğin sayesinde Seviye {level} seviyesine ulaştın! 🚀';`);
        }
        catch { }
        try {
            this.db.exec(`UPDATE guild_configs SET leveling_message = '🎉 Tebrikler {user}! Sunucudaki sohbet ve etkinliğin sayesinde Seviye {level} seviyesine ulaştın! 🚀' WHERE leveling_message IS NULL OR leveling_message LIKE '%Seviyeye%';`);
        }
        catch { }
        // Add antiraid, massmention and capslock columns to guild_configs
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN antiraid_enabled INTEGER DEFAULT 0;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN antiraid_threshold INTEGER DEFAULT 8;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN antiraid_action TEXT DEFAULT 'kick';`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN massmention_enabled INTEGER DEFAULT 1;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN massmention_limit INTEGER DEFAULT 5;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN capslock_enabled INTEGER DEFAULT 0;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN capslock_percentage INTEGER DEFAULT 70;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN tags_enabled INTEGER DEFAULT 1;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN bot_channel_id TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN bot_channel_id_2 TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN bot_channel_id_3 TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN bot_channel_id_4 TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN bot_channel_id_5 TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN giveaway_channel_id TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN poll_channel_id TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN birthday_channel_id TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN birthday_message TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN birthday_enabled INTEGER DEFAULT 1;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN welcome_card_color TEXT DEFAULT '#8b5cf6';`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN welcome_card_accent_color TEXT DEFAULT '#c084fc';`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN welcome_card_logo_url TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN welcome_card_slogan TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN welcome_card_subtitle TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN goodbye_card_color TEXT DEFAULT '#f43f5e';`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN goodbye_card_accent_color TEXT DEFAULT '#fb7185';`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN goodbye_card_logo_url TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN goodbye_card_slogan TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN goodbye_card_subtitle TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN owo_channel_id TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_configs ADD COLUMN music_channel_id TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE guild_user_levels ADD COLUMN username TEXT DEFAULT NULL;`);
        }
        catch { }
        // Add new columns to owo_users
        try {
            this.db.exec(`ALTER TABLE owo_users ADD COLUMN weapon_level INTEGER DEFAULT 0;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE owo_users ADD COLUMN married_to TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE owo_users ADD COLUMN married_at TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE owo_users ADD COLUMN daily_reminder INTEGER DEFAULT 0;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE owo_users ADD COLUMN last_guild_id TEXT DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE owo_users ADD COLUMN last_guild_name TEXT DEFAULT NULL;`);
        }
        catch { }
        // Birthdays table
        try {
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS birthdays (
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          day INTEGER NOT NULL,
          month INTEGER NOT NULL,
          year INTEGER,
          last_celebrated_year INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          username TEXT DEFAULT NULL,
          PRIMARY KEY (guild_id, user_id)
        );
      `);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE birthdays ADD COLUMN username TEXT DEFAULT NULL;`);
        }
        catch { }
        // Persistent User Names Cache table
        try {
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS user_names (
          user_id TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          display_name TEXT DEFAULT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_user_names_username ON user_names(username COLLATE NOCASE);
      `);
        }
        catch { }
        // Temp bans table
        try {
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS temp_bans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          moderator_id TEXT NOT NULL,
          reason TEXT NOT NULL,
          duration_text TEXT NOT NULL,
          duration_seconds INTEGER NOT NULL,
          expire_unix INTEGER NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_temp_bans_guild_user ON temp_bans(guild_id, user_id);
      `);
        }
        catch { }
        // Polls & Poll Votes tables
        try {
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS polls (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          message_id TEXT NOT NULL,
          author_id TEXT NOT NULL,
          question TEXT NOT NULL,
          options_json TEXT NOT NULL,
          is_closed INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_polls_msg ON polls(message_id);

        CREATE TABLE IF NOT EXISTS poll_votes (
          poll_id INTEGER NOT NULL,
          user_id TEXT NOT NULL,
          option_index INTEGER NOT NULL,
          voted_at TEXT NOT NULL,
          PRIMARY KEY (poll_id, user_id)
        );
      `);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE polls ADD COLUMN duration_seconds INTEGER DEFAULT NULL;`);
        }
        catch { }
        try {
            this.db.exec(`ALTER TABLE polls ADD COLUMN expire_unix INTEGER DEFAULT NULL;`);
        }
        catch { }
        // Cross-community user guild memberships
        try {
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS user_guild_memberships (
          guild_id TEXT NOT NULL,
          guild_name TEXT NOT NULL,
          user_id TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (guild_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_user_guilds_user ON user_guild_memberships(user_id);
      `);
        }
        catch { }
        // Ensure default welcome card color is Emerald Green (#10b981) and accent (#34d399)
        try {
            this.db.exec(`UPDATE guild_configs SET welcome_card_color = '#10b981' WHERE welcome_card_color = '#6366f1' OR welcome_card_color = '#8b5cf6' OR welcome_card_color IS NULL;`);
            this.db.exec(`UPDATE guild_configs SET welcome_card_accent_color = '#34d399' WHERE welcome_card_accent_color = '#a855f7' OR welcome_card_accent_color = '#c084fc' OR welcome_card_accent_color IS NULL;`);
        }
        catch { }
    }
    // Security: Allowed Column Whitelists to prevent any SQL injection via dynamic object keys
    static ALLOWED_GUILD_CONFIG_COLUMNS = new Set([
        'welcome_channel_id',
        'welcome_message',
        'welcome_enabled',
        'goodbye_channel_id',
        'goodbye_message',
        'goodbye_enabled',
        'modlog_channel_id',
        'autorole_id',
        'autorole_enabled',
        'antispam_enabled',
        'antispam_max_messages',
        'antispam_interval_seconds',
        'antispam_punishment',
        'antilink_enabled',
        'antilink_whitelist',
        'antilink_exempt_mods',
        'antispam_exempt_mods',
        'badwords_enabled',
        'badwords_filter_default',
        'badwords_custom',
        'badwords_exempt_mods',
        'badwords_punishment',
        'leveling_enabled',
        'leveling_channel_id',
        'leveling_message',
        'antiraid_enabled',
        'antiraid_threshold',
        'antiraid_action',
        'massmention_enabled',
        'massmention_limit',
        'capslock_enabled',
        'capslock_percentage',
        'tags_enabled',
        'bot_language',
        'bot_channel_id',
        'bot_channel_id_2',
        'bot_channel_id_3',
        'bot_channel_id_4',
        'bot_channel_id_5',
        'owo_channel_id',
        'music_channel_id',
        'giveaway_channel_id',
        'poll_channel_id',
        'birthday_channel_id',
        'birthday_message',
        'birthday_enabled',
        'welcome_card_color',
        'welcome_card_accent_color',
        'welcome_card_logo_url',
        'welcome_card_slogan',
        'welcome_card_subtitle',
        'goodbye_card_color',
        'goodbye_card_accent_color',
        'goodbye_card_logo_url',
        'goodbye_card_slogan',
        'goodbye_card_subtitle',
    ]);
    static ALLOWED_OWO_USER_COLUMNS = new Set([
        'cowoncy',
        'xp',
        'level',
        'hp',
        'max_hp',
        'strength',
        'weapon',
        'weapon_level',
        'ring',
        'married_to',
        'married_at',
        'daily_reminder',
        'last_guild_id',
        'last_guild_name',
        'pray_count',
        'curse_count',
        'last_hunt_unix',
        'last_battle_unix',
        'last_pray_unix',
        'last_daily_unix',
        'daily_streak',
        'total_hunts',
        'total_battles',
        'battles_won',
        'crates',
        'lootboxes',
    ]);
    static ALLOWED_LEVEL_COLUMNS = new Set([
        'username',
        'xp',
        'level',
        'message_count',
        'voice_seconds',
        'last_xp_awarded_at',
    ]);
    // -------------------------------------------------------------
    // Guild Config Operations
    // -------------------------------------------------------------
    getGuildConfig(guildId) {
        const stmt = this.db.prepare('SELECT * FROM guild_configs WHERE guild_id = ?');
        const row = stmt.get(guildId);
        if (row)
            return row;
        const now = new Date().toISOString();
        const insertStmt = this.db.prepare(`
      INSERT INTO guild_configs (
        guild_id, welcome_channel_id, welcome_message, welcome_enabled,
        goodbye_channel_id, goodbye_message, goodbye_enabled,
        modlog_channel_id, autorole_id, autorole_enabled,
        antispam_enabled, antispam_max_messages, antispam_interval_seconds, antispam_punishment,
        antispam_exempt_mods, antilink_enabled, antilink_whitelist, bot_language, created_at, updated_at
      ) VALUES (
        ?, NULL, '👋 Hoş geldin {user}! Sunucuya katılan **{memberCount}.** üyemizsin.', 0,
        NULL, '👋 **{username}** sunucudan ayrıldı. Kalan üye sayısı: **{memberCount}**.', 0,
        NULL, NULL, 0,
        0, 8, 5, 'timeout',
        1, 0, '[]', 'tr', ?, ?
      )
    `);
        insertStmt.run(guildId, now, now);
        return stmt.get(guildId);
    }
    updateGuildConfig(guildId, updates) {
        this.getGuildConfig(guildId); // Ensure exists
        const keys = Object.keys(updates).filter((k) => DatabaseClient.ALLOWED_GUILD_CONFIG_COLUMNS.has(k));
        if (keys.length === 0)
            return;
        const now = new Date().toISOString();
        const setClauses = keys.map((key) => `${key} = ?`).join(', ') + ', updated_at = ?';
        const values = [...keys.map((key) => updates[key]), now, guildId];
        const stmt = this.db.prepare(`UPDATE guild_configs SET ${setClauses} WHERE guild_id = ?`);
        stmt.run(...values);
    }
    getAllConfiguredGuildIds() {
        try {
            const stmt = this.db.prepare('SELECT guild_id FROM guild_configs');
            const rows = stmt.all();
            return rows.map((r) => r.guild_id);
        }
        catch {
            return [];
        }
    }
    // -------------------------------------------------------------
    // Warning Operations
    // -------------------------------------------------------------
    addWarning(guildId, userId, moderatorId, reason) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO warnings (guild_id, user_id, moderator_id, reason, active, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `);
        const result = stmt.run(guildId, userId, moderatorId, reason, now);
        return {
            id: Number(result.lastInsertRowid),
            guild_id: guildId,
            user_id: userId,
            moderator_id: moderatorId,
            reason,
            active: 1,
            created_at: now,
        };
    }
    getActiveWarnings(guildId, userId) {
        const stmt = this.db.prepare(`
      SELECT * FROM warnings
      WHERE guild_id = ? AND user_id = ? AND active = 1
      ORDER BY id ASC
    `);
        return stmt.all(guildId, userId);
    }
    getWarningById(guildId, warningId) {
        const stmt = this.db.prepare(`
      SELECT * FROM warnings
      WHERE id = ? AND guild_id = ?
    `);
        return stmt.get(warningId, guildId) || null;
    }
    dismissWarning(guildId, warningId) {
        const stmt = this.db.prepare(`
      UPDATE warnings SET active = 0
      WHERE id = ? AND guild_id = ? AND active = 1
    `);
        const result = stmt.run(warningId, guildId);
        return result.changes > 0;
    }
    dismissWarningsByUser(guildId, userId, count = 1) {
        const limit = Math.max(1, Math.min(count, 100));
        const stmt = this.db.prepare(`
      SELECT * FROM warnings
      WHERE guild_id = ? AND user_id = ? AND active = 1
      ORDER BY id DESC
      LIMIT ?
    `);
        const warns = stmt.all(guildId, userId, limit);
        if (warns.length === 0)
            return [];
        const ids = warns.map((w) => w.id);
        const placeholders = ids.map(() => '?').join(', ');
        const updateStmt = this.db.prepare(`
      UPDATE warnings SET active = 0
      WHERE id IN (${placeholders}) AND guild_id = ?
    `);
        updateStmt.run(...ids, guildId);
        return warns;
    }
    // -------------------------------------------------------------
    // Moderation Log Operations
    // -------------------------------------------------------------
    addModerationLog(guildId, actionType, targetUserId, moderatorId, reason = null, channelId = null, details = null) {
        const now = new Date().toISOString();
        const detailsJson = details ? JSON.stringify(details) : null;
        const stmt = this.db.prepare(`
      INSERT INTO moderation_logs (guild_id, action_type, target_user_id, moderator_id, channel_id, reason, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(guildId, actionType, targetUserId, moderatorId, channelId, reason, detailsJson, now);
        return {
            id: Number(result.lastInsertRowid),
            guild_id: guildId,
            action_type: actionType,
            target_user_id: targetUserId,
            moderator_id: moderatorId,
            channel_id: channelId,
            reason,
            details: detailsJson,
            created_at: now,
        };
    }
    getLatestModerationLog(guildId, targetUserId, actionType) {
        if (actionType) {
            const stmt = this.db.prepare(`
        SELECT * FROM moderation_logs
        WHERE guild_id = ? AND target_user_id = ? AND action_type = ?
        ORDER BY id DESC
        LIMIT 1
      `);
            return stmt.get(guildId, targetUserId, actionType) || null;
        }
        const stmt = this.db.prepare(`
      SELECT * FROM moderation_logs
      WHERE guild_id = ? AND target_user_id = ?
      ORDER BY id DESC
      LIMIT 1
    `);
        return stmt.get(guildId, targetUserId) || null;
    }
    getGuildModerationLogs(guildId, limit = 50) {
        const stmt = this.db.prepare(`
      SELECT * FROM moderation_logs
      WHERE guild_id = ?
      ORDER BY id DESC
      LIMIT ?
    `);
        return stmt.all(guildId, limit);
    }
    // -------------------------------------------------------------
    // Active Timeout Message Tracking
    // -------------------------------------------------------------
    saveActiveTimeoutMessage(entry) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO active_timeouts (
        guild_id, user_id, username, reason, duration_text, duration_seconds,
        expire_unix, channel_id, message_id, message_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(entry.guildId, entry.userId, entry.username, entry.reason, entry.durationText, entry.durationSeconds, entry.expireUnix, entry.channelId, entry.messageId, entry.messageType || 'mute', now);
    }
    getActiveTimeoutMessages(guildId, userId) {
        const stmt = this.db.prepare(`
      SELECT * FROM active_timeouts
      WHERE guild_id = ? AND user_id = ?
    `);
        return stmt.all(guildId, userId);
    }
    getAllActiveTimeoutMessages() {
        const stmt = this.db.prepare(`SELECT * FROM active_timeouts`);
        return stmt.all();
    }
    deleteActiveTimeoutMessages(guildId, userId) {
        const stmt = this.db.prepare(`
      DELETE FROM active_timeouts
      WHERE guild_id = ? AND user_id = ?
    `);
        stmt.run(guildId, userId);
    }
    // -------------------------------------------------------------
    // OwO Economy & Zoo Operations
    // -------------------------------------------------------------
    getOwoUser(userId) {
        const stmt = this.db.prepare('SELECT * FROM owo_users WHERE user_id = ?');
        const existing = stmt.get(userId);
        if (existing) {
            if (existing.weapon_level === undefined || existing.weapon_level === null) {
                existing.weapon_level = 0;
            }
            return existing;
        }
        const now = new Date().toISOString();
        const insertStmt = this.db.prepare(`
      INSERT INTO owo_users (
        user_id, cowoncy, xp, level, hp, max_hp, strength, weapon, weapon_level, ring,
        married_to, married_at, daily_reminder, last_guild_id, last_guild_name,
        pray_count, curse_count, last_hunt_unix, last_battle_unix, last_pray_unix,
        last_daily_unix, daily_streak, total_hunts, total_battles, battles_won,
        crates, lootboxes, created_at, updated_at
      ) VALUES (
        ?, 500, 0, 1, 100, 100, 10, 'punch', 0, NULL,
        NULL, NULL, 0, NULL, NULL,
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
        0, 0, ?, ?
      )
    `);
        insertStmt.run(userId, now, now);
        const created = stmt.get(userId);
        if (created.weapon_level === undefined || created.weapon_level === null) {
            created.weapon_level = 0;
        }
        return created;
    }
    updateOwoUser(userId, updates) {
        this.getOwoUser(userId); // Ensure user exists
        const keys = Object.keys(updates).filter((k) => DatabaseClient.ALLOWED_OWO_USER_COLUMNS.has(k));
        if (keys.length === 0)
            return;
        const now = new Date().toISOString();
        const setClauses = keys.map((key) => `${key} = ?`).join(', ') + ', updated_at = ?';
        const values = [...keys.map((key) => updates[key]), now, userId];
        const stmt = this.db.prepare(`UPDATE owo_users SET ${setClauses} WHERE user_id = ?`);
        stmt.run(...values);
    }
    /**
     * Atomically transfers Cowoncy between two users using an immediate SQLite transaction.
     * Completely immune to async double-spend race conditions.
     */
    transferOwoCowoncy(senderId, receiverId, amount) {
        if (amount <= 0 || !Number.isSafeInteger(amount)) {
            return { success: false, senderBalance: 0, receiverBalance: 0, error: 'INVALID_AMOUNT' };
        }
        if (senderId === receiverId) {
            return { success: false, senderBalance: 0, receiverBalance: 0, error: 'CANNOT_SEND_TO_SELF' };
        }
        // Ensure both accounts exist in DB
        this.getOwoUser(senderId);
        this.getOwoUser(receiverId);
        const now = new Date().toISOString();
        try {
            this.db.exec('BEGIN IMMEDIATE');
            // 1. Deduct sender balance atomically ONLY if balance is sufficient
            const deductStmt = this.db.prepare(`
        UPDATE owo_users
        SET cowoncy = cowoncy - ?, updated_at = ?
        WHERE user_id = ? AND cowoncy >= ?
      `);
            const result = deductStmt.run(amount, now, senderId, amount);
            if (!result || result.changes === 0) {
                this.db.exec('ROLLBACK');
                const sender = this.getOwoUser(senderId);
                return { success: false, senderBalance: sender.cowoncy, receiverBalance: 0, error: 'INSUFFICIENT_FUNDS' };
            }
            // 2. Add to receiver balance
            const addStmt = this.db.prepare(`
        UPDATE owo_users
        SET cowoncy = cowoncy + ?, updated_at = ?
        WHERE user_id = ?
      `);
            addStmt.run(amount, now, receiverId);
            this.db.exec('COMMIT');
            const updatedSender = this.getOwoUser(senderId);
            const updatedReceiver = this.getOwoUser(receiverId);
            return {
                success: true,
                senderBalance: updatedSender.cowoncy,
                receiverBalance: updatedReceiver.cowoncy,
            };
        }
        catch (err) {
            try {
                this.db.exec('ROLLBACK');
            }
            catch { }
            console.error('[DatabaseClient] transferOwoCowoncy hatası:', err.message);
            return { success: false, senderBalance: 0, receiverBalance: 0, error: err.message };
        }
    }
    getOwoZoo(userId) {
        const stmt = this.db.prepare(`
      SELECT * FROM owo_zoo
      WHERE user_id = ? AND count > 0
      ORDER BY
        CASE tier
          WHEN 'legendary' THEN 1
          WHEN 'mythical' THEN 2
          WHEN 'epic' THEN 3
          WHEN 'rare' THEN 4
          WHEN 'uncommon' THEN 5
          WHEN 'common' THEN 6
          ELSE 7
        END ASC,
        count DESC
    `);
        return stmt.all(userId);
    }
    addOwoAnimals(userId, animals) {
        this.getOwoUser(userId);
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO owo_zoo (user_id, animal_id, animal_name, tier, count, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(user_id, animal_id) DO UPDATE SET
        count = count + 1,
        updated_at = excluded.updated_at
    `);
        for (const a of animals) {
            const displayName = `${a.emoji} ${a.name}`;
            stmt.run(userId, a.id, displayName, a.tier, now, now);
        }
    }
    sellOwoAnimals(userId, filter, animalPriceMap) {
        const zoo = this.getOwoZoo(userId);
        if (zoo.length === 0) {
            return { totalCount: 0, totalCowoncy: 0, details: 'Hayvanat bahçende satılacak hiç hayvan yok!' };
        }
        const cleanFilter = filter.toLowerCase().trim();
        let toSell = [];
        if (cleanFilter === 'all' || cleanFilter === 'hepsi') {
            toSell = zoo;
        }
        else if (['common', 'uncommon', 'rare', 'epic', 'mythical', 'legendary'].includes(cleanFilter)) {
            toSell = zoo.filter((z) => z.tier.toLowerCase() === cleanFilter);
        }
        else {
            toSell = zoo.filter((z) => z.animal_id.toLowerCase() === cleanFilter ||
                z.animal_name.toLowerCase().includes(cleanFilter));
        }
        if (toSell.length === 0) {
            return { totalCount: 0, totalCowoncy: 0, details: `Belirtilen kritere uygun hayvan bulunamadı (${filter}).` };
        }
        let totalCount = 0;
        let totalCowoncy = 0;
        const deleteStmt = this.db.prepare('DELETE FROM owo_zoo WHERE user_id = ? AND animal_id = ?');
        for (const entry of toSell) {
            const unitPrice = animalPriceMap[entry.animal_id] || 15;
            const earnings = entry.count * unitPrice;
            totalCount += entry.count;
            totalCowoncy += earnings;
            deleteStmt.run(userId, entry.animal_id);
        }
        // Add cowoncy to user
        const user = this.getOwoUser(userId);
        this.updateOwoUser(userId, { cowoncy: user.cowoncy + totalCowoncy });
        return {
            totalCount,
            totalCowoncy,
            details: `Toplam **${totalCount}** adet hayvan satıldı ve **+${totalCowoncy}** 🪙 Cowoncy kazanıldı!`,
        };
    }
    consumeAnimal(userId, animalId) {
        const stmt = this.db.prepare('SELECT count FROM owo_zoo WHERE user_id = ? AND animal_id = ?');
        const row = stmt.get(userId, animalId);
        if (!row || row.count <= 0)
            return false;
        if (row.count === 1) {
            this.db.prepare('DELETE FROM owo_zoo WHERE user_id = ? AND animal_id = ?').run(userId, animalId);
        }
        else {
            this.db.prepare('UPDATE owo_zoo SET count = count - 1 WHERE user_id = ? AND animal_id = ?').run(userId, animalId);
        }
        return true;
    }
    getTopOwoUsersByCash(limit = 10) {
        const stmt = this.db.prepare(`
      SELECT user_id, cowoncy FROM owo_users
      ORDER BY cowoncy DESC
      LIMIT ?
    `);
        return stmt.all(limit);
    }
    getTopOwoUsersByZoo(limit = 10) {
        const stmt = this.db.prepare(`
      SELECT user_id, CAST(SUM(count) AS INTEGER) as total_animals
      FROM owo_zoo
      GROUP BY user_id
      ORDER BY total_animals DESC
      LIMIT ?
    `);
        return stmt.all(limit);
    }
    // -------------------------------------------------------------
    // Daily Quests Operations
    // -------------------------------------------------------------
    getOrCreateDailyQuests(userId, questDate) {
        const fetchStmt = this.db.prepare(`
      SELECT * FROM owo_quests WHERE user_id = ? AND quest_date = ? ORDER BY id ASC
    `);
        const existing = fetchStmt.all(userId, questDate);
        if (existing && existing.length > 0)
            return existing;
        const questPool = [
            {
                quest_type: 'hunt',
                description: '🏹 5 kez avlan (/w hunt)',
                target_count: 5,
                reward_cowoncy: 600,
                reward_xp: 60,
            },
            {
                quest_type: 'battle',
                description: '⚔️ 3 canavar ile savaş (/w battle)',
                target_count: 3,
                reward_cowoncy: 800,
                reward_xp: 80,
            },
            {
                quest_type: 'cf_win',
                description: '🪙 Yazı-turada 2 kez kazan (/w cf)',
                target_count: 2,
                reward_cowoncy: 750,
                reward_xp: 70,
            },
            {
                quest_type: 'slots',
                description: '🎰 3 kez Slot makinesini çevir (/w slots)',
                target_count: 3,
                reward_cowoncy: 500,
                reward_xp: 50,
            },
            {
                quest_type: 'open',
                description: '📦 2 adet Kutu/Sandık aç (/w open)',
                target_count: 2,
                reward_cowoncy: 1000,
                reward_xp: 100,
            },
            {
                quest_type: 'pray',
                description: '🙏 2 kez dua et veya lanet oku (/w pray)',
                target_count: 2,
                reward_cowoncy: 500,
                reward_xp: 50,
            },
        ];
        const shuffled = [...questPool].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, 3);
        const now = new Date().toISOString();
        const insertStmt = this.db.prepare(`
      INSERT INTO owo_quests (
        user_id, quest_date, quest_type, description, target_count, current_count, reward_cowoncy, reward_xp, claimed, created_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 0, ?)
    `);
        for (const q of selected) {
            insertStmt.run(userId, questDate, q.quest_type, q.description, q.target_count, q.reward_cowoncy, q.reward_xp, now);
        }
        return fetchStmt.all(userId, questDate);
    }
    incrementQuestProgress(userId, questDate, questType, amount = 1) {
        const updateStmt = this.db.prepare(`
      UPDATE owo_quests
      SET current_count = MIN(target_count, current_count + ?)
      WHERE user_id = ? AND quest_date = ? AND quest_type = ? AND current_count < target_count
    `);
        updateStmt.run(amount, userId, questDate, questType);
        const fetchStmt = this.db.prepare(`
      SELECT * FROM owo_quests WHERE user_id = ? AND quest_date = ? ORDER BY id ASC
    `);
        return fetchStmt.all(userId, questDate);
    }
    claimQuestRewards(userId, questDate) {
        const fetchStmt = this.db.prepare(`
      SELECT * FROM owo_quests
      WHERE user_id = ? AND quest_date = ? AND claimed = 0 AND current_count >= target_count
    `);
        const readyQuests = fetchStmt.all(userId, questDate);
        if (readyQuests.length === 0) {
            return { totalCowoncy: 0, totalXp: 0, claimedCount: 0, claimedQuests: [] };
        }
        let totalCowoncy = 0;
        let totalXp = 0;
        const claimStmt = this.db.prepare(`UPDATE owo_quests SET claimed = 1 WHERE id = ?`);
        for (const q of readyQuests) {
            totalCowoncy += q.reward_cowoncy;
            totalXp += q.reward_xp;
            claimStmt.run(q.id);
        }
        return { totalCowoncy, totalXp, claimedCount: readyQuests.length, claimedQuests: readyQuests };
    }
    // -------------------------------------------------------------
    // Arena / Zoo Team Operations
    // -------------------------------------------------------------
    getOwoTeam(userId) {
        const stmt = this.db.prepare(`SELECT * FROM owo_teams WHERE user_id = ?`);
        return stmt.get(userId) || null;
    }
    setOwoTeam(userId, slot1, slot2, slot3) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO owo_teams (user_id, slot1, slot2, slot3, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        slot1 = excluded.slot1,
        slot2 = excluded.slot2,
        slot3 = excluded.slot3,
        updated_at = excluded.updated_at
    `);
        stmt.run(userId, slot1, slot2, slot3, now);
    }
    // -------------------------------------------------------------
    // Marriage Operations
    // -------------------------------------------------------------
    setMarriage(userId1, userId2) {
        const now = new Date().toISOString();
        this.updateOwoUser(userId1, { married_to: userId2, married_at: now });
        this.updateOwoUser(userId2, { married_to: userId1, married_at: now });
    }
    divorceMarriage(userId) {
        const user = this.getOwoUser(userId);
        const spouseId = user.married_to;
        if (!spouseId)
            return null;
        this.updateOwoUser(userId, { married_to: null, married_at: null });
        this.updateOwoUser(spouseId, { married_to: null, married_at: null });
        return spouseId;
    }
    // -------------------------------------------------------------
    // Daily Reminder Operations
    // -------------------------------------------------------------
    setDailyReminder(userId, enabled) {
        this.updateOwoUser(userId, { daily_reminder: enabled ? 1 : 0 });
    }
    getUsersPendingDailyReminder(currentUnix) {
        const DAY_SECONDS = 86400;
        const stmt = this.db.prepare(`
      SELECT * FROM owo_users
      WHERE daily_reminder = 1
        AND last_daily_unix > 0
        AND (? - last_daily_unix) >= ?
      LIMIT 50
    `);
        return stmt.all(currentUnix, DAY_SECONDS);
    }
    // -------------------------------------------------------------
    // Guild Leveling Operations
    // -------------------------------------------------------------
    getGuildUserLevel(guildId, userId, initialUsername) {
        const stmt = this.db.prepare('SELECT * FROM guild_user_levels WHERE guild_id = ? AND user_id = ?');
        const row = stmt.get(guildId, userId);
        if (row) {
            if (initialUsername && !row.username) {
                this.updateGuildUserLevel(guildId, userId, { username: initialUsername });
                return { ...row, username: initialUsername };
            }
            return row;
        }
        const now = new Date().toISOString();
        const insertStmt = this.db.prepare(`
      INSERT INTO guild_user_levels (
        guild_id, user_id, username, xp, level, message_count, voice_seconds, last_message_unix, updated_at
      ) VALUES (?, ?, ?, 0, 1, 0, 0, 0, ?)
    `);
        insertStmt.run(guildId, userId, initialUsername || null, now);
        return stmt.get(guildId, userId);
    }
    updateGuildUserLevel(guildId, userId, updates) {
        this.getGuildUserLevel(guildId, userId); // Ensure row exists
        const keys = Object.keys(updates).filter((k) => DatabaseClient.ALLOWED_LEVEL_COLUMNS.has(k));
        if (keys.length === 0)
            return;
        const now = new Date().toISOString();
        const setClauses = keys.map((key) => `${key} = ?`).join(', ') + ', updated_at = ?';
        const values = [...keys.map((key) => updates[key]), now, guildId, userId];
        const stmt = this.db.prepare(`UPDATE guild_user_levels SET ${setClauses} WHERE guild_id = ? AND user_id = ?`);
        stmt.run(...values);
    }
    getTopGuildUserLevels(guildId, limit = 10, excludeUserIds = []) {
        const botId = config.botToken?.split('.')[0];
        const excludes = [botId, ...excludeUserIds].filter(Boolean);
        let sql = 'SELECT * FROM guild_user_levels WHERE guild_id = ?';
        const params = [guildId];
        if (excludes.length > 0) {
            const placeholders = excludes.map(() => '?').join(', ');
            sql += ` AND user_id NOT IN (${placeholders})`;
            params.push(...excludes);
        }
        sql += ' ORDER BY level DESC, xp DESC LIMIT ?';
        params.push(limit);
        const stmt = this.db.prepare(sql);
        return stmt.all(...params);
    }
    getGuildUserRank(guildId, userId) {
        const botId = config.botToken?.split('.')[0];
        const user = this.getGuildUserLevel(guildId, userId);
        let countHigherSql = `
      SELECT COUNT(*) as higher_count FROM guild_user_levels
      WHERE guild_id = ? AND (level > ? OR (level = ? AND xp > ?))
    `;
        let countTotalSql = `
      SELECT COUNT(*) as total_count FROM guild_user_levels
      WHERE guild_id = ?
    `;
        const higherParams = [guildId, user.level, user.level, user.xp];
        const totalParams = [guildId];
        if (botId) {
            countHigherSql += ' AND user_id != ?';
            higherParams.push(botId);
            countTotalSql += ' AND user_id != ?';
            totalParams.push(botId);
        }
        const higherRow = this.db.prepare(countHigherSql).get(...higherParams);
        const totalRow = this.db.prepare(countTotalSql).get(...totalParams);
        const rank = (higherRow?.higher_count ?? 0) + 1;
        const total = Math.max(1, totalRow?.total_count ?? 1);
        return { rank, total };
    }
    getLevelRoles(guildId) {
        const stmt = this.db.prepare('SELECT * FROM guild_level_roles WHERE guild_id = ? ORDER BY level ASC');
        return stmt.all(guildId);
    }
    addLevelRole(guildId, level, roleId) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO guild_level_roles (guild_id, level, role_id, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id, level) DO UPDATE SET
        role_id = excluded.role_id,
        created_at = excluded.created_at
    `);
        stmt.run(guildId, level, roleId, now);
    }
    removeLevelRole(guildId, level) {
        const stmt = this.db.prepare('DELETE FROM guild_level_roles WHERE guild_id = ? AND level = ?');
        const result = stmt.run(guildId, level);
        return Number(result.changes) > 0;
    }
    // -------------------------------------------------------------
    // AFK User Operations
    // -------------------------------------------------------------
    setAfk(guildId, userId, reason) {
        const nowUnix = Math.floor(Date.now() / 1000);
        const stmt = this.db.prepare(`
      INSERT INTO afk_users (guild_id, user_id, reason, afk_since_unix)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET
        reason = excluded.reason,
        afk_since_unix = excluded.afk_since_unix
    `);
        stmt.run(guildId, userId, reason, nowUnix);
    }
    getAfk(guildId, userId) {
        const stmt = this.db.prepare('SELECT * FROM afk_users WHERE guild_id = ? AND user_id = ?');
        const row = stmt.get(guildId, userId);
        return row || null;
    }
    removeAfk(guildId, userId) {
        const existing = this.getAfk(guildId, userId);
        if (!existing)
            return false;
        const stmt = this.db.prepare('DELETE FROM afk_users WHERE guild_id = ? AND user_id = ?');
        stmt.run(guildId, userId);
        return true;
    }
    // -------------------------------------------------------------
    // Giveaway Operations
    // -------------------------------------------------------------
    createGiveaway(guildId, channelId, messageId, prize, winnerCount, endUnix, hostId) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO giveaways (
        guild_id, channel_id, message_id, prize, winner_count,
        end_unix, status, host_id, participants, winners, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, '[]', '[]', ?)
    `);
        stmt.run(guildId, channelId, messageId, prize, winnerCount, endUnix, hostId, now);
        const getStmt = this.db.prepare('SELECT * FROM giveaways WHERE channel_id = ? AND message_id = ?');
        return getStmt.get(channelId, messageId);
    }
    getGiveaway(id) {
        const stmt = this.db.prepare('SELECT * FROM giveaways WHERE id = ?');
        const row = stmt.get(id);
        return row || null;
    }
    getGiveawayByMessage(channelId, messageId) {
        const stmt = this.db.prepare('SELECT * FROM giveaways WHERE channel_id = ? AND message_id = ?');
        const row = stmt.get(channelId, messageId);
        return row || null;
    }
    getActiveGiveaways() {
        const stmt = this.db.prepare("SELECT * FROM giveaways WHERE status = 'active'");
        return stmt.all();
    }
    getGuildGiveaways(guildId) {
        const stmt = this.db.prepare('SELECT * FROM giveaways WHERE guild_id = ? ORDER BY id DESC LIMIT 15');
        return stmt.all(guildId);
    }
    addGiveawayParticipant(id, userId) {
        const giveaway = this.getGiveaway(id);
        if (!giveaway || giveaway.status !== 'active') {
            return { success: false, total: 0, alreadyJoined: false };
        }
        let list = [];
        try {
            list = JSON.parse(giveaway.participants || '[]');
        }
        catch {
            list = [];
        }
        if (list.includes(userId)) {
            return { success: false, total: list.length, alreadyJoined: true };
        }
        list.push(userId);
        const updateStmt = this.db.prepare('UPDATE giveaways SET participants = ? WHERE id = ?');
        updateStmt.run(JSON.stringify(list), id);
        return { success: true, total: list.length, alreadyJoined: false };
    }
    endGiveaway(id, winners) {
        const stmt = this.db.prepare("UPDATE giveaways SET status = 'ended', winners = ? WHERE id = ?");
        stmt.run(JSON.stringify(winners), id);
    }
    // -------------------------------------------------------------
    // Custom Tag Operations
    // -------------------------------------------------------------
    addTag(guildId, name, content, creatorId) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO custom_tags (guild_id, name, content, creator_id, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, name) DO UPDATE SET
        content = excluded.content,
        creator_id = excluded.creator_id,
        created_at = excluded.created_at
    `);
        stmt.run(guildId, name.toLowerCase().trim(), content, creatorId, now);
    }
    getTag(guildId, name) {
        const stmt = this.db.prepare('SELECT * FROM custom_tags WHERE guild_id = ? AND name = ?');
        const row = stmt.get(guildId, name.toLowerCase().trim());
        return row || null;
    }
    removeTag(guildId, name) {
        const existing = this.getTag(guildId, name);
        if (!existing)
            return false;
        const stmt = this.db.prepare('DELETE FROM custom_tags WHERE guild_id = ? AND name = ?');
        stmt.run(guildId, name.toLowerCase().trim());
        return true;
    }
    listTags(guildId) {
        const stmt = this.db.prepare('SELECT * FROM custom_tags WHERE guild_id = ? ORDER BY name ASC');
        return stmt.all(guildId);
    }
    clearTags(guildId) {
        const stmt = this.db.prepare('DELETE FROM custom_tags WHERE guild_id = ?');
        stmt.run(guildId);
    }
    /**
     * Safely flushes the WAL log and creates a timestamped backup of the database.
     * Automatically cleans up backups older than 7 days (retaining at least 3 latest backups).
     */
    backupDatabase(customDestDir) {
        try {
            // 1. Flush WAL into main database file
            this.walCheckpoint();
            // 2. Resolve backup directory
            const baseDir = path.dirname(this.dbFilePath);
            const backupDir = customDestDir || path.join(baseDir, 'backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            // 3. Format backup filename: micup_backup_YYYY-MM-DD_HH-mm-ss.db
            const now = new Date();
            const pad = (n) => n.toString().padStart(2, '0');
            const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
            const backupFileName = `micup_backup_${timestamp}.db`;
            const backupFilePath = path.join(backupDir, backupFileName);
            // 4. Safely copy DB file
            fs.copyFileSync(this.dbFilePath, backupFilePath);
            // 5. Clean up old backups (keep latest 5 backups, delete older than 3 days when at least 2 exist)
            try {
                const files = fs
                    .readdirSync(backupDir)
                    .filter((f) => f.startsWith('micup_backup_') && f.endsWith('.db'))
                    .map((f) => {
                    const fullPath = path.join(backupDir, f);
                    const stat = fs.statSync(fullPath);
                    return { fullPath, mtimeMs: stat.mtimeMs };
                })
                    .sort((a, b) => b.mtimeMs - a.mtimeMs);
                const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
                const nowMs = Date.now();
                files.forEach((file, index) => {
                    if (index >= 5 || (nowMs - file.mtimeMs > THREE_DAYS_MS && index >= 2)) {
                        try {
                            fs.unlinkSync(file.fullPath);
                        }
                        catch { }
                    }
                });
            }
            catch { }
            console.log(`[DatabaseClient] 🛡️ Veritabanı yedeği alındı: ${backupFilePath}`);
            return { success: true, backupPath: backupFilePath };
        }
        catch (err) {
            console.error('[DatabaseClient] Veritabanı yedekleme hatası:', err.message);
            return { success: false, error: err.message };
        }
    }
    // -------------------------------------------------------------
    // Birthday Operations
    // -------------------------------------------------------------
    setBirthday(guildId, userId, day, month, year = null, username) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO birthdays (guild_id, user_id, day, month, year, last_celebrated_year, created_at, username)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET
        day = excluded.day,
        month = excluded.month,
        year = excluded.year,
        username = COALESCE(excluded.username, birthdays.username)
    `);
        stmt.run(guildId, userId, day, month, year, now, username || null);
    }
    getBirthday(guildId, userId) {
        const stmt = this.db.prepare('SELECT * FROM birthdays WHERE guild_id = ? AND user_id = ?');
        return stmt.get(guildId, userId) || null;
    }
    deleteBirthday(guildId, userId) {
        const stmt = this.db.prepare('DELETE FROM birthdays WHERE guild_id = ? AND user_id = ?');
        const res = stmt.run(guildId, userId);
        return res.changes > 0;
    }
    getGuildBirthdays(guildId) {
        const stmt = this.db.prepare('SELECT * FROM birthdays WHERE guild_id = ? ORDER BY month ASC, day ASC');
        return stmt.all(guildId);
    }
    getTodaysBirthdays(day, month, currentYear) {
        const stmt = this.db.prepare(`
      SELECT * FROM birthdays
      WHERE day = ? AND month = ? AND (last_celebrated_year IS NULL OR last_celebrated_year != ?)
    `);
        return stmt.all(day, month, currentYear);
    }
    markBirthdayCelebrated(guildId, userId, year) {
        const stmt = this.db.prepare(`
      UPDATE birthdays SET last_celebrated_year = ?
      WHERE guild_id = ? AND user_id = ?
    `);
        stmt.run(year, guildId, userId);
    }
    // -------------------------------------------------------------
    // TempBan Operations
    // -------------------------------------------------------------
    addTempBan(guildId, userId, moderatorId, reason, durationText, durationSeconds, expireUnix) {
        const now = new Date().toISOString();
        this.db
            .prepare(`INSERT INTO temp_bans (guild_id, user_id, moderator_id, reason, duration_text, duration_seconds, expire_unix, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(guildId, userId, moderatorId, reason, durationText, durationSeconds, expireUnix, now);
    }
    removeTempBan(guildId, userId) {
        this.db.prepare('DELETE FROM temp_bans WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
    }
    getTempBan(guildId, userId) {
        return this.db.prepare('SELECT * FROM temp_bans WHERE guild_id = ? AND user_id = ?').get(guildId, userId) || null;
    }
    getAllActiveTempBans() {
        return this.db.prepare('SELECT * FROM temp_bans ORDER BY expire_unix ASC').all();
    }
    // -------------------------------------------------------------
    // Poll Operations
    // -------------------------------------------------------------
    createPoll(guildId, channelId, messageId, authorId, question, options, durationSeconds, expireUnix) {
        const now = new Date().toISOString();
        const info = this.db
            .prepare(`INSERT INTO polls (guild_id, channel_id, message_id, author_id, question, options_json, is_closed, duration_seconds, expire_unix, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`)
            .run(guildId, channelId, messageId, authorId, question, JSON.stringify(options), durationSeconds ?? null, expireUnix ?? null, now);
        return Number(info.lastInsertRowid);
    }
    updatePollMessageId(pollId, messageId) {
        this.db.prepare('UPDATE polls SET message_id = ? WHERE id = ?').run(messageId, pollId);
    }
    getPoll(pollId) {
        return this.db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId) || null;
    }
    getPollByMessageId(messageId) {
        return this.db.prepare('SELECT * FROM polls WHERE message_id = ?').get(messageId) || null;
    }
    getActiveExpiringPolls(nowUnix = Math.floor(Date.now() / 1000)) {
        return this.db
            .prepare('SELECT * FROM polls WHERE is_closed = 0 AND expire_unix IS NOT NULL AND expire_unix <= ?')
            .all(nowUnix);
    }
    getOpenPollsForGuild(guildId) {
        return this.db
            .prepare('SELECT * FROM polls WHERE guild_id = ? AND is_closed = 0 ORDER BY id DESC')
            .all(guildId);
    }
    votePoll(pollId, userId, optionIndex) {
        const now = new Date().toISOString();
        const existing = this.db.prepare('SELECT option_index FROM poll_votes WHERE poll_id = ? AND user_id = ?').get(pollId, userId);
        if (existing && existing.option_index === optionIndex) {
            // Toggle off vote if clicked same option
            this.db.prepare('DELETE FROM poll_votes WHERE poll_id = ? AND user_id = ?').run(pollId, userId);
            return { changed: true, optionIndex: -1 };
        }
        this.db
            .prepare(`INSERT INTO poll_votes (poll_id, user_id, option_index, voted_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(poll_id, user_id) DO UPDATE SET option_index = excluded.option_index, voted_at = excluded.voted_at`)
            .run(pollId, userId, optionIndex, now);
        return { changed: true, optionIndex };
    }
    getPollVotes(pollId) {
        return this.db
            .prepare('SELECT option_index, COUNT(*) as count FROM poll_votes WHERE poll_id = ? GROUP BY option_index')
            .all(pollId);
    }
    getUserPollVote(pollId, userId) {
        const row = this.db.prepare('SELECT option_index FROM poll_votes WHERE poll_id = ? AND user_id = ?').get(pollId, userId);
        return row !== undefined ? row.option_index : null;
    }
    closePoll(pollId) {
        this.db.prepare('UPDATE polls SET is_closed = 1 WHERE id = ?').run(pollId);
    }
    // -------------------------------------------------------------
    // User Guild Tracking (Cross-Community)
    // -------------------------------------------------------------
    trackUserGuild(guildId, guildName, userId) {
        if (!guildId || !userId)
            return;
        const cleanName = guildName || `Sunucu_${guildId.slice(-4)}`;
        const now = new Date().toISOString();
        try {
            this.db
                .prepare(`INSERT INTO user_guild_memberships (guild_id, guild_name, user_id, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(guild_id, user_id) DO UPDATE SET guild_name = excluded.guild_name, updated_at = excluded.updated_at`)
                .run(guildId, cleanName, userId, now);
        }
        catch { }
    }
    getUserCommonGuilds(userId) {
        if (!userId)
            return [];
        try {
            return this.db
                .prepare('SELECT DISTINCT guild_id, guild_name FROM user_guild_memberships WHERE user_id = ? ORDER BY updated_at DESC')
                .all(userId);
        }
        catch {
            return [];
        }
    }
    // -------------------------------------------------------------
    // Persistent User Names Cache Operations
    // -------------------------------------------------------------
    saveUserName(userId, username, displayName) {
        if (!userId || !username || username.startsWith('Kullanıcı_') || username === 'Kullanıcı')
            return;
        const now = Math.floor(Date.now() / 1000);
        try {
            this.db
                .prepare(`INSERT INTO user_names (user_id, username, display_name, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             username = excluded.username,
             display_name = COALESCE(excluded.display_name, user_names.display_name),
             updated_at = excluded.updated_at`)
                .run(userId, username, displayName || null, now);
        }
        catch { }
    }
    getUserName(userId) {
        if (!userId)
            return null;
        try {
            const row = this.db.prepare('SELECT username, display_name FROM user_names WHERE user_id = ?').get(userId);
            return row || null;
        }
        catch {
            return null;
        }
    }
    findUserIdByUsername(username) {
        if (!username)
            return null;
        const clean = username.replace(/^@/, '').trim();
        try {
            const row = this.db
                .prepare('SELECT user_id FROM user_names WHERE username = ? COLLATE NOCASE OR display_name = ? COLLATE NOCASE LIMIT 1')
                .get(clean, clean);
            return row?.user_id || null;
        }
        catch {
            return null;
        }
    }
    walCheckpoint() {
        try {
            this.db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
        }
        catch (err) {
            console.warn(`[DatabaseClient] walCheckpoint uyarısı: ${err.message}`);
        }
    }
    close() {
        this.walCheckpoint();
        this.db.close();
    }
}
//# sourceMappingURL=DatabaseClient.js.map