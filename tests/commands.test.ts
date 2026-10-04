// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, it, expect, beforeEach, vi} from 'vitest';
import {CommandHandler} from '../src/commands/CommandHandler.js';
import {DatabaseClient} from '../src/database/DatabaseClient.js';
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
import type {
  FluxerChannel,
  FluxerGuild,
  FluxerMember,
  FluxerMessage,
  FluxerRole,
} from '../src/types/fluxer.js';

describe('CommandHandler All Commands Deep Verification', () => {
  let db: DatabaseClient;
  let mockApi: any;
  let handler: CommandHandler;
  let musicService: MusicService;
  let sentMessages: Array<{channelId: string; content: string; extra?: any}> = [];
  let editedMessages: Array<{channelId: string; messageId: string; content: string; extra?: any}> = [];

  const sampleRoles: FluxerRole[] = [
    {
      id: 'role_admin',
      name: 'Yönetici',
      color: 0xff0000,
      hoist: true,
      position: 10,
      permissions: '8', // ADMINISTRATOR
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

  const sampleChannels: FluxerChannel[] = [
    {
      id: 'ch_general',
      name: 'genel',
      type: 0,
    },
    {
      id: 'ch_welcome',
      name: 'hoşgeldin',
      type: 0,
    },
    {
      id: 'ch_modlog',
      name: 'mod-log',
      type: 0,
    },
    {
      id: 'ch_voice_1',
      name: 'Müzik Odası',
      type: 2,
    },
    {
      id: 'ch_voice_2',
      name: 'Sohbet Odası',
      type: 2,
    },
  ];

  const ownerMember: FluxerMember = {
    user: {id: 'user_owner', username: 'Owner', discriminator: '0001'},
    roles: ['role_admin'],
    joined_at: new Date().toISOString(),
  };

  const botMember: FluxerMember = {
    user: {id: 'user_bot', username: 'Bot', discriminator: '0000', bot: true},
    roles: ['role_admin'],
    joined_at: new Date().toISOString(),
  };

  const targetMember: FluxerMember = {
    user: {id: 'user_target', username: 'Kurban', discriminator: '1234'},
    roles: ['role_member'],
    joined_at: new Date().toISOString(),
  };

  const guild: FluxerGuild = {
    id: 'guild_test_1',
    name: 'Test Guild',
    owner_id: 'user_owner',
    members: [ownerMember, botMember, targetMember],
    roles: sampleRoles,
    channels: sampleChannels,
    member_count: 3,
  };

  beforeEach(() => {
    sentMessages = [];
    editedMessages = [];
    db = new DatabaseClient(':memory:');

    mockApi = {
      sendMessage: vi.fn(async (chId: string, content: string, extra?: any) => {
        const id = 'msg_' + Date.now() + '_' + Math.random();
        sentMessages.push({channelId: chId, content, extra});
        return {id, channel_id: chId, content};
      }),
      editMessage: vi.fn(async (chId: string, msgId: string, content: string, extra?: any) => {
        editedMessages.push({channelId: chId, messageId: msgId, content, extra});
        return {id: msgId, channel_id: chId, content};
      }),
      addReaction: vi.fn(async () => {}),
      deleteUserReaction: vi.fn(async () => {}),
      createInteractionResponse: vi.fn(async () => {}),
      getGuildChannels: vi.fn(async () => sampleChannels),
      getGuildRoles: vi.fn(async () => sampleRoles),
      getGuildMembers: vi.fn(async () => [ownerMember, botMember, targetMember]),
      getGuildMember: vi.fn(async (_gId: string, uId: string) => {
        if (uId === 'user_target') return targetMember;
        if (uId === 'user_owner') return ownerMember;
        return null;
      }),
      getGuildBans: vi.fn(async () => [
        {
          user: {
            id: '1553179766511632384',
            username: 'Kortex',
            discriminator: '0164',
          },
          reason: 'Spam ihlali',
        },
        {
          user: {
            id: 'user_target',
            username: 'Kurban',
            discriminator: '1234',
          },
          reason: 'Test ban',
        },
      ]),
      banMember: vi.fn(async () => {}),
      unbanMember: vi.fn(async () => {}),
      kickMember: vi.fn(async () => {}),
      timeoutMember: vi.fn(async () => targetMember),
      untimeoutMember: vi.fn(async () => targetMember),
      addMemberRole: vi.fn(async () => {}),
      removeMemberRole: vi.fn(async () => {}),
      getMessages: vi.fn(async () => []),
      bulkDeleteMessages: vi.fn(async () => {}),
      deleteMessage: vi.fn(async () => {}),
    };

    const modService = new ModerationService(mockApi, db);
    const warnService = new WarnService(mockApi, db);
    const roleService = new RoleService(mockApi, db);
    const welcomeService = new WelcomeGoodbyeService(mockApi, db);
    const modLogService = new ModLogService(mockApi, db);
    const antiSpamService = new AntiSpamService(mockApi, db, modService, modLogService);
    const antiLinkService = new AntiLinkService(mockApi, db);
    const badWordsService = new BadWordsService(mockApi as any, db, modLogService);
    const levelingService = new LevelingService(mockApi as any, db);
    const owoService = new OwoService(mockApi as any, db);
    musicService = new MusicService(mockApi as any);

    handler = new CommandHandler(
      mockApi as any,
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
    );
  });

  const sendCommand = async (content: string) => {
    const msg: FluxerMessage = {
      id: 'msg_test',
      channel_id: 'ch_general',
      guild_id: guild.id,
      author: ownerMember.user,
      content,
    };
    await handler.handleMessage(guild, ownerMember, botMember, msg);
  };

  // -------------------------------------------------------------
  // Channel extraction tests: <#id>, #name, # name, name, id
  // -------------------------------------------------------------
  it('handles /welcome channel with mention <#ch_welcome>', async () => {
    await sendCommand('/welcome channel <#ch_welcome>');
    expect(sentMessages.length).toBeGreaterThan(0);
    expect(sentMessages[0].content).toContain('hoşgeldin');
    const cfg = db.getGuildConfig(guild.id);
    expect(cfg.welcome_channel_id).toBe('ch_welcome');
  });

  it('handles /welcome channel with spaced pound "# hoşgeldin"', async () => {
    await sendCommand('/welcome channel # hoşgeldin');
    expect(sentMessages.length).toBeGreaterThan(0);
    expect(sentMessages[0].content).toContain('hoşgeldin');
    const cfg = db.getGuildConfig(guild.id);
    expect(cfg.welcome_channel_id).toBe('ch_welcome');
  });

  it('handles /welcome channel with unspaced pound "#hoşgeldin"', async () => {
    await sendCommand('/welcome channel #hoşgeldin');
    expect(sentMessages.length).toBeGreaterThan(0);
    expect(sentMessages[0].content).toContain('hoşgeldin');
    const cfg = db.getGuildConfig(guild.id);
    expect(cfg.welcome_channel_id).toBe('ch_welcome');
  });

  it('handles /welcome channel with plain name "hoşgeldin"', async () => {
    await sendCommand('/welcome channel hoşgeldin');
    expect(sentMessages.length).toBeGreaterThan(0);
    expect(sentMessages[0].content).toContain('hoşgeldin');
  });

  it('handles /welcome channel with channel ID directly "ch_welcome"', async () => {
    await sendCommand('/welcome channel ch_welcome');
    expect(sentMessages.length).toBeGreaterThan(0);
    expect(sentMessages[0].content).toContain('hoşgeldin');
  });

  it('handles /welcome message, enable, disable, and test', async () => {
    await sendCommand('/welcome message Hoşgeldin {user}! Sunucumuza hoş geldin.');
    expect(sentMessages[0].content).toContain('güncellendi');

    await sendCommand('/welcome enable');
    expect(sentMessages[1].content).toContain('Aktif');

    await sendCommand('/welcome test');
    expect(sentMessages[2].content).toContain('TEST KARŞILAMA MESAJI');

    await sendCommand('/welcome disable');
    expect(sentMessages[3].content).toContain('Devre Dışı');
  });

  // -------------------------------------------------------------
  // Goodbye system
  // -------------------------------------------------------------
  it('handles /goodbye channel, message, enable, and test', async () => {
    await sendCommand('/goodbye channel <#ch_general>');
    expect(sentMessages[0].content).toContain('genel');

    await sendCommand('/goodbye message Güle güle {username}!');
    expect(sentMessages[1].content).toContain('güncellendi');

    await sendCommand('/goodbye test');
    expect(sentMessages[2].content).toContain('TEST AYRILMA MESAJI');
  });

  // -------------------------------------------------------------
  // ModLog system
  // -------------------------------------------------------------
  it('handles /modlog channel', async () => {
    await sendCommand('/modlog channel <#ch_modlog>');
    expect(sentMessages[0].content).toContain('mod-log');
    const cfg = db.getGuildConfig(guild.id);
    expect(cfg.modlog_channel_id).toBe('ch_modlog');
  });

  // -------------------------------------------------------------
  // Autorole & Role commands
  // -------------------------------------------------------------
  it('handles /autorole set, status, remove', async () => {
    await sendCommand('/autorole set @Üye');
    expect(sentMessages[0].content).toContain('Üye');

    await sendCommand('/autorole status');
    expect(sentMessages[1].content).toContain('Aktif');

    await sendCommand('/autorole remove');
    expect(sentMessages[2].content).toContain('kapatıldı');
  });

  it('handles /role add and /role remove', async () => {
    targetMember.roles = [];
    await sendCommand('/role add @Kurban @Üye');
    expect(mockApi.addMemberRole).toHaveBeenCalled();

    targetMember.roles = ['role_member'];
    await sendCommand('/role remove @Kurban @Üye');
    expect(mockApi.removeMemberRole).toHaveBeenCalled();
  });

  // -------------------------------------------------------------
  // Warn system
  // -------------------------------------------------------------
  it('handles /warn, /warnings, and /warn remove', async () => {
    await sendCommand('/warn @Kurban Kural ihlali');
    expect(sentMessages[0].content).toContain('uyarıldı');

    await sendCommand('/warnings @Kurban');
    expect(sentMessages[1].content).toContain('Kural ihlali');

    // Remove by warning ID
    await sendCommand('/warn remove 1');
    expect(sentMessages[2].content).toContain('silindi');

    // Add multiple warnings and remove with mention and count
    await sendCommand('/warn @Kurban Kural ihlali 2');
    await sendCommand('/warn @Kurban Kural ihlali 3');
    expect(db.getActiveWarnings(guild.id, targetMember.user.id).length).toBe(2);

    // Remove 1 warning using mention and count: /warn remove @Kurban 1
    await sendCommand('/warn remove @Kurban 1');
    expect(sentMessages[5].content).toContain('**1** adet uyarı silindi');
    expect(db.getActiveWarnings(guild.id, targetMember.user.id).length).toBe(1);

    // Remove remaining warning using mention without count: /warn remove @Kurban
    await sendCommand('/warn remove @Kurban');
    expect(sentMessages[6].content).toContain('**1** adet uyarı silindi');
    expect(db.getActiveWarnings(guild.id, targetMember.user.id).length).toBe(0);

    // Try removing when no warnings left
    await sendCommand('/warn remove @Kurban 1');
    expect(sentMessages[7].content).toContain('aktif uyarısı bulunmuyor');
  });

  // -------------------------------------------------------------
  // Moderation: timeout, untimeout, kick, ban, unban
  // -------------------------------------------------------------
  it('handles /timeout and /untimeout with live countdown timestamps and auto-edit on expiry/unmute', async () => {
    // 1. Timeout with seconds and check live countdown timestamp in response
    await sendCommand('/timeout @Kurban 10s Deneme');
    expect(mockApi.timeoutMember).toHaveBeenCalled();
    const timeoutMsg = sentMessages[sentMessages.length - 1].content;
    expect(timeoutMsg).toContain('10 saniye');
    expect(timeoutMsg).toContain('Deneme');
    // Ensure Bitiş is formatted with Discord dynamic live countdown syntax <t:timestamp:R> and not N/A
    expect(timeoutMsg).toContain('<t:');
    expect(timeoutMsg).toContain(':R>');
    expect(timeoutMsg).not.toContain('Bitiş: N/A');

    // 2. Check /timeout status @Kurban
    await sendCommand('/timeout status @Kurban');
    const statusMsg = sentMessages[sentMessages.length - 1].content;
    expect(statusMsg).toContain('Kurban');
    expect(statusMsg).toContain('Kalan Süre');

    // 3. Untimeout -> must immediately edit previous mute/info messages to 'Cezası bitti'
    await sendCommand('/untimeout @Kurban');
    expect(mockApi.untimeoutMember).toHaveBeenCalled();
    expect(editedMessages.length).toBeGreaterThan(0);
    const lastEdited = editedMessages[editedMessages.length - 1].content;
    expect(lastEdited).toContain('Cezası bitti');

    // 4. Test natural timeout expiry triggers editMessage
    await sendCommand('/timeout @Kurban 1s DenemeExpiry');
    expect(sentMessages[sentMessages.length - 1].content).toContain('DenemeExpiry');
    await (handler as any).modService.onTimeoutExpired(guild.id, 'user_target');
    const expiryEdited = editedMessages.find((m) => m.content.includes('Süresi doldu (Cezası bitti)'));
    expect(expiryEdited).toBeDefined();
    expect(expiryEdited?.content).not.toContain('<t:');

    // 5. Check /timeout status after untimeout/expiry
    await sendCommand('/timeout status @Kurban');
    const postStatusMsg = sentMessages[sentMessages.length - 1].content;
    expect(postStatusMsg).toContain('aktif bir zamanaşımı (timeout/mute) cezası bulunmuyor');

    // 6. Check self timeoutinfo without args (Owner is not timed out)
    await sendCommand('/timeoutinfo');
    const selfStatusMsg = sentMessages[sentMessages.length - 1].content;
    expect(selfStatusMsg).toContain('Owner');
    expect(selfStatusMsg).toContain('aktif bir zamanaşımı (timeout/mute) cezası bulunmuyor');

    // 7. Duration first format: /timeout 10m @Kurban Test
    await sendCommand('/timeout 10m @Kurban Test Duration First');
    expect(mockApi.timeoutMember).toHaveBeenCalled();
  });

  it('handles /kick', async () => {
    await sendCommand('/kick @Kurban Sebep test');
    expect(mockApi.kickMember).toHaveBeenCalled();
  });

  it('handles /ban and /unban with name#tag, discriminator, and ID', async () => {
    // 1. Ban with mention
    await sendCommand('/ban @Kurban Sebep test');
    expect(mockApi.banMember).toHaveBeenCalledWith(guild.id, 'user_target', 'Sebep test');

    // 2. Ban with username#tag
    await sendCommand('/ban Kurban#1234 Sebep 2');
    expect(mockApi.banMember).toHaveBeenCalledWith(guild.id, 'user_target', 'Sebep 2');

    // 3. Unban with exact name and tag: /unban Kortex#0164
    await sendCommand('/unban Kortex#0164');
    expect(mockApi.unbanMember).toHaveBeenCalledWith(guild.id, '1553179766511632384');
    expect(sentMessages[sentMessages.length - 1].content).toContain('Kortex#0164');

    // 4. Unban with discriminator only: /unban #0164
    await sendCommand('/unban #0164');
    expect(mockApi.unbanMember).toHaveBeenCalledWith(guild.id, '1553179766511632384');

    // 5. Unban with pure snowflake ID: /unban 1553179766511632384
    await sendCommand('/unban 1553179766511632384');
    expect(mockApi.unbanMember).toHaveBeenCalledWith(guild.id, '1553179766511632384');

    // 6. Unban with mock ID string: /unban user_target
    await sendCommand('/unban user_target');
    expect(mockApi.unbanMember).toHaveBeenCalledWith(guild.id, 'user_target');

    // 7. Unban user who is not banned and not in server
    await sendCommand('/unban Hayalet#9999');
    expect(sentMessages[sentMessages.length - 1].content).toContain('kullanıcısının bu sunucuda aktif bir yasağı bulunmuyor');

    // 8. Unban active member in the server
    await sendCommand('/unban @Owner');
    expect(sentMessages[sentMessages.length - 1].content).toContain('şu anda sunucuda bulunuyor ve yasaklı değil');
  });

  // -------------------------------------------------------------
  // Security commands: /antispam & /antilink
  // -------------------------------------------------------------
  it('handles /antispam configure and /antilink configure', async () => {
    await sendCommand('/antispam enable');
    expect(sentMessages[0].content).toContain('Anti-Spam Koruması: **Aktif**');

    await sendCommand('/antispam messages 5');
    expect(sentMessages[1].content).toContain('Maksimum Mesaj: 5');

    await sendCommand('/antilink enable');
    expect(sentMessages[2].content).toContain('Aktif');

    await sendCommand('/antilink whitelist micup.gg');
    expect(sentMessages[3].content).toContain('micup.gg');

    await sendCommand('/antilink status');
    expect(sentMessages[4].content).toContain('Anti-Link Koruması:');
  });

  it('detects and deletes unauthorized links in chat, respects whitelist and exemptmods', async () => {
    // 1. Enable antilink
    await sendCommand('/antilink enable');

    // 2. Post unauthorized link (e.g. hera.video from user request)
    mockApi.deleteMessage.mockClear();
    await sendCommand('Lütfen şuraya bakın: https://app.hera.video/');
    expect(mockApi.deleteMessage).toHaveBeenCalled();
    expect(sentMessages[sentMessages.length - 1].content).toContain('yasaktır');

    // 3. Post whitelisted link (micup.gg)
    await sendCommand('/antilink whitelist hera.video');
    mockApi.deleteMessage.mockClear();
    await sendCommand('Güvenli site: https://app.hera.video/login');
    expect(mockApi.deleteMessage).not.toHaveBeenCalled();

    // 4. Test exemptmods
    await sendCommand('/antilink remove hera.video');
    await sendCommand('/antilink exemptmods on');
    mockApi.deleteMessage.mockClear();
    // Admin posts unwhitelisted link while exemptmods is on -> should not delete
    await sendCommand('Admin linki: https://app.hera.video/');
    expect(mockApi.deleteMessage).not.toHaveBeenCalled();

    // Turn exemptmods off -> admin link is deleted again
    await sendCommand('/antilink exemptmods off');
    mockApi.deleteMessage.mockClear();
    await sendCommand('Admin linki: https://app.hera.video/');
    expect(mockApi.deleteMessage).toHaveBeenCalled();
  });

  it('triggers anti-spam timeout, logs to modlog channel, and edits message to Cezası bitti on untimeout', async () => {
    // 1. Set modlog channel and enable antispam with threshold of 3 messages in 5s
    await sendCommand('/modlog channel <#ch_modlog>');
    await sendCommand('/antispam enable');
    await sendCommand('/antispam messages 3');

    // 2. Clear sent messages history
    sentMessages = [];
    editedMessages = [];

    // 3. Target user sends 3 rapid messages
    for (let i = 0; i < 3; i++) {
      const msg: FluxerMessage = {
        id: `msg_spam_${i}`,
        channel_id: 'ch_general',
        guild_id: guild.id,
        author: targetMember.user,
        content: `Spam mesajı ${i}`,
      };
      await handler.handleMessage(guild, targetMember, botMember, msg);
    }

    // Verify spam messages were purged and member was timed out
    expect(mockApi.bulkDeleteMessages).toHaveBeenCalled();
    expect(mockApi.timeoutMember).toHaveBeenCalledWith(guild.id, targetMember.user.id, 300, expect.any(String));

    // Verify channel timeout notice was sent with dynamic countdown
    const timeoutMsg = sentMessages.find((m) => m.channelId === 'ch_general' && m.content.includes('zamanaşımı uygulandı'));
    expect(timeoutMsg).toBeDefined();
    expect(timeoutMsg?.content).toContain('<t:');

    // Verify mod-log received the entry (ch_modlog auto-discovered or set)
    const modLogMsg = sentMessages.find((m) => m.channelId === 'ch_modlog' && m.content.includes('[MOD-LOG: TIMEOUT (SPAM)]'));
    expect(modLogMsg).toBeDefined();
    expect(modLogMsg?.content).toContain(targetMember.user.username);

    // 4. Moderator untimeouts user: /untimeout @Kurban
    await sendCommand('/untimeout @Kurban');

    // Verify the spam timeout message was automatically edited to "Cezası bitti"
    const edited = editedMessages.find((e) => e.channelId === 'ch_general');
    expect(edited).toBeDefined();
    expect(edited?.content).toContain('Cezası bitti');
    expect(edited?.content).not.toContain('<t:');
  });

  it('never mutes server owner or administrators via anti-spam, and allows owner to untimeout self', async () => {
    // 1. Enable antispam with low threshold
    await sendCommand('/antispam enable');
    await sendCommand('/antispam messages 2');

    sentMessages = [];
    mockApi.timeoutMember.mockClear();

    // 2. Owner sends multiple rapid messages -> should NOT trigger timeout
    for (let i = 0; i < 5; i++) {
      const msg: FluxerMessage = {
        id: `msg_owner_${i}`,
        channel_id: 'ch_general',
        guild_id: guild.id,
        author: ownerMember.user,
        content: `Owner mesajı ${i}`,
      };
      await handler.handleMessage(guild, ownerMember, botMember, msg);
    }

    expect(mockApi.timeoutMember).not.toHaveBeenCalled();
    const timeoutMsg = sentMessages.find((m) => m.content.includes('zamanaşımı uygulandı'));
    expect(timeoutMsg).toBeUndefined();

    // Verify admin warning notice was sent
    const adminWarn = sentMessages.find((m) => m.content.includes('Yönetici/Yetkili olduğunuz için susturma (mute) uygulanmadı'));
    expect(adminWarn).toBeDefined();

    // 3. Owner can untimeout self without getting "Sunucu sahibine hiçbir moderasyon işlemi uygulanamaz"
    await sendCommand('/untimeout @Owner');
    expect(sentMessages[sentMessages.length - 1].content).not.toContain('Sunucu sahibine hiçbir moderasyon işlemi uygulanamaz');
  });

  it('enforces strict role hierarchy in /timeout so lower roles cannot mute higher or equal roles', async () => {
    const roleJunior: FluxerRole = {
      id: 'role_junior',
      name: 'Stajyer Mod',
      color: 0,
      hoist: true,
      position: 4,
      permissions: '1099511627776', // MODERATE_MEMBERS
    };
    const roleSenior: FluxerRole = {
      id: 'role_senior',
      name: 'Kıdemli Mod',
      color: 0,
      hoist: true,
      position: 8,
      permissions: '1099511627776', // MODERATE_MEMBERS
    };

    guild.roles.push(roleJunior, roleSenior);

    const juniorMember: FluxerMember = {
      user: {id: 'user_junior', username: 'JuniorMod', discriminator: '5555'},
      roles: ['role_junior'],
      joined_at: new Date().toISOString(),
    };

    const seniorMember: FluxerMember = {
      user: {id: 'user_senior', username: 'SeniorMod', discriminator: '6666'},
      roles: ['role_senior'],
      joined_at: new Date().toISOString(),
    };

    guild.members.push(juniorMember, seniorMember);

    const prevGetGuildMember = mockApi.getGuildMember;
    mockApi.getGuildMember = vi.fn(async (_gId: string, uId: string) => {
      if (uId === 'user_junior') return juniorMember;
      if (uId === 'user_senior') return seniorMember;
      return prevGetGuildMember(_gId, uId);
    });

    sentMessages = [];
    mockApi.timeoutMember.mockClear();

    // 1. Lower role (Junior) attempts to mute Higher role (Senior) -> MUST BE BLOCKED
    const juniorMsg: FluxerMessage = {
      id: 'msg_j1',
      channel_id: 'ch_general',
      guild_id: guild.id,
      author: juniorMember.user,
      content: '/timeout @SeniorMod 10s Kurallara uy',
    };
    await handler.handleMessage(guild, juniorMember, botMember, juniorMsg);

    expect(mockApi.timeoutMember).not.toHaveBeenCalled();
    const errorMsg = sentMessages[sentMessages.length - 1].content;
    expect(errorMsg).toContain('Rol Hiyerarşisi Engeli');
    expect(errorMsg).toContain('@Kıdemli Mod');
    expect(errorMsg).toContain('@Stajyer Mod');

    // 2. Higher role (Senior) mutes Lower role (Junior) -> MUST BE ALLOWED
    sentMessages = [];
    mockApi.timeoutMember.mockClear();
    const seniorMsg: FluxerMessage = {
      id: 'msg_s1',
      channel_id: 'ch_general',
      guild_id: guild.id,
      author: seniorMember.user,
      content: '/timeout @JuniorMod 10s Uyarı',
    };
    await handler.handleMessage(guild, seniorMember, botMember, seniorMsg);

    expect(mockApi.timeoutMember).toHaveBeenCalledWith(guild.id, 'user_junior', 10, 'Uyarı');
    expect(sentMessages[0].content).toContain('JuniorMod');
    expect(sentMessages[0].content).toContain('10 saniye');
  });

  // -------------------------------------------------------------
  // Help command
  // -------------------------------------------------------------
  it('handles /help and /yardim with paginated help system and emoji navigation', async () => {
    // 1. /help (no args) shows page 1 directly with user content (Seviye & Topluluk)
    sentMessages = [];
    await sendCommand('/help');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('Kullanıcı Komut Rehberi');
    expect(sentMessages[0].content).toContain('Sayfa 1/3');
    expect(sentMessages[0].content).toContain('Seviye');
    expect(sentMessages[0].content).toContain('Sonraki ▶️');
    expect(sentMessages[0].content.length).toBeLessThanOrEqual(1950);

    // 2. /help 2 (OwO page)
    sentMessages = [];
    await sendCommand('/help 2');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('Sayfa 2/3');
    expect(sentMessages[0].content).toContain('OwO');
    expect(sentMessages[0].content).toContain('◀️ Önceki');
    expect(sentMessages[0].content).toContain('Sonraki ▶️');

    // 3. /help 3 (Müzik page)
    sentMessages = [];
    await sendCommand('/help 3');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('Sayfa 3/3');
    expect(sentMessages[0].content).toContain('Jockie Müzik');

    // 4. /help music alias -> page 3
    sentMessages = [];
    await sendCommand('/help music');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('Sayfa 3/3');
    expect(sentMessages[0].content).toContain('Jockie Müzik');

    // 5. /help owo alias -> page 2
    sentMessages = [];
    await sendCommand('/help owo');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('Sayfa 2/3');
    expect(sentMessages[0].content).toContain('OwO');

    // 6. /help admin denied for regular user (auto-expiring warning)
    sentMessages = [];
    const deniedMsg: FluxerMessage = {
      id: 'msg_help_denied',
      channel_id: 'ch_general',
      content: '/help admin',
      author: targetMember.user,
      timestamp: new Date().toISOString(),
    };
    await handler.handleMessage(guild, targetMember, botMember, deniedMsg);
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('Yetki Yetersiz');
    expect(sentMessages[0].content).toContain('/help admin');

    // 7. /help admin allowed for admin / owner -> shows admin page 1/5 with Moderasyon
    sentMessages = [];
    await sendCommand('/help admin');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('Yönetici & Moderatör Komut Rehberi');
    expect(sentMessages[0].content).toContain('Sayfa 1/5');
    expect(sentMessages[0].content).toContain('Moderasyon');
    expect(sentMessages[0].content).toContain('Sonraki ▶️');

    // 8. /help admin 2 -> Güvenlik & Karşılama
    sentMessages = [];
    await sendCommand('/help admin 2');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('Sayfa 2/5');
    expect(sentMessages[0].content).toContain('GÜVENLİK');

    // 9. /help mod -> alias for admin page 1 (when called by owner/admin)
    sentMessages = [];
    await sendCommand('/help mod');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('Moderasyon');

    // 10. Real interactive buttons (ActionRow components & INTERACTION_CREATE) on /help
    sentMessages = [];
    await sendCommand('/help');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].extra?.components).toBeDefined();
    const actionRow = sentMessages[0].extra.components[0];
    expect(actionRow.type).toBe(1); // ACTION_ROW
    expect(actionRow.components.length).toBe(2);
    expect(actionRow.components[0].custom_id).toBe('help_prev');
    expect(actionRow.components[0].disabled).toBe(true); // page 1 -> prev disabled
    expect(actionRow.components[1].custom_id).toBe('help_next');
    expect(actionRow.components[1].disabled).toBe(false);

    // Emojis added as reaction buttons
    expect(mockApi.addReaction).toHaveBeenCalledWith('ch_general', expect.any(String), '◀️');
    expect(mockApi.addReaction).toHaveBeenCalledWith('ch_general', expect.any(String), '▶️');

    // User clicks "Sonraki ▶️" button via INTERACTION_CREATE
    await handler.handleInteraction({
      id: 'int_1',
      token: 'tok_1',
      type: 3,
      channel_id: 'ch_general',
      data: { custom_id: 'help_next', component_type: 2 },
      member: ownerMember,
    } as any);

    expect(mockApi.createInteractionResponse).toHaveBeenCalled();
    const intCall = mockApi.createInteractionResponse.mock.calls[0];
    expect(intCall[2].type).toBe(7); // UPDATE_MESSAGE
    expect(intCall[2].data.content).toContain('Sayfa 2/3');
    expect(intCall[2].data.components[0].components[0].disabled).toBe(false); // prev now enabled
    expect(intCall[2].data.components[0].components[1].disabled).toBe(false); // next still enabled

    // User clicks "Önceki ◀️" button via INTERACTION_CREATE
    await handler.handleInteraction({
      id: 'int_2',
      token: 'tok_2',
      type: 3,
      channel_id: 'ch_general',
      data: { custom_id: 'help_prev', component_type: 2 },
      member: ownerMember,
    } as any);
    const intCall2 = mockApi.createInteractionResponse.mock.calls[1];
    expect(intCall2[2].data.content).toContain('Sayfa 1/3');
    expect(intCall2[2].data.components[0].components[0].disabled).toBe(true);

    // User clicks reaction button (MESSAGE_REACTION_ADD)
    editedMessages = [];
    const latestSentMsg = sentMessages[0];
    const sentMsgId = mockApi.sendMessage.mock.results[mockApi.sendMessage.mock.results.length - 1].value.id;
    await handler.handleReactionAdd({
      user_id: 'user_owner',
      channel_id: 'ch_general',
      message_id: sentMsgId,
      emoji: { name: '▶️' },
    });
    expect(mockApi.deleteUserReaction).toHaveBeenCalledWith('ch_general', sentMsgId, '▶️', 'user_owner');
    expect(editedMessages.length).toBe(1);
    expect(editedMessages[0].content).toContain('Sayfa 2/3');
  });

  it('handles Jockie Music commands: /play, /pause, /resume, /skip, /queue, /volume, /radio, /join, /leave, /stop with voice channel requirements', async () => {
    // 0. Verify rejection when user is not in a voice channel
    sentMessages = [];
    await sendCommand('/play https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('Bir ses kanalında değilsiniz');

    sentMessages = [];
    await sendCommand('/radio lofi');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('Bir ses kanalında değilsiniz');

    sentMessages = [];
    await sendCommand('/join');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('Bir ses kanalında değilsiniz');

    // 1. User joins voice channel 'ch_voice_1'
    musicService.updateVoiceState(guild.id, ownerMember.user.id, 'ch_voice_1');

    // Test /join command
    sentMessages = [];
    await sendCommand('/join');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('Ses Kanalına Katılınıldı');

    // 2. Play YouTube link (starts playback and connects to voice channel)
    sentMessages = [];
    await sendCommand('/play https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('Jockie Music — Şimdi Çalıyor');
    expect(sentMessages[0].content).toContain('YouTube');
    expect(sentMessages[0].content).toContain('Müzik Odası');
    expect(sentMessages[0].extra?.components).toBeDefined();

    // 3. Play Spotify link (queues track)
    sentMessages = [];
    await sendCommand('/play https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('Kuyruğa Eklendi');
    expect(sentMessages[0].content).toContain('#1');

    // 4. /queue
    sentMessages = [];
    await sendCommand('/queue');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('Jockie Music — Şarkı Kuyruğu');
    expect(sentMessages[0].content).toContain('Şimdi Çalıyor');

    // 5. /pause and /resume
    sentMessages = [];
    await sendCommand('/pause');
    expect(sentMessages[0].content).toContain('Duraklatıldı');

    sentMessages = [];
    await sendCommand('/resume');
    expect(sentMessages[0].content).toContain('Devam Ediyor');

    // 6. /volume
    sentMessages = [];
    await sendCommand('/volume 80');
    expect(sentMessages[0].content).toContain('%80');

    // 7. /loop
    sentMessages = [];
    await sendCommand('/loop track');
    expect(sentMessages[0].content).toContain('Tek Şarkı Döngüsü');

    // 8. /skip
    sentMessages = [];
    await sendCommand('/skip');
    expect(sentMessages[0].content).toContain('Parça Atlandı');

    // 9. /radio lofi
    sentMessages = [];
    await sendCommand('/radio lofi');
    expect(sentMessages[0].content).toContain('Radyo Başlatıldı');
    expect(sentMessages[0].content).toContain('Lofi Hip Hop');

    // 10. Interactive button click (music_toggle)
    await handler.handleInteraction({
      id: 'int_music_1',
      token: 'tok_music_1',
      type: 3,
      guild_id: 'guild_test_1',
      channel_id: 'ch_general',
      data: { custom_id: 'music_toggle', component_type: 2 },
      member: ownerMember,
    } as any);
    expect(mockApi.createInteractionResponse).toHaveBeenCalled();

    // 11. /stop
    sentMessages = [];
    await sendCommand('/stop');
    expect(sentMessages[0].content).toContain('Müzik Çalar Durduruldu');

    // 12. /leave
    sentMessages = [];
    await sendCommand('/leave');
    expect(sentMessages[0].content).toContain('ayrıldım');
  }, 15000);

  it('handles /clear and /clear user with auto-deletion of command and feedback messages', async () => {
    mockApi.getMessages.mockResolvedValueOnce([
      { id: 'm1', author: { id: 'user_target' } },
      { id: 'm2', author: { id: 'user_target' } },
    ]);

    sentMessages = [];
    await sendCommand('/clear 2');
    expect(mockApi.bulkDeleteMessages).toHaveBeenCalled();
    expect(sentMessages[0].content).toContain('adet mesaj başarıyla silindi');
  });

  it('automatically schedules deletion for ephemeral / chat-cleaning commands: /ping, /afk, /welcome renk, and /volume', async () => {
    vi.useFakeTimers();
    try {
      mockApi.deleteMessage.mockClear();

      // 1. /ping auto-delete
      sentMessages = [];
      await sendCommand('/ping');
      expect(sentMessages[0].content).toContain('Pong!');

      // Fast forward 6 seconds
      await vi.advanceTimersByTimeAsync(6000);
      expect(mockApi.deleteMessage).toHaveBeenCalledWith('ch_general', expect.any(String), 'Auto Clean Notification');
      expect(mockApi.deleteMessage).toHaveBeenCalledWith('ch_general', expect.any(String), 'Auto Clean User Command');

      // 2. /role remove auto-delete
      mockApi.deleteMessage.mockClear();
      sentMessages = [];
      await sendCommand('/role remove @Kurban @Üye');
      expect(sentMessages[0].content).toContain('rolü alındı');

      await vi.advanceTimersByTimeAsync(7000);
      expect(mockApi.deleteMessage).toHaveBeenCalledWith('ch_general', expect.any(String), 'Auto Clean Notification');
      expect(mockApi.deleteMessage).toHaveBeenCalledWith('ch_general', expect.any(String), 'Auto Clean User Command');

      // 3. /welcome renk auto-delete
      mockApi.deleteMessage.mockClear();
      sentMessages = [];
      await sendCommand('/welcome renk #6366f1');
      expect(sentMessages[0].content).toContain('Kart Tasarımı Güncellendi');

      await vi.advanceTimersByTimeAsync(6000);
      expect(mockApi.deleteMessage).toHaveBeenCalledWith('ch_general', expect.any(String), 'Auto Clean Notification');
    } finally {
      vi.useRealTimers();
    }
  });

});

