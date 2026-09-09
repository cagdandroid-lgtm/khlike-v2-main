'use strict';
/**
 * KHLike v2 MOD KATMANI v2
 * Formatlar: yaris · fetih (CtO) · kalkan_roket · donen_duello · eleme_duello (izleyicili + gölge ligi)
 * Değişmezler: hiçbir mekanik cevaplamayı engellemez · roket yalnız yukarıdakine · kayıt/ölçüm hiçbir formatta değişmez.
 *
 * FETİH (CtO sadakati): Soru bitince fetih OLMAZ; öğretmen "Fetih Aşamasını Başlat" der.
 *  - Yalnız o turda DOĞRU cevaplayanlar fethedebilir (1 hak) ve toprakları o aşamada KORUMALIDIR.
 *  - Boş arazi varken başkasının toprağına saldırılamaz; korumalı/kalkanlı toprak fethedilemez.
 *  - Kareyi öğrenci kendi haritasından SEÇER. En hızlı doğru cevaplayan 1 KALKAN hakkı kazanır ve
 *    bunu yanlış cevaplamış bir arkadaşına hediye edebilir (kendine veremez).
 * ELEME DÜELLOSU: Her soru bir maçtır; braket otomatik kurulur/ilerler (panelde ek düğme yok).
 *  - Yalnız maçın iki oyuncusunun sonucu maçı belirler: doğru + daha hızlı kazanır; ikisi de yanlışsa ikisi de elenir.
 *  - Tek kalan bay geçer. Diğer herkes GÖLGE LİGİ'nde aynı soruyu çözmeye devam eder (puan/ölçüm normal akar).
 */
const FORMATLAR = ['yaris', 'fetih', 'kalkan_roket', 'donen_duello', 'eleme_duello'];
const ESYALAR = ['kalkan', 'roket', 'ipucu', 'cift'];
const ESYA_AGIRLIK = { kalkan: 30, roket: 30, ipucu: 25, cift: 15 };
const ROKET_PUAN = 150, DUELLO_BONUS = 100, FETIH_BOYUT = 6;
const TUR_ADLARI = { 2: 'FİNAL', 4: 'Yarı Final', 8: 'Çeyrek Final' };

function rastgeleEsya(rnd) { let r = rnd() * 100; for (const e of ESYALAR) { r -= ESYA_AGIRLIK[e]; if (r <= 0) return e; } return 'kalkan'; }

function baslat(c) {
    c.meta = { format: c.format };
    if (c.format === 'fetih') Object.assign(c.meta, { harita: Array(FETIH_BOYUT * FETIH_BOYUT).fill(null), asama: 'yok', haklar: {}, korumali: [], kalkanli: [], kalkanHak: {}, sonHiz: [] });
    if (c.format === 'kalkan_roket') Object.assign(c.meta, { esyalar: {}, ciftAktif: {}, ipucuKullanan: {} });
    if (c.format === 'donen_duello') Object.assign(c.meta, { esler: {}, kazanilan: {} });
    if (c.format === 'eleme_duello') Object.assign(c.meta, { turMaclari: [], macIndex: -1, tur: 0, turAdi: '', elenen: [], aktifMac: null, sampiyon: null, kazanilan: {}, bay: null });
}

/* ---------------- ELEME DÜELLOSU: braket ---------------- */
function _aktifOyuncular(c) { return Object.keys(c.players).filter(id => c.players[id].connected && !c.meta.elenen.includes(c.players[id].kod)); }
function _turKur(c, rnd) {
    const ids = _aktifOyuncular(c);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    c.meta.tur += 1;
    c.meta.turAdi = TUR_ADLARI[ids.length] || `${c.meta.tur}. Tur`;
    c.meta.turMaclari = [];
    for (let i = 0; i + 1 < ids.length; i += 2) c.meta.turMaclari.push({ p1: ids[i], p2: ids[i + 1], kazanan: null, berabere: false });
    c.meta.bay = ids.length % 2 === 1 ? ids[ids.length - 1] : null;     // tek kalan bay geçer
    c.meta.macIndex = -1;
}

