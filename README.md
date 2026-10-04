# ⚡ Kortex — Profesyonel Yönetim, Moderasyon, Müzik, OwO ve Topluluk Botu

Micup (Fluxer) mesajlaşma ve topluluk platformu için özel olarak geliştirilmiş kurumsal düzeyde **Yönetim, Güvenlik, Jockie Müzik, Prosedürel Kart Tasarımı, Seviye (Leveling) ve OwO Ekonomi Botu**.

Bu bot, Fluxer'ın yerleşik WebSocket Gateway (`v1`) ve REST API mimarisiyle %100 uyumlu, katı rol hiyerarşisi denetimlerine, sunucu bazlı SQLite veritabanı yalıtımına (`node:sqlite`) ve modern mikro animasyonlu görsel oluşturma motoruna (`@napi-rs/canvas`) sahiptir.

---

## 🌟 Öne Çıkan Başlıca Sistemler

### 🎨 1. Prosedürel Karşılama & Uğurlama Kart Tasarım Sistemi
- **Tamamen Komutlarla Kişiselleştirilebilir:** Web paneline ihtiyaç duymadan doğrudan sohbetten renk, logo ve metin tasarımı.
- **Yapay Işıksız Doğal & Modern Estetik:** Logonun üzerinde parlayan yapay çemberler kaldırılmış; derin doğal gölgeler ve şık sibernetik hatlar eklenmiştir.
- **Gelişmiş Değişken Desteği:** `{user}`, `{username}`, `{id}`, `{server}`, `{memberCount}`, `{date}`.
- **Topluluk Logosu Entegrasyonu:** Özel sunucu logosu URL'si, base64 verisi veya varsayılan bot logosu desteği.

### 🎵 2. Jockie Müzik Sistemi & Stüdyo Ses İşleme Pipeline'ı
- **Kanal Kısıtlaması Yok:** Müzik komutları ses kanalında olduğunuz sürece herhangi bir metin kanalında kısıtlama olmaksızın serbestçe kullanılabilir.
- **Zengin Kaynak Desteği:** YouTube, Spotify, SoundCloud, Apple Music, Deezer ve Doğrudan Ses Akışları (`.mp3`, `.m4a`, `.aac`, `.flac`, `.ogg`).
- **Kesintisiz Canlı Radyo İstasyonları:** Power FM, Kral Pop, Slow Türk, Virgin Radio, Lofi Hip Hop, Chillout, Retro Synthwave, Radyo Fenomen.
- **Micup "Özel" Ses İşleme Mimarisi:**
  - **Bas-Konuş: KAPALI:** WebRTC `dtx: false` ile sürekli, kesintisiz ve yüksek sadakatli 20ms ses çerçevesi yayını.
  - **Ağ Dayanıklılığı:** Paket kayıplarını engelleyen `red: true` (Redundant Audio Data) desteği.
  - **Yüksek Çözünürlüklü Kodlama:** 128 kbps stereo stüdyo kalitesinde ses akışı (`AudioEncoding`).
  - **Otomatik Kazanç Kontrolü (AGC) & Limiter:** `alimiter=limit=0.95:attack=5:release=50:asc=1` entegrasyonu sayesinde ses düzeyini dinamik dengeler; müzik kısık kalmaz ve bas artışında dijital kırılma (clipping) yaşanmaz.
- **Anında 0ms Filtre & Bass Geçişi (Kesintisiz Hot-Swap):** Çözülen akış adresleri bellekte önbelleğe alınır (`streamUrlCache`). Müzik çalarken `/bassboost` veya `/filter` değiştirildiğinde 5 saniyelik ağ beklemesi ve donma olmadan, yeni filtrelenmiş akışa milisaniyeler içinde kesintisiz geçilir.
- **FFmpeg Efektleri:** `bassboost` (low/medium/high/extreme), `nightcore`, `vaporwave` (slowed & reverb), `8d` uzamsal ses, `tremolo`, `speed`.
- **Gelişmiş Kuyruk Yönetimi:** Şarkıyı hemen çalma (`/playnow`), sıraya ekleme (`/playnext`), sıradaki şarkıya atlama (`/skipto`), karıştırma (`/shuffle`), döngü modları (`/loop`), ses konumu atlama (`/seek`).

