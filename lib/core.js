'use strict';
/**
 * KHLike v2 ÇEKİRDEK — oyun durum makinesi.
 * Socket bilmez, dosya bilmez; yalnız saf mantık. server.js bunu sarar.
 *
 * DURUMLAR:  BOSTA → LOBI → SORUDA ⇄ SORU_ARASI → FINAL → RAPOR → (yeni etkinlik) BOSTA
 */

const DURUM = Object.freeze({
    BOSTA: 'BOSTA', LOBI: 'LOBI', SORUDA: 'SORUDA',
    SORU_ARASI: 'SORU_ARASI', FINAL: 'FINAL', RAPOR: 'RAPOR'
});

// Geri bildirim söz havuzları (asla alaycı değil)
const SOZLER = {
    dogru_hizli: ['Şimşek gibi! ⚡', 'Hem hızlı hem doğru!', 'Müthiş refleks!', 'Işık hızında!', 'Bu kadar hızlı beklemiyordum!', 'Şampiyon hızı!', 'Anında çözdün!', 'Roket gibi! 🚀'],
    dogru: ['Doğru! 🎯', 'Tam isabet!', 'Harika düşündün!', 'Aynen öyle!', 'Bravo!', 'Çözdün!', 'Süper!', 'Doğru yoldasın!'],
    yanlis: ['Bu sefer olmadı, sıradakine!', 'Yaklaştın, devam!', 'Hata öğretir, ilerle!', 'Bir sonraki senin!', 'Denemek büyük iş!', 'Sıradaki soruda görüşürüz!', 'Pes yok!', 'Toparlıyorsun!'],
    seri: ['Seri devam ediyor 🔥', 'Durdurulamıyorsun!', 'Ateş gibisin!', 'Seri büyüyor!', 'Alev alev! 🔥', 'Zincir kırılmıyor!', 'Kızgın demir!', 'Seri ustası!'],
    zaman_doldu: ['Süre bitti, sıradakine!', 'Zaman kaçtı, olur böyle.', 'Bir sonrakinde daha hızlı!', 'Süre doldu, devam!', 'Zaman geldi geçti!', 'Sıradaki soruda hazır ol!', 'Bu tur geçti!', 'Devam ediyoruz!']
};
const sec = (h) => h[Math.floor(Math.random() * h.length)];

function yeniOyuncu(kod, isim, grup, misafir) {
    return { kod, isim, grup, misafir: !!misafir, connected: true, score: 0, seri: 0,
        dogruSayisi: 0, cevapSayisi: 0, gecKatilim: false, cevaplar: {} };
}

class Cekirdek {
    constructor({ oyunAdi = 'KHLike', now = () => Date.now() } = {}) {
        this.oyunAdi = oyunAdi;
        this.now = now;
        this.ogrenciler = [];         // roster: {kod,isim,grup,aktif,misafir?}
        this.setler = {};             // id → set
        this.sifirla();
    }

    // ---------------- Oturum yaşam döngüsü ----------------
    sifirla() {
        this.durum = DURUM.BOSTA;
        this.set = null; this.setId = null;
        this.aktifGrup = '';
        this.karma = false;
        this.players = {};            // playerId → oyuncu
        this.soruIndex = -1;          // aktif/son oynanan soru
        this.soru = null;             // aktif soru nesnesi
        this.soruBaslangicMs = 0; this.sureMs = 0; this.duraklatKalanMs = null;
        this.cevaplar = {};           // aktif soru: playerId → {secenek, ms}
        this.snapshot = null;         // geri alma için
        this.log = [];                // 12 sütun + mod
        this.leaderboardGoster = true;
        this.sesKapali = false;
        this.siralama = { asama: 'yok' };
        this.raporIndirildi = false;
        this.anlatimAcik = false; this.soruKatilimcilari = new Set();
    }

    yeniEtkinlik() {                  // RAPOR/FINAL/her durum → BOSTA (roster kalır)
        const uyari = this.log.length && !this.raporIndirildi ? 'Rapor indirilmedi; oturum verisi silinecek.' : null;
        this.sifirla();
        return { ok: true, uyari };
    }

