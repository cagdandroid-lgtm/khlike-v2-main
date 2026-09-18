/* Soru Bankası — YALNIZ içerik yönetimi (buradan oyun başlatılamaz) ve
   "ℹ️ Etkinlik Bilgisi" modali (Kazanımlar · CHC · Veli Özeti).
   Ana görünüm: dosya yükle · set listesi · önizle · sil.  Ham JSON düzenleme "Gelişmiş" altında.
   Bilgi kaynağı: seçili setin kendi alanları; yoksa /ETKINLIK_BILGI.json. */
(function (g) {
    'use strict';
    var el = UI.el, yap = UI.yap, bosalt = UI.bosalt;
    var ctx = null, setler = [], varsayilanBilgi = null, acikOnizleme = null;
    var SIK_HARF = ['A', 'B', 'C', 'D', 'E', 'F'];
    var GRUP_AD = { p: 'P', e: 'E', u: 'U', i: 'U', c: 'U' };   // eski i/c → U (birleşti)

    var SABLON = {
        ad: 'Yeni Etkinlik', grup: 'e', hafta: 1,
        tema: { ad: 'Tema Adı', dunya: 'orman', slogan: 'Kısa bir slogan',
            palet: { zemin: '#f0fdf4', zemin2: '#dcfce7', vurgu: '#16a34a', vurgu2: '#f59e0b', metin: '#14532d', kart: '#ffffff', kartMetin: '#14532d' },
            simgeler: ['🌲', '🦊', '🍄'] },
        aciklama: 'Kısa açıklama',
        kazanimlar: ['Kazanım 1', 'Kazanım 2', 'Kazanım 3'],
        chc: { birincil: 'Gf', ikincil: ['Gq'], gerekce: 'Neden bu alanlar hedefleniyor?' },
        veli_ozeti: 'Bu hafta çocuklarımızla … çalıştık. Evde … diye sorabilirsiniz.',
        varsayilan_sure_sn: 30,
        sorular: [{ no: 1, kategori: 'örüntü', chc: ['Gf'], zorluk: 1, sure_sn: 25,
            soru: 'Soru metni', secenekler: ['A', 'B', 'C', 'D'], dogru: 0, aciklama: 'Kısa çözüm notu' }]
    };

    function kur(c) {
        ctx = c;
        el('banka-dosya').onchange = function (e) { if (e.target.files[0]) dosyaYukle(e.target.files[0]); };

        // Gelişmiş: ham JSON
        el('d-banka-oku').onclick = oku;
        el('d-banka-yeni').onclick = function () {
            el('banka-json').value = JSON.stringify(SABLON, null, 2);
            el('banka-id').value = 'yeni_set_' + Date.now().toString(36);
            not('Şablon hazır: içeriği düzenleyip "Kaydet" deyin.');
        };
        el('d-banka-kaydet').onclick = kaydet;

        el('bilgi-ac').onclick = bilgiAc;
        el('bilgi-kapat').onclick = function () { el('bilgi-modal').classList.remove('acik'); };
        UI.hepsi('.sekme').forEach(function (b) {
            b.onclick = function () {
                UI.hepsi('.sekme').forEach(function (x) { x.classList.toggle('acik', x === b); });
                ['kazanim', 'chc', 'veli'].forEach(function (s) { el('sek-' + s).classList.toggle('gizli', s !== b.dataset.sek); });
            };
        });
        el('d-veli-kopya').onclick = function () {
            var m = el('veli-metin').textContent;
            if (navigator.clipboard) navigator.clipboard.writeText(m).then(
                function () { ctx.cerez('Veli özeti kopyalandı 📋'); },
                function () { ctx.cerez('Kopyalanamadı — metni elle seçin.', true); });
            else ctx.cerez('Tarayıcı kopyalamayı desteklemiyor.', true);
        };

        fetch('/ETKINLIK_BILGI.json').then(function (r) { return r.ok ? r.json() : null; })
            .then(function (j) { varsayilanBilgi = j; }).catch(function () { });
    }
    function not(m, hataMi) {
        var d = el('banka-not');
        d.textContent = m || '';
        d.classList.toggle('hata-not', !!hataMi);
    }

    /* ---------------- Set listeleri ---------------- */
    function setleriYaz(liste) {
        setler = liste || [];
        // Canlı Oyun set seçici + Gelişmiş set seçici
        [['set-sec', true], ['banka-set', false]].forEach(function (p) {
            var sel = el(p[0]), eski = sel.value;
            bosalt(sel);
            if (p[1]) sel.appendChild(yap('option', { value: '', metin: '— set seçin —' }));
            setler.forEach(function (s) {
                sel.appendChild(yap('option', { value: s.id,
                    metin: (s.hafta ? 'H' + s.hafta + ' · ' : '') + s.ad + ' · ' + (GRUP_AD[s.grup] || s.grup) + ' grubu · ' + s.soruSayisi + ' soru' + (s.tema ? ' · ' + s.tema.ad : '') }));
            });
            if (eski) sel.value = eski;
        });
        tabloYaz();
    }

    function tabloYaz() {
        var govde = bosalt(el('banka-govde'));
        if (!setler.length) {
            govde.appendChild(yap('tr', {}, [yap('td', { colspan: 6, sinif: 'not', metin: 'Henüz set yok — yukarıdan bir .json dosyası yükleyin.' })]));
            return;
        }
        setler.forEach(function (s) {
            govde.appendChild(yap('tr', {}, [
                yap('td', {}, [yap('strong', { metin: s.ad }), yap('div', { sinif: 'not', metin: s.id + '.json' })]),
                yap('td', { metin: (GRUP_AD[s.grup] || s.grup) + ' grubu' }),
                yap('td', { metin: s.hafta ? 'H' + s.hafta : '–' }),
                yap('td', { sinif: 'sag', metin: String(s.soruSayisi) }),
                yap('td', { metin: (s.tema && s.tema.ad) || '–' }),
                yap('td', {}, [yap('div', { sinif: 'satir-islem' }, [
                    yap('button', { sinif: 'dug mavi mini-dug', type: 'button', metin: '👁️ Önizle', onclick: function () { onizle(s.id); } }),
                    yap('button', { sinif: 'dug kirmizi mini-dug', type: 'button', metin: '🗑️ Sil', onclick: function () { sil(s.id, s.ad); } })
                ])])
            ]));
        });
    }

    /* ---------------- Dosyadan yükleme ---------------- */
    function dosyaYukle(dosya) {
        var id = dosya.name.replace(/\.json$/i, '').replace(/[^a-z0-9_\-]/gi, '_').slice(0, 60);
        var okuyucu = new FileReader();
        okuyucu.onload = function () {
            var set;
            try { set = JSON.parse(okuyucu.result); }
            catch (e) { el('banka-dosya').value = ''; return not('❌ JSON okunamadı: ' + e.message, true); }
            ctx.gonder('set_kaydet', { setId: id, set: set }, function (r) {
                el('banka-dosya').value = '';
                if (!r || !r.ok) {
                    not('❌ ' + ((r && r.hatalar) ? r.hatalar.join(' · ') : 'Kaydedilemedi'), true);
                    return ctx.cerez('Set doğrulamadan geçmedi.', true);
                }
                not('✅ ' + r.id + '.json yüklendi · ' + (set.sorular || []).length + ' soru.');
                ctx.cerez('Set yüklendi: ' + (set.ad || r.id));
            });
        };
        okuyucu.readAsText(dosya, 'utf-8');
    }

    /* ---------------- Önizleme (salt okunur) ---------------- */
    function onizle(id) {
        var kutu = el('banka-onizleme');
        if (acikOnizleme === id) { kutu.classList.add('gizli'); acikOnizleme = null; return; }
        ctx.gonder('set_oku', { setId: id }, function (r) {
            if (!r || !r.ok) return ctx.cerez('Set okunamadı.', true);
            acikOnizleme = id;
            var set = r.set;
            var k = bosalt(kutu);
            kutu.classList.remove('gizli');
            k.appendChild(yap('div', { sinif: 'onizleme-bas' }, [
                yap('h4', { metin: '👁️ ' + set.ad }),
                yap('button', { sinif: 'dug gri mini-dug', type: 'button', metin: '✖ Kapat',
                    onclick: function () { kutu.classList.add('gizli'); acikOnizleme = null; } })
            ]));
            k.appendChild(yap('p', { sinif: 'not', metin:
                (GRUP_AD[set.grup] || set.grup) + ' grubu' + (set.hafta ? ' · hafta ' + set.hafta : '')
                + ' · ' + set.sorular.length + ' soru'
                + (set.tema ? ' · tema: ' + set.tema.ad : '')
                + ' · varsayılan süre ' + (set.varsayilan_sure_sn || 30) + ' sn' }));
            if (set.aciklama) k.appendChild(yap('p', { sinif: 'not', metin: set.aciklama }));

            set.sorular.forEach(function (q, i) {
                var etiket = [];
                if (q.kategori) etiket.push(yap('span', { sinif: 'sk-etiket', metin: q.kategori }));
                if (q.zorluk !== undefined && q.zorluk !== '') etiket.push(yap('span', { sinif: 'sk-etiket', metin: 'zorluk ' + q.zorluk }));
                if (q.chc) etiket.push(yap('span', { sinif: 'sk-etiket', metin: Array.isArray(q.chc) ? q.chc.join(' · ') : q.chc }));
                if (q.sure_sn) etiket.push(yap('span', { sinif: 'sk-etiket', metin: q.sure_sn + ' sn' }));

                var sikler = yap('ul', { sinif: 'sk-sikler' });
                (q.secenekler || []).forEach(function (m, j) {
                    sikler.appendChild(yap('li', { sinif: j === q.dogru ? 'dogru' : '', metin: SIK_HARF[j] + ') ' + m }));
                });
                var kart = yap('div', { sinif: 'onizleme-soru' }, [
                    yap('div', { sinif: 'sk-bas' }, [yap('strong', { metin: 'Soru ' + (q.no || i + 1) })].concat(etiket)),
                    yap('p', { sinif: 'sk-metin', metin: q.soru }),
                    sikler
                ]);
                if (q.gorsel_svg) {
                    var gor = yap('div', { sinif: 'onizleme-gorsel' });
                    gor.innerHTML = q.gorsel_svg;
                    kart.appendChild(gor);
                }
                if (q.aciklama) kart.appendChild(yap('p', { sinif: 'sk-aciklama', metin: q.aciklama }));
                k.appendChild(kart);
            });
            kutu.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
    }

    /* ---------------- Gelişmiş: ham JSON ---------------- */
    function oku() {
        var id = el('banka-set').value; if (!id) return;
        ctx.gonder('set_oku', { setId: id }, function (r) {
            if (!r || !r.ok) return ctx.cerez('Set okunamadı.', true);
            el('banka-json').value = JSON.stringify(r.set, null, 2);
            el('banka-id').value = id;
            not(id + '.json açıldı · ' + (r.set.sorular || []).length + ' soru.');
        });
    }
    function kaydet() {
        var id = el('banka-id').value.trim();
        if (!id) return ctx.cerez('Dosya adı gerekli.', true);
        var set;
        try { set = JSON.parse(el('banka-json').value); }
        catch (e) { not('❌ JSON hatası: ' + e.message, true); return ctx.cerez('JSON geçersiz.', true); }
        ctx.gonder('set_kaydet', { setId: id, set: set }, function (r) {
            if (!r || !r.ok) {
                not('❌ ' + ((r && r.hatalar) ? r.hatalar.join(' · ') : 'Kaydedilemedi'), true);
                return ctx.cerez('Set doğrulamadan geçmedi.', true);
            }
            not('✅ ' + r.id + '.json kaydedildi.');
            ctx.cerez('Set kaydedildi.');
        });
    }
    function sil(id, ad) {
        if (!confirm('"' + (ad || id) + '" seti (' + id + '.json) KALICI olarak silinecek. Emin misiniz?')) return;
        ctx.gonder('set_sil', { setId: id }, function (r) {
            if (r && r.ok === false) return;
            if (acikOnizleme === id) { el('banka-onizleme').classList.add('gizli'); acikOnizleme = null; }
            ctx.cerez('Set silindi.');
        });
    }

    /* ---------------- Etkinlik Bilgisi modali ---------------- */
    function bilgiAc() {
        var d = Canli.sonDurum();
        var setId = (d && d.setId) || el('banka-set').value || (setler[0] && setler[0].id);
        if (!setId) return bilgiCiz(varsayilanBilgi, null);
        ctx.gonder('set_oku', { setId: setId }, function (r) { bilgiCiz(varsayilanBilgi, (r && r.set) || null); });
    }
    function bilgiCiz(genel, set) {
        var kazanimlar = (set && set.kazanimlar) || (genel && genel.kazanimlar) || [];
        var chc = (set && set.chc) || (genel && genel.chc) || null;
        var veli = (set && set.veli_ozeti) || (genel && genel.veli_ozeti) || '';
        el('bilgi-baslik').textContent = 'ℹ️ Etkinlik Bilgisi' + (set ? ' — ' + set.ad : '');

        var k = bosalt(el('sek-kazanim'));
        if (kazanimlar.length) {
            k.appendChild(yap('p', { sinif: 'not', metin: 'Bu etkinlikte öğrencilerin geliştirdiği beceriler:' }));
            var ul = yap('ul');
            kazanimlar.forEach(function (x) { ul.appendChild(yap('li', { metin: x })); });
            k.appendChild(ul);
        } else k.appendChild(yap('p', { sinif: 'not', metin: 'Bu set için kazanım tanımlanmamış (set JSON\'ına "kazanimlar" ekleyin).' }));

        var c = bosalt(el('sek-chc'));
        if (chc) {
            c.appendChild(yap('p', {}, [yap('strong', { metin: 'Birincil alan: ' }), document.createTextNode(chc.birincil || '–')]));
            var ik = Array.isArray(chc.ikincil) ? chc.ikincil.join(', ') : (chc.ikincil || '–');
            c.appendChild(yap('p', {}, [yap('strong', { metin: 'İkincil alan(lar): ' }), document.createTextNode(ik)]));
            if (chc.gerekce) c.appendChild(yap('p', { metin: chc.gerekce }));
            c.appendChild(yap('p', { sinif: 'not', metin: 'Gf akıcı akıl yürütme · Gv görsel-uzamsal · Gq nicel · Gsm çalışma belleği · Gs işlem hızı · Gc sözel bilgi · Glr geri getirme. Bu bilgi öğrenci ekranlarında hiçbir yerde görünmez.' }));
        } else c.appendChild(yap('p', { sinif: 'not', metin: 'Bu set için CHC bilgisi tanımlanmamış.' }));

        el('veli-metin').textContent = veli || 'Bu set için veli özeti tanımlanmamış.';
        el('d-veli-kopya').disabled = !veli;
        el('bilgi-modal').classList.add('acik');
    }

    g.Banka = { kur: kur, setleriYaz: setleriYaz };
})(window);
