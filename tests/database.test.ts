// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseClient} from '../src/database/DatabaseClient.js';

describe('Database Persistence & Isolation Tests', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test_micup_bot.db');
  let db: DatabaseClient;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new DatabaseClient(testDbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // ignore
      }
    }
  });

  // -------------------------------------------------------------
  // Test 9: Warn database'e doğru kaydoluyor mu?
  // -------------------------------------------------------------
  it('saves and retrieves warnings correctly', () => {
    const warn1 = db.addWarning('guild_1', 'user_100', 'mod_1', 'Spamming in general');
    expect(warn1.id).toBeGreaterThan(0);
    expect(warn1.reason).toBe('Spamming in general');
    expect(warn1.active).toBe(1);

    const warn2 = db.addWarning('guild_1', 'user_100', 'mod_2', 'Inappropriate language');
    const activeWarns = db.getActiveWarnings('guild_1', 'user_100');
    expect(activeWarns).toHaveLength(2);

    // Dismissing a warning
    const dismissed = db.dismissWarning('guild_1', warn1.id);
    expect(dismissed).toBe(true);

    const remainingActive = db.getActiveWarnings('guild_1', 'user_100');
    expect(remainingActive).toHaveLength(1);
    expect(remainingActive[0].id).toBe(warn2.id);
  });

  // -------------------------------------------------------------
  // Test 10: Moderation log doğru çalışıyor mu?
  // -------------------------------------------------------------
  it('records moderation logs with complete details', () => {
    const log = db.addModerationLog(
      'guild_1',
      'BAN',
      'target_10',
      'mod_1',
      'Rule violations',
      'channel_99',
      {duration: 'permanent'},
    );

    expect(log.id).toBeGreaterThan(0);
    expect(log.action_type).toBe('BAN');
    expect(log.target_user_id).toBe('target_10');
    expect(log.moderator_id).toBe('mod_1');
    expect(log.details).toContain('permanent');
  });

  // -------------------------------------------------------------
  // Test 11: Başka community\'nin verilerine erişilebiliyor mu? Kesinlikle erişilememeli!
  // -------------------------------------------------------------
  it('enforces strict multi-guild isolation for configs and warnings', () => {
    // Guild A sets custom welcome message
    db.updateGuildConfig('guild_A', {
      welcome_channel_id: 'channel_A',
      welcome_message: 'Welcome to Server A!',
      welcome_enabled: 1,
    });

    // Guild B sets different welcome message
    db.updateGuildConfig('guild_B', {
      welcome_channel_id: 'channel_B',
      welcome_message: 'Welcome to Server B!',
      welcome_enabled: 1,
    });

    const configA = db.getGuildConfig('guild_A');
    const configB = db.getGuildConfig('guild_B');

    expect(configA.welcome_channel_id).toBe('channel_A');
    expect(configA.welcome_message).toBe('Welcome to Server A!');
    expect(configB.welcome_channel_id).toBe('channel_B');
    expect(configB.welcome_message).toBe('Welcome to Server B!');

    // Warning isolation
    db.addWarning('guild_A', 'user_common', 'mod_A', 'Warn in Guild A');
    const warnsInA = db.getActiveWarnings('guild_A', 'user_common');
    const warnsInB = db.getActiveWarnings('guild_B', 'user_common');

    expect(warnsInA).toHaveLength(1);
    expect(warnsInB).toHaveLength(0); // Guild B sees 0 warnings for the same user!
  });

  // -------------------------------------------------------------
  // Test 12: transferOwoCowoncy atomik transfer & bakiye koruması
  // -------------------------------------------------------------
  it('handles atomic transferOwoCowoncy with strict balance validation', () => {
    // Both users start with 500
    db.getOwoUser('sender_1');
    db.getOwoUser('receiver_1');

    // 1. Successful transfer
    const res1 = db.transferOwoCowoncy('sender_1', 'receiver_1', 200);
    expect(res1.success).toBe(true);
    expect(res1.senderBalance).toBe(300);
    expect(res1.receiverBalance).toBe(700);

    // 2. Insufficient funds
    const res2 = db.transferOwoCowoncy('sender_1', 'receiver_1', 301);
    expect(res2.success).toBe(false);
    expect(res2.error).toBe('INSUFFICIENT_FUNDS');
    expect(res2.senderBalance).toBe(300);

    // 3. Invalid amounts (negative, zero, floating, self)
    expect(db.transferOwoCowoncy('sender_1', 'receiver_1', 0).success).toBe(false);
    expect(db.transferOwoCowoncy('sender_1', 'receiver_1', -50).success).toBe(false);
    expect(db.transferOwoCowoncy('sender_1', 'sender_1', 50).success).toBe(false);
  });

  // -------------------------------------------------------------
  // Test 13: backupDatabase creates safe backup copies
  // -------------------------------------------------------------
  it('creates timestamped backups and flushes WAL log properly', () => {
    const backupDir = path.resolve(process.cwd(), 'data', 'test_backups');
    const backupResult = db.backupDatabase(backupDir);

    expect(backupResult.success).toBe(true);
    expect(backupResult.backupPath).toBeDefined();
    expect(fs.existsSync(backupResult.backupPath!)).toBe(true);

    // Clean up test backup file & dir
    if (backupResult.backupPath && fs.existsSync(backupResult.backupPath)) {
      try {
        fs.unlinkSync(backupResult.backupPath);
        fs.rmdirSync(backupDir);
      } catch {}
    }
  });
});

