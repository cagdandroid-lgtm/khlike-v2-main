/* Öğrenci istemcisi — YALNIZ olay gönderir ve gelen durumu çizer.
   Puan, süre kararı, doğruluk: hepsi sunucuda. Bu dosyada oyun mantığı yoktur. */
(function () {
    'use strict';
    var el = UI.el;
    var socket = io();
    var ses = FX.SesMotoru({ anahtar: 'khlike_ogr_ses', seviye: 0.3 });
    var ambiyans = FX.Ambiyans(el('ambiyans'));

    OgrenciMod.ayarla({
        gonder: function (olay, veri, geri) { socket.emit(olay, veri || {}, function (r) { if (typeof geri === 'function') geri(r); }); },
        cerez: function (m) { cerez(m); },
        ses: function (a) { ses.cal(a); }
    });

    /* ---------------- Kimlik yaşam döngüsü (PROTOKOL.md §5) ----------------
       localStorage: playerId KALICI (cihaz kimliği), kod AYRI tutulur (son seçilen isim).
       Otomatik yeniden katılım YALNIZ: kayıtlı kod var + bu oturumda kicked/released/
       session_reset/join_error alınmadı. Çocuk ismini kendisi seçtiğinde yeniden açılır. */
    var PID = UI.playerId();
    var KOD_ANAHTAR = 'khlike_son_kod';
    var otoKatilim = true;

    function kayitliKod() { return localStorage.getItem(KOD_ANAHTAR) || null; }
    function koduYaz(kod) { localStorage.setItem(KOD_ANAHTAR, kod); }
    function koduSil() { localStorage.removeItem(KOD_ANAHTAR); }

    var G = {
        durum: 'BOSTA', giris: null, katildi: false, ben: null,
        soru: null, toplamMs: 0, bitisMs: 0, cevapVerdi: false, secilen: -1,
        duraklatildi: false, sonSonuc: null, siralamaAcik: false,
        podyum: null, oyuncuSayisi: 0, enUzunSeri: 0, rozetler: [], fetihAcik: false,
        anlatimAcik: false, anlatim: null, siralamaAsama: null
    };
    var sayacTik = null, siralamaTik = null;

    /** Oyun görünümünü tamamen kapatır: sayaçlar, mini oyun, perde ve oyun durumu sıfırlanır.
        Ekranın kendisi ciz() ile giriş akışına döner. */
    function oyunGorunumunuKapat() {
        clearInterval(siralamaTik); sayaciDurdur(); Mini.durdur(el('mini-alan'));
        G.katildi = false; G.ben = null; G.soru = null; G.sonSonuc = null;
        G.cevapVerdi = false; G.secilen = -1; G.siralamaAcik = false; G.podyum = null;
        G.enUzunSeri = 0; G.rozetler = []; G.fetihAcik = false;
        G.anlatimAcik = false; G.anlatim = null; G.anlatimCizildi = false; G.siralamaAsama = null;
        G.sonSiralama = null; G.duraklatildi = false;
        perde(false); sozKapat();
        OgrenciMod.sifirla();
    }

    /* ---------------- Ekran yönlendirme ---------------- */
    var AMBIYANSLI = { 'ek-bekleme': 1, 'ek-grup': 1, 'ek-isim': 1, 'ek-lobi': 1, 'ek-sonuc': 1, 'ek-siralama': 1, 'ek-final': 1, 'ek-fetih': 1 };

    function ciz() {
        var id;
        // Sıralama GERİ SAYIMI anlatımı geçer: çocuğun "görmek istemiyorum" düğmesine
        // ulaşması engellenmemeli. Diğer her anda anlatım öne çıkar.
        var sirOncelikli = G.siralamaAcik && G.siralamaAsama === 'gerisayim';
        if (!G.katildi) id = girisEkrani();
        else if (G.anlatimAcik && !sirOncelikli) id = 'ek-anlatim';   // öğretmen soruyu anlatıyor
        else if (G.fetihAcik) id = 'ek-fetih';          // öğretmen fetih aşamasını açtı
        else if (G.siralamaAcik) id = 'ek-siralama';
        else if (G.durum === 'SORUDA') id = G.cevapVerdi ? 'ek-kilit' : 'ek-soru';
        else if (G.durum === 'SORU_ARASI') id = G.sonSonuc ? 'ek-sonuc' : 'ek-lobi';
        else if (G.durum === 'FINAL' || G.durum === 'RAPOR') id = 'ek-final';
        else if (G.durum === 'LOBI') id = 'ek-lobi';
        else id = girisEkrani();

        UI.ekranGoster(id);
        if (AMBIYANSLI[id]) ambiyans.baslat(Tema.simgeler()); else ambiyans.durdur();
        if (id !== 'ek-kilit') Mini.durdur(el('mini-alan'));
        el('ust-ben').classList.toggle('gizli', !G.ben);
        if (G.ben) el('ust-ben').textContent = '👤 ' + G.ben.isim;
    }
    function girisEkrani() {
        var p = G.giris;
        if (!p || p.beklemede) return 'ek-bekleme';
        if (p.grupSecimiGerekli) return 'ek-grup';
        return 'ek-isim';
    }
    function cerez(mesaj, sureMs) {
        var c = el('cerez'); c.textContent = mesaj; c.classList.add('acik');
        clearTimeout(cerez._z); cerez._z = setTimeout(function () { c.classList.remove('acik'); }, sureMs || 3200);
    }

    /* ---------------- SÜRE SENKRONU (PROTOKOL.md §7) ----------------
       Geri sayım YEREL saatle yürütülmez: sunucudan gelen kalanMs ile başlar ve
       her question / public_state.kalanMs / time_added.kalanMs paketinde yeniden
       senkronlanır, paused'ta durur. Sayaç 0'a inse bile İSTEMCİ SORUYU KAPATMAZ:
       şık düğmeleri açık kalır, kapanış kararı sunucunun (question_end) işidir. */
    function sayaciKur(kalanMs) {
        clearInterval(sayacTik);
        G.bitisMs = Date.now() + kalanMs;
        G.toplamMs = Math.max(G.toplamMs, kalanMs);
        Ekranlar.sureCiz(kalanMs, G.toplamMs);
        if (G.duraklatildi) return;
        sayacTik = setInterval(function () {
            var kalan = Math.max(0, G.bitisMs - Date.now());
            Ekranlar.sureCiz(kalan, G.toplamMs);
            if (kalan <= 0) { clearInterval(sayacTik); sonSaniyeler(true); }   // yalnız görsel: kilitleme YOK
            else if (kalan <= 5200) { sonSaniyeler(true); if (kalan % 1000 > 700) ses.cal('gerisayim'); }
        }, 200);
    }
    function sayaciDurdur() { clearInterval(sayacTik); }
    /** "Son saniyeler" görseli — cevap düğmelerine dokunmaz. */
    function sonSaniyeler(a) { el('ek-soru').classList.toggle('son-saniyeler', !!a); }

    /** Sunucudan yeni bir kalanMs geldi: sayacı yeniden kur (cevap verildiyse gerek yok). */
    function sureSenkron(kalanMs) {
        if (G.durum !== 'SORUDA' || G.cevapVerdi || !G.soru) return;
        if (G.duraklatildi) { G.toplamMs = Math.max(G.toplamMs, kalanMs); Ekranlar.sureCiz(kalanMs, G.toplamMs); sayaciDurdur(); return; }
        sayaciKur(kalanMs);
    }

    /* ---------------- Bağlantı ---------------- */
    socket.on('connect', function () {
        var kod = kayitliKod();
        socket.emit('login_screen');
        // Otomatik yeniden katılım: yalnız kayıtlı kod varken ve bu oturumda çıkarılmadıysak.
        if (otoKatilim && kod) socket.emit('join_game', { playerId: PID, kod: kod });
    });
    socket.on('disconnect', function () { cerez('Bağlantı koptu, yeniden bağlanıyoruz…'); });

    /* ---------------- Giriş ---------------- */
    socket.on('login_list', function (p) {
        G.giris = p;
        if (p.etkinlik) { Tema.uygula(p.etkinlik.tema); el('ust-etkinlik').textContent = p.etkinlik.ad; }
        else el('ust-etkinlik').textContent = 'KHLike';
        ambiyans.yenile(Tema.simgeler());
        if (!G.katildi) {
            if (p.grupSecimiGerekli) Ekranlar.grupKartlari(p.gruplar, function (grup) { ses.kilidiAc(); ses.cal('tik'); socket.emit('grup_sec', { grup: grup }); });
            else if (!p.beklemede) Ekranlar.isimKartlari(p, isimSec);
        }
        ciz();
    });

    function isimSec(kod) {
        ses.kilidiAc(); ses.cal('pop');
        socket.emit('join_game', { playerId: PID, kod: kod });
    }

    socket.on('join_ok', function (d) {
        G.katildi = true; G.ben = { isim: d.isim, kod: d.kod };
        otoKatilim = true;                       // isim elle seçildi: kopmada geri dönebiliriz
        koduYaz(d.kod);
        if (d.gecKatilim) cerez('Hoş geldin ' + d.isim + '! Sıradaki sorudan itibaren yarıştasın 🚀');
        ses.cal('pop');
        ciz();
    });
    // join_error: kayıtlı KOD KORUNUR, yalnız otomatik katılım durur (PROTOKOL.md §5).
    socket.on('join_error', function (m) {
        otoKatilim = false;
        oyunGorunumunuKapat();
        cerez(m || 'Girilemedi.', 5000);
        ciz();                                   // soket zaten lobide: elde duran liste gösterilir
    });

    /* ---------------- Genel durum ---------------- */
    socket.on('public_state', function (s) {
        var oncekiDurum = G.durum;
        G.durum = s.durum; G.oyuncuSayisi = s.oyuncuSayisi; G.podyum = s.podyum;
        G.duraklatildi = !!s.duraklatildi;
        if (s.etkinlik) { Tema.uygula(s.etkinlik.tema); el('ust-etkinlik').textContent = s.etkinlik.ad; }
        ses.sunucuKapat(!!s.sesKapali); sesDugSenkron();

        if (oncekiDurum !== s.durum && s.durum !== 'SORUDA') { G.cevapVerdi = false; G.secilen = -1; }
        OgrenciMod.genelMeta(s.meta, s.lobi || [], G.ben ? G.ben.kod : null);
        // Fetih aşamasının ASIL kaynağı sunucu durumudur; fetih_asamasi olayı yalnız
        // ses/animasyon tetikler. Böylece bağlantısı kopan öğrenci geri dönünce aşamayı bulur.
        if (s.meta && s.meta.format === 'fetih') G.fetihAcik = s.meta.asama === 'fetih';
        // Anlatımın ASIL kaynağı sunucu durumudur: geç bağlanan da doğru ekranı bulur.
        G.anlatimAcik = !!s.anlatimAcik;
        if (!G.anlatimAcik) { G.anlatim = null; G.anlatimCizildi = false; }
        else if (!G.anlatimCizildi) { Mini.durdur(el('mini-alan')); Ekranlar.anlatim(anlatimPaketi()); G.anlatimCizildi = true; }
        Ekranlar.lobi(s);                     // sayaç ve başlık her durumda tazelenir
        if (s.durum === 'LOBI') { G.sonSonuc = null; G.fetihAcik = false; }
        if (s.durum === 'SORUDA') sureSenkron(s.kalanMs); else { sayaciDurdur(); sonSaniyeler(false); }
        perde(G.duraklatildi);
        ciz();
    });

    /* ---------------- Soru ---------------- */
    socket.on('question', function (q) {
        Mini.durdur(el('mini-alan'));
        G.soru = q; G.cevapVerdi = false; G.secilen = -1; G.sonSonuc = null; G.siralamaAcik = false; G.fetihAcik = false;
        G.anlatimAcik = false; G.anlatim = null; G.anlatimCizildi = false; G.siralamaAsama = null;   // yeni tur: anlatım kapanır
        sozKapat(); sonSaniyeler(false);
        G.toplamMs = q.kalanMs;
        Ekranlar.soru(q, cevapla);
        OgrenciMod.soruYenilendi();
        ses.cal('baslat');
        sayaciKur(q.kalanMs);
        ciz();
        window.scrollTo(0, 0);
    });

    function cevapla(i, dugme) {
        if (G.cevapVerdi) return;
        G.secilen = i;
        Ekranlar.sikleriKilitle(i);
        ses.cal('kilit');
        socket.emit('answer', { secenek: i });
    }

    socket.on('my_meta', function (m) { OgrenciMod.benimMeta(m); });
    socket.on('saldiri_geldi', function (d) { OgrenciMod.saldiriGeldi(d); });

    /* ---------------- Anlatım: öğretmen soruyu çözüyor (PROTOKOL.md §7) ----------------
       Salt görüntüdür; bu ekranda cevap verilemez. Paket yoksa (araya sonradan
       katılan çocuk) nötr bir "tahtaya bak" ekranı gösterilir. */
    function anlatimPaketi() {
        if (G.anlatim) return G.anlatim;
        // Paketi kaçırdıysak elimizdekiyle kurarız: soru bizde, doğru cevap kişisel sonuçta.
        if (G.soru && G.sonSonuc && G.sonSonuc.dogruCevap !== undefined) {
            return { no: G.soru.no, toplam: G.soru.toplam, soru: G.soru.soru, secenekler: G.soru.secenekler,
                gorsel_svg: G.soru.gorsel_svg || null, dogru: G.sonSonuc.dogruCevap,
                aciklama: G.sonSonuc.aciklama || '', dagilim: null };
        }
        return null;
    }
    socket.on('anlatim', function (d) {
        G.anlatimAcik = !!(d && d.acik);
        G.anlatim = G.anlatimAcik ? d : null;
        Mini.durdur(el('mini-alan'));
        sayaciDurdur();
        Ekranlar.anlatim(anlatimPaketi());
        G.anlatimCizildi = G.anlatimAcik;
        if (G.anlatimAcik) ses.cal('tik');
        ciz();
        window.scrollTo(0, 0);
    });

    /* ---------------- Söz hakkı kurası: seçilen öğrencinin ekranı ---------------- */
    function sozKapat() { el('soz-perde').classList.remove('acik'); clearTimeout(sozKapat._z); }
    el('soz-kapat').onclick = function () { sozKapat(); };
    socket.on('soz_sende', function (d) {
        el('soz-alt').textContent = (d && d.kapsam === 'herkes')
            ? 'Kura seni seçti — düşünceni arkadaşlarına anlat.'
            : 'Öğretmenin seni seçti — cevabını arkadaşlarına anlat.';
        el('soz-perde').classList.add('acik');
        ses.cal('zafer');
        FX.konfeti(1500, 50);
        clearTimeout(sozKapat._z);
        sozKapat._z = setTimeout(sozKapat, 20000);      // kimse basmazsa kendiliğinden kapanır
    });

    /* ---------------- Fetih aşaması (öğretmen açar/kapatır) ---------------- */
    socket.on('fetih_asamasi', function (d) {
        G.fetihAcik = !!d.acik;
        Mini.durdur(el('mini-alan'));
        OgrenciMod.fetihAsamasi(d);
        if (G.fetihAcik) ses.cal('baslat');
        ciz();
        window.scrollTo(0, 0);
    });
    socket.on('kalkan_geldi', function (d) {
        OgrenciMod.kalkanGeldi(d);
        ses.cal('dogru');
        FX.konfeti(1800, 70);
    });

    socket.on('answer_ack', function (r) {
        if (!r.ok) {
            G.secilen = -1;
            UI.hepsi('#sik-izgara .sik').forEach(function (b) { b.disabled = false; b.classList.remove('secili'); });
            cerez(r.hata || 'Cevap alınamadı.');
            return;
        }
        G.cevapVerdi = true;
        sayaciDurdur();
        ciz();
        miniBaslat();
    });

    function miniBaslat() {
        el('kilit-alt').textContent = 'Arkadaşların cevaplarken oyalanabilirsin — bu oyun puanını etkilemez.';
        Mini.baslat(el('mini-alan'), {
            simgeler: Tema.simgeler(),
            ad: function (m) { el('mini-ad').textContent = m; },
            skor: function (n) { el('mini-skor').textContent = n; },
            ses: function (a) { ses.cal(a); }
        });
    }

    /* ---------------- Kişisel sonuç ---------------- */
    socket.on('personal_result', function (r) {
        Mini.durdur(el('mini-alan'));       // yeni sahne başladığı AN mini oyun kaybolur
        sayaciDurdur();
        G.sonSonuc = r; G.durum = 'SORU_ARASI'; G.siralamaAcik = false; G.siralamaAsama = null;
        sonSaniyeler(false);
        if (r.seri > G.enUzunSeri) G.enUzunSeri = r.seri;
        (r.rozetler || []).forEach(function (x) { if (G.rozetler.indexOf(x) === -1) G.rozetler.push(x); });
        Ekranlar.sonuc(r, G.soru ? G.soru.secenekler : null);
        OgrenciMod.sonucMeta(r.meta);
        ciz();
        if (r.dogru) { ses.cal('dogru'); FX.konfeti(1600, 60); } else ses.cal('yanlis');
        window.scrollTo(0, 0);
    });

    /* ---------------- Duraklat / süre / iptal ---------------- */
    function perde(a) { el('perde-duraklat').classList.toggle('acik', !!a); }
    socket.on('paused', function (a) {
        G.duraklatildi = !!a;
        perde(G.duraklatildi);
        if (G.duraklatildi) sayaciDurdur();
    });
    socket.on('time_added', function (d) {
        G.toplamMs = Math.max(G.toplamMs, d.kalanMs);
        sonSaniyeler(false);
        sureSenkron(d.kalanMs);                    // sunucu kaynaklı yeniden senkron
        cerez('⏱️ Öğretmen süre ekledi!');
    });
    socket.on('question_rolled_back', function (d) {
        G.sonSonuc = null; G.cevapVerdi = false; G.siralamaAcik = false; G.fetihAcik = false;
        G.anlatimAcik = false; G.anlatim = null; G.anlatimCizildi = false; G.siralamaAsama = null;
        Mini.durdur(el('mini-alan'));
        OgrenciMod.sonucMeta(null);
        cerez('Soru ' + d.iptalEdilen + ' iptal edildi — puanlar geri alındı.');
        ciz();
    });

    /* ---------------- Sıralama gösterimi ---------------- */
    socket.on('ranking_countdown', function (d) {
        G.siralamaAcik = true; G.siralamaAsama = 'gerisayim';
        Ekranlar.siralamaAsama('gerisayim');
        el('sir-cekil').disabled = false;
        el('sir-cekil').textContent = 'Sıralamamı görmek istemiyorum 🙈';
        var kalan = d.sureSn || 10;
        el('sir-sayac').textContent = kalan;
        clearInterval(siralamaTik);
        siralamaTik = setInterval(function () {
            kalan -= 1; el('sir-sayac').textContent = Math.max(0, kalan);
            if (kalan <= 0) clearInterval(siralamaTik);
        }, 1000);
        ciz();
    });
    el('sir-cekil').onclick = function () {
        socket.emit('ranking_optout');
        this.disabled = true; this.textContent = 'Tamam, bu tur sıralaman gizli 🙈';
        ses.cal('tik');
    };
    socket.on('ranking_waiting', function () {
        clearInterval(siralamaTik);
        G.siralamaAcik = true; G.siralamaAsama = 'bekleme'; Ekranlar.siralamaAsama('bekleme'); ciz();
    });
    socket.on('ranking_result', function (p) {
        clearInterval(siralamaTik);
        G.siralamaAcik = true; G.siralamaAsama = 'sonuc';
        G.sonSiralama = p;
        if (p.gizli) Ekranlar.siralamaAsama('gizli');
        else { Ekranlar.siralamaSonuc(p); ses.cal('pop'); }
        ciz();
    });
    // Çekilen öğrenci fikrini değiştirebilir: kendi sırasını YALNIZ kendi ekranında görür.
    // Sunucu çekilene sıralama paketi göndermediği için, en son kişisel sonuçta gelen sıra gösterilir.
    el('sir-goster').onclick = function () {
        if (!G.sonSonuc) { cerez('Henüz gösterilecek bir sıran yok.'); return; }
        Ekranlar.siralamaSonuc({ kapsam: 'bireysel', sira: G.sonSonuc.sira, toplam: G.oyuncuSayisi || G.sonSonuc.sira, score: G.sonSonuc.toplam });
        el('sir-alt').textContent = (G.oyuncuSayisi || '?') + ' oyuncu arasında · ' + UI.bashariler(G.sonSonuc.toplam) + ' puan (son soru sonu)';
        ses.cal('pop');
    };
    socket.on('ranking_closed', function () { clearInterval(siralamaTik); G.siralamaAcik = false; G.siralamaAsama = null; ciz(); });

    /* ---------------- Final ---------------- */
    socket.on('final', function (d) {
        G.durum = 'FINAL'; G.siralamaAcik = false; G.siralamaAsama = null; G.anlatimAcik = false; G.anlatim = null; G.anlatimCizildi = false;
        G.podyum = d.podyum;
        Mini.durdur(el('mini-alan'));
        var benimSira = null;
        (d.podyum || []).forEach(function (p, i) { if (G.ben && p.isim === G.ben.isim) benimSira = i + 1; });
        Ekranlar.final(d.podyum, {
            sira: benimSira || (G.sonSonuc ? G.sonSonuc.sira : null),
            toplam: G.sonSonuc ? G.sonSonuc.toplam : 0,
            enUzunSeri: G.enUzunSeri, rozetler: G.rozetler
        });
        el('final-baslik').textContent = benimSira && benimSira <= 3 ? '🏆 Podyumdasın!' : '🏆 Oyun bitti!';
        ciz();
        ses.cal('zafer');
        FX.konfeti(3800, 160);
    });

    /* ---------------- Oturum olayları ---------------- */
    /* kicked · released · session_reset: kayıtlı KOD SİLİNİR (playerId kalır), oyun görünümü
       kapanır, sunucunun gönderdiği login_list ile isim seçme ekranı açılır ve otomatik
       katılım bir daha denenmez — çocuk yeni ismini kendisi seçer (PROTOKOL.md §5). */
    function kimligiBirak(mesaj, sureMs) {
        koduSil(); otoKatilim = false;
        G.durum = 'BOSTA';                       // eski oyun durumu ekranı bir daha çizmesin
        oyunGorunumunuKapat();
        // Lobi odasına HER durumda yeniden yazılırız: sunucu ne gönderirse göndersin
        // isim seçme ekranı taze bir login_list ile açılır ("Oyundasın" ekranında kalma yok).
        var grup = G.giris && G.giris.karma ? G.giris.grup : '';
        G.giris = null;
        socket.emit('login_screen');
        if (grup) socket.emit('grup_sec', { grup: grup });   // karma oturumda seçili grup korunur
        if (mesaj) cerez(mesaj, sureMs);
        ciz();                                   // login_list gelene kadar "öğretmenini bekle"
    }
    socket.on('session_reset', function () { kimligiBirak('Yeni etkinlik hazırlanıyor…', 3200); });
    socket.on('released', function () { kimligiBirak('🔓 İsmin serbest bırakıldı — adına dokunarak girebilirsin.', 5000); });
    socket.on('kicked', function () { kimligiBirak('👋 Öğretmenin seni oyundan çıkardı. Adına dokunup yeniden girebilirsin.', 6000); });

    /* ---------------- Ses düğmesi ---------------- */
    function sesDugSenkron() {
        var d = el('ses-dug');
        var kapali = ses.kapaliMi();
        d.textContent = kapali ? '🔇' : '🔊';
        d.setAttribute('aria-pressed', kapali ? 'true' : 'false');
        d.title = kapali ? 'Sesi aç' : 'Sesi kapat';
    }
    el('ses-dug').onclick = function () { ses.kilidiAc(); ses.degistir(); sesDugSenkron(); };
    socket.on('sound_muted', function (k) { ses.sunucuKapat(!!k); sesDugSenkron(); });

    window.addEventListener('resize', function () { ambiyans.yenile(Tema.simgeler()); });
    sesDugSenkron();
    ciz();
})();
