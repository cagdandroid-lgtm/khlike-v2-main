'use strict';
// data/ogrenciler.json — TÜM oyunlarda aynı dosya; kodlar kalıcı, isimler asla kayıtta tutulmaz (yalnız panelde).
const fs = require('fs'), path = require('path');
const { grupNormalize } = require('./gruplar');
const DOSYA = path.join(__dirname, '..', 'data', 'ogrenciler.json');
const KOD_DESENI = /^[A-ZİIÇŞĞÜÖ]-?\d{2,3}$/;

function yukle() {
    if (!fs.existsSync(DOSYA)) return { ogrenciler: [], guncelleme: null };
    const j = JSON.parse(fs.readFileSync(DOSYA, 'utf8'));
    const liste = (j.ogrenciler || []).map(o => ({ kod: String(o.kod || '').toUpperCase().trim(), isim: String(o.isim || '').trim().slice(0, 40),
        grup: grupNormalize(o.grup) || String(o.grup || '').toLowerCase(), aktif: o.aktif !== false,
        ...(o.eski_kod ? { eski_kod: String(o.eski_kod).toUpperCase().trim() } : {}) })).filter(o => o.kod && o.isim);   // eski_kod: İ/C → U geçişinden önceki kod (eski CSV'lerle eşleme)
    return { ogrenciler: liste, guncelleme: j.guncelleme || null };
}
function disaAktar(ogrenciler) {     // "Listeyi İndir" — misafirler dahil edilmez, isimler dahil (öğretmen dosyası)
    return JSON.stringify({ _aciklama: 'UYCEP Logic ortak öğrenci listesi. Tüm oyun depolarında aynı dosya. Kodlar kalıcıdır; ayrılan öğrenci aktif:false yapılır.',
        guncelleme: new Date().toISOString().slice(0, 10),
        ogrenciler: ogrenciler.filter(o => !o.misafir).map(o => ({ kod: o.kod, isim: o.isim, grup: o.grup, aktif: o.aktif !== false,
            ...(o.eski_kod ? { eski_kod: o.eski_kod } : {}) })) }, null, 2);
}
function ekle(ogrenciler, { kod, isim, grup }) {
    kod = String(kod || '').toUpperCase().trim();
    if (!KOD_DESENI.test(kod)) return { ok: false, hata: 'Kod biçimi: E-01 gibi.' };
    if (ogrenciler.some(o => o.kod === kod)) return { ok: false, hata: 'Bu kod zaten var.' };
    if (!isim) return { ok: false, hata: 'İsim gerekli.' };
    grup = grupNormalize(grup || 'e'); if (!grup) return { ok: false, hata: 'Grup p/e/u olmalı.' };
    const o = { kod, isim: String(isim).trim().slice(0, 40), grup, aktif: true };
    ogrenciler.push(o); return { ok: true, ogrenci: o };
}
function guncelle(ogrenciler, kod, degisiklik) {
    const o = ogrenciler.find(x => x.kod === kod); if (!o) return { ok: false, hata: 'Bulunamadı.' };
    if (degisiklik.isim !== undefined) o.isim = String(degisiklik.isim).trim().slice(0, 40);
    if (degisiklik.grup !== undefined) {
        const gr = grupNormalize(degisiklik.grup); if (!gr) return { ok: false, hata: 'Grup p/e/u olmalı.' };
        o.grup = gr;
    }
    if (degisiklik.aktif !== undefined) o.aktif = !!degisiklik.aktif;
    return { ok: true, ogrenci: o };
}
module.exports = { yukle, disaAktar, ekle, guncelle };