### 🛡️ 3. Kurumsal Düzeyde Güvenlik & Moderasyon
- **Rol Hiyerarşisi & Owner Koruması:** Sunucu sahibine ve üst yetkililere ceza uygulanamaz.
- **Anti-Spam (Hızlı Mesaj Koruması):** Belirlenen sürede aşırı mesaj atan kullanıcıları otomatik susturur (Yetkililere ceza yerine uyarı bildirimi gönderir).
- **Anti-Link (Reklam & Davet Koruması):** İzin verilmeyen bağlantıları otomatik siler; beyaz liste desteği (`/antilink whitelist`).
- **Gelişmiş Küfür & Argo Filtresi:** Leetspeak, sansürlü harfler, Türkçe karakter değişimleri ve boşluklu yazımları yakalayan akıllı normalizasyon.
- **Anti-Raid (Akın Koruması):** 10 saniyede sunucuya katılan ani bot hesap akınlarını algılayarak otomatik atar (kick/timeout).
- **Mass Mention & Capslock:** `@everyone` / toplu etiketleme ve aşırı büyük harfle bağırma engelleme.
- **Denetim Kayıtları (`/modlogs`):** Tüm ban, kick, mute, warn hareketlerini SQLite veri tabanından anlık sorgulama.

### 📈 4. Metin & Ses Seviye (XP) Sistemi
- **Doğal Katılım Odaklı:** Sohbet mesajları ve ses kanallarında geçirilen aktif süreye göre XP kazanımı.
- **AFK / Sağırlaştırma Önlemi:** Kendi kendini sağırlaştıran (self-deaf) kullanıcılara ses XP'si verilmez.
- **Otomatik Seviye Rolleri (`/levelrole`):** Belirli seviyelere (örn. Lv 5, Lv 10) ulaşıldığında otomatik rol atama ve geri alma.
- **Görsel Profil & Sıralama Kartı:** `/rank` ve `/topxp` ile sunucu liderlik tablosu.

### 🎮 5. OwO Ekonomi, RPG & Hatırlatıcı Sistemi
- **Avcılık & Hayvanat Bahçesi:** `/w hunt`, `/w zoo`, `/w sell`.
- **Ekonomi & Kumar:** `/w cash`, `/w daily`, `/w coinflip`, `/w slots`, `/w blackjack`, `/w give`.
- **Otomatik Silinen Günlük Hatırlatıcı:** `/remind daily [on/off]` (veya `/hatirlatici`) açılıp kapandığında gelen bildirim ve tetikleyici komut sohbeti kirletmemek için 5 saniye sonra otomatik silinir.
- **RPG & Sosyal:** `/w battle`, `/w pray`, `/w curse`, `/w profile`, `/w hug/kiss/slap/cookie`.

### 🎁 6. Çekiliş, Anket, AFK, Özel Tag ve Doğum Günü
- **Etkileşimli Butonlu Çekiliş:** `/giveaway start <süre> <kazanan> <ödül>`, anlık katılımcı sayaçlı butonlar, otomatik kazanan belirleme ve reroll.
- **Oylama / Anket:** `/poll <soru> [| seçenek1 | seçenek2...]`.
- **AFK Sistemi:** `/afk [sebep]`. Biri etiketlediğinde bot bilgi verir, kullanıcı konuştuğunda otomatik uyanır.
- **Özel Komutlar / Auto-Responder:** `/tag add <isim> <yanıt>` (örn: `!dc` veya `!kurallar`).
- **Doğum Günü Kutlama:** `/dogumgunu ayarla <gün> <ay>`, her gün otomatik kutlama mesajı.

### ⚡ 7. %100 Komut Odaklı Bağımsız Mimari (Sıfır Web Bağımlılığı)
- **Tüm Ayarlar Sohbette:** Kart tasarımları (`/welcome`, `/goodbye`), sistem kanalları (`/botkanal`), seviye rolleri (`/levelrole`), güvenlik eşikleri ve çekilişler doğrudan sohbet komutlarıyla anında yönetilir.
- **Maksimum Güvenlik:** Dış ağa açık gereksiz HTTP portları veya web paneli oturum açıkları bulunmaz; bot tamamen izole, hızlı ve güvenli şekilde çalışır.

---

## 🏗️ Proje Mimarisi

