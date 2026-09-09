/* Mod katmanı — panelin format seçicisi ve "Mod durumu" görünümü.
   Hiçbir mod kuralı burada yaşamaz: sunucudan gelen admin_state.meta olduğu gibi çizilir.
   (Meta'da isimler gelir; öğretmen paneli zaten isim görebilen tek ekrandır.) */
(function (g) {
    'use strict';
    var el = UI.el, yap = UI.yap, bosalt = UI.bosalt;
    var ctx = null, sonFormat = null, gecerliFormat = 'yaris';
    var sonDogruSayisi = null;   // question_end.dagilim[dogru] — fetih düğmesinin pasifliği için

    var FORMAT = {
        yaris:         { ad: '🏁 Yarış',            ozet: 'Klasik: hız bonusu + seri çarpanı. Meta yok.' },
        fetih:         { ad: '🗺️ Fetih',            ozet: 'Soru bitince fetih aşamasını SİZ açarsınız; doğru cevaplayanlar haritadan kare seçer.' },
        kalkan_roket:  { ad: '🛡️🚀 Kalkan & Roket', ozet: 'Doğru cevap eşya kazandırır: kalkan · roket · ipucu · çift puan.' },
        donen_duello:  { ad: '⚔️ Dönen Düello',     ozet: 'Her soruda yeni ikili eşleşme; turu kazanan bonus alır.' },
        eleme_duello:  { ad: '🏟️ Eleme Düellosu',   ozet: 'Her soru bir maçtır; braket kendiliğinden ilerler. Elenenler gölge liginde oynamayı sürdürür.' }
    };
    // Fetih haritasında oyuncu renkleri (renk + baş harf birlikte; yalnız renkle ayrım yok)
    var RENKLER = ['#e0364f', '#1668c1', '#d38b00', '#127a4a', '#7c3aed', '#0e7490', '#be185d', '#4d7c0f', '#b45309', '#0f766e'];

    function kur(c) {
        ctx = c;
        el('format-sec').onchange = function () {
            var sec = this.value;
            ctx.gonder('format_sec', { format: sec }, function (r) {
                // Sunucu reddederse (ör. oyun başlamışsa) yayın gelmez; seçiciyi geri al.
                if (!r || r.ok === false) el('format-sec').value = gecerliFormat;
            });
        };
    }

    /** admin_state.formatlar[] geldiğinde seçenekleri yazar. */
    function formatlariYaz(liste, secili) {
        var sel = el('format-sec');
        if (sel.dataset.dolu !== String((liste || []).join(','))) {
            bosalt(sel);
            (liste || ['yaris']).forEach(function (f) {
                sel.appendChild(yap('option', { value: f, metin: (FORMAT[f] || {}).ad || f }));
            });
            sel.dataset.dolu = (liste || []).join(',');
        }
        if (secili) sel.value = secili;
    }

    /** question_end {dagilim[], dogru} — "bu turda doğru cevaplayan var mı" bilgisi.
        Panel sonradan açılırsa null kalır; o zaman düğme pasifleştirilmez, son sözü sunucu söyler. */
    function turSonucu(e) {
        sonDogruSayisi = (e && Array.isArray(e.dagilim) && e.dogru !== undefined) ? (e.dagilim[e.dogru] || 0) : null;
    }

    function durum(s) {
        formatlariYaz(s.formatlar, s.format);
        if (s.durum === 'SORUDA') sonDogruSayisi = null;    // yeni tur: önceki turun sonucu geçersiz
        var f = s.format || 'yaris', bilgi = FORMAT[f] || { ad: f, ozet: '' };
        gecerliFormat = f;
        var degistirilebilir = s.durum === 'BOSTA' || s.durum === 'LOBI';

        el('format-sec').disabled = !degistirilebilir;
        el('format-not').textContent = degistirilebilir
            ? bilgi.ozet
            : bilgi.ozet + '  (Format yalnız oyun başlamadan seçilir.)';
        el('format-not').classList.toggle('kilit-not', !degistirilebilir);

        var rozet = el('p-format');
        rozet.classList.toggle('gizli', f === 'yaris');
        rozet.textContent = bilgi.ad;

        var bolum = el('mod-bolum');
        bolum.classList.toggle('gizli', f === 'yaris');
        if (f === 'yaris') { sonFormat = f; return; }
        el('mod-baslik').textContent = bilgi.ad + ' — mod durumu';
        if (sonFormat !== f) { bolum.open = true; sonFormat = f; }   // format değişince bir kez aç
        if (f === 'fetih' && s.durum === 'SORU_ARASI') bolum.open = true;   // bağlam düğmesi gömülü kalmasın
        ciz(s.meta || {}, s);
    }

    /* ---------------- Meta çizimi ---------------- */
    function ciz(meta, s) {
        var k = bosalt(el('mod-ic'));
        if (meta.format === 'fetih') return fetih(k, meta, s);
        if (meta.format === 'kalkan_roket') return kalkanRoket(k, meta, s);
        if (meta.format === 'donen_duello') return duello(k, meta);
        if (meta.format === 'eleme_duello') return eleme(k, meta);
        k.appendChild(yap('p', { sinif: 'not', metin: 'Bu format için henüz gösterilecek durum yok.' }));
    }

    function renkHarita(isimler) {
        var m = {}, i = 0;
        isimler.forEach(function (n) { if (n && m[n] === undefined) m[n] = RENKLER[i++ % RENKLER.length]; });
        return m;
    }
    function bas(n) { return (n || '?').trim().charAt(0).toUpperCase(); }

    function fetih(k, meta, s) {
        fetihDugmesi(k, meta, s || {});
        var harita = meta.harita || [], boyut = meta.boyut || 6;
        var renk = renkHarita((meta.topraklar || []).map(function (t) { return t.isim; }));
        var izgara = yap('div', { sinif: 'fetih-izgara', stil: 'grid-template-columns:repeat(' + boyut + ',1fr)' });
        harita.forEach(function (sahip, i) {
            izgara.appendChild(yap('div', {
                sinif: 'fk' + (sahip ? ' dolu' : ''),
                stil: sahip ? 'background:' + (renk[sahip] || '#64748b') : '',
                title: sahip ? sahip + ' · kare ' + (i + 1) : 'boş · kare ' + (i + 1),
                metin: sahip ? bas(sahip) : ''
            }));
        });
        k.appendChild(izgara);

        var alinan = harita.filter(Boolean).length;
        k.appendChild(yap('p', { sinif: 'not', metin: alinan + ' / ' + harita.length + ' kare alındı' }));
        var liste = yap('div', { sinif: 'mod-liste' });
        (meta.topraklar || []).forEach(function (t) {
            liste.appendChild(yap('div', { sinif: 'mod-satir' }, [
                yap('span', { sinif: 'mod-nokta', stil: 'background:' + (renk[t.isim] || '#64748b'), metin: bas(t.isim) }),
                yap('span', { metin: t.isim }),
                yap('strong', { metin: t.kare + ' kare' })
            ]));
        });
        if (!(meta.topraklar || []).length) liste.appendChild(yap('p', { sinif: 'not', metin: 'Henüz kimse kare almadı.' }));
        k.appendChild(liste);
    }

    /* Fetih formatının TEK bağlam düğmesi (SADELİK KURALI: formatta en fazla bir düğme).
       Yalnız SORU_ARASI'nda görünür; cevapsız turda pasiftir. */
    function fetihDugmesi(k, meta, s) {
        if (s.durum !== 'SORU_ARASI') {
            if (s.durum === 'SORUDA') k.appendChild(yap('p', { sinif: 'not', metin: 'Soru sürüyor — fetih aşaması soru bitince açılabilir.' }));
            return;
        }
        var acik = meta.asama === 'fetih';
        var cevapsiz = sonDogruSayisi === 0;
        var satir = yap('div', { sinif: 'kontrol-satir fetih-satir' });
        var d = yap('button', {
            sinif: 'dug buyuk ' + (acik ? 'mavi' : 'yesil'), type: 'button',
            metin: acik ? '🏁 Fetih Aşamasını Bitir' : '🗺️ Fetih Aşamasını Başlat'
        });
        if (!acik && cevapsiz) {
            d.disabled = true;
            d.title = 'Bu turda doğru cevaplayan yok — fetih aşaması açılamaz.';
        }
        d.onclick = function () { ctx.gonder(acik ? 'fetih_bitir' : 'fetih_baslat', {}); };
        satir.appendChild(d);
        satir.appendChild(yap('span', { sinif: 'not', metin: acik
            ? 'Hak sahipleri kendi ekranlarından kare seçiyor · ' + (meta.bekleyenHak || 0) + ' hak bekliyor. Bitirince normal akışa (Sıradaki Soru) dönersiniz.'
            : (cevapsiz ? '⚠️ Bu turda doğru cevaplayan yok — aşama açılamaz, doğrudan Sıradaki Soru\'ya geçin.'
                        : 'Aşama açılınca doğru cevaplayanlar 6×6 haritadan kare seçer; onların toprakları bu turda korumalıdır.') }));
        k.appendChild(satir);
    }

    var ESYA_AD = { kalkan: '🛡️ kalkan', roket: '🚀 roket', ipucu: '💡 ipucu', cift: '⚡ çift puan' };
    function kalkanRoket(k, meta, s) {
        var sayilar = meta.esyaSayilari || {};
        k.appendChild(yap('p', { sinif: 'not', metin: 'Doğru cevap veren her öğrenci bir eşya kazanır. Roket yalnız kendinden YUKARIDAKİNE atılır; kalkan kendiliğinden savar. Eleme yoktur.' }));
        var liste = yap('div', { sinif: 'mod-liste' });
        var oyuncular = (s.oyuncular || []).slice().sort(function (a, b) { return b.score - a.score; });
        oyuncular.forEach(function (p) {
            var n = sayilar[p.isim] || 0;
            liste.appendChild(yap('div', { sinif: 'mod-satir' }, [
                yap('span', { sinif: 'mod-nokta', metin: bas(p.isim) }),
                yap('span', { metin: p.isim }),
                yap('span', { sinif: 'not', metin: p.kod }),
                yap('strong', { metin: n + ' eşya' })
            ]));
        });
        if (!oyuncular.length) liste.appendChild(yap('p', { sinif: 'not', metin: 'Henüz oyuncu yok.' }));
        k.appendChild(liste);
        k.appendChild(yap('p', { sinif: 'not', metin: 'Envanterin içeriği yalnız öğrencinin kendi ekranında görünür (' + Object.keys(ESYA_AD).map(function (x) { return ESYA_AD[x]; }).join(' · ') + ').' }));
    }

    function duello(k, meta) {
        var esler = meta.esler || [], kazanilan = meta.kazanilan || {};
        k.appendChild(yap('p', { sinif: 'not', metin: 'Eşleşmeler her soru başında yeniden karılır. Tek kalan öğrenci o turda serbesttir; doğru cevaplarsa bonus alır.' }));
        var liste = yap('div', { sinif: 'mod-liste' });
        esler.forEach(function (c) {
            liste.appendChild(yap('div', { sinif: 'mod-satir es' }, [
                yap('span', { metin: c[0] }),
                yap('span', { sinif: 'vs', metin: '⚔️' }),
                yap('span', { metin: c[1] })
            ]));
        });
        if (!esler.length) liste.appendChild(yap('p', { sinif: 'not', metin: 'Eşleşme soru başlayınca kurulur.' }));
        k.appendChild(liste);

        var kz = Object.keys(kazanilan);
        if (kz.length) {
            k.appendChild(yap('h4', { sinif: 'mod-alt', metin: 'Kazanılan düellolar' }));
            var l2 = yap('div', { sinif: 'mod-liste' });
            kz.sort(function (a, b) { return kazanilan[b] - kazanilan[a]; }).forEach(function (isim) {
                l2.appendChild(yap('div', { sinif: 'mod-satir' }, [
                    yap('span', { sinif: 'mod-nokta', metin: bas(isim) }),
                    yap('span', { metin: isim }),
                    yap('strong', { metin: kazanilan[isim] + '×' })
                ]));
            });
            k.appendChild(l2);
        }
    }

    /* Eleme Düellosu — saf bilgi görünümü; panele hiçbir düğme eklenmez (braket otomatiktir). */
    function eleme(k, meta) {
        if (meta.sampiyon) {
            k.appendChild(yap('div', { sinif: 'sampiyon-serit' }, [
                yap('span', { sinif: 'ss-im', metin: '🏆' }),
                yap('span', { html: 'ŞAMPİYON: <strong>' + UI.kacir(meta.sampiyon) + '</strong>' })
            ]));
        }
        var bas_ = yap('div', { sinif: 'braket-bas' }, [
            yap('strong', { metin: meta.turAdi || 'Tur kuruluyor' }),
            yap('span', { sinif: 'not', metin: (meta.kalanlar || []).length + ' oyuncu yarışta · ' + (meta.elenenSayisi || 0) + ' elendi (gölge liginde oynamayı sürdürüyor)' })
        ]);
        k.appendChild(bas_);

        if (meta.aktifMac) {
            k.appendChild(yap('div', { sinif: 'aktif-mac' }, [
                yap('span', { sinif: 'am-etiket', metin: '🔴 Şu anki maç' }),
                yap('span', { sinif: 'am-ad', metin: meta.aktifMac.p1 }),
                yap('span', { sinif: 'am-vs', metin: '⚔' }),
                yap('span', { sinif: 'am-ad', metin: meta.aktifMac.p2 })
            ]));
        }

        // Braket ağacı: bu turun maçları, sonuçlarıyla
        var maclar = meta.maclar || [];
        k.appendChild(yap('h4', { sinif: 'mod-alt', metin: '🌳 Braket — ' + (meta.turAdi || '') }));
        var agac = yap('div', { sinif: 'braket' });
        if (!maclar.length) agac.appendChild(yap('p', { sinif: 'not', metin: 'Maçlar ilk soruyla kurulur.' }));
        maclar.forEach(function (m, i) {
            var oynandi = !!m.kazanan || m.berabere;
            var suan = meta.aktifMac && meta.aktifMac.p1 === m.p1 && meta.aktifMac.p2 === m.p2;
            var satir = yap('div', { sinif: 'br-mac' + (suan ? ' suan' : '') + (oynandi ? ' bitti' : '') }, [
                yap('span', { sinif: 'br-no', metin: (i + 1) + '.' }),
                yap('span', { sinif: 'br-ad' + (m.kazanan === m.p1 ? ' kazandi' : (oynandi ? ' elendi' : '')), metin: m.p1 }),
                yap('span', { sinif: 'br-vs', metin: m.berabere ? '💥' : '⚔' }),
                yap('span', { sinif: 'br-ad' + (m.kazanan === m.p2 ? ' kazandi' : (oynandi ? ' elendi' : '')), metin: m.p2 }),
                yap('span', { sinif: 'br-sonuc', metin: m.berabere ? 'ikisi de elendi' : (m.kazanan ? m.kazanan + ' geçti' : (suan ? 'oynanıyor' : 'bekliyor')) })
            ]);
            agac.appendChild(satir);
        });
        if (meta.bay) agac.appendChild(yap('div', { sinif: 'br-bay', metin: '🎫 Bay geçen: ' + meta.bay }));
        k.appendChild(agac);

        // Yarışta kalanlar
        k.appendChild(yap('h4', { sinif: 'mod-alt', metin: '🟢 Yarışta kalanlar' }));
        var kal = yap('div', { sinif: 'kalan-liste' });
        (meta.kalanlar || []).forEach(function (n) { kal.appendChild(yap('span', { sinif: 'kalan-rozet', metin: n })); });
        if (!(meta.kalanlar || []).length) kal.appendChild(yap('span', { sinif: 'not', metin: 'Henüz kimse yok.' }));
        k.appendChild(kal);

        // Gölge ligi ilk 5 (elenenler oynamayı sürdürür; ölçüm kesilmez)
        k.appendChild(yap('h4', { sinif: 'mod-alt', metin: '👻 Gölge ligi — ilk 5' }));
        var gl = yap('div', { sinif: 'mod-liste' });
        (meta.golgeLigi || []).forEach(function (x, i) {
            gl.appendChild(yap('div', { sinif: 'mod-satir' }, [
                yap('span', { sinif: 'mod-nokta', metin: String(i + 1) }),
                yap('span', { metin: x.isim }),
                yap('strong', { metin: UI.bashariler(x.score) + ' puan' })
            ]));
        });
        if (!(meta.golgeLigi || []).length) gl.appendChild(yap('p', { sinif: 'not', metin: 'Henüz elenen yok.' }));
        k.appendChild(gl);
    }

    g.Mod = { kur: kur, durum: durum, turSonucu: turSonucu, FORMAT: FORMAT };
})(window);
