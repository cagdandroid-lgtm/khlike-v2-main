# KHLike v2 — İLETİŞİM PROTOKOLÜ (ekranlar bu sözleşmeye göre yazılır)
Tüm oyun mantığı sunucudadır. Ekranlar YALNIZ olay gönderir ve gelen durumu çizer; hiçbir ekran puan hesaplamaz,
süre kararı vermez, doğru cevabı bilmez (öğrenciye asla gitmez).

## Durumlar (public_state.durum)
BOSTA → LOBI → SORUDA ⇄ SORU_ARASI → FINAL → RAPOR   ("yeni_etkinlik" → BOSTA)

## 1) ÖĞRENCİ (/)  — dosya: public/student/
Gönderir:
- `login_screen`                     sayfa açılınca (lobby odasına girer)
- `grup_sec` {grup}                  YALNIZ karma oturumda (login_list.grupSecimiGerekli true ise)
- `join_game` {playerId, kod}        isim kartına dokununca; playerId = localStorage'da kalıcı rastgele kimlik
- `answer` {secenek}                 şık indeksi (0-3)
- `ranking_optout`                   "Sıralamamı görmek istemiyorum 🙈"
Alır:
- `login_list` {beklemede, karma, grupSecimiGerekli, gruplar[], grup, etkinlik{ad,tema}, oyunSuruyor, ogrenciler[{kod,isim,dolu}]}
   beklemede=true → "Öğretmenini bekle" animasyonlu ekran (sayaç yok). oyunSuruyor=true → "Oyun sürüyor, adını seç ve katıl".
