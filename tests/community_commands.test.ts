// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseClient } from '../src/database/DatabaseClient.js';
import { MicupApiClient } from '../src/api/MicupApiClient.js';
import { CommandHandler } from '../src/commands/CommandHandler.js';
import { WelcomeGoodbyeService } from '../src/services/WelcomeGoodbyeService.js';
import { OwoService } from '../src/services/OwoService.js';
import type { FluxerGuild, FluxerMember, FluxerMessage } from '../src/types/fluxer.js';

describe('Community Chat Commands & Design Customization Tests', () => {
  let db: DatabaseClient;
  let api: MicupApiClient;
  let welcomeService: WelcomeGoodbyeService;
  let owoService: OwoService;
  let handler: CommandHandler;
  let sentMessages: { channelId: string; content: string; extra: any }[] = [];
  let deletedMessages: { channelId: string; messageId: string }[] = [];

  const mockGuild: FluxerGuild = {
    id: 'guild_comm_1',
    name: 'Topluluk Sunucusu',
    owner_id: 'user_owner',
    roles: [
      { id: 'role_admin', name: 'Yönetici', permissions: '8', position: 10 },
      { id: 'role_mod', name: 'Moderatör', permissions: '8192', position: 5 },
    ],
    members: [],
    channels: [
      { id: 'ch_general', name: 'genel-sohbet', type: 0, position: 0 },
      { id: 'ch_welcome', name: 'hos-geldiniz', type: 0, position: 1 },
      { id: 'ch_goodbye', name: 'gorusuruz', type: 0, position: 2 },
      { id: 'ch_music', name: 'muzik-odasi', type: 2, position: 3 },
    ],
  };

  const ownerMember: FluxerMember = {
    user: { id: 'user_owner', username: 'SunucuSahibi', discriminator: '0001' },
    roles: ['role_admin'],
    joined_at: new Date().toISOString(),
  };

  const botMember: FluxerMember = {
    user: { id: 'user_bot', username: 'Kyron', discriminator: '0000', bot: true },
    roles: ['role_admin'],
    joined_at: new Date().toISOString(),
  };

  beforeEach(() => {
    sentMessages = [];
    deletedMessages = [];
    db = new DatabaseClient(':memory:');
    api = new MicupApiClient('mock_token');

    vi.spyOn(api, 'sendMessage').mockImplementation(async (channelId, content, extra) => {
      sentMessages.push({ channelId, content: String(content), extra });
      return { id: `msg_${Date.now()}_${Math.random()}`, channel_id: channelId } as any;
    });

    vi.spyOn(api, 'deleteMessage').mockImplementation(async (channelId, messageId) => {
      deletedMessages.push({ channelId, messageId });
      return true as any;
    });

    welcomeService = new WelcomeGoodbyeService(api, db);
    owoService = new OwoService(api, db);

    const mockAntiSpam = { handleMessage: vi.fn().mockResolvedValue(false) } as any;
    const mockAntiLink = { handleMessage: vi.fn().mockResolvedValue(false) } as any;
    const mockModService = { isMuted: vi.fn().mockReturnValue(false) } as any;

    handler = new CommandHandler(
      api,
      mockModService,
      {} as any,
      {} as any,
      welcomeService,
      {} as any,
      mockAntiSpam,
      mockAntiLink,
      owoService,
      {} as any,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      db,
    );
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  it('1. Customizes Welcome and Goodbye card design via chat commands', async () => {
    // /welcome renk #6366f1
    const msgColor: FluxerMessage = {
      id: 'cmd_1',
      channel_id: 'ch_general',
      guild_id: 'guild_comm_1',
      author: ownerMember.user,
      member: ownerMember,
      content: '/welcome renk #6366f1',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, ownerMember, botMember, msgColor);

    let cfg = db.getGuildConfig('guild_comm_1');
    expect(cfg.welcome_card_color).toBe('#6366f1');

    // /welcome vurgu #a855f7
    const msgAccent: FluxerMessage = {
      id: 'cmd_2',
      channel_id: 'ch_general',
      guild_id: 'guild_comm_1',
      author: ownerMember.user,
      member: ownerMember,
      content: '/welcome vurgu #a855f7',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, ownerMember, botMember, msgAccent);

    cfg = db.getGuildConfig('guild_comm_1');
    expect(cfg.welcome_card_accent_color).toBe('#a855f7');

    // /welcome baslik ARAMIZA HOŞ GELDİN
    const msgSub: FluxerMessage = {
      id: 'cmd_3',
      channel_id: 'ch_general',
      guild_id: 'guild_comm_1',
      author: ownerMember.user,
      member: ownerMember,
      content: '/welcome baslik ARAMIZA HOŞ GELDİN',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, ownerMember, botMember, msgSub);

    cfg = db.getGuildConfig('guild_comm_1');
    expect(cfg.welcome_card_subtitle).toBe('ARAMIZA HOŞ GELDİN');

    // /welcome slogan Yeni bir maceraya adım at.
    const msgSlogan: FluxerMessage = {
      id: 'cmd_4',
      channel_id: 'ch_general',
      guild_id: 'guild_comm_1',
      author: ownerMember.user,
      member: ownerMember,
      content: '/welcome slogan Yeni bir maceraya adım at.',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, ownerMember, botMember, msgSlogan);

    cfg = db.getGuildConfig('guild_comm_1');
    expect(cfg.welcome_card_slogan).toBe('Yeni bir maceraya adım at.');

    // /welcome logo https://cdn.example.com/logo.png
    const msgLogo: FluxerMessage = {
      id: 'cmd_5',
      channel_id: 'ch_general',
      guild_id: 'guild_comm_1',
      author: ownerMember.user,
      member: ownerMember,
      content: '/welcome logo https://cdn.example.com/logo.png',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, ownerMember, botMember, msgLogo);

    cfg = db.getGuildConfig('guild_comm_1');
    expect(cfg.welcome_card_logo_url).toBe('https://cdn.example.com/logo.png');

    // /welcome durum
    const msgStatus: FluxerMessage = {
      id: 'cmd_6',
      channel_id: 'ch_general',
      guild_id: 'guild_comm_1',
      author: ownerMember.user,
      member: ownerMember,
      content: '/welcome durum',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, ownerMember, botMember, msgStatus);

    expect(sentMessages.some((m) => m.content.includes('#6366f1') && m.content.includes('#a855f7'))).toBe(true);

    // /welcome sifirla
    const msgReset: FluxerMessage = {
      id: 'cmd_7',
      channel_id: 'ch_general',
      guild_id: 'guild_comm_1',
      author: ownerMember.user,
      member: ownerMember,
      content: '/welcome sifirla',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, ownerMember, botMember, msgReset);

    cfg = db.getGuildConfig('guild_comm_1');
    expect(cfg.welcome_card_color).toBeNull();
    expect(cfg.welcome_card_accent_color).toBeNull();
  });

  it('2. Customizes Goodbye design via /goodbye and /kart-tasarim commands', async () => {
    // /goodbye renk #f43f5e
    const msgGb: FluxerMessage = {
      id: 'cmd_gb_1',
      channel_id: 'ch_general',
      guild_id: 'guild_comm_1',
      author: ownerMember.user,
      member: ownerMember,
      content: '/goodbye renk #f43f5e',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, ownerMember, botMember, msgGb);

    let cfg = db.getGuildConfig('guild_comm_1');
    expect(cfg.goodbye_card_color).toBe('#f43f5e');

    // /kart-tasarim gorusuruz slogan Yolun açık olsun dostum!
    const msgKart: FluxerMessage = {
      id: 'cmd_kt_1',
      channel_id: 'ch_general',
      guild_id: 'guild_comm_1',
      author: ownerMember.user,
      member: ownerMember,
      content: '/kart-tasarim gorusuruz slogan Yolun açık olsun dostum!',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, ownerMember, botMember, msgKart);

    cfg = db.getGuildConfig('guild_comm_1');
    expect(cfg.goodbye_card_slogan).toBe('Yolun açık olsun dostum!');

    // /kart-tasarim guide
    const msgMenu: FluxerMessage = {
      id: 'cmd_kt_menu',
      channel_id: 'ch_general',
      guild_id: 'guild_comm_1',
      author: ownerMember.user,
      member: ownerMember,
      content: '/kart-tasarim',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, ownerMember, botMember, msgMenu);

    expect(sentMessages.some((m) => m.content.includes('Kart Tasarım Menüsü'))).toBe(true);
  });

  it('3. Removes music channel configuration and confirms music is unrestricted', async () => {
    // /botkanal durum
    const msgBotKanal: FluxerMessage = {
      id: 'cmd_bk_1',
      channel_id: 'ch_general',
      guild_id: 'guild_comm_1',
      author: ownerMember.user,
      member: ownerMember,
      content: '/botkanal durum',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, ownerMember, botMember, msgBotKanal);

    const statusMsg = sentMessages.find((m) => m.content.includes('Sistem Kanalları Yapılandırması'));
    expect(statusMsg).toBeDefined();
    // Must NOT contain music channel setting
    expect(statusMsg!.content).not.toContain('Müzik Sistemi Kanalı');

    // /muzikkanal sets music channel, /muzikkanal sil clears it
    const msgMuzikKanal: FluxerMessage = {
      id: 'cmd_mk_1',
      channel_id: 'ch_general',
      guild_id: 'guild_comm_1',
      author: ownerMember.user,
      member: ownerMember,
      content: '/muzikkanal #genel-sohbet',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, ownerMember, botMember, msgMuzikKanal);

    expect(db.getGuildConfig('guild_comm_1')?.music_channel_id).toBe('ch_general');
    expect(sentMessages.some((m) => m.content.includes('Müzik Kanalı Ayarlandı'))).toBe(true);

    const msgMuzikKanalSil: FluxerMessage = {
      id: 'cmd_mk_2',
      channel_id: 'ch_general',
      guild_id: 'guild_comm_1',
      author: ownerMember.user,
      member: ownerMember,
      content: '/muzikkanal sil',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, ownerMember, botMember, msgMuzikKanalSil);
    expect(db.getGuildConfig('guild_comm_1')?.music_channel_id).toBeNull();
  });

  it('5. Toggling daily reward reminder auto-deletes the notification message after a few seconds', async () => {
    vi.useFakeTimers();

    const msgRemind: FluxerMessage = {
      id: 'cmd_remind_1',
      channel_id: 'ch_general',
      guild_id: 'guild_comm_1',
      author: ownerMember.user,
      member: ownerMember,
      content: '/w remind daily on',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, ownerMember, botMember, msgRemind);

    const user = db.getOwoUser(ownerMember.user.id);
    expect(user.daily_reminder).toBe(1);

    expect(sentMessages.some((m) => m.content.includes('Günlük Ödül Hatırlatıcısı **AÇILDI**'))).toBe(true);

    // Fast-forward 5 seconds: auto-delete should be triggered
    vi.advanceTimersByTime(5500);

    expect(deletedMessages.length).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it('6. Supports /modlogs command to list recent moderation logs directly in chat', async () => {
    db.addModerationLog('guild_comm_1', 'timeout', 'user_bad', ownerMember.user.id, 'Spam yaptı');

    const msgLogs: FluxerMessage = {
      id: 'cmd_logs_1',
      channel_id: 'ch_general',
      guild_id: 'guild_comm_1',
      author: ownerMember.user,
      member: ownerMember,
      content: '/modlogs',
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(mockGuild, ownerMember, botMember, msgLogs);

    expect(sentMessages.some((m) => m.content.includes('TIMEOUT') && m.content.includes('Spam yaptı'))).toBe(true);
  });
});
