/* Öğretmen paneli çatısı: giriş, akordeon, socket dağıtımı.
   Bölüm modülleri (canli / sonuclar / banka / liste) yalnız çizer ve olay gönderir. */
(function () {
    'use strict';
    var el = UI.el;
    var socket = io();
    var girisYapildi = false, sonSet = '';

    /* ---------------- Ortak yardımcılar (modüllere geçilir) ---------------- */
    function cerez(mesaj, hata) {
        var c = el('cerez');
        c.textContent = mesaj;
        c.classList.toggle('hata', !!hata);
        c.classList.add('acik');
        clearTimeout(cerez._z);
        cerez._z = setTimeout(function () { c.classList.remove('acik'); }, hata ? 5000 : 3000);
    }
    function gonder(olay, veri, geri) {
        socket.emit(olay, veri || {}, function (r) {
            if (r && r.ok === false && r.hata) cerez(r.hata, true);
            if (typeof geri === 'function') geri(r);
        });
    }
    var ctx = {
        gonder: gonder, cerez: cerez,
        etkinlikAdi: function () { var d = Canli.sonDurum(); return (d && d.etkinlik && d.etkinlik.ad) || ''; }
    };

    /* ---------------- Giriş ---------------- */
    el('giris-form').onsubmit = function (e) {
        e.preventDefault();
        var s = el('giris-sifre').value;
        socket.emit('admin_login', { sifre: s }, function (r) {
            if (r && r.ok) {
                girisYapildi = true;
                sessionStorage.setItem('khlike_admin', s);
                el('giris-perde').classList.add('kapali');
                el('panel').classList.remove('gizli');
                cerez('Hoş geldiniz 👋');
            } else {
                el('giris-hata').textContent = (r && r.hata) || 'Giriş yapılamadı.';
                el('giris-sifre').select();
            }
        });
    };
    // Yeniden bağlanmada oturumu koru (şifre yalnız sekme belleğinde tutulur)
    socket.on('connect', function () {
        var s = sessionStorage.getItem('khlike_admin');
        if (s) socket.emit('admin_login', { sifre: s }, function (r) {
            if (r && r.ok) {
                girisYapildi = true;
                el('giris-perde').classList.add('kapali');
                el('panel').classList.remove('gizli');
            } else sessionStorage.removeItem('khlike_admin');
        });
    });
    socket.on('disconnect', function () { if (girisYapildi) cerez('Bağlantı koptu, yeniden bağlanıyoruz…', true); });

    /* ---------------- Akordeon ---------------- */
    UI.hepsi('.bolum-bas').forEach(function (b) {
        b.onclick = function () {
            var bolum = el(b.dataset.hedef);
            bolum.classList.toggle('acik');
            b.setAttribute('aria-expanded', bolum.classList.contains('acik') ? 'true' : 'false');
        };
        b.setAttribute('aria-expanded', el(b.dataset.hedef).classList.contains('acik') ? 'true' : 'false');
    });

    /* ---------------- Sunucu olayları ---------------- */
    socket.on('admin_state', function (s) {
        Canli.durum(s);
        var ad = (s.etkinlik && s.etkinlik.ad) || '';
        el('p-set').textContent = ad ? ('· ' + ad) : '· set seçilmedi';   // grup rozette gösteriliyor
        if (s.setId !== sonSet) { sonSet = s.setId || ''; }
    });
    socket.on('sets', function (liste) { Banka.setleriYaz(liste); Canli.setler(liste); });
    socket.on('roster', function (r) { Liste.yaz(r); });
    socket.on('answer_count', function (d) { Canli.cevapSayisi(d); });
    socket.on('question', function () { /* admin_state zaten tam soruyu taşıyor */ });
    socket.on('question_end', function (e) {
        Mod.turSonucu(e);                       // fetih bağlam düğmesinin pasifliği bu bilgiden gelir
        cerez('Soru bitti — doğru şık: ' + String.fromCharCode(65 + e.dogru) + (e.sonSoru ? ' · SON SORU' : ''));
    });
    socket.on('kura_sonucu', function (d) {
        Canli.kuraSonucu(d);
        cerez('🎲 Kura: söz sırası ' + d.isim + ' (' + (d.adaySayisi || 0) + ' aday)');
    });
    socket.on('report_reminder', function (m) { cerez('📥 ' + m); el('rapor-not').textContent = m; });
    socket.on('alert', function (m) { cerez(m, true); });

    /* ---------------- Klavye kısayolları ----------------
       Ders sırasında panele bakmadan yönetmek için. Bir metin kutusuna yazarken
       veya bir modal açıkken devre dışıdır. */
    var KISAYOL = {
        ' ': ['SORUDA', function (s) { return s.duraklatildi ? 'd-devam' : 'd-duraklat'; }],
        'arrowright': [null, function (s) { return s.durum === 'LOBI' ? 'd-baslat' : s.durum === 'SORU_ARASI' ? 'd-siradaki' : null; }],
        'e': ['SORUDA', function () { return 'd-soru-bitir'; }],
        '+': ['SORUDA', function () { return 'd-sure10'; }],
        's': [null, function (s) { return ['SORU_ARASI', 'FINAL', 'RAPOR'].indexOf(s.durum) > -1 ? 'd-sir-baslat' : null; }],
        'f': ['SORU_ARASI', function () { return 'd-final'; }]
    };
    document.addEventListener('keydown', function (e) {
        if (!girisYapildi) return;
        var t = e.target.tagName;
        if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || e.target.isContentEditable) return;
        if (UI.hepsi('.modal.acik').length) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        var k = KISAYOL[e.key.toLowerCase()];
        if (!k) return;
        var s = Canli.sonDurum(); if (!s) return;
        if (k[0] && s.durum !== k[0]) return;
        var id = k[1](s); if (!id) return;
        var d = el(id);
        if (!d || d.disabled || d.closest('.gizli') || d.classList.contains('gizli')) return;
        if (id === 'd-sir-baslat') el('siralama-bolum').open = true;
        e.preventDefault();
        d.click();
    });

    /* ---------------- Modülleri kur ---------------- */
    Mod.kur(ctx);
    Canli.kur(ctx);
    Sonuclar.kur(ctx);
    Banka.kur(ctx);
    Liste.kur(ctx);

    // Sekme kapanırken kaza sonucu oturum kaybını önlemek için uyarı yok; veriler sunucuda.
    el('giris-sifre').focus();
})();
