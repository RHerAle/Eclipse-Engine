const Stab = require('./js/stabilise.js');

const w = 1920, h = 1080;
const src = new Float32Array(w * h);
for (let i = 0; i < src.length; i++) src[i] = Math.random();

console.time('scharr_original');
for (let i = 0; i < 10; i++) {
  Stab.scharr(src, w, h);
}
console.timeEnd('scharr_original');

console.time('blur_original');
for (let i = 0; i < 10; i++) {
  // Stab.blur is not exported, wait let me check exports
}
console.timeEnd('blur_original');
