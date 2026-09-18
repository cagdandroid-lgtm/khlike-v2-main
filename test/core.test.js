'use strict';
// Çekirdek senaryo testi: set seç → katıl → soru → cevap → geç katılım → geri al → sıralama → final → csv
const assert = require('assert');
const { Cekirdek, DURUM } = require('../lib/core');
const rapor = require('../lib/report');
const setler = require('../lib/sets');
const ogr = require('../lib/students');

let t = 1000; const c = new Cekirdek({ now: () => t });
c.setler = setler.yukle().setler; c.ogrenciler = ogr.yukle().ogrenciler;
assert.ok(c.setler['tanilama_seti_e'], 'E seti yüklenmeli');
const E = c.ogrenciler.filter(o => o.grup === 'e' && o.aktif !== false).slice(0, 3).map(o => o.kod);
const ilkI = c.ogrenciler.find(o => o.grup === 'u' && o.aktif !== false).kod;   // U = eski İ + C
assert.ok(E.length === 3 && ilkI, 'listede en az 3 E ve 1 U öğrencisi olmalı');

// BOSTA: giriş beklemede, katılım reddedilir
assert.strictEqual(c.girisPaketi('').beklemede, true);
assert.strictEqual(c.katil('p1', E[0]).ok, false);

// LOBI
assert.ok(c.setSec('tanilama_seti_e').ok); assert.strictEqual(c.durum, DURUM.LOBI); assert.strictEqual(c.aktifGrup, 'e');
const g = c.girisPaketi(''); assert.ok(g.ogrenciler.length > 0 && g.ogrenciler.every(o => (c.ogrenciler.find(x => x.kod === o.kod) || {}).grup === 'e'), 'yalnız E grubu listelenir');
assert.ok(c.katil('p1', E[0]).ok); assert.ok(c.katil('p2', E[1]).ok);
assert.strictEqual(c.katil('p9', ilkI).ok, false, 'farklı grup giremez');
assert.strictEqual(c.katil('pX', E[0]).ok, false, 'dolu isim ikinci cihazda seçilemez');
assert.strictEqual(c.publicState().oyuncuSayisi, 2);

// SORUDA
assert.ok(c.oyunuBaslat().ok); assert.strictEqual(c.durum, DURUM.SORUDA);
const paket = c.soruPaketi(); assert.strictEqual(paket.dogru, undefined); assert.strictEqual(paket.zorluk, undefined, 'zorluk gizli');
t += 2000; assert.ok(c.cevapVer('p1', c.soru.dogru).ok);          // hızlı doğru
t += 10000; assert.ok(c.cevapVer('p2', (c.soru.dogru + 1) % 4).ok); // yanlış
assert.strictEqual(c.cevapVer('p1', 0).ok, false, 'çift cevap yok');
// geç katılım aktif soruda
const gk = c.katil('p3', E[2]); assert.ok(gk.ok && gk.gecKatilim, 'geç katılım işaretlenir');
assert.ok(c.herkesCevapladi() === false);
const r1 = c.soruBitir(); assert.ok(r1.ok); assert.strictEqual(c.durum, DURUM.SORU_ARASI);
assert.ok(r1.kisisel['p1'].dogru && r1.kisisel['p1'].puan > 900, 'hızlı doğru yüksek puan');
assert.ok(!r1.kisisel['p2'].dogru && r1.kisisel['p2'].puan === 0);
assert.strictEqual(r1.kisisel['p3'].cevaplandi, false);
assert.strictEqual(c.log.length, 3, 'her oyuncuya bir kayıt');
assert.deepStrictEqual(Object.keys(c.log[0]).slice(0, 13), ['zaman','oyun','set_veya_paket','grup','ogrenci_kod','gorev_id','kategori','chc','zorluk','sonuc','sure_sn','deneme','ipucu_kullanildi'], '12 sütun standardı');

// geri al
const skorOnce = c.players['p1'].score; assert.ok(c.geriAl().ok); assert.strictEqual(c.players['p1'].score, 0); assert.strictEqual(c.log.length, 0); assert.strictEqual(c.durum, DURUM.LOBI);
assert.ok(skorOnce > 0);

