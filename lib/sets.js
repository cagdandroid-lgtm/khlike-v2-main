'use strict';
// Setleri data/sets/*.json'dan yükler ve doğrular. Set kimliği = dosya adı (uzantısız).
const fs = require('fs'), path = require('path');
const SETS_DIR = path.join(__dirname, '..', 'data', 'sets');

function dogrula(set, id) {
    const hatalar = [];
    if (!set || typeof set !== 'object') return ['JSON nesne değil'];
    if (!set.ad) hatalar.push('ad yok');
    if (!['p', 'e', 'i', 'c'].includes(String(set.grup || '').toLowerCase())) hatalar.push('grup p/e/i/c olmalı');
    if (!Array.isArray(set.sorular) || !set.sorular.length) hatalar.push('sorular boş');
    else set.sorular.forEach((s, k) => {
        if (!s.soru) hatalar.push(`soru ${k + 1}: metin yok`);
        if (!Array.isArray(s.secenekler) || s.secenekler.length < 2) hatalar.push(`soru ${k + 1}: en az 2 şık`);
        if (typeof s.dogru !== 'number' || s.dogru < 0 || s.dogru >= (s.secenekler || []).length) hatalar.push(`soru ${k + 1}: dogru indeksi geçersiz`);
        if (!s.no) s.no = k + 1;
    });
    return hatalar;
}

function yukle() {
    if (!fs.existsSync(SETS_DIR)) fs.mkdirSync(SETS_DIR, { recursive: true });
    const setler = {}, sorunlar = [];
    fs.readdirSync(SETS_DIR).filter(f => f.endsWith('.json')).sort().forEach(f => {
        const id = f.replace(/\.json$/, '');
        try {
            const set = JSON.parse(fs.readFileSync(path.join(SETS_DIR, f), 'utf8'));
            const h = dogrula(set, id);
            if (h.length) sorunlar.push({ id, hatalar: h }); else { set.grup = set.grup.toLowerCase(); setler[id] = set; }
        } catch (e) { sorunlar.push({ id, hatalar: [e.message] }); }
    });
    return { setler, sorunlar };
}

function kaydet(id, set) {           // panelden içe aktarım / düzenleme
    const h = dogrula(set, id); if (h.length) return { ok: false, hatalar: h };
    const guvenliId = String(id).replace(/[^a-z0-9_\-]/gi, '_').slice(0, 60) || `set_${Date.now()}`;
    fs.writeFileSync(path.join(SETS_DIR, guvenliId + '.json'), JSON.stringify(set, null, 2), 'utf8');
    return { ok: true, id: guvenliId };
}
function sil(id) { const p = path.join(SETS_DIR, String(id).replace(/[^a-z0-9_\-]/gi, '_') + '.json'); if (fs.existsSync(p)) fs.unlinkSync(p); }

/** Panel listesi için özet (öğrenciye asla gitmez). */
function ozet(setler) {
    return Object.entries(setler).map(([id, s]) => ({ id, ad: s.ad, grup: s.grup, hafta: s.hafta || null, soruSayisi: s.sorular.length,
        varsayilanSure: s.varsayilan_sure_sn || null,
        tema: s.tema ? { ad: s.tema.ad, dunya: s.tema.dunya } : null, aciklama: s.aciklama || '' }))
        .sort((a, b) => (a.hafta || 99) - (b.hafta || 99) || a.grup.localeCompare(b.grup));
}
module.exports = { yukle, kaydet, sil, ozet, dogrula };
