// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, it, expect, beforeEach, vi} from 'vitest';
import {DatabaseClient} from '../src/database/DatabaseClient.js';
import {OwoService} from '../src/services/OwoService.js';
import {CommandHandler} from '../src/commands/CommandHandler.js';
import {ModerationService} from '../src/services/ModerationService.js';
import {WarnService} from '../src/services/WarnService.js';
import {RoleService} from '../src/services/RoleService.js';
import {WelcomeGoodbyeService} from '../src/services/WelcomeGoodbyeService.js';
import {ModLogService} from '../src/services/ModLogService.js';
import {AntiSpamService} from '../src/services/AntiSpamService.js';
import {AntiLinkService} from '../src/services/AntiLinkService.js';
import {MusicService} from '../src/services/MusicService.js';
import type {FluxerGuild, FluxerMember, FluxerMessage} from '../src/types/fluxer.js';

describe('OwO Bot System Deep Verification', () => {
  let db: DatabaseClient;
  let owoService: OwoService;
  let commandHandler: CommandHandler;
  let sentMessages: Array<{ channelId: string; content: string }>;

  const mockApi: any = {
    sendMessage: vi.fn(async (channelId: string, content: string) => {
      sentMessages.push({ channelId, content });
      return { id: 'msg_' + Date.now(), channel_id: channelId, content };
    }),
    deleteMessage: vi.fn(async () => {}),
    getGuildRoles: vi.fn(async () => []),
    getGuildChannels: vi.fn(async () => []),
    getGuildMember: vi.fn(async () => null),
  };

  const memberA: FluxerMember = {
    user: { id: 'user_a', username: 'OyuncuA', discriminator: '0001' },
    roles: [],
    joined_at: new Date().toISOString(),
  };

  const memberB: FluxerMember = {
    user: { id: 'user_b', username: 'OyuncuB', discriminator: '0002' },
    roles: [],
    joined_at: new Date().toISOString(),
  };

  const botMember: FluxerMember = {
    user: { id: 'bot_id', username: 'MicupBOT', discriminator: '0000', bot: true },
    roles: [],
    joined_at: new Date().toISOString(),
  };

  const guild: FluxerGuild = {
    id: 'guild_test',
    name: 'OwO Test Sunucusu',
    owner_id: memberA.user.id,
    members: [memberA, memberB, botMember],
    roles: [],
    channels: [{ id: 'ch_test', name: 'genel-sohbet', type: 0 }],
  };

  beforeEach(() => {
    sentMessages = [];
    db = new DatabaseClient(':memory:');
    owoService = new OwoService(mockApi, db);

    const modService = new ModerationService(mockApi, db);
    const warnService = new WarnService(mockApi, db);
    const roleService = new RoleService(mockApi, db);
    const welcomeService = new WelcomeGoodbyeService(mockApi, db);
    const modLogService = new ModLogService(mockApi, db);
    const antiSpamService = new AntiSpamService(mockApi, db, modService, modLogService);
    const antiLinkService = new AntiLinkService(mockApi, db);
    const musicService = new MusicService(mockApi);

    commandHandler = new CommandHandler(
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
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      db,
    );
  });

  const sendMsg = async (content: string, sender: FluxerMember = memberA) => {
    const msg: FluxerMessage = {
      id: 'msg_' + Math.random(),
      channel_id: 'ch_test',
      guild_id: guild.id,
      author: sender.user,
      content,
      timestamp: new Date().toISOString(),
    };
    await commandHandler.handleMessage(guild, sender, botMember, msg);
  };

  it('does not trigger on plain "owo" or "uwu" in chat, but replies to "/owo" and "/uwu" with cute expressions', async () => {
    // Plain text in chat without prefix does NOT trigger bot
    await sendMsg('owo');
    expect(sentMessages.length).toBe(0);
    await sendMsg('uwu');
    expect(sentMessages.length).toBe(0);

    // /owo and /uwu commands trigger cute expressions
    await sendMsg('/owo');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toMatch(/(・`ω・|｡•́‿•̀｡|⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄|ﾉ◕ヮ◕|uwu|owo|rawr|kucaklaşma)/i);

    await sendMsg('/uwu');
    expect(sentMessages.length).toBe(2);

    // /owo and /uwu with subcommands work as OwO commands
    await sendMsg('/owo cash');
    expect(sentMessages.length).toBe(3);
    expect(sentMessages[2].content).toContain('Cowoncy');
  });

  it('handles "/w cash" (balance starts at 500 Cowoncy)', async () => {
    await sendMsg('/w cash');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('500');
    expect(sentMessages[0].content).toContain('Cowoncy');
  });

  it('handles "/w daily" with 24-hour cooldown and streak bonus', async () => {
    await sendMsg('/w daily');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('günlük ödülünü aldın');
    expect(sentMessages[0].content).toContain('500');

    const user = db.getOwoUser(memberA.user.id);
    expect(user.cowoncy).toBe(1000); // 500 + 500
    expect(user.daily_streak).toBe(1);

    // Immediate second claim triggers cooldown
    await sendMsg('/w daily');
    expect(sentMessages[sentMessages.length - 1].content).toContain('beklemelisin');
  });

  it('handles "/w hunt" and stores zoo animals, enforces 15s cooldown', async () => {
    await sendMsg('/w hunt');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('avlandın');
    expect(sentMessages[0].content).toContain('XP');

    const zoo = db.getOwoZoo(memberA.user.id);
    expect(zoo.length).toBeGreaterThanOrEqual(1);

    // Immediate second hunt triggers cooldown
    await sendMsg('/w hunt');
    expect(sentMessages[sentMessages.length - 1].content).toContain('soluklan');

    // Check "/w zoo"
    await sendMsg('/w zoo');
    const zooMsg = sentMessages[sentMessages.length - 1].content;
    expect(zooMsg).toContain('Hayvanat Bahçesi');
    expect(zooMsg).toContain('Toplam');
  });

  it('handles "/w cf <amount> [y/t]" coinflip game', async () => {
    await sendMsg('/w cf 100 y');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toMatch(/(Kazandın|Kaybettin)/);

    const user = db.getOwoUser(memberA.user.id);
    expect(user.cowoncy === 400 || user.cowoncy === 600).toBe(true);

    // Insufficient funds error check
    await sendMsg('/w cf 9999999 y');
    expect(sentMessages[sentMessages.length - 1].content).toContain('Yetersiz bakiye');
  });

  it('handles "/w slots <amount>" spinning wheels', async () => {
    await sendMsg('/w slots 50');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('kumar makinesini çevirdi');
    expect(sentMessages[0].content).toContain('╭───────────────╮');
  });

  it('handles "/w bj <amount>" blackjack initial deal and hit/stand', async () => {
    await sendMsg('/w bj 100');
    expect(sentMessages.length).toBe(1);
    const firstMsg = sentMessages[0].content;
    expect(firstMsg).toContain('BLACKJACK');

    // If not natural blackjack, test hit or stand
    if (firstMsg.includes('Devam etmek için')) {
      await sendMsg('stand');
      expect(sentMessages.length).toBe(2);
      expect(sentMessages[1].content).toContain('BLACKJACK SONUCU');
    }
  });

  it('handles "/w battle" fighting monsters', async () => {
    await sendMsg('/w battle');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toMatch(/(karşılaştı ve zafer kazandı|ağır darbe aldı)/);

    // Cooldown check
    await sendMsg('/w battle');
    expect(sentMessages[sentMessages.length - 1].content).toContain('savaş yaralarını sarıyorsun');
  });

  it('handles "/w pray" and "/w curse" with blessings and cooldown', async () => {
    await sendMsg('/w pray');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('dua etti');

    const user = db.getOwoUser(memberA.user.id);
    expect(user.pray_count).toBe(1);

    // Cooldown
    await sendMsg('/w pray');
    expect(sentMessages[sentMessages.length - 1].content).toContain('dua ettin');
  });

  it('handles "/w give cash @User <amount>" safely transferring cowoncy with flexible syntax', async () => {
    // 1. Standard /w give cash @User <amount>
    await sendMsg('/w give cash @OyuncuB 200');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toContain('**200** 🪙 Cowoncy gönderdi');

    let userA = db.getOwoUser(memberA.user.id);
    let userB = db.getOwoUser(memberB.user.id);
    expect(userA.cowoncy).toBe(300); // 500 - 200
    expect(userB.cowoncy).toBe(700); // 500 + 200

    // 2. /w give @User <amount> without "cash"
    await sendMsg('/w give @OyuncuB 50');
    expect(sentMessages[sentMessages.length - 1].content).toContain('**50** 🪙 Cowoncy gönderdi');
    userA = db.getOwoUser(memberA.user.id);
    userB = db.getOwoUser(memberB.user.id);
    expect(userA.cowoncy).toBe(250); // 300 - 50
    expect(userB.cowoncy).toBe(750); // 700 + 50

    // 3. /w give cash <amount> @User (swapped order)
    await sendMsg('/w give cash 50 @OyuncuB');
    expect(sentMessages[sentMessages.length - 1].content).toContain('**50** 🪙 Cowoncy gönderdi');
    userA = db.getOwoUser(memberA.user.id);
    expect(userA.cowoncy).toBe(200);

    // 4. Resolving an uncached member using message.mentions or API
    const uncachedMember: FluxerMember = {
      user: { id: 'uncached_batunex', username: 'BatuneX', discriminator: '1234' },
      roles: [],
      joined_at: new Date().toISOString(),
    };
    mockApi.getGuildMember.mockResolvedValueOnce(uncachedMember);

    const msgWithMention: FluxerMessage = {
      id: 'msg_mention_test',
      channel_id: 'ch_test',
      guild_id: guild.id,
      author: memberA.user,
      content: '/w give cash @BatuneX 100',
      mentions: [uncachedMember.user],
      timestamp: new Date().toISOString(),
    };
    await commandHandler.handleMessage(guild, memberA, botMember, msgWithMention);
    expect(sentMessages[sentMessages.length - 1].content).toContain('BatuneX');
    expect(sentMessages[sentMessages.length - 1].content).toContain('**100** 🪙 Cowoncy gönderdi');

    const userBatunex = db.getOwoUser(uncachedMember.user.id);
    expect(userBatunex.cowoncy).toBe(600); // Initial 500 + 100
  });

  it('handles "/w shop", "/w buy lootbox", "/w inv", and "/w open lootbox"', async () => {
    // 1. Shop
    await sendMsg('/w shop');
    expect(sentMessages[sentMessages.length - 1].content).toContain('OWO MAĞAZASI');

    // 2. Buy lootbox (cost: 500)
    await sendMsg('/w buy lootbox 1');
    expect(sentMessages[sentMessages.length - 1].content).toContain('Lootbox satın aldı');

    let user = db.getOwoUser(memberA.user.id);
    expect(user.cowoncy).toBe(0);
    expect(user.lootboxes).toBe(1);

    // 3. Inv
    await sendMsg('/w inv');
    expect(sentMessages[sentMessages.length - 1].content).toContain('Lootbox: **1** adet');

    // 4. Open lootbox
    await sendMsg('/w open lootbox');
    expect(sentMessages[sentMessages.length - 1].content).toContain('bir Lootbox açtı');

    user = db.getOwoUser(memberA.user.id);
    expect(user.lootboxes).toBe(0);
    expect(user.cowoncy).toBeGreaterThanOrEqual(300);
  });

  it('handles multi-opening lootbox and crate (/w open lootbox <sayı>, /w open lootbox all, /w open crate <sayı>)', async () => {
    // Give user 5 lootboxes and 3 crates
    db.updateOwoUser(memberA.user.id, {
      lootboxes: 5,
      crates: 3,
      cowoncy: 1000,
    });

    const initialZooCount = db.getOwoZoo(memberA.user.id).length;

    // 1. Open 3 lootboxes
    await sendMsg('/w open lootbox 3');
    const msg1 = sentMessages[sentMessages.length - 1].content;
    expect(msg1).toContain('**3** adet Lootbox açtı!');
    expect(msg1).toContain('Kazanılan Cowoncy:');
    expect(msg1).toContain('Kazanılan Hayvanlar (3 adet):');
    expect(msg1).toContain('Kalan Lootbox: **2** adet');

    let user = db.getOwoUser(memberA.user.id);
    expect(user.lootboxes).toBe(2);
    const totalAnimalsAfter1 = db.getOwoZoo(memberA.user.id).reduce((sum, a) => sum + a.count, 0);
    expect(totalAnimalsAfter1).toBe(initialZooCount + 3);

    // 2. Open remaining lootboxes with "all"
    await sendMsg('/w open lootbox all');
    const msg2 = sentMessages[sentMessages.length - 1].content;
    expect(msg2).toContain('**2** adet Lootbox açtı!');
    expect(msg2).toContain('Kalan Lootbox: **0** adet');

    user = db.getOwoUser(memberA.user.id);
    expect(user.lootboxes).toBe(0);
    const totalAnimalsAfter2 = db.getOwoZoo(memberA.user.id).reduce((sum, a) => sum + a.count, 0);
    expect(totalAnimalsAfter2).toBe(initialZooCount + 5);

    // 3. Open 2 crates
    await sendMsg('/w open crate 2');
    const msg3 = sentMessages[sentMessages.length - 1].content;
    expect(msg3).toContain('**2** adet Silah Sandığı açtı!');
    expect(msg3).toContain('En Yüksek Seviyeli Silah:');
    expect(msg3).toContain('Kalan Sandık: **1** adet');

    user = db.getOwoUser(memberA.user.id);
    expect(user.crates).toBe(1);
    expect(user.weapon).not.toBe('punch');
  });

  it('handles leveling up: awards scaled cowoncy, lootboxes, crates, and generates visual level-up card', async () => {
    // Set user A to 90 XP (needs 100 for level 2)
    db.updateOwoUser(memberA.user.id, {
      xp: 90,
      level: 1,
      cowoncy: 1000,
      lootboxes: 0,
      crates: 0,
      max_hp: 100,
      strength: 10,
    });

    // Avlanma triggers +10 to +25 XP -> total XP >= 100 -> LEVEL UP to Level 2!
    await sendMsg('/w hunt');

    // Should have 2 messages: 1 for hunt outcome, 1 for level-up announcement
    expect(sentMessages.length).toBe(2);
    expect(sentMessages[0].content).toContain('avlandın');
    expect(sentMessages[1].content).toContain('leveled up!');

    const user = db.getOwoUser(memberA.user.id);
    expect(user.level).toBe(2);
    // XP resets: 90 + (10 to 25) = 100 to 115. After consuming 100 XP, leftover is 0 to 15!
    expect(user.xp).toBeGreaterThanOrEqual(0);
    expect(user.xp).toBeLessThanOrEqual(15);
    // Level 2 rewards: +250 Cowoncy, +1 Lootbox, +1 Crate, +15 Max HP, +3 Strength
    expect(user.lootboxes).toBe(1);
    expect(user.crates).toBe(1);
    expect(user.max_hp).toBe(115);
    expect(user.strength).toBe(13);
    // Cowoncy = initial (1000) + hunt gain (15-45) + level up bonus (250)
    expect(user.cowoncy).toBeGreaterThanOrEqual(1265);
    expect(user.cowoncy).toBeLessThanOrEqual(1300);

    // Profile check: now shows / 200 for level 2
    await sendMsg('/w profile');
    expect(sentMessages[sentMessages.length - 1].content).toContain(`/ 200`);
  });

  it('handles "/w sell all" selling caught animals for cowoncy', async () => {
    // Add mock animals directly to zoo
    db.addOwoAnimals(memberA.user.id, [
      { id: 'dog', name: 'Köpek', emoji: '🐶', tier: 'common' },
      { id: 'cat', name: 'Kedi', emoji: '🐱', tier: 'common' },
    ]);

    const initialCash = db.getOwoUser(memberA.user.id).cowoncy;

    await sendMsg('/w sell all');
    expect(sentMessages[sentMessages.length - 1].content).toContain('adet hayvan satıldı');

    const finalCash = db.getOwoUser(memberA.user.id).cowoncy;
    expect(finalCash).toBeGreaterThan(initialCash);
  });

  it('handles "/w top", "/w profile", social emotes, and /w help', async () => {
    // 1. Top
    await sendMsg('/w top');
    expect(sentMessages[sentMessages.length - 1].content).toContain('EN ZENGİN OWO OYUNCULARI');

    // 2. Profile
    await sendMsg('/w profile');
    expect(sentMessages[sentMessages.length - 1].content).toContain('OwO Profili');
    expect(sentMessages[sentMessages.length - 1].content).toContain('Seviye');

    // 3. Cookie
    await sendMsg('/w cookie @OyuncuB');
    expect(sentMessages[sentMessages.length - 1].content).toContain('kurabiye ikram etti');

    // 4. Hug
    await sendMsg('/w hug @OyuncuB');
    expect(sentMessages[sentMessages.length - 1].content).toContain('sımsıkı sarıldı');

    // 5. /w help
    await sendMsg('/w help');
    expect(sentMessages[sentMessages.length - 1].content).toContain('OWO BOT REHBERİ');
  });

  it('strictly enforces Blackjack escrow, blocking multi-game exploit and deducting bet upfront', async () => {
    // User starts with 500 cowoncy
    await sendMsg('/w bj 200');
    const firstMsg = sentMessages[sentMessages.length - 1].content;

    // Check balance: bet must have been deducted immediately!
    const userAfterDeal = db.getOwoUser(memberA.user.id);
    if (firstMsg.includes('Devam etmek için')) {
      // Game is in play: 500 - 200 = 300
      expect(userAfterDeal.cowoncy).toBe(300);

      // Attempting another blackjack while active must be BLOCKED
      await sendMsg('/w bj 100');
      expect(sentMessages[sentMessages.length - 1].content).toContain('zaten devam eden bir Blackjack oyunun var');

      // Finish game
      await sendMsg('stand');
      expect(sentMessages[sentMessages.length - 1].content).toContain('BLACKJACK SONUCU');
    } else {
      // Natural 21 Blackjack was dealt immediately
      expect(firstMsg).toContain('DOĞAL BLACKJACK');
    }
  });

  it('triggers gambling cooldown warning when bets are spammed within cooldown window', async () => {
    // 1. First bet succeeds
    await sendMsg('/w cf 50 y');
    expect(sentMessages.length).toBe(1);

    // 2. Second bet immediately after triggers cooldown
    await sendMsg('/w cf 50 y');
    expect(sentMessages[sentMessages.length - 1].content).toContain('çok hızlı kumar oynuyorsun');
  });

  it('manages daily quests: displays quests, tracks progress, and claims rewards', async () => {
    // 1. /w quest displays 3 quests for today
    await sendMsg('/w quest');
    const questMsg = sentMessages[sentMessages.length - 1].content;
    expect(questMsg).toContain('Günlük Görevleri');
    expect(questMsg).toContain('İlerleme: [');

    const today = new Date().toISOString().slice(0, 10);
    const quests = db.getOrCreateDailyQuests(memberA.user.id, today);
    expect(quests.length).toBe(3);

    // 2. Progress a quest directly in database or via actions
    db.incrementQuestProgress(memberA.user.id, today, quests[0].quest_type, quests[0].target_count);
    const updatedQuests = db.getOrCreateDailyQuests(memberA.user.id, today);
    expect(updatedQuests[0].current_count).toBe(updatedQuests[0].target_count);

    // 3. /w quest claim collects rewards
    const initialCowoncy = db.getOwoUser(memberA.user.id).cowoncy;
    await sendMsg('/w quest claim');
    const claimMsg = sentMessages.find((m) => m.content.includes('ödüllerini topladın'));
    expect(claimMsg).toBeDefined();

    const finalCowoncy = db.getOwoUser(memberA.user.id).cowoncy;
    expect(finalCowoncy).toBeGreaterThan(initialCowoncy);

    // 4. Claiming again when nothing is ready informs user
    await sendMsg('/w quest claim');
    expect(sentMessages[sentMessages.length - 1].content).toContain('tamamlanmış bir görev bulunmuyor');
  });

  it('manages zoo arena teams and simulates 3-round zoo battles with bets', async () => {
    // Give both players animals
    const animalDog = { id: 'dog', name: 'Köpek', emoji: '🐶', tier: 'common' as const, sellPrice: 15 };
    const animalTiger = { id: 'tiger', name: 'Kaplan', emoji: '🐯', tier: 'uncommon' as const, sellPrice: 40 };
    const animalDragon = { id: 'dragon', name: 'Ejderha', emoji: '🐉', tier: 'mythical' as const, sellPrice: 1500 };
    const animalLion = { id: 'lion', name: 'Aslan', emoji: '🦁', tier: 'uncommon' as const, sellPrice: 40 };

    db.addOwoAnimals(memberA.user.id, [animalDog, animalTiger, animalDragon]);
    db.addOwoAnimals(memberB.user.id, [animalDog, animalLion, animalTiger]);

    // 1. /w team displays team
    await sendMsg('/w team');
    expect(sentMessages[sentMessages.length - 1].content).toContain('Arena Takımı');
    expect(sentMessages[sentMessages.length - 1].content).toContain('Toplam Takım Gücü');

    // 2. /w team set configures custom slots
    await sendMsg('/w team set dragon tiger dog');
    expect(sentMessages[sentMessages.length - 1].content).toContain('Arena Takımın başarıyla güncellendi');

    const savedTeam = db.getOwoTeam(memberA.user.id);
    expect(savedTeam?.slot1).toBe('dragon');
    expect(savedTeam?.slot2).toBe('tiger');
    expect(savedTeam?.slot3).toBe('dog');

    // 3. /w zoobattle with wager
    db.updateOwoUser(memberA.user.id, { cowoncy: 1000 });
    db.updateOwoUser(memberB.user.id, { cowoncy: 1000 });

    await sendMsg('/w zb @OyuncuB 200');
    const battleMsg = sentMessages[sentMessages.length - 1].content;
    expect(battleMsg).toContain('ZOO ARENA KARŞILAŞMASI');
    expect(battleMsg).toContain('Raund 1:');
    expect(battleMsg).toContain('Raund 2:');
    expect(battleMsg).toContain('Raund 3:');
    expect(battleMsg).toContain('ARENA ŞAMPİYONU:');
    expect(battleMsg).toContain('200');
  });

  it('handles forge weapon upgrading: requires equipped weapon, animal sacrifice, and adds +5 strength', async () => {
    // 1. Punch cannot be forged
    db.updateOwoUser(memberA.user.id, { weapon: 'punch', cowoncy: 10000 });
    await sendMsg('/w forge');
    expect(sentMessages[sentMessages.length - 1].content).toContain('Yumruk geliştirilemez');

    // 2. Equip weapon and add animal to zoo
    db.updateOwoUser(memberA.user.id, { weapon: 'dagger', weapon_level: 0, strength: 20 });
    const animalDog = { id: 'dog', name: 'Köpek', emoji: '🐶', tier: 'common' as const, sellPrice: 15 };
    db.addOwoAnimals(memberA.user.id, [animalDog]);

    // Force Math.random to 0 for guaranteed success
    const origRandom = Math.random;
    Math.random = () => 0.01;

    try {
      await sendMsg('/w forge');
      const forgeMsg = sentMessages[sentMessages.length - 1].content;
      expect(forgeMsg).toContain('TEBRİKLER');
      expect(forgeMsg).toContain('(+1)');
      expect(forgeMsg).toContain('+5 Kalıcı Güç');

      const userAfter = db.getOwoUser(memberA.user.id);
      expect(userAfter.weapon_level).toBe(1);
      expect(userAfter.strength).toBe(25);

      // Animal was sacrificed from zoo
      const zoo = db.getOwoZoo(memberA.user.id);
      expect(zoo.find((z) => z.animal_id === 'dog')).toBeUndefined();
    } finally {
      Math.random = origRandom;
    }
  });

  it('manages marriage proposal, acceptance, hunt bonuses, and divorce', async () => {
    // 1. Proposing without ring fails
    db.updateOwoUser(memberA.user.id, { ring: null });
    await sendMsg('/w marry @OyuncuB');
    expect(sentMessages[sentMessages.length - 1].content).toContain('Şans Yüzüğü');

    // 2. Buy lucky ring and propose
    db.updateOwoUser(memberA.user.id, { ring: 'lucky_ring' });
    await sendMsg('/w marry @OyuncuB');
    expect(sentMessages[sentMessages.length - 1].content).toContain('evlilik teklif etti');

    // 3. Target accepts via "evet"
    await sendMsg('evet', memberB);
    const marriedMsg = sentMessages[sentMessages.length - 1].content;
    expect(marriedMsg).toContain('artık resmen EVLENDİLER');

    const userA = db.getOwoUser(memberA.user.id);
    const userB = db.getOwoUser(memberB.user.id);
    expect(userA.married_to).toBe(memberB.user.id);
    expect(userB.married_to).toBe(memberA.user.id);

    // 4. Hunt includes marriage bonus
    db.updateOwoUser(memberA.user.id, { last_hunt_unix: 0 });
    await sendMsg('/w hunt');
    expect(sentMessages[sentMessages.length - 1].content).toContain('Evlilik');

    // 5. Divorce dissolves marriage
    await sendMsg('/w divorce');
    expect(sentMessages[sentMessages.length - 1].content).toContain('sona erdi. Artık bekarsın');

    const userAAfter = db.getOwoUser(memberA.user.id);
    const userBAfter = db.getOwoUser(memberB.user.id);
    expect(userAAfter.married_to).toBeNull();
    expect(userBAfter.married_to).toBeNull();
  });

  it('configures and resets owo channel via /w kanal, /owo kanal, and /uwu kanal', async () => {
    if (!guild.channels?.some((c) => c.id === 'ch_owo')) {
      guild.channels?.push({ id: 'ch_owo', name: 'owo-oyun', type: 0 });
    }

    // 1. Set channel using /w kanal
    await sendMsg('/w kanal #owo-oyun');
    expect(sentMessages[sentMessages.length - 1].content).toContain('OwO Kanalı Ayarlandı');
    expect(db.getGuildConfig(guild.id)?.owo_channel_id).toBe('ch_owo');

    // 2. Reset channel using /w kanal sil
    await sendMsg('/w kanal sil');
    expect(sentMessages[sentMessages.length - 1].content).toContain('kısıtlaması kaldırıldı');
    expect(db.getGuildConfig(guild.id)?.owo_channel_id).toBeNull();

    // 3. Set channel using /owo kanal
    await sendMsg('/owo kanal #owo-oyun');
    expect(sentMessages[sentMessages.length - 1].content).toContain('OwO Kanalı Ayarlandı');
    expect(db.getGuildConfig(guild.id)?.owo_channel_id).toBe('ch_owo');

    // 4. Reset channel using /uwu kanal sil
    await sendMsg('/uwu kanal sil');
    expect(sentMessages[sentMessages.length - 1].content).toContain('kısıtlaması kaldırıldı');
    expect(db.getGuildConfig(guild.id)?.owo_channel_id).toBeNull();

    // 5. Non-privileged user cannot configure channel
    await sendMsg('/w kanal #owo-oyun', memberB);
    expect(sentMessages[sentMessages.length - 1].content).toContain('Sunucuyu Yönet');
  });

  it('correctly resolves GIF animated avatars and banners with .gif extension', async () => {
    const gifUser = {
      id: 'user_gif_123',
      username: 'GifMaster',
      discriminator: '9999',
      avatar: 'a_0123456789abcdef',
      banner: 'a_banner_123456',
    };

    const avatarUrl = await owoService.resolveAvatarUrl(gifUser, undefined, guild.id);
    expect(avatarUrl).toBe('https://micup.gg/media/avatars/user_gif_123/a_0123456789abcdef.gif');

    const bannerUrl = await owoService.resolveBannerUrl(gifUser, undefined, guild.id);
    expect(bannerUrl).toBe('https://micup.gg/media/banners/user_gif_123/a_banner_123456.gif');

    // Static avatar should remain .png
    const staticUser = {
      id: 'user_static_456',
      username: 'StaticGuy',
      discriminator: '8888',
      avatar: 'normal_avatar_hash',
    };
    const staticAvatarUrl = await owoService.resolveAvatarUrl(staticUser, undefined, guild.id);
    expect(staticAvatarUrl).toBe('https://micup.gg/media/avatars/user_static_456/normal_avatar_hash.png');
  });

  it('schedules auto-deletion for cooldown warning and triggering user command', async () => {
    vi.useFakeTimers();

    // Trigger hunt to start cooldown
    db.updateOwoUser(memberA.user.id, { last_hunt_unix: 0 });
    await sendMsg('/w hunt');

    // Second hunt within 15 seconds triggers cooldown warning
    await sendMsg('/w hunt');
    expect(sentMessages[sentMessages.length - 1].content).toContain('biraz soluklan');

    // Fast-forward timers by 5.5 seconds
    vi.advanceTimersByTime(5500);

    // Both the bot's warning and the user's trigger command should be deleted
    expect(mockApi.deleteMessage).toHaveBeenCalled();

    vi.useRealTimers();
  });
});

