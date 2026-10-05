// SPDX-License-Identifier: AGPL-3.0-or-later

import {config, maskToken} from './config/env.js';
import {DatabaseClient} from './database/DatabaseClient.js';
import {MicupApiClient} from './api/MicupApiClient.js';
import {GatewayClient} from './gateway/GatewayClient.js';
import {ModerationService} from './services/ModerationService.js';
import {WarnService} from './services/WarnService.js';
import {RoleService} from './services/RoleService.js';
import {WelcomeGoodbyeService} from './services/WelcomeGoodbyeService.js';
import {ModLogService} from './services/ModLogService.js';
import {AntiSpamService} from './services/AntiSpamService.js';
import {AntiLinkService} from './services/AntiLinkService.js';
import {BadWordsService} from './services/BadWordsService.js';
import {LevelingService} from './services/LevelingService.js';
import {OwoService} from './services/OwoService.js';
import {MusicService} from './services/MusicService.js';
import {AntiRaidService} from './services/AntiRaidService.js';
import {CommunityService} from './services/CommunityService.js';
import {GiveawayService} from './services/GiveawayService.js';
import {MicupVoiceClient} from './voice/MicupVoiceClient.js';
import {getFfmpegBinary, getYtDlpInstance} from './utils/mediaBinaries.js';
import {CommandHandler} from './commands/CommandHandler.js';
import {BirthdayService} from './services/BirthdayService.js';
import {PollService} from './services/PollService.js';
import type {
  FluxerGuild,
  FluxerInteraction,
  FluxerMember,
  FluxerMessage,
  FluxerPollVoteEvent,
  FluxerReactionEvent,
  FluxerUser,
  Snowflake,
} from './types/fluxer.js';

// Global Process Crash Guards: Prevent Node.js process from unexpectedly crashing
process.on('unhandledRejection', (reason) => {
  console.error('[Bot] ⚠️ Yakalanmamış Promise Hatası (Unhandled Rejection):', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Bot] 🚨 Kritik Beklenmeyen Hata (Uncaught Exception):', err);
});

