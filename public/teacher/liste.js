/* Öğrenci Listesi bölümü (panelin EN SONU): ogrenciler.json görüntüleme, filtreleme,
   ekleme/düzenleme/pasifleştirme, misafir ekleme ve listeyi indirme. */
(function (g) {
    'use strict';
    var el = UI.el, yap = UI.yap, bosalt = UI.bosalt;
    var ctx = null, liste = [];

    var GRUP_AD = { p: 'P', e: 'E', i: 'İ', c: 'C' };

    function kur(c) {
        ctx = c;
        el('d-r-ekle').onclick = ekle;
        el('d-r-indir').onclick = indir;
        el('d-misafir').onclick = misafir;
        ['r-ara', 'r-grup', 'r-aktif'].forEach(function (id) {
            el(id).oninput = ciz; el(id).onchange = ciz;
        });
    }

    function yaz(o) { liste = (o && o.ogrenciler) || []; ciz(); }

    function ciz() {
        var ara = el('r-ara').value.trim().toLocaleLowerCase('tr');
        var grup = el('r-grup').value, aktif = el('r-aktif').value;
        var govde = bosalt(el('r-govde'));
        var suz = liste.filter(function (o) {
            if (grup && (o.grup || '') !== grup) return false;
            if (aktif === '1' && o.aktif === false) return false;
            if (aktif === '0' && o.aktif !== false) return false;
            if (ara && o.isim.toLocaleLowerCase('tr').indexOf(ara) === -1 && o.kod.toLowerCase().indexOf(ara) === -1) return false;
            return true;
        });
        if (!suz.length) {
            govde.appendChild(yap('tr', {}, [yap('td', { colspan: 5, sinif: 'not', metin: 'Bu süzgeçle eşleşen öğrenci yok.' })]));
            return;
        }
        suz.forEach(function (o) {
            var isimKutu = yap('input', { type: 'text', value: o.isim, size: 16, 'aria-label': o.kod + ' ismi' });
            isimKutu.onchange = function () { ctx.gonder('roster_guncelle', { kod: o.kod, isim: isimKutu.value }); };

            var grupSec = yap('select', { 'aria-label': o.kod + ' grubu' });
            ['p', 'e', 'i', 'c'].forEach(function (x) { grupSec.appendChild(yap('option', { value: x, metin: GRUP_AD[x] })); });
            grupSec.value = o.grup || 'e';
            grupSec.onchange = function () { ctx.gonder('roster_guncelle', { kod: o.kod, grup: grupSec.value }); };

            var pasif = o.aktif === false;
            govde.appendChild(yap('tr', { sinif: pasif ? 'kopuk' : '' }, [
                yap('td', {}, [yap('strong', { metin: o.kod }), o.misafir ? yap('span', { sinif: 'im', metin: '🎟️' }) : null]),
                yap('td', {}, [isimKutu]),
                yap('td', {}, [grupSec]),
                yap('td', {}, [yap('span', { sinif: 'im ' + (pasif ? 'kopuk' : 'canli'), metin: pasif ? '⏸ pasif' : '✅ aktif' })]),
                yap('td', {}, [yap('button', {
                    sinif: 'dug ' + (pasif ? 'yesil' : 'kirmizi') + ' mini-dug', type: 'button',
                    metin: pasif ? '↩️ Aktifleştir' : '⏸ Pasifleştir',
                    onclick: function () { ctx.gonder('roster_guncelle', { kod: o.kod, aktif: pasif }); }
                })])
            ]));
        });
    }

    function ekle() {
        var kod = el('r-kod').value.trim().toUpperCase(), isim = el('r-isim').value.trim();
        if (!kod || !isim) return ctx.cerez('Kod ve isim gerekli.', true);
        ctx.gonder('roster_ekle', { kod: kod, isim: isim, grup: el('r-yeni-grup').value }, function (r) {
            if (!r || !r.ok) return ctx.cerez((r && r.hata) || 'Eklenemedi.', true);
            el('r-kod').value = ''; el('r-isim').value = '';
            ctx.cerez(isim + ' listeye eklendi.');
        });
    }
    function misafir() {
        var isim = el('ay-misafir').value.trim();
        if (!isim) return ctx.cerez('Misafir adı gerekli.', true);
        ctx.gonder('roster_misafir', { isim: isim }, function (r) {
            el('ay-misafir').value = '';
            ctx.cerez('Misafir eklendi: ' + ((r && r.ogrenci) ? r.ogrenci.isim + ' (' + r.ogrenci.kod + ')' : isim));
        });
    }
    function indir() {
        ctx.gonder('roster_indir', {}, function (r) {
            if (!r || !r.ok) return ctx.cerez('İndirilemedi.', true);
            UI.indir(r.ad, r.icerik, 'application/json');
            ctx.cerez('📥 ogrenciler.json indirildi — depodaki data/ klasörüyle değiştirin.');
        });
    }

    g.Liste = { kur: kur, yaz: yaz };
})(window);