function soruBaslat(c, rnd = Math.random) {
    if (!c.meta || c.meta.format !== c.format) baslat(c);
    if (c.format === 'kalkan_roket') c.meta.ipucuKullanan = {};
    if (c.format === 'fetih') { c.meta.asama = 'yok'; c.meta.korumali = []; c.meta.kalkanli = []; c.meta.haklar = {}; }
    if (c.format === 'donen_duello') {
        const ids = Object.entries(c.players).filter(([, p]) => p.connected).map(([id]) => id);
        for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
        const esler = {}; for (let i = 0; i + 1 < ids.length; i += 2) { esler[ids[i]] = ids[i + 1]; esler[ids[i + 1]] = ids[i]; }
        if (ids.length % 2 === 1) esler[ids[ids.length - 1]] = null;
        c.meta.esler = esler;
    }
    if (c.format === 'eleme_duello') {
        if (c.meta.sampiyon) { c.meta.aktifMac = null; return; }
        if (c.meta.tur === 0) _turKur(c, rnd);
        let i = c.meta.turMaclari.findIndex((m, k) => k > c.meta.macIndex && !m.kazanan && !m.berabere);
        if (i === -1) {
            const kalan = _aktifOyuncular(c);
            if (kalan.length <= 1) { c.meta.sampiyon = kalan.length ? c.players[kalan[0]].isim : 'berabere'; c.meta.aktifMac = null; return; }
            _turKur(c, rnd); i = 0;
        }
        c.meta.macIndex = i;
        const m = c.meta.turMaclari[i];
        c.meta.aktifMac = { p1: m.p1, p2: m.p2 };
    }
}

function puanCarpani(c, playerId) {
    if (c.format === 'kalkan_roket' && c.meta && c.meta.ciftAktif[playerId]) { delete c.meta.ciftAktif[playerId]; return 2; }
    return 1;
}
function ipucuKullandiMi(c, playerId) { return c.format === 'kalkan_roket' && !!c.meta && c.meta.ipucuKullanan[playerId] !== undefined; }

function soruSonrasi(c, sonuclar, hizSirasi, rnd = Math.random) {
    const kisisel = {};
    if (c.format === 'fetih') {
        c.meta.sonHiz = [...hizSirasi];
        if (hizSirasi[0]) { c.meta.kalkanHak[hizSirasi[0]] = (c.meta.kalkanHak[hizSirasi[0]] || 0) + 1; kisisel[hizSirasi[0]] = { kalkanHakKazandi: true }; }
        Object.keys(c.players).forEach(pid => { kisisel[pid] = { ...(kisisel[pid] || {}), fetihHakki: hizSirasi.includes(pid) }; });
    }
    if (c.format === 'kalkan_roket') {
        hizSirasi.forEach(pid => { const e = rastgeleEsya(rnd); (c.meta.esyalar[pid] = c.meta.esyalar[pid] || []).push(e); kisisel[pid] = { kazanilanEsya: e }; });
    }
    if (c.format === 'donen_duello') {
        const gorulen = new Set();
        Object.entries(c.meta.esler).forEach(([a, b]) => {
            if (gorulen.has(a)) return; gorulen.add(a); if (b) gorulen.add(b);
            const ra = sonuclar[a] || {}, rb = b ? (sonuclar[b] || {}) : null;
            let kazanan = null;
            if (!b) kazanan = ra.dogru ? a : null;
            else if (ra.dogru && !rb.dogru) kazanan = a; else if (rb && rb.dogru && !ra.dogru) kazanan = b;
            else if (ra.dogru && rb.dogru) kazanan = hizSirasi.indexOf(a) < hizSirasi.indexOf(b) ? a : b;
            if (kazanan) { c.players[kazanan].score += DUELLO_BONUS; c.meta.kazanilan[kazanan] = (c.meta.kazanilan[kazanan] || 0) + 1; }
            kisisel[a] = { duello: { rakip: b ? c.players[b].isim : null, kazandi: kazanan === a, berabere: !kazanan } };
            if (b) kisisel[b] = { duello: { rakip: c.players[a].isim, kazandi: kazanan === b, berabere: !kazanan } };
        });
    }
    if (c.format === 'eleme_duello' && c.meta.aktifMac) {
        const m = c.meta.turMaclari[c.meta.macIndex];
        const { p1, p2 } = m;
        const r1 = sonuclar[p1] || {}, r2 = sonuclar[p2] || {};
        let kazanan = null;
        if (r1.dogru && !r2.dogru) kazanan = p1; else if (r2.dogru && !r1.dogru) kazanan = p2;
        else if (r1.dogru && r2.dogru) kazanan = hizSirasi.indexOf(p1) < hizSirasi.indexOf(p2) ? p1 : p2;
        if (kazanan) {
            const kaybeden = kazanan === p1 ? p2 : p1;
            m.kazanan = kazanan;
            c.players[kazanan].score += DUELLO_BONUS;
            c.meta.kazanilan[kazanan] = (c.meta.kazanilan[kazanan] || 0) + 1;
            c.meta.elenen.push(c.players[kaybeden].kod);
            kisisel[kazanan] = { duello: { rakip: c.players[kaybeden].isim, kazandi: true, elendi: false } };
            kisisel[kaybeden] = { duello: { rakip: c.players[kazanan].isim, kazandi: false, elendi: true } };
        } else {                                                        // ikisi de yanlış/cevapsız → ikisi de elenir (Düello kuralı)
            m.berabere = true;
            c.meta.elenen.push(c.players[p1].kod, c.players[p2].kod);
            kisisel[p1] = { duello: { rakip: c.players[p2].isim, kazandi: false, berabere: true, elendi: true } };
            kisisel[p2] = { duello: { rakip: c.players[p1].isim, kazandi: false, berabere: true, elendi: true } };
        }
        Object.keys(c.players).forEach(pid => { if (pid !== p1 && pid !== p2) kisisel[pid] = { golge: true }; });
        c.meta.aktifMac = null;
        const kalanMac = c.meta.turMaclari.some((x, i) => i > c.meta.macIndex && !x.kazanan && !x.berabere);
        if (!kalanMac) { const kalan = _aktifOyuncular(c); if (kalan.length === 1) c.meta.sampiyon = c.players[kalan[0]].isim; else if (kalan.length === 0) c.meta.sampiyon = 'berabere'; }
    }
    return kisisel;
}