    setSec(setId) {
        const set = this.setler[setId];
        if (!set) return { ok: false, hata: 'Set bulunamadı.' };
        if (this.durum !== DURUM.BOSTA && this.durum !== DURUM.LOBI) return { ok: false, hata: 'Oyun sürerken set değiştirilemez: önce "Etkinliği Bitir".' };
        this.set = set; this.setId = setId;
        this.aktifGrup = (set.grup || '').toLowerCase();   // grup kilidi setten otomatik
        this.durum = DURUM.LOBI;
        return { ok: true };
    }

    /** Her durumda geçerli: etkinliği kapatır, BOSTA'ya döner (roster kalır). Set değiştirmenin TEK yolu budur. */
    etkinligiBitir() {
        if (this.durum === DURUM.BOSTA) return { ok: false, hata: 'Açık etkinlik yok.' };
        return this.yeniEtkinlik();
    }

    // ---------------- Giriş ----------------
    /** Öğrencinin gördüğü giriş paketi. */
    girisPaketi(secilenGrup) {
        if (this.durum === DURUM.BOSTA) return { beklemede: true, etkinlik: null, ogrenciler: [], gruplar: [] };
        const hedef = this.karma ? (secilenGrup || '') : this.aktifGrup;
        const tutulan = {};
        Object.values(this.players).forEach(p => { if (p.connected) tutulan[p.kod] = true; });
        const liste = hedef ? this.ogrenciler
            .filter(o => o.aktif !== false && (o.grup || '').toLowerCase() === hedef)
            .map(o => ({ kod: o.kod, isim: o.isim, dolu: !!tutulan[o.kod] })) : [];
        return {
            beklemede: false,
            karma: this.karma,
            grupSecimiGerekli: this.karma && !hedef,
            gruplar: this.karma ? ['p', 'e', 'i', 'c'] : [],
            grup: hedef,
            etkinlik: { ad: this.set.tema?.ad || this.set.ad, tema: this.set.tema || null },
            oyunSuruyor: this.durum !== DURUM.LOBI,
            ogrenciler: liste
        };
    }

    /** Oyuna katılma; LOBI'den RAPOR'a kadar her durumda serbest (geç katılım). */
    katil(playerId, kod) {
        if (this.durum === DURUM.BOSTA) return { ok: false, hata: 'Öğretmen henüz etkinliği açmadı.' };
        kod = String(kod || '').trim().toUpperCase();
        const o = this.ogrenciler.find(x => x.kod === kod);
        if (!o || o.aktif === false) return { ok: false, hata: 'Bu isim listede değil.' };
        if (!this.karma && (o.grup || '').toLowerCase() !== this.aktifGrup && !o.misafir)
            return { ok: false, hata: 'Bu etkinlik senin grubun için değil.' };

        // Aynı isim başka bir bağlı cihazda mı?
        const sahipId = Object.keys(this.players).find(id => this.players[id].kod === kod && id !== playerId);
        if (sahipId) {
            if (this.players[sahipId].connected) return { ok: false, hata: `${o.isim} şu an başka bir cihazda. Öğretmenin serbest bırakabilir.` };
            this.players[playerId] = this.players[sahipId];   // kopmuş cihazdan devralma
            delete this.players[sahipId];
        }
        let p = this.players[playerId];
        // Aynı cihaz FARKLI isim seçti: kimlik değişimi (yanlış isim düzeltme akışı)
        if (p && p.kod !== kod) {
            const cevapVerdi = p.cevapSayisi > 0 || p.score > 0 || !!this.cevaplar[playerId];
            if (this.durum !== DURUM.LOBI && cevapVerdi)
                return { ok: false, hata: 'Bu cihaz oyunda başka bir isimle oynadı. İsim değişimi için öğretmenin seni oyundan çıkarması gerekir.' };
            delete this.players[playerId]; p = null;                   // temiz sayfa
        }
        const yeni = !p;
        if (yeni) {
            p = this.players[playerId] = yeniOyuncu(kod, o.isim, (o.grup || '').toLowerCase(), o.misafir);
            if (this.durum !== DURUM.LOBI) p.gecKatilim = true;       // geç katılım işareti
        }
        p.connected = true;
        return { ok: true, yeni, oyuncu: p, gecKatilim: p.gecKatilim };
    }

    ayril(playerId) { const p = this.players[playerId]; if (p) p.connected = false; }
    serbestBirak(kod) { Object.keys(this.players).forEach(id => { if (this.players[id].kod === kod) this.players[id].connected = false; }); }
    at(playerId) { delete this.players[playerId]; }

