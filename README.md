# KHLike v2 — UYCEP Logic sınıf yarışması platformu

Sınıf içi (ve Zoom/Jitsi üzerinden uzaktan katılan) öğrencilerin aynı bağlantıdan girdiği,
akıllı tahtada sahnelenen çoktan seçmeli yarışma motoru. Aynı motor her hafta **başka bir
set** ile açılır ve set kendi temasıyla geldiği için öğrenciye **yeni bir oyun** gibi görünür.

```
npm install
npm test          # çekirdek senaryo testi
npm start         # http://localhost:3000   ·   /teacher   ·   /screen
```

Yerel şifre varsayılanı: `uycep-local` (sunucu açılışta konsola basar).
`.env` ya da `ADMIN_PASSWORD` ortam değişkeniyle değiştirilebilir.

**Render:** Build `npm install` · Start `npm start` · Environment sekmesinde `ADMIN_PASSWORD`
**zorunlu** (tanımlı değilse /teacher kapalı kalır).

---

## Üç ekran

| Rota | Kim | Ne yapar |
|---|---|---|
| `/` | **Öğrenci** (telefon/tablet) | Öğretmeni bekler → isim kartına dokunur → soru, mini oyun, kişisel sonuç, sıralama, final |
| `/screen` | **Akıllı tahta** | Lobi baloncukları, soru + cevaplayan sayacı, son 3 saniye gerilimi, şık dağılım grafiği, İlk 5, final podyumu + konfeti |
| `/teacher` | **Öğretmen** | Akordeon panel: Canlı Oyun → Sonuçlar → Soru Bankası → Ayarlar → Öğrenci Listesi |

Öğrenci **isim yazmaz, grup seçmez, oda kodu girmez.** Oturumun grubu öğretmenin seçtiği
setten gelir; öğrenci yalnız kendi grubunun isim kartlarını görür.

### Dosya düzeni

```
public/
  common/   base.css · theme.js (set paleti → CSS değişkenleri) · fx.js (ambiyans, konfeti, ses) · ui.js
  student/  index.html · style.css · app.js (socket) · screens.js (çizim) · mini.js (bekleme oyunları) · mod.js (format yüzü)
  screen/   index.html · style.css · app.js (socket) · sahne.js (çizim) · mod.js (format yüzü)
  teacher/  index.html · style.css · app.js (çatı) · canli.js · mod.js · sonuclar.js · banka.js · liste.js
  sounds/   lobby · question · results · correct · wrong (.mp3)
```

**Kural:** Ekranlar mantık içermez. `lib/core.js` ve `server.js` değiştirilmeden yazıldılar;
hiçbir ekran puan hesaplamaz, süre kararı vermez, doğru cevabı bilmez. Her ekran yalnız
`PROTOKOL.md`'deki olayları gönderir ve gelen durumu çizer.

---

## Oyun akışı

