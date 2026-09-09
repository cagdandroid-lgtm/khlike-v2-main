/* Öğrenci ekranının MOD katmanı yüzü (PROTOKOL Bölüm 4).
   Kural aynı: hiçbir şey hesaplanmaz. my_meta / personal_result.meta / item_result / saldiri_geldi
   olduğu gibi çizilir; eşya kullanımı sunucuya sorulur, sunucu onaylarsa görünüm güncellenir. */
(function (g) {
    'use strict';
    var el = UI.el, yap = UI.yap, bosalt = UI.bosalt;

    var ESYA = {
        kalkan: { ad: 'Kalkan', im: '🛡️', not: 'Kendiliğinden korur — sana roket gelirse savar.', pasif: true },
        roket:  { ad: 'Roket',  im: '🚀', not: 'Yalnız senden öndekine atılır, 150 puan alır.' },
        ipucu:  { ad: 'İpucu',  im: '🔍', not: 'Soru sürerken bir yanlış şıkkı soluklaştırır.', soruda: true },
        cift:   { ad: 'Çift Puan', im: '⚡', not: 'Sıradaki soruda puanın 2 katı.' }
    };

    var ctx = null;
    function bosDurum() {
        return { format: 'yaris', envanter: [], hedefler: [], ciftAktif: false, rakip: null, kare: 0,
            gizlenenSik: null, secilenHedef: null,
            // fetih
            harita: [], boyut: 6, korumali: [], kalkanli: [], topraklar: [], asama: 'yok',
            hak: 0, kalkanHak: 0, fetihHakki: false, hakSahipleri: [], lobi: [], benKod: null, secilenKalkan: null,
            // eleme_duello
            rol: null, izlenen: null, turAdi: '', sampiyon: null, kazanilan: 0 };
    }
    var G = bosDurum();

    function ayarla(c) { ctx = c; }

    function sifirla() {
        G = bosDurum();
        devletRenkleri = {};
        el('mod-soru').classList.add('gizli');
        el('mod-sonuc').classList.add('gizli');
        el('esya-panel').classList.add('gizli');
        el('kalkan-panel').classList.add('gizli');
    }

    /** public_state.meta — herkese açık mod durumu (harita canlı izleme, braket bilgisi). */
    function genelMeta(meta, lobi, benKod) {
        G.lobi = lobi || [];
        if (benKod) G.benKod = benKod;
        if (!meta || !meta.format) return;
        G.format = meta.format;
        if (meta.format === 'fetih') {
            G.harita = meta.harita || []; G.boyut = meta.boyut || 6;
            G.korumali = meta.korumali || []; G.kalkanli = meta.kalkanli || [];
            G.topraklar = meta.topraklar || []; G.asama = meta.asama || 'yok';
            if (!el('ek-fetih').classList.contains('acik')) return;
            fetihCiz();
        }
        if (meta.format === 'eleme_duello') {
            G.turAdi = meta.turAdi || '';
            if (meta.sampiyon) G.sampiyon = meta.sampiyon;
        }
    }

    /** my_meta — KİŞİSEL durumun ASIL KAYNAĞI. Sunucu bunu soru başında ve her
        eşya/kare/kalkan işleminden + fetih aşaması açılıp kapanınca yeniden gönderir;
        bu yüzden gelen paket ekranı da tazeler (hak, kalkan hakkı, toprak sayısı). */
    function benimMeta(m) {
        if (!m) return;
        G.format = m.format;
        if (m.format === 'kalkan_roket') { G.envanter = (m.esyalar || []).slice(); G.hedefler = m.hedefler || []; G.ciftAktif = !!m.ciftAktif; }
        if (m.format === 'donen_duello') G.rakip = m.rakip;
        if (m.format === 'fetih') {
            G.kare = m.kare || 0; G.hak = m.hak || 0; G.kalkanHak = m.kalkanHak || 0; G.asama = m.asama || 'yok';
            if (el('ek-fetih').classList.contains('acik')) fetihCiz();          // aşama ekranı açıksa tazele
            if (el('ek-sonuc').classList.contains('acik')) kalkanPaneli();      // soru arasındaki kalkan kutusu
        }
        if (m.format === 'eleme_duello') {
            G.rol = m.rol; G.rakip = m.rakip; G.izlenen = m.izlenen;
            G.turAdi = m.turAdi || ''; G.kazanilan = m.kazanilan || 0; G.sampiyon = m.sampiyon || null;
        }
        soruSeridi();
    }

    /** Soru ekranının üstündeki şerit. */
    function soruSeridi() {
        var d = bosalt(el('mod-soru'));
        d.className = 'mod-serit';
        if (G.format === 'yaris' || !G.format) { d.classList.add('gizli'); return; }
        d.classList.remove('gizli');

        if (G.format === 'donen_duello') {
            d.appendChild(yap('span', { sinif: 'ms-im', metin: '⚔️' }));
            d.appendChild(G.rakip
                ? yap('span', {}, [document.createTextNode('Bu turda rakibin: '), yap('strong', { metin: G.rakip })])
                : yap('span', { metin: 'Bu turda rakibin yok — doğru cevaplarsan bonus senin!' }));
            return;
        }
        if (G.format === 'fetih') {
            d.appendChild(yap('span', { sinif: 'ms-im', metin: '🗺️' }));
            d.appendChild(yap('span', {}, [document.createTextNode('Toprağın: '), yap('strong', { metin: G.kare + ' kare' })]));
            if (G.kalkanHak > 0) d.appendChild(yap('span', { sinif: 'ms-rozet vurgu', metin: '🛡️ Kalkan hakkın var' }));
            return;
        }
        // ELEME DÜELLOSU — rol bandı: düellocu / gölge-bekleyen
        if (G.format === 'eleme_duello') {
            if (G.sampiyon) {
                d.className = 'mod-serit rol-sampiyon';
                d.appendChild(yap('span', { sinif: 'ms-im', metin: '🏆' }));
                d.appendChild(yap('span', { html: 'Şampiyon: <strong>' + UI.kacir(G.sampiyon) + '</strong>' }));
                return;
            }
            if (G.turAdi) d.appendChild(yap('span', { sinif: 'ms-rozet', metin: '🏟️ ' + G.turAdi }));
            if (G.rol === 'duellocu') {
                d.className = 'mod-serit rol-duellocu';
                d.appendChild(yap('span', { sinif: 'ms-im', metin: '⚔️' }));
                d.appendChild(yap('span', { html: 'Rakibin: <strong>' + UI.kacir(G.rakip || '?') + '</strong>' }));
            } else {
                d.className = 'mod-serit rol-golge';
                d.appendChild(yap('span', { sinif: 'ms-im', metin: '👀' }));
                d.appendChild(G.izlenen
                    ? yap('span', { html: 'Şu an düello: <strong>' + UI.kacir(G.izlenen.p1) + '</strong> ⚔ <strong>' + UI.kacir(G.izlenen.p2) + '</strong> — sen gölge ligindesin' })
                    : yap('span', { metin: 'Sen gölge ligindesin — puanın normal işliyor.' }));
            }
            if (G.kazanilan) d.appendChild(yap('span', { sinif: 'ms-rozet', metin: '🏅 ' + G.kazanilan + ' maç' }));
            return;
        }
        if (G.format === 'kalkan_roket') {
            d.appendChild(yap('span', { sinif: 'ms-im', metin: '🎒' }));
            var say = {};
            G.envanter.forEach(function (e) { say[e] = (say[e] || 0) + 1; });
            var anahtarlar = Object.keys(say);
            if (!anahtarlar.length) d.appendChild(yap('span', { sinif: 'ms-bos', metin: 'Envanterin boş — doğru cevapla eşya kazan!' }));
            anahtarlar.forEach(function (e) {
                var t = ESYA[e] || { im: '❔', ad: e };
                d.appendChild(yap('span', { sinif: 'ms-rozet', title: t.ad }, [
                    yap('b', { metin: t.im }), yap('small', { metin: t.ad + ' ×' + say[e] })
                ]));
            });
            if (G.ciftAktif) d.appendChild(yap('span', { sinif: 'ms-rozet vurgu', metin: '⚡ Bu soruda 2× puan!' }));
            // İpucu YALNIZ soru sürerken kullanılır
            if (say.ipucu && G.gizlenenSik === null) {
                d.appendChild(yap('button', {
                    sinif: 'dug mavi ms-dug', type: 'button', metin: '🔍 İpucu kullan',
                    onclick: function () { ipucuKullan(this); }
                }));
            } else if (G.gizlenenSik !== null) {
                d.appendChild(yap('span', { sinif: 'ms-rozet', metin: '🔍 Bir şık soluklaştı' }));
            }
        }
    }

    function ipucuKullan(dugme) {
        dugme.disabled = true;
        ctx.gonder('esya_kullan', { esya: 'ipucu' }, function (r) {
            if (!r || !r.ok) { dugme.disabled = false; ctx.cerez((r && r.hata) || 'İpucu kullanılamadı.'); return; }
            esyaDus('ipucu');
            sikSoluklastir(r.gizlenenSik);
            soruSeridi();
        });
    }

    /** Gizlenen şık soluklaşır ama TIKLANABİLİR kalır (kural). */
    function sikSoluklastir(i) {
        if (i === undefined || i === null) return;
        G.gizlenenSik = i;
        var s = UI.hepsi('#sik-izgara .sik')[i];
        if (s) { s.classList.add('soluk'); s.setAttribute('aria-label', 'Bu şık ipucuyla elendi ama yine de seçebilirsin'); }
        ctx.cerez('🔍 Bir yanlış şık soluklaştı — yine de seçebilirsin.');
    }
    /** Yeni soru çizildiğinde çağrılır. */
    function soruYenilendi() {
        G.gizlenenSik = null; G.secilenHedef = null;
        G.fetihHakki = false; G.hak = 0; G.secilenKalkan = null;
        soruSeridi();
    }

    function esyaDus(esya) {
        var i = G.envanter.indexOf(esya);
        if (i > -1) G.envanter.splice(i, 1);
    }

    /* ---------------- Kişisel sonuç ---------------- */
    function sonucMeta(meta) {
        var kutu = el('mod-sonuc'), panel = el('esya-panel');
        bosalt(kutu); kutu.classList.add('gizli');
        panel.classList.add('gizli');
        el('kalkan-panel').classList.add('gizli');
        if (!meta || !meta.format || meta.format === 'yaris') return;

        G.format = meta.format;
        if (meta.format === 'kalkan_roket') { G.envanter = (meta.esyalar || []).slice(); G.hedefler = meta.hedefler || []; G.ciftAktif = !!meta.ciftAktif; }
        if (meta.format === 'donen_duello') G.rakip = meta.rakip;
        if (meta.format === 'fetih') { G.kare = meta.kare || 0; if (meta.kalkanHak !== undefined) G.kalkanHak = meta.kalkanHak; }
        if (meta.format === 'eleme_duello' && meta.sampiyon) G.sampiyon = meta.sampiyon;

        var satir = function (im, metin, sinif) {
            return yap('div', { sinif: 'msr ' + (sinif || '') }, [yap('span', { sinif: 'msr-im', metin: im }), yap('span', { html: metin })]);
        };

        if (meta.format === 'fetih') {
            if (meta.fetih) kutu.appendChild(satir('🗺️',
                meta.fetih.fethedilen
                    ? '<strong>' + (meta.fetih.kare + 1) + '. kareyi fethettin!</strong> Rakipten aldın.'
                    : '<strong>' + (meta.fetih.kare + 1) + '. kare senin oldu!</strong>', 'iyi'));
            if (meta.kaybedilenKare !== undefined) kutu.appendChild(satir('🏳️', 'Bir karen el değiştirdi — geri almak için doğru cevap yeter.', 'notr'));
            if (meta.kalkanHakKazandi) { G.kalkanHak = (G.kalkanHak || 0) + 1;
                kutu.appendChild(satir('🛡️', '<strong>En hızlı doğru cevap senindi!</strong> Bir kalkan hakkı kazandın — bir arkadaşına hediye edebilirsin.', 'iyi')); }
            G.fetihHakki = !!meta.fetihHakki;      // aşama açılınca hak buradan gelir (my_meta soru başında gelir, o an haklar boştur)
            if (meta.fetihHakki) kutu.appendChild(satir('⚔️', 'Bu turda <strong>fetih hakkın var</strong> — öğretmen aşamayı açınca haritadan kare seçeceksin.', 'iyi'));
            kutu.appendChild(satir('🧱', 'Toprağın: <strong>' + G.kare + ' kare</strong>'));
            kutu.classList.remove('gizli');
            kalkanPaneli();
        }

        if (meta.format === 'eleme_duello') {
            var dd = meta.duello;
            if (dd) {
                if (dd.berabere) kutu.appendChild(satir('💥', '<strong>' + UI.kacir(dd.rakip) + '</strong> ile ikiniz de bilemediniz — ikiniz de elendiniz. Ama oyun bitmedi: <strong>gölge liginde</strong> yarışmayı sürdürüyorsun!', 'notr'));
                else if (dd.kazandi) kutu.appendChild(satir('🏆', '<strong>' + UI.kacir(dd.rakip) + '</strong> maçını <strong>kazandın</strong> — bir tur daha!', 'iyi'));
                else if (dd.elendi) kutu.appendChild(satir('🌱', '<strong>' + UI.kacir(dd.rakip) + '</strong> bu maçı aldı. Elendin ama oyundan çıkmadın: <strong>gölge liginde</strong> puan toplamayı sürdürüyorsun!', 'notr'));
            } else if (meta.golge) {
                kutu.appendChild(satir('👻', 'Bu soruyu <strong>gölge liginde</strong> çözdün — puanın normal işledi.', 'notr'));
            }
            if (meta.sampiyon) {
                var benim = G.benKod && (G.lobi || []).some(function (x) { return x.kod === G.benKod && x.isim === meta.sampiyon; });
                kutu.appendChild(yap('div', { sinif: 'sampiyon-kutu' + (benim ? ' benim' : '') }, [
                    yap('div', { sinif: 'sk-tac', metin: '🏆' }),
                    yap('div', { sinif: 'sk-baslik', metin: benim ? 'ŞAMPİYON SENSİN!' : 'Şampiyon belli oldu' }),
                    yap('div', { sinif: 'sk-ad', metin: meta.sampiyon })
                ]));
                if (benim) ctx.ses('zafer');
            }
            kutu.classList.remove('gizli');
        }

        if (meta.format === 'donen_duello' && meta.duello) {
            var d = meta.duello;
            if (!d.rakip) kutu.appendChild(satir('🎁', '<strong>Bu turda rakibin yoktu</strong> — doğru cevap bonusu senin.', 'iyi'));
            else if (d.kazandi) kutu.appendChild(satir('🏆', '<strong>' + UI.kacir(d.rakip) + '</strong> ile düellonu <strong>kazandın!</strong>', 'iyi'));
            else if (d.berabere) kutu.appendChild(satir('🤝', '<strong>' + UI.kacir(d.rakip) + '</strong> ile berabere — ikiniz de iyiydiniz.', 'notr'));
            else kutu.appendChild(satir('⚔️', '<strong>' + UI.kacir(d.rakip) + '</strong> bu turu aldı. Sıradaki tur yeni eşleşme!', 'notr'));
            kutu.appendChild(satir('🎖️', 'Kazandığın düello: <strong>' + (meta.kazanilan || 0) + '</strong>'));
            kutu.classList.remove('gizli');
        }

        if (meta.format === 'kalkan_roket') {
            if (meta.kazanilanEsya) {
                var t = ESYA[meta.kazanilanEsya] || { im: '🎁', ad: meta.kazanilanEsya, not: '' };
                kutu.appendChild(satir('🎁', 'Yeni eşya: <strong>' + t.im + ' ' + t.ad + '</strong> — ' + t.not, 'iyi'));
                kutu.classList.remove('gizli');
            }
            esyaPaneli();
        }
    }

    /* ---------------- Eşya paneli (soru arası) ---------------- */
    function esyaPaneli() {
        var panel = el('esya-panel'), liste = bosalt(el('esya-liste'));
        panel.classList.remove('gizli');
        var say = {};
        G.envanter.forEach(function (e) { say[e] = (say[e] || 0) + 1; });
        var anahtarlar = Object.keys(say);

        if (!anahtarlar.length) {
            liste.appendChild(yap('p', { sinif: 'esya-bos', metin: 'Envanterin boş. Doğru cevap ver, eşya kazan! 🎁' }));
        }
        anahtarlar.forEach(function (e) {
            var t = ESYA[e] || { im: '❔', ad: e, not: '' };
            var kart = yap('div', { sinif: 'esya-kart' + (t.pasif ? ' pasif' : '') }, [
                yap('div', { sinif: 'ek-bas' }, [
                    yap('span', { sinif: 'ek-im', metin: t.im }),
                    yap('span', { sinif: 'ek-ad', metin: t.ad + ' ×' + say[e] })
                ]),
                yap('p', { sinif: 'ek-not', metin: t.not })
            ]);
            if (t.pasif) kart.appendChild(yap('span', { sinif: 'ek-etiket', metin: '✓ Otomatik çalışır' }));
            else if (t.soruda) kart.appendChild(yap('span', { sinif: 'ek-etiket', metin: '⏳ Soru sürerken kullanılır' }));
            else if (e === 'cift') kart.appendChild(yap('button', {
                sinif: 'dug yesil tam', type: 'button', metin: '⚡ Sıradaki soruda 2× yap',
                onclick: function () { ciftKullan(this); }
            }));
            else if (e === 'roket') kart.appendChild(roketBolumu());
            liste.appendChild(kart);
        });

        el('esya-not').textContent = G.ciftAktif
            ? '⚡ Çift puan hazır: sıradaki soruda puanın 2 katı.'
            : 'Eşyalar kimseyi oyundan çıkarmaz; kalkanın sana gelen roketi kendiliğinden savar.';
    }

    /** Roket: hedef YALNIZ sunucunun verdiği "yukarıdakiler" listesinden seçilir. */
    function roketBolumu() {
        var sar = yap('div', { sinif: 'roket-bolum' });
        if (!G.hedefler.length) {
            sar.appendChild(yap('p', { sinif: 'ek-not', metin: '🥇 Önünde kimse yok — roket şimdilik bekliyor.' }));
            return sar;
        }
        sar.appendChild(yap('p', { sinif: 'ek-not', metin: 'Kime atacaksın? (yalnız önündekiler)' }));
        var kutu = yap('div', { sinif: 'hedef-liste' });
        G.hedefler.forEach(function (h) {
            var b = yap('button', {
                sinif: 'hedef-dug' + (G.secilenHedef === h.kod ? ' secili' : ''),
                type: 'button', metin: h.isim,
                onclick: function () { G.secilenHedef = h.kod; esyaPaneli(); }
            });
            kutu.appendChild(b);
        });
        sar.appendChild(kutu);
        sar.appendChild(yap('button', {
            sinif: 'dug kirmizi tam', type: 'button',
            metin: G.secilenHedef ? '🚀 Roketi fırlat' : '🚀 Önce hedef seç',
            disabled: G.secilenHedef ? null : 'disabled',
            onclick: function () { roketAt(this); }
        }));
        return sar;
    }

    function ciftKullan(dugme) {
        dugme.disabled = true;
        ctx.gonder('esya_kullan', { esya: 'cift' }, function (r) {
            if (!r || !r.ok) { dugme.disabled = false; return ctx.cerez((r && r.hata) || 'Kullanılamadı.'); }
            esyaDus('cift'); G.ciftAktif = true;
            ctx.ses('dogru');
            ctx.cerez('⚡ ' + (r.mesaj || 'Sıradaki soruda puanın 2 katı!'));
            esyaPaneli();
        });
    }

    function roketAt(dugme) {
        if (!G.secilenHedef) return;
        dugme.disabled = true;
        ctx.gonder('esya_kullan', { esya: 'roket', hedefKod: G.secilenHedef }, function (r) {
            if (!r || !r.ok) { dugme.disabled = false; return ctx.cerez((r && r.hata) || 'Roket atılamadı.'); }
            esyaDus('roket'); G.secilenHedef = null;
            ctx.ses(r.savuldu ? 'yanlis' : 'dogru');
            ctx.cerez(r.savuldu
                ? '🛡️ ' + r.hedef + ' kalkanla savdı — eşya boşa gitmedi, kalkanı kırdın!'
                : '🚀 ' + r.hedef + ' oyuncusundan ' + UI.bashariler(r.calinan) + ' puan aldın!');
            esyaPaneli();
        });
    }

    /* ---------------- FETİH AŞAMASI ---------------- */
    function fetihAsamasi(d) {
        G.asama = d && d.acik ? 'fetih' : 'yok';
        G.hakSahipleri = (d && d.hakSahipleri) || [];
        if (!d || !d.acik) { G.hak = 0; return; }
        // Bu olay my_meta'dan hemen ÖNCE gelir; ilk çizim için yedek hesap yapılır,
        // saniyesinde gelen my_meta gerçek hakkı yazar (benimMeta ekranı tazeler).
        var ben = benimIsim();
        G.hak = (G.fetihHakki || (ben && G.hakSahipleri.indexOf(ben) > -1)) ? 1 : 0;
        fetihCiz();
    }

    function bas(n) { return (n || '?').trim().charAt(0).toLocaleUpperCase('tr'); }

    /* Devlet renkleri: ilk görülene sırayla verilir ve oturum boyunca DEĞİŞMEZ
       (karışık atama iki devlete aynı rengi verebiliyordu). Renk tek başına ayırt edici
       değildir: her karede baş harf de yazar. */
    var DEVLET_RENK = ['#c2255c', '#1864ab', '#b8860b', '#0b7285', '#5f3dc4', '#2b8a3e', '#a61e4d', '#495057'];
    var devletRenkleri = {};
    function devletRengi(isim) {
        if (!isim) return '';
        if (!devletRenkleri[isim]) devletRenkleri[isim] = DEVLET_RENK[Object.keys(devletRenkleri).length % DEVLET_RENK.length];
        return devletRenkleri[isim];
    }

    /** Haritayı çizer. Hak sahibiyse kareler TIKLANABİLİR; değilse canlı izleme. */
    function fetihCiz() {
        var hakVar = G.hak > 0;
        el('fetih-baslik').textContent = hakVar ? '🗺️ Sıra sende — kareni seç!' : '🗺️ Fetih sürüyor';
        el('fetih-alt').textContent = hakVar
            ? 'Doğru cevapladın: haritadan bir kare al. Boş kareler varken başkasının toprağına saldıramazsın.'
            : (function () {
                var ben = benimIsim();
                var digerleri = G.hakSahipleri.filter(function (n) { return n !== ben; });
                return digerleri.length
                    ? 'Şu an seçim yapanlar: ' + digerleri.join(', ') + '. Haritayı izle!'
                    : 'Haritayı izle — bu turun kazananları kare seçiyor.';
            })();

        var izgara = bosalt(el('fetih-izgara'));
        izgara.style.gridTemplateColumns = 'repeat(' + G.boyut + ',1fr)';
        (G.harita || []).forEach(function (sahip, i) {
            var korumali = sahip && (G.korumali.indexOf(sahip) > -1 || G.kalkanli.indexOf(sahip) > -1);
            var benim = sahip && G.benKod && sahip === benimIsim();
            var k = yap('button', {
                sinif: 'fkare' + (sahip ? ' dolu' : ' bos') + (korumali ? ' korumali' : '') + (benim ? ' benim' : ''),
                type: 'button',
                stil: sahip ? 'background:' + devletRengi(sahip) : '',
                title: (sahip ? sahip : 'boş') + ' · ' + (i + 1) + '. kare' + (korumali ? ' · 🛡️ koruma altında' : '')
            }, [
                yap('span', { sinif: 'fk-ad', metin: sahip ? bas(sahip) : '' }),
                korumali ? yap('span', { sinif: 'fk-kalkan', metin: '🛡️' }) : null
            ]);
            k.disabled = !hakVar;
            if (hakVar) k.onclick = function () { kareSec(i, k); };
            izgara.appendChild(k);
        });

        var alinan = (G.harita || []).filter(Boolean).length;
        el('fetih-not').textContent = hakVar
            ? 'Kalan hakkın: ' + G.hak + ' · ' + alinan + '/' + (G.harita || []).length + ' kare alındı'
            : alinan + '/' + (G.harita || []).length + ' kare alındı · 🛡️ işaretli devletler bu turda korunuyor';

        var liste = bosalt(el('fetih-liste'));
        (G.topraklar || []).slice(0, 8).forEach(function (t) {
            liste.appendChild(yap('div', { sinif: 'ft-satir' }, [
                yap('span', { sinif: 'ft-nokta', stil: 'background:' + devletRengi(t.isim), metin: bas(t.isim) }),
                yap('span', { metin: t.isim }),
                yap('strong', { metin: t.kare + ' kare' })
            ]));
        });
        if (!(G.topraklar || []).length) liste.appendChild(yap('p', { sinif: 'ek-not', metin: 'Harita bomboş — ilk kareyi kim alacak?' }));
    }
    function benimIsim() {
        var b = (G.lobi || []).filter(function (x) { return x.kod === G.benKod; })[0];
        return b ? b.isim : null;
    }

    /** Kare seçimi: karar sunucunun. Hata mesajları AYNEN gösterilir. */
    function kareSec(i, dugme) {
        dugme.disabled = true;
        ctx.gonder('kare_sec', { kare: i }, function (r) {
            if (!r || !r.ok) { ctx.cerez((r && r.hata) || 'Kare alınamadı.'); fetihCiz(); return; }
            G.hak = r.kalanHak;
            ctx.ses('dogru');
            ctx.cerez(r.fethedilen
                ? '⚔️ ' + (r.oncekiSahip || 'Rakip') + ' devletinden ' + (i + 1) + '. kareyi fethettin!'
                : '🏳️ ' + (i + 1) + '. kare artık senin!');
            fetihCiz();
        });
    }

    /* ---------------- KALKAN HEDİYE (soru arası) ---------------- */
    function kalkanPaneli() {
        var panel = el('kalkan-panel');
        if (!(G.kalkanHak > 0)) { panel.classList.add('gizli'); return; }
        panel.classList.remove('gizli');
        el('kalkan-not').textContent = 'En hızlı doğru cevap senindi! Bir arkadaşını seç — bu turda kimse onun toprağını fethedemesin. Kendine veremezsin.';
        var kutu = bosalt(el('kalkan-liste'));
        var benim = benimIsim();
        var arkadaslar = (G.lobi || []).filter(function (x) { return x.kod !== G.benKod; });
        arkadaslar.forEach(function (a) {
            var korunuyor = G.korumali.indexOf(a.isim) > -1 || G.kalkanli.indexOf(a.isim) > -1;
            var b = yap('button', {
                sinif: 'hedef-dug' + (G.secilenKalkan === a.kod ? ' secili' : '') + (korunuyor ? ' korumali' : ''),
                type: 'button', metin: a.isim + (korunuyor ? ' 🛡️' : ''),
                title: korunuyor ? 'Bu arkadaşın zaten koruma altında' : 'Kalkanı ' + a.isim + ' için kullan'
            });
            b.disabled = korunuyor;
            b.onclick = function () { G.secilenKalkan = a.kod; kalkanPaneli(); };
            kutu.appendChild(b);
        });
        if (!arkadaslar.length) kutu.appendChild(yap('p', { sinif: 'ek-not', metin: 'Şu an hediye edebileceğin bir arkadaş yok.' }));
        var d = el('kalkan-dug');
        d.disabled = !G.secilenKalkan;
        d.textContent = G.secilenKalkan ? '🛡️ Kalkanı hediye et' : '🛡️ Önce bir arkadaş seç';
        d.onclick = function () { kalkanVer(d); };
    }
    function kalkanVer(dugme) {
        if (!G.secilenKalkan) return;
        dugme.disabled = true;
        ctx.gonder('kalkan_ver', { hedefKod: G.secilenKalkan }, function (r) {
            if (!r || !r.ok) { dugme.disabled = false; ctx.cerez((r && r.hata) || 'Kalkan verilemedi.'); return; }
            G.kalkanHak = r.kalanKalkanHak; G.secilenKalkan = null;
            ctx.ses('dogru');
            ctx.cerez('🛡️ ' + r.hedef + ' artık koruma altında — güzel bir hareket!');
            kalkanPaneli();
            soruSeridi();
        });
    }

    /** Bana kalkan geldi — sıcak kutlama. */
    function kalkanGeldi(d) {
        var k = el('hediye-kart');
        k.className = 'hediye-kart acik';
        bosalt(k);
        k.appendChild(yap('span', { sinif: 'hk-im', metin: '🛡️' }));
        k.appendChild(yap('span', { sinif: 'hk-metin', html:
            '<strong>' + UI.kacir(d.veren) + '</strong> sana kalkan hediye etti!<br><small>Bu turda toprağın güvende — ne arkadaşlık ama! 💚</small>' }));
        clearTimeout(kalkanGeldi._z);
        kalkanGeldi._z = setTimeout(function () { k.classList.remove('acik'); }, 6000);
        if (el('ek-fetih').classList.contains('acik')) fetihCiz();
    }

    /* ---------------- Saldırı bildirimi ---------------- */
    function saldiriGeldi(d) {
        var k = el('saldiri-kart');
        k.className = 'saldiri-kart acik ' + (d.savuldu ? 'savuldu' : 'vuruldu');
        bosalt(k);
        k.appendChild(yap('span', { sinif: 'sk-im', metin: d.savuldu ? '🛡️' : '🚀' }));
        k.appendChild(yap('span', {
            html: d.savuldu
                ? '<strong>' + UI.kacir(d.saldiran) + '</strong> roket attı — kalkanın savdı!'
                : '<strong>' + UI.kacir(d.saldiran) + '</strong> senden ' + UI.bashariler(d.calinan || 0) + ' puan aldı. Sıradaki soruda geri alırsın!'
        }));
        ctx.ses(d.savuldu ? 'kilit' : 'yanlis');
        clearTimeout(saldiriGeldi._z);
        saldiriGeldi._z = setTimeout(function () { k.classList.remove('acik'); }, 5000);
        if (G.format === 'kalkan_roket' && d.savuldu) { esyaDus('kalkan'); soruSeridi(); }
    }

    g.OgrenciMod = {
        ayarla: ayarla, sifirla: sifirla, benimMeta: benimMeta, genelMeta: genelMeta, soruYenilendi: soruYenilendi,
        sonucMeta: sonucMeta, saldiriGeldi: saldiriGeldi, sikSoluklastir: sikSoluklastir,
        fetihAsamasi: fetihAsamasi, kalkanGeldi: kalkanGeldi,
        format: function () { return G.format; }
    };
})(window);