// tekrar oyna 2 soru, duraklat/devam
assert.ok(c.oyunuBaslat().ok); t += 1000; c.cevapVer('p1', c.soru.dogru); c.cevapVer('p2', c.soru.dogru); c.cevapVer('p3', c.soru.dogru);
assert.ok(c.herkesCevapladi()); c.soruBitir();
assert.ok(c.siradaki().ok); assert.ok(c.duraklat().ok); const k = c.kalanMs(); t += 5000; assert.strictEqual(c.kalanMs(), k, 'duraklatınca süre akmaz');
assert.strictEqual(c.cevapVer('p1', 0).ok, false, 'duraklatmada cevap yok'); assert.ok(c.devam().ok); assert.ok(c.sureEkle(10).ok);
t += 3000; c.cevapVer('p1', c.soru.dogru); c.soruBitir();
assert.strictEqual(c.players['p1'].seri, 2);

// sıralama gösterimi
assert.ok(c.siralamaBaslat(5).ok); assert.ok(c.siralamaCekil('p2').ok); assert.ok(c.siralamaOnayaGec().ok);
const sg = c.siralamaGonder('tam', 'gizli'); assert.ok(sg.ok); assert.ok(sg.paketler['p2'].gizli); assert.ok(sg.paketler['p1'].liste.some(x => x.isim === '🎭'), 'çekilen maskeli');
assert.ok(sg.paketler['p1'].liste.find(x => x.sen).isim === c.players['p1'].isim, 'kendi adını görür');
c.siralamaKapat();

// final, rapor, csv
assert.ok(c.finalGoster().ok); assert.ok(c.raporaGec().ok);
const csvI = rapor.csv(c, true), csvK = rapor.csv(c, false);
assert.ok(csvI.split('\n')[0].startsWith('\uFEFFogrenci_isim;zaman;oyun'), 'isimli başlık'); assert.ok(!csvK.includes(c.players['p1'].isim), 'kodlu CSV isim içermez');
const rp = rapor.sinifRaporu(c); assert.strictEqual(rp.ogrenciler.length, 3); assert.ok(rp.ogrenciler[0].kategoriler.length > 0);
// 1. hafta düzeltmeleri: erken kapanış, cevap görünümü, anlatım, kura
{ const w = new Cekirdek({ now: () => t }); w.setler = c.setler; w.ogrenciler = c.ogrenciler; w.setSec('tanilama_seti_e');
  ['w1','w2','w3'].forEach((id, i) => w.katil(id, E[i])); w.oyunuBaslat();
  t += 1000; w.cevapVer('w1', w.soru.dogru); w.cevapVer('w2', (w.soru.dogru + 1) % 4);
  w.ayril('w3');                                                       // telefonu kilitlendi
  assert.strictEqual(w.herkesCevapladi(), false, 'kopan öğrenci soruyu erken bitirtmez');
  w.cevapVer('w3', 0) /* kopukken cevap gelmez ama kural: */; 
  const r = w.soruBitir();
  const admin = w.adminState().oyuncular;
  const a1 = admin.find(o => o.playerId === 'w1'), a2 = admin.find(o => o.playerId === 'w2');
  assert.ok(a1.sonDogru === true && a1.sonSecenek !== null, 'panel doğru işaretini görür');
  assert.ok(a2.sonDogru === false, 'panel yanlışı görür');
  const an = w.anlatimBaslat(); assert.ok(an.ok && an.paket.dogru === w.soru.dogru && Array.isArray(an.paket.dagilim), 'anlatım paketi doğru cevapla gider');
  assert.ok(w.publicState().anlatimAcik, 'anlatım public_state\'te görünür');
  const k1 = w.kuraCek('dogru'); assert.ok(k1.ok && k1.isim === w.players['w1'].isim, 'kura doğrulardan w1\'i seçer (tek aday)');
  const k2 = w.kuraCek('yanlis'); assert.ok(k2.ok && k2.isim === w.players['w2'].isim, 'kura yanlışlardan seçer');
  assert.ok(w.siradaki().ok); assert.strictEqual(w.publicState().anlatimAcik, false, 'yeni soru anlatımı kapatır'); }
