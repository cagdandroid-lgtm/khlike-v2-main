/* Set temasını CSS değişkenlerine yazar. Tema YALNIZ görünümü değiştirir (CLAUDE.md).
   Öğrenci/sahne ekranlarında kullanılır; zorluk ya da pedagojik bilgi taşımaz. */
(function (g) {
    'use strict';

    var VARSAYILAN = {
        zemin: '#eef2ff', zemin2: '#e0e7ff', vurgu: '#6366f1', vurgu2: '#f59e0b',
        metin: '#1e1b4b', kart: '#ffffff', kartMetin: '#1e1b4b'
    };
    var VARSAYILAN_SIMGE = ['✨', '⭐', '🔷', '🟡', '🔶', '💫'];

    // Şık renkleri: renk + ikon + harf birlikte verilir (yalnız renkle ayrım yapılmaz).
    var SIKLAR = [
        { renk: '#e0364f', koyu: '#a8172d', ikon: '▲', harf: 'A' },
        { renk: '#1668c1', koyu: '#0d4a8b', ikon: '◆', harf: 'B' },
        { renk: '#d38b00', koyu: '#9a6200', ikon: '●', harf: 'C' },
        { renk: '#127a4a', koyu: '#0a5232', ikon: '■', harf: 'D' },
        { renk: '#7c3aed', koyu: '#5b21b6', ikon: '★', harf: 'E' },
        { renk: '#0e7490', koyu: '#0a5567', ikon: '⬟', harf: 'F' }
    ];

    var son = null;

    /** tema = set.tema nesnesi (veya null). */
    function uygula(tema) {
        var p = (tema && tema.palet) || VARSAYILAN;
        var k = document.documentElement.style;
        var al = function (ad) { return p[ad] || VARSAYILAN[ad]; };
        k.setProperty('--zemin', al('zemin'));
        k.setProperty('--zemin2', al('zemin2'));
        k.setProperty('--vurgu', al('vurgu'));
        k.setProperty('--vurgu2', al('vurgu2'));
        k.setProperty('--metin', al('metin'));
        k.setProperty('--kart', al('kart'));
        k.setProperty('--kart-metin', al('kartMetin'));
        son = tema || null;
        return simgeler();
    }

    function simgeler() {
        return (son && son.simgeler && son.simgeler.length) ? son.simgeler : VARSAYILAN_SIMGE;
    }
    function slogan() { return (son && son.slogan) || ''; }
    function dunya() { return (son && son.dunya) || ''; }
    function sik(i) { return SIKLAR[i % SIKLAR.length]; }

    g.Tema = { uygula: uygula, simgeler: simgeler, slogan: slogan, dunya: dunya, sik: sik, SIKLAR: SIKLAR };
})(window);
