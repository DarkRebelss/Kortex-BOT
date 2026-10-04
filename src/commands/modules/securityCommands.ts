// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CommandContext } from '../types.js';
import { PermissionService } from '../../services/PermissionService.js';
import { Permissions } from '../../config/constants.js';

export async function handleSecurityCommands(ctx: CommandContext): Promise<boolean> {
  const { commandName, args, guild, invoker, message, api, antiSpamService, antiLinkService, badWordsService, antiRaidService, db, helpers } = ctx;

  switch (commandName) {
    case 'antispam': {
      const sub = args[0]?.toLowerCase();
      if (sub === 'enable' || sub === 'ac' || sub === 'aç' || sub === 'on') {
        const res = antiSpamService.configure(guild, invoker, { enabled: true });
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'disable' || sub === 'kapat' || sub === 'off') {
        const res = antiSpamService.configure(guild, invoker, { enabled: false });
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'status' || sub === 'durum' || !sub) {
        const res = antiSpamService.getStatus(guild);
        await api.sendMessage(message.channel_id, res.message);
      } else if (sub === 'exemptmods' || sub === 'allowmods' || sub === 'muafiyet') {
        const val = args[1]?.toLowerCase();
        const enable =
          val === 'on' || val === 'true' || val === 'enable' || val === 'ac' || val === 'aç' || val === '1';
        const res = antiSpamService.configure(guild, invoker, { exemptMods: enable });
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'messages') {
        const val = Number.parseInt(args[1], 10);
        if (val > 0) {
          const res = antiSpamService.configure(guild, invoker, { maxMessages: val });
          await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
        } else {
          await helpers.sendUsageError(message, '❌ Lütfen geçerli bir sayı girin: `/antispam messages 8`');
        }
      } else if (sub === 'interval') {
        const val = Number.parseInt(args[1], 10);
        if (val > 0) {
          const res = antiSpamService.configure(guild, invoker, { intervalSeconds: val });
          await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
        } else {
          await helpers.sendUsageError(message, '❌ Lütfen geçerli bir saniye girin: `/antispam interval 5`');
        }
      } else {
        await helpers.sendUsageError(
          message,
          '❌ Kullanım: `/antispam enable`, `/antispam disable`, `/antispam status`, `/antispam messages 8`, `/antispam interval 5`, `/antispam exemptmods on/off`',
        );
      }
      return true;
    }

    case 'antilink': {
      const sub = args[0]?.toLowerCase();
      if (sub === 'enable' || sub === 'ac' || sub === 'aç' || sub === 'on') {
        const res = antiLinkService.toggle(guild, invoker, true);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'disable' || sub === 'kapat' || sub === 'off') {
        const res = antiLinkService.toggle(guild, invoker, false);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'status' || sub === 'durum' || !sub) {
        const res = antiLinkService.getStatus(guild);
        await api.sendMessage(message.channel_id, res.message);
      } else if (sub === 'exemptmods' || sub === 'allowmods' || sub === 'muafiyet') {
        const val = args[1]?.toLowerCase();
        const enable = val === 'on' || val === 'true' || val === 'enable' || val === 'ac' || val === 'aç' || val === '1';
        const res = antiLinkService.setExemptMods(guild, invoker, enable);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'whitelist') {
        const domain = args[1];
        if (!domain) {
          await helpers.sendUsageError(
            message,
            '❌ Kullanım: `/antilink whitelist <domain>` (Örn: `/antilink whitelist micup.gg`)',
          );
          return true;
        }
        const res = antiLinkService.addWhitelistDomain(guild, invoker, domain);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'remove') {
        const domain = args[1];
        if (!domain) {
          await helpers.sendUsageError(
            message,
            '❌ Kullanım: `/antilink remove <domain>`',
          );
          return true;
        }
        const res = antiLinkService.removeWhitelistDomain(guild, invoker, domain);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else {
        await helpers.sendUsageError(
          message,
          '❌ Kullanım: `/antilink enable`, `/antilink disable`, `/antilink status`, `/antilink whitelist <domain>`, `/antilink remove <domain>`, `/antilink exemptmods on/off`',
        );
      }
      return true;
    }

    case 'badwords':
    case 'kufurfiltresi':
    case 'küfürfiltresi':
    case 'badword': {
      if (!badWordsService) {
        await helpers.sendUsageError(message, '❌ Küfür filtresi servisi aktif değil.');
        return true;
      }
      const badWords = badWordsService;
      const sub = (args[0] || '').toLowerCase();
      if (sub === 'on' || sub === 'enable' || sub === 'aktif' || sub === 'ac' || sub === 'aç') {
        const res = badWords.toggle(guild, invoker, true);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'off' || sub === 'disable' || sub === 'kapat' || sub === 'pasif') {
        const res = badWords.toggle(guild, invoker, false);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'default') {
        const state = (args[1] || '').toLowerCase();
        const enable = state === 'on' || state === 'enable' || state === 'aktif' || state === 'ac' || state === 'aç';
        const res = badWords.toggleDefault(guild, invoker, enable);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'exempt' || sub === 'exemptmods' || sub === 'muafiyet') {
        const state = (args[1] || '').toLowerCase();
        const enable = state === 'on' || state === 'enable' || state === 'aktif' || state === 'ac' || state === 'aç';
        const res = badWords.toggleExempt(guild, invoker, enable);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'punishment' || sub === 'ceza') {
        const pType = args[1] || '';
        const res = badWords.setPunishment(guild, invoker, pType);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'add' || sub === 'ekle') {
        const word = args.slice(1).join(' ').trim();
        if (!word) {
          await helpers.sendUsageError(message, '❌ Eklemek istediğiniz kelimeyi belirtin. Örn: `/badwords add yasaklikelime`');
          return true;
        }
        const res = badWords.addWord(guild, invoker, word);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'remove' || sub === 'sil' || sub === 'delete') {
        const word = args.slice(1).join(' ').trim();
        if (!word) {
          await helpers.sendUsageError(message, '❌ Kaldırmak istediğiniz kelimeyi belirtin. Örn: `/badwords remove kelime`');
          return true;
        }
        const res = badWords.removeWord(guild, invoker, word);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'clear' || sub === 'temizle') {
        const res = badWords.clearWords(guild, invoker);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'list' || sub === 'liste' || !sub) {
        const res = badWords.listWords(guild, invoker);
        await api.sendMessage(message.channel_id, res.message);
      } else {
        await helpers.sendUsageError(
          message,
          '❌ Kullanım: `/badwords on/off`, `/badwords default on/off`, `/badwords punishment <delete|warn|timeout>`, `/badwords add <kelime>`, `/badwords remove <kelime>`, `/badwords list`, `/badwords clear`',
        );
      }
      return true;
    }

    case 'antiraid':
    case 'raidkoruma': {
      if (!antiRaidService) return true;
      const sub = (args[0] || '').toLowerCase();
      if (sub === 'on' || sub === 'enable' || sub === 'aktif' || sub === 'aç' || sub === 'ac') {
        const res = antiRaidService.toggle(guild, invoker, true);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'off' || sub === 'disable' || sub === 'kapat' || sub === 'pasif') {
        const res = antiRaidService.toggle(guild, invoker, false);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'limit' || sub === 'threshold' || sub === 'esik' || sub === 'eşik') {
        const count = Number.parseInt(args[1], 10);
        if (isNaN(count)) {
          await helpers.sendUsageError(message, '❌ Kullanım: `/antiraid limit <sayı>` (Örn: `/antiraid limit 8`)');
          return true;
        }
        const res = antiRaidService.setThreshold(guild, invoker, count);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else if (sub === 'action' || sub === 'ceza') {
        const act = args[1] || '';
        const res = antiRaidService.setAction(guild, invoker, act);
        await helpers.sendAutoExpiringMessage(message.channel_id, res.message, 6, message.id);
      } else {
        const res = antiRaidService.getStatus(guild);
        await api.sendMessage(message.channel_id, res.message);
      }
      return true;
    }

    case 'massmention':
    case 'topluetiket': {
      if (!PermissionService.hasPermission(guild, invoker, Permissions.ADMINISTRATOR) && invoker.user.id !== guild.owner_id) {
        await helpers.sendUsageError(message, '❌ Bu komutu kullanmak için **Yönetici** yetkisine sahip olmalısınız.');
        return true;
      }
      const sub = (args[0] || '').toLowerCase();
      if (sub === 'on' || sub === 'enable' || sub === 'aktif' || sub === 'aç' || sub === 'ac') {
        db?.updateGuildConfig(guild.id, { massmention_enabled: 1 });
        await helpers.sendAutoExpiringMessage(message.channel_id, '🛡️ **Toplu Etiket Koruması (Mass Mention) Aktifleştirildi!**', 6, message.id);
      } else if (sub === 'off' || sub === 'disable' || sub === 'kapat' || sub === 'pasif') {
        db?.updateGuildConfig(guild.id, { massmention_enabled: 0 });
        await helpers.sendAutoExpiringMessage(message.channel_id, '⚠️ **Toplu Etiket Koruması Devre Dışı Bırakıldı.**', 6, message.id);
      } else if (sub === 'limit' || sub === 'adet' || sub === 'sayi' || sub === 'sayı') {
        const limit = Number.parseInt(args[1], 10);
        if (isNaN(limit) || limit < 2 || limit > 50) {
          await helpers.sendUsageError(message, '❌ Lütfen 2 ile 50 arasında geçerli bir limit girin. (Örn: `/massmention limit 5`)');
          return true;
        }
        db?.updateGuildConfig(guild.id, { massmention_limit: limit });
        await helpers.sendAutoExpiringMessage(message.channel_id, `✅ **Toplu Etiket Limiti Güncellendi:** Maksimum **${limit}** etiket.`, 6, message.id);
      } else {
        const cfg = db?.getGuildConfig(guild.id);
        await api.sendMessage(
          message.channel_id,
          `🛡️ **Toplu Etiket Koruması:**\n• **Durum:** ${cfg?.massmention_enabled ? '🟢 Aktif' : '🔴 Pasif'}\n• **Limit:** Mesaj başına ${cfg?.massmention_limit || 5} etiket\n*Ayar: \`/massmention on/off\`, \`/massmention limit <adet>\`*`,
        );
      }
      return true;
    }

    case 'capslock':
    case 'caps': {
      if (!PermissionService.hasPermission(guild, invoker, Permissions.ADMINISTRATOR) && invoker.user.id !== guild.owner_id) {
        await helpers.sendUsageError(message, '❌ Bu komutu kullanmak için **Yönetici** yetkisine sahip olmalısınız.');
        return true;
      }
      const sub = (args[0] || '').toLowerCase();
      if (sub === 'on' || sub === 'enable' || sub === 'aktif' || sub === 'aç' || sub === 'ac') {
        db?.updateGuildConfig(guild.id, { capslock_enabled: 1 });
        await helpers.sendAutoExpiringMessage(message.channel_id, '🔇 **Capslock (Büyük Harf) Koruması Aktifleştirildi!**', 6, message.id);
      } else if (sub === 'off' || sub === 'disable' || sub === 'kapat' || sub === 'pasif') {
        db?.updateGuildConfig(guild.id, { capslock_enabled: 0 });
        await helpers.sendAutoExpiringMessage(message.channel_id, '⚠️ **Capslock Koruması Devre Dışı Bırakıldı.**', 6, message.id);
      } else if (sub === 'percentage' || sub === 'oran' || sub === 'yuzde' || sub === 'yüzde') {
        const pct = Number.parseInt(args[1], 10);
        if (isNaN(pct) || pct < 40 || pct > 100) {
          await helpers.sendUsageError(message, '❌ Lütfen %40 ile %100 arasında bir yüzde girin. (Örn: `/capslock oran 70`)');
          return true;
        }
        db?.updateGuildConfig(guild.id, { capslock_percentage: pct });
        await helpers.sendAutoExpiringMessage(message.channel_id, `✅ **Capslock Oranı Güncellendi:** %${pct} ve üzeri büyük harfler engellenecek.`, 6, message.id);
      } else {
        const cfg = db?.getGuildConfig(guild.id);
        await api.sendMessage(
          message.channel_id,
          `🔇 **Capslock Koruması:**\n• **Durum:** ${cfg?.capslock_enabled ? '🟢 Aktif' : '🔴 Pasif'}\n• **Eşik:** %${cfg?.capslock_percentage || 70} büyük harf\n*Ayar: \`/capslock on/off\`, \`/capslock oran <40-100>\`*`,
        );
      }
      return true;
    }

    default:
      return false;
  }
}
