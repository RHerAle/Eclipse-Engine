/*
 * Eclipse-Engine — © 2026 eclipseradar.com — SPDX-License-Identifier: AGPL-3.0-only
 *
 * The browser stabiliser against the same synthetic cases as the Python one,
 * because a port that agrees on prose and disagrees on numbers is worse than
 * no port. Every case here exists in tools/stab_solar.py `_selftest`, with the
 * same tolerances, so the two can be compared line by line.
 */
const Stab = require('../js/stabilise.js');

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log('FAIL ' + msg); fails++; } };
const near = (a, b, tol, msg) =>
  ok(Math.abs(a - b) < tol, `${msg}: ${a.toFixed(3)} against ${b} (tolerance ${tol})`);

// --- a minimal canvas: filled disks over a greyscale image -----------------
const img = (w, h, v) => ({ w, h, d: new Uint8Array(w * h).fill(v || 0) });
function disc(im, cx, cy, r, v) {
  for (let y = Math.max(0, Math.ceil(cy - r)); y <= Math.min(im.h - 1, cy + r); y++)
    for (let x = Math.max(0, Math.ceil(cx - r)); x <= Math.min(im.w - 1, cx + r); x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) im.d[y * im.w + x] = v;
}
function gauss(im, sigma) {
  const out = new Uint8Array(im.d.length);
  const r = Math.ceil(3 * sigma), k = [];
  let s = 0;
  for (let i = -r; i <= r; i++) { const v = Math.exp(-i * i / (2 * sigma * sigma)); k.push(v); s += v; }
  const tmp = new Float64Array(im.d.length);
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    let a = 0;
    for (let i = -r; i <= r; i++)
      a += k[i + r] * im.d[y * im.w + Math.min(im.w - 1, Math.max(0, x + i))];
    tmp[y * im.w + x] = a / s;
  }
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    let a = 0;
    for (let i = -r; i <= r; i++)
      a += k[i + r] * tmp[Math.min(im.h - 1, Math.max(0, y + i)) * im.w + x];
    out[y * im.w + x] = Math.round(a / s);
  }
  im.d = out;
  return im;
}

// ---------------------------------------------------------------------------
// 1. The synthetic occultation. The limb fit has to hold the centre the
//    centroid loses, which is the entire reason this module exists.
// ---------------------------------------------------------------------------
{
  const TX = 200, TY = 190, R = 105;
  let worstFit = 0, bestCentroid = Infinity;
  // No Moon, then three separations. With equal radii the lit crescent is d
  // wide, so the last case leaves a 15 px sliver: past that the arc is too
  // short to constrain a circle, which is exactly where the real video goes
  // black anyway.
  for (const d of [null, 90, 40, 15]) {
    const im = img(400, 400);
    disc(im, TX, TY, R, 255);
    if (d !== null) disc(im, TX + d, TY, R, 0);
    const res = Stab.fitLimb(im.d, im.w, im.h, Stab.K.THR_PHOT, R, null, [0.6 * R, 1.7 * R]);
    ok(res, `no fit at d=${d}`);
    if (!res) continue;
    const err = Math.hypot(res.cx - TX, res.cy - TY);
    ok(err < 1.0, `d=${d}: the centre drifts ${err.toFixed(2)} px`);
    near(res.r, R, 2.0, `d=${d}: radius`);
    worstFit = Math.max(worstFit, err);
    if (d !== null) {
      let n = 0, sx = 0, sy = 0;
      for (let i = 0; i < im.d.length; i++)
        if (im.d[i] >= Stab.K.THR_PHOT) { n++; sx += i % im.w; sy += (i / im.w) | 0; }
      bestCentroid = Math.min(bestCentroid, Math.hypot(sx / n - TX, sy / n - TY));
    }
  }
  // The reason this is not four lines of image moments.
  ok(bestCentroid > 20, `the centroid is only off by ${bestCentroid.toFixed(0)} px`);
  console.log(`  limb <= ${worstFit.toFixed(2)} px, centroid >= ${bestCentroid.toFixed(0)} px`);
}

