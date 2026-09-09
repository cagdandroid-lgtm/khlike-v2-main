/* Sahne çizim katmanı — gelen paketleri büyük ekrana çizer, hiçbir şey hesaplamaz. */
(function (g) {
    'use strict';
    var el = UI.el, yap = UI.yap, bosalt = UI.bosalt;
    var HALKA_CEVRE = 327;   // 2πr, r=52

    function bas(isim) { return (isim || '?').trim().charAt(0).toUpperCase(); }

    /* ---------------- Lobi baloncukları ---------------- */
    function lobi(durum) {
        el('lobi-ad').textContent = (durum.etkinlik && durum.etkinlik.ad) || 'Etkinlik';
        el('lobi-slogan').textContent = Tema.slogan();
        el('lobi-sayi').textContent = durum.oyuncuSayisi || 0;
        var kap = el('baloncuk-alan');
        var oyuncular = durum.lobi || [];
        var mevcut = {};
        UI.hepsi('.baloncuk', kap).forEach(function (b) { mevcut[b.dataset.kod] = b; });
        // Var olanı koru (animasyon tekrarlamasın), gideni sil, geleni ekle
        oyuncular.forEach(function (o, i) {
            if (mevcut[o.kod]) { delete mevcut[o.kod]; return; }
            var b = yap('div', { sinif: 'baloncuk', 'data-kod': o.kod },
                [yap('i', { metin: bas(o.isim) }), yap('span', { metin: o.isim })]);
            b.style.animationDelay = '0s, ' + (Math.random() * 2).toFixed(2) + 's';
            kap.appendChild(b);
        });
        Object.keys(mevcut).forEach(function (k) { mevcut[k].remove(); });
    }

    /* ---------------- Soru ---------------- */
    function soru(q) {
        el('s-soru-metin').textContent = q.soru;
        el('s-soru-no').textContent = 'Soru ' + q.no + '/' + q.toplam;
        var gor = bosalt(el('s-gorsel'));
        if (q.gorsel_svg) gor.innerHTML = q.gorsel_svg;
        var kap = bosalt(el('s-sikler'));
        (q.secenekler || []).forEach(function (metin, i) {
            var t = Tema.sik(i);
            var d = yap('div', { sinif: 's-sik', stil: 'background:' + t.renk },
                [yap('span', { sinif: 'isaret', html: t.ikon + '<b>' + t.harf + '</b>' }), yap('span', { metin: metin })]);
            d.style.animationDelay = (i * 0.09) + 's';
            kap.appendChild(d);
        });
        cevaplayan(0, null);
    }
    function cevaplayan(n, toplam) {
        el('s-cevaplayan').textContent = toplam ? (n + '/' + toplam) : String(n);
    }
    function sureCiz(kalanMs, toplamMs) {
        var oran = toplamMs > 0 ? Math.max(0, Math.min(1, kalanMs / toplamMs)) : 0;
        var c = el('halka-on'), sn = UI.sn(kalanMs);
        c.style.strokeDashoffset = String(HALKA_CEVRE * (1 - oran));
        c.classList.toggle('az', oran <= .5 && oran > .2);
        c.classList.toggle('kritik', oran <= .2);
        el('halka-sayi').textContent = sn;
        el('halka').classList.toggle('kritik', sn <= 5);
        return sn;
    }
    /** Son saniyelerde ekranı kaplayan 3-2-1 gerilimi. */
    function gerilim(sn) {
        var d = el('gerilim');
        d.textContent = sn;
        d.classList.remove('carp');
        void d.offsetWidth;
        d.classList.add('carp');
    }

    /* ---------------- Soru arası: şık dağılımı ---------------- */
    function dagilim(paket) {
        el('s-sonuc-bas').textContent = paket.soru ? paket.soru.soru : 'Sonuçlar';
        var kap = bosalt(el('dagilim'));
        var secenekler = (paket.soru && paket.soru.secenekler) || [];
        var enBuyuk = Math.max.apply(null, [1].concat(paket.dagilim || []));
        secenekler.forEach(function (metin, i) {
            var t = Tema.sik(i), n = (paket.dagilim || [])[i] || 0;
            var dogruMu = i === paket.dogru;
            var cubuk = yap('div', { sinif: 'cubuk', stil: 'background:' + t.renk + ';height:2px', metin: dogruMu ? '✔' : '' });
            var d = yap('div', { sinif: 'dg' + (dogruMu ? ' dogru' : '') }, [
                yap('div', { sinif: 'sayi', metin: String(n) }),
                cubuk,
                yap('div', { sinif: 'etiket', html: '<span>' + t.ikon + ' ' + t.harf + ')</span> ' + UI.kacir(metin) + (dogruMu ? ' <strong>✔ doğru</strong>' : '') })
            ]);
            kap.appendChild(d);
            // yükseklik animasyonu (bir kare sonra)
            requestAnimationFrame(function () { cubuk.style.height = Math.max(2, Math.round(78 * n / enBuyuk)) + '%'; });
        });
        ilkBes(paket.podyum);
    }
    function ilkBes(podyum) {
        var kutu = el('lider'), liste = bosalt(el('lider-liste'));
        var p = podyum || [];
        kutu.classList.toggle('gizli', !p.length);
        p.slice(0, 5).forEach(function (x, i) {
            var li = yap('li', {}, [
                yap('span', { sinif: 'no', metin: (i + 1) + '.' }),
                yap('span', { metin: x.isim }),
                yap('span', { sinif: 'pu', metin: UI.bashariler(x.score) })
            ]);
            li.style.animationDelay = ((4 - i) * 0.16) + 's';   // gerilim için alttan üste
            liste.appendChild(li);
        });
    }

    /* ---------------- Anlatım: soru + doğru şık + dağılım + açıklama ---------------- */
    function anlatim(p) {
        if (!p) {
            el('sa-metin').textContent = 'Öğretmen soruyu anlatıyor';
            bosalt(el('sa-sikler')); bosalt(el('sa-gorsel'));
            el('sa-no').textContent = '';
            el('sa-aciklama').classList.add('gizli');
            return;
        }
        el('sa-no').textContent = p.no ? ('Soru ' + p.no + '/' + p.toplam) : '';
        el('sa-metin').textContent = p.soru || '';
        var gor = bosalt(el('sa-gorsel'));
        if (p.gorsel_svg) gor.innerHTML = p.gorsel_svg;
        var kap = bosalt(el('sa-sikler'));
        var dagilim = p.dagilim || null;
        (p.secenekler || []).forEach(function (metin, i) {
            var t = Tema.sik(i), dogruMu = i === p.dogru;
            var cocuklar = [
                yap('span', { sinif: 'isaret', html: t.ikon + '<b>' + t.harf + '</b>' }),
                yap('span', { sinif: 'sa-metin', metin: metin })
            ];
            if (dagilim) cocuklar.push(yap('span', { sinif: 'sa-sayi', metin: (dagilim[i] || 0) + ' kişi' }));
            if (dogruMu) cocuklar.push(yap('span', { sinif: 'sa-dogru', metin: '✔ doğru' }));
            var d = yap('div', { sinif: 's-sik sa-sik' + (dogruMu ? ' dogru' : ' pasif'), stil: 'background:' + t.renk }, cocuklar);
            d.style.animationDelay = (i * 0.08) + 's';
            kap.appendChild(d);
        });
        var ac = el('sa-aciklama');
        ac.textContent = p.aciklama || '';
        ac.classList.toggle('gizli', !p.aciklama);
    }

    /* ---------------- Kura: zar animasyonu + "Söz sende" kartı ----------------
       Seçimi SUNUCU yapar; buradaki zar yalnız gerilim içindir. */
    var ZARLAR = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    var kuraZ = null, kuraKapatZ = null, kuraAcZ = null;
    var KURA_ETIKET = { dogru: 'Doğru cevaplayanlar arasından', yanlis: 'Yanlış cevaplayanlar arasından', herkes: 'Herkesin arasından' };

    function kura(d, sesCal) {
        clearInterval(kuraZ); clearTimeout(kuraKapatZ); clearTimeout(kuraAcZ);
        var perde = el('kura-perde'), zar = el('kura-zar'), isim = el('kura-isim');
        el('kura-etiket').textContent = '🎲 ' + (KURA_ETIKET[d.kapsam] || 'Adaylar arasından') + ' kura çekiliyor…';
        isim.classList.add('gizli'); isim.textContent = '';
        zar.classList.remove('gizli'); zar.textContent = '🎲';
        perde.classList.add('acik');

        var bitir = function () {
            zar.classList.add('gizli');
            isim.classList.remove('gizli');
            bosalt(isim);
            isim.appendChild(yap('div', { sinif: 'ki-im', metin: '🎤' }));
            isim.appendChild(yap('div', { sinif: 'ki-ad', metin: d.isim }));
            isim.appendChild(yap('div', { sinif: 'ki-alt', metin: 'Söz sende!' }));
            el('kura-etiket').textContent = KURA_ETIKET[d.kapsam] || '';
            if (sesCal) sesCal('zafer');
            kuraKapatZ = setTimeout(kuraKapat, 9000);
        };
        if (FX.azHareket) return bitir();
        if (sesCal) sesCal('tik');
        // Açılış SÜREYE bağlıdır, tik sayısına değil: sekme arka plandayken tarayıcı
        // aralıkları 1 sn'ye kıssa bile isim 1,5 sn sonra açılır.
        kuraZ = setInterval(function () { zar.textContent = ZARLAR[Math.floor(Math.random() * ZARLAR.length)]; }, 90);
        kuraAcZ = setTimeout(function () { clearInterval(kuraZ); bitir(); }, 1500);
    }
    function kuraKapat() {
        clearInterval(kuraZ); clearTimeout(kuraKapatZ); clearTimeout(kuraAcZ);
        el('kura-perde').classList.remove('acik');
    }

    /* ---------------- Final podyumu (3 → 2 → 1) ---------------- */
    function final(podyum, sesCal) {
        var kap = bosalt(el('s-podyum'));
        var madalya = ['🥇', '🥈', '🥉'];
        var duzen = [1, 0, 2];      // ekran düzeni: 2 · 1 · 3
        var gecikme = { 2: 0, 1: 1, 0: 2 };   // beliriş sırası: 3. → 2. → 1.
        duzen.forEach(function (i) {
            var p = podyum && podyum[i]; if (!p) return;
            var d = yap('div', { sinif: 'sp p' + (i + 1) }, [
                yap('div', { sinif: 'madalya', metin: madalya[i] }),
                yap('div', { sinif: 'ad', metin: p.isim }),
                yap('div', { sinif: 'pu', metin: UI.bashariler(p.score) + ' puan' })
            ]);
            d.style.animationDelay = (0.5 + gecikme[i] * 1.1) + 's';
            kap.appendChild(d);
            if (sesCal) setTimeout(function () { sesCal(); }, 500 + gecikme[i] * 1100);
        });
        if (!kap.children.length) kap.appendChild(yap('p', { sinif: 's-alt', metin: 'Henüz sıralanacak oyuncu yok.' }));
    }

    g.Sahne = { lobi: lobi, soru: soru, cevaplayan: cevaplayan, sureCiz: sureCiz, gerilim: gerilim, dagilim: dagilim,
        ilkBes: ilkBes, final: final, anlatim: anlatim, kura: kura, kuraKapat: kuraKapat };
})(window);
