'use strict';
/**
 * KHLike v2 — sunucu. Tüm oyun mantığı lib/core.js'te; burası yalnız iletişim ve zamanlayıcı.
 * Rotalar: /  öğrenci · /teacher öğretmen paneli · /screen akıllı tahta sahnesi
 */
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Cekirdek, DURUM } = require('./lib/core');
const setler = require('./lib/sets');
const ogrenciDosyasi = require('./lib/students');
const rapor = require('./lib/report');

const PORT = process.env.PORT || 3000;
const RENDERDA = !!process.env.RENDER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (RENDERDA ? null : 'uycep-local');
if (!ADMIN_PASSWORD) console.log('⛔ ADMIN_PASSWORD tanımlı değil — /teacher kilitli.');
else if (!RENDERDA) console.log(`🔑 Öğretmen paneli şifresi: ${ADMIN_PASSWORD}`);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PUB = path.join(__dirname, 'public');
app.use(express.static(PUB));
app.get('/', (_, r) => r.sendFile(path.join(PUB, 'student', 'index.html')));
app.get('/teacher', (_, r) => r.sendFile(path.join(PUB, 'teacher', 'index.html')));
app.get('/screen', (_, r) => r.sendFile(path.join(PUB, 'screen', 'index.html')));
app.get('/admin', (_, r) => r.redirect('/teacher'));   // eski rota
app.get('/player', (_, r) => r.redirect('/'));         // eski rota

// ---------------- Çekirdek ve veri ----------------
const c = new Cekirdek({ oyunAdi: 'KHLike' });
function setleriYukle() { const { setler: s, sorunlar } = setler.yukle(); c.setler = s; sorunlar.forEach(x => console.log(`⚠️ set atlandı [${x.id}]: ${x.hatalar.join(', ')}`)); }
setleriYukle();
const roster = ogrenciDosyasi.yukle(); c.ogrenciler = roster.ogrenciler;
console.log(`📚 ${Object.keys(c.setler).length} set, 👥 ${c.ogrenciler.length} öğrenci yüklendi`);

// ---------------- Yayın yardımcıları ----------------
const socketOyuncu = {};   // socket.id → playerId
const oyuncuSocket = {};   // playerId → socket.id
function yayinla() {
    io.to('admins').emit('admin_state', c.adminState());
    const ps = c.publicState();
    io.to('players').emit('public_state', ps);
    io.to('screens').emit('public_state', ps);
    girisYayinla();
}
function girisYayinla() {
    io.in('lobby').fetchSockets().then(ss => ss.forEach(s => s.emit('login_list', c.girisPaketi(s.data.girisGrubu || '')))).catch(() => {});
}
function oyuncuyaGonder(playerId, olay, veri) { const sid = oyuncuSocket[playerId]; if (sid) io.to(sid).emit(olay, veri); }

// ---------------- Zamanlayıcılar ----------------
let soruZamanlayici = null, siralamaZamanlayici = null;
function soruZamanlayiciKur() {
    clearTimeout(soruZamanlayici);
    if (c.durum !== DURUM.SORUDA || c.duraklatKalanMs !== null) return;
    soruZamanlayici = setTimeout(soruyuKapat, c.kalanMs() + 50);
}
function soruyuKapat() {
    clearTimeout(soruZamanlayici);
    const r = c.soruBitir(); if (!r.ok) return;
    Object.entries(r.kisisel).forEach(([pid, k]) => oyuncuyaGonder(pid, 'personal_result', k));
    const sahne = { dagilim: r.dagilim, dogru: r.dogru, sonSoru: r.sonSoru,
        podyum: r.podyum.map(x => ({ isim: c.players[x.playerId].isim, score: x.score })), soru: c.soru ? { soru: c.soru.soru, secenekler: c.soru.secenekler } : null };
    io.to('screens').emit('question_end', sahne);
    io.to('admins').emit('question_end', { ...sahne, aciklama: c.soru?.aciklama || '' });
    yayinla();
}
function soruyuYayinla() {
    const paket = c.soruPaketi();
    io.to('players').emit('question', paket);
    io.to('screens').emit('question', paket);
    soruZamanlayiciKur(); yayinla();
}

