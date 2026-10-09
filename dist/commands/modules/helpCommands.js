// SPDX-License-Identifier: AGPL-3.0-or-later
import { config } from '../../config/env.js';
import { PermissionService } from '../../services/PermissionService.js';
export const HELP_USER_TOTAL_PAGES = 3;
export const HELP_ADMIN_TOTAL_PAGES = 5;
export const HELP_TOTAL_PAGES = HELP_USER_TOTAL_PAGES;
export function buildNavLine(current, total) {
    const parts = [];
    if (current > 1) {
        parts.push('◀️ Önceki');
    }
    else {
        parts.push('~~◀️ Önceki~~');
    }
    parts.push(`**${current}** / **${total}**`);
    if (current < total) {
        parts.push('Sonraki ▶️');
    }
    else {
        parts.push('~~Sonraki ▶️~~');
    }
    return parts.join('  •  ');
}
export function buildHelpPage(pageNum, mode = 'user') {
    const p = config.commandPrefix || '/';
    if (mode === 'admin') {
        const total = HELP_ADMIN_TOTAL_PAGES;
        const pages = [
            // Page 1: Moderasyon, Ceza & Sohbet Temizleme Yönetimi
            [
                `🔨 **Moderasyon & Üye Disiplin Komutları:**`,
                `• \`${p}ban @üye [sebep]\` — Üyeyi sunucudan kalıcı olarak yasaklar (\`${p}yasakla\`).`,
                `• \`${p}unban <kullanıcı_id> [sebep]\` — Belirtilen kullanıcının yasağını kaldırır (\`${p}yasakkaldir\`).`,
                `• \`${p}kick @üye [sebep]\` — Üyeyi sunucudan atar (\`${p}at\`, \`${p}kickle\`).`,
                `• \`${p}timeout @üye <süre> [sebep]\` — Üyeyi geçici susturur (\`10m\`, \`1h\`, \`1d\`) (\`${p}mute\`, \`${p}sustur\`).`,
                `• \`${p}untimeout @üye\` — Kullanıcının susturmasını kaldırır (\`${p}unmute\`, \`${p}susturmakaldir\`).`,
                `• \`${p}warn @üye <sebep>\` — Resmi uyarı verir (3: 10m mute, 5: 1h mute, 7: kick, 10: ban) (\`${p}uyar\`).`,
                `• \`${p}warnings @üye\` — Üyenin aktif uyarı geçmişini listeler (\`${p}uyarilar\`).`,
                `• \`${p}clearwarns @üye\` — Üyenin tüm uyarılarını temizler (\`${p}uyarilartemizle\`).`,
                ``,
                `🧹 **Sohbet & Kanal Denetim Komutları:**`,
                `• \`${p}clear <1-100>\` — Belirtilen sayıda son mesajı toplu siler (\`${p}sil\`, \`${p}temizle\`).`,
                `• \`${p}clear user @üye <1-100>\` — Yalnızca belirtilen kullanıcının mesajlarını siler.`,
                `• \`${p}slowmode <saniye>\` — Kanal mesaj gönderme aralığını ayarlar (\`0\` kapatır) (\`${p}yavasmod\`).`,
                `• \`${p}lock [kanal]\` — Kanalı üyelerin mesaj gönderimine kilitler (\`${p}kilitle\`).`,
                `• \`${p}unlock [kanal]\` — Kilitli kanalın mesaj gönderimini tekrar açar (\`${p}kilitac\`).`,
            ],
            // Page 2: Sunucu Güvenliği, Anti-Raid & Filtre Sistemleri
            [
                `🔒 **GÜVENLİK & KORUMA SİSTEMLERİ:**`,
                `• \`${p}antispam on/off\` — Hızlı mesaj spam korumasını açar veya kapatır.`,
                `• \`${p}antispam action <mute/kick/ban>\` — Spam yapan üyeye uygulanacak cezayı belirler.`,
                `• \`${p}antispam limit <sayı>\` — Spam eşik limitini ayarlar.`,
                `• \`${p}antilink on/off\` — Reklam ve davet linki paylaşım engelini açar veya kapatır.`,
                `• \`${p}antilink action <delete/warn/mute>\` — Link paylaşan üyeye verilecek cezayı seçer.`,
                `• \`${p}antiraid on/off\` — 10 saniyede ani akın (bot raid) korumasını açar (\`${p}raidkoruma\`).`,
                `• \`${p}antiraid action <kick/ban>\` — Raid yapan hesaplara uygulanacak işlemi belirler.`,
                `• \`${p}badwords on/off\` — Gelişmiş küfür ve argo filtresini açar veya kapatır (\`${p}kufurfiltresi\`).`,
                `• \`${p}badwords add <kelime>\` / \`remove\` / \`list\` — Küfür filtresine özel kelime ekler/siler/listeler.`,
                `• \`${p}massmention on/off\` — Toplu kullanıcı etiketleme (\`@everyone\` / çoklu üye) koruması (\`${p}topluetiket\`).`,
                `• \`${p}capslock on/off\` — Aşırı büyük harfle bağırma engeli filtresini açar veya kapatır (\`${p}caps\`).`,
            ],
            // Page 3: Rol Yönetimi, Karşılama, Kart Tasarımı & Kanal Yapılandırması
            [
                `🏷️ **Rol Yönetimi & Otomatik Rol:**`,
                `• \`${p}role add @üye @rol\` — Kullanıcıya belirtilen rolü verir (\`${p}rol ver\`).`,
                `• \`${p}role remove @üye @rol\` — Kullanıcıdan belirtilen rolü alır (\`${p}rol al\`).`,
                `• \`${p}autorole on @rol\` — Yeni katılan üyelere otomatik verilecek rolü ayarlar (\`${p}otorol ac\`).`,
                `• \`${p}autorole off\` — Otomatik rolü devre dışı bırakır (\`${p}autorole status\` ile durumu görün).`,
                ``,
                `📍 **Log, Bot, OwO & Müzik Kanalları:**`,
                `• \`${p}modlog kanal #kanal\` — Moderasyon işlem loglarının gönderileceği kanalı belirler (\`${p}modlog on/off\`).`,
                `• \`${p}botkanal <#kanal>\` / \`<1-5> <#kanal>\` — Bot komut kanallarını sınırlar (En fazla 5 kanal ayarlanabilir).`,
                `• \`${p}botkanal sil [1-5|muzik|owo|level|cekilis|oylama|hepsi]\` — Belirtilen kanal kısıtlamasını sıfırlar.`,
                `• \`${p}muzikkanal #kanal\` (\`${p}music kanal #kanal\`, \`${p}botkanal muzik #kanal\`) — Özel müzik komut kanalını ayarlar.`,
                `• \`${p}muzikkanal sil\` — Müzik kanal kısıtlamasını kaldırır (Tüm kanallarda serbest bırakır).`,
                `• \`${p}w kanal #kanal\` (\`${p}owo kanal #kanal\`, \`${p}uwu kanal #kanal\`) — OwO oyun kanalını ayarlar.`,
                `• \`${p}w kanal sil\` — OwO kanal kısıtlamasını kaldırır (Tüm kanallarda serbest bırakır).`,
                ``,
                `👋 **Karşılama, Uğurlama & Görsel Kartlar:**`,
                `• \`${p}welcome kanal #kanal\` & \`${p}welcome mesaj <metin>\` — Hoş geldin kanal ve mesajını ayarlar.`,
                `• \`${p}welcome on/off\` & \`${p}welcome test\` — Hoş geldin sistemini açar/kapatır veya kartı test eder.`,
                `• \`${p}goodbye kanal #kanal\` & \`${p}goodbye mesaj <metin>\` — Ayrılış kanal ve mesajını ayarlar.`,
                `• \`${p}goodbye on/off\` & \`${p}goodbye test\` — Ayrılış mesaj sistemini açar/kapatır veya test eder.`,
                `• \`${p}cardwelcome on/off/color/avatar\` — Karşılama görsel kart tasarımı ve renk ayarları.`,
            ],
            // Page 4: Seviye, Doğum Günü, Anket, Çekiliş & Özel Yanıt (Tag) Yönetimi
            [
                `📈 **Seviye Sistemi & Ödül Rolleri:**`,
                `• \`${p}leveling on/off\` — Seviye ve XP kazanım sistemini açar veya kapatır (\`${p}seviye ac/kapat\`).`,
                `• \`${p}leveling channel #kanal\` — Seviye atlama kutlama mesajlarının gönderileceği kanalı ayarlar.`,
                `• \`${p}levelrole add <seviye> @rol\` — Belirli bir seviyeye ulaşana verilecek ödül rolünü ekler (\`${p}levelrol ekle\`).`,
                `• \`${p}levelrole remove <seviye>\` / \`list\` — Seviye ödül rolünü kaldırır veya listeler.`,
                ``,
                `🎂 **Doğum Günü Kutlama Sistemi:**`,
                `• \`${p}dogumgunu kanal #kanal\` — Otomatik doğum günü kutlama mesajlarının gideceği kanalı ayarlar.`,
                `• \`${p}dogumgunu mesaj <metin>\` — Tebrik mesaj şablonunu ayarlar (\`{user}\`, \`{day}\`, \`{month}\`, \`{yas}\`).`,
                `• \`${p}dogumgunu kutla\` — Bekleyen doğum günlerini hemen kontrol edip kutlar (\`${p}dogumgunu kontrol\`).`,
                ``,
                `🎉 **Anket, Çekiliş & Özel Yanıtlar (Tags):**`,
                `• \`${p}anket <soru> | <seçenek1> | <seçenek2> ...\` — Şıklar ve emojiler içeren oylama anketi başlatır (\`${p}poll\`).`,
                `• \`${p}cekilis <süre> <kazanan> <ödül>\` — Otomatik geri sayımlı çekiliş başlatır (\`${p}giveaway\`).`,
                `• \`${p}reroll <mesaj_id>\` — Biten çekiliş için yeni kazanan belirler.`,
                `• \`${p}tag ekle <isim> <yanıt>\` — Sunucuya özel otomatik metin yanıtı ekler (\`${p}tag add\`).`,
                `• \`${p}tag sil <isim>\` / \`${p}tag liste\` — Otomatik yanıtı siler veya kayıtlı yanıtları listeler.`,
            ],
            // Page 5: Müzik Sistemi & OwO Ekonomi Sistemi Yönetici Özeti
            [
                `🎵 **Jockie Müzik Sistemi Özeti:**`,
                `• \`${p}play <link/arama>\` (\`${p}p\`, \`${p}çal\`) | \`${p}pause\` | \`${p}resume\` | \`${p}skip\` (\`${p}s\`) | \`${p}stop\` (\`${p}dur\`)`,
                `• \`${p}queue [sayfa]\` (\`${p}q\`) | \`${p}nowplaying\` (\`${p}np\`) | \`${p}volume <0-200>\` (\`${p}vol\`) | \`${p}loop\` | \`${p}shuffle\``,
                `• \`${p}radio [istasyon]\` (\`lofi\`, \`kralpop\`, vb.) | \`${p}filter <efekt>\` | \`${p}bassboost\` | \`${p}nightcore\` | \`${p}vaporwave\` | \`${p}8d\``,
                `• \`${p}clearfilter\` — Tüm ses filtrelerini sıfırlar. Müzik komutları ses odasındayken her kanalda çalışır.`,
                ``,
                `🐾 **OwO Sistemi & Ekonomi Özeti (Prefix: \`${p}owo\`, \`${p}uwu\`, \`${p}w\`):**`,
                `• \`${p}w kanal #kanal\` (\`${p}owo kanal #kanal\`, \`${p}uwu kanal #kanal\`) — OwO kanalını sınırla (Kaldır: \`${p}w kanal sil\`).`,
                `• **Avcılık:** \`${p}owo hunt\` Hayvan yakala | \`${p}owo zoo\` Hayvanat bahçesi | \`${p}owo sell\` Hayvanları sat`,
                `• **Ekonomi:** \`${p}owo cash\` Bakiye | \`${p}owo daily\` Günlük ödül | \`${p}owo give cash @üye <miktar>\` Transfer`,
                `• **Mağaza:** \`${p}owo shop\` Mağaza | \`${p}owo buy <id> [adet]\` Al | \`${p}owo inv\` Envanter | \`${p}owo open <kasa>\` Aç`,
                `• **Kumar:** \`${p}owo cf <miktar> <y/t>\` Yazı Tura | \`${p}owo slots <miktar>\` Slot | \`${p}owo bj <miktar>\` Blackjack`,
                `• **RPG:** \`${p}owo battle\` Savaş | \`${p}owo pray\` Dua et | \`${p}owo curse\` Lanet oku | \`${p}owo team\` Takım kur`,
                `• **Evlilik & Sosyal:** \`${p}owo marry @üye\` Evlen | \`${p}owo divorce\` Boşan | \`${p}owo profile\` Profil | \`${p}owo top\` Sıralama`,
                ``,
                `👑 **Yönetici Ayrıcalığı:** Sunucu Sahibi, Yöneticiler ve Moderatörler tüm kanallarda kanal kısıtlamalarından muaftır.`,
            ],
        ];
        const pageContent = pages[Math.max(0, Math.min(pageNum - 1, pages.length - 1))];
        const header = `🛡️ **Kyron — Yönetici & Moderatör Komut Rehberi** (Sayfa ${pageNum}/${total})`;
        const separator = '────────────────────────────────────────';
        const navLine = buildNavLine(pageNum, total);
        const footerNote = `💡 Yalnızca Sunucu Sahibi, Yöneticiler ve Moderatörler bu komutları kullanabilir.`;
        return [header, separator, ...pageContent, separator, navLine, footerNote].join('\n');
    }
    // mode === 'user'
    const total = HELP_USER_TOTAL_PAGES;
    const pages = [
        // Page 1: Sunucu Seviye, Sıralama, Topluluk & Etkileşim Araçları
        [
            `📈 **Sunucu Seviye & Sıralama Sistemi (Metin & Ses XP):**`,
            `• \`${p}rank [@üye]\` — Seviye kartınızı, seviyenizi, mesaj/ses XP'nizi ve sıralamanızı görüntüler (\`${p}level\`, \`${p}seviye\`).`,
            `• \`${p}topxp\` — Sunucudaki en yüksek seviyeli üyeleri sıralar (\`${p}leaderboard\`, \`${p}siralamasi\`).`,
            ``,
            `🎉 **Topluluk, Etkileşim & Eğlence Araçları:**`,
            `• \`${p}afk [sebep]\` — AFK moduna geçer. Biri sizi etiketlerse bot bilgi verir. Mesaj yazdığınızda mod kapanır.`,
            `• \`${p}dogumgunu ayarla <gün.ay>\` — Doğum gününüzü sisteme kaydeder (Örn: \`${p}dogumgunu ayarla 15.04\` veya \`15 nisan\`).`,
            `• \`${p}dogumgunu bak [@üye]\` — Kayıtlı doğum günü tarihini ve kalan süreyi görüntüler.`,
            `• \`${p}dogumgunu liste\` — Sunucuda yaklaşan doğum günlerini sıralar.`,
            `• \`${p}dogumgunu sil\` — Kayıtlı doğum gününüzü sistemden siler.`,
            `• \`${p}tag <isim>\` — Sunucuya özel eklenmiş otomatik yanıtı çağırır.`,
            `• \`${p}ping\` — Bot gecikme süresini (ping) ve sistem çalışma durumunu gösterir.`,
            `• \`${p}davet\` — Botu kendi sunucunuza ekleme davet bağlantısını görüntüler (\`${p}invite\`).`,
            ``,
            `🗳️ **Etkileşimli Oylama & Çekiliş Katılımı:**`,
            `• Aktif anketlerde tepki emojilerine tıklayarak anında oy kullanabilirsiniz.`,
            `• Aktif çekilişlerde 🎉 tepkisine tıklayarak çekilişe katılabilirsiniz.`,
        ],
        // Page 2: OwO Sistemi, Ekonomi, Şans Oyunları, RPG & Sosyal Komutlar
        [
            `🐾 **OwO SİSTEMİ (Komutlar \`${p}owo\`, \`${p}uwu\` veya \`${p}w\` ile çalışır):**`,
            `• \`${p}owo\` / \`${p}uwu\` — Sevimli yüz ifadesi (tatlı tepki) gönderir.`,
            ``,
            `🏹 **Avcılık & Hayvanlar:**`,
            `• \`${p}owo hunt\` — Çalılıklardan 1-3 hayvan avlar, Cowoncy ve XP kazandırır (\`${p}owo h\`).`,
            `• \`${p}owo zoo\` — Yakaladığınız tüm hayvanları ve güç puanlarını listeler (\`${p}owo z\`).`,
            `• \`${p}owo sell <all/common/hayvan>\` — Hayvanlarınızı satarak Cowoncy kazandırır.`,
            ``,
            `💰 **Ekonomi, Mağaza & Kasa Açma:**`,
            `• \`${p}owo cash\` — Cowoncy bakiyenizi görüntüler (\`${p}owo bakiye\`).`,
            `• \`${p}owo daily\` — Günlük 1.000+ Cowoncy bonusunu alır (Her gün artan seri bonusu!).`,
            `• \`${p}owo give cash @üye <miktar>\` — Başka bir üyeye Cowoncy gönderir (\`${p}owo give @üye <miktar>\`).`,
            `• \`${p}owo shop\` — Mağazayı açar (Lootbox, Silah Sandığı, Şans Yüzüğü) (\`${p}owo market\`).`,
            `• \`${p}owo buy <ürün> [adet]\` — Mağazadan eşya satın alır (Örn: \`${p}owo buy lootbox 2\`).`,
            `• \`${p}owo inv\` — Envanter, kasa sayısı, kuşanılan silah ve evlilik durumunu gösterir.`,
            `• \`${p}owo open <lootbox/crate> [adet]\` — Kasa veya Sandık açar (Cowoncy, hayvan veya silah çıkar).`,
            ``,
            `🎲 **Kumar & Şans Oyunları:**`,
            `• \`${p}owo cf <miktar> <y/t>\` — Yazı Tura bahsi oynar (2 katı kazanç!) (\`${p}owo coinflip\`).`,
            `• \`${p}owo slots <miktar>\` — 3 çarklı slot makinesini çevirir (10x Jackpot!) (\`${p}owo s\`).`,
            `• \`${p}owo bj <miktar>\` — 21 Blackjack masasına oturur (\`hit\` / \`stand\`) (\`${p}owo blackjack\`).`,
            ``,
            `⚔️ **RPG, Savaş, Evlilik & Sosyal:**`,
            `• \`${p}owo battle\` — Canavarlarla savaşır, seviye atlar ve sandık düşürür (\`${p}owo savas\`).`,
            `• \`${p}owo team\` & \`${p}owo team set <h1 h2 h3>\` — 3 hayvanlık arena takımı kurar.`,
            `• \`${p}owo zoobattle @üye [bahis]\` — Hayvanat bahçesi arenasında 3 rauntluk düello yapar (\`${p}owo zb\`).`,
            `• \`${p}owo forge\` — Silahınızı demirhanede +5 seviyeye kadar geliştirir (\`${p}owo demirhane\`).`,
            `• \`${p}owo pray [@üye]\` — Dua eder, lütuf ve şans kazanır (\`${p}dua\`).`,
            `• \`${p}owo curse [@üye]\` — Uğursuz bir lanet okur (\`${p}lanet\`).`,
            `• \`${p}owo marry @üye\` — Şans Yüzüğü ile evlenir (Birlikte avlanmada +%15 XP & +%10 Cowoncy) (\`${p}evlen\`).`,
            `• \`${p}owo divorce\` — Boşanır (\`${p}bosan\`).`,
            `• \`${p}owo profile [@üye]\` — Detaylı OwO RPG istatistik kartını görüntüler (\`${p}owo profil\`).`,
            `• \`${p}owo top\` — Sunucudaki en zengin oyuncuların sıralaması (\`${p}owo zenginler\`).`,
            `• \`${p}remind [ac|kapat|durum]\` — Günlük ödül 24 saat dolunca bildirim hatırlatıcısı (\`${p}hatirlatici\`).`,
            `• \`${p}hug\`, \`${p}kiss\`, \`${p}slap\`, \`${p}pat\`, \`${p}cookie\` [@üye] — Sosyal etkileşim eylemleri.`,
        ],
        // Page 3: Jockie Müzik Sistemi & FFmpeg Ses Filtreleri
        [
            `🎵 **Jockie Müzik Sistemi & FFmpeg Ses Efektleri:**`,
            `🔊 **Ses Şartı:** Komutları kullanabilmek için bir ses kanalında olmalısınız. Bot otomatik olarak odanıza katılır.`,
            ``,
            `🎶 **Müzik Çalma & Çalma Listesi Kontrolleri:**`,
            `• \`${p}play <link / arama>\` — YouTube, Spotify, SoundCloud üzerinden müzik çalar (\`${p}p\`, \`${p}çal\`).`,
            `• \`${p}pause\` / \`${p}resume\` — Çalan parçayı duraklatır veya devam ettirir (\`${p}duraklat\`, \`${p}devam\`).`,
            `• \`${p}skip\` — Çalan parçayı atlayıp sıradakine geçer (\`${p}s\`, \`${p}geç\`).`,
            `• \`${p}stop\` — Çalmayı durdurur, kuyruğu sıfırlar ve ses kanalından ayrılır (\`${p}dur\`).`,
            `• \`${p}queue [sayfa]\` — Şarkı kuyruğunu ve sürelerini gösterir (\`${p}q\`, \`${p}kuyruk\`).`,
            `• \`${p}nowplaying\` — Çalan şarkı kartını ve ses kanalı bilgisini açar (\`${p}np\`, \`${p}çalan\`).`,
            `• \`${p}volume <0-200>\` — Ses düzeyini ayarlar (\`${p}vol\`, \`${p}ses\`).`,
            `• \`${p}loop [off/track/queue]\` — Tek parça veya tüm kuyruk döngüsünü ayarlar (\`${p}döngü\`).`,
            `• \`${p}shuffle\` — Kuyruktaki parçaları rastgele sıraya dizer (\`${p}karıştır\`).`,
            `• \`${p}radio [istasyon]\` — Kesintisiz canlı radyo yayınlarını başlatır (\`lofi\`, \`kralpop\`, \`fenomen\`, vb.).`,
            ``,
            `🎛️ **FFmpeg Ses Filtreleri (Anlık Efektler):**`,
            `• \`${p}filter <efekt>\` — Ses filtresi: \`bassboost\`, \`nightcore\`, \`vaporwave\`, \`8d\`, \`tremolo\`, \`speed\`, \`clear\``,
            `• \`${p}bassboost [low/med/high/off]\` — Bas artırımı uygular (\`${p}bass\`).`,
            `• \`${p}nightcore [on/off]\` — Hızlandırılmış tiz anime tonu (\`${p}nc\`).`,
            `• \`${p}vaporwave [on/off]\` — Slowed & reverb tonu (\`${p}slowed\`).`,
            `• \`${p}8d [on/off]\` — Kulaklıkta 360° dönen uzamsal ses efekti.`,
            `• \`${p}clearfilter\` — Tüm ses filtrelerini sıfırlar.`,
        ],
    ];
    const pageContent = pages[Math.max(0, Math.min(pageNum - 1, pages.length - 1))];
    const header = `📖 **Kyron — Kullanıcı Komut Rehberi** (Sayfa ${pageNum}/${total})`;
    const separator = '────────────────────────────────────────';
    const navLine = buildNavLine(pageNum, total);
    const footerNote = `💡 **Yönetici & Moderatörler:** Tüm yönetim ve sistem komutlarını görmek için \`${p}help admin\` kullanabilirsiniz.`;
    return [header, separator, ...pageContent, separator, navLine, footerNote].join('\n');
}
export function buildHelpComponents(pageNum, totalPages) {
    return [
        {
            type: 1, // ACTION_ROW
            components: [
                {
                    type: 2, // BUTTON
                    style: 2, // SECONDARY (Gray)
                    custom_id: 'help_prev',
                    label: 'Önceki',
                    emoji: { name: '◀️' },
                    disabled: pageNum <= 1,
                },
                {
                    type: 2, // BUTTON
                    style: 2, // SECONDARY (Gray)
                    custom_id: 'help_next',
                    label: 'Sonraki',
                    emoji: { name: '▶️' },
                    disabled: pageNum >= totalPages,
                },
            ],
        },
    ];
}
export async function handleHelpCommand(ctx, activeHelpSessions, addHelpReactions) {
    const { commandName, args, invoker, guild, message, api, helpers } = ctx;
    if (commandName !== 'help' && commandName !== 'yardim') {
        return false;
    }
    const firstArg = (args[0] || '').toLowerCase();
    const secondArg = (args[1] || '').toLowerCase();
    // Admin / Moderatör yardım menüsü talebi
    const isAdminRequest = firstArg === 'admin' ||
        firstArg === 'yonetici' ||
        firstArg === 'yonetim' ||
        firstArg === 'mod' ||
        firstArg === 'moderasyon' ||
        firstArg === 'security' ||
        firstArg === 'güvenlik' ||
        firstArg === 'guvenlik';
    if (isAdminRequest) {
        const hasPerm = PermissionService.isModeratorOrAdmin(guild, invoker);
        if (!hasPerm) {
            await helpers.sendAutoExpiringMessage(message.channel_id, '❌ **Yetki Yetersiz:** `/help admin` komutunu yalnızca **Sunucu Sahibi**, **Yöneticiler** ve **Moderatörler** görüntüleyebilir.', 6, message.id);
            return true;
        }
        let pageNum = 1;
        let targetArg = secondArg;
        if (firstArg === 'mod' || firstArg === 'moderasyon') {
            pageNum = 1;
        }
        else if (firstArg === 'security' || firstArg === 'güvenlik' || firstArg === 'guvenlik') {
            pageNum = 2;
        }
        else if (targetArg) {
            if (/^[1-5]$/.test(targetArg)) {
                pageNum = Number.parseInt(targetArg, 10);
            }
            else if (targetArg === 'mod' ||
                targetArg === 'moderasyon' ||
                targetArg === 'ceza' ||
                targetArg === 'ban' ||
                targetArg === 'mute' ||
                targetArg === 'kick' ||
                targetArg === 'clear' ||
                targetArg === 'warn') {
                pageNum = 1;
            }
            else if (targetArg === 'security' ||
                targetArg === 'güvenlik' ||
                targetArg === 'guvenlik' ||
                targetArg === 'koruma' ||
                targetArg === 'antispam' ||
                targetArg === 'antilink' ||
                targetArg === 'antiraid' ||
                targetArg === 'badwords' ||
                targetArg === 'kufur') {
                pageNum = 2;
            }
            else if (targetArg === 'rol' ||
                targetArg === 'role' ||
                targetArg === 'autorole' ||
                targetArg === 'otorol' ||
                targetArg === 'welcome' ||
                targetArg === 'hosgeldin' ||
                targetArg === 'goodbye' ||
                targetArg === 'modlog' ||
                targetArg === 'botkanal' ||
                targetArg === 'kanal') {
                pageNum = 3;
            }
            else if (targetArg === 'topluluk' ||
                targetArg === 'seviye' ||
                targetArg === 'level' ||
                targetArg === 'dogumgunu' ||
                targetArg === 'anket' ||
                targetArg === 'poll' ||
                targetArg === 'cekilis' ||
                targetArg === 'giveaway' ||
                targetArg === 'tag') {
                pageNum = 4;
            }
            else if (targetArg === 'music' ||
                targetArg === 'muzik' ||
                targetArg === 'jockie' ||
                targetArg === 'sarki' ||
                targetArg === 'filter' ||
                targetArg === 'owo' ||
                targetArg === 'uwu' ||
                targetArg === 'w' ||
                targetArg === 'oyun' ||
                targetArg === 'rpg' ||
                targetArg === 'ekonomi') {
                pageNum = 5;
            }
        }
        const helpContent = buildHelpPage(pageNum, 'admin');
        const components = buildHelpComponents(pageNum, HELP_ADMIN_TOTAL_PAGES);
        let sentMsg = null;
        try {
            sentMsg = await api.sendMessage(message.channel_id, helpContent, { components });
        }
        catch {
            sentMsg = await api.sendMessage(message.channel_id, helpContent);
        }
        if (sentMsg?.id) {
            activeHelpSessions.set(message.channel_id, {
                messageId: sentMsg.id,
                channelId: message.channel_id,
                currentPage: pageNum,
                userId: invoker.user.id,
                createdAt: Date.now(),
                mode: 'admin',
            });
            // Also add reaction emoji buttons
            void addHelpReactions(message.channel_id, sentMsg.id);
        }
        return true;
    }
    // Standart Kullanıcı Help Komutu (/help)
    let pageNum = 1;
    if (/^[1-3]$/.test(firstArg)) {
        pageNum = Number.parseInt(firstArg, 10);
    }
    else if (firstArg === 'level' ||
        firstArg === 'leveling' ||
        firstArg === 'rank' ||
        firstArg === 'seviye' ||
        firstArg === 'xp' ||
        firstArg === 'topxp' ||
        firstArg === 'afk' ||
        firstArg === 'dogumgunu' ||
        firstArg === 'topluluk' ||
        firstArg === 'tag' ||
        firstArg === 'ping' ||
        firstArg === 'davet') {
        pageNum = 1;
    }
    else if (firstArg === 'owo' ||
        firstArg === 'uwu' ||
        firstArg === 'w' ||
        firstArg === 'oyun' ||
        firstArg === 'rpg' ||
        firstArg === 'ekonomi' ||
        firstArg === 'hunt' ||
        firstArg === 'zoo' ||
        firstArg === 'cash' ||
        firstArg === 'daily' ||
        firstArg === 'shop' ||
        firstArg === 'kumar' ||
        firstArg === 'sosyal') {
        pageNum = 2;
    }
    else if (firstArg === 'music' ||
        firstArg === 'muzik' ||
        firstArg === 'jockie' ||
        firstArg === 'sarki' ||
        firstArg === 'filter' ||
        firstArg === 'play' ||
        firstArg === 'ses') {
        pageNum = 3;
    }
    const helpContent = buildHelpPage(pageNum, 'user');
    const components = buildHelpComponents(pageNum, HELP_USER_TOTAL_PAGES);
    let sentMsg = null;
    try {
        sentMsg = await api.sendMessage(message.channel_id, helpContent, { components });
    }
    catch {
        sentMsg = await api.sendMessage(message.channel_id, helpContent);
    }
    if (sentMsg?.id) {
        activeHelpSessions.set(message.channel_id, {
            messageId: sentMsg.id,
            channelId: message.channel_id,
            currentPage: pageNum,
            userId: invoker.user.id,
            createdAt: Date.now(),
            mode: 'user',
        });
        // Also add reaction emoji buttons
        void addHelpReactions(message.channel_id, sentMsg.id);
    }
    return true;
}
//# sourceMappingURL=helpCommands.js.map