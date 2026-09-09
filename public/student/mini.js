/* Bekleme ekranı mini oyunları (CLAUDE.md kataloğundan TAM 3 tanesi).
   Seçilenler: 1-Balon patlatma (tema simgeleriyle) · 2-Yıldız yakalama refleksi · 6-Serbest karalama tuvali.
   Hiçbiri asıl oyunun mekaniğine (çoktan seçmeli akıl yürütme) benzemez; hepsi tamamen istemcide çalışır,
   sunucuya hiç veri göndermez ve asıl oyunun puanına ETKİ ETMEZ (yalnız kozmetik bekleme skoru). */
(function (g) {
    'use strict';

    var azHareket = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function tuval(alan) {
        var c = document.createElement('canvas');
        alan.appendChild(c);
        var ctx = c.getContext('2d');
        function boyutla() {
            var o = window.devicePixelRatio || 1;
            c.width = alan.clientWidth * o; c.height = alan.clientHeight * o;
            ctx.setTransform(o, 0, 0, o, 0, 0);
        }
        boyutla();
        return { c: c, ctx: ctx, boyutla: boyutla, en: function () { return alan.clientWidth; }, boy: function () { return alan.clientHeight; } };
    }
    function nokta(c, ev) {
        var r = c.getBoundingClientRect();
        var t = (ev.touches && ev.touches[0]) || (ev.changedTouches && ev.changedTouches[0]) || ev;
        return { x: t.clientX - r.left, y: t.clientY - r.top };
    }
    function vurgu() { return getComputedStyle(document.documentElement).getPropertyValue('--vurgu').trim() || '#6366f1'; }
    function vurgu2() { return getComputedStyle(document.documentElement).getPropertyValue('--vurgu2').trim() || '#f59e0b'; }

    /* ---------------- 1) Balon patlatma (tema simgesi patlatma) ---------------- */
    function balon(alan, ort) {
        var t = tuval(alan), balonlar = [], parcalar = [], skor = 0, raf = null, canli = true;
        var simge = ort.simgeler.length ? ort.simgeler : ['🎈'];
        ort.ad('🎈 Patlat! Dokun dokun patlasın');

        function yeni() {
            balonlar.push({
                x: 30 + Math.random() * Math.max(1, t.en() - 60), y: t.boy() + 30,
                r: 26 + Math.random() * 16, hiz: 0.5 + Math.random() * 1.1,
                salinim: Math.random() * 6.28, s: simge[Math.floor(Math.random() * simge.length)]
            });
        }
        for (var i = 0; i < 5; i++) { yeni(); balonlar[i].y = Math.random() * t.boy(); }

        function dokun(ev) {
            ev.preventDefault();
            var p = nokta(t.c, ev), vuruldu = false;
            for (var i = balonlar.length - 1; i >= 0; i--) {
                var b = balonlar[i], dx = p.x - b.x, dy = p.y - b.y;
                if (dx * dx + dy * dy < (b.r + 10) * (b.r + 10)) {
                    balonlar.splice(i, 1); skor++; ort.skor(skor); vuruldu = true;
                    for (var k = 0; k < 8; k++) parcalar.push({ x: b.x, y: b.y, vx: -3 + Math.random() * 6, vy: -3 + Math.random() * 6, om: 1 });
                    if (ort.ses) ort.ses('pop');
                    yeni();
                    break;
                }
            }
            if (!vuruldu && ort.ses) ort.ses('tik');
        }
        t.c.addEventListener('pointerdown', dokun);

        (function dongu() {
            if (!canli) return;
            var ctx = t.ctx; ctx.clearRect(0, 0, t.en(), t.boy());
            if (balonlar.length < 6 && Math.random() < 0.02) yeni();
            balonlar.forEach(function (b) {
                b.y -= b.hiz; b.salinim += 0.02;
                if (b.y < -50) { b.y = t.boy() + 30; b.x = 30 + Math.random() * Math.max(1, t.en() - 60); }
                ctx.font = (b.r * 1.7) + 'px system-ui, "Segoe UI Emoji", sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(b.s, b.x + Math.sin(b.salinim) * 16, b.y);
            });
            ctx.fillStyle = vurgu2();
            for (var i = parcalar.length - 1; i >= 0; i--) {
                var q = parcalar[i]; q.x += q.vx; q.y += q.vy; q.om -= 0.04;
                if (q.om <= 0) { parcalar.splice(i, 1); continue; }
                ctx.globalAlpha = q.om; ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, 6.29); ctx.fill();
            }
            ctx.globalAlpha = 1;
            raf = requestAnimationFrame(dongu);
        })();

        return { durdur: function () { canli = false; if (raf) cancelAnimationFrame(raf); t.c.removeEventListener('pointerdown', dokun); } };
    }

    /* ---------------- 2) Yıldız yakalama refleksi ---------------- */
    function yildiz(alan, ort) {
        var t = tuval(alan), skor = 0, raf = null, canli = true;
        var hedef = null, sure = 1400, dogdu = 0;
        ort.ad('⭐ Yakala! Yıldız kaçmadan dokun');

        function dog() {
            var r = 34;
            hedef = { x: r + Math.random() * Math.max(1, t.en() - r * 2), y: r + Math.random() * Math.max(1, t.boy() - r * 2), r: r };
            dogdu = performance.now();
        }
        dog();

        function dokun(ev) {
            ev.preventDefault();
            if (!hedef) return;
            var p = nokta(t.c, ev), dx = p.x - hedef.x, dy = p.y - hedef.y;
            if (dx * dx + dy * dy < (hedef.r + 12) * (hedef.r + 12)) {
                skor++; ort.skor(skor);
                sure = Math.max(520, sure - 45);
                if (ort.ses) ort.ses('dogru');
                dog();
            } else if (ort.ses) ort.ses('tik');
        }
        t.c.addEventListener('pointerdown', dokun);

        (function dongu(zaman) {
            if (!canli) return;
            var ctx = t.ctx; ctx.clearRect(0, 0, t.en(), t.boy());
            var gecen = performance.now() - dogdu, kalan = Math.max(0, 1 - gecen / sure);
            if (kalan <= 0) { skor = Math.max(0, skor - 1); ort.skor(skor); sure = Math.min(1600, sure + 90); dog(); }
            if (hedef) {
                var b = azHareket ? 1 : (0.85 + 0.15 * kalan);
                ctx.save(); ctx.translate(hedef.x, hedef.y); ctx.scale(b, b);
                ctx.globalAlpha = .25; ctx.fillStyle = vurgu();
                ctx.beginPath(); ctx.arc(0, 0, hedef.r + 12, 0, 6.29); ctx.fill();
                ctx.globalAlpha = 1;
                ctx.font = (hedef.r * 1.8) + 'px system-ui, "Segoe UI Emoji", sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('⭐', 0, 2);
                ctx.restore();
                // kalan süre halkası (renk + biçim birlikte)
                ctx.strokeStyle = kalan < .35 ? '#dc2626' : vurgu();
                ctx.lineWidth = 5; ctx.beginPath();
                ctx.arc(hedef.x, hedef.y, hedef.r + 18, -1.57, -1.57 + 6.283 * kalan); ctx.stroke();
            }
            raf = requestAnimationFrame(dongu);
        })();

        return { durdur: function () { canli = false; if (raf) cancelAnimationFrame(raf); t.c.removeEventListener('pointerdown', dokun); } };
    }

    /* ---------------- 6) Serbest karalama tuvali ---------------- */
    function karalama(alan, ort) {
        var t = tuval(alan), ciziyor = false, sonN = null, renk = vurgu(), adet = 0;
        ort.ad('🖍️ Karala! Canın ne isterse çiz');
        t.ctx.fillStyle = '#ffffff'; t.ctx.fillRect(0, 0, t.en(), t.boy());
        t.ctx.lineCap = 'round'; t.ctx.lineJoin = 'round'; t.ctx.lineWidth = 6;

        function bas(ev) { ev.preventDefault(); ciziyor = true; sonN = nokta(t.c, ev); }
        function hare(ev) {
            if (!ciziyor) return; ev.preventDefault();
            var p = nokta(t.c, ev);
            t.ctx.strokeStyle = renk; t.ctx.beginPath();
            t.ctx.moveTo(sonN.x, sonN.y); t.ctx.lineTo(p.x, p.y); t.ctx.stroke();
            sonN = p; adet++; if (adet % 25 === 0) ort.skor(Math.floor(adet / 25));
        }
        function birak() { ciziyor = false; sonN = null; }
        t.c.addEventListener('pointerdown', bas);
        t.c.addEventListener('pointermove', hare);
        window.addEventListener('pointerup', birak);

        var renkler = [vurgu(), vurgu2(), '#e0364f', '#127a4a', '#1668c1', '#0f172a'];
        var arac = document.createElement('div'); arac.className = 'mini-arac';
        renkler.forEach(function (r, i) {
            var b = document.createElement('button');
            b.type = 'button'; b.className = 'mini-renk' + (i === 0 ? ' secili' : '');
            b.style.background = r; b.setAttribute('aria-label', 'Renk ' + (i + 1));
            b.onclick = function () {
                renk = r;
                Array.prototype.forEach.call(arac.querySelectorAll('.mini-renk'), function (x) { x.classList.remove('secili'); });
                b.classList.add('secili');
                if (ort.ses) ort.ses('tik');
            };
            arac.appendChild(b);
        });
        var sil = document.createElement('button');
        sil.type = 'button'; sil.className = 'dug gri'; sil.textContent = '🧽 Temizle';
        sil.onclick = function () { t.ctx.fillStyle = '#ffffff'; t.ctx.fillRect(0, 0, t.en(), t.boy()); };
        arac.appendChild(sil);
        alan.parentNode.insertBefore(arac, alan.nextSibling);

        return {
            durdur: function () {
                t.c.removeEventListener('pointerdown', bas);
                t.c.removeEventListener('pointermove', hare);
                window.removeEventListener('pointerup', birak);
                if (arac.parentNode) arac.parentNode.removeChild(arac);
            }
        };
    }

    var KATALOG = [balon, yildiz, karalama];
    var sonSecim = -1, aktif = null;

    /** Bekleme başlarken çağrılır; rastgele (üst üste aynısı gelmeden) bir mini oyun kurar. */
    function baslat(alan, ort) {
        durdur(alan);
        var i;
        do { i = Math.floor(Math.random() * KATALOG.length); } while (KATALOG.length > 1 && i === sonSecim);
        sonSecim = i;
        ort.skor(0);
        aktif = KATALOG[i](alan, ort);
        return aktif;
    }
    /** Yeni tur başladığı AN çağrılır — mini oyun anında kaybolur. */
    function durdur(alan) {
        if (aktif) { try { aktif.durdur(); } catch (e) { } aktif = null; }
        if (alan) while (alan.firstChild) alan.removeChild(alan.firstChild);
        var eski = document.querySelector('.mini-arac'); if (eski && eski.parentNode) eski.parentNode.removeChild(eski);
    }

    g.Mini = { baslat: baslat, durdur: durdur, sayi: KATALOG.length };
})(window);