// ---------------- Socket ----------------
io.on('connection', (socket) => {
    // --- Sahne ---
    socket.on('register_screen', () => { socket.join('screens'); socket.emit('public_state', c.publicState()); if (c.durum === DURUM.SORUDA) socket.emit('question', c.soruPaketi()); });

    // --- Öğrenci ---
    socket.on('login_screen', (d = {}) => { socket.join('lobby'); socket.data.girisGrubu = ''; socket.emit('login_list', c.girisPaketi('')); socket.emit('public_state', c.publicState()); });
    socket.on('grup_sec', (d = {}) => { socket.data.girisGrubu = String(d.grup || '').toLowerCase(); socket.emit('login_list', c.girisPaketi(socket.data.girisGrubu)); });
    socket.on('join_game', (d = {}) => {
        const playerId = String(d.playerId || '').slice(0, 64); if (!playerId) return socket.emit('join_error', 'Oturum kimliği yok, sayfayı yenile.');
        const r = c.katil(playerId, d.kod);
        if (!r.ok) return socket.emit('join_error', r.hata);
        socket.leave('lobby'); socket.join('players');
        socketOyuncu[socket.id] = playerId; oyuncuSocket[playerId] = socket.id; socket.data.playerId = playerId;
        socket.emit('join_ok', { isim: r.oyuncu.isim, kod: r.oyuncu.kod, gecKatilim: r.gecKatilim, score: r.oyuncu.score, durum: c.durum });
        if (c.durum === DURUM.SORUDA && !c.cevaplar[playerId]) socket.emit('question', c.soruPaketi());   // geç katılan aktif soruya girer
        yayinla();
    });
    socket.on('answer', (d = {}) => {
        const pid = socket.data.playerId; if (!pid) return;
        const r = c.cevapVer(pid, d.secenek);
        socket.emit('answer_ack', r);
        if (r.ok) { io.to('admins').emit('answer_count', { cevaplayan: r.cevaplayan, toplam: r.toplam }); io.to('admins').emit('admin_state', c.adminState()); io.to('screens').emit('answer_count', { cevaplayan: r.cevaplayan, toplam: r.toplam }); if (c.herkesCevapladi()) soruyuKapat(); }
    });
    socket.on('ranking_optout', () => { const pid = socket.data.playerId; if (pid) { c.siralamaCekil(pid); io.to('admins').emit('admin_state', c.adminState()); } });

    socket.on('disconnect', () => {
        const pid = socket.data.playerId;
        if (pid) { c.ayril(pid); delete oyuncuSocket[pid]; delete socketOyuncu[socket.id]; yayinla(); }
    });

    // --- Öğretmen ---
    socket.on('admin_login', (d = {}, cb) => {
        const ok = !!ADMIN_PASSWORD && String(d.sifre || '') === ADMIN_PASSWORD;
        if (ok) { socket.data.admin = true; socket.join('admins'); socket.emit('admin_state', c.adminState()); socket.emit('sets', setler.ozet(c.setler)); socket.emit('roster', { ogrenciler: c.ogrenciler }); if (c.durum === DURUM.SORUDA) socket.emit('question', c.soruPaketi()); }
        if (typeof cb === 'function') cb({ ok, hata: ok ? null : 'Şifre yanlış.' });
    });
    const admin = (olay, fn) => socket.on(olay, (d = {}, cb) => { if (!socket.data.admin) return; const r = fn(d) || { ok: true }; if (typeof cb === 'function') cb(r); if (r && r.hata) socket.emit('alert', r.hata); });

    // Oyun akışı (tek komuta merkezi)
    admin('set_sec', d => { const r = c.setSec(d.setId); if (r.ok) yayinla(); return r; });
    admin('karma', d => { c.karma = !!d.acik; yayinla(); });
    admin('oyunu_baslat', () => { const r = c.oyunuBaslat(); if (r.ok) soruyuYayinla(); return r; });
    admin('siradaki', () => { const r = c.siradaki(); if (r.ok) soruyuYayinla(); return r; });
    admin('soru_baslat', d => {
        let sureEz = d.sureEz ? Number(d.sureEz) : null;                    // manuel süre ezme: 5-600 sn
        if (sureEz !== null && (!Number.isFinite(sureEz) || sureEz < 5 || sureEz > 600)) return { ok: false, hata: 'Süre 5-600 sn aralığında olmalı.' };
        const r = c.soruBaslat(Number(d.index), sureEz); if (r.ok) soruyuYayinla(); return r;
    });
    admin('duraklat', () => { const r = c.duraklat(); if (r.ok) { clearTimeout(soruZamanlayici); io.to('players').emit('paused', true); io.to('screens').emit('paused', true); yayinla(); } return r; });
    admin('devam', () => { const r = c.devam(); if (r.ok) { io.to('players').emit('paused', false); io.to('screens').emit('paused', false); soruZamanlayiciKur(); yayinla(); } return r; });
    admin('sure_ekle', d => { const r = c.sureEkle(Number(d.sn) || 10); if (r.ok) { io.to('players').emit('time_added', { kalanMs: r.kalanMs }); io.to('screens').emit('time_added', { kalanMs: r.kalanMs }); soruZamanlayiciKur(); yayinla(); } return r; });
    admin('soru_bitir', () => { if (c.durum !== DURUM.SORUDA) return { ok: false, hata: 'Aktif soru yok.' }; soruyuKapat(); });
    admin('anlatim_baslat', () => { const r = c.anlatimBaslat(); if (r.ok) { io.to('players').emit('anlatim', { acik: true, ...r.paket }); io.to('screens').emit('anlatim', { acik: true, ...r.paket }); yayinla(); } return r; });
    admin('anlatim_bitir', () => { c.anlatimBitir(); io.to('players').emit('anlatim', { acik: false }); io.to('screens').emit('anlatim', { acik: false }); yayinla(); });
    admin('kura_cek', (d, cb) => { const r = c.kuraCek(d.kapsam || 'dogru');
        if (r.ok) { io.to('screens').emit('kura_sonucu', { isim: r.isim, kapsam: r.kapsam }); io.to('admins').emit('kura_sonucu', { isim: r.isim, kapsam: r.kapsam, adaySayisi: r.adaySayisi }); oyuncuyaGonder(r.playerId, 'soz_sende', { kapsam: r.kapsam }); }
        return r; });
    admin('geri_al', () => { const r = c.geriAl(); if (r.ok) { io.to('players').emit('question_rolled_back', r); io.to('screens').emit('question_rolled_back', r); yayinla(); } return r; });
    admin('final', () => { const r = c.finalGoster(); if (r.ok) { const p = { podyum: r.podyum.map(x => ({ isim: c.players[x.playerId].isim, score: x.score })) }; io.to('players').emit('final', p); io.to('screens').emit('final', p); yayinla(); } return r; });
    admin('rapor', () => { const r = c.raporaGec(); if (r.ok) { socket.emit('report_reminder', 'Ders bitiminde raporu/CSV\'yi indirmeyi unutmayın (Render\'da veri kalıcı değil).'); yayinla(); } return r; });
    const etkinligiKapat = () => { const r = c.yeniEtkinlik(); clearTimeout(soruZamanlayici); clearTimeout(siralamaZamanlayici); io.to('players').emit('session_reset'); io.to('screens').emit('session_reset'); io.socketsLeave('players'); yayinla(); return r; };
    admin('etkinligi_bitir', etkinligiKapat);   // her durumda geçerli, kırmızı+onaylı
    admin('yeni_etkinlik', etkinligiKapat);     // eski ad, aynı iş

    // Oyuncu yönetimi
    const lobiyeDondur = (pid, olay) => {                       // oyuncuyu odalardan çıkar, giriş ekranına döndür
        const sid = oyuncuSocket[pid]; if (!sid) return;
        oyuncuyaGonder(pid, olay);
        const sk = io.sockets.sockets.get(sid);
        if (sk) { sk.leave('players'); sk.join('lobby'); sk.data.playerId = null; sk.emit('login_list', c.girisPaketi(sk.data.girisGrubu || '')); }
        delete oyuncuSocket[pid]; delete socketOyuncu[sid];
    };
    admin('release', d => { const idler = Object.keys(c.players).filter(pid => c.players[pid].kod === d.kod); c.serbestBirak(d.kod); idler.forEach(pid => lobiyeDondur(pid, 'released')); yayinla(); });
    admin('kick', d => { lobiyeDondur(d.playerId, 'kicked'); c.at(d.playerId); yayinla(); });
    admin('puan_duzelt', d => { const p = c.players[d.playerId]; if (!p) return { ok: false, hata: 'Oyuncu yok.' }; p.score = Math.max(0, p.score + Number(d.fark || 0)); yayinla(); });

    // Sahne kontrolleri
    admin('leaderboard_goster', d => { c.leaderboardGoster = !!d.acik; yayinla(); });
    admin('ses', d => { c.sesKapali = !!d.kapali; io.to('players').emit('sound_muted', c.sesKapali); io.to('screens').emit('sound_muted', c.sesKapali); yayinla(); });

    // Sıralama gösterimi — üç aşama
    admin('siralama_baslat', d => { const r = c.siralamaBaslat(d.sureSn); if (!r.ok) return r;
        io.to('players').emit('ranking_countdown', { sureSn: r.sureSn }); clearTimeout(siralamaZamanlayici);
        siralamaZamanlayici = setTimeout(() => { c.siralamaOnayaGec(); io.to('admins').emit('admin_state', c.adminState()); io.to('players').emit('ranking_waiting'); }, r.sureSn * 1000 + 200); yayinla(); return r; });
    admin('siralama_gonder', d => { const r = c.siralamaGonder(d.kapsam, d.isimModu); if (!r.ok) return r; Object.entries(r.paketler).forEach(([pid, p]) => oyuncuyaGonder(pid, 'ranking_result', p)); yayinla(); return r; });
    admin('siralama_kapat', () => { c.siralamaKapat(); io.to('players').emit('ranking_closed'); yayinla(); });

    // Sonuçlar
    admin('rapor_al', (d, cb) => ({ ok: true, rapor: rapor.sinifRaporu(c) }));
    admin('karne_al', d => { const p = Object.values(c.players).find(x => x.kod === d.kod); return p ? { ok: true, karne: rapor.karne(c, p) } : { ok: false, hata: 'Öğrenci yok.' }; });
    admin('tum_karneler', () => ({ ok: true, karneler: Object.values(c.players).map(p => rapor.karne(c, p)), etkinlik: c.set ? c.set.ad : '' }));
    admin('csv', d => { c.raporIndirildi = true; return { ok: true, ad: rapor.dosyaAdi(c, 'csv'), icerik: rapor.csv(c, !!d.isimli) }; });

    // Soru bankası (yalnız içerik yönetimi — oyun BAŞLATILAMAZ)
    admin('set_listesi', () => ({ ok: true, setler: setler.ozet(c.setler) }));
    admin('set_oku', d => ({ ok: !!c.setler[d.setId], set: c.setler[d.setId] || null }));
    admin('set_kaydet', d => { const r = setler.kaydet(d.setId, d.set); if (r.ok) { setleriYukle(); io.to('admins').emit('sets', setler.ozet(c.setler)); } return r; });
    admin('set_sil', d => { if (c.setId === d.setId && c.durum !== DURUM.BOSTA) return { ok: false, hata: 'Oynanan set silinemez.' }; setler.sil(d.setId); setleriYukle(); io.to('admins').emit('sets', setler.ozet(c.setler)); });

    // Öğrenci listesi
    admin('roster_al', () => ({ ok: true, ogrenciler: c.ogrenciler }));
    admin('roster_ekle', d => { const r = ogrenciDosyasi.ekle(c.ogrenciler, d); yayinla(); return r; });
    admin('roster_guncelle', d => { const r = ogrenciDosyasi.guncelle(c.ogrenciler, d.kod, d); yayinla(); return r; });
    admin('roster_misafir', d => { const o = c.misafirEkle(d.isim); yayinla(); return { ok: true, ogrenci: o }; });
    admin('roster_indir', () => ({ ok: true, ad: 'ogrenciler.json', icerik: ogrenciDosyasi.disaAktar(c.ogrenciler) }));
});

server.listen(PORT, () => console.log(`🚀 KHLike v2 hazır: http://localhost:${PORT}  (öğretmen: /teacher, sahne: /screen)`));
module.exports = { app, server, c };