```
Kortex-BOT/
├── src/
│   ├── api/                  # Micup REST API İstemcisi
│   │   └── MicupApiClient.ts
│   ├── assets/               # Statik Medya (logo.png)
│   ├── commands/             # Komut Yönlendirici & Yardım Sayfaları
│   │   └── CommandHandler.ts
│   ├── config/               # Sabitler & Ortam Değişkenleri
│   │   ├── constants.ts
│   │   └── env.ts
│   ├── database/             # node:sqlite Veri Tabanı İstemcisi
│   │   └── DatabaseClient.ts
│   ├── gateway/              # WebSocket Gateway v1 İstemcisi
│   │   └── GatewayClient.ts
│   ├── locales/              # i18n Çoklu Dil Sözlükleri (TR/EN)
│   ├── services/             # İş Mantığı Modülleri
│   │   ├── AntiLinkService.ts
│   │   ├── AntiRaidService.ts
│   │   ├── AntiSpamService.ts
│   │   ├── BadWordsService.ts
│   │   ├── BirthdayService.ts
│   │   ├── CommunityService.ts
│   │   ├── GiveawayService.ts
│   │   ├── LevelingService.ts
│   │   ├── ModerationService.ts
│   │   ├── ModLogService.ts
│   │   ├── MusicService.ts
│   │   ├── OwoLevelCardGenerator.ts
│   │   ├── OwoService.ts
│   │   ├── PermissionService.ts
│   │   ├── RoleService.ts
│   │   ├── WarnService.ts
│   │   ├── WelcomeCardGenerator.ts
│   │   └── WelcomeGoodbyeService.ts
│   ├── types/                # TypeScript Tip Tanımları (fluxer.ts, music.ts)
│   ├── utils/                # Güvenlik & Yardımcı Fonksiyonlar (security.ts)
│   ├── voice/                # LiveKit RTC Web Ses Bağlantısı
│   │   └── MicupVoiceClient.ts
│   └── index.ts              # Ana Başlatıcı
├── tests/                    # Vitest Kapsamlı Test Süitleri (16 dosya, 145 test)
├── data/                     # SQLite Veri Tabanı & Otomatik Yedekler
├── package.json
└── tsconfig.json
```

---

## 🚀 Kurulum ve Çalıştırma

### Gereksinimler
- **Node.js**: `v22.0.0` veya üzeri (yerleşik `node:sqlite` desteği için gereklidir).
- **FFmpeg**: Yerel ortamda yüklü değilse bile `ffmpeg-static` paketi otomatik devreye girer.

### 1. Bağımlılıkları Yükleme
```bash
npm install
```

### 2. Ortam Değişkenlerini Ayarlama (`.env`)
Kök dizindeki `.env` dosyasını oluşturun veya düzenleyin:
```env
BOT_TOKEN=1553891682385133568.gizli_bot_tokeniniz
MICUP_API_URL=http://127.0.0.1:3000/api/v1
MICUP_GATEWAY_URL=
DATABASE_PATH=./data/micup_bot.db
DEFAULT_LANGUAGE=tr
COMMAND_PREFIX=/
```

### 3. Botu Başlatma
```bash
# Geliştirme modu (otomatik dosya takibi)
npm run dev

# Prodüksiyon derlemesi ve başlatma
npm run build
npm start
```

### 4. Testleri Çalıştırma
```bash
npx vitest run
```

---

## 📋 Detaylı Komut Rehberi

### 🎨 Kart Tasarım Komutları
| Komut | Açıklama |
| :--- | :--- |
| `/welcome renk <#hex>` | Hoş geldin kartının ana temasını / arka plan rengini değiştirir (Örn: `/welcome renk #8b5cf6`). |
| `/welcome vurgu <#hex>` | Hoş geldin kartının ikincil neon vurgu rengini ayarlar (Örn: `/welcome vurgu #ec4899`). |
| `/welcome baslik <metin>` | Kartta avatarın üzerinde yer alan alt başlığı ayarlar. |
| `/welcome slogan <metin>` | Kartın alt kısmındaki slogan metnini belirler. |
| `/welcome logo <url>` | Kartın sağ tarafında yer alacak sunucu logosunun bağlantısını ayarlar. |
| `/welcome test` | Ayarlanan tasarımı kanala gerçek PNG kartı olarak gönderip test eder. |
| `/welcome sifirla` | Hoş geldin kart tasarımını varsayılan ayarlara döndürür. |
| `/welcome durum` | Aktif kart renklerini ve ayarlarını listeler. |
| `/goodbye [renk\|vurgu\|baslik\|slogan\|logo\|test\|sifirla\|durum]` | Görüşürüz kartının tasarımını aynı şekilde özelleştirir. |
| `/kart-tasarim [durum\|sifirla]` | Her iki kartın tasarım durumunu topluca görüntüler veya sıfırlar. |

---