```
BOSTA ──set_sec──▶ LOBI ──oyunu_baslat──▶ SORUDA ⇄ SORU_ARASI ──final──▶ FINAL ──rapor──▶ RAPOR
                                              │
                                    (siradaki / soru_baslat)

  ▲                        🛑 Etkinliği Bitir  (her durumdan, onaylı)                        │
  └──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Grup = setin grubu

Panelde **elle grup seçici yoktur.** Oturumun grubu daima seçili setin `grup` alanından gelir
ve üst şeritte rozet olarak görünür (🌱 E Grubu / 🚀 İ Grubu …). Grubu değiştirmenin yolu
başka bir set açmaktır. *Karma oturum* açılırsa rozet 🎲 Karma olur ve öğrenci giriş ekranında
kendi grubunu seçer.

### 🛑 Etkinliği Bitir

Panelin üst şeridinde, **her durumda görünen** kırmızı ve onay soran tek düğme. Etkinliği
kapatır, oturumun puanlarını ve kayıtlarını siler, öğrencileri giriş ekranına döndürür ve
BOSTA'ya döner. Oturumda indirilmemiş kayıt varsa onay kutusu bunu ayrıca uyarır.

**Set seçici her durumda görünür** ama yalnız BOSTA ve LOBI'de kullanılabilir; oyun başladıktan
sonra pasifleşir ve altında *"Set değiştirmek için önce 🛑 Etkinliği Bitir"* ipucu belirir.
Set değiştirmenin (ve dolayısıyla grup değiştirmenin) tek yolu budur.

1. **BOSTA** — Öğrenci ekranında ortam animasyonlu "Öğretmenini bekle" (sayaç yok).
   Öğretmen panelden set seçer → *Etkinliği Aç*.
2. **LOBI** — Öğrenci ekranı kendiliğinden isim kartlarına döner. Seçilen isim soluklaşır
   ve **🎮 oyunda** rozeti alır (öğretmen panelden *Serbest* diyerek boşa çıkarabilir).
   Sahnede isimler baloncuk olarak birikir.
3. **SORUDA** — Soru + şıklar herkeste. Öğrenci ekranında arka plan animasyonu **yoktur**.
   Cevap veren "Kilitlendi ✓" görür ve bekleme mini oyunu açılır. Sahnede cevaplayan
   sayacı ve son 3 saniyede 3-2-1 gerilimi.
   Süre dolunca **ya da herkes cevaplayınca** soru kapanır.
4. **SORU_ARASI** — Öğrencide kişisel sonuç (doğru/yanlış animasyonu, sayaç animasyonlu
   puan, sıra, seri 🔥, öndekiyle fark, rozetler, doğru cevap + açıklama).
   Sahnede şık dağılım grafiği + doğru şık + İlk 5.
5. **Sıralama sahnesi** (isteğe bağlı, üç aşamalı) — aşağıda.
6. **FINAL** — 3 → 2 → 1 sırayla beliren podyum, konfeti, zafer sesi. Podyum dışındakiler
   kendi özetini görür (sıra, puan, en uzun seri, rozetler).
7. **RAPOR** — CSV/karne indirilir, sonra üst şeritteki *🛑 Etkinliği Bitir* ile oturum kapanır.

**Geç katılım:** Oyun sürerken giren öğrenci "Oyun sürüyor — adını seç ve katıl" ekranını
görür, aktif soruya dahil olur ve panelde **⏩ geç katıldı** işaretlenir.

**Kopan bağlantı:** Cihaz kimliği `localStorage`'da saklanır; sayfa yenilendiğinde ya da
bağlantı koptuğunda aynı isimle otomatik girilir, puan/sıra/seri aynen devam eder. Kopan
öğrenci panelde **🔴 çevrimdışı** işaretlenir ama listeden ve sıralamadan **silinmez**.

---

## Sıralama gösterimi (üç aşamalı, öğretmen onaylı)

1. **HAZIRLIK** — *Sıralamayı Göster* + çekilme süresi (5/10/20/30 sn). Her öğrenci ekranında
   geri sayım ve büyük bir **"Sıralamamı görmek istemiyorum 🙈"** düğmesi.
2. **ONAY** — Süre bitince panelde kaç kişinin çekildiği görünür; **otomatik gönderilmez**,
   öğretmen kapsam ve isim modunu seçip *Gönder* der.
   * Kapsam: *Yalnız kendi ayrıntısı* (varsayılan) / *Tam liste*
   * İsim modu: *İsimler Açık* / *İsimler Gizli*
3. **GÖSTERİM** — Çekilmeyen kendi sırasını (veya tam listeyi) görür; çekilenin adı isimli
   listede **🎭** olarak maskelenir, sıra yeri korunur. Kimin çekildiği diğer öğrencilere
   hiçbir şekilde belli edilmez.

**"Sıralamayı Gizle"** ayrı bir düğmedir: o tur podyum sahnesi dahil hiçbir sıralama
gösterilmez (hassas günler / p-e grupları için).

---

## Öğretmen kısayolları

Panel odaktayken (bir metin kutusuna yazarken ve modal açıkken devre dışıdır):

| Tuş | İşlev |
|---|---|
| `Boşluk` | Duraklat / Devam |
| `→` | LOBI'de oyunu başlat · SORU_ARASI'nda sıradaki soru |
| `E` | Soruyu bitir (süreyi beklemeden) |
| `+` | Süreye +10 sn ekle |
| `S` | Sıralama sürecini başlat |
| `F` | Finali göster |

*🛑 Etkinliği Bitir'in kısayolu bilerek yoktur* — yıkıcı olduğu için yalnız düğmeyle ve onayla çalışır.

**Düğme renk kodu:** yeşil = başlat/devam · sarı = duraklat · kırmızı = bitir/iptal/sıfırla
(onay sorulu, diğerlerinden uzağa yerleştirilmiş) · mavi-gri = bilgi/gezinme.
Her düğmede renkle birlikte ikon ve metin bulunur.

---

## Oyun formatları (mod katmanı)

Set seçicinin hemen altında **Oyun formatı** seçicisi vardır; yalnız BOSTA ve LOBI'de
değiştirilebilir (oyun başlayınca pasifleşir, gerekçesi altında yazar). Soru motoru, puanlama
ve kayıt şeması hiç değişmez — format yalnız soru **sonrasında** işleyen bir meta katmandır ve
CSV'nin `mod` sütununa yazılır.

| Format | Ne yapar | Öğrenci ekranı | Sahne | Panel "Mod durumu" |
|---|---|---|---|---|
| 🏁 **Yarış** *(varsayılan)* | Klasik: hız bonusu + seri çarpanı, meta yok | — | — | *(gizli)* |
| 🗺️ **Fetih (CtO)** | Soru bitince **öğretmen** fetih aşamasını açar; o turda doğru cevaplayanlar 6×6 haritadan kareyi **kendisi seçer**. En hızlı doğru bir **kalkan hakkı** kazanır ve bir **arkadaşına** hediye eder | Aşama açılınca tam ekran harita: hak sahibi kareye dokunur (sunucu hataları aynen görünür), hak sahibi olmayan **canlı izler** · soru arasında 🛡️ **kalkan hediye** kutusu · kalkan gelince sıcak kutlama | Aşamada harita **büyür**, korumalı devletler 🛡️ simgeli, sağ altta **fetih/kalkan haber akışı** | Harita + toprak listesi + **tek bağlam düğmesi** (Başlat/Bitir; cevapsız turda pasif) |
| 🛡️🚀 **Kalkan & Roket** | Doğru cevap eşya kazandırır: kalkan · roket · ipucu · çift puan | Envanter rozetleri · soru arasında **🎒 Eşyalar** paneli · 🔍 ipucu düğmesi · saldırı bildirimi | Envanter sayaçları · roket uçuşu + kalkan parlaması | Oyuncu başına **eşya adedi** (içerik açılmaz) |
| ⚔️ **Dönen Düello** | Her soruda yeni ikili eşleşme; turu kazanan bonus alır | "Bu turda rakibin: X" kartı · sonuçta kazandın/berabere/rakip yok | Soru başında eşleşme kartları, soru sonunda kazanan vurgusu | Eşleşmeler + kazanılan düello sayıları |
| 🏟️ **Eleme Düellosu** | Her soru bir maçtır; braket **kendiliğinden** kurulur ve ilerler (Çeyrek → Yarı → FİNAL). Doğru + hızlı kazanır; ikisi de bilemezse **ikisi de** elenir; tek kalan bay geçer | Rol bandı: düellocu → "⚔️ Rakibin: X" · diğerleri → "👀 Şu an düello: X ⚔ Y — sen gölge ligindesin" · sonuçta maç sonucu ve **şampiyon kutlaması** | Soru başında **maç kartı** (X ⚔ Y + tur adı), soru sonunda maç sonucu vurgusu, sonda **şampiyon** + **gölge ligi birincisi** kutlaması | Braket ağacı, aktif maç, yarışta kalanlar, elenenler, **gölge ligi ilk 5** — **hiç düğme yok** |

Format seçilince üst şeritte rozet belirir (🗺️ Fetih gibi) ve Canlı Oyun'a **🎲 Mod durumu**
alt başlığı eklenir; ilk seçimde kendiliğinden açılır. *Etkinliği Bitir* formatı da yarışa
döndürür.

**SADELİK KURALI:** Panelde her formatın **en fazla BİR bağlam düğmesi** olur — yalnız fetihte
vardır ("🗺️ Fetih Aşamasını Başlat" / "Bitir"). Diğer formatların "Mod durumu" bloğu saf bilgi
görünümüdür; eleme düellosunda braket kendiliğinden ilerlediği için hiç düğme yoktur.

Değişmez kurallar (çekirdekte zorlanır, ekranlar yalnız gösterir): hiçbir eşya cevaplamayı
engellemez · roket yalnız kendinden yukarıdakine atılabilir · ipucu kayda
`ipucu_kullanildi=1` düşer. **Eleme düellosu dışında elenme yoktur**; orada da elenen oyuncu
oyundan ATILMAZ — aynı soruları **gölge liginde** çözmeyi sürdürür, puanı ve ölçümü normal
işler. Tüm formatlarda yarış akışının sahnesi (3-2-1 gerilimi, şık dağılımı, İlk 5, podyum)
aynen sürer.

### Eşya kullanımı (öğrenci)

| Eşya | Ne zaman | Nasıl |
|---|---|---|
| 🛡️ Kalkan | — | **Kullanılmaz, kendiliğinden korur.** Sana roket gelirse savar; panelde "✓ Otomatik çalışır" yazar. |
| 🔍 İpucu | Soru sürerken | Soru şeridindeki 🔍 düğmesi. Bir **yanlış** şık soluklaşır ama **tıklanabilir kalır** (kural). |
| 🚀 Roket | Soru arasında | Hedef **yalnız sunucunun verdiği "önündekiler" listesinden** seçilir; hedef seçilmeden düğme kapalıdır. |
| ⚡ Çift Puan | Soru arasında | Tek dokunuş; "sıradaki soruda puanın 2 katı" onayı görünür. |

Saldırı bildirimleri kısa ve cesaretlendiricidir: *"X roket attı — kalkanın savdı! 🛡️"* /
*"X senden 150 puan aldı. Sıradaki soruda geri alırsın!"* — asla alaycı değildir.

---

## Panel düzeni

Akordeon; yalnız **Canlı Oyun** açık başlar.

| Bölüm | İçerik |
|---|---|
| 🎮 **Canlı Oyun** *(açık)* | Özet şeridi · set seçici · **format seçici** · duruma duyarlı akış düğmeleri · aktif soru (doğru cevap + açıklama) · **🎲 Mod durumu** ve **🖥️ Sahne ve sıralama gösterimi** alt başlıkları · oyuncu tablosu |
| 📈 Sonuçlar ve Raporlar | Sınıf raporu · CSV (kodlu/isimli) · karne · tüm karneleri yazdır · geçen oturum CSV'si |
| 🗂️ Soru Bankası | Set dosyası yükle · set listesi · önizle · sil · *Gelişmiş* altında ham JSON |
| ⚙️ Ayarlar | Karma oturum · misafir öğrenci ekleme |
| 📋 Öğrenci Listesi | `ogrenciler.json` görüntüleme, süzme, düzenleme, indirme |

**🖥️ Sahne alt başlığı** (Ayarlar'da değil, Canlı Oyun'un içinde): sahnede sıralama görünsün mü,
tüm ekranlarda sesi kapat, ve üç aşamalı sıralama gösterim akışı.

Üst şeritteki **🖥️ Sahneyi Aç** düğmesi `/screen` sayfasını **ayrı bir pencerede** açar; bu
pencereyi projeksiyona verin ya da Zoom'da paylaşın. Panelin kendi içinde sahne önizlemesi
ya da müzik çalma yoktur — sahne müziği yalnız o pencerede çalar.

---

## Soru bankası

Yalnız içerik yönetimi; **buradan oyun başlatılamaz.**

* **📤 Set dosyası yükle** — bir `.json` set dosyası seçin. Sunucuda doğrulanır; geçerse
  kaydedilir ve hem listeye hem Canlı Oyun set seçicisine anında düşer. Geçersizse hata
  gerekçesi (ör. *"grup p/e/i/c olmalı · sorular boş"*) gösterilir ve dosya kaydedilmez.
  **Dosya adı set kimliği olur** (`orman_patikasi_e.json` → `orman_patikasi_e`).
* **Set listesi** — ad, dosya adı, grup, hafta, soru sayısı, tema.
* **👁️ Önizle** — setin tüm sorularını salt-okunur gösterir: kategori/zorluk/CHC/süre etiketleri,
  şıklar (doğru olan işaretli), varsa SVG görseli ve çözüm notu. Düzenlenebilir alan yoktur.
* **🗑️ Sil** — onay sorar; oynanmakta olan set silinemez.
* **🔧 Gelişmiş** *(kapalı başlar)* — ham JSON düzenleyici, yeni set şablonu ve elle kaydetme.

---

## Bekleme ekranı mini oyunları

Kataloğdan seçilen **tam 3** oyun; her beklemede rastgele biri gelir (üst üste aynısı gelmez):

| # | Oyun | Neden |
|---|---|---|
| **1** | **Balon patlatma** — set temasının simgeleri (🌲🦊🍄 / ☁️🎏🕊️) yükselir, dokundukça patlar | Temaya uyarlandı |
| **2** | **Yıldız yakalama refleksi** — yıldız kaçmadan dokun, hızlandıkça zorlaşır | Saf refleks; akıl yürütmeye benzemez |
| **6** | **Serbest karalama tuvali** — 6 renk + temizle | Tamamen serbest, rekabetsiz |

Seçim gerekçesi: asıl mekanik **çoktan seçmeli akıl yürütme**dir; bu yüzden ona benzeyen
*4-Simon*, *5-Emoji hafıza* ve *11-Hızlı işlem kartları* bilinçli olarak elendi.
Üçü de tamamen istemcide çalışır, sunucuya hiç veri göndermez, **asıl oyunun puanına etkisi
yoktur** (yalnız kozmetik bir bekleme sayacı) ve **yeni tur başladığı an kaybolur** —
öğrenci hiçbir şeye basmak zorunda kalmaz.

---

## Çalışma yapılandırması

KHLike **yalnız BİREYSEL cevaplama** üzerine kuruludur; takım/boss modu yoktur. Gerekçe:
mekanik, her öğrencinin *kendi* cevabını *kendi* hızıyla kilitlemesine dayanır; hız bonusu ve
seri çarpanı bireysel refleksi ölçer. Ortak cevap verilen bir düzende bu iki sinyal de anlamını
yitirir ve tanılama verisi (Rasch kalibrasyonu için gereken madde-kişi eşleşmesi) bozulur.
Takım çalışması gereken haftalar için ayrı bir oyun kullanılır.

Bunun yerine **format katmanı** çeşitlilik sağlar: fetih, kalkan & roket, dönen düello ve
eleme düellosu etkileşimi soru *sonrasına* taşır — cevaplama bireysel kalır, kayıt öğrenci
bazlı sürer (bkz. *Oyun formatları*). Fetihteki **kalkan hediyesi** ve eleme düellosundaki
**gölge ligi**, işbirliğini ve "elenince dışlanmama"yı bireysel ölçümü bozmadan getirir.

---

## CHC hizalaması

| | Alan | Gerekçe |
|---|---|---|
| **Birincil** | **Gf** — akıcı akıl yürütme | Sorular hazır bilgi değil, verilen ipuçlarından kural çıkarma ister. |
| İkincil | **Gq** — nicel akıl yürütme | Sayı doğrusu, oran, denklik, temsile çevirme sürekli devrede. |
| İkincil | **Gs** — işlem hızı | Süreli yarış ritmi ve hız bonusu doğru cevabı hızlı üretmeyi ödüllendirir. |

Setler kendi `chc` alanlarıyla bu varsayılanı geçersiz kılar (İ seti: Gf + Gq + **Gsm**).
CHC bilgisi panelde açıkta durmaz; yalnız **ℹ️ Etkinlik Bilgisi** modalinin CHC sekmesinde
görünür ve **öğrenci ekranında hiçbir yerde yer almaz**.

---

## Zorluk gizliliği (doğrulandı)

Sunucunun öğrenciye gönderdiği soru paketinde yalnız şu alanlar bulunur:

```
index · no · toplam · soru · secenekler · gorsel_svg · kalanMs
```

`dogru`, `zorluk`, `kategori`, `chc`, `aciklama` **gitmez** — tarayıcı konsolundan da
görülemez. Öğrenci arayüzünün hiçbir ekranında (soru, bekleme, sonuç, sıralama, final)
zorluk etiketi, kademe adı veya CHC kısaltması geçmez. Skor tablosu zorluk farkını ele
vermez. Bu kural uçtan uca testte otomatik olarak doğrulanır.

---

## Set JSON şeması (`data/sets/*.json`)

Dosya adı = set kimliği (uzantısız). Panel → **Soru Bankası** bölümünden düzenlenip
kaydedilebilir; kayıtta doğrulanır.

```jsonc
{
  "ad": "E Grubu Tanılama Yarışması",   // zorunlu
  "grup": "e",                          // zorunlu — p | e | i | c
  "hafta": 1,                           // isteğe bağlı, panelde sıralama için
  "tema": {                             // öğrenciye "oyunun adı" bu tema adıdır
    "ad": "Orman Patikası",
    "dunya": "orman",
    "slogan": "Patikadaki izleri takip et!",
    "palet": { "zemin": "#f0fdf4", "zemin2": "#dcfce7", "vurgu": "#16a34a",
               "vurgu2": "#f59e0b", "metin": "#14532d",
               "kart": "#ffffff", "kartMetin": "#14532d" },
    "simgeler": ["🌲", "🦊", "🍄", "🐿️", "🦉", "🍃"]   // ambiyans + balon mini oyunu
  },
  "aciklama": "Panelde görünen kısa not",
  "kazanimlar": ["…", "…"],             // ℹ️ Etkinlik Bilgisi → Kazanımlar sekmesi
  "chc": { "birincil": "Gf", "ikincil": ["Gq", "Gs"], "gerekce": "…" },
  "veli_ozeti": "Veli toplantısında okunabilecek 2-3 cümle",
  "varsayilan_sure_sn": 35,             // sorunun kendi sure_sn'i yoksa
  "sorular": [
    {
      "no": 1,                          // yoksa sıra numarası atanır
      "kategori": "sayı doğrusu",       // karnedeki kategori dökümü buradan
      "chc": ["Gf", "Gq"],              // isteğe bağlı, soru düzeyi etiket
      "zorluk": 1,
      "sure_sn": 25,
      "soru": "Soru metni",             // zorunlu
      "secenekler": ["4", "5", "6", "7"],   // zorunlu, en az 2
      "dogru": 1,                       // zorunlu, secenekler dizisindeki indeks
      "aciklama": "Kısa çözüm notu",    // yalnız panelde + soru kapandıktan sonra
      "gorsel_svg": "<svg …>"           // isteğe bağlı, satır içi SVG
    }
  ]
}
```

### Öğrenci listesi (`data/ogrenciler.json`)

TÜM oyun depolarında **aynı dosya**; kodlar dönem boyunca sabittir (araştırma verisinin
sürekliliği buna bağlıdır). Ayrılan öğrenci silinmez, `aktif: false` yapılır.

```json
{ "guncelleme": "2026-09-01",
  "ogrenciler": [ { "kod": "E-01", "isim": "Ahmet", "grup": "e", "aktif": true } ] }
```

Panel → **Öğrenci Listesi** bölümünden ekleme/düzenleme/pasifleştirme yapılır (o oturumda
anında geçerli). Kalıcı olması için **Listeyi İndir** → depodaki `data/ogrenciler.json`
ile değiştirip push edin. Misafirler indirilen dosyaya **dahil edilmez**.

---

## Ölçme ve veri

Her cevap için sunucu 12 standart sütunu (+ `mod`, `misafir`, `gec_katilim`) kaydeder:

```
zaman;oyun;set_veya_paket;grup;ogrenci_kod;gorev_id;kategori;chc;zorluk;
sonuc;sure_sn;deneme;ipucu_kullanildi;mod;misafir;gec_katilim
```

Kayıtlarda **isim değil kod** (E-07) yazar. CSV dışa aktarımında öğretmen seçer:
**kodlu** (araştırma) veya **isimli** (veli raporu). Dosya adı: `KHLike_<grup>_<tarih>.csv`.

* **Öğrenci Raporu** — panelde bir öğrenciye tıklayın: genel doğruluk, kategori bazlı döküm,
  ortalama süre, en uzun seri. *Yazdır* → A4 tek sayfa karne.
* **Tüm Karneleri Yazdır** — öğrenci başına bir A4 sayfa, tek yazdırılabilir belge.
* **Geçen oturum CSV'si** — Sonuçlar bölümünden yüklerseniz karnelerde
  *"geçen oturuma göre değişim"* satırı görünür.

Render diski kalıcı değildir: veri bellekte tutulur, ders bitiminde panel indirme
hatırlatması gösterir ve rapor indirilmeden *Yeni Etkinlik* denirse onay ister.

---

## Erişilebilirlik ve konfor

* Bilgi asla yalnız renkle verilmez: her şık **renk + geometrik ikon (▲◆●■) + harf** taşır;
  doğru şık grafikte renk + ✔ + "doğru" etiketiyle işaretlenir.
* Dokunma hedefleri ≥ 44px, gövde metni ≥ 16px, Poppins (sistem yazı tipi yedeğiyle).
* `prefers-reduced-motion` açıkken ambiyans donar, konfeti çalışmaz, geçişler kısalır.
* Soru ekranında arka plan animasyonu yoktur; ambiyans yalnız giriş/lobi/sonuç/final
  ekranlarında çalışır.
* Ses varsayılan **açık ama kısık**; her ekranda 🔇 düğmesiyle kapatılır ve tercih
  hatırlanır. Öğretmen panelden tüm ekranların sesini birden kapatabilir.
  Müzik döngüleri (lobi/soru/sonuç) yalnız **sahnede** çalar — 30 öğrenci cihazına
  aynı anda mp3 indirtmemek için öğrenci ekranlarında yalnız Web Audio ile üretilen
  kısa efektler kullanılır.

---

## Bilinen sınırlar

* **Öğretmen kimlik doğrulaması socket üzerindedir** (cookie değil): `/teacher` HTML'i
  herkese servis edilir ama içi boştur — panel `admin_login` başarılı olmadan hiçbir veri
  almaz ve sunucudaki her admin olayı `socket.data.admin` kontrolünden geçer. Cookie'li
  kapı `server.js` değişikliği gerektirir (çekirdek dokunulmaz kuralı).
* **Sıralamadan çekilip fikrini değiştiren öğrenci**, sunucu ona sıralama paketi
  göndermediği için, *o turun* listesini değil **son soru sonundaki kendi sırasını** görür.
  Tam çözüm çekirdekte yeni bir olay ister.
* Sıcak yeniden yükleme yoktur; set dosyalarını elle düzenlediyseniz sunucuyu yeniden
  başlatın (panelden kaydederseniz gerekmez).
* **Eşya kullanımından sonra hedef listesi bir sonraki soruya kadar tazelenmez.** Sunucu
  `my_meta`'yı yalnız soru başında gönderdiği için, roket puan çaldıktan sonra "önündekiler"
  listesi eskimiş olabilir. Zararsızdır: hedef artık önünde değilse sunucu reddeder ve öğrenci
  *"Roket yalnız senden yukarıdakine atılabilir"* uyarısını görür.

---

Dosyalar: `lib/core.js` durum makinesi · `lib/modlar.js` format/meta katmanı · `server.js` socket sarmalayıcı · `lib/sets.js` ·
`lib/students.js` · `lib/report.js` · `PROTOKOL.md` ekran sözleşmesi ·
`ETKINLIK_BILGI.json` / `.md` kazanım-CHC-veli özeti · `test/` testler.