// ---------------------------------------------------------------------------
// 2. The three regimes. A corona around a dark Moon has to read as regime 1,
//    and a crescent can never read that way, or the tail of the video tracks
//    the wrong thing.
// ---------------------------------------------------------------------------
{
  const R = 105;
  const tot = img(400, 400);
  disc(tot, 210, 180, R * 1.5, 120);
  disc(tot, 210, 180, R, 0);
  const r1 = Stab.locate(tot.d, tot.w, tot.h, R, null, 2);
  ok(r1 && r1.regime === 1, `totality read as regime ${r1 && r1.regime}`);
  if (r1) ok(Math.hypot(r1.cx - 210, r1.cy - 180) < 1.0, 'the centre of totality');

  const cre = img(400, 400);
  disc(cre, 200, 190, R, 255);
  disc(cre, 240, 190, R, 0);
  const r0 = Stab.locate(cre.d, cre.w, cre.h, R, null, 2);
  ok(r0 && r0.regime === 0, `crescent read as regime ${r0 && r0.regime}`);

  // Lit sky: the Moon has to beat a bloom edge of opposite polarity and
  // comparable strength, which is the case an unsigned Hough gets backwards.
  const sky = img(500, 500, 90);
  disc(sky, 330, 250, 160, 230);
  disc(sky, 200, 250, R, 20);
  gauss(sky, 3.0);
  const r2 = Stab.locate(sky.d, sky.w, sky.h, R, null, 2);
  ok(r2 && r2.regime === 2, `lit sky read as regime ${r2 && r2.regime}`);
  if (r2) ok(Math.hypot(r2.cx - 200, r2.cy - 250) < 3.0,
             `the Moon against a lit sky drifts ${Math.hypot(r2.cx - 200, r2.cy - 250).toFixed(1)} px`);
}

// ---------------------------------------------------------------------------
// 3. The crop. That it centres the Sun and that no frame runs off the source
//    is checked directly, which is cheaper than checking the arithmetic that
//    produced it.
// ---------------------------------------------------------------------------
{
  const cx = [974, 1230], cy = [689, 880];
  const f = Stab.fitWindow(cx, cy, 1920, 1080);
  near(f.w / f.h, 16 / 9, 0.02, 'window aspect ratio');
  near(f.tx, f.w / 2, 1.0, 'the Sun centred in x');
  near(f.ty, f.h / 2, 1.0, 'the Sun centred in y');
  for (let i = 0; i < cx.length; i++) {
    ok(cx[i] - f.tx >= 0 && (f.w - 1) - f.tx + cx[i] <= 1919, `frame ${i} runs off in x`);
    ok(cy[i] - f.ty >= 0 && (f.h - 1) - f.ty + cy[i] <= 1079, `frame ${i} runs off in y`);
  }
}

// ---------------------------------------------------------------------------
// 4. Outlier rejection has to survive one wild fit and a run of untracked
//    frames.
// ---------------------------------------------------------------------------
{
  const track = [];
  for (let i = 0; i < 60; i++) track.push({ cx: i * 0.5 + 100, cy: 50 });
  for (let i = 20; i < 30; i++) track[i] = null;
  track[40] = { cx: 900, cy: 50 };
  const c = Stab.clean(track);
  let peor = 0;
  for (let i = 0; i < 60; i++) {
    peor = Math.max(peor, Math.abs(c.cx[i] - (i * 0.5 + 100)), Math.abs(c.cy[i] - 50));
  }
  ok(peor < 1e-6, `the cleaning leaves ${peor.toFixed(3)} px of error`);
}

// ---------------------------------------------------------------------------
// 5. The scale is measured, not assumed: the same Sun filmed at two framings
//    has to give the same relative centre.
// ---------------------------------------------------------------------------
{
  for (const R of [40, 105, 200]) {
    const im = img(600, 600);
    disc(im, 300, 280, R, 255);
    disc(im, 300 + R * 0.6, 280, R, 0);
    const r0 = Stab.bootstrap(im.d, im.w, im.h);
    ok(r0 !== null && Math.abs(r0 - R) < 0.15 * R,
       `bootstrap at R=${R}: estimates ${r0 === null ? 'nothing' : r0.toFixed(0)}`);
    const res = Stab.locate(im.d, im.w, im.h, r0, null, 2);
    ok(res && Math.hypot(res.cx - 300, res.cy - 280) < 1.5,
       `R=${R}: the centre drifts ${res ? Math.hypot(res.cx - 300, res.cy - 280).toFixed(2) : 'nothing'} px`);
  }
}