### 🔨 Moderasyon & Ceza Komutları
| Komut | Açıklama |
| :--- | :--- |
| `/ban @üye [sebep]` | Üyeyi sunucudan yasaklar (Hiyerarşi ve yetki kontrolü yapılır). |
| `/unban <ID veya İsim#Tag>` | Kullanıcının yasağını kaldırır (Snowflake ID, Tag veya Kullanıcı Adı ile arama). |
| `/kick @üye [sebep]` | Üyeyi sunucudan atar. |
| `/timeout @üye <süre> [sebep]` | Kullanıcıyı susturur (Örn: `10m`, `1h`, `1d`). Kısayol: `/mute`. |
| `/untimeout @üye` | Kullanıcının susturmasını kaldırır. Kısayol: `/unmute`. |
| `/timeout status [@üye]` | Kalan ceza süresini görüntüler. Kısayol: `/muteinfo`. |
| `/modlogs [@üye]` | Sunucudaki veya belirli bir üyenin tüm ceza ve denetim geçmişini listeler (`/denetim-kayitlari`). |
| `/clear <1-100>` | Belirtilen sayıda mesajı topluca siler. |
| `/clear user @üye <1-100>` | Yalnızca belirtilen kullanıcının mesajlarını siler. |
| `/warn @üye [sebep]` | Resmi uyarı verir (3: 10m mute, 5: 1h mute, 7: kick, 10: ban kademeli yaptırımı). |
| `/warnings [@üye]` | Aktif uyarıları listeler. |
| `/warn remove @üye [ID/adet]` | Verilen uyarıyı iptal eder. |

---

### 🛡️ Güvenlik Komutları
| Komut | Açıklama |
| :--- | :--- |
| `/modlog channel #kanal` | Ban, kick, mute, warn hareketlerinin gönderileceği log kanalını ayarlar. |
| `/antispam on/off/messages/interval` | Hızlı mesaj selini engelleyen spam filtresini yönetir. |
| `/antilink on/off/whitelist` | Reklam ve bağlantı filtresi; izin verilecek domainleri ekleme/çıkarma. |
| `/badwords on/off/add/remove/list` | Akıllı küfür ve argo filtresi (leetspeak korumalı). |
| `/antiraid on/off/limit/action` | Ani bot hesap akınlarına karşı kilit ve koruma eşiği. |
| `/massmention on/off/limit` | `@everyone` ve toplu etiketleme engeli. |
| `/capslock on/off/percentage` | Aşırı büyük harfle yazma filtresi (Örn: `/capslock oran 70`). |

---

### 🤖 Sistem Kanalları Yapılandırması (`/botkanal`)
| Komut | Açıklama |
| :--- | :--- |
| `/botkanal durum` | Tüm sistem kanallarının güncel durumunu listeler. |
| `/botkanal #kanal` veya `/botkanal 1 #kanal` | 1. Genel bot komut kanalını ayarlar. |
| `/botkanal 2 #kanal` | 2. Genel bot komut kanalını ayarlar (Yönetici yetkisi gerektirir). |
| `/botkanal owo #kanal` (veya `/owokanal #kanal`) | OwO ekonomi komutlarının geçerli olacağı kanalı sınırlar. |
| `/botkanal level #kanal` | Seviye atlama tebrik bildirimlerinin gideceği kanalı ayarlar. |
| `/botkanal cekilis #kanal` | Çekiliş duyurularının yapılacağı kanalı ayarlar. |
| `/botkanal oylama #kanal` | Oylama ve anket kanalını ayarlar. |
| `/botkanal sil [1\|2\|owo\|level\|cekilis\|oylama\|hepsi]` | Belirtilen kanal kısıtlamasını sıfırlar. |

---

### 🎵 Müzik & Radyo Komutları
| Komut | Açıklama |
| :--- | :--- |
| `/play <link / arama>` | YouTube, Spotify veya arama teriminden şarkı çalar (`/p`). |
| `/playnow <link / arama>` | Kuyruğu beklemeden şarkıyı anında çalar (`/calhemen`). |
| `/playnext <link / arama>` | Şarkıyı kuyruğun hemen başına (sıradaki şarkı olarak) ekler. |
| `/pause` / `/resume` | Parçayı duraklatır veya devam ettirir. |
| `/skip` / `/skipto <sıra>` | Parçayı atlar veya kuyruktaki belirli bir parçaya geçer. |
| `/queue [sayfa]` | Şarkı listesini ve kalan süreleri gösterir (`/q`). |
| `/nowplaying` | Çalan parça kartını açar (`/np`). |
| `/volume <0-200>` | Ses seviyesini doğal akustik ölçekleme ile ayarlar (`/vol`). |
| `/loop [off/track/queue]` | Tek parça veya tüm kuyruk döngüsünü ayarlar. |
| `/shuffle` | Kuyruktaki parçaları karıştırır. |
| `/radio <istasyon>` | Canlı radyo yayını başlatır (`lofi`, `kralpop`, `powerfm`, `slowturk`, `virgin`, `chill`, `retro`, `fenomen`). |
| `/filter <efekt>` | Anlık FFmpeg ses efekti uygular (`bassboost`, `nightcore`, `vaporwave`, `8d`, `clear`). |
| `/stop` | Müziği durdurur, kuyruğu temizler ve kanaldan ayrılır. |

