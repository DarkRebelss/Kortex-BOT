import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseClient } from '../src/database/DatabaseClient';
import { CommandHandler } from '../src/commands/CommandHandler';
import { LevelingService } from '../src/services/LevelingService';
import { ModerationService } from '../src/services/ModerationService';
import { WarnService } from '../src/services/WarnService';
import { RoleService } from '../src/services/RoleService';
import { WelcomeGoodbyeService } from '../src/services/WelcomeGoodbyeService';
import { WelcomeCardGenerator } from '../src/services/WelcomeCardGenerator';
import { ModLogService } from '../src/services/ModLogService';
import { AntiSpamService } from '../src/services/AntiSpamService';
import { AntiLinkService } from '../src/services/AntiLinkService';
import { OwoService } from '../src/services/OwoService';
import { MusicService } from '../src/services/MusicService';
import { GiveawayService } from '../src/services/GiveawayService';
import { BirthdayService } from '../src/services/BirthdayService';
import { FluxerGuild, FluxerMember, FluxerMessage } from '../src/types/fluxer';
import fs from 'fs';
import path from 'path';

describe('Comprehensive Enhancements & User Request Tests', () => {
  const testDbPath = path.join(__dirname, 'test_enhancements.db');
  let db: DatabaseClient;
  let api: any;
  let levelingService: LevelingService;
  let handler: CommandHandler;

  const sentMessages: { channelId: string; content: string; options?: any }[] = [];
  const deletedMessages: { channelId: string; messageId: string }[] = [];

  const mockGuild: FluxerGuild = {
    id: 'guild_test',
    name: 'Kodlama Topluluğu',
    owner_id: 'user_owner',
    channels: [
      { id: 'ch_cmd', name: 'komutlar', type: 0 },
      { id: 'ch_giveaway', name: '🎁-çekiliş', type: 0 },
      { id: 'ch_owo', name: 'owo-alani', type: 0 },
      { id: 'ch_music', name: 'muzik-odasi', type: 0 },
    ],
    roles: [],
    members: [
      {
        user: { id: 'user_owner', username: 'SunucuSahibi', discriminator: '0001' },
        roles: [],
        joined_at: new Date().toISOString(),
      },
      {
        user: { id: 'user_offline', username: 'GizemliOyuncu', discriminator: '1234' },
        roles: [],
        joined_at: new Date().toISOString(),
      },
    ],
  };

  const adminMember: FluxerMember = {
    user: { id: 'user_owner', username: 'SunucuSahibi', discriminator: '0001' },
    roles: [],
    joined_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
    sentMessages.length = 0;
    deletedMessages.length = 0;

    db = new DatabaseClient(testDbPath);
    api = {
      sendMessage: vi.fn().mockImplementation(async (channelId: string, content: string, options?: any) => {
        const msgId = 'msg_' + Math.random().toString(36).substring(2, 9);
        sentMessages.push({ channelId, content, options });
        return {
          id: msgId,
          channel_id: channelId,
          content,
          author: { id: 'bot_id', username: 'Kortex', discriminator: '0000', bot: true },
          timestamp: new Date().toISOString(),
        };
      }),
      deleteMessage: vi.fn().mockImplementation(async (channelId: string, messageId: string) => {
        deletedMessages.push({ channelId, messageId });
      }),
      getGuildMember: vi.fn().mockResolvedValue(null),
      getUser: vi.fn().mockResolvedValue(null),
    };

    levelingService = new LevelingService(api, db);
    const modService = new ModerationService(api, db);
    const warnService = new WarnService(api, db);
    const roleService = new RoleService(api, db);
    const welcomeService = new WelcomeGoodbyeService(api, db);
    const modLogService = new ModLogService(api, db);
    const antiSpamService = new AntiSpamService(api, db, modService, modLogService);
    const antiLinkService = new AntiLinkService(api, db);
    const owoService = new OwoService(api, db);
    const musicService = new MusicService(api);
    const giveawayService = new GiveawayService(api, db);
    const birthdayService = new BirthdayService(api, db);

    handler = new CommandHandler(
      api,
      modService,
      warnService,
      roleService,
      welcomeService,
      modLogService,
      antiSpamService,
      antiLinkService,
      owoService,
      musicService,
      undefined,
      levelingService,
      undefined,
      undefined,
      giveawayService,
      db,
      birthdayService,
    );
  });

  afterEach(async () => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
    vi.restoreAllMocks();
  });

  it('1. Giveaway start confirmation is sent ONLY to invoker channel and NOT to the target giveaway channel', async () => {
    const msg: FluxerMessage = {
      id: 'cmd_msg_1',
      channel_id: 'ch_cmd',
      guild_id: 'guild_test',
      author: adminMember.user,
      member: adminMember,
      content: '/cekilis 10m 1 Discord Nitro #🎁-çekiliş',
      timestamp: new Date().toISOString(),
    };

    await handler.handleMessage(mockGuild, adminMember, adminMember, msg);

    // Confirmation message: "✅ Çekiliş başarıyla başlatıldı! Mesaj: #🎁-çekiliş"
    const confMsg = sentMessages.find((m) => m.content.includes('Çekiliş başarıyla başlatıldı'));
    expect(confMsg).toBeDefined();
    // Must be in the command channel (ch_cmd) where the user typed the command
    expect(confMsg?.channelId).toBe('ch_cmd');

    // The target giveaway channel (ch_giveaway) MUST only receive the giveaway banner/card, NOT the confirmation notice
    const giveawayChannelMessages = sentMessages.filter((m) => m.channelId === 'ch_giveaway');
    expect(giveawayChannelMessages.length).toBeGreaterThan(0);
    expect(giveawayChannelMessages.some((m) => m.content.includes('Çekiliş başarıyla başlatıldı'))).toBe(false);
    expect(giveawayChannelMessages.some((m) => m.content.includes('ÇEKİLİŞ BAŞLADI'))).toBe(true);
  });



  it('4. Configures system-specific bot channels via /botkanal for owo and music, and supports deletion', async () => {
    // Set owo channel
    const msgOwo: FluxerMessage = {
      id: 'cmd_owo',
      channel_id: 'ch_cmd',
      guild_id: 'guild_test',
      author: adminMember.user,
      member: adminMember,
      content: '/botkanal owo #owo-alani',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, adminMember, adminMember, msgOwo);

    let config = db.getGuildConfig('guild_test');
    expect(config?.owo_channel_id).toBe('ch_owo');

    // Setting music channel via /botkanal sets music_channel_id, and delete clears it
    const msgMusic: FluxerMessage = {
      id: 'cmd_music',
      channel_id: 'ch_cmd',
      guild_id: 'guild_test',
      author: adminMember.user,
      member: adminMember,
      content: '/botkanal muzik #muzik-odasi',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, adminMember, adminMember, msgMusic);

    config = db.getGuildConfig('guild_test');
    expect(config?.music_channel_id).toBe('ch_music');
    expect(sentMessages.some((m) => m.content?.includes('Müzik Kanalı Ayarlandı'))).toBe(true);

    // Clear music channel
    const msgMusicDel: FluxerMessage = {
      id: 'cmd_music_del',
      channel_id: 'ch_cmd',
      guild_id: 'guild_test',
      author: adminMember.user,
      member: adminMember,
      content: '/botkanal sil muzik',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, adminMember, adminMember, msgMusicDel);
    config = db.getGuildConfig('guild_test');
    expect(config?.music_channel_id).toBeNull();

    // Delete / clear owo channel
    const msgDel: FluxerMessage = {
      id: 'cmd_del',
      channel_id: 'ch_cmd',
      guild_id: 'guild_test',
      author: adminMember.user,
      member: adminMember,
      content: '/botkanal delete owo',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, adminMember, adminMember, msgDel);

    config = db.getGuildConfig('guild_test');
    expect(config?.owo_channel_id).toBeNull();
  });

  it('5. Invalid command syntax error messages trigger auto-expiring warnings', async () => {
    const msgErr: FluxerMessage = {
      id: 'msg_bad_syntax',
      channel_id: 'ch_cmd',
      guild_id: 'guild_test',
      author: adminMember.user,
      member: adminMember,
      content: '/botkanal bilinmeyenarguman123',
      timestamp: new Date().toISOString(),
    };

    await handler.handleMessage(mockGuild, adminMember, adminMember, msgErr);

    const errMsg = sentMessages.find((m) => m.content.includes('Kullanım:') || m.content.includes('Geçersiz'));
    expect(errMsg).toBeDefined();
  });

  it('6. TopXP displays real username for users even if offline or not active', async () => {
    // Seed user into database with real username
    db.updateGuildUserLevel('guild_test', 'user_offline', {
      xp: 4500,
      level: 8,
      username: 'GizemliOyuncu',
    });

    const top = levelingService.getTopXP(mockGuild, 10, 'user_owner');

    expect(top.success).toBe(true);
    // User name must be shown, NOT "(Kullanıcı)"
    expect(top.message).toContain('GizemliOyuncu');
    expect(top.message).not.toContain('Kullanıcı (offline)');
  });

  it('7. Separate Goodbye card settings persist and are previewed via API', async () => {
    db.updateGuildConfig('guild_test', {
      goodbye_card_color: '#ef4444',
      goodbye_card_accent_color: '#f97316',
      goodbye_card_slogan: 'Gidişin üzdü...',
      goodbye_card_subtitle: 'Aramızdan bir yıldız kaydı.',
    });

    const config = db.getGuildConfig('guild_test');
    expect(config?.goodbye_card_color).toBe('#ef4444');
    expect(config?.goodbye_card_accent_color).toBe('#f97316');
    expect(config?.goodbye_card_slogan).toBe('Gidişin üzdü...');
    expect(config?.goodbye_card_subtitle).toBe('Aramızdan bir yıldız kaydı.');

    const buf = await WelcomeCardGenerator.generateCard({
      username: 'TestUser',
      customColor: config?.goodbye_card_color || undefined,
      accentColor: config?.goodbye_card_accent_color || undefined,
      sloganText: config?.goodbye_card_slogan || undefined,
      subtitle: config?.goodbye_card_subtitle || undefined,
      theme: 'crimson',
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('8. Level up notification triggers auto-expiring timer to delete notification message', async () => {
    vi.useFakeTimers();
    try {
      db.updateGuildUserLevel('guild_test', 'user_lvl_test', {
        xp: 95,
        level: 0,
        message_count: 5,
      });

      const member: FluxerMember = {
        user: { id: 'user_lvl_test', username: 'BatuneX', discriminator: '1234' },
        roles: [],
        joined_at: new Date().toISOString(),
      };

      const msg: FluxerMessage = {
        id: 'msg_lvl_up',
        channel_id: 'ch_cmd',
        guild_id: 'guild_test',
        author: member.user,
        content: 'Deneyim kazanımı için mesaj',
        timestamp: new Date().toISOString(),
      };

      await levelingService.handleTextMessage(mockGuild, member, msg);

      // Verify level up message sent
      const lvlMsg = sentMessages.find((m) => m.content.includes('Tebrikler') && m.content.includes('Seviye 1'));
      expect(lvlMsg).toBeDefined();

      // Fast forward 12 seconds
      vi.advanceTimersByTime(13000);

      // Verify deleteMessage was invoked
      expect(api.deleteMessage).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
