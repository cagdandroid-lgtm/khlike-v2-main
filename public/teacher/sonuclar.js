/* Sonuçlar bölümü: sınıf raporu, CSV dışa aktarım, öğrenci karnesi ve yazdırılabilir karneler.
   Tüm sayılar sunucudan hazır gelir; burada yalnız biçimlendirme yapılır.
   Tek istisna: öğretmenin elle yüklediği ESKİ oturum CSV'sinden "geçen oturuma göre değişim" satırı. */
(function (g) {
    'use strict';
    var el = UI.el, yap = UI.yap, bosalt = UI.bosalt;
    var ctx = null, oncekiOturum = null;   // {kod: yuzde}

    function kur(c) {
        ctx = c;
        el('d-rapor-al').onclick = raporGetir;
        el('d-csv-kod').onclick = function () { csv(false); };
        el('d-csv-isim').onclick = function () { csv(true); };
        el('d-tum-karne').onclick = tumKarneler;
        el('karne-kapat').onclick = function () { el('karne-modal').classList.remove('acik'); };
        el('d-karne-yazdir').onclick = function () { window.print(); };
        el('d-onceki-csv').onchange = function (e) { if (e.target.files[0]) oncekiOku(e.target.files[0]); };
    }

    /* ---------------- CSV ---------------- */
    function csv(isimli) {
        ctx.gonder('csv', { isimli: !!isimli }, function (r) {
            if (!r || !r.ok) return ctx.cerez('CSV alınamadı.', true);
            UI.indir(r.ad, r.icerik, 'text/csv');
            ctx.cerez('📥 ' + r.ad + ' indirildi.');
        });
    }

    /* ---------------- Sınıf raporu ---------------- */
    function raporGetir() {
        ctx.gonder('rapor_al', {}, function (r) {
            if (!r || !r.ok || !r.rapor) return ctx.cerez('Rapor yok — önce bir set açın.', true);
            ciz(r.rapor);
        });
    }
    function ciz(rp) {
        var alan = bosalt(el('rapor-alan'));
        alan.appendChild(yap('p', { sinif: 'not', metin: rp.etkinlik + ' · grup ' + (rp.grup || '-').toUpperCase() + ' · ' + rp.tarih }));

        // Öğrenci özet tablosu
        var tb = yap('tbody');
        rp.ogrenciler.forEach(function (o) {
            tb.appendChild(yap('tr', {}, [
                yap('td', {}, [yap('strong', { metin: o.isim }), o.misafir ? yap('span', { sinif: 'im', metin: '🎟️' }) : null]),
                yap('td', { metin: o.kod }),
                yap('td', { sinif: 'sag', metin: UI.bashariler(o.toplamPuan) }),
                yap('td', { sinif: 'sag', metin: o.dogru + '/' + o.soruSayisi }),
                yap('td', { sinif: 'sag', metin: '%' + o.dogrulukYuzde }),
                yap('td', { sinif: 'sag', metin: o.ortSureSn === null ? '–' : o.ortSureSn + ' sn' }),
                yap('td', {}, [yap('button', { sinif: 'dug mavi mini-dug', type: 'button', metin: '📄 Karne', onclick: function () { karneAc(o.kod); } })])
            ]));
        });
        var tablo = yap('table', { sinif: 'tablo' }, [
            yap('thead', {}, [yap('tr', {}, [
                yap('th', { metin: 'Öğrenci' }), yap('th', { metin: 'Kod' }), yap('th', { sinif: 'sag', metin: 'Puan' }),
                yap('th', { sinif: 'sag', metin: 'Doğru' }), yap('th', { sinif: 'sag', metin: 'Doğruluk' }),
                yap('th', { sinif: 'sag', metin: 'Ort. süre' }), yap('th', { metin: '' })
            ])]), tb
        ]);
        alan.appendChild(yap('div', { sinif: 'tablo-sar' }, [tablo]));

        // En çok yanılınan sorular
        if (rp.enCokYanilinan && rp.enCokYanilinan.length) {
            var kart = yap('div', { sinif: 'rapor-kart' }, [yap('h4', { metin: '🔍 En çok yanılınan sorular' })]);
            rp.enCokYanilinan.forEach(function (s) {
                kart.appendChild(yap('div', { sinif: 'cubuk-satir' }, [
                    yap('span', { sinif: 'ad', metin: 'S' + s.no + (s.kategori ? ' · ' + s.kategori : '') }),
                    yap('span', { sinif: 'cb' }, [yap('i', { stil: 'width:' + s.yanilma + '%;background:#dc2626' })]),
                    yap('span', { sinif: 'yz', metin: '%' + s.yanilma })
                ]));
            });
            alan.appendChild(kart);
        }
        ctx.cerez('Rapor tazelendi.');
    }

    /* ---------------- Öğrenci karnesi ---------------- */
    function karneAc(kod) {
        ctx.gonder('karne_al', { kod: kod }, function (r) {
            if (!r || !r.ok) return ctx.cerez((r && r.hata) || 'Karne alınamadı.', true);
            el('karne-baslik').textContent = '📄 ' + r.karne.isim + ' (' + r.karne.kod + ')';
            bosalt(el('karne-alan')).appendChild(karneDugum(r.karne, ctx.etkinlikAdi()));
            el('karne-modal').classList.add('acik');
        });
    }
    function karneDugum(k, etkinlik) {
        var satir = function (a, b) { return yap('div', { sinif: 'karne-satir' }, [yap('span', { metin: a }), yap('strong', { metin: b })]); };
        var d = yap('div', { sinif: 'karne' }, [
            yap('h3', { metin: k.isim + ' — ' + (etkinlik || 'Etkinlik') }),
            yap('p', { sinif: 'not', metin: 'Kod: ' + k.kod + ' · Tarih: ' + new Date().toLocaleDateString('tr-TR') }),
            satir('Toplam puan', UI.bashariler(k.toplamPuan)),
            satir('Doğru cevap', k.dogru + ' / ' + k.soruSayisi),
            satir('Genel doğruluk', '%' + k.dogrulukYuzde),
            satir('Cevaplanan soru', String(k.cevaplanan)),
            satir('Ortalama süre', k.ortSureSn === null ? '–' : k.ortSureSn + ' saniye'),
            satir('En uzun doğru serisi', String(k.enUzunSeri))
        ]);
        if (oncekiOturum && oncekiOturum[k.kod] !== undefined) {
            var fark = k.dogrulukYuzde - oncekiOturum[k.kod];
            d.appendChild(satir('Geçen oturuma göre değişim',
                (fark > 0 ? '▲ +' : fark < 0 ? '▼ ' : '● ') + fark + ' puan doğruluk (önceki: %' + oncekiOturum[k.kod] + ')'));
        }
        if (k.kategoriler && k.kategoriler.length) {
            d.appendChild(yap('h4', { metin: 'Kategori bazlı döküm' }));
            k.kategoriler.forEach(function (c) {
                d.appendChild(yap('div', { sinif: 'cubuk-satir' }, [
                    yap('span', { sinif: 'ad', metin: c.ad + ' (' + c.dogru + '/' + c.soru + ')' }),
                    yap('span', { sinif: 'cb' }, [yap('i', { stil: 'width:' + c.yuzde + '%' })]),
                    yap('span', { sinif: 'yz', metin: '%' + c.yuzde })
                ]));
            });
        }
        return d;
    }

    /* ---------------- Tüm karneler (öğrenci başına bir A4) ---------------- */
    function tumKarneler() {
        ctx.gonder('tum_karneler', {}, function (r) {
            if (!r || !r.ok || !r.karneler.length) return ctx.cerez('Karne üretilecek öğrenci yok.', true);
            var w = window.open('', '_blank');
            if (!w) return ctx.cerez('Açılır pencere engellendi — izin verin.', true);
            var stil = '<style>'
                + '@page{size:A4;margin:16mm}'
                + 'body{font-family:Poppins,system-ui,sans-serif;color:#0f172a;font-size:12pt}'
                + '.sayfa{page-break-after:always}.sayfa:last-child{page-break-after:auto}'
                + 'h1{font-size:20pt;margin:0 0 2mm}h2{font-size:13pt;margin:6mm 0 2mm}'
                + '.ust{border-bottom:3px solid #4f46e5;padding-bottom:3mm;margin-bottom:5mm}'
                + '.s{display:flex;justify-content:space-between;padding:2mm 0;border-bottom:1px dashed #cbd5e1}'
                + '.cb{height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden;flex:1;margin:0 4mm}'
                + '.cb i{display:block;height:100%;background:#4f46e5}'
                + '.k{display:flex;align-items:center;padding:1.5mm 0;font-size:11pt}'
                + '.k .a{width:45%}.k .y{width:12%;text-align:right;font-weight:700}'
                + '.dip{margin-top:8mm;font-size:9pt;color:#475569}'
                + '</style>';
            var govde = r.karneler.map(function (k) { return sayfaHtml(k, r.etkinlik); }).join('');
            w.document.write('<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Karneler — ' + UI.kacir(r.etkinlik) + '</title>' + stil + '</head><body>' + govde + '</body></html>');
            w.document.close();
            setTimeout(function () { w.focus(); w.print(); }, 350);
        });
    }
    function sayfaHtml(k, etkinlik) {
        var s = function (a, b) { return '<div class="s"><span>' + a + '</span><strong>' + b + '</strong></div>'; };
        var kat = (k.kategoriler || []).map(function (c) {
            return '<div class="k"><span class="a">' + UI.kacir(c.ad) + ' (' + c.dogru + '/' + c.soru + ')</span>'
                + '<span class="cb"><i style="width:' + c.yuzde + '%"></i></span><span class="y">%' + c.yuzde + '</span></div>';
        }).join('');
        var degisim = (oncekiOturum && oncekiOturum[k.kod] !== undefined)
            ? s('Geçen oturuma göre değişim', (k.dogrulukYuzde - oncekiOturum[k.kod] > 0 ? '▲ +' : '▼ ') + (k.dogrulukYuzde - oncekiOturum[k.kod]) + ' puan') : '';
        return '<div class="sayfa">'
            + '<div class="ust"><h1>' + UI.kacir(k.isim) + '</h1>'
            + '<div>' + UI.kacir(etkinlik || '') + ' · ' + new Date().toLocaleDateString('tr-TR') + '</div></div>'
            + s('Toplam puan', UI.bashariler(k.toplamPuan))
            + s('Doğru cevap', k.dogru + ' / ' + k.soruSayisi)
            + s('Genel doğruluk', '%' + k.dogrulukYuzde)
            + s('Ortalama süre', (k.ortSureSn === null ? '–' : k.ortSureSn + ' saniye'))
            + s('En uzun doğru serisi', String(k.enUzunSeri))
            + degisim
            + '<h2>Kategori bazlı döküm</h2>' + kat
            + '<p class="dip">Bu karne sınıf içi etkinlik gözlemidir; bir ölçme-değerlendirme belgesi değildir. '
            + 'Sorularınız için öğretmeninize yazabilirsiniz.</p></div>';
    }

    /* ---------------- Geçen oturum CSV'si ---------------- */
    function oncekiOku(dosya) {
        var okuyucu = new FileReader();
        okuyucu.onload = function () {
            try {
                var satir = String(okuyucu.result).replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
                var bas = satir.shift().split(';');
                var iKod = bas.indexOf('ogrenci_kod'), iSonuc = bas.indexOf('sonuc');
                if (iKod < 0 || iSonuc < 0) throw new Error('sütun yok');
                var sayac = {};
                satir.forEach(function (s) {
                    var h = s.split(';'), kod = (h[iKod] || '').replace(/"/g, '').trim();
                    if (!kod) return;
                    sayac[kod] = sayac[kod] || { t: 0, d: 0 };
                    sayac[kod].t++;
                    if ((h[iSonuc] || '').replace(/"/g, '').trim() === 'dogru') sayac[kod].d++;
                });
                oncekiOturum = {};
                Object.keys(sayac).forEach(function (k) { oncekiOturum[k] = Math.round(100 * sayac[k].d / sayac[k].t); });
                ctx.cerez('Geçen oturum yüklendi: ' + Object.keys(oncekiOturum).length + ' öğrenci.');
            } catch (e) {
                oncekiOturum = null;
                ctx.cerez('CSV okunamadı — KHLike CSV dosyası olmalı.', true);
            }
        };
        okuyucu.readAsText(dosya, 'utf-8');
    }

    g.Sonuclar = { kur: kur, karneAc: karneAc, raporGetir: raporGetir };
})(window);
