// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, it, expect, beforeEach, vi} from 'vitest';
import {CommunityService} from '../src/services/CommunityService.js';
import {GiveawayService} from '../src/services/GiveawayService.js';
import {BadWordsService} from '../src/services/BadWordsService.js';
import {CommandHandler} from '../src/commands/CommandHandler.js';
import {DatabaseClient} from '../src/database/DatabaseClient.js';
import type {FluxerGuild, FluxerMember, FluxerMessage} from '../types/fluxer.js';

describe('Community & Engagement & Security Defense System', () => {
  let db: DatabaseClient;
  let mockApi: any;
  let communityService: CommunityService;
  let giveawayService: GiveawayService;
  let badWordsService: BadWordsService;
  let guild: FluxerGuild;
  let adminMember: FluxerMember;
  let regularMember: FluxerMember;
  let otherMember: FluxerMember;

  beforeEach(() => {
    db = new DatabaseClient(':memory:');
    mockApi = {
      sendMessage: vi.fn(async () => ({id: 'msg_created_1'})),
      deleteMessage: vi.fn(async () => {}),
      timeoutMember: vi.fn(async () => ({})),
      addReaction: vi.fn(async () => {}),
      editMessage: vi.fn(async () => ({id: 'msg_created_1'})),
      createInteractionResponse: vi.fn(async () => {}),
    };

    communityService = new CommunityService(mockApi as any, db);
    giveawayService = new GiveawayService(mockApi as any, db);
    giveawayService.stop(); // Stop automatic interval for deterministic unit tests
    badWordsService = new BadWordsService(mockApi as any, db);

    guild = {
      id: 'guild_comm_1',
      name: 'Topluluk Sunucusu',
      owner_id: 'user_owner',
      roles: [
        {id: 'role_admin', name: 'Admin', color: 0, hoist: false, position: 2, permissions: (1n << 3n).toString()},
        {id: 'role_mod', name: 'Mod', color: 0, hoist: false, position: 1, permissions: (1n << 13n).toString()}, // MANAGE_MESSAGES
      ],
      channels: [{id: 'ch_chat', name: 'sohbet', type: 0}],
      members: [],
    };

    adminMember = {
      user: {id: 'user_admin', username: 'Admin', discriminator: '0001', bot: false},
      roles: ['role_admin'],
      joined_at: new Date().toISOString(),
    };

    regularMember = {
      user: {id: 'user_reg', username: 'NormalUye', discriminator: '0002', bot: false},
      roles: [],
      joined_at: new Date().toISOString(),
    };

    otherMember = {
      user: {id: 'user_other', username: 'DigerUye', discriminator: '0003', bot: false},
      roles: [],
      joined_at: new Date().toISOString(),
    };
  });

  describe('AFK System', () => {
    it('sets AFK, notifies channel when someone mentions AFK user, and clears AFK when user speaks', async () => {
      // 1. User sets AFK
      const res = communityService.setAfk(guild, regularMember, 'Ders çalışıyorum');
      expect(res.success).toBe(true);
      expect(res.message).toContain('Ders çalışıyorum');

      const afkRecord = db.getAfk(guild.id, regularMember.user.id);
      expect(afkRecord).not.toBeNull();
      expect(afkRecord?.reason).toBe('Ders çalışıyorum');

      // 2. Another user mentions the AFK user
      const mentionMsg: FluxerMessage = {
        id: 'msg_mention',
        channel_id: 'ch_chat',
        guild_id: guild.id,
        author: otherMember.user,
        content: `Naber <@${regularMember.user.id}> nerdesin?`,
        timestamp: new Date().toISOString(),
      };
      await communityService.handleAfkMentions(guild, mentionMsg);
      expect(mockApi.sendMessage).toHaveBeenCalledWith(
        'ch_chat',
        expect.stringContaining('Ders çalışıyorum'),
      );

      // 3. AFK user sends a message -> AFK is automatically cleared
      const speakMsg: FluxerMessage = {
        id: 'msg_speak',
        channel_id: 'ch_chat',
        guild_id: guild.id,
        author: regularMember.user,
        content: 'Ben geldim!',
        timestamp: new Date().toISOString(),
      };
      const wasAfk = await communityService.handleAfkSpeaker(guild, regularMember, speakMsg);
      expect(wasAfk).toBe(true);
      expect(mockApi.sendMessage).toHaveBeenCalledWith(
        'ch_chat',
        expect.stringContaining('AFK modundan çıktın'),
      );
      expect(db.getAfk(guild.id, regularMember.user.id)).toBeNull();
    });
  });

  describe('Custom Commands & Auto-Responder (/tag)', () => {
    it('manages custom tags: add, get, list, and remove', () => {
      const addRes = communityService.addTag(guild, adminMember, 'ip', 'play.sunucum.com');
      expect(addRes.success).toBe(true);

      const tag = communityService.getTag(guild, 'ip');
      expect(tag).not.toBeNull();
      expect(tag?.content).toBe('play.sunucum.com');

      const listRes = communityService.listTags(guild);
      expect(listRes.message).toContain('ip');
      expect(listRes.message).toContain('Açık');

      const delRes = communityService.removeTag(guild, adminMember, 'ip');
      expect(delRes.success).toBe(true);
      expect(communityService.getTag(guild, 'ip')).toBeNull();
    });

    it('toggles the auto-responder system on and off via setTagsEnabled', () => {
      expect(communityService.isTagsEnabled(guild.id)).toBe(true);

      const offRes = communityService.setTagsEnabled(guild, adminMember, false);
      expect(offRes.success).toBe(true);
      expect(communityService.isTagsEnabled(guild.id)).toBe(false);

      const status = communityService.getStatus(guild);
      expect(status.message).toContain('Kapalı');

      const onRes = communityService.setTagsEnabled(guild, adminMember, true);
      expect(onRes.success).toBe(true);
      expect(communityService.isTagsEnabled(guild.id)).toBe(true);
    });

    it('automatically responds to messages without / or ! when keyword or sentence matches', async () => {
      communityService.addTag(guild, adminMember, 'ip', 'play.sunucum.com');
      communityService.addTag(guild, adminMember, 'sa', 'Aleyküm selam, hoş geldin!');
      communityService.addTag(guild, adminMember, 'discord linki', 'https://discord.gg/testserver');

      // 1. Exact message without prefix
      const msg1: FluxerMessage = {
        id: 'msg_auto_1',
        channel_id: 'ch_chat_1',
        guild_id: guild.id,
        author: regularMember.user,
        content: 'ip',
        timestamp: new Date().toISOString(),
      };
      const handled1 = await communityService.handleAutoResponse(guild, regularMember, msg1);
      expect(handled1).toBe(true);
      expect(mockApi.sendMessage).toHaveBeenCalledWith('ch_chat_1', 'play.sunucum.com');

      // 2. Message with punctuation at end: "sa!"
      const msg2: FluxerMessage = {
        id: 'msg_auto_2',
        channel_id: 'ch_chat_2',
        guild_id: guild.id,
        author: regularMember.user,
        content: 'sa!',
        timestamp: new Date().toISOString(),
      };
      const handled2 = await communityService.handleAutoResponse(guild, regularMember, msg2);
      expect(handled2).toBe(true);
      expect(mockApi.sendMessage).toHaveBeenCalledWith('ch_chat_2', 'Aleyküm selam, hoş geldin!');

      // 3. Multi-word sentence trigger: "arkadaşlar discord linki nedir"
      const msg3: FluxerMessage = {
        id: 'msg_auto_3',
        channel_id: 'ch_chat_3',
        guild_id: guild.id,
        author: regularMember.user,
        content: 'arkadaşlar discord linki nedir',
        timestamp: new Date().toISOString(),
      };
      const handled3 = await communityService.handleAutoResponse(guild, regularMember, msg3);
      expect(handled3).toBe(true);
      expect(mockApi.sendMessage).toHaveBeenCalledWith('ch_chat_3', 'https://discord.gg/testserver');

      // 4. Standalone word boundary test: "takip ettim" must NOT trigger "ip"
      const msg4: FluxerMessage = {
        id: 'msg_auto_4',
        channel_id: 'ch_chat_4',
        guild_id: guild.id,
        author: regularMember.user,
        content: 'seni takip ettim dün',
        timestamp: new Date().toISOString(),
      };
      const handled4 = await communityService.handleAutoResponse(guild, regularMember, msg4);
      expect(handled4).toBe(false);

      // 5. Classic prefix "!ip" still works
      const msg5: FluxerMessage = {
        id: 'msg_auto_5',
        channel_id: 'ch_chat_5',
        guild_id: guild.id,
        author: regularMember.user,
        content: '!ip',
        timestamp: new Date().toISOString(),
      };
      const handled5 = await communityService.handleAutoResponse(guild, regularMember, msg5);
      expect(handled5).toBe(true);
      expect(mockApi.sendMessage).toHaveBeenCalledWith('ch_chat_5', 'play.sunucum.com');
    });

    it('does not respond when the system is disabled (off)', async () => {
      communityService.addTag(guild, adminMember, 'ip', 'play.sunucum.com');
      communityService.setTagsEnabled(guild, adminMember, false);

      const msg: FluxerMessage = {
        id: 'msg_off_1',
        channel_id: 'ch_chat_off',
        guild_id: guild.id,
        author: regularMember.user,
        content: 'ip',
        timestamp: new Date().toISOString(),
      };
      const handled = await communityService.handleAutoResponse(guild, regularMember, msg);
      expect(handled).toBe(false);
      expect(mockApi.sendMessage).not.toHaveBeenCalledWith('ch_chat_off', 'play.sunucum.com');
    });

    it('formats dynamic variables like {user}, {username}, {server}, {memberCount}, {channel}, {random}', async () => {
      guild.member_count = 42;
      communityService.addTag(
        guild,
        adminMember,
        'selam',
        'Aleyküm selam {user}! {server} sunucumuza hoş geldin. {channel} kanalındasın. {memberCount} kişiyiz. Zar: {random:1-6}',
      );

      const msg: FluxerMessage = {
        id: 'msg_vars_1',
        channel_id: 'ch_chat_vars',
        guild_id: guild.id,
        author: regularMember.user,
        content: 'selam',
        timestamp: new Date().toISOString(),
      };

      const handled = await communityService.handleAutoResponse(guild, regularMember, msg);
      expect(handled).toBe(true);

      expect(mockApi.sendMessage).toHaveBeenCalledWith(
        'ch_chat_vars',
        expect.stringMatching(
          new RegExp(`Aleyküm selam <@${regularMember.user.id}>! ${guild.name} sunucumuza hoş geldin\\. <#ch_chat_vars> kanalındasın\\. 42 kişiyiz\\. Zar: [1-6]`)
        ),
      );
    });
  });

  describe('Mass Mention Protection', () => {
    it('deletes message and timeouts member when mention limit is exceeded', async () => {
      db.updateGuildConfig(guild.id, {massmention_enabled: 1, massmention_limit: 3});

      const spamMsg: FluxerMessage = {
        id: 'msg_mass_1',
        channel_id: 'ch_chat',
        guild_id: guild.id,
        author: regularMember.user,
        content: 'Baksanıza <@111> <@222> <@333> <@444>',
        timestamp: new Date().toISOString(),
      };

      const violated = await communityService.handleMassMention(guild, regularMember, spamMsg);
      expect(violated).toBe(true);
      expect(mockApi.deleteMessage).toHaveBeenCalledWith('ch_chat', 'msg_mass_1', expect.any(String));
      expect(mockApi.timeoutMember).toHaveBeenCalledWith(guild.id, regularMember.user.id, 600, expect.any(String));
      expect(mockApi.sendMessage).toHaveBeenCalledWith('ch_chat', expect.stringContaining('Toplu etiketleme'));
    });

    it('blocks unauthorized @everyone and @here mentions', async () => {
      db.updateGuildConfig(guild.id, {massmention_enabled: 1});

      const everyoneMsg: FluxerMessage = {
        id: 'msg_everyone',
        channel_id: 'ch_chat',
        guild_id: guild.id,
        author: regularMember.user,
        content: 'selam @everyone toplanın',
        timestamp: new Date().toISOString(),
      };

      const violated = await communityService.handleMassMention(guild, regularMember, everyoneMsg);
      expect(violated).toBe(true);
      expect(mockApi.deleteMessage).toHaveBeenCalled();
      expect(mockApi.timeoutMember).toHaveBeenCalled();
    });
  });

  describe('Capslock Protection', () => {
    it('deletes message when uppercase percentage exceeds threshold', async () => {
      db.updateGuildConfig(guild.id, {capslock_enabled: 1, capslock_percentage: 70});

      const screamMsg: FluxerMessage = {
        id: 'msg_scream',
        channel_id: 'ch_chat',
        guild_id: guild.id,
        author: regularMember.user,
        content: 'HEMEN HERKES BURAYA GELSİN ÇABUK OLUN',
        timestamp: new Date().toISOString(),
      };

      const violated = await communityService.handleCapslock(guild, regularMember, screamMsg);
      expect(violated).toBe(true);
      expect(mockApi.deleteMessage).toHaveBeenCalledWith('ch_chat', 'msg_scream', expect.any(String));
      expect(mockApi.sendMessage).toHaveBeenCalledWith('ch_chat', expect.stringContaining('capslock'));
    });

    it('ignores normal casing messages', async () => {
      db.updateGuildConfig(guild.id, {capslock_enabled: 1, capslock_percentage: 70});

      const normalMsg: FluxerMessage = {
        id: 'msg_norm',
        channel_id: 'ch_chat',
        guild_id: guild.id,
        author: regularMember.user,
        content: 'Merhaba arkadaşlar nasılsınız bugün?',
        timestamp: new Date().toISOString(),
      };

      const violated = await communityService.handleCapslock(guild, regularMember, normalMsg);
      expect(violated).toBe(false);
      expect(mockApi.deleteMessage).not.toHaveBeenCalled();
    });
  });

  describe('Giveaway System', () => {
    it('starts giveaway with button & reaction, records participants via interaction, and concludes with ÇEKİLİŞ BİTTİ', async () => {
      // 1. Start giveaway
      const startRes = await giveawayService.startGiveaway(
        guild,
        'ch_chat',
        adminMember,
        '10m',
        1,
        'Discord Nitro 1 Aylık',
      );
      expect(startRes.success).toBe(true);

      // Verify button was passed directly to sendMessage
      expect(mockApi.sendMessage).toHaveBeenCalledWith(
        'ch_chat',
        expect.stringContaining('ÇEKİLİŞ BAŞLADI'),
        expect.objectContaining({
          components: expect.arrayContaining([
            expect.objectContaining({
              type: 1,
              components: expect.arrayContaining([
                expect.objectContaining({
                  type: 2,
                  label: expect.stringContaining('Katıl'),
                }),
              ]),
            }),
          ]),
        }),
      );

      // Verify reaction was added
      expect(mockApi.addReaction).toHaveBeenCalledWith('ch_chat', 'msg_created_1', '🎉');

      const giveaways = db.getGuildGiveaways(guild.id);
      expect(giveaways.length).toBe(1);
      const giveaway = giveaways[0];
      expect(giveaway.prize).toBe('Discord Nitro 1 Aylık');
      expect(giveaway.status).toBe('active');

      // 2. Member joins via interactive button
      const joinRes1 = await giveawayService.handleJoinInteraction(giveaway.id, regularMember);
      expect(joinRes1.success).toBe(true);
      expect(joinRes1.message).toContain('başarıyla katıldınız');

      // Re-joining gives warning
      const joinRes2 = await giveawayService.handleJoinInteraction(giveaway.id, regularMember);
      expect(joinRes2.success).toBe(false);
      expect(joinRes2.message).toContain('zaten katılmış');

      // 3. Other member joins
      await giveawayService.handleJoinInteraction(giveaway.id, otherMember);

      // 4. Conclude giveaway
      const updatedGiveaway = db.getGiveaway(giveaway.id)!;
      await giveawayService.concludeGiveaway(updatedGiveaway);

      const ended = db.getGiveaway(giveaway.id)!;
      expect(ended.status).toBe('ended');
      const winners: string[] = JSON.parse(ended.winners);
      expect(winners.length).toBe(1);
      expect([regularMember.user.id, otherMember.user.id]).toContain(winners[0]);

      // Verify original message is updated with ÇEKİLİŞ BİTTİ and disabled button (no relative timer)
      expect(mockApi.editMessage).toHaveBeenCalledWith(
        'ch_chat',
        giveaway.message_id,
        expect.stringContaining('🛑 **ÇEKİLİŞ BİTTİ** 🛑'),
        expect.objectContaining({
          components: expect.arrayContaining([
            expect.objectContaining({
              type: 1,
              components: expect.arrayContaining([
                expect.objectContaining({
                  type: 2,
                  custom_id: 'giveaway_ended',
                  disabled: true,
                }),
              ]),
            }),
          ]),
        }),
      );

      expect(mockApi.sendMessage).toHaveBeenCalledWith(
        'ch_chat',
        expect.stringContaining('ÇEKİLİŞ SONA ERDİ'),
      );

      // 5. Reroll
      const rerollRes = await giveawayService.reroll(guild, adminMember, giveaway.message_id);
      expect(rerollRes.success).toBe(true);
      expect(mockApi.sendMessage).toHaveBeenCalledWith(
        'ch_chat',
        expect.stringContaining('YENİ KAZANAN'),
      );
    });

    it('supports ending an active giveaway early via endEarly', async () => {
      await giveawayService.startGiveaway(
        guild,
        'ch_chat',
        adminMember,
        '2h',
        1,
        'Erken Biten Ödül',
      );
      const giveaways = db.getActiveGiveaways();
      expect(giveaways.length).toBe(1);

      const res = await giveawayService.endEarly(guild, adminMember, giveaways[0].message_id);
      expect(res.success).toBe(true);
      expect(db.getActiveGiveaways().length).toBe(0);
    });
  });

  describe('Prefix Security Filter Bypass Prevention', () => {
    it('catches and deletes messages starting with prefix if they contain bad words', async () => {
      db.updateGuildConfig(guild.id, {
        badwords_enabled: 1,
        badwords_filter_default: 1,
      });

      const badMsg: FluxerMessage = {
        id: 'msg_bypass_try',
        channel_id: 'ch_chat',
        guild_id: guild.id,
        author: regularMember.user,
        content: '/amk boyle isin',
        timestamp: new Date().toISOString(),
      };

      // When passed to bad words service, bad word is detected
      const detected = await badWordsService.handleMessage(guild, regularMember, badMsg);
      expect(detected).toBe(true);
      expect(mockApi.deleteMessage).toHaveBeenCalledWith('ch_chat', 'msg_bypass_try', expect.stringContaining('amk'));
    });
  });
});
