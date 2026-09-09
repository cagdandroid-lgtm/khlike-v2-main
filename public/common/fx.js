/* Ortam animasyonu (lobi), konfeti ve ses.
   Kurallar (CLAUDE.md): giriş/lobi/bekleme ekranlarında hafif ambiyans; SORU ekranında arka plan
   animasyonu YOK; prefers-reduced-motion'a saygı; ses varsayılan AÇIK ama kısık, tek dokunuşla kapanır. */
(function (g) {
    'use strict';

    var azHareket = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------------- Ortam animasyonu: süzülen tema simgeleri ---------------- */
    function Ambiyans(canvas) {
        var ctx = canvas.getContext('2d'), parcalar = [], raf = null, acik = false, yogunluk = 18;

        function boyutla() {
            var o = window.devicePixelRatio || 1;
            canvas.width = canvas.clientWidth * o; canvas.height = canvas.clientHeight * o;
            ctx.setTransform(o, 0, 0, o, 0, 0);
        }
        function kur(simgeler) {
            boyutla();
            var w = canvas.clientWidth, h = canvas.clientHeight;
            parcalar = [];
            for (var i = 0; i < yogunluk; i++) {
                parcalar.push({
                    x: Math.random() * w, y: Math.random() * h,
                    hiz: 0.15 + Math.random() * 0.35, salinim: 0.4 + Math.random() * 0.8,
                    faz: Math.random() * Math.PI * 2, boy: 18 + Math.random() * 26,
                    saydam: 0.18 + Math.random() * 0.3,
                    simge: simgeler[Math.floor(Math.random() * simgeler.length)]
                });
            }
        }
        function cizim() {
            var w = canvas.clientWidth, h = canvas.clientHeight;
            ctx.clearRect(0, 0, w, h);
            for (var i = 0; i < parcalar.length; i++) {
                var p = parcalar[i];
                p.y -= p.hiz; p.faz += 0.01;
                if (p.y < -50) { p.y = h + 40; p.x = Math.random() * w; }
                ctx.globalAlpha = p.saydam;
                ctx.font = p.boy + 'px system-ui, "Segoe UI Emoji", sans-serif';
                ctx.fillText(p.simge, p.x + Math.sin(p.faz) * 22 * p.salinim, p.y);
            }
            ctx.globalAlpha = 1;
            raf = requestAnimationFrame(cizim);
        }
        return {
            baslat: function (simgeler) {
                if (acik) return; acik = true;
                canvas.style.display = 'block';
                kur(simgeler && simgeler.length ? simgeler : ['✨']);
                if (azHareket) { cizimTek(); return; }
                raf = requestAnimationFrame(cizim);
            },
            durdur: function () {
                acik = false; canvas.style.display = 'none';
                if (raf) cancelAnimationFrame(raf); raf = null;
                ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
            },
            yenile: function (simgeler) { if (acik) kur(simgeler); }
        };
        function cizimTek() {   // azaltılmış hareket: tek kare, hareketsiz dekor
            ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
            parcalar.forEach(function (p) {
                ctx.globalAlpha = p.saydam;
                ctx.font = p.boy + 'px system-ui, "Segoe UI Emoji", sans-serif';
                ctx.fillText(p.simge, p.x, p.y);
            });
            ctx.globalAlpha = 1;
        }
    }

    /* ---------------- Konfeti ---------------- */
    var RENKLER = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#14b8a6'];
    function konfeti(sure, yogun) {
        if (azHareket) return;
        var cv = document.getElementById('konfeti-katman');
        if (!cv) {
            cv = document.createElement('canvas'); cv.id = 'konfeti-katman';
            cv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:900';
            document.body.appendChild(cv);
        }
        var ctx = cv.getContext('2d'), o = window.devicePixelRatio || 1;
        cv.width = innerWidth * o; cv.height = innerHeight * o; ctx.setTransform(o, 0, 0, o, 0, 0);
        var n = yogun || 90, p = [], bitis = Date.now() + (sure || 2200);
        for (var i = 0; i < n; i++) p.push({
            x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.5,
            vx: -1.4 + Math.random() * 2.8, vy: 2 + Math.random() * 3.4,
            en: 6 + Math.random() * 7, boy: 9 + Math.random() * 10,
            renk: RENKLER[i % RENKLER.length], aci: Math.random() * 6.28, don: -0.14 + Math.random() * 0.28
        });
        (function dongu() {
            ctx.clearRect(0, 0, innerWidth, innerHeight);
            p.forEach(function (k) {
                k.x += k.vx; k.y += k.vy; k.aci += k.don;
                ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(k.aci);
                ctx.fillStyle = k.renk; ctx.fillRect(-k.en / 2, -k.boy / 2, k.en, k.boy); ctx.restore();
            });
            if (Date.now() < bitis) requestAnimationFrame(dongu);
            else ctx.clearRect(0, 0, innerWidth, innerHeight);
        })();
    }

    /* ---------------- Ses ----------------
       Kısa geri bildirimler Web Audio ile üretilir (dosya beklemez, gecikmesizdir);
       müzik döngüleri public/sounds altındaki mp3'lerdir. */
    function SesMotoru(secenek) {
        secenek = secenek || {};
        var anahtar = secenek.anahtar || 'khlike_ses';
        var seviye = secenek.seviye === undefined ? 0.35 : secenek.seviye;
        var kullaniciKapali = localStorage.getItem(anahtar) === 'kapali';
        var sunucuKapali = false;
        var ac = null, muzikler = {}, aktifMuzik = null, kilitAcildi = false;

        function ctx() {
            if (!ac) { var C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); }
            if (ac && ac.state === 'suspended') ac.resume();
            return ac;
        }
        function kapali() { return kullaniciKapali || sunucuKapali; }

        function ton(frekanslar, sureSn, tip, hacim) {
            if (kapali()) return;
            var a = ctx(); if (!a) return;
            frekanslar.forEach(function (f, i) {
                var os = a.createOscillator(), gk = a.createGain();
                os.type = tip || 'sine'; os.frequency.value = f;
                var t = a.currentTime + i * (sureSn * 0.7);
                gk.gain.setValueAtTime(0.0001, t);
                gk.gain.exponentialRampToValueAtTime((hacim || 0.16) * seviye * 2.2, t + 0.012);
                gk.gain.exponentialRampToValueAtTime(0.0001, t + sureSn);
                os.connect(gk); gk.connect(a.destination);
                os.start(t); os.stop(t + sureSn + 0.02);
            });
        }

        var etkiler = {
            pop: function () { ton([520, 780], 0.09, 'sine', 0.2); },
            tik: function () { ton([880], 0.05, 'triangle', 0.1); },
            kilit: function () { ton([660, 990], 0.1, 'triangle', 0.16); },
            dogru: function () { ton([660, 880, 1320], 0.16, 'sine', 0.2); },
            yanlis: function () { ton([330, 247], 0.2, 'sine', 0.14); },
            baslat: function () { ton([392, 523, 659, 784], 0.14, 'sine', 0.18); },
            gerisayim: function () { ton([700], 0.08, 'square', 0.08); },
            zafer: function () { ton([523, 659, 784, 1047], 0.22, 'sine', 0.2); }
        };

        function muzikNesne(ad) {
            if (!muzikler[ad]) {
                var a = new Audio('/sounds/' + ad + '.mp3');
                a.loop = true; a.volume = 0; a.preload = 'none';
                muzikler[ad] = a;
            }
            return muzikler[ad];
        }

        return {
            /** İlk kullanıcı dokunuşunda çağır (tarayıcı otomatik oynatma kilidi). */
            kilidiAc: function () {
                if (kilitAcildi) return; kilitAcildi = true;
                var a = ctx(); if (a && a.state === 'suspended') a.resume();
            },
            cal: function (ad) { var f = etkiler[ad]; if (f) f(); },
            muzik: function (ad, hacim) {
                if (aktifMuzik === ad) { this.hacimTazele(); return; }
                this.muzikDur();
                aktifMuzik = ad;
                if (kapali()) return;
                var a = muzikNesne(ad);
                a.volume = (hacim === undefined ? 0.22 : hacim) * (seviye / 0.35);
                a.currentTime = 0;
                var s = a.play(); if (s && s.catch) s.catch(function () { });
            },
            muzikDur: function () {
                if (aktifMuzik && muzikler[aktifMuzik]) { try { muzikler[aktifMuzik].pause(); } catch (e) { } }
                aktifMuzik = null;
            },
            hacimTazele: function () {
                if (!aktifMuzik) return;
                var a = muzikler[aktifMuzik]; if (!a) return;
                if (kapali()) { try { a.pause(); } catch (e) { } }
                else { var s = a.play(); if (s && s.catch) s.catch(function () { }); }
            },
            kapaliMi: kapali,
            kullaniciKapali: function () { return kullaniciKapali; },
            degistir: function () {
                kullaniciKapali = !kullaniciKapali;
                localStorage.setItem(anahtar, kullaniciKapali ? 'kapali' : 'acik');
                this.hacimTazele();
                if (!kullaniciKapali) etkiler.pop();
                return kullaniciKapali;
            },
            sunucuKapat: function (k) { sunucuKapali = !!k; this.hacimTazele(); }
        };
    }

    g.FX = { Ambiyans: Ambiyans, konfeti: konfeti, SesMotoru: SesMotoru, azHareket: azHareket };
})(window);