    // ---------------- Soru akışı ----------------
    get toplamSoru() { return this.set ? this.set.sorular.length : 0; }

    oyunuBaslat() { return this.soruBaslat(0); }
    siradaki() { this.anlatimAcik = false; return this.soruBaslat(this.soruIndex + 1); }

    soruBaslat(i, sureEz) {
        if (!this.set) return { ok: false, hata: 'Set seçilmedi.' };
        if (this.durum === DURUM.SORUDA) return { ok: false, hata: 'Bir soru zaten sürüyor.' };
        if (i < 0 || i >= this.toplamSoru) return { ok: false, hata: 'Soru yok. Finali gösterin.' };
        const s = this.set.sorular[i];
        this.snapshot = this._anlikGoruntu();
        this.soruIndex = i; this.soru = s;
        this.cevaplar = {};
        this.sureMs = 1000 * (sureEz || s.sure_sn || this.set.varsayilan_sure_sn || 30);
        this.soruBaslangicMs = this.now();
        this.soruKatilimcilari = new Set(Object.keys(this.players).filter(id => { const p = this.players[id]; return p.connected && (this.karma || p.grup === this.aktifGrup || p.misafir); }));
        this.anlatimAcik = false;
        this.duraklatKalanMs = null;
        this.durum = DURUM.SORUDA;
        return { ok: true, soru: this.soruPaketi() };
    }

    /** Öğrenciye giden soru: doğru cevap, zorluk, açıklama, kategori GİTMEZ. */
    soruPaketi() {
        if (!this.soru) return null;
        return { index: this.soruIndex, no: this.soruIndex + 1, toplam: this.toplamSoru,
            soru: this.soru.soru, secenekler: this.soru.secenekler,
            gorsel_svg: this.soru.gorsel_svg || null, kalanMs: this.kalanMs() };
    }

    kalanMs() {
        if (this.durum !== DURUM.SORUDA) return 0;
        if (this.duraklatKalanMs !== null) return this.duraklatKalanMs;
        return Math.max(0, this.sureMs - (this.now() - this.soruBaslangicMs));
    }
    duraklat() { if (this.durum !== DURUM.SORUDA || this.duraklatKalanMs !== null) return { ok: false }; this.duraklatKalanMs = this.kalanMs(); return { ok: true }; }
    devam() { if (this.duraklatKalanMs === null) return { ok: false }; this.sureMs = this.duraklatKalanMs; this.soruBaslangicMs = this.now(); this.duraklatKalanMs = null; return { ok: true, kalanMs: this.kalanMs() }; }
    sureEkle(sn) { if (this.durum !== DURUM.SORUDA) return { ok: false }; if (this.duraklatKalanMs !== null) this.duraklatKalanMs += sn * 1000; else this.sureMs += sn * 1000; return { ok: true, kalanMs: this.kalanMs() }; }

    cevapVer(playerId, secenek) {
        const p = this.players[playerId];
        if (!p) return { ok: false, hata: 'Oyuncu yok.' };
        if (this.durum !== DURUM.SORUDA || this.duraklatKalanMs !== null) return { ok: false, hata: 'Şu an cevap alınmıyor.' };
        if (this.cevaplar[playerId]) return { ok: false, hata: 'Zaten cevapladın.' };
        if (this.kalanMs() <= 0) return { ok: false, hata: 'Süre doldu.' };
        this.cevaplar[playerId] = { secenek: Number(secenek), ms: this.now() - this.soruBaslangicMs };
        return { ok: true, cevaplayan: Object.keys(this.cevaplar).length, toplam: this._bagliSayisi() };
    }

    /** Otomatik kapanış: soru başındaki katılımcılar ∪ şu an bağlılar CEVAPLAMADAN soru kapanmaz.
     *  (Telefonu kilitlenip kopan çocuk sayıyı düşürmez → soru erken bitmez; süre karar verir.) */
    herkesCevapladi() {
        const gerekli = new Set(this.soruKatilimcilari || []);
        Object.entries(this.players).forEach(([id, p]) => { if (p.connected && (this.karma || p.grup === this.aktifGrup || p.misafir)) gerekli.add(id); });
        return gerekli.size > 0 && [...gerekli].every(id => this.cevaplar[id]);
    }

