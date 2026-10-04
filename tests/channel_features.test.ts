// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandHandler } from '../src/commands/CommandHandler.js';
import { ModerationService } from '../src/services/ModerationService.js';
import { DatabaseClient } from '../src/database/DatabaseClient.js';
import { Permissions } from '../src/config/constants.js';
import type { FluxerGuild, FluxerMember, FluxerMessage, FluxerChannel } from '../src/types/fluxer.js';

describe('Channel Control, Slowmode, 5 Bot Channels & Music Channel Restrictions', () => {
  let db: DatabaseClient;
  let mockApi: any;
  let handler: CommandHandler;
  let sentMessages: Array<{ channelId: string; content: string; extra?: any }>;
  let modifiedChannels: Array<{ channelId: string; data: any }>;
  let editedPermissions: Array<{ channelId: string; overwriteId: string; data: any }>;
  let deletedPermissions: Array<{ channelId: string; overwriteId: string }>;

  const mockGuild: FluxerGuild = {
    id: 'guild_100',
    name: 'Test Guild',
    owner_id: 'user_owner',
    members: [],
    roles: [
      {
        id: 'guild_100',
        name: '@everyone',
        color: 0,
        hoist: false,
        position: 0,
        permissions: '0',
      },
      {
        id: 'role_admin',
        name: 'Admin',
        color: 0,
        hoist: false,
        position: 10,
        permissions: Permissions.ADMINISTRATOR.toString(),
      },
    ],
    channels: [
      { id: 'ch_text_1', name: 'genel-sohbet', type: 0 },
      { id: 'ch_text_2', name: 'bot-komut', type: 0 },
      { id: 'ch_text_3', name: 'muzik-odasi', type: 0 },
      { id: 'ch_text_4', name: 'duyurular', type: 0 },
      { id: 'ch_text_5', name: 'sohbet-2', type: 0 },
      { id: 'ch_text_6', name: 'sohbet-3', type: 0 },
    ],
  };

  const ownerMember: FluxerMember = {
    user: { id: 'user_owner', username: 'Owner', discriminator: '0001' },
    roles: ['role_admin'],
    joined_at: new Date().toISOString(),
  };

  const adminMember: FluxerMember = {
    user: { id: 'user_admin', username: 'Admin', discriminator: '0002' },
    roles: ['role_admin'],
    joined_at: new Date().toISOString(),
  };

  const regularMember: FluxerMember = {
    user: { id: 'user_regular', username: 'RegularUser', discriminator: '0003' },
    roles: [],
    joined_at: new Date().toISOString(),
  };

  const botMember: FluxerMember = {
    user: { id: 'bot_id', username: 'MicupBot', discriminator: '0000', bot: true },
    roles: ['role_admin'],
    joined_at: new Date().toISOString(),
  };

  beforeEach(() => {
    sentMessages = [];
    modifiedChannels = [];
    editedPermissions = [];
    deletedPermissions = [];

    mockApi = {
      sendMessage: vi.fn(async (channelId: string, content: string, extra?: any) => {
        sentMessages.push({ channelId, content, extra });
        return {
          id: `msg_${Date.now()}_${Math.random()}`,
          channel_id: channelId,
          content,
          author: botMember.user,
          timestamp: new Date().toISOString(),
        };
      }),
      deleteMessage: vi.fn(async () => {}),
      getGuild: vi.fn(async () => mockGuild),
      getGuildMember: vi.fn(async (_guildId: string, userId: string) => {
        if (userId === 'user_owner') return ownerMember;
        if (userId === 'user_admin') return adminMember;
        if (userId === 'user_regular') return regularMember;
        if (userId === 'bot_id') return botMember;
        return null;
      }),
      getGuildRoles: vi.fn(async () => mockGuild.roles),
      getGuildChannels: vi.fn(async () => mockGuild.channels),
      getChannel: vi.fn(async (channelId: string) => {
        const found = mockGuild.channels.find((c) => c.id === channelId);
        return found || { id: channelId, name: 'kanal', type: 0 };
      }),
      modifyChannel: vi.fn(async (channelId: string, data: any) => {
        modifiedChannels.push({ channelId, data });
        return { id: channelId, name: 'kanal', type: 0, ...data };
      }),
      editChannelPermissions: vi.fn(async (channelId: string, overwriteId: string, data: any) => {
        editedPermissions.push({ channelId, overwriteId, data });
      }),
      deleteChannelPermission: vi.fn(async (channelId: string, overwriteId: string) => {
        deletedPermissions.push({ channelId, overwriteId });
      }),
    };

    db = new DatabaseClient(':memory:');
    const modService = new ModerationService(mockApi as any, db);
    const mockAntiSpam = { handleMessage: vi.fn().mockResolvedValue(false) } as any;
    const mockAntiLink = { handleMessage: vi.fn().mockResolvedValue(false) } as any;
    const mockModLog = { sendModLog: vi.fn().mockResolvedValue(undefined) } as any;
    const mockMusicService = {
      getUserVoiceChannel: vi.fn().mockReturnValue(null),
      getPlayer: vi.fn().mockReturnValue(null),
    } as any;

    handler = new CommandHandler(
      mockApi as any,
      modService,
      {} as any,
      {} as any,
      {} as any,
      mockModLog,
      mockAntiSpam,
      mockAntiLink,
      {} as any,
      mockMusicService,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      db,
    );
  });

  describe('1. /lock (#kanal) and /unlock (#kanal)', () => {
    it('locks channel by denying SEND_MESSAGES on @everyone and logs action', async () => {
      const msg: FluxerMessage = {
        id: 'msg_lock_1',
        channel_id: 'ch_text_1',
        guild_id: 'guild_100',
        author: adminMember.user,
        member: adminMember,
        content: '/lock #genel-sohbet Bakım yapılıyor',
        timestamp: new Date().toISOString(),
      };

      await handler.handleMessage(mockGuild, adminMember, botMember, msg);

      expect(editedPermissions.length).toBe(1);
      expect(editedPermissions[0].channelId).toBe('ch_text_1');
      expect(editedPermissions[0].overwriteId).toBe('guild_100'); // @everyone ID is guild ID
      const denyBit = BigInt(editedPermissions[0].data.deny);
      expect((denyBit & Permissions.SEND_MESSAGES) === Permissions.SEND_MESSAGES).toBe(true);

      expect(sentMessages.some((m) => m.content.includes('kilitlendi'))).toBe(true);

      const logs = db.getGuildModerationLogs('guild_100');
      expect(logs.some((l) => l.action_type === 'LOCK')).toBe(true);
    });

    it('works with /kilitle alias and defaults to current channel if none provided', async () => {
      const msg: FluxerMessage = {
        id: 'msg_lock_2',
        channel_id: 'ch_text_2',
        guild_id: 'guild_100',
        author: adminMember.user,
        member: adminMember,
        content: '/kilitle',
        timestamp: new Date().toISOString(),
      };

      await handler.handleMessage(mockGuild, adminMember, botMember, msg);

      expect(editedPermissions.length).toBe(1);
      expect(editedPermissions[0].channelId).toBe('ch_text_2');
      expect(sentMessages.some((m) => m.content.includes('<#ch_text_2> kanalı başarıyla kilitlendi'))).toBe(true);
    });

    it('unlocks channel with /unlock and /kilitac', async () => {
      const msgUnlock: FluxerMessage = {
        id: 'msg_unlock_1',
        channel_id: 'ch_text_1',
        guild_id: 'guild_100',
        author: adminMember.user,
        member: adminMember,
        content: '/kilitac #genel-sohbet',
        timestamp: new Date().toISOString(),
      };

      await handler.handleMessage(mockGuild, adminMember, botMember, msgUnlock);

      expect(sentMessages.some((m) => m.content.includes('kilidi başarıyla açıldı'))).toBe(true);
      const logs = db.getGuildModerationLogs('guild_100');
      expect(logs.some((l) => l.action_type === 'UNLOCK')).toBe(true);
    });

    it('rejects regular members without MANAGE_CHANNELS from locking channels', async () => {
      const msg: FluxerMessage = {
        id: 'msg_lock_fail',
        channel_id: 'ch_text_1',
        guild_id: 'guild_100',
        author: regularMember.user,
        member: regularMember,
        content: '/lock',
        timestamp: new Date().toISOString(),
      };

      await handler.handleMessage(mockGuild, regularMember, botMember, msg);

      expect(editedPermissions.length).toBe(0);
      expect(sentMessages.some((m) => m.content.includes('gereken yetkiye sahip değilsiniz') || m.content.includes('Yetkiniz yetersiz'))).toBe(true);
    });
  });

  describe('2. /slowmode and /yavasmod', () => {
    it('sets slowmode duration in seconds on target channel', async () => {
      const msg: FluxerMessage = {
        id: 'msg_sm_1',
        channel_id: 'ch_text_1',
        guild_id: 'guild_100',
        author: adminMember.user,
        member: adminMember,
        content: '/slowmode 10 #genel-sohbet',
        timestamp: new Date().toISOString(),
      };

      await handler.handleMessage(mockGuild, adminMember, botMember, msg);

      expect(modifiedChannels.length).toBe(1);
      expect(modifiedChannels[0].channelId).toBe('ch_text_1');
      expect(modifiedChannels[0].data.rate_limit_per_user).toBe(10);
      expect(sentMessages.some((m) => m.content.includes('10 saniye'))).toBe(true);
    });

    it('disables slowmode with /slowmode 0 or /slowmode kapat', async () => {
      const msg: FluxerMessage = {
        id: 'msg_sm_2',
        channel_id: 'ch_text_1',
        guild_id: 'guild_100',
        author: adminMember.user,
        member: adminMember,
        content: '/yavasmod kapat',
        timestamp: new Date().toISOString(),
      };

      await handler.handleMessage(mockGuild, adminMember, botMember, msg);

      expect(modifiedChannels.length).toBe(1);
      expect(modifiedChannels[0].data.rate_limit_per_user).toBe(0);
      expect(sentMessages.some((m) => m.content.includes('kapatıldı'))).toBe(true);
    });
  });

  describe('3. Five Bot Channels Support (Up to 5 Channels)', () => {
    it('automatically slots up to 5 bot channels sequentially', async () => {
      // Add channel 1
      await handler.handleMessage(mockGuild, adminMember, botMember, {
        id: 'm1', channel_id: 'ch_text_1', guild_id: 'guild_100',
        author: adminMember.user, member: adminMember, content: '/botkanal #genel-sohbet', timestamp: '',
      });
      // Add channel 2
      await handler.handleMessage(mockGuild, adminMember, botMember, {
        id: 'm2', channel_id: 'ch_text_1', guild_id: 'guild_100',
        author: adminMember.user, member: adminMember, content: '/botkanal #bot-komut', timestamp: '',
      });
      // Add channel 3
      await handler.handleMessage(mockGuild, adminMember, botMember, {
        id: 'm3', channel_id: 'ch_text_1', guild_id: 'guild_100',
        author: adminMember.user, member: adminMember, content: '/botkanal #duyurular', timestamp: '',
      });
      // Add channel 4
      await handler.handleMessage(mockGuild, adminMember, botMember, {
        id: 'm4', channel_id: 'ch_text_1', guild_id: 'guild_100',
        author: adminMember.user, member: adminMember, content: '/botkanal #sohbet-2', timestamp: '',
      });
      // Add channel 5
      await handler.handleMessage(mockGuild, adminMember, botMember, {
        id: 'm5', channel_id: 'ch_text_1', guild_id: 'guild_100',
        author: adminMember.user, member: adminMember, content: '/botkanal #sohbet-3', timestamp: '',
      });

      const cfg = db.getGuildConfig('guild_100');
      expect(cfg?.bot_channel_id).toBe('ch_text_1');
      expect(cfg?.bot_channel_id_2).toBe('ch_text_2');
      expect(cfg?.bot_channel_id_3).toBe('ch_text_4');
      expect(cfg?.bot_channel_id_4).toBe('ch_text_5');
      expect(cfg?.bot_channel_id_5).toBe('ch_text_6');

      // 6th attempt should inform that max 5 channels limit is reached
      await handler.handleMessage(mockGuild, adminMember, botMember, {
        id: 'm6', channel_id: 'ch_text_1', guild_id: 'guild_100',
        author: adminMember.user, member: adminMember, content: '/botkanal #muzik-odasi', timestamp: '',
      });
      expect(sentMessages.some((m) => m.content.includes('Maksimum bot kanalı limitine ulaşıldı'))).toBe(true);
    });

    it('enforces bot channel restriction on regular users across all 5 slots', async () => {
      db.updateGuildConfig('guild_100', {
        bot_channel_id: 'ch_text_1',
        bot_channel_id_2: 'ch_text_2',
        bot_channel_id_3: 'ch_text_4',
      });

      // Regular user trying to run /rank in ch_text_3 (not in allowed list)
      await handler.handleMessage(mockGuild, regularMember, botMember, {
        id: 'm_rank_fail', channel_id: 'ch_text_3', guild_id: 'guild_100',
        author: regularMember.user, member: regularMember, content: '/rank', timestamp: '',
      });

      expect(sentMessages.some((m) => m.content.includes('bot komutları yalnızca bu kanalda kullanılabilir'))).toBe(true);

      // In allowed slot 2 (ch_text_2), regular user is allowed
      sentMessages = [];
      await handler.handleMessage(mockGuild, regularMember, botMember, {
        id: 'm_rank_ok', channel_id: 'ch_text_2', guild_id: 'guild_100',
        author: regularMember.user, member: regularMember, content: '/rank', timestamp: '',
      });
      // Should not send channel restriction warning
      expect(sentMessages.some((m) => m.content.includes('bot komutları yalnızca bu kanalda kullanılabilir'))).toBe(false);
    });

    it('supports deleting specific slot like /botkanal sil 3 or /botkanal sil hepsi', async () => {
      db.updateGuildConfig('guild_100', {
        bot_channel_id: 'ch_text_1',
        bot_channel_id_2: 'ch_text_2',
        bot_channel_id_3: 'ch_text_4',
      });

      await handler.handleMessage(mockGuild, adminMember, botMember, {
        id: 'm_del_3', channel_id: 'ch_text_1', guild_id: 'guild_100',
        author: adminMember.user, member: adminMember, content: '/botkanal sil 3', timestamp: '',
      });

      let cfg = db.getGuildConfig('guild_100');
      expect(cfg?.bot_channel_id_3).toBeNull();
      expect(cfg?.bot_channel_id).toBe('ch_text_1');

      await handler.handleMessage(mockGuild, adminMember, botMember, {
        id: 'm_del_all', channel_id: 'ch_text_1', guild_id: 'guild_100',
        author: adminMember.user, member: adminMember, content: '/botkanal sil hepsi', timestamp: '',
      });
      cfg = db.getGuildConfig('guild_100');
      expect(cfg?.bot_channel_id).toBeNull();
      expect(cfg?.bot_channel_id_2).toBeNull();
    });
  });

  describe('4. Dedicated Music Channel (OwO-like System)', () => {
    it('sets dedicated music channel via /muzikkanal and /music kanal', async () => {
      await handler.handleMessage(mockGuild, adminMember, botMember, {
        id: 'm_mk_1', channel_id: 'ch_text_1', guild_id: 'guild_100',
        author: adminMember.user, member: adminMember, content: '/muzikkanal #muzik-odasi', timestamp: '',
      });

      let cfg = db.getGuildConfig('guild_100');
      expect(cfg?.music_channel_id).toBe('ch_text_3');
      expect(sentMessages.some((m) => m.content.includes('Müzik Kanalı Ayarlandı'))).toBe(true);

      // Also /music kanal sil
      await handler.handleMessage(mockGuild, adminMember, botMember, {
        id: 'm_mk_del', channel_id: 'ch_text_1', guild_id: 'guild_100',
        author: adminMember.user, member: adminMember, content: '/music kanal sil', timestamp: '',
      });
      cfg = db.getGuildConfig('guild_100');
      expect(cfg?.music_channel_id).toBeNull();
    });

    it('blocks regular users from using music commands outside music channel with auto-expiring notice', async () => {
      db.updateGuildConfig('guild_100', { music_channel_id: 'ch_text_3' });

      // Regular user tries to use /play in #genel-sohbet (ch_text_1)
      await handler.handleMessage(mockGuild, regularMember, botMember, {
        id: 'm_play_fail', channel_id: 'ch_text_1', guild_id: 'guild_100',
        author: regularMember.user, member: regularMember, content: '/play duman', timestamp: '',
      });

      expect(sentMessages.some((m) => m.content.includes('Müzik komutları yalnızca <#ch_text_3> kanalında kullanılabilir'))).toBe(true);

      // Admin user is privileged and can use it anywhere (though will get voice channel requirement if not in voice)
      sentMessages = [];
      await handler.handleMessage(mockGuild, adminMember, botMember, {
        id: 'm_play_admin', channel_id: 'ch_text_1', guild_id: 'guild_100',
        author: adminMember.user, member: adminMember, content: '/play duman', timestamp: '',
      });
      expect(sentMessages.some((m) => m.content.includes('Müzik komutları yalnızca'))).toBe(false);
    });
  });
});
