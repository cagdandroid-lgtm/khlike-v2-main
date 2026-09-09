/* Küçük DOM ve biçimlendirme yardımcıları (mantık içermez). */
(function (g) {
    'use strict';

    function el(id) { return document.getElementById(id); }
    function bul(s, kok) { return (kok || document).querySelector(s); }
    function hepsi(s, kok) { return Array.prototype.slice.call((kok || document).querySelectorAll(s)); }

    function yap(etiket, ozellik, cocuklar) {
        var d = document.createElement(etiket);
        ozellik = ozellik || {};
        Object.keys(ozellik).forEach(function (k) {
            if (k === 'sinif') d.className = ozellik[k];
            else if (k === 'metin') d.textContent = ozellik[k];
            else if (k === 'html') d.innerHTML = ozellik[k];
            else if (k === 'stil') d.style.cssText = ozellik[k];
            else if (k.slice(0, 2) === 'on') d.addEventListener(k.slice(2), ozellik[k]);
            else if (ozellik[k] !== null && ozellik[k] !== undefined) d.setAttribute(k, ozellik[k]);
        });
        (cocuklar || []).forEach(function (c) { if (c) d.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
        return d;
    }
    function bosalt(d) { while (d && d.firstChild) d.removeChild(d.firstChild); return d; }
    function kacir(m) { return String(m === null || m === undefined ? '' : m).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    /** Sadece verilen id'li ekranı gösterir (ekranlar .ekran sınıfında). */
    function ekranGoster(id, kok) {
        hepsi('.ekran', kok).forEach(function (e) { e.classList.toggle('acik', e.id === id); });
        return el(id);
    }

    function bashariler(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
    function sn(ms) { return Math.max(0, Math.ceil(ms / 1000)); }

    /** Sayı sayaç animasyonu (0 → hedef). */
    function sayacAnimasyon(dugum, hedef, sureMs) {
        if (FX.azHareket || hedef === 0) { dugum.textContent = bashariler(hedef); return; }
        var bas = performance.now(), s = sureMs || 700;
        (function adim(t) {
            var o = Math.min(1, (t - bas) / s), y = 1 - Math.pow(1 - o, 3);
            dugum.textContent = bashariler(Math.round(hedef * y));
            if (o < 1) requestAnimationFrame(adim);
        })(bas);
    }

    /** Kalıcı cihaz kimliği (localStorage) — protokoldeki playerId. */
    function playerId() {
        var k = localStorage.getItem('khlike_player_id');
        if (!k) {
            k = 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
            localStorage.setItem('khlike_player_id', k);
        }
        return k;
    }

    /** Sunucudan gelen {ad, icerik} paketini indirir. */
    function indir(ad, icerik, tip) {
        var b = new Blob([icerik], { type: (tip || 'text/plain') + ';charset=utf-8' });
        var u = URL.createObjectURL(b), a = document.createElement('a');
        a.href = u; a.download = ad; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 400);
    }

    g.UI = { el: el, bul: bul, hepsi: hepsi, yap: yap, bosalt: bosalt, kacir: kacir, ekranGoster: ekranGoster,
        bashariler: bashariler, sn: sn, sayacAnimasyon: sayacAnimasyon, playerId: playerId, indir: indir };
})(window);
