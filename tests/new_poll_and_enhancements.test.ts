// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseClient } from '../src/database/DatabaseClient.js';
import {
  parsePollInput,
  buildPollComponents,
  formatPollEmbed,
  formatPollText,
  PollCardGenerator,
} from '../src/services/PollCardGenerator.js';
import { BirthdayService } from '../src/services/BirthdayService.js';
import { MusicService } from '../src/services/MusicService.js';
import { MicupVoiceClient } from '../src/voice/MicupVoiceClient.js';
import type { FluxerGuild, FluxerMember } from '../src/types/fluxer.js';

describe('New Features & Fixes Verification', () => {
  let db: DatabaseClient;

  beforeEach(() => {
    db = new DatabaseClient(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('Poll Input Parsing & Component Generation', () => {
    it('parses poll with question and quoted options', () => {
      const parsed = parsePollInput('Hayat sadece fakirlere mi zordur? "Evet" "Hayır"');
      expect(parsed).not.toBeNull();
      expect(parsed?.question).toBe('Hayat sadece fakirlere mi zordur?');
      expect(parsed?.options).toEqual(['Evet', 'Hayır']);
    });

    it('parses poll when question is also in quotes', () => {
      const parsed = parsePollInput('"Hayat sadece fakirlere mi zordur?" "Evet" "Hayır"');
      expect(parsed).not.toBeNull();
      expect(parsed?.question).toBe('Hayat sadece fakirlere mi zordur?');
      expect(parsed?.options).toEqual(['Evet', 'Hayır']);
    });

    it('defaults to Evet and Hayır when only question is supplied', () => {
      const parsed = parsePollInput('Bu akşam sinema gecesi yapılsın mı?');
      expect(parsed).not.toBeNull();
      expect(parsed?.question).toBe('Bu akşam sinema gecesi yapılsın mı?');
      expect(parsed?.options).toEqual(['Evet', 'Hayır']);
    });

    it('returns null for empty input', () => {
      expect(parsePollInput('')).toBeNull();
      expect(parsePollInput('   ')).toBeNull();
    });

    it('generates poll action rows and finish button with emojis', () => {
      const rows = buildPollComponents(42, ['Evet', 'Hayır'], false);
      expect(rows.length).toBeGreaterThan(0);
      const buttons = rows[0].components;
      expect(buttons.length).toBe(3); // Evet, Hayır, Anketi Bitir
      expect(buttons[0].custom_id).toBe('poll_vote_42_0');
      expect(buttons[0].emoji?.name).toBe('1️⃣');
      expect(buttons[1].custom_id).toBe('poll_vote_42_1');
      expect(buttons[1].emoji?.name).toBe('2️⃣');
      expect(buttons[2].custom_id).toBe('poll_end_42');
    });

    it('formats poll purely as code (embed & text) without image generation', () => {
      const embed = formatPollEmbed({
        question: 'Hayat sadece fakirlere mi zordur?',
        options: [
          { text: 'Evet', votes: 4 },
          { text: 'Hayır', votes: 0 },
        ],
        totalVotes: 4,
        isClosed: true,
      });

      expect(embed.title).toContain('Hayat sadece fakirlere mi zordur?');
      expect(embed.description).toContain('> **Evet**');
      expect(embed.description).toContain('100%');
      expect(embed.description).toContain('✓');
      expect(embed.description).toContain('> **Hayır**');
      expect(embed.description).toContain('0%');
      expect(embed.footer?.text).toBe('4 oy  •  Anket kapandı.');

      const text = formatPollText({
        question: 'Hayat sadece fakirlere mi zordur?',
        options: [
          { text: 'Evet', votes: 4 },
          { text: 'Hayır', votes: 0 },
        ],
        totalVotes: 4,
        isClosed: true,
      });
      expect(text).toContain('> **Evet**');
      expect(text).toContain('> **Hayır**');
      expect(text).toContain('4 oy  •  Anket kapandı.');
    });

    it('generates poll canvas card buffer', async () => {
      const buffer = await PollCardGenerator.generatePollCard({
        question: 'Hayat sadece fakirlere mi zordur?',
        options: [
          { text: 'Evet', votes: 4 },
          { text: 'Hayır', votes: 0 },
        ],
        totalVotes: 4,
        isClosed: true,
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(100);
      // Valid PNG header: \x89PNG
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4e);
      expect(buffer[3]).toBe(0x47);
    });
  });

  describe('Database Poll Operations', () => {
    it('creates poll, records votes, and toggles votes', () => {
      const pollId = db.createPoll('g1', 'c1', 'm1', 'u_author', 'Soru?', ['A', 'B', 'C']);
      expect(pollId).toBeGreaterThan(0);

      const poll = db.getPoll(pollId);
      expect(poll?.question).toBe('Soru?');
      expect(poll?.is_closed).toBe(0);

      // User 1 votes for option 0
      const vote1 = db.votePoll(pollId, 'u1', 0);
      expect(vote1.optionIndex).toBe(0);

      // User 1 votes for option 0 again -> toggles off
      const vote2 = db.votePoll(pollId, 'u1', 0);
      expect(vote2.optionIndex).toBe(-1);

      // User 1 votes for option 1
      db.votePoll(pollId, 'u1', 1);
      // User 2 votes for option 1
      db.votePoll(pollId, 'u2', 1);

      const tallies = db.getPollVotes(pollId);
      const opt1Tally = tallies.find((t) => t.option_index === 1);
      expect(opt1Tally?.count).toBe(2);

      expect(db.getUserPollVote(pollId, 'u1')).toBe(1);

      db.closePoll(pollId);
      const closed = db.getPoll(pollId);
      expect(closed?.is_closed).toBe(1);
    });
  });

  describe('Tempban Duration Database Operations', () => {
    it('adds, retrieves, and removes temporary bans', () => {
      const now = Math.floor(Date.now() / 1000);
      const expire = now + 86400; // 1 day

      db.addTempBan('g1', 'u_target', 'u_mod', 'Spam', '1d', 86400, expire);

      const ban = db.getTempBan('g1', 'u_target');
      expect(ban).not.toBeNull();
      expect(ban?.duration_text).toBe('1d');
      expect(ban?.expire_unix).toBe(expire);

      const allActive = db.getAllActiveTempBans();
      expect(allActive.length).toBe(1);

      db.removeTempBan('g1', 'u_target');
      expect(db.getTempBan('g1', 'u_target')).toBeNull();
    });
  });

  describe('Cross-Community Guild Tracking', () => {
    it('tracks user memberships across guilds and formats common guilds in OwO profile', () => {
      db.trackUserGuild('guild_1', 'Micup Türkiye', 'u_player');
      db.trackUserGuild('guild_2', 'Oyun Dünyası', 'u_player');
      db.trackUserGuild('guild_3', 'Anime Kulübü', 'u_player');

      const guilds = db.getUserCommonGuilds('u_player');
      expect(guilds.length).toBe(3);
      const names = guilds.map((g) => g.guild_name);
      expect(names).toContain('Micup Türkiye');
      expect(names).toContain('Oyun Dünyası');
      expect(names).toContain('Anime Kulübü');
    });
  });

  describe('Birthday Mention & Deletion Security', () => {
    const mockApi: any = {
      sendMessage: async () => ({ id: 'msg_1' }),
    };

    it('only mentions the command runner in listBirthdays', async () => {
      const bs = new BirthdayService(mockApi, db);
      const guild: FluxerGuild = { id: 'g1', name: 'Test Guild', owner_id: 'o1' };
      const invoker: FluxerMember = {
        user: { id: 'u_invoker', username: 'BatuneX', discriminator: '0' },
        roles: [],
        joined_at: new Date().toISOString(),
      };

      // Set birthdays
      bs.setBirthday(guild.id, invoker.user.id, 15, 6, 2000);
      const otherUser: FluxerMember = {
        user: { id: 'u_other', username: 'Ahmet', discriminator: '0' },
        roles: [],
        joined_at: new Date().toISOString(),
      };
      bs.setBirthday(guild.id, otherUser.user.id, 20, 6, 1999);
      guild.members = [invoker, otherUser];

      const listRes = bs.listBirthdays(guild, invoker);
      expect(listRes.success).toBe(true);

      // Invoker MUST be pinged/tagged with <@u_invoker>
      expect(listRes.message).toContain('<@u_invoker>');

      // Other user MUST NOT be pinged/tagged with <@u_other>! Must be plain name
      expect(listRes.message).not.toContain('<@u_other>');
      expect(listRes.message).toContain('**Ahmet**');
    });
  });

  describe('Music Effects Toggle (8D and others)', () => {
    const mockApi: any = {
      sendMessage: async () => ({ id: 'msg_1' }),
      editMessage: async () => ({ id: 'msg_1' }),
    };
    const voiceClient = new MicupVoiceClient();
    const musicService = new MusicService(mockApi, voiceClient, db);

    it('turns 8D on and off properly', () => {
      const onRes = musicService.setFilter('g1', '8d');
      expect(onRes.success).toBe(true);
      expect(musicService.getFilter('g1').filterName).toContain('8D Audio');

      const offRes = musicService.setFilter('g1', '8d', 'off');
      expect(offRes.success).toBe(true);
      expect(musicService.getFilter('g1').filterName).toBeNull();
    });

    it('turns bassboost on and off properly', () => {
      const onRes = musicService.setFilter('g1', 'bassboost', 'high');
      expect(onRes.success).toBe(true);
      expect(musicService.getFilter('g1').filterName).toContain('BassBoost');

      const offRes = musicService.setFilter('g1', 'off');
      expect(offRes.success).toBe(true);
      expect(musicService.getFilter('g1').filterName).toBeNull();
    });
  });

  describe('Offline User Display in Birthday & Lists', () => {
    it('displays the user real name in listBirthdays even when user is offline (not in guild.members)', async () => {
      const mockApi: any = {
        getGuildMember: async () => null,
        getUser: async () => ({ id: 'u_offline', username: 'MehmetOffline' }),
        sendMessage: async () => ({ id: 'msg_1' }),
      };
      const bs = new BirthdayService(mockApi, db);
      const guild: FluxerGuild = {
        id: 'g_test',
        name: 'Test Guild',
        owner_id: 'u_invoker',
        roles: [],
        emojis: [],
        members: [], // guild.members is empty! Everyone is offline
      };

      // Set birthday with username
      bs.setBirthday(guild.id, 'u_offline_1', 10, 5, 2001, 'AyseKaya');
      // Set birthday without username in call, but present in user_names table
      db.saveUserName('u_offline_2', 'AliVeli');
      bs.setBirthday(guild.id, 'u_offline_2', 12, 5, 1998);

      const listRes = await bs.listBirthdays(guild);
      expect(listRes.success).toBe(true);
      // Both users MUST be displayed with their real names, NOT generic "Kullanıcı"
      expect(listRes.message).toContain('**AyseKaya**');
      expect(listRes.message).toContain('**AliVeli**');
      expect(listRes.message).not.toContain('Kullanıcı (');
    });
  });

  describe('Poll Interactive Button & Reaction Voting', () => {
    it('handles button vote interaction with type 7 UPDATE_MESSAGE', async () => {
      let callbackPayload: any = null;
      const mockApi: any = {
        createInteractionResponse: async (id: string, token: string, body: any) => {
          callbackPayload = body;
        },
        editMessage: async () => ({ id: 'poll_msg_1' }),
      };

      const { CommandHandler } = await import('../src/commands/CommandHandler.js');
      const createHandler = (api: any, database: any) =>
        new CommandHandler(
          api,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          database,
        );
      const handler = createHandler(mockApi, db);

      // Create a poll in DB
      const pollId = db.createPoll('g1', 'c1', 'poll_msg_1', 'u_author', 'Kahve mi çay mı?', ['Kahve', 'Çay']);

      // User votes for option 0 (Kahve) via button
      const interaction: any = {
        id: 'int_1',
        token: 'token_1',
        data: { custom_id: `poll_vote_${pollId}_0` },
        member: { user: { id: 'u_voter', username: 'Voter' }, roles: [] },
        channel_id: 'c1',
        message: { id: 'poll_msg_1', channel_id: 'c1' },
      };

      const handled = await handler.handleInteraction(interaction);
      expect(handled).toBe(true);
      expect(callbackPayload).not.toBeNull();
      expect(callbackPayload.type).toBe(7); // UPDATE_MESSAGE
      expect(callbackPayload.data.embeds[0].description).toContain('Kahve');
      expect(callbackPayload.data.embeds[0].description).toContain('100%');

      // Verify vote recorded in DB
      expect(db.getUserPollVote(pollId, 'u_voter')).toBe(0);
    });

    it('handles emoji reaction voting and retraction', async () => {
      let editedContent: any = null;
      const mockApi: any = {
        editMessage: async (ch: string, msg: string, content: string, extra: any) => {
          editedContent = extra;
          return { id: msg };
        },
        getGuild: async (gid: string) => ({
          id: gid,
          owner_id: 'u_owner_1',
          roles: [],
        }),
      };

      const { CommandHandler } = await import('../src/commands/CommandHandler.js');
      const createHandler = (api: any, database: any) =>
        new CommandHandler(
          api,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          database,
        );
      const handler = createHandler(mockApi, db);

      const pollId = db.createPoll('g1', 'c1', 'poll_msg_2', 'u_author', 'Hangi renk?', ['Yeşil', 'Kırmızı']);

      // 1. Add reaction 1️⃣ (option 0)
      const reactEvent: any = {
        guild_id: 'g1',
        channel_id: 'c1',
        message_id: 'poll_msg_2',
        user_id: 'u_react_voter',
        emoji: { name: '1️⃣' },
      };

      const handled = await handler.handleReactionAdd(reactEvent);
      expect(handled).toBe(true);
      expect(db.getUserPollVote(pollId, 'u_react_voter')).toBe(0);
      expect(editedContent.embeds[0].description).toContain('> **Yeşil**');
      expect(editedContent.embeds[0].description).toContain('100%');

      // 2. Remove reaction 1️⃣ -> vote retracted
      const unreactHandled = await handler.handleReactionRemove(reactEvent);
      expect(unreactHandled).toBe(true);
      expect(db.getUserPollVote(pollId, 'u_react_voter')).toBeNull();
      expect(editedContent.embeds[0].description).toContain('0%');

      // 3. Close poll via ⏹️ reaction by owner (not author anymore)
      const endEvent: any = {
        guild_id: 'g1',
        channel_id: 'c1',
        message_id: 'poll_msg_2',
        user_id: 'u_owner_1',
        emoji: { name: '⏹️' },
        member: {
          user: { id: 'u_owner_1', username: 'Owner', discriminator: '0' },
          roles: [],
          joined_at: new Date().toISOString(),
        },
      };
      const endHandled = await handler.handleReactionAdd(endEvent);
      expect(endHandled).toBe(true);
      const poll = db.getPoll(pollId);
      expect(poll?.is_closed).toBe(1);
      expect(editedContent.embeds[0].footer.text).toContain('Anket kapandı');
    });
  });

  describe('Welcome Card Color (Must be Green: #10b981 and #34d399)', () => {
    it('defaults to #10b981 (primary green) and #34d399 (accent green)', async () => {
      const { getCardPalette } = await import('../src/services/WelcomeCardGenerator.js');
      const palette = getCardPalette({ username: 'TestUser' });
      expect(palette.primaryHex).toBe('#10b981');
      expect(palette.accentHex).toBe('#34d399');
    });

    it('ensures database default is #10b981 and #34d399', () => {
      const cfg = db.getGuildConfig('guild_new_test');
      expect(cfg.welcome_card_color).toBe('#10b981');
      expect(cfg.welcome_card_accent_color).toBe('#34d399');
    });
  });

  describe('Native Micup FeedPollView Poll Payload & Voting', () => {
    it('sends native Discord/Micup poll payload matching FeedPollView DOM requirements', async () => {
      const { CommandHandler } = await import('../src/commands/CommandHandler.js');
      let sentExtra: any = null;
      const mockApi: any = {
        sendMessage: async (_ch: string, _content: string, extra: any) => {
          sentExtra = extra;
          return { id: 'native_poll_msg_1' };
        },
        addReaction: async () => {},
      };

      const mockAntiSpam = { handleMessage: async () => false } as any;
      const mockAntiLink = { handleMessage: async () => false } as any;
      const mockModService = { isMuted: () => false } as any;

      const handler = new CommandHandler(
        mockApi,
        mockModService,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockAntiSpam,
        mockAntiLink,
        {} as any,
        {} as any,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        db,
      );
      const guild: FluxerGuild = {
        id: 'g1',
        name: 'Test Guild',
        owner_id: 'u_owner',
        members: [],
        roles: [],
        channels: [{ id: 'ch1', name: 'genel', type: 0 }],
      };
      const invoker: FluxerMember = {
        user: { id: 'u_invoker', username: 'PollCreator', discriminator: '0' },
        roles: [],
        joined_at: new Date().toISOString(),
      };
      const message: any = {
        id: 'm1',
        channel_id: 'ch1',
        author: invoker.user,
        content: '/poll Akşam ne oynayalım? "Valorant" "Minecraft" "LoL"',
      };

      await handler.handleMessage(guild, invoker, invoker, message);

      expect(sentExtra).toBeDefined();
      expect(sentExtra.embeds).toBeDefined();
      expect(sentExtra.embeds[0].title).toBe('Akşam ne oynayalım?');
      expect(sentExtra.embeds[0].description).toContain('Valorant');
      expect(sentExtra.embeds[0].description).toContain('Minecraft');
      expect(sentExtra.embeds[0].description).toContain('LoL');
    });

    it('handles native MESSAGE_POLL_VOTE_ADD and MESSAGE_POLL_VOTE_REMOVE correctly', async () => {
      const { CommandHandler } = await import('../src/commands/CommandHandler.js');
      const mockApi: any = {
        sendMessage: async () => ({ id: 'poll_msg_3' }),
      };
      const handler = new CommandHandler(
        mockApi,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        db,
      );

      const pollId = db.createPoll('g1', 'c1', 'poll_msg_3', 'u_author', 'Deneme?', ['Seçenek 1', 'Seçenek 2']);

      // Vote 1 (answer_id = 1 -> option 0)
      const addHandled = await handler.handlePollVoteAdd({
        guild_id: 'g1',
        channel_id: 'c1',
        message_id: 'poll_msg_3',
        user_id: 'u_voter',
        answer_id: 1,
      });
      expect(addHandled).toBe(true);
      expect(db.getUserPollVote(pollId, 'u_voter')).toBe(0);

      // Remove vote
      const removeHandled = await handler.handlePollVoteRemove({
        guild_id: 'g1',
        channel_id: 'c1',
        message_id: 'poll_msg_3',
        user_id: 'u_voter',
        answer_id: 1,
      });
      expect(removeHandled).toBe(true);
      expect(db.getUserPollVote(pollId, 'u_voter')).toBeNull();
    });
  });

  describe('Poll Duration, Auto-Expiration & Percentage Progress Bars', () => {
    it('renders progress bar with correct filled and empty blocks', async () => {
      const { renderProgressBar } = await import('../src/services/PollCardGenerator.js');
      expect(renderProgressBar(0, 10)).toBe('▱▱▱▱▱▱▱▱▱▱');
      expect(renderProgressBar(50, 10)).toBe('▰▰▰▰▰▱▱▱▱▱');
      expect(renderProgressBar(100, 10)).toBe('▰▰▰▰▰▰▰▰▰▰');
      expect(renderProgressBar(30, 10)).toBe('▰▰▰▱▱▱▱▱▱▱');
    });

    it('parses duration from start token, end token, or keyword in poll input', async () => {
      const { parsePollInput } = await import('../src/services/PollCardGenerator.js');
      
      const p1 = parsePollInput('10m Akşam ne oynayalım? "Valorant" "Minecraft"');
      expect(p1?.question).toBe('Akşam ne oynayalım?');
      expect(p1?.options).toEqual(['Valorant', 'Minecraft']);
      expect(p1?.durationSeconds).toBe(600);

      const p2 = parsePollInput('Akşam ne oynayalım? "Valorant" "Minecraft" 2h');
      expect(p2?.question).toBe('Akşam ne oynayalım?');
      expect(p2?.durationSeconds).toBe(7200);

      const p3 = parsePollInput('Film izleyelim mi? "Evet" "Hayır" süre:30dk');
      expect(p3?.question).toBe('Film izleyelim mi?');
      expect(p3?.durationSeconds).toBe(1800);

      const p4 = parsePollInput('Hızlı anket "Evet" "Hayır"');
      expect(p4?.durationSeconds).toBeNull();
    });

    it('PollService automatically concludes expired polls and announces winner', async () => {
      const { PollService } = await import('../src/services/PollService.js');
      let editedMsg: any = null;
      let sentAnnouncement = '';

      const mockApi: any = {
        editMessage: vi.fn(async (_ch: string, _msg: string, _c: string, extra: any) => {
          editedMsg = extra;
        }),
        sendMessage: vi.fn(async (_ch: string, content: string) => {
          sentAnnouncement = content;
          return { id: 'announce_1' };
        }),
      };

      const pollService = new PollService(mockApi, db);
      pollService.stop(); // Stop ticker loop for controlled testing

      const now = Math.floor(Date.now() / 1000);
      const pollId = db.createPoll(
        'guild_exp_1',
        'ch_exp_1',
        'msg_exp_1',
        'u_host_1',
        'Kahve mi Çay mı?',
        ['Kahve', 'Çay'],
        10,
        now - 5, // Expired 5 seconds ago
      );

      // Vote 1 for Kahve (index 0)
      db.votePoll(pollId, 'u_v1', 0);
      db.votePoll(pollId, 'u_v2', 0);
      // Vote 1 for Çay (index 1)
      db.votePoll(pollId, 'u_v3', 1);

      await pollService.checkExpiredPolls();

      // Verify closed in DB
      const updated = db.getPoll(pollId);
      expect(updated?.is_closed).toBe(1);

      // Verify original message edited with closed state and progress bar
      expect(editedMsg).toBeDefined();
      expect(editedMsg.embeds[0].footer.text).toBe('3 oy  •  Anket kapandı.');
      expect(editedMsg.embeds[0].description).toContain('▰');
      expect(editedMsg.embeds[0].description).toContain('67%');

      // Verify channel winner announcement
      expect(sentAnnouncement).toContain('Anket Sonuçlandı!');
      expect(sentAnnouncement).toContain('Kahve');
      expect(sentAnnouncement).toContain('2 oy');
    });

    it('allows manual termination of a poll via PollService.endPoll and command', async () => {
      const { PollService } = await import('../src/services/PollService.js');
      const mockApi: any = {
        editMessage: vi.fn(async () => {}),
        sendMessage: vi.fn(async () => ({ id: 'ann_2' })),
      };

      const pollService = new PollService(mockApi, db);
      pollService.stop();

      const pollId = db.createPoll(
        'guild_manual_1',
        'ch_manual_1',
        'msg_manual_1',
        'u_creator_1',
        'Hafta sonu ne yapalım?',
        ['Piknik', 'Sinema'],
        null,
        null, // No duration, runs until manual end
      );

      const guild: any = { id: 'guild_manual_1', owner_id: 'u_owner_1', roles: [] };
      const ownerMember: any = { user: { id: 'u_owner_1' }, roles: [] };

      const res = await pollService.endPoll(guild, ownerMember, String(pollId));
      expect(res.success).toBe(true);
      expect(res.message).toContain('başarıyla sonlandırıldı');

      const closed = db.getPoll(pollId);
      expect(closed?.is_closed).toBe(1);
    });
  });
});