    /** Soruyu kapatır, puanlar, kişisel sonuçları ve olay kayıtlarını üretir. */
    soruBitir() {
        if (this.durum !== DURUM.SORUDA) return { ok: false, hata: 'Aktif soru yok.' };
        const s = this.soru, toplamMs = this.sureMs;
        const oncekiSira = this._siralama().map(x => x.playerId);
        const sonuclar = {}; let enHizli = null;
        Object.entries(this.players).forEach(([id, p]) => {
            const c = this.cevaplar[id];
            const cevaplandi = !!c, dogru = cevaplandi && c.secenek === s.dogru;
            let puan = 0;
            if (dogru) {
                puan = 500 + Math.round(500 * Math.max(0, 1 - c.ms / toplamMs));   // hız bonusu
                p.seri += 1;
                puan += Math.min(p.seri - 1, 5) * 50;                                   // seri çarpanı 🔥
                p.dogruSayisi += 1;
                if (!enHizli || c.ms < enHizli.ms) enHizli = { id, ms: c.ms };
            } else p.seri = 0;
            if (cevaplandi) p.cevapSayisi += 1;
            p.score += puan;
            p.cevaplar[s.no] = { secenek: cevaplandi ? c.secenek : null, dogru, sure_sn: cevaplandi ? +(c.ms / 1000).toFixed(2) : null, puan };
            p.sonCevap = { soruNo: s.no, secenek: cevaplandi ? c.secenek : null, dogru, cevaplandi };
            sonuclar[id] = { dogru, cevaplandi, puan };
            this.log.push({ zaman: new Date(this.now()).toISOString(), oyun: this.oyunAdi, set_veya_paket: this.set.ad,
                grup: this.aktifGrup, ogrenci_kod: p.kod, gorev_id: `${this.setId}#${s.no}`, kategori: s.kategori || '',
                chc: s.chc || '', zorluk: s.zorluk ?? '', sonuc: cevaplandi ? (dogru ? 'dogru' : 'yanlis') : 'atlandi',
                sure_sn: cevaplandi ? +(c.ms / 1000).toFixed(2) : '', deneme: 1, ipucu_kullanildi: 0, mod: 'yarismaci',
                misafir: p.misafir ? 1 : 0, gec_katilim: p.gecKatilim ? 1 : 0 });
        });
        this.durum = DURUM.SORU_ARASI;
        const sira = this._siralama();
        const kisisel = {};
        sira.forEach((x, idx) => {
            const p = this.players[x.playerId], r = sonuclar[x.playerId];
            const onceki = oncekiSira.indexOf(x.playerId), yukseldi = onceki !== -1 && idx < onceki;
            const rozetler = [];
            if (enHizli && enHizli.id === x.playerId) rozetler.push('🚀');
            if (p.seri >= 3) rozetler.push('🔥');
            if (yukseldi) rozetler.push('📈');
            if (p.cevapSayisi > 0 && p.dogruSayisi === p.cevapSayisi && p.dogruSayisi >= 3) rozetler.push('🎯');
            const soz = !r.cevaplandi ? sec(SOZLER.zaman_doldu) : !r.dogru ? sec(SOZLER.yanlis)
                : p.seri >= 3 ? sec(SOZLER.seri) : (this.cevaplar[x.playerId].ms < toplamMs * 0.3 ? sec(SOZLER.dogru_hizli) : sec(SOZLER.dogru));
            const onde = idx > 0 ? sira[idx - 1].score - x.score : 0;
            kisisel[x.playerId] = { dogru: r.dogru, cevaplandi: r.cevaplandi, puan: r.puan, toplam: x.score, sira: idx + 1,
                ilkBes: idx < 5, ondekiFark: onde, seri: p.seri, rozetler, soz, dogruCevap: s.dogru, aciklama: s.aciklama || '' };
        });
        return { ok: true, kisisel, dagilim: this._sikDagilimi(), dogru: s.dogru, podyum: sira.slice(0, 5), sonSoru: this.soruIndex >= this.toplamSoru - 1 };
    }

    /** Son oynanan soruyu geri alır (puanlar ve kayıtlar iptal). */
    geriAl() {
        if (this.durum !== DURUM.SORU_ARASI || !this.snapshot) return { ok: false, hata: 'Geri alınacak soru yok.' };
        const s = this.soru;
        this._anlikGoruntuGeriYukle(this.snapshot);
        this.log = this.log.filter(k => k.gorev_id !== `${this.setId}#${s.no}`);
        this.snapshot = null; this.cevaplar = {}; this.anlatimAcik = false;
        this.soruIndex -= 1; this.soru = this.soruIndex >= 0 ? this.set.sorular[this.soruIndex] : null;
        this.durum = this.soruIndex < 0 ? DURUM.LOBI : DURUM.SORU_ARASI;
        return { ok: true, iptalEdilen: s.no };
    }

