/*
 * Eclipse-Engine — © 2026 eclipseradar.com — SPDX-License-Identifier: AGPL-3.0-only
 *
 * The terrain module where it meets the network, which is where it failed:
 * the skyline arithmetic is plain, and the answer "0 m, in view" under a
 * ridge 923 m up came from a tile that never arrived being read as sea level,
 * kept in the cache, and read that way again for the rest of the visit. There
 * is no browser here, so the image loader and the clock are stand-ins: every
 * tile answers only when the test says so, and thirty seconds pass when the
 * test fires the timer.
 *
 * Each check was run against the defect it exists for: a failed tile resolved
 * to null again (check 1 fails), the cache left holding the failure (check 2),
 * the tile timer and the Overpass timer removed (checks 3 and 4).
 */
'use strict';
let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log('FAIL ' + msg); fails++; } };

// Terrarium packs metres as R*256 + G + B/256 - 32768: 923 m is (131, 155, 0).
const PX = new Uint8ClampedArray(256 * 256 * 4);
for (let i = 0; i < PX.length; i += 4) { PX[i] = 131; PX[i + 1] = 155; PX[i + 3] = 255; }
const asked = [];                                   // every image asked for
global.Image = class { set src(u) { if (u) { this.url = u; asked.push(this); } } };
global.document = { createElement: () => ({
  getContext: () => ({ drawImage() {}, getImageData: () => ({ data: PX }) }) }) };
let seq = 0;
const timers = new Map();
global.setTimeout = (f, ms) => { timers.set(++seq, { f, ms }); return seq; };
global.clearTimeout = id => timers.delete(id);
const since = n => [...timers].filter(([id]) => id > n).map(([, v]) => v);
// What a promise has done once everything already queued has run.
const settled = async p => {
  let s = 'pending';
  p.then(() => { s = 'resolved'; }, e => { s = 'rejected: ' + e.message; });
  for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r));
  return s;
};

const Terrain = require('../js/terrain.js');
const BULNES = [43.238, -4.818], ARC = { azFrom: 260, azTo: 300 };

(async () => {
  // 1. One tile of the block fails and the others arrive: the query fails.
  let n = asked.length;
  const q1 = Terrain.horizon(...BULNES, ARC);
  const block = asked.slice(n);
  ok(block.length >= 4, `the query asks for a block of tiles (${block.length})`);
  block.forEach((img, i) => (i ? img.onload() : img.onerror()));
  const s1 = await settled(q1);
  ok(s1.startsWith('rejected'), 'a tile that fails fails the query, instead of reading as sea level: ' + s1);

  // 2. And the failure is not kept. Asked again, the failed tile is fetched
  //    again, and only that one: the tiles that arrived are still in hand.
  n = asked.length;
  const q2 = Terrain.horizon(...BULNES, ARC);
  const again = asked.slice(n);
  ok(again.length === 1 && again[0].url === block[0].url,
     `only the failed tile is asked for again (${again.map(i => i.url).join(' ') || 'none'})`);
  again.forEach(img => img.onload());
  const s2 = await settled(q2);
  ok(s2 === 'resolved', 'with that tile back the query answers: ' + s2);
  if (s2 === 'resolved') {
    const hz = await q2;
    ok(Math.abs(hz.elevM - 923) < 0.5, `and the ground is the model's, not sea level (${hz.elevM} m)`);
  }

  // 3. A tile that never answers ends the query when its time is up, and the
  //    time is the stated one. Somewhere else, so nothing is cached.
  n = asked.length;
  const t3 = seq;
  const q3 = Terrain.horizon(27.99, 86.93, {});
  const out = asked.slice(n);
  out.slice(1).forEach(img => img.onload());          // all but one arrive
  const waits = since(t3);
  ok(waits.length === 1 && waits[0].ms <= 30000,
     `the one tile still out is on a clock of 30 s or less (${waits.map(w => w.ms)})`);
  waits.forEach(w => w.f());
  ok((await settled(q3)).startsWith('rejected'), 'a tile that never answers fails the query when its time is up');

  // 4. Overpass, the same: a query nobody answers is given up on.
  global.fetch = (url, o) => new Promise((res, rej) => {
    if (o && o.signal) o.signal.addEventListener('abort', () => rej(new Error('aborted')));
  });
  const t4 = seq;
  const q4 = Terrain.buildings(...BULNES, 400);
  const w4 = since(t4);
  ok(w4.length === 1 && w4[0].ms <= 30000, `the Overpass query is on a clock of 30 s or less (${w4.map(w => w.ms)})`);
  w4.forEach(w => w.f());
  ok((await settled(q4)).startsWith('rejected'), 'an Overpass query that never answers fails when its time is up');

  console.log(fails ? `terrain.test.js: ${fails} FAILURES`
    : 'terrain.js OK: a tile that fails or never answers fails the query, and is asked for again');
  process.exit(fails ? 1 : 0);
})();
