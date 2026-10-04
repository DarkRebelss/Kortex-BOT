// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CommandContext } from '../types.js';
import { PermissionService } from '../../services/PermissionService.js';
import { Permissions } from '../../config/constants.js';

async function handleOwoChannelConfig(ctx: CommandContext, chRaw?: string): Promise<boolean> {
  const { guild, invoker, message, db, helpers, commandName } = ctx;
  const isOwner = invoker.user.id === guild.owner_id;
  const isAdmin = PermissionService.hasPermission(guild, invoker, Permissions.ADMINISTRATOR);
  const isManageGuild = PermissionService.hasPermission(guild, invoker, Permissions.MANAGE_GUILD);
  if (!isManageGuild && !isAdmin && !isOwner) {
    await helpers.sendUsageError(message, '❌ Bu ayarı değiştirmek için **Sunucuyu Yönet** yetkisine sahip olmalısınız.');
    return true;
  }

  const prefix = '/';
  const cmdBase = commandName === 'owokanal' ? `${prefix}owokanal` : `${prefix}${commandName} kanal`;

  if (!chRaw) {
    const currentCfg = db?.getGuildConfig(guild.id);
    if (currentCfg?.owo_channel_id) {
      await helpers.sendAutoExpiringMessage(
        message.channel_id,
        `ℹ️ **Mevcut OwO Kanalı:** <#${currentCfg.owo_channel_id}>\n• Değiştirmek için: \`${cmdBase} #kanal\`\n• Sıfırlamak için: \`${cmdBase} sil\``,
        8,
        message.id,
      );
    } else {
      await helpers.sendAutoExpiringMessage(
        message.channel_id,
        `ℹ️ **OwO kanalı kısıtlaması aktif değil.** OwO oyunları tüm kanallarda serbest.\n• Belirlemek için: \`${cmdBase} #kanal\``,
        8,
        message.id,
      );
    }
    return true;
  }

  if (chRaw === 'sil' || chRaw === 'delete' || chRaw === 'sifirla' || chRaw === 'reset' || chRaw === 'off' || chRaw === 'kapat') {
    db?.updateGuildConfig(guild.id, { owo_channel_id: null });
    await helpers.sendAutoExpiringMessage(message.channel_id, '✅ **OwO kanalı kısıtlaması kaldırıldı.** OwO oyunları artık tüm kanallarda serbest.', 6, message.id);
    return true;
  }

  const ch = await helpers.resolveChannel(guild, chRaw);
  if (!ch) {
    await helpers.sendUsageError(message, `❌ Lütfen geçerli bir kanal etiketleyin. Örn: \`${cmdBase} #owo-oyun\` veya \`${cmdBase} sil\``);
    return true;
  }
  db?.updateGuildConfig(guild.id, { owo_channel_id: ch.id });
  await helpers.sendAutoExpiringMessage(message.channel_id, `✅ **OwO Kanalı Ayarlandı:** <#${ch.id}>. Üyeler OwO oyunlarını yalnızca bu kanalda oynayabilir.`, 6, message.id);
  return true;
}

export async function handleOwoCommands(ctx: CommandContext): Promise<boolean> {
  const { commandName, args, guild, invoker, message, owoService, helpers } = ctx;

  switch (commandName) {
    case 'w': {
      // /w kanal #kanal or /w kanal sil
      if (args[0] === 'kanal' || args[0] === 'channel' || args[0] === 'owokanal') {
        return handleOwoChannelConfig(ctx, args[1]);
      }
      // /w <subcommand> [args...]
      const sub = args[0] || 'help';
      const subArgs = args.slice(1);
      await owoService.handleCommand(sub, subArgs, guild, invoker, message);
      return true;
    }

    case 'owo':
    case 'uwu': {
      // /owo kanal #kanal or /uwu kanal #kanal
      if (args[0] === 'kanal' || args[0] === 'channel' || args[0] === 'owokanal') {
        return handleOwoChannelConfig(ctx, args[1]);
      }
      // /owo or /uwu without arguments sends a cute face expression
      if (args.length === 0) {
        await owoService.sendExpression(message.channel_id);
        return true;
      }
      // /owo <subcommand> [args...]
      const sub = args[0];
      const subArgs = args.slice(1);
      await owoService.handleCommand(sub, subArgs, guild, invoker, message);
      return true;
    }

    case 'cookie':
    case 'kurabiye':
    case 'hug':
    case 'saril':
    case 'sarıl':
    case 'kiss':
    case 'op':
    case 'öp':
    case 'slap':
    case 'tokat':
    case 'pat':
    case 'sev':
    case 'oksa':
    case 'okşa':
    case 'pray':
    case 'dua':
    case 'curse':
    case 'lanet':
    case 'marry':
    case 'evlen':
    case 'divorce':
    case 'bosan':
    case 'boşan': {
      await owoService.handleCommand(commandName, args, guild, invoker, message);
      return true;
    }

    case 'owokanal': {
      return handleOwoChannelConfig(ctx, args[0]);
    }

    case 'remind':
    case 'hatirlatici':
    case 'hatırlatıcı': {
      await owoService.handleCommand('remind', args, guild, invoker, message);
      return true;
    }

    default:
      return false;
  }
}
