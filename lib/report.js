'use strict';
// Sonuç raporu, CSV (isimli/kodlu) ve karne verisi. Sütun adları CLAUDE.md standardı — DEĞİŞTİRİLMEZ.
const SUTUNLAR = ['zaman', 'oyun', 'set_veya_paket', 'grup', 'ogrenci_kod', 'gorev_id', 'kategori', 'chc', 'zorluk', 'sonuc', 'sure_sn', 'deneme', 'ipucu_kullanildi', 'mod', 'misafir', 'gec_katilim'];
const hucre = v => { const s = v === null || v === undefined ? '' : String(v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

function csv(cekirdek, isimli) {
    const kodIsim = {}; cekirdek.ogrenciler.forEach(o => { kodIsim[o.kod] = o.isim; });
    const bas = isimli ? ['ogrenci_isim', ...SUTUNLAR] : SUTUNLAR;
    const satirlar = cekirdek.log.map(k => (isimli ? [kodIsim[k.ogrenci_kod] || ''] : []).concat(SUTUNLAR.map(s => k[s])).map(hucre).join(';'));
    return '\uFEFF' + [bas.join(';'), ...satirlar].join('\n');
}
function dosyaAdi(cekirdek, uz) { return `${cekirdek.oyunAdi}_${cekirdek.aktifGrup || 'x'}_${new Date().toISOString().slice(0, 10)}.${uz}`; }

/** Sınıf raporu: öğrenci özetleri + kategori dökümü + en çok yanılınan sorular. */
function sinifRaporu(cekirdek) {
    const set = cekirdek.set; if (!set) return null;
    const ogr = Object.values(cekirdek.players).map(p => karne(cekirdek, p)).sort((a, b) => b.toplamPuan - a.toplamPuan);
    const soruIst = set.sorular.map(s => { const c = Object.values(cekirdek.players).map(p => p.cevaplar[s.no]).filter(Boolean);
        return { no: s.no, kategori: s.kategori || '', soru: s.soru, cevaplayan: c.length, dogru: c.filter(x => x.dogru).length,
            yanilma: c.length ? Math.round(100 * (1 - c.filter(x => x.dogru).length / c.length)) : 0 }; });
    return { etkinlik: set.ad, grup: cekirdek.aktifGrup, tarih: new Date().toISOString().slice(0, 10), ogrenciler: ogr,
        enCokYanilinan: [...soruIst].filter(x => x.cevaplayan).sort((a, b) => b.yanilma - a.yanilma).slice(0, 5), sorular: soruIst };
}
/** Tek öğrenci karnesi: genel doğruluk, kategori bazlı döküm, ortalama süre, seri. */
function karne(cekirdek, p) {
    const set = cekirdek.set, kat = {}; let dogru = 0, cevaplanan = 0, sureT = 0, sureN = 0;
    set.sorular.forEach(s => { const c = p.cevaplar[s.no]; const k = s.kategori || 'genel';
        kat[k] = kat[k] || { soru: 0, dogru: 0 }; kat[k].soru++;
        if (c && c.secenek !== null) { cevaplanan++; if (c.dogru) { dogru++; kat[k].dogru++; } if (c.sure_sn) { sureT += c.sure_sn; sureN++; } } });
    return { kod: p.kod, isim: p.isim, misafir: p.misafir, gecKatilim: p.gecKatilim, toplamPuan: p.score, soruSayisi: set.sorular.length, cevaplanan, dogru,
        dogrulukYuzde: set.sorular.length ? Math.round(100 * dogru / set.sorular.length) : 0, ortSureSn: sureN ? +(sureT / sureN).toFixed(1) : null,
        enUzunSeri: p.seri, kategoriler: Object.entries(kat).map(([ad, v]) => ({ ad, soru: v.soru, dogru: v.dogru, yuzde: Math.round(100 * v.dogru / v.soru) })) };
}
module.exports = { csv, dosyaAdi, sinifRaporu, karne, SUTUNLAR };