    /** Soru çözüm/anlatım modu: bitmiş soruyu doğru cevabıyla tüm ekranlara geri gönderir. */
    anlatimBaslat() {
        if (this.durum !== DURUM.SORU_ARASI || !this.soru) return { ok: false, hata: 'Anlatım yalnız soru arasında açılır.' };
        this.anlatimAcik = true;
        const s = this.soru;
        return { ok: true, paket: { no: this.soruIndex + 1, toplam: this.toplamSoru, soru: s.soru, secenekler: s.secenekler,
            gorsel_svg: s.gorsel_svg || null, dogru: s.dogru, aciklama: s.aciklama || '', dagilim: this._sikDagilimi() } };
    }
    anlatimBitir() { this.anlatimAcik = false; return { ok: true }; }

    /** 3) Söz hakkı kurası: son sorunun sonucuna göre rastgele öğrenci seçer. */
    kuraCek(kapsam = 'dogru') {
        const adaylar = Object.entries(this.players).filter(([id, p]) => {
            if (!p.connected) return false;
            const sc = p.sonCevap && this.soru && p.sonCevap.soruNo === this.soru.no ? p.sonCevap : null;
            if (kapsam === 'dogru') return !!(sc && sc.dogru);
            if (kapsam === 'yanlis') return !!(sc && sc.cevaplandi && !sc.dogru);
            return true;                                                  // herkes
        });
        if (!adaylar.length) return { ok: false, hata: kapsam === 'dogru' ? 'Bu soruyu doğru cevaplayan yok.' : 'Uygun aday yok.' };
        const [pid, p] = adaylar[Math.floor(Math.random() * adaylar.length)];
        return { ok: true, playerId: pid, isim: p.isim, kod: p.kod, kapsam, adaySayisi: adaylar.length };
    }

    finalGoster() {
        if (![DURUM.SORU_ARASI, DURUM.LOBI].includes(this.durum)) return { ok: false, hata: 'Önce soruyu bitirin.' };
        this.durum = DURUM.FINAL;
        return { ok: true, podyum: this._siralama().slice(0, 3), tamListe: this._siralama() };
    }
    raporaGec() { if (this.durum !== DURUM.FINAL) return { ok: false }; this.durum = DURUM.RAPOR; return { ok: true }; }

    // ---------------- Sıralama gösterimi (üç aşamalı, onaylı) ----------------
    siralamaBaslat(sureSn) {
        if (![DURUM.SORU_ARASI, DURUM.FINAL, DURUM.RAPOR].includes(this.durum)) return { ok: false, hata: 'Sıralama yalnız soru arasında/finalde gösterilir.' };
        this.siralama = { asama: 'geri_sayim', sureSn: Number(sureSn) || 10, cekilenler: new Set(), baslangic: this.now() };
        return { ok: true, sureSn: this.siralama.sureSn };
    }
    siralamaCekil(playerId) { if (this.siralama.asama === 'geri_sayim') { this.siralama.cekilenler.add(playerId); return { ok: true }; } return { ok: false }; }
    siralamaOnayaGec() { if (this.siralama.asama !== 'geri_sayim') return { ok: false }; this.siralama.asama = 'onay'; return { ok: true, cekilen: this.siralama.cekilenler.size, toplam: this._bagliSayisi() }; }
    siralamaGonder(kapsam = 'bireysel', isimModu = 'acik') {
        if (this.siralama.asama !== 'onay') return { ok: false, hata: 'Önce geri sayım bitmeli.' };
        const sira = this._siralama(), cek = this.siralama.cekilenler;
        const liste = sira.map((x, i) => ({ sira: i + 1, score: x.score, playerId: x.playerId,
            isim: cek.has(x.playerId) ? '🎭' : (isimModu === 'gizli' ? `Oyuncu ${i + 1}` : this.players[x.playerId].isim) }));
        const paketler = {};
        sira.forEach((x, i) => {
            if (cek.has(x.playerId)) { paketler[x.playerId] = { gizli: true }; return; }
            paketler[x.playerId] = kapsam === 'tam'
                ? { gizli: false, kapsam, sira: i + 1, toplam: sira.length, liste: liste.map(l => ({ sira: l.sira, isim: l.playerId === x.playerId ? this.players[x.playerId].isim : l.isim, score: l.score, sen: l.playerId === x.playerId })) }
                : { gizli: false, kapsam, sira: i + 1, toplam: sira.length, score: x.score };
        });
        this.siralama.asama = 'yayinda';
        return { ok: true, paketler };
    }
    siralamaKapat() { this.siralama = { asama: 'yok' }; return { ok: true }; }

