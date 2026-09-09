/* Sahne istemcisi (/screen) — yalnız register_screen gönderir, gerisini çizer. */
(function () {
    'use strict';
    var el = UI.el;
    var socket = io();
    var ses = FX.SesMotoru({ anahtar: 'khlike_sahne_ses', seviye: 0.45 });
    var ambiyans = FX.Ambiyans(el('ambiyans'));

    var G = { durum: 'BOSTA', soru: null, toplamMs: 0, bitisMs: 0, duraklatildi: false, sonGerilim: 99,
        bitisSahnesi: false, meta: null, anlatimAcik: false, anlatim: null };
    var tik = null;

    var AMBIYANSLI = { 's-bosta': 1, 's-lobi': 1, 's-final': 1 };

    function ciz() {
        var id = 's-bosta';
        if (G.anlatimAcik) id = 's-anlatim';            // anlatım her şeyin önünde: sınıf tahtaya bakıyor
        else if (G.bitisSahnesi) id = 's-sonuc';
        else if (G.durum === 'LOBI') id = 's-lobi';
        else if (G.durum === 'SORUDA') id = 's-soru';
        else if (G.durum === 'SORU_ARASI') id = 's-sonuc';
        else if (G.durum === 'FINAL' || G.durum === 'RAPOR') id = 's-final';
        UI.ekranGoster(id);
        if (AMBIYANSLI[id]) ambiyans.baslat(Tema.simgeler()); else ambiyans.durdur();
        muzik(id);
        return id;
    }
    function muzik(id) {
        if (id === 's-lobi' || id === 's-bosta') ses.muzik('lobby', 0.2);
        else if (id === 's-soru') ses.muzik('question', 0.16);
        else if (id === 's-sonuc' || id === 's-anlatim') ses.muzik('results', 0.24);
        else ses.muzikDur();
    }
    function cerez(m) {
        var c = el('cerez'); c.textContent = m; c.classList.add('acik');
        clearTimeout(cerez._z); cerez._z = setTimeout(function () { c.classList.remove('acik'); }, 3400);
    }

    /* ---------------- SÜRE SENKRONU (PROTOKOL.md §7) ----------------
       Sayaç sunucu verisiyle yürür: question.kalanMs ile başlar, her public_state.kalanMs
       ve time_added.kalanMs'te yeniden senkronlanır, paused'ta durur. 0'a inse bile sahne
       soruyu KENDİSİ kapatmaz; kapanışı sunucunun question_end paketi bildirir. */
    function sayaciKur(kalanMs) {
        clearInterval(tik);
        G.bitisMs = Date.now() + kalanMs;
        G.toplamMs = Math.max(G.toplamMs, kalanMs);
        Sahne.sureCiz(kalanMs, G.toplamMs);
        if (G.duraklatildi) return;
        tik = setInterval(function () {
            var kalan = Math.max(0, G.bitisMs - Date.now());
            var sn = Sahne.sureCiz(kalan, G.toplamMs);
            if (sn <= 3 && sn >= 1 && sn < G.sonGerilim) {   // 3-2-1 gerilimi
                G.sonGerilim = sn; Sahne.gerilim(sn); ses.cal('gerisayim');
            }
            if (kalan <= 0) clearInterval(tik);
        }, 150);
    }

    /* ---------------- Olaylar ---------------- */
    socket.on('connect', function () { socket.emit('register_screen'); });

    socket.on('public_state', function (s) {
        G.durum = s.durum;
        G.duraklatildi = !!s.duraklatildi;
        if (s.etkinlik) { Tema.uygula(s.etkinlik.tema); el('s-etkinlik').textContent = s.etkinlik.ad; }
        else { Tema.uygula(null); el('s-etkinlik').textContent = 'KHLike'; }
        ambiyans.yenile(Tema.simgeler());
        el('s-oyuncu').textContent = '👥 ' + (s.oyuncuSayisi || 0);
        el('s-soru-no').textContent = s.durum === 'SORUDA' || s.durum === 'SORU_ARASI' ? ('Soru ' + s.soruNo + '/' + s.toplamSoru) : '';
        ses.sunucuKapat(!!s.sesKapali); sesDugSenkron();

        G.meta = s.meta || null;
        if (s.durum === 'LOBI') { G.bitisSahnesi = false; Sahne.lobi(s); SahneMod.ciz(G.meta, 'LOBI'); }
        else if (s.durum === 'SORUDA') SahneMod.ciz(G.meta, 'SORUDA');
        // Fetih aşamasında kare seçimleri SORU_ARASI'nda akar: harita canlı güncellenmeli
        else if (s.durum === 'SORU_ARASI') SahneMod.ciz(G.meta, 'ARASI');
        else if (s.durum === 'BOSTA') SahneMod.rozet(null);
        // Anlatımın ASIL kaynağı sunucudur: sahne sonradan açılsa bile doğru ekranı bulur.
        G.anlatimAcik = !!s.anlatimAcik;
        if (!G.anlatimAcik) G.anlatim = null;
        else if (!G.anlatimCizildi) { Sahne.anlatim(G.anlatim); G.anlatimCizildi = true; }
        if (s.durum === 'SORUDA' && !G.duraklatildi) sayaciKur(s.kalanMs);   // yeniden senkron
        if (s.durum !== 'SORUDA') clearInterval(tik);
        if (s.durum === 'SORU_ARASI' && !s.leaderboardGoster) Sahne.ilkBes([]);   // "Sıralamayı Gizle"
        else if (s.durum === 'SORU_ARASI') Sahne.ilkBes(s.podyum);
        el('perde-duraklat').classList.toggle('acik', G.duraklatildi);
        ciz();
    });

    socket.on('question', function (q) {
        G.soru = q; G.toplamMs = q.kalanMs; G.sonGerilim = 99; G.bitisSahnesi = false; G.durum = 'SORUDA';
        G.anlatimAcik = false; G.anlatim = null; G.anlatimCizildi = false; Sahne.kuraKapat();
        SahneMod.fetihAsamasi(false, []);          // yeni soru: fetih aşaması kapanır
        Sahne.soru(q);
        SahneMod.turBasladi(G.meta);
        SahneMod.ciz(G.meta, 'SORUDA');
        ciz();
        ses.cal('baslat');
        sayaciKur(q.kalanMs);
    });

    socket.on('answer_count', function (d) { Sahne.cevaplayan(d.cevaplayan, d.toplam); });

    socket.on('question_end', function (e) {
        clearInterval(tik);
        G.bitisSahnesi = true; G.durum = 'SORU_ARASI';
        Sahne.dagilim(e);
        G.meta = e.meta || G.meta;
        SahneMod.ciz(G.meta, 'ARASI');
        ciz();
        ses.cal('dogru');
        if (e.sonSoru) cerez('Son soru bitti — final zamanı! 🏁');
    });

    /* ---------------- Anlatım ve kura (PROTOKOL.md §7) ---------------- */
    socket.on('anlatim', function (d) {
        G.anlatimAcik = !!(d && d.acik);
        G.anlatim = G.anlatimAcik ? d : null;
        G.anlatimCizildi = G.anlatimAcik;
        clearInterval(tik);
        Sahne.anlatim(G.anlatim);
        if (G.anlatimAcik) ses.cal('baslat'); else Sahne.kuraKapat();
        ciz();
    });
    socket.on('kura_sonucu', function (d) { Sahne.kura(d, function (a) { ses.cal(a); }); });

    socket.on('saldiri', function (d) { SahneMod.saldiri(d, function (a) { ses.cal(a); }); });

    /* ---------------- Fetih aşaması: harita büyür + haber akışı ---------------- */
    socket.on('fetih_asamasi', function (d) {
        SahneMod.fetihAsamasi(!!d.acik, d.hakSahipleri || []);
        SahneMod.ciz(G.meta, 'ARASI');
        if (d.acik) { ses.cal('baslat'); cerez('🗺️ Fetih aşaması başladı — kareler seçiliyor!'); }
        else cerez('🏁 Fetih aşaması bitti.');
        ciz();
    });
    socket.on('fetih_haber', function (d) {
        SahneMod.haber(d.fethedilen
            ? { im: '⚔️', metin: '<strong>' + UI.kacir(d.isim) + '</strong>, <strong>' + UI.kacir(d.oncekiSahip || 'rakip') + '</strong> devletinin toprağını fethetti!', sinif: 'fetih' }
            : { im: '🏳️', metin: '<strong>' + UI.kacir(d.isim) + '</strong> yeni toprak aldı!', sinif: 'yeni' });
        ses.cal('kilit');
    });
    socket.on('kalkan_haber', function (d) {
        SahneMod.haber({ im: '🛡️', metin: '<strong>' + UI.kacir(d.veren) + '</strong> → <strong>' + UI.kacir(d.alan) + '</strong> kalkan hediye etti!', sinif: 'kalkan' });
        ses.cal('dogru');
    });

    socket.on('paused', function (a) {
        G.duraklatildi = !!a;
        el('perde-duraklat').classList.toggle('acik', G.duraklatildi);
        if (G.duraklatildi) clearInterval(tik);
    });
    socket.on('time_added', function (d) {
        G.toplamMs = Math.max(G.toplamMs, d.kalanMs); G.sonGerilim = 99;
        if (!G.duraklatildi && G.durum === 'SORUDA') sayaciKur(d.kalanMs);
        cerez('⏱️ Süre eklendi');
    });
    socket.on('question_rolled_back', function (d) {
        G.bitisSahnesi = false; G.anlatimAcik = false; G.anlatim = null; G.anlatimCizildi = false;
        Sahne.kuraKapat();
        cerez('↩️ Soru ' + d.iptalEdilen + ' iptal edildi, puanlar geri alındı');
        ciz();
    });

    socket.on('final', function (d) {
        clearInterval(tik);
        G.durum = 'FINAL'; G.bitisSahnesi = false; G.anlatimAcik = false; G.anlatim = null; G.anlatimCizildi = false;
        Sahne.kuraKapat();
        Sahne.final(d.podyum, function () { ses.cal('zafer'); });
        ciz();
        setTimeout(function () { FX.konfeti(6000, 220); }, 2400);
    });

    socket.on('session_reset', function () {
        clearInterval(tik);
        G.durum = 'BOSTA'; G.soru = null; G.bitisSahnesi = false; G.meta = null;
        G.anlatimAcik = false; G.anlatim = null; G.anlatimCizildi = false; Sahne.kuraKapat();
        SahneMod.sifirla(); SahneMod.rozet(null);
        el('s-sonuc').classList.remove('fetih-modu');
        cerez('Yeni etkinlik hazırlanıyor…');
        ciz();
    });

    /* ---------------- Ses ---------------- */
    function sesDugSenkron() {
        var d = el('ses-dug'), k = ses.kapaliMi();
        d.textContent = k ? '🔇' : '🔊';
        d.setAttribute('aria-pressed', k ? 'true' : 'false');
    }
    el('ses-dug').onclick = function () { ses.kilidiAc(); ses.degistir(); sesDugSenkron(); };
    socket.on('sound_muted', function (k) { ses.sunucuKapat(!!k); sesDugSenkron(); });

    el('baslat-dug').onclick = function () {
        el('baslat-perde').classList.add('kapali');
        ses.kilidiAc(); ses.cal('baslat');
        muzik(ciz());
    };

    el('lobi-adres').textContent = location.host;
    window.addEventListener('resize', function () { ambiyans.yenile(Tema.simgeler()); });
    sesDugSenkron();
    ciz();
})();
