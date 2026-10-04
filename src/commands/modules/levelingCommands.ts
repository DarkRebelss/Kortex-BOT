// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CommandContext } from '../types.js';
import type { Snowflake } from '../../types/fluxer.js';

function extractUserId(raw: string): Snowflake | null {
  if (!raw) return null;
  const clean = raw.trim().replace(/^<@!?/, '').replace(/>$/, '');
  return clean || null;
}

export async function handleLevelingCommands(ctx: CommandContext): Promise<boolean> {
  const { commandName, args, guild, invoker, message, api, levelingService, helpers } = ctx;

  switch (commandName) {
    case 'rank':
    case 'level':
    case 'seviye': {
      if (!levelingService) {
        await api.sendMessage(message.channel_id, '❌ Seviye servisi aktif değil.');
        return true;
      }
      const leveling = levelingService;
      const targetRaw = args[0];
      let targetUser = invoker.user;
      if (targetRaw) {
        const resolved = await helpers.resolveMember(guild, targetRaw);
        if (resolved) {
          targetUser = resolved.user;
        } else {
          const uid = extractUserId(targetRaw);
          if (uid) {
            try {
              targetUser = await api.getUser(uid);
            } catch { }
          }
        }
      }
      const res = leveling.getRank(guild, targetUser);
      await api.sendMessage(message.channel_id, res.message);
      return true;
    }

    case 'topxp':
    case 'top':
    case 'leaderboard':
    case 'siralama':
    case 'sıralama': {
      if (!levelingService) {
        await api.sendMessage(message.channel_id, '❌ Seviye servisi aktif değil.');
        return true;
      }
      const leveling = levelingService;
      const res = await leveling.getTopXP(guild, 10, invoker.user.id);
      await api.sendMessage(message.channel_id, res.message);
      return true;
    }

    case 'leveling':
    case 'seviyesistemi': {
      if (!levelingService) {
        await api.sendMessage(message.channel_id, '❌ Seviye servisi aktif değil.');
        return true;
      }
      const leveling = levelingService;
      const sub = (args[0] || '').toLowerCase();
      if (sub === 'on' || sub === 'enable' || sub === 'aktif' || sub === 'ac' || sub === 'aç') {
        const res = leveling.toggle(guild, invoker, true);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'off' || sub === 'disable' || sub === 'kapat' || sub === 'pasif') {
        const res = leveling.toggle(guild, invoker, false);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'channel' || sub === 'kanal') {
        const channelRaw = args[1];
        if (!channelRaw || channelRaw === 'off' || channelRaw === 'kapat' || channelRaw === 'reset') {
          const res = leveling.setChannel(guild, invoker, null);
          await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
          return true;
        }
        const channel = await helpers.resolveChannel(guild, channelRaw);
        if (!channel) {
          await helpers.sendUsageError(message, '❌ Belirtilen kanal bulunamadı.');
          return true;
        }
        const res = leveling.setChannel(guild, invoker, channel.id);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else {
        await helpers.sendUsageError(
          message,
          '❌ Kullanım: `/leveling on/off`, `/leveling channel <#kanal|off>`',
        );
      }
      return true;
    }

    case 'levelrole':
    case 'levelrol':
    case 'seviyerol':
    case 'seviyerolü': {
      if (!levelingService) {
        await helpers.sendUsageError(message, '❌ Seviye servisi aktif değil.');
        return true;
      }
      const leveling = levelingService;
      const sub = (args[0] || '').toLowerCase();
      if (sub === 'add' || sub === 'ekle') {
        const levelNum = Number.parseInt(args[1], 10);
        const roleRaw = args[2];
        if (isNaN(levelNum) || !roleRaw) {
          await helpers.sendUsageError(
            message,
            '❌ Kullanım: `/levelrole add <seviye_no> <@rol>` (Örn: `/levelrole add 5 @Bronz Üye`)',
          );
          return true;
        }
        const role = await helpers.resolveRole(guild, roleRaw);
        if (!role) {
          await helpers.sendUsageError(message, '❌ Belirtilen rol bulunamadı.');
          return true;
        }
        const res = leveling.addLevelRole(guild, invoker, levelNum, role.id);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 7, message.id);
      } else if (sub === 'remove' || sub === 'sil' || sub === 'delete') {
        const levelNum = Number.parseInt(args[1], 10);
        if (isNaN(levelNum)) {
          await helpers.sendUsageError(message, '❌ Kullanım: `/levelrole remove <seviye_no>`');
          return true;
        }
        const res = leveling.removeLevelRole(guild, invoker, levelNum);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 7, message.id);
      } else if (sub === 'list' || sub === 'liste' || !sub) {
        const res = leveling.listLevelRoles(guild);
        await api.sendMessage(message.channel_id, res.message);
      } else {
        await helpers.sendUsageError(
          message,
          '❌ Kullanım: `/levelrole add <seviye> <@rol>`, `/levelrole remove <seviye>`, `/levelrole list`',
        );
      }
      return true;
    }

    default:
      return false;
  }
}