// kimlik değişimi: yanlış isim düzeltme akışı
const c3 = new Cekirdek({ now: () => t }); c3.setler = c.setler; c3.ogrenciler = c.ogrenciler;
c3.setSec('tanilama_seti_e');
assert.ok(c3.katil('cihaz1', E[0]).ok);
const dg = c3.katil('cihaz1', E[1]);
assert.ok(dg.ok && dg.oyuncu.kod === E[1], 'lobide isim değiştirilebilir');
assert.ok(!Object.values(c3.players).some(p => p.kod === E[0]), 'eski kayıt silinir');
c3.oyunuBaslat(); t += 1000; c3.cevapVer('cihaz1', c3.soru.dogru);
assert.strictEqual(c3.katil('cihaz1', E[2]).ok, false, 'cevap verilmiş oyunda isim değişimi reddedilir');
c3.at('cihaz1');
assert.ok(c3.katil('cihaz1', E[2]).ok, 'öğretmen çıkardıktan sonra yeni isim seçilebilir');
// etkinliği bitir: oyun ortasında set değişimi tek yol üzerinden
const c2 = new Cekirdek({ now: () => t }); c2.setler = c.setler; c2.ogrenciler = c.ogrenciler;
c2.setSec('tanilama_seti_i'); c2.katil('q1', ilkI); c2.oyunuBaslat();
assert.strictEqual(c2.setSec('tanilama_seti_e').ok, false, 'oyun sürerken set değişmez');
assert.ok(c2.etkinligiBitir().ok); assert.strictEqual(c2.durum, DURUM.BOSTA);
assert.ok(c2.setSec('tanilama_seti_e').ok); assert.strictEqual(c2.aktifGrup, 'e', 'grup = setin grubu');
assert.strictEqual(c2.katil('q1', ilkI).ok, false, 'U öğrencisi E etkinliğine giremez');
// İ + C → U birleşmesi: eski i/c değerleri u kabul edilir
const { grupNormalize } = require('../lib/gruplar'); const setDosyasi = require('../lib/sets');
assert.strictEqual(grupNormalize('i'), 'u'); assert.strictEqual(grupNormalize('C'), 'u'); assert.strictEqual(grupNormalize('x'), '');
assert.deepStrictEqual(setDosyasi.dogrula({ ad: 'eski', grup: 'c', sorular: [{ soru: 's', secenekler: ['a', 'b'], dogru: 0 }] }), [], 'eski c grubu set geçerli');
const c4 = new Cekirdek({ now: () => t }); c4.setler = c.setler; c4.ogrenciler = c.ogrenciler.concat([{ kod: 'C-99', isim: 'Eski C', grup: 'c', aktif: true }]);
assert.ok(c4.setSec('tanilama_seti_c').ok); assert.strictEqual(c4.aktifGrup, 'u', 'eski c seti U oturumu açar');
assert.ok(c4.girisPaketi('').ogrenciler.some(o => o.kod === 'C-99'), 'eski c öğrencisi U kartlarında görünür');
c4.karma = true; assert.deepStrictEqual(c4.girisPaketi('').gruplar, ['p', 'e', 'u'], 'karma grup listesi p/e/u');
assert.ok(c4.girisPaketi('i').ogrenciler.length > 0 && c4.girisPaketi('i').grup === 'u', 'karma: eski i seçimi u sayılır');
// misafir + yeni etkinlik
const rosterOnce = c.ogrenciler.length; const m = c.misafirEkle('Deniz'); assert.ok(/^M-\d\d$/.test(m.kod));
const ye = c.yeniEtkinlik(); assert.strictEqual(c.durum, DURUM.BOSTA); assert.strictEqual(Object.keys(c.players).length, 0); assert.strictEqual(c.ogrenciler.length, rosterOnce + 1, 'roster kalır');
console.log('✅ Tüm çekirdek senaryoları geçti (giriş, geç katılım, puanlama, geri alma, duraklatma, sıralama, rapor, csv, misafir).');