/* ---------------- FETİH AŞAMASI (öğretmen kontrolünde) ---------------- */
function fetihBaslat(c) {
    if (c.format !== 'fetih') return { ok: false, hata: 'Format fetih değil.' };
    if (!c.meta.sonHiz.length) return { ok: false, hata: 'Bu turda doğru cevaplayan yok — fetih aşaması açılamaz.' };
    if (c.meta.asama === 'fetih') return { ok: false, hata: 'Fetih aşaması zaten açık.' };
    c.meta.asama = 'fetih';
    c.meta.haklar = {}; c.meta.sonHiz.forEach(pid => { c.meta.haklar[pid] = 1; });
    c.meta.korumali = [...c.meta.sonHiz];                                // doğru cevaplayanların toprağı korunur
    return { ok: true, hakSahipleri: c.meta.sonHiz.map(pid => c.players[pid] ? c.players[pid].isim : '?') };
}
function fetihBitir(c) { if (c.format !== 'fetih') return { ok: false }; c.meta.asama = 'yok'; return { ok: true }; }

function kareSec(c, pid, kare) {
    if (c.format !== 'fetih' || c.meta.asama !== 'fetih') return { ok: false, hata: 'Fetih aşaması açık değil.' };
    if (!c.meta.haklar[pid]) return { ok: false, hata: 'Fetih hakkın yok ya da hakkını kullandın.' };
    kare = Number(kare);
    if (!(kare >= 0 && kare < c.meta.harita.length)) return { ok: false, hata: 'Geçersiz kare.' };
    const sahip = c.meta.harita[kare];
    if (sahip === pid) return { ok: false, hata: 'Bu kare zaten senin.' };
    const bosVar = c.meta.harita.some(o => o === null);
    if (sahip !== null && bosVar) return { ok: false, hata: 'Boş araziler varken başkasına saldıramazsın!' };
    if (sahip !== null && (c.meta.korumali.includes(sahip) || c.meta.kalkanli.includes(sahip))) return { ok: false, hata: 'Bu devlet KORUMA altında!' };
    c.meta.harita[kare] = pid;
    c.meta.haklar[pid] -= 1;
    return { ok: true, kare, fethedilen: sahip !== null, oncekiSahip: sahip ? (c.players[sahip] ? c.players[sahip].isim : null) : null, kalanHak: c.meta.haklar[pid] };
}
function kalkanVer(c, pid, hedefKod) {
    if (c.format !== 'fetih') return { ok: false, hata: 'Format fetih değil.' };
    if (!(c.meta.kalkanHak[pid] > 0)) return { ok: false, hata: 'Kalkan hakkın yok.' };
    const hedefId = Object.keys(c.players).find(id => c.players[id].kod === hedefKod);
    if (!hedefId) return { ok: false, hata: 'Hedef bulunamadı.' };
    if (hedefId === pid) return { ok: false, hata: 'Kalkan kendine verilmez; bir arkadaşını koru.' };
    if (c.meta.korumali.includes(hedefId)) return { ok: false, hata: 'Bu oyuncu zaten koruma altında!' };
    if (c.meta.kalkanli.includes(hedefId)) return { ok: false, hata: 'Bu oyuncuya zaten kalkan verilmiş!' };
    c.meta.kalkanli.push(hedefId);
    c.meta.kalkanHak[pid] -= 1;
    return { ok: true, hedefId, hedef: c.players[hedefId].isim, kalanKalkanHak: c.meta.kalkanHak[pid] };
}

