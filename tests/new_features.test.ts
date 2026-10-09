// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {DatabaseClient} from '../src/database/DatabaseClient.js';
import {BirthdayService} from '../src/services/BirthdayService.js';
import {CommandHandler} from '../src/commands/CommandHandler.js';
import {ModerationService} from '../src/services/ModerationService.js';
import {WarnService} from '../src/services/WarnService.js';
import {RoleService} from '../src/services/RoleService.js';
import {WelcomeGoodbyeService} from '../src/services/WelcomeGoodbyeService.js';
import {ModLogService} from '../src/services/ModLogService.js';
import {AntiSpamService} from '../src/services/AntiSpamService.js';
import {AntiLinkService} from '../src/services/AntiLinkService.js';
import {BadWordsService} from '../src/services/BadWordsService.js';
import {LevelingService} from '../src/services/LevelingService.js';
import {OwoService} from '../src/services/OwoService.js';
import {MusicService} from '../src/services/MusicService.js';
import {CommunityService} from '../src/services/CommunityService.js';
import {GiveawayService} from '../src/services/GiveawayService.js';
import {WelcomeCardGenerator} from '../src/services/WelcomeCardGenerator.js';
import {parseBirthdayInput} from '../src/commands/modules/communityCommands.js';
import type {FluxerGuild, FluxerMember, FluxerMessage, FluxerRole, FluxerChannel} from '../src/types/fluxer.js';