---

### 📈 Seviye & Topluluk Komutları
| Komut | Açıklama |
| :--- | :--- |
| `/rank [@üye]` | Seviye kartınızı, XP miktarınızı ve ses/mesaj istatistiğinizi gösterir (`/level`). |
| `/topxp` | Sunucudaki en yüksek seviyeli üyeleri listeler (`/leaderboard`). |
| `/levelrole add <seviye> <@rol>` | Belirtilen seviyeye ulaşıldığında verilecek rolü ayarlar (`/levelrol`). |
| `/levelrole remove <seviye>` | Seviye rolünü kaldırır. |
| `/afk [sebep]` | AFK moduna geçer. Biri sizi etiketlerse bot bilgi verir. |
| `/giveaway start <süre> <kazanan> <ödül>` | Katılma butonlu otomatik çekiliş başlatır (`/cekilis`). |
| `/giveaway reroll <mesaj_id>` | Biten çekilişten yeni kazanan seçer. |
| `/poll <soru> [\| seçenek1 \| seçenek2...]` | Çoktan seçmeli veya Evet/Hayır anketi başlatır (`/anket`). |
| `/tag add <isim> <yanıt>` | Sunucuya özel otomatik yanıt / komut ekler (`!isim`). |
| `/dogumgunu ayarla <gün> <ay>` | Doğum gününüzü kaydeder; günü geldiğinde kutlama mesajı yayınlar. |
| `/davet` | Botu diğer sunucularınıza eklemek için yetkilendirme linki verir. |

---

### 🐾 OwO Ekonomi & RPG Komutları
Tüm OwO komutları `/w <komut>` veya `/remind` şeklinde kullanılabilir:
- **Günlük Ödül & Hatırlatıcı:** `/w daily` ile günlük ödülü alın. `/remind daily [on/off]` (veya `/hatirlatici`) ile 24 saat sonra DM'den bildirim alın (5 saniyede otomatik temizlenen mesajlarla).
- **Avcılık & Satış:** `/w hunt`, `/w zoo`, `/w sell <hepsi/hayvan>`.
- **Ekonomi & Transfer:** `/w cash [@üye]`, `/w give cash @üye <miktar>`.
- **Kumar & Şans:** `/w cf <miktar> <h/t>`, `/w slots <miktar>`, `/w bj <miktar>`.
- **RPG Savaş & Dua:** `/w battle`, `/w pray [@üye]`, `/w curse [@üye]`.
- **Mağaza & Envanter:** `/w shop`, `/w buy <id>`, `/w inv`, `/w open <lootbox/crate>`.

---

## 🔒 Güvenlik İlkeleri & Veri Bütünlüğü

1. **Katı Rol Hiyerarşisi:** Yetkililer yalnızca kendilerinden daha alt rollere sahip üyelere yaptırım uygulayabilir. Sunucu sahibine hiçbir işlem uygulanamaz.
2. **Çoklu Sunucu (Multi-Guild) İzolasyonu:** Her sunucunun verileri bağımsız SQLite tablolarında tutulur; sunucular arası veri sızıntısı imkansızdır.
3. **Parametreli SQL Sorguları:** Tüm veri tabanı sorguları `?` parametreleri ve izin verilen sütun adları beyaz listesi ile çalışır; SQL Injection açığı bulunmaz.
4. **Hafıza & Disk Sızıntısı Koruması:** Bellek içi önbellekler periyodik çöp toplayıcı (GC) ile temizlenir; veri tabanı yedekleri en son 5 kopyayla sınırlandırılarak disk şişmesi engellenir.
5. **Token Gizliliği:** Bot tokenları konsola veya loglara yazdırılırken `maskToken()` ile otomatik gizlenir.

---

## 📄 Lisans
Bu proje **AGPL-3.0-or-later** lisansı altında geliştirilmektedir.