// ---------------------------------------------------------------------------
// From here on the cases are the port's own: what it has to measure because
// the footage can be anything, where the original could hard-code its one
// camera. Each was shown to fail with its defect put back; the mutation is
// named beside it.
// ---------------------------------------------------------------------------

// A disc with limb darkening, 1 - u(1 - mu), over a dark sky.
function sun(im, cx, cy, r, peak, u) {
  for (let y = 0; y < im.h; y++)
    for (let x = 0; x < im.w; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > r) continue;
      const mu = Math.sqrt(1 - (d / r) ** 2);
      im.d[y * im.w + x] = Math.round(8 + (peak - 8) * (1 - u * (1 - mu)));
    }
}

// ---------------------------------------------------------------------------
// 6. A Sun that never clips. Filmed through a filter the disc is well exposed
//    and nowhere near white, and THR_PHOT alone found no limb at all at a
//    peak of 180, and at 230 traced the 200 isophote of the limb darkening at
//    25 px instead of the 40 px limb. Mutation: `levels` returning THR_PHOT
//    whatever the peak. Without the contrast floor, the noise frame locks.
// ---------------------------------------------------------------------------
{
  const R = 40;
  for (const [peak, u] of [[180, 0.6], [190, 0], [230, 0.6], [255, 0]]) {
    const im = img(400, 300, 8);
    sun(im, 190, 150, R, peak, u);
    const r0 = Stab.bootstrap(im.d, im.w, im.h);
    ok(r0 !== null && Math.abs(r0 - R) < 0.15 * R,
       `peak ${peak}: bootstrap estimates ${r0 === null ? 'nothing' : r0.toFixed(1)}`);
    const res = r0 === null ? null : Stab.locate(im.d, im.w, im.h, r0, null, 2);
    ok(res && Math.hypot(res.cx - 190, res.cy - 150) < 1.0,
       `peak ${peak}: the centre drifts ${res ? Math.hypot(res.cx - 190, res.cy - 150).toFixed(2) : 'nothing'} px`);
    if (res) near(res.r, R, 2.0, `peak ${peak}: radius`);
  }
  // Compressed dark sky and nothing in it: no disc, so no fit.
  const noise = img(400, 300);
  let seed = 7;
  for (let i = 0; i < noise.d.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; noise.d[i] = seed % 13; }
  const ghost = Stab.locate(noise.d, noise.w, noise.h, 20, null, 2);
  ok(ghost === null, `a frame of noise and no Sun gives a fit: ${JSON.stringify(ghost)}`);
}

// ---------------------------------------------------------------------------
// 7. The scale comes from the largest lit region. The box of every lit pixel
//    reached across the frame to any other light: one spot in the first frame
//    measured the Sun at 128 px instead of 40. Mutation: the box of all lit
//    pixels, as before.
// ---------------------------------------------------------------------------
{
  const im = img(640, 360);
  disc(im, 220, 180, 40, 255);
  disc(im, 560, 60, 8, 255);
  const r0 = Stab.bootstrap(im.d, im.w, im.h);
  ok(r0 !== null && Math.abs(r0 - 40) < 6, `a spot beside the Sun: bootstrap estimates ${r0}`);
}

// ---------------------------------------------------------------------------
// 8. The tracker believes a measured scale only once a fit has locked with it.
//    A first frame whose largest lit region is not the Sun -- a bright strip
//    of foreground here -- measured 320 px, locked nothing, and was kept: no
//    later frame could lock either. Mutation: `if (r === null) r = bootstrap`.
// ---------------------------------------------------------------------------
{
  const trk = Stab.tracker();
  let worst = 0, locked = 0;
  for (let i = 0; i < 5; i++) {
    const im = img(640, 360);
    disc(im, 220 + i, 180, 40, 255);
    if (i === 0) for (let k = 300 * 640; k < 360 * 640; k++) im.d[k] = 255;
    const res = trk(im.d, im.w, im.h, i / 25);
    if (i === 0 || !res) continue;
    locked++;
    worst = Math.max(worst, Math.hypot(res.cx - (220 + i), res.cy - 180));
  }
  ok(locked === 4 && worst < 1, `after a bad first frame ${locked} of 4 frames lock, worst ${worst.toFixed(2)} px`);
}

