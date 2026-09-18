/* Canlı Oyun bölümü: duruma duyarlı akış düğmeleri, aktif soru, sıralama sahnesi, oyuncu yönetimi.
   Hiçbir karar burada verilmez; her düğme PROTOKOL.md'deki olayı gönderir. */
(function (g) {
    'use strict';
    var el = UI.el, yap = UI.yap, bosalt = UI.bosalt;
    var ctx = null, sonDurum = null, setOzet = {};   // setId → özet (varsayılan süre için)

    var DURUMLAR = ['BOSTA', 'LOBI', 'SORUDA', 'SORU_ARASI', 'FINAL', 'RAPOR'];
    var SIK_HARF = ['A', 'B', 'C', 'D', 'E', 'F'];

    function kur(c) {
        ctx = c;
        var g_ = function (id) { return el(id); };

        // --- BOSTA ---
        g_('d-set-sec').onclick = function () {
            var id = el('set-sec').value;
            if (!id) return ctx.cerez('Önce bir set seçin.', true);
            ctx.gonder('set_sec', { setId: id });
        };

        // --- LOBI ---  (grup seçici YOK: grup = setin grubu)
        g_('d-baslat').onclick = function () { ctx.gonder('oyunu_baslat', {}); };
        g_('karma-ac').onchange = function () { ctx.gonder('karma', { acik: this.checked }); };

        // --- SORUDA ---
        g_('d-duraklat').onclick = function () { ctx.gonder('duraklat', {}); };
        g_('d-devam').onclick = function () { ctx.gonder('devam', {}); };
        g_('d-sure10').onclick = function () { ctx.gonder('sure_ekle', { sn: 10 }); };
        g_('d-sure30').onclick = function () { ctx.gonder('sure_ekle', { sn: 30 }); };
        g_('d-soru-bitir').onclick = function () { ctx.gonder('soru_bitir', {}); };

        // --- SORU_ARASI ---
        // "Süre (sn)" boşsa akış hiç değişmez; doluysa soru o süreyle açılır.
        g_('d-siradaki').onclick = function () {
            var sn = sureEzmesi(); if (sn === false) return;
            if (sn === null) return ctx.gonder('siradaki', {});
            ctx.gonder('soru_baslat', { index: (sonDurum ? sonDurum.soruNo : 0), sureEz: sn });  // soruNo = sıradakinin indeksi
        };
        g_('d-final').onclick = function () { ctx.gonder('final', {}); };
        g_('d-soru-baslat').onclick = function () {
            var i = Number(el('soru-atla').value);
            if (isNaN(i)) return;
            var sn = sureEzmesi(); if (sn === false) return;
            ctx.gonder('soru_baslat', sn === null ? { index: i } : { index: i, sureEz: sn });
        };
        g_('d-geri-al').onclick = function () {
            var s = sonDurum || {};
            var no = s.soru ? (s.soru.index + 1) : '?';
            if (!confirm('SORU ' + no + ' İPTAL EDİLECEK.\n\n' +
                '• Bu sorudan dağıtılan tüm puanlar HERKESTEN geri alınır.\n' +
                '• Sorunun cevap kayıtları silinir ve sıralama yeniden hesaplanır.\n' +
                '• Öğrenci ekranlarında "soru iptal edildi" bilgisi görünür.\n\nOnaylıyor musunuz?')) return;
            ctx.gonder('geri_al', {});
        };

        // --- SORU_ARASI · Soruyu Anlat (aç/kapa) ve söz hakkı kurası ---
        g_('d-anlatim').onclick = function () {
            var acik = !!(sonDurum && sonDurum.anlatimAcik);
            ctx.gonder(acik ? 'anlatim_bitir' : 'anlatim_baslat', {});
        };
        g_('d-kura').onclick = function () {
            kuraSonucuYaz(null);
            ctx.gonder('kura_cek', { kapsam: el('kura-kapsam').value });
        };

        // --- FINAL ---
        g_('d-rapor').onclick = function () { ctx.gonder('rapor', {}); };

        // --- HER DURUMDA: Etkinliği Bitir (kırmızı, onaylı) → BOSTA ---
        g_('d-etkinligi-bitir').onclick = function () {
            var s = sonDurum || {};
            var uyari = (s.logSayisi && !s.raporIndirildi)
                ? '\n\n⚠️ Bu oturumda ' + s.logSayisi + ' cevap kaydı var ve RAPOR/CSV HENÜZ İNDİRİLMEDİ. Bitirirseniz veri kaybolur.'
                : '';
            if (!confirm('ETKİNLİĞİ BİTİR: oturumun tüm puanları ve kayıtları silinecek, öğrenciler giriş ekranına döner.'
                + uyari + '\n\nDevam edilsin mi?')) return;
            ctx.gonder('etkinligi_bitir', {});
        };

        // --- Sahneyi ayrı pencerede aç (projeksiyon / Zoom paylaşımı) ---
        g_('d-sahne-ac').onclick = function () {
            var p = window.open('/screen', 'khlike_sahne', 'width=1280,height=800,menubar=no,toolbar=no');
            if (!p) ctx.cerez('Açılır pencere engellendi — tarayıcıdan izin verin.', true);
            else { p.focus(); ctx.cerez('Sahne yeni pencerede açıldı. Projeksiyona ya da Zoom paylaşımına verin.'); }
        };

        // --- Sıralama sahnesi ---
        g_('d-sir-baslat').onclick = function () { ctx.gonder('siralama_baslat', { sureSn: Number(el('sir-sure').value) }); };
        g_('d-sir-gonder').onclick = function () {
            ctx.gonder('siralama_gonder', { kapsam: el('sir-kapsam').value, isimModu: el('sir-isim').value });
        };
        g_('d-sir-kapat').onclick = function () { ctx.gonder('siralama_kapat', {}); };
        g_('d-lb').onclick = function () {
            var yeni = !(sonDurum && sonDurum.leaderboardGoster);
            ctx.gonder('leaderboard_goster', { acik: yeni });
        };
        g_('ay-lb').onchange = function () { ctx.gonder('leaderboard_goster', { acik: this.checked }); };
        g_('ay-ses').onchange = function () { ctx.gonder('ses', { kapali: this.checked }); };
        g_('ay-karma').onchange = function () { ctx.gonder('karma', { acik: this.checked }); };
    }

    /* ---------------- Süre ezmesi (isteğe bağlı) ----------------
       null → giriş boş, setin süresi kullanılır · false → geçersiz, gönderme. */
    function sureEzmesi() {
        var ham = String(el('sure-ez').value || '').trim();
        if (!ham) return null;
        var n = Math.round(Number(ham.replace(',', '.')));
        if (!isFinite(n) || n < 5 || n > 600) {
            ctx.cerez('Süre 5–600 sn arası olmalı. Boş bırakırsanız setin süresi kullanılır.', true);
            el('sure-ez').select();
            return false;
        }
        return n;
    }
    function varsayilanSureYaz(s) {
        var o = setOzet[s.setId], sn = o && o.varsayilanSure;
        el('sure-varsayilan').textContent = sn ? 'boş = set süresi (' + sn + ' sn)' : 'boş = setin süresi';
    }

    /* ---------------- Duruma duyarlı görünürlük ---------------- */
    var GRUP_AD = { p: '🐣 P Grubu', e: '🌱 E Grubu', u: '🦉 U Grubu', i: '🦉 U Grubu', c: '🦉 U Grubu' };   // eski i/c → U

    function durumGoruntu(s) {
        DURUMLAR.forEach(function (d) {
            UI.hepsi('.durum-' + d).forEach(function (x) { x.classList.toggle('gizli', s.durum !== d); });
        });

        // Set seçici HER ZAMAN görünür; yalnız BOSTA/LOBI'de kullanılabilir
        var degistirilebilir = s.durum === 'BOSTA' || s.durum === 'LOBI';
        el('set-sec').disabled = !degistirilebilir;
        el('d-set-sec').disabled = !degistirilebilir;
        el('d-set-sec').textContent = s.durum === 'LOBI' ? '🔄 Seti Değiştir' : '🎬 Etkinliği Aç';
        el('set-not').textContent = degistirilebilir
            ? 'Set seçilince grubu da belirlenir; öğrenci ekranlarında o grubun isim kartları belirir.'
            : 'Set değiştirmek için önce 🛑 Etkinliği Bitir.';
        el('set-not').classList.toggle('kilit-not', !degistirilebilir);

        // Etkinliği Bitir yalnız açık etkinlik varken anlamlı
        el('d-etkinligi-bitir').disabled = s.durum === 'BOSTA';

        // Grup rozeti: grup DAİMA setin grubudur
        var gr = el('p-grup');
        gr.classList.toggle('gizli', !s.grup);
        gr.textContent = s.karma ? '🎲 Karma oturum' : (GRUP_AD[s.grup] || (s.grup || '').toUpperCase());
        el('d-duraklat').classList.toggle('gizli', !!s.duraklatildi);
        el('d-devam').classList.toggle('gizli', !s.duraklatildi);

        // Son soruysa "Finali Göster" vurgulanır, değilse "Sıradaki" öne çıkar
        var sonSoru = s.toplamSoru > 0 && s.soruNo >= s.toplamSoru;
        el('d-final').className = 'dug ' + (sonSoru ? 'yesil buyuk' : 'mavi');
        el('d-siradaki').className = 'dug ' + (sonSoru ? 'gri' : 'yesil buyuk');
        el('d-siradaki').disabled = sonSoru;
        el('d-siradaki').title = sonSoru ? 'Son soru oynandı — finali gösterin.' : '';

        // Sahne bölümü HER ZAMAN açılabilir (ses ve sıralama görünürlüğü orada);
        // yalnız sıralama GÖSTERİM akışı SORU_ARASI/FINAL/RAPOR'da anlamlıdır.
        var sirVar = ['SORU_ARASI', 'FINAL', 'RAPOR'].indexOf(s.durum) !== -1;
        el('sir-akis').classList.toggle('gizli', !sirVar);
        el('sir-kapali-not').classList.toggle('gizli', sirVar);
        var asama = (s.siralama && s.siralama.asama) || 'yok';
        el('sir-onay').classList.toggle('gizli', asama !== 'onay');
        el('sir-yayin').classList.toggle('gizli', asama !== 'yayinda');
        el('d-sir-baslat').disabled = asama === 'geri_sayim' || asama === 'onay';
        el('d-sir-baslat').textContent = asama === 'geri_sayim' ? '⏳ Geri sayım sürüyor…' : '📊 Sıralamayı Göster';
        el('sir-cekilen').textContent = (s.siralama ? s.siralama.cekilen : 0) + ' öğrenci sıralamasını görmek istemedi';
        el('d-lb').textContent = s.leaderboardGoster ? '🙈 Sıralamayı Gizle' : '👁️ Sıralamayı Göster (açık)';
        el('d-lb').className = 'dug ' + (s.leaderboardGoster ? 'gri' : 'mavi');

        // Anlatım aç/kapa: durumun ASIL kaynağı sunucudur (public_state.anlatimAcik)
        var anlat = el('d-anlatim'), acik = !!s.anlatimAcik;
        anlat.textContent = acik ? '📕 Anlatımı Bitir' : '📖 Soruyu Anlat';
        anlat.className = 'dug ' + (acik ? 'sari' : 'mavi');
        anlat.title = acik
            ? 'Anlatım ekranı açık — öğrenci ve sahne soruyu doğru şıkkıyla görüyor.'
            : 'Soruyu doğru şıkkı, dağılımı ve açıklamasıyla tüm ekranlara yansıtır (öğrenci cevap veremez).';
        if (s.durum !== 'SORU_ARASI') kuraSonucuYaz(null);
    }

    /* ---------------- Kura sonucu şeridi ---------------- */
    function kuraSonucuYaz(d) {
        var k = el('kura-sonuc');
        if (!d) { k.classList.add('gizli'); k.textContent = ''; return; }
        var kap = { dogru: 'doğru cevaplayanlar', yanlis: 'yanlış cevaplayanlar', herkes: 'herkes' }[d.kapsam] || 'adaylar';
        k.classList.remove('gizli');
        k.textContent = '🎤 Söz sende: ' + d.isim + '  ·  ' + kap + ' arasından (' + (d.adaySayisi || 0) + ' aday)';
        k.classList.remove('carp'); void k.offsetWidth; k.classList.add('carp');
    }

    /* ---------------- Aktif soru kutusu ---------------- */
    function soruKutusu(s) {
        var k = el('soru-kutu');
        if (!s.soru) { k.classList.add('gizli'); return; }
        k.classList.remove('gizli');
        el('sk-no').textContent = 'Soru ' + (s.soru.index + 1) + '/' + s.toplamSoru;
        el('sk-kategori').textContent = s.soru.kategori || '';
        el('sk-zorluk').textContent = s.soru.zorluk !== undefined && s.soru.zorluk !== '' ? 'zorluk ' + s.soru.zorluk : '';
        el('sk-chc').textContent = s.soru.chc ? (Array.isArray(s.soru.chc) ? s.soru.chc.join(' · ') : s.soru.chc) : '';
        el('sk-metin').textContent = s.soru.soru;
        var u = bosalt(el('sk-sikler'));
        (s.soru.secenekler || []).forEach(function (m, i) {
            u.appendChild(yap('li', { sinif: i === s.soru.dogru ? 'dogru' : '', metin: SIK_HARF[i] + ') ' + m }));
        });
        el('sk-aciklama').textContent = s.soru.aciklama || '';
    }

    /* ---------------- Soru atlama seçicisi ---------------- */
    function soruSecici(s) {
        var sel = el('soru-atla');
        if (sel.dataset.toplam === String(s.toplamSoru)) { sel.value = String(Math.min(s.soruNo, s.toplamSoru - 1)); return; }
        bosalt(sel);
        for (var i = 0; i < s.toplamSoru; i++) sel.appendChild(yap('option', { value: i, metin: 'Soru ' + (i + 1) }));
        sel.dataset.toplam = String(s.toplamSoru);
        sel.value = String(Math.min(s.soruNo, Math.max(0, s.toplamSoru - 1)));
    }

    /* ---------------- Oyuncu tablosu ---------------- */
    /** SORUDA sırasında satır önceliği: 0 bekleyen · 1 cevaplayan · 2 çevrimdışı. */
    function bekleyisKademesi(p) { return !p.connected ? 2 : (p.cevapladi ? 1 : 0); }

    /** Cevap hücresi (YALNIZ panelde görünür — sahneye ve öğrenciye gitmez).
        SORUDA: seçilen şık harfi, doğruluk BELLİ EDİLMEZ.
        SORU_ARASI: şık harfi + ✓/✗ renklendirme (aktifSecenek / sonSecenek / sonDogru). */
    function cevapHucresi(p, durum) {
        var harf = function (i) { return (i === null || i === undefined) ? null : (SIK_HARF[i] || String(i + 1)); };
        if (durum === 'SORUDA') {
            var h = harf(p.aktifSecenek);
            return h
                ? yap('span', { sinif: 'cv notr', title: 'Seçtiği şık (doğruluk soru bitince görünür)', metin: h })
                : yap('span', { sinif: 'cv bos', title: 'Henüz cevaplamadı', metin: '⏳' });
        }
        if (durum === 'SORU_ARASI') {
            if (p.sonDogru === null || p.sonDogru === undefined) return yap('span', { sinif: 'cv bos', title: 'Bu soruda kaydı yok', metin: '–' });
            var h2 = harf(p.sonSecenek);
            if (!h2) return yap('span', { sinif: 'cv bos', title: 'Cevaplamadı (süre doldu)', metin: '⏰ boş' });
            return yap('span', { sinif: 'cv ' + (p.sonDogru ? 'dogru' : 'yanlis'),
                title: p.sonDogru ? 'Doğru cevap' : 'Yanlış cevap', metin: h2 + (p.sonDogru ? ' ✓' : ' ✗') });
        }
        return yap('span', { sinif: 'cv bos', metin: '–' });
    }

    function oyuncular(s) {
        var govde = bosalt(el('oyuncu-govde'));
        var soruda = s.durum === 'SORUDA';
        var liste = (s.oyuncular || []).slice().sort(function (a, b) {
            if (soruda) {                                   // bekleyenler üste: öğretmen tek bakışta görür
                var f = bekleyisKademesi(a) - bekleyisKademesi(b);
                if (f) return f;
            }
            return b.score - a.score;
        });
        var bagli = liste.filter(function (p) { return p.connected; }).length;
        var bekleyen = soruda ? liste.filter(function (p) { return bekleyisKademesi(p) === 0; }).length : 0;
        el('oyuncu-not').textContent = bagli + ' bağlı · ' + liste.length + ' kayıtlı'
            + (soruda ? ' · ' + (bekleyen ? '⏳ ' + bekleyen + ' bekliyor' : '✅ herkes cevapladı') : '');
        if (!liste.length) {
            govde.appendChild(yap('tr', {}, [yap('td', { colspan: 7, sinif: 'not', metin: 'Henüz kimse katılmadı.' })]));
            return;
        }
        liste.forEach(function (p) {
            var imler = [];
            imler.push(yap('span', { sinif: 'im ' + (p.connected ? 'canli' : 'kopuk'), metin: p.connected ? '🟢 çevrimiçi' : '🔴 çevrimdışı' }));
            if (soruda && p.connected) imler.push(yap('span', { sinif: 'im ' + (p.cevapladi ? 'verdi' : 'bekliyor'), metin: p.cevapladi ? '✅ cevapladı' : '⏳ bekliyor' }));
            else if (p.cevapladi) imler.push(yap('span', { sinif: 'im', metin: '✅ cevapladı' }));
            if (p.gecKatilim) imler.push(yap('span', { sinif: 'im', metin: '⏩ geç katıldı' }));
            if (p.misafir) imler.push(yap('span', { sinif: 'im', metin: '🎟️ misafir' }));
            if (p.farkliGrup) imler.push(yap('span', { sinif: 'im uyari', metin: '⚠ farklı grup' }));

            var islem = yap('div', { sinif: 'satir-islem' }, [
                yap('button', { sinif: 'dug gri mini-dug', type: 'button', metin: '🔓 Serbest', title: 'İsmi serbest bırak (öğrenci yeniden girebilir)', onclick: function () { ctx.gonder('release', { kod: p.kod }); } }),
                yap('button', { sinif: 'dug gri mini-dug', type: 'button', metin: '± Puan', title: 'Puanı elle düzelt', onclick: function () { puanDuzelt(p); } }),
                yap('button', { sinif: 'dug mavi mini-dug', type: 'button', metin: '📄 Karne', onclick: function () { Sonuclar.karneAc(p.kod); } }),
                yap('button', { sinif: 'dug kirmizi mini-dug', type: 'button', metin: '👋 Çıkar', onclick: function () {
                    if (confirm(p.isim + ' oyundan çıkarılsın mı? Puanı ve kayıtları silinir.')) ctx.gonder('kick', { playerId: p.playerId });
                } })
            ]);

            govde.appendChild(yap('tr', { sinif: (p.connected ? '' : 'kopuk ') + (p.farkliGrup ? 'farkli ' : '') + (soruda && bekleyisKademesi(p) === 0 ? 'bekliyor' : '') }, [
                yap('td', {}, [yap('strong', { metin: p.isim })]),
                yap('td', { metin: p.kod }),
                yap('td', {}, [cevapHucresi(p, s.durum)]),
                yap('td', {}, imler),
                yap('td', { sinif: 'sag', metin: UI.bashariler(p.score) }),
                yap('td', { metin: (p.seri || 0) + (p.seri >= 3 ? ' 🔥' : '') }),
                yap('td', {}, [islem])
            ]));
        });
    }
    function puanDuzelt(p) {
        var c = prompt(p.isim + ' için puan düzeltmesi (+ ekler, - çıkarır):', '100');
        if (c === null) return;
        var f = Number(String(c).replace(',', '.'));
        if (!f || isNaN(f)) return ctx.cerez('Geçerli bir sayı girin (ör. 150 veya -100).', true);
        ctx.gonder('puan_duzelt', { playerId: p.playerId, fark: Math.round(f) });
    }

    /* ---------------- Dışa açık ---------------- */
    function durum(s) {
        sonDurum = s;
        el('p-durum').textContent = s.durum;
        el('oz-soru').textContent = s.toplamSoru ? (s.soruNo + ' / ' + s.toplamSoru) : '–';
        el('oz-oyuncu').textContent = s.oyuncuSayisi || 0;
        el('oz-cevaplayan').textContent = s.cevaplayan || 0;
        el('oz-log').textContent = s.logSayisi || 0;
        var kaydedilmemis = !!(s.logSayisi && !s.raporIndirildi);
        el('rapor-uyari').classList.toggle('gizli', !kaydedilmemis);
        el('rapor-uyari').textContent = kaydedilmemis
            ? '⚠️ Bu oturumda ' + s.logSayisi + ' cevap kaydı var ve rapor/CSV henüz indirilmedi — "Etkinliği Bitir" demeden önce Sonuçlar bölümünden indirin.'
            : '';
        el('karma-ac').checked = !!s.karma;
        el('ay-karma').checked = !!s.karma;
        el('ay-lb').checked = !!s.leaderboardGoster;
        el('ay-ses').checked = !!s.sesKapali;
        if (s.setId) el('set-sec').value = s.setId;
        varsayilanSureYaz(s);
        durumGoruntu(s);
        Mod.durum(s);
        soruKutusu(s);
        soruSecici(s);
        oyuncular(s);
    }
    function cevapSayisi(d) { el('oz-cevaplayan').textContent = d.cevaplayan + (d.toplam ? ' / ' + d.toplam : ''); }

    /** 'sets' olayından gelen özetler — yalnız varsayılan süreyi göstermek için. */
    function setler(liste) {
        setOzet = {};
        (liste || []).forEach(function (x) { setOzet[x.id] = x; });
        if (sonDurum) varsayilanSureYaz(sonDurum);
    }

    g.Canli = { kur: kur, durum: durum, cevapSayisi: cevapSayisi, setler: setler, kuraSonucu: kuraSonucuYaz, sonDurum: function () { return sonDurum; } };
})(window);
