'use strict';
// Geçerli grup kodları — sunucu tarafında TEK kaynak. İ ve C grupları birleşti → "u" (U Grubu).
const GRUPLAR = ['p', 'e', 'u'];
const ESKI_GRUP = { i: 'u', c: 'u' };   // geriye dönük uyumluluk: eski dosyalardaki i/c değerleri u sayılır

/** Grup değerini küçük harfe çevirir ve eski i/c kodlarını u'ya eşler; geçersizse '' döner. */
function grupNormalize(g) {
    const k = String(g || '').trim().toLowerCase();
    const n = ESKI_GRUP[k] || k;
    return GRUPLAR.includes(n) ? n : '';
}
module.exports = { GRUPLAR, grupNormalize };