    // ---------------- Roster ----------------
    misafirEkle(isim) {
        const n = this.ogrenciler.filter(o => o.misafir).length + 1;
        const kod = `M-${String(n).padStart(2, '0')}`;
        const o = { kod, isim: String(isim || 'Misafir').trim().slice(0, 40), grup: this.aktifGrup || 'e', aktif: true, misafir: true };
        this.ogrenciler.push(o);
        return o;
    }

    // ---------------- Görünümler ----------------
    /** Öğrenci ve sahneye giden, ayıklanmış durum. */
    publicState() {
        return { durum: this.durum, etkinlik: this.set ? { ad: this.set.tema?.ad || this.set.ad, tema: this.set.tema || null } : null,
            grup: this.aktifGrup, soruNo: this.soruIndex + 1, toplamSoru: this.toplamSoru, kalanMs: this.kalanMs(),
            duraklatildi: this.duraklatKalanMs !== null, oyuncuSayisi: this._bagliSayisi(), anlatimAcik: !!this.anlatimAcik,
            leaderboardGoster: this.leaderboardGoster, sesKapali: this.sesKapali,
            lobi: Object.values(this.players).filter(p => p.connected).map(p => ({ isim: p.isim, kod: p.kod })),
            podyum: this.leaderboardGoster ? this._siralama().slice(0, 5).map(x => ({ isim: this.players[x.playerId].isim, score: x.score })) : [] };
    }
    /** Öğretmen paneline giden tam durum. */
    adminState() {
        return { ...this.publicState(), setId: this.setId, karma: this.karma, soru: this.soru ? { ...this.soru, index: this.soruIndex } : null,
            cevaplayan: Object.keys(this.cevaplar).length, siralama: { asama: this.siralama.asama, cekilen: this.siralama.cekilenler ? this.siralama.cekilenler.size : 0 },
            oyuncular: Object.entries(this.players).map(([id, p]) => ({ playerId: id, kod: p.kod, isim: p.isim, grup: p.grup, connected: p.connected,
                score: p.score, seri: p.seri, misafir: p.misafir, gecKatilim: p.gecKatilim, farkliGrup: !this.karma && p.grup !== this.aktifGrup && !p.misafir,
                cevapladi: !!this.cevaplar[id],
                aktifSecenek: this.durum === DURUM.SORUDA && this.cevaplar[id] ? this.cevaplar[id].secenek : null,
                sonSecenek: p.sonCevap && this.soru && p.sonCevap.soruNo === this.soru.no ? p.sonCevap.secenek : null,
                sonDogru: p.sonCevap && this.soru && p.sonCevap.soruNo === this.soru.no ? p.sonCevap.dogru : null })),
            logSayisi: this.log.length, raporIndirildi: this.raporIndirildi };
    }

    // ---------------- Yardımcılar ----------------
    _bagliSayisi() { return Object.values(this.players).filter(p => p.connected && (this.karma || p.grup === this.aktifGrup || p.misafir)).length; }
    _siralama() { return Object.entries(this.players).map(([playerId, p]) => ({ playerId, score: p.score })).sort((a, b) => b.score - a.score); }
    _sikDagilimi() { const d = (this.soru.secenekler || []).map(() => 0); Object.values(this.cevaplar).forEach(c => { if (d[c.secenek] !== undefined) d[c.secenek]++; }); return d; }
    _anlikGoruntu() { return JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(this.players).map(([id, p]) => [id, { score: p.score, seri: p.seri, dogruSayisi: p.dogruSayisi, cevapSayisi: p.cevapSayisi, cevaplar: p.cevaplar }])))); }
    _anlikGoruntuGeriYukle(g) { Object.entries(g).forEach(([id, v]) => { if (this.players[id]) Object.assign(this.players[id], v); }); }
}

module.exports = { Cekirdek, DURUM, SOZLER };