/* ---------------- Eşyalar (kalkan_roket) ---------------- */
function esyaKullan(c, playerId, esya, hedefKod, durumSoruda) {
    if (c.format !== 'kalkan_roket') return { ok: false, hata: 'Bu formatta eşya yok.' };
    const env = c.meta.esyalar[playerId] || [];
    const k = env.indexOf(esya); if (k === -1) return { ok: false, hata: 'Bu eşya sende yok.' };
    if (esya === 'ipucu') {
        if (!durumSoruda || !c.soru) return { ok: false, hata: 'İpucu yalnız soru sürerken kullanılır.' };
        if (c.meta.ipucuKullanan[playerId] !== undefined) return { ok: false, hata: 'Bu soruda ipucu kullandın.' };
        const yanlislar = c.soru.secenekler.map((_, i) => i).filter(i => i !== c.soru.dogru);
        const gizle = yanlislar[Math.floor(Math.random() * yanlislar.length)];
        env.splice(k, 1); c.meta.ipucuKullanan[playerId] = gizle;
        return { ok: true, esya, gizlenenSik: gizle };
    }
    if (durumSoruda) return { ok: false, hata: 'Bu eşya soru arasında kullanılır.' };
    if (esya === 'kalkan') return { ok: false, hata: 'Kalkan kendiliğinden çalışır; saldırı gelince seni korur.' };
    if (esya === 'cift') { env.splice(k, 1); c.meta.ciftAktif[playerId] = true; return { ok: true, esya, mesaj: 'Sıradaki soruda puanın 2 katı!' }; }
    if (esya === 'roket') {
        const hedefId = Object.keys(c.players).find(id => c.players[id].kod === hedefKod && id !== playerId);
        if (!hedefId) return { ok: false, hata: 'Hedef bulunamadı.' };
        if (c.players[hedefId].score <= c.players[playerId].score) return { ok: false, hata: 'Roket yalnız senden yukarıdakine atılabilir.' };
        env.splice(k, 1);
        const hedefEnv = c.meta.esyalar[hedefId] || []; const kalkan = hedefEnv.indexOf('kalkan');
        if (kalkan !== -1) { hedefEnv.splice(kalkan, 1); return { ok: true, esya, hedef: c.players[hedefId].isim, savuldu: true, hedefId }; }
        const calinan = Math.min(ROKET_PUAN, c.players[hedefId].score);
        c.players[hedefId].score -= calinan; c.players[playerId].score += calinan;
        return { ok: true, esya, hedef: c.players[hedefId].isim, savuldu: false, calinan, hedefId };
    }
    return { ok: false, hata: 'Bilinmeyen eşya.' };
}

