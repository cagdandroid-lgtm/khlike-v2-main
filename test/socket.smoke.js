'use strict';
process.env.ADMIN_PASSWORD = 'test123'; process.env.PORT = '3456';
const { server } = require('../server');
const { io } = require('socket.io-client');
const U = 'http://localhost:3456';
const bekle = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await bekle(300);
  const admin = io(U), ogr1 = io(U), ogr2 = io(U), sahne = io(U);
  const sonuc = {};
  ogr1.on('login_list', l => sonuc.liste = l); ogr1.on('question', q => sonuc.soru = q); ogr1.on('personal_result', r => sonuc.kisisel = r);
  ogr2.on('question', q => sonuc.soru2 = q); sahne.on('question_end', e => sonuc.sahneBitis = e);
  sahne.emit('register_screen');
  const login = await new Promise(r => admin.emit('admin_login', { sifre: 'test123' }, r)); console.log('admin giriş:', login.ok);
  ogr1.emit('login_screen'); await bekle(100); console.log('set seçilmeden liste beklemede:', sonuc.liste.beklemede);
  await new Promise(r => admin.emit('set_sec', { setId: 'tanilama_seti_e' }, r)); await bekle(150);
  console.log('set seçilince isim kartları:', sonuc.liste.ogrenciler.map(o => o.isim).join(','), '| etkinlik:', sonuc.liste.etkinlik.ad);
  ogr1.emit('join_game', { playerId: 'cihaz-1', kod: 'E-01' }); await bekle(100);
  await new Promise(r => admin.emit('oyunu_baslat', {}, r)); await bekle(150);
  console.log('soru geldi:', !!sonuc.soru, '| doğru cevap sızdı mı:', 'dogru' in sonuc.soru, '| kalanMs:', sonuc.soru.kalanMs);
  // GEÇ KATILIM: oyun sürerken ikinci öğrenci giriyor
  ogr2.emit('login_screen'); await bekle(80); ogr2.emit('join_game', { playerId: 'cihaz-2', kod: 'E-02' }); await bekle(150);
  console.log('geç katılan aktif soruyu aldı:', !!sonuc.soru2);
  ogr1.emit('answer', { secenek: 1 }); ogr2.emit('answer', { secenek: 1 }); await bekle(300);   // herkes cevapladı → otomatik kapanış
  console.log('kişisel sonuç geldi:', !!sonuc.kisisel, '| sahne bitiş dağılımı:', sonuc.sahneBitis && sonuc.sahneBitis.dagilim);
  const csv = await new Promise(r => admin.emit('csv', { isimli: false }, r)); console.log('csv satır:', csv.icerik.split('\n').length, '| başlık:', csv.icerik.split('\n')[0].slice(1, 60));
  [admin, ogr1, ogr2, sahne].forEach(s => s.close()); server.close(); process.exit(0);
})().catch(e => { console.error('❌', e); process.exit(1); });
