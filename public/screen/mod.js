/* Sahnenin MOD katmanı yüzü (PROTOKOL Bölüm 4).
   public_state.meta ve question_end.meta olduğu gibi çizilir; hiçbir şey hesaplanmaz.
   Yarış akışının sahnesi (3-2-1, dağılım, podyum) bu katmandan bağımsız aynen sürer. */
(function (g) {
    'use strict';
    var el = UI.el, yap = UI.yap, bosalt = UI.bosalt;

    var FORMAT_AD = { fetih: '🗺️ Fetih', kalkan_roket: '🛡️🚀 Kalkan & Roket', donen_duello: '⚔️ Dönen Düello', eleme_duello: '🏟️ Eleme Düellosu' };
    var ESYA_IM = { kalkan: '🛡️', roket: '🚀', ipucu: '🔍', cift: '⚡' };
    var RENKLER = ['#e0364f', '#1668c1', '#d38b00', '#127a4a', '#7c3aed', '#0e7490', '#be185d', '#4d7c0f', '#b45309', '#0f766e'];

    var sonHarita = [];        // "yeni fethedilen hücre" animasyonu için önceki kare sahipleri
    var oncekiKazanilan = {};  // düelloda BU TURUN kazananını bulmak için önceki sayaç anlık görüntüsü
    var renkler = {};
    var fetihAcik = false, hakSahipleri = [], sonSampiyon = null;

    function renk(isim) {
        if (!isim) return null;
        if (!renkler[isim]) renkler[isim] = RENKLER[Object.keys(renkler).length % RENKLER.length];
        return renkler[isim];
    }
    function bas(n) { return (n || '?').trim().charAt(0).toUpperCase(); }

    function sifirla() {
        sonHarita = []; oncekiKazanilan = {}; renkler = {}; fetihAcik = false; hakSahipleri = []; sonSampiyon = null;
        bosalt(el('haber-akis'));
        el('s-sonuc').classList.remove('fetih-modu', 'sampiyon-modu');
    }

    /** Fetih aşaması açık/kapalı — açıkken harita sahnenin ortasına büyür. */
    function fetihAsamasi(acik, kimler) {
        fetihAcik = !!acik; hakSahipleri = kimler || [];
        el('s-sonuc').classList.toggle('fetih-modu', fetihAcik);
        if (!fetihAcik) bosalt(el('haber-akis'));
    }

    /** Haber akışı: son 4 olay üstte durur, eskisi süzülerek çıkar. */
    function haber(h) {
        var kap = el('haber-akis');
        var k = yap('div', { sinif: 'haber ' + (h.sinif || '') }, [
            yap('span', { sinif: 'hb-im', metin: h.im }),
            yap('span', { sinif: 'hb-metin', html: h.metin })
        ]);
        kap.insertBefore(k, kap.firstChild);
        while (kap.children.length > 4) kap.removeChild(kap.lastChild);
        setTimeout(function () { if (k.parentNode) { k.classList.add('cikiyor'); setTimeout(function () { if (k.parentNode) k.remove(); }, 500); } }, 6000);
    }

    /** Üst şeritteki format rozeti. */
    function rozet(meta) {
        var d = el('s-format'), f = meta && meta.format;
        var ad = FORMAT_AD[f] || '';
        d.textContent = ad;
        d.classList.toggle('gizli', !ad);
    }

    /** durum: 'LOBI' | 'SORUDA' | 'ARASI' — hangi kapsayıcıya çizileceğini belirler. */
    function ciz(meta, durum, oyuncuSayisi) {
        rozet(meta);
        var hedefId = durum === 'LOBI' ? 's-mod-lobi' : durum === 'SORUDA' ? 's-mod-soru' : 's-mod-arasi';
        ['s-mod-lobi', 's-mod-soru', 's-mod-arasi'].forEach(function (id) {
            if (id !== hedefId) el(id).classList.add('gizli');
        });
        var k = el(hedefId);
        if (!meta || !meta.format || meta.format === 'yaris') { k.classList.add('gizli'); return; }
        k.classList.remove('gizli');
        bosalt(k);

        if (meta.format === 'fetih') return fetih(k, meta, durum);
        if (meta.format === 'kalkan_roket') return kalkanRoket(k, meta, durum);
        if (meta.format === 'donen_duello') return duello(k, meta, durum);
        if (meta.format === 'eleme_duello') return eleme(k, meta, durum);
    }

    /* ---------------- Eleme Düellosu ---------------- */
    function eleme(k, meta, durum) {
        el('s-sonuc').classList.toggle('sampiyon-modu', !!meta.sampiyon && durum !== 'SORUDA');
        // Şampiyon: sahnenin tamamını alan kutlama
        if (meta.sampiyon) {
            var yeniSampiyon = sonSampiyon !== meta.sampiyon;
            sonSampiyon = meta.sampiyon;
            k.appendChild(yap('div', { sinif: 'sampiyon-sahne' }, [
                yap('div', { sinif: 'sa-tac', metin: '🏆' }),
                yap('div', { sinif: 'sa-etiket', metin: 'ŞAMPİYON' }),
                yap('div', { sinif: 'sa-ad', metin: meta.sampiyon })
            ]));
            var g1 = (meta.golgeLigi || [])[0];
            if (g1) k.appendChild(yap('div', { sinif: 'golge-birinci' }, [
                yap('span', { sinif: 'gb-im', metin: '👻' }),
                yap('span', { html: 'Gölge ligi birincisi: <strong>' + UI.kacir(g1.isim) + '</strong> · ' + UI.bashariler(g1.score) + ' puan' })
            ]));
            if (yeniSampiyon && !FX.azHareket) FX.konfeti(5000, 200);
            return;
        }

        // Soru başında: MAÇ KARTI (X ⚔ Y + tur adı)
        if (durum === 'SORUDA') {
            if (!meta.aktifMac) { k.appendChild(yap('span', { sinif: 'sm-bos', metin: 'Braket kuruluyor…' })); return; }
            k.appendChild(yap('div', { sinif: 'mac-kart' }, [
                yap('span', { sinif: 'mk-tur', metin: '🏟️ ' + (meta.turAdi || '') }),
                yap('span', { sinif: 'mk-ad', metin: meta.aktifMac.p1 }),
                yap('span', { sinif: 'mk-vs', metin: '⚔' }),
                yap('span', { sinif: 'mk-ad', metin: meta.aktifMac.p2 }),
                yap('span', { sinif: 'mk-golge', metin: '👻 ' + (meta.elenenSayisi || 0) + ' kişi gölge liginde' })
            ]));
            return;
        }

        // Soru arası: bu turun maç sonucu vurgulanır + braket
        k.appendChild(yap('h3', { sinif: 'sm-bas', metin: '🏟️ ' + (meta.turAdi || 'Braket') }));
        var maclar = meta.maclar || [];
        var sonOynanan = null;
        for (var i = maclar.length - 1; i >= 0; i--) { if (maclar[i].kazanan || maclar[i].berabere) { sonOynanan = maclar[i]; break; } }
        if (sonOynanan) {
            k.appendChild(yap('div', { sinif: 'mac-sonuc' + (sonOynanan.berabere ? ' berabere' : '') }, [
                yap('span', { sinif: 'ms-ad' + (sonOynanan.kazanan === sonOynanan.p1 ? ' kazandi' : ' elendi'), metin: sonOynanan.p1 }),
                yap('span', { sinif: 'ms-orta', metin: sonOynanan.berabere ? '💥' : '🏆' }),
                yap('span', { sinif: 'ms-ad' + (sonOynanan.kazanan === sonOynanan.p2 ? ' kazandi' : ' elendi'), metin: sonOynanan.p2 }),
                yap('span', { sinif: 'ms-not', metin: sonOynanan.berabere
                    ? 'İkisi de bilemedi — ikisi de gölge ligine geçti!'
                    : UI.kacir(sonOynanan.kazanan) + ' bir tur daha!' })
            ]));
        }
        var liste = yap('div', { sinif: 'braket-sahne' });
        maclar.forEach(function (m) {
            var oynandi = !!m.kazanan || m.berabere;
            liste.appendChild(yap('div', { sinif: 'bs-mac' + (oynandi ? ' bitti' : '') }, [
                yap('span', { sinif: 'bs-ad' + (m.kazanan === m.p1 ? ' kazandi' : (oynandi ? ' elendi' : '')), metin: m.p1 }),
                yap('span', { sinif: 'bs-vs', metin: m.berabere ? '💥' : '⚔' }),
                yap('span', { sinif: 'bs-ad' + (m.kazanan === m.p2 ? ' kazandi' : (oynandi ? ' elendi' : '')), metin: m.p2 })
            ]));
        });
        if (meta.bay) liste.appendChild(yap('div', { sinif: 'bs-bay', metin: '🎫 ' + meta.bay + ' bay geçti' }));
        if (!maclar.length) liste.appendChild(yap('p', { sinif: 'sm-bos', metin: 'Maçlar ilk soruyla kurulur.' }));
        k.appendChild(liste);

        var gl = meta.golgeLigi || [];
        if (gl.length) {
            k.appendChild(yap('h3', { sinif: 'sm-bas', metin: '👻 Gölge ligi' }));
            var l = yap('div', { sinif: 'sm-liste' });
            gl.slice(0, 5).forEach(function (x, i) {
                l.appendChild(yap('div', { sinif: 'sm-satir' }, [
                    yap('i', { stil: 'background:' + renk(x.isim), metin: String(i + 1) }),
                    yap('span', { metin: x.isim }),
                    yap('strong', { metin: UI.bashariler(x.score) })
                ]));
            });
            k.appendChild(l);
        }
    }

    /* ---------------- Fetih ---------------- */
    function fetih(k, meta, durum) {
        var harita = meta.harita || [], boyut = meta.boyut || 6;
        (meta.topraklar || []).forEach(function (t) { renk(t.isim); });

        if (durum === 'SORUDA') {   // soru sırasında yalnız ince bir özet (dikkat dağıtmasın)
            k.appendChild(yap('span', { sinif: 'sm-im', metin: '🗺️' }));
            (meta.topraklar || []).slice(0, 6).forEach(function (t) {
                k.appendChild(yap('span', { sinif: 'sm-rozet' }, [
                    yap('i', { stil: 'background:' + renk(t.isim), metin: bas(t.isim) }),
                    yap('span', { metin: t.isim + ' · ' + t.kare })
                ]));
            });
            if (!(meta.topraklar || []).length) k.appendChild(yap('span', { sinif: 'sm-bos', metin: 'Harita boş — ilk kareyi kim alacak?' }));
            sonHarita = harita.slice();
            return;
        }

        var korunan = (meta.korumali || []).concat(meta.kalkanli || []);
        var izgara = yap('div', { sinif: 'sh-izgara' + (fetihAcik ? ' buyuk' : ''), stil: 'grid-template-columns:repeat(' + boyut + ',1fr)' });
        harita.forEach(function (sahip, i) {
            var yeni = sahip && sonHarita[i] !== sahip;
            var korumali = sahip && korunan.indexOf(sahip) > -1;
            var h = yap('div', {
                sinif: 'sh' + (sahip ? ' dolu' : '') + (yeni ? ' yeni' : '') + (korumali ? ' korumali' : ''),
                stil: sahip ? 'background:' + renk(sahip) : '',
                title: sahip || 'boş'
            }, [
                yap('span', { metin: sahip ? bas(sahip) : '' }),
                korumali ? yap('i', { sinif: 'sh-kalkan', metin: '🛡️' }) : null
            ]);
            if (yeni && !FX.azHareket) h.style.animationDelay = (Math.random() * 0.25).toFixed(2) + 's';
            izgara.appendChild(h);
        });
        k.appendChild(yap('h3', { sinif: 'sm-bas', metin: fetihAcik ? '🗺️ FETİH ZAMANI — kareler seçiliyor!' : '🗺️ Harita' }));
        if (fetihAcik && hakSahipleri.length) {
            k.appendChild(yap('p', { sinif: 'hak-serit', metin: '⚔️ Seçim sırası: ' + hakSahipleri.join(' · ') }));
        }
        k.appendChild(izgara);

        var liste = yap('div', { sinif: 'sm-liste' });
        (meta.topraklar || []).slice(0, 6).forEach(function (t) {
            liste.appendChild(yap('div', { sinif: 'sm-satir' }, [
                yap('i', { stil: 'background:' + renk(t.isim), metin: bas(t.isim) }),
                yap('span', { metin: t.isim }),
                yap('strong', { metin: t.kare })
            ]));
        });
        if (!(meta.topraklar || []).length) liste.appendChild(yap('p', { sinif: 'sm-bos', metin: 'Henüz kimse kare almadı.' }));
        k.appendChild(liste);
        sonHarita = harita.slice();
    }

    /* ---------------- Kalkan & Roket ---------------- */
    function kalkanRoket(k, meta, durum) {
        var say = meta.esyaSayilari || {};
        var isimler = Object.keys(say).sort(function (a, b) { return say[b] - say[a]; });

        if (durum === 'SORUDA') {
            k.appendChild(yap('span', { sinif: 'sm-im', metin: '🎒' }));
            if (!isimler.length) k.appendChild(yap('span', { sinif: 'sm-bos', metin: 'Doğru cevap veren eşya kazanır!' }));
            isimler.slice(0, 8).forEach(function (n) {
                k.appendChild(yap('span', { sinif: 'sm-rozet' }, [
                    yap('i', { stil: 'background:' + renk(n), metin: bas(n) }),
                    yap('span', { metin: n + ' · ' + say[n] })
                ]));
            });
            return;
        }
        k.appendChild(yap('h3', { sinif: 'sm-bas', metin: '🎒 Envanterler' }));
        var liste = yap('div', { sinif: 'sm-liste' });
        if (!isimler.length) liste.appendChild(yap('p', { sinif: 'sm-bos', metin: 'Henüz eşya kazanılmadı.' }));
        isimler.forEach(function (n) {
            liste.appendChild(yap('div', { sinif: 'sm-satir' }, [
                yap('i', { stil: 'background:' + renk(n), metin: bas(n) }),
                yap('span', { metin: n }),
                yap('strong', { metin: say[n] + ' 🎁' })
            ]));
        });
        k.appendChild(liste);
        k.appendChild(yap('p', { sinif: 'sm-bos', metin: Object.keys(ESYA_IM).map(function (e) { return ESYA_IM[e]; }).join(' ') + '  Kalkan kendiliğinden savar · roket yalnız öndekine' }));
    }

    /* ---------------- Dönen Düello ----------------
       Bu turun kazananı hesaplanmaz: sunucunun soru ÖNCESİ ve SONRASI gönderdiği
       "kazanilan" sayaçlarının farkı okunur (artan kişi o turu almıştır). */
    function duello(k, meta, durum) {
        var esler = meta.esler || [], kazanilan = meta.kazanilan || {};
        var turKazandi = function (isim) {
            return durum !== 'SORUDA' && (kazanilan[isim] || 0) > (oncekiKazanilan[isim] || 0);
        };
        k.appendChild(yap('h3', { sinif: 'sm-bas', metin: durum === 'SORUDA' ? '⚔️ Bu turun eşleşmeleri' : '⚔️ Tur sonucu' }));
        if (!esler.length) { k.appendChild(yap('p', { sinif: 'sm-bos', metin: 'Eşleşme soru başlayınca kurulur.' })); }
        else {
            var kutu = yap('div', { sinif: 'es-liste' + (durum === 'SORUDA' ? ' genis' : '') });
            esler.forEach(function (c, i) {
                var a = c[0], b = c[1];
                var berabere = durum !== 'SORUDA' && !turKazandi(a) && !turKazandi(b);
                var kart = yap('div', { sinif: 'es-kart' + (berabere ? ' berabere' : '') }, [
                    yap('span', { sinif: 'es-ad' + (turKazandi(a) ? ' kazanan' : ''), metin: a }),
                    yap('span', { sinif: 'es-vs', metin: berabere ? '🤝' : '⚔️' }),
                    yap('span', { sinif: 'es-ad' + (turKazandi(b) ? ' kazanan' : ''), metin: b })
                ]);
                kart.style.animationDelay = (i * 0.12) + 's';
                kutu.appendChild(kart);
            });
            k.appendChild(kutu);
        }

        var kz = Object.keys(kazanilan).sort(function (x, y) { return kazanilan[y] - kazanilan[x]; });
        if (kz.length && durum !== 'SORUDA') {
            var l = yap('div', { sinif: 'sm-liste' });
            kz.slice(0, 5).forEach(function (n) {
                l.appendChild(yap('div', { sinif: 'sm-satir' }, [
                    yap('i', { stil: 'background:' + renk(n), metin: bas(n) }),
                    yap('span', { metin: n }),
                    yap('strong', { metin: kazanilan[n] + '× 🏆' })
                ]));
            });
            k.appendChild(l);
        }
    }

    /** Soru başlarken çağrılır: kazanan farkını ölçebilmek için anlık görüntü alınır. */
    function turBasladi(meta) {
        if (meta && meta.format === 'donen_duello') oncekiKazanilan = Object.assign({}, meta.kazanilan || {});
    }

    /* ---------------- Roket uçuşu / kalkan parlaması ---------------- */
    function saldiri(d, sesCal) {
        var kat = el('ucus-katman');
        var kart = yap('div', { sinif: 'ucus' }, [
            yap('span', { sinif: 'u-ad', metin: d.saldiran }),
            yap('span', { sinif: 'u-roket', metin: '🚀' }),
            yap('span', { sinif: 'u-ad', metin: d.hedef })
        ]);
        kat.appendChild(kart);
        if (sesCal) sesCal(d.savuldu ? 'kilit' : 'yanlis');
        setTimeout(function () {
            var son = yap('div', { sinif: 'carpma ' + (d.savuldu ? 'savuldu' : 'vurdu') },
                [yap('span', { metin: d.savuldu ? '🛡️' : '💥' }),
                 yap('span', { sinif: 'c-metin', metin: d.savuldu ? d.hedef + ' kalkanla savdı!' : d.hedef + ' vuruldu!' })]);
            kat.appendChild(son);
            setTimeout(function () { son.remove(); }, 1800);
        }, FX.azHareket ? 0 : 1000);
        setTimeout(function () { kart.remove(); }, FX.azHareket ? 400 : 1300);
    }

    g.SahneMod = { ciz: ciz, saldiri: saldiri, sifirla: sifirla, rozet: rozet, turBasladi: turBasladi,
        fetihAsamasi: fetihAsamasi, haber: haber };
})(window);