describe('New 20-Feature Pack Deep Verification', () => {
  let db: DatabaseClient;
  let mockApi: any;
  let birthdayService: BirthdayService;
  let levelingService: LevelingService;
  let owoService: OwoService;
  let handler: CommandHandler;
  let sentMessages: Array<{channelId: string; content: string; extra?: any}> = [];
  let sentDMs: Array<{recipientId: string; content: string; extra?: any}> = [];

  const roles: FluxerRole[] = [
    {
      id: 'role_admin',
      name: 'Yönetici',
      color: 0xff0000,
      hoist: true,
      position: 10,
      permissions: '8', // Administrator
    },
    {
      id: 'role_mod',
      name: 'Moderatör',
      color: 0x0000ff,
      hoist: true,
      position: 5,
      permissions: '8192', // Manage Messages
    },
    {
      id: 'role_member',
      name: 'Üye',
      color: 0x00ff00,
      hoist: false,
      position: 1,
      permissions: '0',
    },
  ];

  const channels: FluxerChannel[] = [
    {id: 'ch_bot_1', name: 'bot-komut', type: 0},
    {id: 'ch_bot_2', name: 'bot-komut-2', type: 0},
    {id: 'ch_general', name: 'genel-sohbet', type: 0},
    {id: 'ch_level', name: 'seviye-kutlama', type: 0},
    {id: 'ch_birthday', name: 'dogum-gunu', type: 0},
  ];

  const guild: FluxerGuild = {
    id: 'guild_test',
    name: 'Test Topluluğu',
    owner_id: 'user_owner',
    roles,
    channels,
  };

  const adminMember: FluxerMember = {
    user: {id: 'user_admin', username: 'AdminUser'},
    roles: ['role_admin'],
    joined_at: new Date().toISOString(),
  };

  const modMember: FluxerMember = {
    user: {id: 'user_mod', username: 'ModUser'},
    roles: ['role_mod'],
    joined_at: new Date().toISOString(),
  };

  const regularMember: FluxerMember = {
    user: {id: 'user_regular', username: 'RegularUser'},
    roles: ['role_member'],
    joined_at: new Date().toISOString(),
  };

  const botMember: FluxerMember = {
    user: {id: 'bot_id', username: 'Kyron'},
    roles: ['role_admin'],
    joined_at: new Date().toISOString(),
  };

  beforeEach(() => {
    db = new DatabaseClient(':memory:');
    sentMessages = [];
    sentDMs = [];

    mockApi = {
      sendMessage: vi.fn(async (channelId: string, content: string, extra?: any) => {
        const msg = {
          id: `msg_${Date.now()}_${Math.random()}`,
          channel_id: channelId,
          content,
          author: botMember.user,
          timestamp: new Date().toISOString(),
        };
        sentMessages.push({channelId, content, extra});
        return msg;
      }),
      deleteMessage: vi.fn(async () => {}),
      sendDirectMessage: vi.fn(async (recipientId: string, content: string, extra?: any) => {
        sentDMs.push({recipientId, content, extra});
        return {id: `dm_${Date.now()}`};
      }),
      getGuild: vi.fn(async () => guild),
      getGuildRoles: vi.fn(async () => roles),
      getGuildMember: vi.fn(async (_gId: string, uId: string) => {
        if (uId === 'user_admin') return adminMember;
        if (uId === 'user_mod') return modMember;
        if (uId === 'bot_id') return botMember;
        return regularMember;
      }),
      getUser: vi.fn(async (uId: string) => ({id: uId, username: `User_${uId}`})),
    };

    birthdayService = new BirthdayService(mockApi, db);
    birthdayService.stop(); // stop interval ticker during tests

    const modService = new ModerationService(mockApi, db);
    const warnService = new WarnService(mockApi, db);
    const roleService = new RoleService(mockApi, db);
    const welcomeService = new WelcomeGoodbyeService(mockApi, db);
    const modLogService = new ModLogService(mockApi, db);
    const antiSpamService = new AntiSpamService(mockApi, db, modService, modLogService);
    const antiLinkService = new AntiLinkService(mockApi, db);
    const badWordsService = new BadWordsService(mockApi, db, modLogService);
    levelingService = new LevelingService(mockApi, db);
    const musicService = new MusicService(mockApi);
    const communityService = new CommunityService(mockApi, db, modLogService);
    const giveawayService = new GiveawayService(mockApi, db);
    owoService = new OwoService(mockApi, db);

    handler = new CommandHandler(
      mockApi,
      modService,
      warnService,
      roleService,
      welcomeService,
      modLogService,
      antiSpamService,
      antiLinkService,
      owoService,
      musicService,
      badWordsService,
      levelingService,
      undefined,
      communityService,
      giveawayService,
      db,
      birthdayService,
    );
  });

  afterEach(() => {
    birthdayService.stop();
    db.close();
  });

  describe('1. Birthday System', () => {
    it('sets, retrieves, lists, and deletes user birthdays', () => {
      const setRes = birthdayService.setBirthday('guild_test', 'user_regular', 15, 8, 1995);
      expect(setRes.success).toBe(true);

      const getRes = birthdayService.getBirthday('guild_test', 'user_regular');
      expect(getRes.success).toBe(true);
      expect(getRes.record?.day).toBe(15);
      expect(getRes.record?.month).toBe(8);
      expect(getRes.record?.year).toBe(1995);

      const listRes = birthdayService.listBirthdays(guild);
      expect(listRes.success).toBe(true);
      expect(listRes.message).toContain('15 Ağustos 1995');

      const delRes = birthdayService.deleteBirthday('guild_test', 'user_regular');
      expect(delRes.success).toBe(true);

      const afterDel = birthdayService.getBirthday('guild_test', 'user_regular');
      expect(afterDel.success).toBe(false);
    });

    it('celebrates birthdays and respects birthday_enabled toggle', async () => {
      const now = new Date();
      db.setBirthday('guild_test', 'user_regular', now.getDate(), now.getMonth() + 1, 2000);
      db.updateGuildConfig('guild_test', {
        birthday_enabled: 1,
        birthday_channel_id: 'ch_birthday',
      });

      await birthdayService.checkAndAnnounceBirthdays();
      expect(sentMessages.some((m) => m.channelId === 'ch_birthday' && m.content.includes('user_regular'))).toBe(true);

      // Verify it is marked celebrated and not repeated
      sentMessages = [];
      await birthdayService.checkAndAnnounceBirthdays();
      expect(sentMessages.length).toBe(0);
    });

    it('parses various date formats correctly with parseBirthdayInput', () => {
      expect(parseBirthdayInput(['ayarla', '04.10'])).toEqual({ day: 4, month: 10, year: undefined });
      expect(parseBirthdayInput(['ayarla', '4.10.2008'])).toEqual({ day: 4, month: 10, year: 2008 });
      expect(parseBirthdayInput(['ayarla', '04/10/2008'])).toEqual({ day: 4, month: 10, year: 2008 });
      expect(parseBirthdayInput(['ayarla', '4', 'ekim', '2008'])).toEqual({ day: 4, month: 10, year: 2008 });
      expect(parseBirthdayInput(['ayarla', '4', '10', '2008'])).toEqual({ day: 4, month: 10, year: 2008 });
      expect(parseBirthdayInput(['ayarla', 'invalid'])).toBeNull();
    });

    it('immediately announces celebration when birthday is set to today', async () => {
      db.updateGuildConfig('guild_test', {
        birthday_enabled: 1,
        birthday_channel_id: 'ch_birthday',
      });

      const now = new Date();
      sentMessages = [];
      const res = birthdayService.setBirthday('guild_test', 'user_today', now.getDate(), now.getMonth() + 1, 2005);
      expect(res.success).toBe(true);
      expect(res.message).toContain('Bugün senin doğum günün');

      // Wait brief tick for async announcement to complete
      await new Promise((r) => setTimeout(r, 50));
      expect(sentMessages.some((m) => m.channelId === 'ch_birthday' && m.content.includes('user_today'))).toBe(true);
    });
  });

  describe('2. Bot Channel Restrictions & Permissions Bypass', () => {
    it('blocks regular users in non-bot channels when bot_channel_id is configured', async () => {
      db.updateGuildConfig('guild_test', {bot_channel_id: 'ch_bot_1'});

      const msg: FluxerMessage = {
        id: 'msg_1',
        channel_id: 'ch_general',
        content: '/ping',
        author: regularMember.user,
        timestamp: new Date().toISOString(),
      };

      await handler.handleMessage(guild, regularMember, botMember, msg);

      // Should send ephemeral warning instead of executing /ping
      expect(sentMessages.some((m) => m.content.includes('bot komutları yalnızca bu kanalda kullanılabilir'))).toBe(true);
      expect(sentMessages.some((m) => m.content.includes('Pong!'))).toBe(false);
    });

    it('allows regular users to run commands in the designated bot channel', async () => {
      db.updateGuildConfig('guild_test', {bot_channel_id: 'ch_bot_1'});

      const msg: FluxerMessage = {
        id: 'msg_2',
        channel_id: 'ch_bot_1',
        content: '/ping',
        author: regularMember.user,
        timestamp: new Date().toISOString(),
      };

      await handler.handleMessage(guild, regularMember, botMember, msg);
      expect(sentMessages.some((m) => m.content.includes('Pong!'))).toBe(true);
    });

    it('allows administrators and moderators to run commands in ANY channel (bypass)', async () => {
      db.updateGuildConfig('guild_test', {bot_channel_id: 'ch_bot_1'});

      // Admin in ch_general
      const adminMsg: FluxerMessage = {
        id: 'msg_3',
        channel_id: 'ch_general',
        content: '/ping',
        author: adminMember.user,
        timestamp: new Date().toISOString(),
      };
      await handler.handleMessage(guild, adminMember, botMember, adminMsg);
      expect(sentMessages.some((m) => m.content.includes('Pong!'))).toBe(true);

      sentMessages = [];

      // Mod in ch_general
      const modMsg: FluxerMessage = {
        id: 'msg_4',
        channel_id: 'ch_general',
        content: '/ping',
        author: modMember.user,
        timestamp: new Date().toISOString(),
      };
      await handler.handleMessage(guild, modMember, botMember, modMsg);
      expect(sentMessages.some((m) => m.content.includes('Pong!'))).toBe(true);
    });

    it('allows 2nd bot channel configured by administrator', async () => {
      db.updateGuildConfig('guild_test', {
        bot_channel_id: 'ch_bot_1',
        bot_channel_id_2: 'ch_bot_2',
      });

      // Regular user in ch_bot_2
      const msg: FluxerMessage = {
        id: 'msg_5',
        channel_id: 'ch_bot_2',
        content: '/ping',
        author: regularMember.user,
        timestamp: new Date().toISOString(),
      };
      await handler.handleMessage(guild, regularMember, botMember, msg);
      expect(sentMessages.some((m) => m.content.includes('Pong!'))).toBe(true);
    });
  });

  describe('3. /botkanal, /davet, and /dogumgunu Commands', () => {
    it('handles /botkanal 1 #kanal and /botkanal 2 #kanal correctly', async () => {
      const msg1: FluxerMessage = {
        id: 'msg_b1',
        channel_id: 'ch_general',
        content: '/botkanal 1 #bot-komut',
        author: adminMember.user,
        timestamp: new Date().toISOString(),
      };
      await handler.handleMessage(guild, adminMember, botMember, msg1);
      const cfg = db.getGuildConfig('guild_test');
      expect(cfg.bot_channel_id).toBe('ch_bot_1');

      // Admin sets channel 2
      const msg2: FluxerMessage = {
        id: 'msg_b2',
        channel_id: 'ch_general',
        content: '/botkanal 2 #bot-komut-2',
        author: adminMember.user,
        timestamp: new Date().toISOString(),
      };
      await handler.handleMessage(guild, adminMember, botMember, msg2);
      const cfg2 = db.getGuildConfig('guild_test');
      expect(cfg2.bot_channel_id_2).toBe('ch_bot_2');
    });

    it('handles /davet with rich invitation details for Micup platform', async () => {
      const msg: FluxerMessage = {
        id: 'msg_inv',
        channel_id: 'ch_general',
        content: '/davet',
        author: regularMember.user,
        timestamp: new Date().toISOString(),
      };
      await handler.handleMessage(guild, regularMember, botMember, msg);
      expect(sentMessages.some((m) => m.extra?.embeds?.[0]?.title?.includes('Davet') || m.content.includes('Davet'))).toBe(true);
      const sentItem = sentMessages.find((m) => m.extra?.embeds?.[0]?.title?.includes('Davet'));
      expect(sentItem?.extra?.embeds?.[0]?.description).toContain('micup.gg');
      expect(sentItem?.extra?.embeds?.[0]?.description).not.toContain('discord.com');
      expect(sentItem?.extra?.components?.[0]?.components?.[0]?.url).toContain('micup.gg');
    });
  });

  describe('4. Level-up Dedicated Channel Routing & Leaderboard Mentions', () => {
    it('routes level-up messages to dedicated leveling_channel_id when configured', async () => {
      db.updateGuildConfig('guild_test', {leveling_channel_id: 'ch_level'});

      // Set user to level 0 with 95 XP (100 is needed for level 1)
      db.updateGuildUserLevel('guild_test', 'user_regular', {
        xp: 95,
        level: 0,
        message_count: 5,
      });

      // Send a text message that triggers level-up celebration
      const textMsg: FluxerMessage = {
        id: 'msg_xp',
        channel_id: 'ch_general',
        content: 'Merhaba herkese iyi gunler',
        author: regularMember.user,
        timestamp: new Date().toISOString(),
      };

      await levelingService.handleTextMessage(guild, regularMember, textMsg);

      // Verify the announcement was routed to ch_level instead of ch_general
      expect(sentMessages.some((m) => m.channelId === 'ch_level' && m.content.includes('Tebrikler'))).toBe(true);
      expect(sentMessages.some((m) => m.channelId === 'ch_general' && m.content.includes('Tebrikler'))).toBe(false);
    });

    it('leaderboard does NOT mass ping other users, only tags invoker', async () => {
      db.updateGuildUserLevel('guild_test', 'user_1', {xp: 5000, level: 10});
      db.updateGuildUserLevel('guild_test', 'user_2', {xp: 3000, level: 7});
      db.updateGuildUserLevel('guild_test', 'user_regular', {xp: 1000, level: 3});

      const lb = levelingService.getTopXP(guild, 10, 'user_regular');

      // Should not contain <@user_1> or <@user_2>
      expect(lb.message).not.toContain('<@user_1>');
      expect(lb.message).not.toContain('<@user_2>');
      // Should mention invoker <@user_regular>
      expect(lb.message).toContain('<@user_regular>');
    });
  });

  describe('5. OwO Daily Starting at 500 & DM Reminders with Community Name', () => {
    it('awards exactly 500 cowoncy on day 1 daily claim', async () => {
      const msg: FluxerMessage = {
        id: 'msg_daily',
        channel_id: 'ch_general',
        content: '/w daily',
        author: regularMember.user,
        timestamp: new Date().toISOString(),
      };
      await handler.handleMessage(guild, regularMember, botMember, msg);

      const user = db.getOwoUser('user_regular');
      expect(user.cowoncy).toBe(1000); // 500 starting balance + 500 daily reward
      expect(user.daily_streak).toBe(1);
    });

    it('toggles daily reminders with /w remind daily on/off', async () => {
      const msgOn: FluxerMessage = {
        id: 'msg_rem_on',
        channel_id: 'ch_general',
        content: '/w remind daily on',
        author: regularMember.user,
        timestamp: new Date().toISOString(),
      };
      await handler.handleMessage(guild, regularMember, botMember, msgOn);
      expect(db.getOwoUser('user_regular').daily_reminder).toBe(1);

      const msgOff: FluxerMessage = {
        id: 'msg_rem_off',
        channel_id: 'ch_general',
        content: '/w remind daily off',
        author: regularMember.user,
        timestamp: new Date().toISOString(),
      };
      await handler.handleMessage(guild, regularMember, botMember, msgOff);
      expect(db.getOwoUser('user_regular').daily_reminder).toBe(0);
    });

    it('sends daily reminder via DM specifying the originating community name', async () => {
      const nowUnix = Math.floor(Date.now() / 1000);
      db.updateOwoUser('user_regular', {
        daily_reminder: 1,
        last_daily_unix: nowUnix - (25 * 3600), // 25 hours ago
      });

      // Register user in guild cache
      (owoService as any).userLastGuild.set('user_regular', guild);

      await owoService.checkDailyReminders();

      expect(sentDMs.length).toBe(1);
      expect(sentDMs[0].recipientId).toBe('user_regular');
      // Plain text header removed!
      expect(sentDMs[0].content).not.toContain('TOPLULUK BİLDİRİMİ');
      expect(sentDMs[0].extra?.embeds[0].description).toContain('Test Topluluğu');
      expect(sentDMs[0].extra?.embeds[0].description).toContain('/w daily');
    });

    it('sends daily reminder via DM using persistent SQLite last_guild_name when cache is empty', async () => {
      const nowUnix = Math.floor(Date.now() / 1000);
      db.updateOwoUser('user_offline', {
        daily_reminder: 1,
        last_daily_unix: nowUnix - (25 * 3600),
        last_guild_id: 'guild_test',
        last_guild_name: 'Anadolu Oyuncuları Topluluğu',
      });

      // Clear memory cache completely
      (owoService as any).userLastGuild.clear();

      await owoService.checkDailyReminders();

      expect(sentDMs.some((dm) => dm.recipientId === 'user_offline')).toBe(true);
      const userDm = sentDMs.find((dm) => dm.recipientId === 'user_offline');
      expect(userDm?.content).not.toContain('TOPLULUK BİLDİRİMİ');
      expect(userDm?.extra?.embeds[0].description).toContain('Anadolu Oyuncuları Topluluğu');
    });
  });

  describe('6. Invitation and Community Commands', () => {

    it('handles /davet command without [Micup Bot Sayfası], without timestamp, and branded Kyron', async () => {
      db.updateGuildConfig('guild_test', { bot_channel_id: null, bot_channel_id_2: null });
      const davetMsg: FluxerMessage = {
        id: 'msg_davet_1',
        channel_id: 'ch_general',
        content: '/davet',
        author: regularMember.user,
        timestamp: new Date().toISOString(),
      };
      await handler.handleMessage(guild, regularMember, botMember, davetMsg);

      const davetSent = sentMessages.find((m) =>
        m.extra?.embeds?.some((e: any) => e.title?.includes('Kyron Topluluk Davet Sistemi')),
      );
      expect(davetSent).toBeDefined();
      const embed = davetSent!.extra.embeds[0];
      expect(embed.title).toContain('Kyron');
      expect(embed.description).toContain('Kyron');
      expect(embed.description).not.toContain('[Micup Bot Sayfası]');
      expect(embed.description).not.toContain('micupBotUrl');
      // Must not have timestamp!
      expect(embed.timestamp).toBeUndefined();
      expect(embed.footer.text).toContain('Kyron');
    });

    it('generates welcome card with custom colors, custom logo, custom subtitle, and slogan', async () => {
      // 1x1 transparent PNG data uri
      const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const cardBuf = await WelcomeCardGenerator.generateCard({
        username: 'SiberSavasci#1337',
        customColor: '#06b6d4',
        accentColor: '#67e8f9',
        subtitle: 'YENİ SAVAŞÇI KATILDI',
        sloganText: 'Geleceğin siber dünyasında bir efsane.',
        welcomeText: 'Aramıza hoş geldin! 🎉',
        logoUrl: tinyPng,
      });

      expect(cardBuf).toBeInstanceOf(Buffer);
      expect(cardBuf.length).toBeGreaterThan(1000);
      // PNG header check
      expect(cardBuf[0]).toBe(0x89);
      expect(cardBuf[1]).toBe(0x50); // P
      expect(cardBuf[2]).toBe(0x4e); // N
      expect(cardBuf[3]).toBe(0x47); // G
    });

    it('persists welcome card settings in database and generates customized card', async () => {
      // Set initial card customization via DB
      db.updateGuildConfig('guild_test', {
        welcome_card_color: '#10b981',
        welcome_card_accent_color: '#6ee7b7',
        welcome_card_subtitle: 'YEŞİL MATRIX',
        welcome_card_slogan: 'Kodların gücü seninle olsun.',
      });

      const cfg = db.getGuildConfig('guild_test');
      expect(cfg.welcome_card_color).toBe('#10b981');
      expect(cfg.welcome_card_accent_color).toBe('#6ee7b7');
      expect(cfg.welcome_card_subtitle).toBe('YEŞİL MATRIX');
      expect(cfg.welcome_card_slogan).toBe('Kodların gücü seninle olsun.');

      // Generate card with custom colors and slogan
      const cardBuf = await WelcomeCardGenerator.generateCard({
        username: 'TestAdmin',
        customColor: cfg.welcome_card_color || undefined,
        accentColor: cfg.welcome_card_accent_color || undefined,
        subtitle: cfg.welcome_card_subtitle || undefined,
        sloganText: cfg.welcome_card_slogan || undefined,
      });

      expect(cardBuf).toBeInstanceOf(Buffer);
      expect(cardBuf.length).toBeGreaterThan(1000);
      expect(cardBuf[0]).toBe(0x89);
      expect(cardBuf[1]).toBe(0x50); // P
      expect(cardBuf[2]).toBe(0x4e); // N
      expect(cardBuf[3]).toBe(0x47); // G
    });
  });
});