/* ---------------- Görünümler ---------------- */
function publicMeta(c) {
    if (!c.meta || c.format === 'yaris') return { format: c.format };
    const isim = id => (id && c.players[id] ? c.players[id].isim : null);
    if (c.format === 'fetih') {
        const say = {}; c.meta.harita.forEach(o => { if (o) say[o] = (say[o] || 0) + 1; });
        return { format: 'fetih', boyut: FETIH_BOYUT, asama: c.meta.asama, harita: c.meta.harita.map(isim),
            korumali: c.meta.korumali.map(isim), kalkanli: c.meta.kalkanli.map(isim),
            bekleyenHak: Object.values(c.meta.haklar).reduce((a, b) => a + b, 0),
            topraklar: Object.entries(say).map(([id, n]) => ({ isim: isim(id), kare: n })).sort((a, b) => b.kare - a.kare) };
    }
    if (c.format === 'kalkan_roket') return { format: 'kalkan_roket', esyaSayilari: Object.fromEntries(Object.entries(c.meta.esyalar).map(([id, e]) => [isim(id), e.length])) };
    if (c.format === 'donen_duello') return { format: 'donen_duello', esler: Object.entries(c.meta.esler).filter(([a, b]) => b && a < b).map(([a, b]) => [isim(a), isim(b)]), kazanilan: Object.fromEntries(Object.entries(c.meta.kazanilan).map(([id, n]) => [isim(id), n])) };
    if (c.format === 'eleme_duello') {
        const golge = c.meta.elenen.map(kod => { const p = Object.values(c.players).find(x => x.kod === kod); return p ? { isim: p.isim, score: p.score } : null; }).filter(Boolean).sort((a, b) => b.score - a.score);
        return { format: 'eleme_duello', turAdi: c.meta.turAdi, sampiyon: c.meta.sampiyon,
            aktifMac: c.meta.aktifMac ? { p1: isim(c.meta.aktifMac.p1), p2: isim(c.meta.aktifMac.p2) } : null,
            bay: isim(c.meta.bay), kalanlar: _aktifOyuncular(c).map(isim), elenenSayisi: c.meta.elenen.length, golgeLigi: golge.slice(0, 5),
            maclar: c.meta.turMaclari.map(m => ({ p1: isim(m.p1), p2: isim(m.p2), kazanan: isim(m.kazanan), berabere: m.berabere })) };
    }
    return { format: c.format };
}
function oyuncuMeta(c, playerId) {
    if (!c.meta) return null;
    const p = c.players[playerId];
    if (c.format === 'fetih') return { format: 'fetih', asama: c.meta.asama, kare: c.meta.harita.filter(o => o === playerId).length,
        hak: c.meta.haklar[playerId] || 0, kalkanHak: c.meta.kalkanHak[playerId] || 0,
        korumali: c.meta.korumali.includes(playerId) || c.meta.kalkanli.includes(playerId) };
    if (c.format === 'kalkan_roket') { const yukari = Object.values(c.players).filter(x => x.score > (p || {}).score).map(x => ({ kod: x.kod, isim: x.isim }));
        return { format: 'kalkan_roket', esyalar: c.meta.esyalar[playerId] || [], hedefler: yukari, ciftAktif: !!c.meta.ciftAktif[playerId] }; }
    if (c.format === 'donen_duello') { const r = c.meta.esler[playerId]; return { format: 'donen_duello', rakip: r ? c.players[r].isim : null, kazanilan: c.meta.kazanilan[playerId] || 0 }; }
    if (c.format === 'eleme_duello') {
        const elendi = p ? c.meta.elenen.includes(p.kod) : false;
        const m = c.meta.aktifMac;
        const duellocu = m && (m.p1 === playerId || m.p2 === playerId);
        return { format: 'eleme_duello', rol: duellocu ? 'duellocu' : (elendi ? 'golge' : 'bekleyen'),
            rakip: duellocu ? c.players[m.p1 === playerId ? m.p2 : m.p1].isim : null,
            izlenen: !duellocu && m ? { p1: c.players[m.p1].isim, p2: c.players[m.p2].isim } : null,
            turAdi: c.meta.turAdi, kazanilan: c.meta.kazanilan[playerId] || 0, sampiyon: c.meta.sampiyon };
    }
    return { format: c.format };
}

module.exports = { FORMATLAR, ESYALAR, baslat, soruBaslat, soruSonrasi, esyaKullan, puanCarpani, ipucuKullandiMi,
    fetihBaslat, fetihBitir, kareSec, kalkanVer, publicMeta, oyuncuMeta };