// ---------------------------------------------------------------------------
// 9. What counts as an outlier is a solar radius, not the original camera's
//    12 px. A knock of 30 px for four frames is real motion and the whole
//    point of stabilising; 12 px discarded every frame of it and put the
//    shake back in by interpolation. A fit 780 px off is still discarded.
//    Mutation: maxDev fixed at 12.
// ---------------------------------------------------------------------------
{
  const truth = i => 100 + 0.5 * i + (i >= 20 && i < 24 ? 30 : 0);
  const track = [];
  for (let i = 0; i < 60; i++) track.push({ cx: truth(i), cy: 50, r: 40 });
  track[40] = { cx: 900, cy: 50, r: 40 };
  const c = Stab.clean(track);
  let knock = 0, wild = Math.abs(c.cx[40] - truth(40));
  for (let i = 20; i < 24; i++) knock = Math.max(knock, Math.abs(c.cx[i] - truth(i)));
  ok(knock < 1e-6, `a 30 px knock is cleaned away by ${knock.toFixed(1)} px`);
  ok(wild < 1e-6, `a fit 780 px off survives by ${wild.toFixed(1)} px`);
}

// ---------------------------------------------------------------------------
// 10. Fewer than two fits left after the rejection is no track, and says so
//     with null. It returned a hole instead, and the page indexed it and
//     showed the visitor "Cannot read properties of null (reading '0')".
//     Mutation: pushing the interpolation without checking it.
// ---------------------------------------------------------------------------
{
  const track = [{ cx: 0, cy: 0, r: 40 }, { cx: 100, cy: 0, r: 40 }];
  for (let i = 0; i < 8; i++) track.push(null);
  ok(Stab.clean(track) === null, 'two fits that disagree by more than a radius make no track');
}

// ---------------------------------------------------------------------------
// 11. The hole search floods only the box around the bright pixels. That has
//     to give what flooding the whole frame gives, including for a dark bay
//     that reaches the box's rim on one side only. Mutation: seeding the rim
//     from its top and bottom rows alone.
// ---------------------------------------------------------------------------
{
  const full = (g, w, h, thr) => {           // the whole-frame flood, as it was
    const seen = new Uint8Array(w * h), st = [];
    const push = i => { if (!seen[i] && g[i] < thr) { seen[i] = 1; st.push(i); } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (st.length) {
      const i = st.pop(), x = i % w, y = (i / w) | 0;
      if (x > 0) push(i - 1); if (x < w - 1) push(i + 1);
      if (y > 0) push(i - w); if (y < h - 1) push(i + w);
    }
    let n = 0, sx = 0, sy = 0;
    for (let i = 0; i < g.length; i++) if (g[i] < thr && !seen[i]) { n++; sx += i % w; sy += (i / w) | 0; }
    return { n, cx: sx / Math.max(n, 1), cy: sy / Math.max(n, 1) };
  };
  const shapes = {
    ring: im => { disc(im, 150, 100, 70, 120); disc(im, 150, 100, 45, 0); },
    edge: im => { disc(im, 20, 100, 70, 120); disc(im, 20, 100, 45, 0); },
    bay: im => { disc(im, 150, 100, 70, 120); disc(im, 150, 100, 45, 0);
                 for (let y = 90; y < 110; y++) for (let x = 60; x < 150; x++) im.d[y * im.w + x] = 0; },
    crescent: im => { disc(im, 150, 100, 60, 255); disc(im, 175, 100, 60, 0); },
    none: () => {}
  };
  for (const [name, draw] of Object.entries(shapes)) {
    const im = img(300, 200); draw(im);
    const a = Stab.enclosed(im.d, im.w, im.h, 60), b = full(im.d, im.w, im.h, 60);
    ok(a.n === b.n && Math.abs(a.cx - b.cx) < 1e-9 && Math.abs(a.cy - b.cy) < 1e-9,
       `enclosed(${name}): ${JSON.stringify(a)} against the whole-frame flood ${JSON.stringify(b)}`);
  }
}

console.log(fails ? `${fails} FAILURES` : 'stabilise.js OK — matches tools/stab_solar.py');
process.exit(fails ? 1 : 0);
