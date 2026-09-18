/* Öğrenci ekranlarının ÇİZİM katmanı. Burada hiçbir karar/hesap yoktur:
   sunucudan gelen paketler olduğu gibi çizilir (puan, süre, doğruluk sunucuda hesaplanır). */
(function (g) {
    'use strict';
    var el = UI.el, yap = UI.yap, bosalt = UI.bosalt;

    var GRUP_ETIKET = {   // resmî grup adları — uydurma takma ad üretilmez
        p: { ad: 'P Grubu', emoji: '🐣', renk: '#f472b6' },
        e: { ad: 'E Grubu', emoji: '🌱', renk: '#22c55e' },
        u: { ad: 'U Grubu', emoji: '🦉', renk: '#7c3aed' }    // İ + C birleşimi
    };
    GRUP_ETIKET.i = GRUP_ETIKET.c = GRUP_ETIKET.u;          // eski i/c kodları U Grubu sayılır

    // Türkçe büyütme: "ipek" → "İ" (locale'siz toUpperCase "I" verirdi).
    function bas(isim) { return (isim || '?').trim().charAt(0).toLocaleUpperCase('tr'); }

    /* Avatar paleti: isimden türetilir; pastel zemin + koyu metin (WCAG AA).
       Tema paletinden bağımsızdır ki her temada okunaklı kalsın. */
    var AVATAR_PALET = [
        { zemin: '#fde4ec', metin: '#9d174d' },
        { zemin: '#dbeafe', metin: '#1e40af' },
        { zemin: '#dcfce7', metin: '#166534' },
        { zemin: '#fef3c7', metin: '#854d0e' },
        { zemin: '#ede9fe', metin: '#5b21b6' },
        { zemin: '#cffafe', metin: '#155e75' },
        { zemin: '#ffe4d5', metin: '#9a3412' },
        { zemin: '#e2e8f0', metin: '#334155' }
    ];
    function avatarRengi(isim) {
        var s = 0, t = String(isim || '');
        for (var i = 0; i < t.length; i++) s = (s * 31 + t.charCodeAt(i)) >>> 0;
        return AVATAR_PALET[s % AVATAR_PALET.length];
    }
    /** Uzun isimde yazı bir kademe küçülür — kart büyümez (yükseklik CSS'te sabit). */
    function boySinifi(isim) {
        var n = String(isim || '').trim().length;
        return n > 17 ? ' k2' : n > 11 ? ' k1' : '';
    }

    /* ---------------- Giriş: grup kartları ---------------- */
    function grupKartlari(gruplar, sec) {
        var kap = bosalt(el('grup-liste'));
        (gruplar || []).forEach(function (kod, i) {
            var t = GRUP_ETIKET[kod] || { ad: kod.toUpperCase() + ' Grubu', emoji: '🎲', renk: '#64748b' };
            var b = yap('button', { sinif: 'grup-kart', type: 'button', stil: 'border-color:' + t.renk },
                [yap('span', { sinif: 'g-emoji', metin: t.emoji }), yap('span', { metin: t.ad })]);
            b.style.animation = 'girisSuz .3s ' + (i * 0.05) + 's backwards';
            b.onclick = function () { sec(kod); };
            kap.appendChild(b);
        });
    }

    /* ---------------- Giriş: isim kartları ---------------- */
    function isimKarti(o, i, sec) {
        var r = avatarRengi(o.isim);
        // İsim ve rozet aynı sütunda: rozet yatayda yer kapıp ismi kelime ortasından bölmez.
        var b = yap('button', { sinif: 'isim-kart' + (o.dolu ? ' dolu' : ''), type: 'button' }, [
            yap('span', { sinif: 'balon', stil: 'background:' + r.zemin + ';color:' + r.metin, metin: bas(o.isim) }),
            yap('span', { sinif: 'metin' }, [
                yap('span', { sinif: 'ad' + boySinifi(o.isim), metin: o.isim }),
                o.dolu ? yap('span', { sinif: 'durum', metin: '🎮 oyunda' }) : null
            ])
        ]);
        b.style.animationDelay = Math.min(i * 0.035, 0.6) + 's';
        b.disabled = !!o.dolu;
        b.title = o.dolu ? 'Bu isim şu an başka bir cihazda. Öğretmenin serbest bırakabilir.' : o.isim;
        b.onclick = function () { b.classList.add('secildi'); sec(o.kod, o.isim); };
        return b;
    }
    function isimKartlari(paket, sec) {
        el('isim-baslik').textContent = paket.oyunSuruyor ? 'Oyun sürüyor — adını seç ve katıl' : 'Adına dokun';
        el('isim-alt').textContent = paket.oyunSuruyor
            ? 'Geç kalmadın: bir sonraki sorudan itibaren yarıştasın.'
            : (Tema.slogan() || 'Hazırsan başlıyoruz!');

        // Alfabetik (Türkçe) sıra; oyundakiler aktif kartların arasından çıkıp en alta iner.
        var tum = (paket.ogrenciler || []).slice()
            .sort(function (a, b) { return String(a.isim).localeCompare(String(b.isim), 'tr'); });
        var acik = tum.filter(function (o) { return !o.dolu; });
        var dolu = tum.filter(function (o) { return o.dolu; });

        var kap = bosalt(el('isim-izgara'));
        acik.forEach(function (o, i) { kap.appendChild(isimKarti(o, i, sec)); });
        var dk = bosalt(el('oyunda-izgara'));
        dolu.forEach(function (o, i) { dk.appendChild(isimKarti(o, i, sec)); });
        el('oyunda-blok').classList.toggle('gizli', !dolu.length);

        el('isim-bos').textContent = !tum.length
            ? 'Bu grupta aktif öğrenci görünmüyor — öğretmenine haber ver.'
            : (!acik.length ? 'Bütün isimler şu an oyunda — öğretmenin seni serbest bırakabilir.' : '');
    }

    /* ---------------- Lobi / bekleyiş ----------------
       Aynı ekran iki anda kullanılır: oyun başlamadan önce (LOBI) ve soru arası
       kişisel sonucu olmayan öğrenci için. Başlık duruma göre değişir ki kimse
       "Oyundasın · 0 oyuncu" gibi yanıltıcı bir ekranda kalmasın. */
    function lobi(durum) {
        var oyunSuruyor = durum.durum && durum.durum !== 'LOBI' && durum.durum !== 'BOSTA';
        el('lobi-sayi').textContent = durum.oyuncuSayisi || 0;
        el('lobi-baslik').textContent = oyunSuruyor ? 'Sıradaki soruyu bekle' : 'Oyundasın!';
        el('lobi-slogan').textContent = oyunSuruyor ? 'Öğretmenin soruyu açtığında ekranın kendiliğinden dönecek.' : (Tema.slogan() || '');
        if (el('lobi-emoji').dataset.durum !== String(durum.durum)) {
            var s = Tema.simgeler();
            el('lobi-emoji').textContent = oyunSuruyor ? '⏳' : s[Math.floor(Math.random() * s.length)];
            el('lobi-emoji').dataset.durum = String(durum.durum);
        }
    }

    /* ---------------- Soru ---------------- */
    function soru(paket, cevapla) {
        el('soru-no').textContent = paket.no + ' / ' + paket.toplam;
        el('soru-metin').textContent = paket.soru;
        var gor = bosalt(el('soru-gorsel'));
        if (paket.gorsel_svg) gor.innerHTML = paket.gorsel_svg;   // set içeriği (öğretmen kaynaklı)
        var kap = bosalt(el('sik-izgara'));
        (paket.secenekler || []).forEach(function (metin, i) {
            var t = Tema.sik(i);
            var b = yap('button', { sinif: 'sik', type: 'button', stil: 'background:' + t.renk },
                [yap('span', { sinif: 'isaret', html: t.ikon + '<b>' + t.harf + '</b>' }), yap('span', { metin: metin })]);
            b.onclick = function () { cevapla(i, b); };
            kap.appendChild(b);
        });
    }
    function sikleriKilitle(secilen) {
        UI.hepsi('#sik-izgara .sik').forEach(function (b, i) {
            b.disabled = true;
            if (i === secilen) b.classList.add('secili');
        });
    }
    /** Süre görüntüsü — karar sunucunun, bu yalnız gösterge. */
    function sureCiz(kalanMs, toplamMs) {
        var oran = toplamMs > 0 ? Math.max(0, Math.min(1, kalanMs / toplamMs)) : 0;
        var d = el('sure-dolgu'), s = el('sure-sayi'), kalanSn = UI.sn(kalanMs);
        d.style.width = (oran * 100) + '%';
        d.classList.toggle('az', oran <= .5 && oran > .2);
        d.classList.toggle('kritik', oran <= .2);
        s.textContent = kalanSn;
        s.classList.toggle('kritik', kalanSn <= 5);
    }

    /* ---------------- Anlatım (öğretmen soruyu çözerken) ----------------
       Salt görüntüdür: şıklar düğme DEĞİL, doğru şık yeşil vurgulu, her şıkta kaç
       kişinin işaretlediği yazar. Paket sunucudan gelir; burada hesap yapılmaz. */
    function anlatim(p) {
        var bos = !p;
        el('anl-govde').classList.toggle('gizli', bos);
        el('anl-no').textContent = (!bos && p.no) ? (p.no + ' / ' + p.toplam) : '';
        el('anl-not').textContent = bos
            ? 'Öğretmenin tahtadan anlatıyor — birlikte bakıyoruz 👀'
            : 'Şu an cevap veremezsin — doğru cevap yeşil kutuda 👀';
        if (bos) return;

        el('anl-metin').textContent = p.soru || '';
        var gor = bosalt(el('anl-gorsel'));
        if (p.gorsel_svg) gor.innerHTML = p.gorsel_svg;    // set içeriği (öğretmen kaynaklı)

        var kap = bosalt(el('anl-sikler'));
        var dagilim = p.dagilim || null;
        (p.secenekler || []).forEach(function (metin, i) {
            var t = Tema.sik(i), dogruMu = i === p.dogru;
            var cocuklar = [
                yap('span', { sinif: 'isaret', html: t.ikon + '<b>' + t.harf + '</b>' }),
                yap('span', { sinif: 'as-metin', metin: metin })
            ];
            if (dagilim) cocuklar.push(yap('span', { sinif: 'as-sayi', title: 'Bu şıkkı işaretleyen kişi sayısı', metin: (dagilim[i] || 0) + ' kişi' }));
            if (dogruMu) cocuklar.push(yap('span', { sinif: 'as-dogru', metin: '✔ doğru' }));
            var d = yap('div', { sinif: 'sik anlat-sik' + (dogruMu ? ' dogru' : ' pasif'), stil: 'background:' + t.renk }, cocuklar);
            d.style.animationDelay = (i * 0.06) + 's';
            kap.appendChild(d);
        });

        var ac = el('anl-aciklama');
        ac.textContent = p.aciklama || '';
        ac.classList.toggle('gizli', !p.aciklama);
    }

    /* ---------------- Kişisel sonuç ---------------- */
    function sonuc(r, secenekler) {
        var kart = el('sonuc-kart');
        kart.className = 'sonuc-kart ' + (r.dogru ? 'dogru' : 'yanlis');
        el('sonuc-emoji').textContent = r.dogru ? '🎉' : (r.cevaplandi ? '🌱' : '⏰');
        el('sonuc-soz').textContent = r.soz || '';
        UI.sayacAnimasyon(el('sonuc-puan'), r.puan || 0, 800);
        UI.sayacAnimasyon(el('sonuc-toplam'), r.toplam || 0, 900);
        el('sonuc-sira').textContent = r.sira || '-';
        el('ss-seri').classList.toggle('gizli', !(r.seri > 0));
        el('sonuc-seri').textContent = (r.seri || 0) + (r.seri >= 3 ? ' 🔥' : '');

        var f = el('sonuc-fark');
        if (r.sira === 1) f.textContent = '👑 Zirvedesin!';
        else if (r.ondekiFark > 0) f.textContent = 'Öndeki oyuncuya ' + UI.bashariler(r.ondekiFark) + ' puan!';
        else f.textContent = '';

        var rz = bosalt(el('sonuc-rozet'));
        (r.rozetler || []).forEach(function (x, i) {
            var s = yap('span', { sinif: 'rozet-kart', title: rozetAdi(x) },
                [yap('b', { metin: x }), yap('small', { metin: rozetAdi(x) })]);
            s.style.animationDelay = (0.15 + i * 0.12) + 's';
            rz.appendChild(s);
        });

        // Doğru cevabı yalnız soru KAPANDIKTAN sonra, sunucudan geldiği gibi gösteririz.
        var ac = el('sonuc-aciklama');
        var sikMetin = (secenekler && secenekler[r.dogruCevap] !== undefined) ? secenekler[r.dogruCevap] : null;
        var parca = [];
        if (sikMetin !== null) parca.push('Doğru cevap: ' + Tema.sik(r.dogruCevap).harf + ') ' + sikMetin);
        if (r.aciklama) parca.push(r.aciklama);
        ac.textContent = parca.join(' — ');
        ac.classList.toggle('gizli', !parca.length);
    }
    function rozetAdi(e) {
        return { '🚀': 'En Hızlı Parmak', '🔥': 'Seri Ustası', '📈': 'Yükseliş Yıldızı', '🎯': 'Keskin Nişancı' }[e] || '';
    }

    /* ---------------- Sıralama gösterimi ---------------- */
    function siralamaAsama(ad) {
        ['sir-gerisayim', 'sir-bekleme', 'sir-gizli', 'sir-sonuc'].forEach(function (id) {
            el(id).classList.toggle('gizli', id !== 'sir-' + ad);
        });
    }
    function siralamaSonuc(p) {
        siralamaAsama('sonuc');
        var liste = bosalt(el('sir-liste'));
        if (p.kapsam === 'tam' && p.liste) {
            el('sir-baslik').textContent = 'Sıralama';
            el('sir-buyuk').textContent = p.sira + '.';
            el('sir-alt').textContent = p.toplam + ' oyuncu arasında';
            p.liste.forEach(function (s) {
                liste.appendChild(yap('div', { sinif: 'sir-satir' + (s.sen ? ' sen' : '') }, [
                    yap('span', { sinif: 'no', metin: s.sira + '.' }),
                    yap('span', { metin: s.isim }),
                    yap('span', { sinif: 'pu', metin: UI.bashariler(s.score) })
                ]));
            });
        } else {
            el('sir-baslik').textContent = 'Sıralaman';
            el('sir-buyuk').textContent = p.sira + '.';
            el('sir-alt').textContent = p.toplam + ' oyuncu arasında' + (p.score !== undefined ? ' · ' + UI.bashariler(p.score) + ' puan' : '');
        }
    }

    /* ---------------- Final ---------------- */
    function final(podyum, ben) {
        var kap = bosalt(el('final-podyum'));
        var sira = [1, 0, 2];   // görsel düzen: 2 · 1 · 3
        var madalya = ['🥇', '🥈', '🥉'];
        sira.forEach(function (i, gorunum) {
            var p = podyum && podyum[i]; if (!p) return;
            var d = yap('div', { sinif: 'pod p' + (i + 1) }, [
                yap('div', { sinif: 'madalya', metin: madalya[i] }),
                yap('div', { sinif: 'ad', metin: p.isim }),
                yap('div', { sinif: 'pu', metin: UI.bashariler(p.score) + ' puan' })
            ]);
            d.style.animationDelay = (0.5 - gorunum * 0.15) + 's';   // 3 → 2 → 1 sırasıyla belirsin
            kap.appendChild(d);
        });
        if (!kap.children.length) kap.appendChild(yap('p', { sinif: 'alt', metin: 'Bu turda podyum yok.' }));

        var oz = bosalt(el('final-ozet'));
        if (!ben) { oz.classList.add('gizli'); return; }
        oz.classList.remove('gizli');
        var satir = function (a, b) { return yap('div', { sinif: 'ozet-satir' }, [yap('span', { metin: a }), yap('strong', { metin: b })]); };
        oz.appendChild(yap('h3', { metin: 'Senin özetin' }));
        if (ben.sira) oz.appendChild(satir('Sıran', ben.sira + (ben.toplamOyuncu ? ' / ' + ben.toplamOyuncu : '')));
        oz.appendChild(satir('Toplam puan', UI.bashariler(ben.toplam || 0)));
        oz.appendChild(satir('En uzun seri', (ben.enUzunSeri || 0) + ' 🔥'));
        if (ben.rozetler && ben.rozetler.length) {
            oz.appendChild(satir('Rozetlerin', ben.rozetler.map(function (r) { return r + ' ' + rozetAdi(r); }).join('  ')));
        }
    }

    g.Ekranlar = {
        grupKartlari: grupKartlari, isimKartlari: isimKartlari, lobi: lobi,
        soru: soru, sikleriKilitle: sikleriKilitle, sureCiz: sureCiz, anlatim: anlatim,
        sonuc: sonuc, siralamaAsama: siralamaAsama, siralamaSonuc: siralamaSonuc,
        final: final, rozetAdi: rozetAdi, GRUP_ETIKET: GRUP_ETIKET
    };
})(window);