async function main(): Promise<void> {
  console.log('========================================================');
  console.log('🤖 KORTEX BOT YÖNETİM & MODERASYON BOTU BAŞLATILIYOR');
  console.log('========================================================');

  if (!config.botToken) {
    console.error('❌ HATA: BOT_TOKEN tanımlanmamış!');
    console.error('Lütfen .env dosyasını açıp BOT_TOKEN değerini girin.');
    console.error('Örnek: BOT_TOKEN=1553891682385133568.your_secret_key');
    process.exit(1);
  }

  console.log(`[Config] Token: ${maskToken(config.botToken)}`);
  console.log(`[Config] API URL: ${config.apiBaseUrl}`);
  console.log(`[Config] Dil: ${config.defaultLanguage}`);

  // 1. Initialize SQLite Database
  const db = new DatabaseClient();
  console.log(`[Database] SQLite veritabanı bağlandı: ${config.databasePath}`);

  // Schedule automatic database backups (immediate on startup, and every 12 hours)
  db.backupDatabase();
  setInterval(() => {
    console.log('[Backup] Periyodik veritabanı yedeklemesi yapılıyor...');
    db.backupDatabase();
  }, 12 * 60 * 60 * 1000);

  // 2. Initialize REST API Client
  const api = new MicupApiClient();

  // 3. Initialize Domain Services
  const modService = new ModerationService(api, db);
  const warnService = new WarnService(api, db);
  const roleService = new RoleService(api, db);
  const welcomeService = new WelcomeGoodbyeService(api, db);
  const modLogService = new ModLogService(api, db);
  const antiSpamService = new AntiSpamService(api, db, modService, modLogService);
  const antiLinkService = new AntiLinkService(api, db);
  const badWordsService = new BadWordsService(api, db, modLogService);
  const levelingService = new LevelingService(api, db);
  const antiRaidService = new AntiRaidService(api, db, modLogService);
  const communityService = new CommunityService(api, db, modLogService);
  const giveawayService = new GiveawayService(api, db);
  const owoService = new OwoService(api, db);
  const voiceClient = new MicupVoiceClient();
  const musicService = new MusicService(api);
  musicService.setVoiceClient(voiceClient);

  // Pre-flight check for media binaries (FFmpeg & yt-dlp)
  try {
    const activeFfmpeg = getFfmpegBinary();
    getYtDlpInstance();
    console.log(`[Media] 🎵 Müzik motoru hazırlandı (FFmpeg: ${activeFfmpeg})`);
  } catch (err: any) {
    console.warn(`[Media] ⚠️ Müzik motoru başlatma uyarısı: ${err.message}`);
  }
  const birthdayService = new BirthdayService(api, db);
  const pollService = new PollService(api, db);
  const commandHandler = new CommandHandler(
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
    badWordsService,
    levelingService,
    antiRaidService,
    communityService,
    giveawayService,
    db,
    birthdayService,
    pollService,
  );

  // In-memory Guild and Member Cache
  const guildCache = new Map<Snowflake, FluxerGuild>();

  // 4. Discover Gateway URL
  let gatewayUrl = config.gatewayUrl;
  if (!gatewayUrl) {
    try {
      console.log('[Setup] Gateway bilgisi API üzerinden alınıyor (GET /gateway/bot)...');
      const gatewayInfo = await api.getGatewayBot();
      gatewayUrl = gatewayInfo.url;
      console.log(`[Setup] Otomatik keşfedilen Gateway URL: ${gatewayUrl}`);
    } catch (err: any) {
      console.warn(`[Setup] Gateway otomatik keşif başarısız (${err.message}). Varsayılan deneniyor.`);
      gatewayUrl = 'ws://127.0.0.1:4000';
    }
  }

  // 5. Connect Gateway Client
  const gateway = new GatewayClient(gatewayUrl);
  musicService.setGateway(gateway);

  gateway.onDispatch(async (event: string, data: any) => {
    switch (event) {
      case 'READY': {
        console.log(`[Bot] ${data.user?.username} başarıyla hazır! Dinlenen sunucu sayısı: ${data.guilds?.length || 0}`);
        break;
      }

      case 'GUILD_CREATE': {
        const raw = data as any;
        const guild: FluxerGuild = {
          id: raw.id,
          name: raw.name || raw.properties?.name || `Sunucu #${raw.id}`,
          owner_id: raw.owner_id || raw.properties?.owner_id || '',
          system_channel_id: raw.system_channel_id || raw.properties?.system_channel_id || null,
          rules_channel_id: raw.rules_channel_id || raw.properties?.rules_channel_id || null,
          members: Array.isArray(raw.members) ? raw.members : [],
          roles: Array.isArray(raw.roles) ? raw.roles : [],
          channels: Array.isArray(raw.channels) ? raw.channels : [],
          member_count: raw.member_count ?? raw.online_count ?? (Array.isArray(raw.members) ? raw.members.length : 1),
          unavailable: raw.unavailable,
        };

        guildCache.set(guild.id, guild);
        console.log(`[Gateway] Sunucu önbelleklendi: ${guild.name} (ID: ${guild.id}, Kanallar: ${guild.channels.length}, Roller: ${guild.roles.length})`);

        // Eagerly populate channels and roles if not supplied in ready payload
        if (guild.channels.length === 0) {
          api.getGuildChannels(guild.id).then((channels) => {
            guild.channels = channels;
            console.log(`[Gateway] ${guild.name} için ${channels.length} kanal API'den önbelleğe alındı.`);
          }).catch((err) => console.warn(`[Gateway] Kanallar çekilemedi:`, err.message));
        }
        if (guild.roles.length === 0) {
          api.getGuildRoles(guild.id).then((roles) => {
            guild.roles = roles;
            console.log(`[Gateway] ${guild.name} için ${roles.length} rol API'den önbelleğe alındı.`);
          }).catch((err) => console.warn(`[Gateway] Roller çekilemedi:`, err.message));
        }

        // Cache active voice states if present in payload
        if (Array.isArray(raw.voice_states)) {
          for (const vs of raw.voice_states) {
            if (vs.user_id) {
              musicService.updateVoiceState(guild.id, vs.user_id, vs.channel_id || null);
            }
          }
        }
        break;
      }

      case 'GUILD_UPDATE': {
        const updated = data as any;
        const guild = guildCache.get(updated.id);
        if (guild) {
          if (updated.name) guild.name = updated.name;
          if (updated.owner_id) guild.owner_id = updated.owner_id;
        }
        break;
      }

      case 'CHANNEL_CREATE': {
        const channel = data as any;
        const guildId = channel.guild_id;
        if (guildId) {
          const guild = guildCache.get(guildId);
          if (guild) {
            if (!guild.channels) guild.channels = [];
            const idx = guild.channels.findIndex((c) => c.id === channel.id);
            if (idx !== -1) {
              guild.channels[idx] = channel;
            } else {
              guild.channels.push(channel);
            }
            console.log(`[Gateway] Yeni kanal önbelleklendi: #${channel.name} (${channel.id})`);
          }
        }
        break;
      }

      case 'CHANNEL_UPDATE': {
        const channel = data as any;
        const guildId = channel.guild_id;
        if (guildId) {
          const guild = guildCache.get(guildId);
          if (guild && guild.channels) {
            const idx = guild.channels.findIndex((c) => c.id === channel.id);
            if (idx !== -1) {
              guild.channels[idx] = {...guild.channels[idx], ...channel};
            } else {
              guild.channels.push(channel);
            }
          }
        }
        break;
      }

      case 'CHANNEL_UPDATE_BULK': {
        const payload = data as {guild_id?: Snowflake; channels?: any[]};
        if (payload.guild_id && Array.isArray(payload.channels)) {
          const guild = guildCache.get(payload.guild_id);
          if (guild && guild.channels) {
            for (const ch of payload.channels) {
              const idx = guild.channels.findIndex((c) => c.id === ch.id);
              if (idx !== -1) {
                guild.channels[idx] = {...guild.channels[idx], ...ch};
              } else {
                guild.channels.push(ch);
              }
            }
          }
        }
        break;
      }

      case 'CHANNEL_DELETE': {
        const channel = data as any;
        const guildId = channel.guild_id;
        if (guildId) {
          const guild = guildCache.get(guildId);
          if (guild && guild.channels) {
            guild.channels = guild.channels.filter((c) => c.id !== channel.id);
            console.log(`[Gateway] Kanal silindi: #${channel.name} (${channel.id})`);
          }
        }
        break;
      }

      case 'GUILD_ROLE_CREATE': {
        const guildId = data.guild_id as Snowflake;
        const role = data.role as any;
        const guild = guildCache.get(guildId);
        if (guild) {
          if (!guild.roles) guild.roles = [];
          const idx = guild.roles.findIndex((r) => r.id === role.id);
          if (idx !== -1) {
            guild.roles[idx] = role;
          } else {
            guild.roles.push(role);
          }
          console.log(`[Gateway] Yeni rol eklendi: @${role.name} (${role.id})`);
        }
        break;
      }

      case 'GUILD_ROLE_UPDATE': {
        const guildId = data.guild_id as Snowflake;
        const role = data.role as any;
        const guild = guildCache.get(guildId);
        if (guild && guild.roles) {
          const idx = guild.roles.findIndex((r) => r.id === role.id);
          if (idx !== -1) {
            guild.roles[idx] = {...guild.roles[idx], ...role};
          }
        }
        break;
      }

      case 'GUILD_ROLE_UPDATE_BULK': {
        const guildId = data.guild_id as Snowflake;
        const roles = data.roles as any[];
        const guild = guildCache.get(guildId);
        if (guild && Array.isArray(roles)) {
          guild.roles = roles;
        }
        break;
      }

      case 'GUILD_ROLE_DELETE': {
        const guildId = data.guild_id as Snowflake;
        const roleId = data.role_id as Snowflake;
        const guild = guildCache.get(guildId);
        if (guild && guild.roles) {
          guild.roles = guild.roles.filter((r) => r.id !== roleId);
          console.log(`[Gateway] Rol silindi: ${roleId}`);
        }
        break;
      }

      case 'GUILD_DELETE': {
        guildCache.delete(data.id);
        console.log(`[Gateway] Sunucudan ayrılındı veya silindi: ${data.id}`);
        break;
      }

      case 'GUILD_MEMBER_ADD': {
        const guildId = data.guild_id as Snowflake;
        const member = data as FluxerMember;
        const guild = guildCache.get(guildId);

        console.log(`[Gateway] Yeni üye katıldı: ${member.user.username} (Sunucu: ${guildId})`);

        // Anti-Raid / Join Gate Protection
        if (guild) {
          const raidResult = await antiRaidService.handleMemberJoin(guild, member);
          if (raidResult.isRaid) {
            return; // Member was kicked or isolated due to active raid
          }
        }

        // Update cache (bounded to latest 500 members to prevent memory leaks)
        if (guild && guild.members) {
          if (guild.members.length >= 500) {
            guild.members.shift();
          }
          guild.members.push(member);
          if (guild.member_count != null) guild.member_count++;
        }

        // AutoRole
        await roleService.handleMemberJoin(guildId, member.user.id);

        // Welcome Notification
        if (guild) {
          await welcomeService.onMemberJoin(guild, member);
        }

        // ModLog
        void modLogService.sendModLog(guildId, {
          action: 'ÜYE KATILDI',
          target: member.user,
          reason: 'Sunucuya yeni üye girişi yaptı.',
        });
        break;
      }

      case 'GUILD_MEMBER_REMOVE': {
        const guildId = data.guild_id as Snowflake;
        const rawUser = (data.user || data) as FluxerUser;
        const guild = guildCache.get(guildId);

        // Find cached member before removing from cache
        const cachedMember = guild?.members?.find((m) => m.user?.id === (rawUser?.id || (data as any)?.id));
        let user: FluxerUser = {
          id: rawUser?.id || (data as any)?.id || cachedMember?.user?.id || '',
          username: rawUser?.username || cachedMember?.user?.username || (cachedMember as any)?.nick || '',
          discriminator: rawUser?.discriminator || cachedMember?.user?.discriminator || '0000',
          avatar: rawUser?.avatar || cachedMember?.user?.avatar || null,
        };

        if (!user.username && user.id) {
          try {
            const fetched = await api.getUser(user.id);
            if (fetched?.username) {
              user = {...user, ...fetched};
            }
          } catch {}
        }
        if (!user.username) {
          user.username = 'Eski Üye';
        }

        console.log(`[Gateway] Üye ayrıldı: ${user.username} (Sunucu: ${guildId})`);

        if (guild && guild.members) {
          guild.members = guild.members.filter((m) => m.user.id !== user.id);
          if (guild.member_count != null && guild.member_count > 0) guild.member_count--;
        }

        if (guild) {
          await welcomeService.onMemberLeave(guild, user, cachedMember);
        }

        void modLogService.sendModLog(guildId, {
          action: 'ÜYE AYRILDI',
          target: user,
          reason: 'Sunucudan ayrıldı veya atıldı.',
        });
        break;
      }

      case 'GUILD_MEMBER_UPDATE': {
        const guildId = data.guild_id as Snowflake;
        const guild = guildCache.get(guildId);
        if (guild && guild.members) {
          const idx = guild.members.findIndex((m) => m.user.id === data.user?.id);
          if (idx !== -1) {
            guild.members[idx] = {...guild.members[idx], ...data};
          }
        }

        // Check if member had an active timeout that was removed directly in Discord
        const timeoutUntil = data.communication_disabled_until
          ? new Date(data.communication_disabled_until).getTime()
          : null;
        if (data.user?.id && (!timeoutUntil || timeoutUntil <= Date.now())) {
          if (modService.hasActiveTimeout(guildId, data.user.id)) {
            void modService.handleEarlyUntimeout(guildId, data.user.id, 'Discord / Yetkili');
          }
        }
        break;
      }

      case 'MESSAGE_CREATE': {
        const message = data as FluxerMessage;
        const botUser = gateway.currentUser;

        // Ignore messages from the bot itself
        if (botUser && message.author?.id === botUser.id) {
          return;
        }

        // Must be in a guild
        const guildId = message.guild_id;
        if (!guildId) return;

        let guild = guildCache.get(guildId);
        if (!guild) {
          try {
            guild = await api.getGuild(guildId);
            guildCache.set(guildId, guild);
          } catch {
            return;
          }
        }

        if (!guild.channels || guild.channels.length === 0) {
          guild.channels = await api.getGuildChannels(guildId).catch(() => []);
        }
        if (!guild.roles || guild.roles.length === 0) {
          guild.roles = await api.getGuildRoles(guildId).catch(() => []);
        }

        // Find invoker member with latest roles
        let invokerMember: FluxerMember | undefined;
        if ((data as any).member) {
          invokerMember = {
            user: message.author,
            nick: (data as any).member.nick,
            roles: Array.isArray((data as any).member.roles) ? (data as any).member.roles : [],
            joined_at: (data as any).member.joined_at || new Date().toISOString(),
            communication_disabled_until: (data as any).member.communication_disabled_until,
          };
          if (guild.members) {
            const idx = guild.members.findIndex((m) => m.user.id === message.author.id);
            if (idx !== -1) {
              guild.members[idx] = {...guild.members[idx], ...invokerMember};
            } else {
              guild.members.push(invokerMember);
            }
          }
        } else {
          invokerMember = guild.members?.find((m) => m.user.id === message.author.id);
          if (!invokerMember) {
            try {
              invokerMember = await api.getGuildMember(guildId, message.author.id);
            } catch {
              return;
            }
          }
        }

        // Find bot member with latest roles
        let botMember: FluxerMember | undefined;
        if (botUser) {
          try {
            botMember = await api.getGuildMember(guildId, botUser.id);
          } catch {
            botMember = guild.members?.find((m) => m.user.id === botUser.id) || {
              user: botUser,
              roles: [],
              joined_at: new Date().toISOString(),
            };
          }
        }

        if (!botMember) return;

        // Process message through CommandHandler
        await commandHandler.handleMessage(guild, invokerMember, botMember, message);
        break;
      }

      case 'INTERACTION_CREATE': {
        const interaction = data as FluxerInteraction;
        await commandHandler.handleInteraction(interaction);
        break;
      }

      case 'MESSAGE_REACTION_ADD': {
        const reactionEvent = data as FluxerReactionEvent;
        const botUser = gateway.currentUser;
        await commandHandler.handleReactionAdd(reactionEvent, botUser?.id);
        break;
      }

      case 'MESSAGE_REACTION_REMOVE': {
        const reactionEvent = data as FluxerReactionEvent;
        const botUser = gateway.currentUser;
        await commandHandler.handleReactionRemove(reactionEvent, botUser?.id);
        break;
      }

      case 'MESSAGE_POLL_VOTE_ADD': {
        const pollVoteEvent = data as FluxerPollVoteEvent;
        await commandHandler.handlePollVoteAdd(pollVoteEvent);
        break;
      }

      case 'MESSAGE_POLL_VOTE_REMOVE': {
        const pollVoteEvent = data as FluxerPollVoteEvent;
        await commandHandler.handlePollVoteRemove(pollVoteEvent);
        break;
      }

      case 'VOICE_STATE_UPDATE': {
        const vs = data as any;
        console.log(`[Gateway] VOICE_STATE_UPDATE: Kullanıcı ${vs.user_id} -> Ses Kanalı ${vs.channel_id || 'Ayrıldı'}`);
        const guildId = vs.guild_id as Snowflake;
        const userId = vs.user_id as Snowflake;
        const channelId = vs.channel_id as Snowflake | null;
        if (guildId && userId) {
          musicService.updateVoiceState(guildId, userId, channelId || null);
          const isDeaf = Boolean(vs.self_deaf || vs.deaf);
          levelingService.handleVoiceStateUpdate(guildId, userId, channelId || null, isDeaf);
          if (gateway.currentUser && userId === gateway.currentUser.id && !channelId) {
            musicService.handleBotVoiceDisconnect(guildId);
          }
        }
        break;
      }

      case 'VOICE_SERVER_UPDATE': {
        const vsu = data as any;
        console.log(`[Gateway] VOICE_SERVER_UPDATE alındı: Sunucu ${vsu.guild_id}, Endpoint: ${vsu.endpoint}`);
        if (vsu && vsu.endpoint && vsu.token) {
          voiceClient.connect(vsu);
        }
        break;
      }

      default:
        break;
    }
  });

  // Start Gateway connection
  await gateway.connect();

  // Handle graceful exit
  const handleExit = () => {
    console.log('\n[Bot] Kapatılıyor...');
    birthdayService.stop();
    levelingService.stop();
    giveawayService.stop();
    antiSpamService.stop();
    voiceClient.disconnectAll();
    gateway.disconnect();
    db.backupDatabase();
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
}

main().catch((err) => {
  console.error('[Bot] Kritik Başlatma Hatası:', err);
  process.exit(1);
});