- `join_ok` {isim, kod, gecKatilim, score, durum}   → oyun görünümüne geç
- `join_error` "mesaj"
- `public_state` {durum, etkinlik, soruNo, toplamSoru, kalanMs, duraklatildi, oyuncuSayisi, podyum[], sesKapali, ...}
- `question` {index, no, toplam, soru, secenekler[], gorsel_svg|null, kalanMs}   → soru ekranı + geri sayım (kalanMs'ten)
- `answer_ack` {ok, hata?}           → "Kilitlendi ✓" ekranı
- `personal_result` {dogru, cevaplandi, puan, toplam, sira, ilkBes, ondekiFark, seri, rozetler[], soz, dogruCevap, aciklama}
   → soru arası sahnesi: kişisel sonuç (ilkBes ise podyum bilgisi, değilse yalnız kendi sırası + "öndekine X puan")
- `paused` true/false · `time_added` {kalanMs} · `question_rolled_back` {iptalEdilen} → "Soru iptal edildi" bilgisi
- `ranking_countdown` {sureSn} → geri sayım + çekilme düğmesi · `ranking_waiting` → "öğretmen bekleniyor"
- `ranking_result` {gizli:true} | {gizli:false, kapsam:'bireysel'|'tam', sira, toplam, score?, liste?[{sira,isim,score,sen}]}
- `ranking_closed` · `final` {podyum[]} → final podyumu + konfeti · `session_reset` → giriş ekranına dön
- `released` → isim serbest bırakıldı, giriş ekranına dön · `kicked` → "oyundan çıkarıldın" · `sound_muted` true/false

## 2) SAHNE (/screen) — dosya: public/screen/
Gönderir: `register_screen`
Alır: `public_state` (lobi baloncukları = lobi[], podyum[] ve leaderboardGoster), `question`, `answer_count` {cevaplayan,toplam},
`question_end` {dagilim[], dogru, podyum[], soru, sonSoru}, `paused`, `time_added`, `final`, `session_reset`, `sound_muted`, `question_rolled_back`.
Sahne: LOBI → lobi baloncukları + etkinlik teması; SORUDA → soru + şıklar + cevaplayan sayacı + 3-2-1/gerilim;
SORU_ARASI → şık dağılım grafiği + doğru şık + İlk 5 podyumu; FINAL → 3-2-1 podyum + konfeti.

## 3) ÖĞRETMEN (/teacher) — dosya: public/teacher/
Giriş: `admin_login` {sifre} → cb {ok, hata}. Sonra sunucu `admin_state`, `sets`, `roster` gönderir.
Her admin olayı isteğe bağlı callback ile sonuç döner: cb({ok, hata?, ...}). Hata varsa ayrıca `alert` "mesaj" gelir.
Alır: `admin_state` (publicState + setId, karma, soru{tam nesne}, cevaplayan, siralama{asama,cekilen}, oyuncular[{playerId,kod,isim,grup,connected,score,seri,misafir,gecKatilim,farkliGrup,cevapladi}], logSayisi, raporIndirildi),
`sets` [{id,ad,grup,hafta,soruSayisi,tema,aciklama}], `roster` {ogrenciler}, `question`, `question_end` (+aciklama), `answer_count`, `report_reminder`, `alert`.

Gönderir — duruma duyarlı düğmeler (ekranda YALNIZ o anda geçerli olanlar görünür):
| Durum       | Görünen düğmeler / olaylar |
|-------------|----------------------------|
| BOSTA       | set seçici → `set_sec` {setId}  ("Etkinliği Aç" = set seçmek; lobi açılır) |
| LOBI        | `oyunu_baslat` · set değiştirilebilir (`set_sec`) · `karma` {acik} |
| SORUDA      | `duraklat` / `devam` · `sure_ekle` {sn} · `soru_bitir` |
| SORU_ARASI  | `siradaki` · `geri_al` · `final` (son soruysa vurgulu) · `soru_baslat` {index, sureEz?} (soru atla seçicisi) |
| FINAL       | `rapor` · `siralama_*` |
| RAPOR       | (yalnız aşağıdaki ortak düğmeler) |
| HER DURUM   | **`etkinligi_bitir`** — kırmızı, onaylı, panelin üst şeridinde HEP görünür: etkinliği kapatır, BOSTA'ya döner. Set değiştirmenin tek yolu budur. |
GRUP = SETİN GRUBU. Ayrı bir grup seçici YOKTUR; öğretmen grubu set seçerek belirler. Set seçici BOSTA ve LOBI dışında pasif görünür ("değiştirmek için Etkinliği Bitir" ipucuyla).
Sahne kontrolleri (Canlı Oyun bölümünün ALT BAŞLIĞI, Ayarlar'da DEĞİL): `leaderboard_goster` {acik} · `ses` {kapali} · sıralama gösterimi akışı · "Sahneyi Aç" düğmesi (/screen'i yeni pencerede açar; projeksiyon/Zoom paylaşımı için, öğrenci ekranlarını etkilemez).
Soru bankası: set dosyası yükle (JSON seç) · sil · soru önizleme; ham JSON düzenleme yalnız "Gelişmiş" altında.
Her durumda: `release` {kod} · `kick` {playerId} · `puan_duzelt` {playerId, fark} · `leaderboard_goster` {acik} · `ses` {kapali}
Sıralama gösterimi (SORU_ARASI/FINAL/RAPOR): `siralama_baslat` {sureSn} → (geri sayım sunucuda biter, admin_state.siralama.asama='onay', cekilen sayısı görünür)
→ `siralama_gonder` {kapsam:'bireysel'|'tam', isimModu:'acik'|'gizli'} → `siralama_kapat`.
Sonuçlar: `rapor_al` → cb.rapor {etkinlik, ogrenciler[karne], enCokYanilinan[], sorular[]} · `karne_al` {kod} · `tum_karneler` · `csv` {isimli} → cb {ad, icerik} (Blob indir).
Soru bankası (yalnız içerik): `set_listesi` · `set_oku` {setId} · `set_kaydet` {setId, set} · `set_sil` {setId}.
Öğrenci listesi: `roster_al` · `roster_ekle` {kod,isim,grup} · `roster_guncelle` {kod, isim?, grup?, aktif?} · `roster_misafir` {isim} · `roster_indir` → cb {ad, icerik}.

## Set JSON biçimi (data/sets/*.json)
{ ad, grup:"e", hafta, tema{ad,dunya,slogan,palet{zemin,zemin2,vurgu,vurgu2,metin,kart,kartMetin},simgeler[]}, aciklama, varsayilan_sure_sn,
  sorular:[{no, kategori, chc?, zorluk, sure_sn, soru, secenekler[], dogru, aciklama, gorsel_svg?}] }
Öğrenciye giden soru paketi: yalnız no/toplam/soru/secenekler/gorsel_svg/kalanMs. (dogru, zorluk, kategori, aciklama GİTMEZ.)

## 5) KİMLİK YAŞAM DÖNGÜSÜ (istemci sözleşmesi — öğrenci uygulaması buna uymak ZORUNDA)
- İstemci localStorage'da {playerId (kalıcı), kod (son seçilen isim)} tutar.
- Otomatik yeniden katılım YALNIZ şu durumda: sayfa yüklendi + kayıtlı kod var + bu oturumda kicked/released/session_reset alınmadı.
- `kicked`, `released` veya `session_reset` alındığında: kayıtlı KOD SİLİNİR (playerId kalır), oyun görünümü kapanır, gelen login_list ile isim seçme ekranı gösterilir; otomatik katılım bir daha denenmez — çocuk yeni ismini kendisi seçer.
- `join_error` alındığında kayıtlı kod korunur ama otomatik katılım durur; hata gösterilip isim listesi açılır.
- Sunucu kuralı: aynı cihaz LOBI'deyken veya hiç cevap vermemişken farklı isim seçerse kimlik değişir (eski kayıt silinir); cevap verilmiş oyunda isim değişimi reddedilir — akış: öğretmen "oyundan çıkar" → çocuk yeni ismi seçer.

NOT (kanonik sunucu davranışı): `soru_baslat.sureEz` 5-600 sn aralığında doğrulanır; her cevapta panele admin_state yayınlanır. KHLike saf yarışma platformudur: oyun modları (fetih, eşyalar, düello) bu projede YOKTUR — bunlar bağımsız oyunlardır. Kayıtta mod sütunu sabit 'yarismaci' yazar.

## 7) ANLATIM MODU · KURA · SÜRE SENKRONU · CEVAP GÖRÜNÜMÜ (1. hafta düzeltmeleri)
- ANLATIM: SORU_ARASI'nda panel bağlam düğmesi "📖 Soruyu Anlat" → `anlatim_baslat`; herkese `anlatim` {acik:true, soru, secenekler, gorsel_svg, dogru, aciklama, dagilim} gider. Öğrenci ve sahne soruyu YENİDEN çizer: doğru şık yeşil vurgulu, şık başına dağılım sayısı, altta açıklama; öğrenci cevap VEREMEZ (salt görüntü). Kapatma: aynı düğme → `anlatim_bitir` veya sıradaki soru başlayınca kendiliğinden. public_state.anlatimAcik geç bağlananlar için gerçek kaynaktır.
- KURA: SORU_ARASI'nda küçük "🎲 Kura" menüsü: Doğrulardan / Yanlışlardan / Herkesten → `kura_cek` {kapsam}. Sahne + panele `kura_sonucu` {isim} (zar animasyonu sahnede), seçilen öğrenciye `soz_sende` → ekranında büyük "🎤 Söz sende!" kartı.
- SÜRE (istemci sözleşmesi — ZORUNLU): Öğrenci ve sahne geri sayımı YEREL saatle değil sunucu verisiyle yürütür: `question.kalanMs` ile başlar, HER `public_state.kalanMs` ve `time_added.kalanMs` geldiğinde yeniden senkronlanır, `paused` true iken durur. Geri sayım 0'a inse bile istemci soruyu KENDİSİ KAPATMAZ; `question_end` gelene kadar cevap düğmeleri açık kalır ("son saniyeler" görseli gösterilebilir). Sunucu tarafında otomatik kapanış artık soru başındaki katılımcı listesi ∪ şu an bağlılar üzerinden hesaplanır — kopan öğrenci soruyu erken bitirtmez.
- CEVAP GÖRÜNÜMÜ (yalnız panel): Oyuncular tablosunda SORUDA canlı: seçtiği şık harfi (renksiz, doğruluk belli edilmez); SORU_ARASI'nda: şık harfi + ✓/✗ renklendirme (admin_state.oyuncular[].aktifSecenek / sonSecenek / sonDogru). Sahneye ve öğrencilere bu bilgi GİTMEZ.
- GERİ ALMA: `geri_al` zaten var; panelde SORU_ARASI'nda belirgin "↩️ Bu soruyu iptal et (puanlar geri alınır)" olarak, onay diyaloğuyla gösterilir.
- KICKED/RELEASED (hatırlatma, Bölüm 5): istemci G.ben'i ve kayıtlı kodu TEMİZLER, oyun görünümünü kapatır, login_list ile İSİM EKRANINI açar — eski "Oyundasın" ekranında asla kalmaz.
