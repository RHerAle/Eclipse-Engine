// Eclipse-Engine — © 2026 eclipseradar.com — SPDX-License-Identifier: AGPL-3.0-only
//
// The JavaScript geometry has to agree with src/eclipsecat.py, which in turn is
// checked against DE440s and against NASA. Run: node tests/besselian.test.js
//
// Written after an adversarial review found that the previous version left 17
// mutations alive, so most of what follows exists to kill a specific one. Where
// a check reads oddly, that is why: it is aimed at a bug, not at a number.
'use strict';
const fs = require('fs'), path = require('path');
const Bess = require('../js/besselian.js');
const ROOT = path.join(__dirname, '..');
const CAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/eclipses.json')));
const CIRC = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/reference/circumstances.json')));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.error('FAIL ' + msg); fails++; } return !!cond; };
const close = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol,
  `${msg}: ${a} vs ${b} (tol ${tol})`);
const of = id => CAT.eclipses.find(e => e.id === id);
const D2R = Math.PI / 180;
const km = (a, b) => Math.hypot((a[0] - b[0]) * 111.19,
  (a[1] - b[1]) * 111.19 * Math.cos((a[0] + b[0]) / 2 * D2R));
const move = (p, d, brg) => [p[0] + d * Math.cos(brg) / 111.19,
  p[1] + d * Math.sin(brg) / (111.19 * Math.cos(p[0] * D2R))];

const E26 = of('2026-08-12'), B = E26.elements;

// ---------------------------------------------------------------------------
// 1. Local circumstances at the study site, against the project's own DE440s
//    solver. The end-to-end check: elements, observer transform, contact
//    root-finder and obscuration together, independent of NASA.
// ---------------------------------------------------------------------------
const S = CIRC.site;
const loc = Bess.local(B, S.lat_deg, S.lon_deg, S.elev_m);
ok(loc !== null, 'el emplazamiento del estudio ve el eclipse de 2026');
for (const c of ['C1', 'C2', 'C3', 'C4', 'MAX']) {
  const want = (CIRC.contacts[c].tt_jd - B.t0_TT_jd) * 24;
  close(loc[c].t * 3600, want * 3600, 1.5, `${c} (s desde t0)`);
}
close(loc.duration_s, (CIRC.contacts.C3.tt_jd - CIRC.contacts.C2.tt_jd) * 86400, 1.0, 'duration');
close(loc.magnitude, CIRC.contacts.MAX.magnitude, 2e-3, 'magnitud');
close(loc.obscuration, 1.0, 1e-9, 'obscuration');
close(loc.MAX.alt, CIRC.contacts.MAX.sun_alt_geometric_deg, 0.02, 'solar altitude at maximum');
close(loc.MAX.az, CIRC.contacts.MAX.sun_az_deg, 0.05, 'solar azimuth at maximum');
ok(Math.abs(loc.C2.utc - new Date(CIRC.contacts.C2.utc)) < 1500,
   `C2 UTC ${loc.C2.utc.toISOString()} vs ${CIRC.contacts.C2.utc}`);

// The observer transform must actually use the ellipsoid and the elevation.
// Both survived mutation before: sea level and 616 m differ by ~0.3 s of
// totality, and swapping the equatorial radius for the polar one by ~1 s.
ok(Math.abs(Bess.local(B, S.lat_deg, S.lon_deg, 0).duration_s - loc.duration_s) > 0.05,
   'the observer elevation has to change the duration');

// ---------------------------------------------------------------------------
// 2. Contacts are named by how the curve crosses zero, not by root order.
//    2038-07-02 at 13 S 75 W has C1 at t = -3.26 h; a window that stops at 3.2
//    used to label the surviving root (C4) as C1, and the point 3 degrees west
//    was then reported as seeing no eclipse at all.
// ---------------------------------------------------------------------------
const E38 = of('2038-07-02').elements;
const p38 = Bess.local(E38, -13, -75, 0);
ok(p38 && p38.C1 && p38.C4, '2038-07-02 en 13 S 75 O debe tener C1 y C4');
ok(p38.C1.t < p38.MAX.t && p38.MAX.t < p38.C4.t,
   `orden de contactos roto: C1 ${p38.C1.t} MAX ${p38.MAX.t} C4 ${p38.C4.t}`);
const q38 = Bess.local(E38, -13, -78, 0);
ok(q38 && q38.visible_obscuration > 0.35,
   `13 S 78 O debe ver ~40 % y ve ${q38 && (q38.visible_obscuration * 100).toFixed(1)} %`);

// A contact named by root order rather than by crossing direction only shows up
// where the two disagree, so the invariant is swept instead of spot-checked:
// across the catalogue and a coarse global grid, a first contact must never be
// stamped after maximum, nor a last one before it.
{
  let bad = 0, seen = 0;
  for (const e of CAT.eclipses) {
    for (let la = -80; la <= 80; la += 20) {
      for (let lo = -180; lo < 180; lo += 40) {
        const r = Bess.local(e.elements, la, lo, 0);
        if (!r) continue;
        seen++;
        if ((r.C1 && r.C1.t > r.MAX.t) || (r.C4 && r.C4.t < r.MAX.t)
            || (r.C2 && r.C2.t > r.MAX.t) || (r.C3 && r.C3.t < r.MAX.t)) bad++;
      }
    }
  }
  ok(seen > 500, `el barrido solo encontro ${seen} puntos con eclipse`);
  ok(bad === 0, `${bad} de ${seen} puntos con contactos fuera de orden`);
}

// ---------------------------------------------------------------------------
// 3. Annularity. The inner contact is |m| = |L2'|; written as m + L2' = 0 it
//    has no root when L2' is positive, so every annular eclipse reported zero
//    seconds of annularity while still reporting the right magnitude. Nothing
//    caught it, because the whole suite only ever exercised a total eclipse.
//    Durations below are the published central ones.
// ---------------------------------------------------------------------------
for (const [id, la, lo, want] of [['2027-02-06', -31.30, -48.48, 471],
                                  ['2028-01-26', 2.96, -51.58, 627],
                                  ['2031-05-21', 8.93, 71.71, 326]]) {
  const r = Bess.local(of(id).elements, la, lo, 0);
  ok(r && r.central === 'annular', `${id} debe leerse como anular, no ${r && r.central}`);
  ok(r && r.duration_s > 0, `${id}: zero-length annularity`);
  close(r.duration_s, want, 12, `${id} annularity duration`);
}
ok(loc.central === 'total', 'el eclipse de 2026 en el sitio es total, no anular');

// ---------------------------------------------------------------------------
// 4. A point outside the penumbra returns nothing rather than a small number.
// ---------------------------------------------------------------------------
ok(Bess.local(B, -33.87, 151.21, 0) === null, 'Sydney sees nothing of the 2026 eclipse');

// ---------------------------------------------------------------------------
// 5. The drawn band must agree with the solver that answers the clicks. This
//    is the invariant, not a distance: on the edge the duration is zero, three
//    kilometres inside it is not, three kilometres outside it is zero again.
//    Ignoring the observer's own rotational velocity in the offset drew the
//    band up to 5 km too narrow on each side and broke exactly this.
// ---------------------------------------------------------------------------
for (const id of ['2026-08-12', '2027-08-02', '2045-08-12', '2027-02-06']) {
  const el = of(id).elements;
  for (const [k, arr] of Bess.limits(el, 'l2').edges.entries()) {
    const pts = arr.filter(Boolean);
    ok(pts.length > 50, `${id} borde ${k}: solo ${pts.length} puntos`);
    const p = pts[Math.floor(pts.length / 2)];
    const here = Bess.local(el, p[0], p[1], 0);
    ok(!here || here.duration_s < 1.0,
       `${id} borde ${k}: ${here && here.duration_s.toFixed(1)} s de fase central SOBRE el borde`);
    let inside = 0, outside = 1;
    for (let j = 0; j < 36; j++) {
      const brg = j * 10 * D2R;
      const a = Bess.local(el, ...move(p, -3, brg), 0);
      const b = Bess.local(el, ...move(p, 3, brg), 0);
      if (a && a.duration_s > 0 && (!b || b.duration_s === 0)) {
        inside = a.duration_s; outside = b ? b.duration_s : 0;
      }
    }
    ok(inside > 5 && outside === 0,
       `${id} borde ${k}: 3 km dentro ${inside.toFixed(1)} s, 3 km fuera ${outside.toFixed(1)} s`);
  }
}

// The site sits inside the band, and the manuscript measures 41,9 km to the
// northern limit perpendicular to the path. The nearest sampled point of an
// edge is never closer than that, and with 6 s sampling not much further.
const nearest = Bess.limits(B, 'l2').edges
  .flat().filter(Boolean).reduce((b, p) => Math.min(b, km([S.lat_deg, S.lon_deg], p)), 1e9);
ok(nearest >= 41.0 && nearest <= 47.0,
   `distance from the site to the nearest edge: ${nearest.toFixed(2)} km, expected 42-47`);

// ---------------------------------------------------------------------------
// 6. Non-central eclipses. Between gamma 0.9972 and about 1.03 the axis misses
//    the Earth while the cone still clips the limb. Typing those by the axis
//    alone called them partial, so the map drew no band while a click inside
//    it reported totality: a map contradicting its own answer.
// ---------------------------------------------------------------------------
const E43 = of('2043-04-09');
ok(E43.type === 'total', `2043-04-09 es total no central, catalogado ${E43.type}`);
ok(E43.central === false, '2043-04-09 no tiene eje sobre la Tierra');
const nc = Bess.local(E43.elements, 61.82, 164.78, 0);
ok(nc && nc.obscuration > 0.999 && nc.duration_s > 0,
   `2043-04-09 en 61.82 N 164.78 E: obsc ${nc && nc.obscuration}, dur ${nc && nc.duration_s}`);
ok(CAT.eclipses.filter(e => e.type !== 'partial' && !e.central).length >= 1,
   'the catalogue must hold at least one non-central total eclipse');

// ---------------------------------------------------------------------------
// 7. Gamma carries a sign. Unsigned it matches no published catalogue and
//    throws away which hemisphere the eclipse belongs to.
// ---------------------------------------------------------------------------
close(of('2026-02-17').gamma, -0.9743, 1e-3, 'gamma of 2026-02-17 (Antarctic annular)');
close(of('2026-08-12').gamma, +0.8977, 1e-3, 'gamma de 2026-08-12');
close(of('2027-08-02').gamma, +0.1421, 1e-3, 'gamma de 2027-08-02');
close(of('2028-07-22').gamma, -0.6056, 1e-3, 'gamma de 2028-07-22');
ok(CAT.eclipses.some(e => e.gamma < 0), 'no negative gamma: the sign has been lost');

// ---------------------------------------------------------------------------
// 8. The path curves. A sample that misses the Earth has to leave a null, or
//    the renderer closes the array over the hole and draws a chord across a
//    gap the shadow never crossed.
// ---------------------------------------------------------------------------
/* WHERE the line is, and not only that it is a line. Every property below --
   the point count, the gap, the absence of a long jump -- survives a
   projection that puts the whole path on the wrong continent: transposing the
   declination's sine and cosine terms in `project`'s call to `projectAt`
   moves the axis at greatest eclipse from 65,216 N 25,238 W, off Iceland, to
   39,297 N 66,744 E in Uzbekistan, and leaves this block green. That is
   **6 892 km by the `km` helper above and 6 192 km great-circle** -- the
   helper is a flat approximation and overstates by a ninth here, which is why
   the two figures disagree; the tolerances below are in its units, so it is
   the one quoted. Elsewhere on the line the same transposition reaches
   8 895 km on the six-second grid `centralLine` itself walks. That instant is
   6 669 km great-circle; the great-circle maximum is a different instant and
   6 699 km, a pair of digits worth keeping apart in a comment about
   transposed arguments. Reproduced, not remembered: an earlier version of
   this comment quoted the maximum as though it were the value at greatest
   eclipse. The catalogue
   already carries the answer and it was already loaded three lines above,
   compared against nothing. The rule this serves: a port that drifts draws a
   believable path in the wrong place, which is the worst failure possible
   here. */
{
  const ax = Bess.axisPoint(B, E26.greatest_h);
  ok(ax !== null, 'the axis reaches the ground at greatest eclipse');
  if (ax) close(km([ax.lat, ax.lon], [E26.central_lat, E26.central_lon]), 0, 1.0,
                'the axis at greatest eclipse, against the catalogue');
  // And once more on two other eclipses, asserted rather than skipped: a
  // conditional `close` checks nothing on the day `axisPoint` starts
  // returning null, which is one of the things it exists to catch. The
  // tolerance is 0.2 km against a worst residual of 0.057, and it is not
  // slack: 1 km of longitude at these latitudes is about two seconds of
  // delta_t, so a looser bound would accept the sidereal factor being dropped
  // altogether.
  for (const id of ['2027-08-02', '2028-07-22']) {
    const e = of(id), a = Bess.axisPoint(e.elements, e.greatest_h);
    if (!ok(a !== null && e.central_lat !== null,
            `the axis of ${id} reaches the ground at greatest eclipse`)) continue;
    close(km([a.lat, a.lon], [e.central_lat, e.central_lon]), 0, 0.2,
          `the axis of ${id}, against the catalogue`);
  }
}

/* `zeta` crossed against the other path that computes it. `project` derives
   the observer's distance along the shadow axis from the fundamental-plane
   point; `geom` derives it from the observer's own geodetic coordinates. They
   share no line of code. Latitude and longitude do not depend on the
   declination's sine and cosine, so transposing THOSE two arguments moves no
   point on the ground and every check above stays green -- while every cone
   radius, which is a function of zeta, comes out wrong. */
{
  let worstZeta = 0, worstBack = 0, n = 0;
  for (const t of [-1.2, -0.3, 0, 0.4, 1.1]) {
    const e = Bess.evaluate(B, t);
    for (const [px, py] of [[0.1, 0.2], [-0.35, 0.1], [0.0, -0.45], [0.5, 0.3]]) {
      const p = Bess.project(B, e, px, py);
      if (!p) continue;
      const g = Bess.geom(B, Bess.observer(B, p.lat, p.lon, 0), t);
      worstZeta = Math.max(worstZeta, Math.abs(g.zeta - p.zeta));
      /* And BACK to the point it started from. Comparing zeta alone is a
         round trip: `geom` is handed `project`'s own latitude and longitude,
         the two sidereal offsets cancel identically, and the observer's own
         `rs` and `rc` reproduce zeta for any point on the ellipsoid -- so it
         holds with the wrong root of the square root taken, with `c` scaled
         by nine tenths, and with `e1` multiplied by the ellipsoid radius
         instead of divided. `geom` also returns the observer's
         fundamental-plane coordinates, and it derives those from the geodetic
         position without going anywhere near `px` and `py`. That closes the
         loop. */
      worstBack = Math.max(worstBack, Math.hypot(g.xi - px, g.eta - py));
      n++;
    }
  }
  ok(n > 10, `${n} points crossed between project and geom`);
  close(worstZeta, 0, 1e-9, 'the zeta of project and the zeta of geom agree');
  close(worstBack, 0, 1e-9, 'geom returns the fundamental-plane point project was given');
}

/* Closing an open arc ON THE LIMB, which is the only honest way to close it.
   When the cone runs off the Earth over a range of angles containing theta =
   0 the walk emits one run whose ends are thousands of kilometres apart --
   8 213 km at 16:51:38 UTC on 2026-08-12 -- and filling that as a polygon
   draws a chord straight across the limb and out of the visibility limit the
   shadow can never leave. `closeOnLimb` splices a rim walk into the gap.

   The metric properties of the finished ring are NOT enough, and the first
   version of this block was only those. `closeOnLimb`'s one real decision is
   which way round the rim to walk, and the wrong way round produces a ring
   whose steps are just as short, which meets itself just as neatly, and which
   encloses the COMPLEMENT of the shadow -- the penumbra shaded over the whole
   southern hemisphere. So the ring is held against the criterion the region
   is defined by: every vertex of the shadow's boundary is on the cone, which
   is `m = |L1|` for the penumbra and `m = |L2|` for the umbra. That also
   catches a rim arc translated by a wrong sidereal offset, which a 250 km
   step bound cannot see. */
{
  for (const which of ['l1', 'l2']) {
    let onLimb = 0, nonEmpty = 0, worstStep = 0, worstEnds = 0, worstOff = -Infinity;
    let worstRimZ = 0, nRim = 0;
    // Distances unwrap the longitude, and the shared `km` above does not: a
    // ring crossing the antimeridian has a consecutive pair whose raw
    // longitudes differ by nearly 360, which that helper reads as twenty-five
    // thousand kilometres. It failed this check on its first run for a ring
    // that was perfectly closed.
    const seamKm = (a, b) => Math.hypot((a[0] - b[0]) * 111.19,
      ((((b[1] - a[1]) + 540) % 360) - 180) * 111.19 * Math.cos((a[0] + b[0]) / 2 * D2R));
    for (let t = -3; t <= 3; t += 0.02) {
      const r = Bess.shadowRegion(B, t, which);
      if (r.segs.length) nonEmpty++;
      if (!r.onLimb) continue;
      onLimb++;
      const ring = r.segs[0];
      for (let i = 1; i < ring.length; i++)
        worstStep = Math.max(worstStep, seamKm(ring[i - 1], ring[i]));
      worstEnds = Math.max(worstEnds, seamKm(ring[0], ring[ring.length - 1]));
      /* Every vertex is ON or UNDER the cone. Not "on the cone": the arc
         spliced in from the rim is on the Earth's limb, not on the cone, and
         it is legitimately inside it. That is exactly what tells the two
         candidate arcs apart -- the rim runs the shadow encloses are under
         the cone, and the ones it does not are outside it -- so this is the
         one property that sees the walk going the wrong way round. Measured
         on the correct code, the worst excess over the whole sweep is 0. */
      for (const q of ring) {
        const g = Bess.geom(B, Bess.observer(B, q[0], q[1], 0), t);
        const R = which === 'l2' ? Math.abs(g.L2) : Math.abs(g.L1);
        worstOff = Math.max(worstOff, g.m - R);
        /* And the vertices that are NOT on the cone are the spliced ones, so
           they have to be on the LIMB -- which is where the observer's
           distance along the shadow axis is zero. That is the one property
           that sees a rim arc translated bodily: a wrong sidereal offset
           moves it in longitude, off the rim, while leaving every vertex
           comfortably under the wide penumbral cone and every step under the
           250 km bound. Measured: 1.6e-3 on the correct code against 5.0e-3
           with the offset dropped. */
        if (Math.abs(g.m - R) >= 1e-4) { nRim++; worstRimZ = Math.max(worstRimZ, Math.abs(g.zeta)); }
      }
    }
    // The population is asserted exactly, not against a floor: a regression
    // that closed half of them would clear `> 100` and fall through the
    // `continue` above without a word.
    ok(onLimb > 0, `${which}: ${onLimb} of ${nonEmpty} instants are closed on the limb`);
    ok(worstStep <= 251, `${which}: no step is a chord: worst ${worstStep.toFixed(0)} km`);
    ok(worstEnds < 250, `${which}: the ring meets itself: ends ${worstEnds.toFixed(0)} km apart`);
    /* In Earth radii. The correct code reaches 7.2e-7 on the penumbra and
       1.6e-5 on the umbra, which is smaller and so numerically coarser; the
       walk taken the wrong way round reaches 2.0, four orders of magnitude
       past this bound. */
    ok(worstOff < 5e-5,
       `${which}: no vertex is outside the cone: worst m - |L| = ${worstOff.toExponential(2)}`);
    ok(nRim > 0, `${which}: ${nRim} vertices come from the rim walk`);
    ok(worstRimZ < 2.5e-3,
       `${which}: the spliced vertices are on the limb: worst |zeta| = ${worstRimZ.toExponential(2)}`);
  }
}

const cl = Bess.centralLine(B);
ok(cl.filter(Boolean).length > 60, `the central line has ${cl.filter(Boolean).length} points`);
ok(cl.includes(null), 'the central line must mark the gap where the axis leaves the Earth');
{
  let worst = 0, prev = null;
  for (const p of cl) {
    if (p === null) { prev = null; continue; }
    if (prev) worst = Math.max(worst, km(prev, p));
    prev = p;
  }
  ok(worst < 60, `largest jump inside a continuous run: ${worst.toFixed(0)} km`);
}

// The penumbra outline must exist and reach thousands of km from the axis.
const out = Bess.shadowOutline(B, E26.greatest_h, 'l1');
ok(out.length >= 1 && out[0].length > 10, `contorno de penumbra: ${out.length} tramos`);
ok(Math.max(...out.flat().map(p => km([E26.central_lat, E26.central_lon], p))) > 3000,
   'la penumbra debe alcanzar miles de km desde el eje');

// The instantaneous outlines of both cones, which the time bar draws. Every
// vertex has to sit ON its cone -- the penumbral edge at m = L1, the umbral or
// antumbral edge at m = |L2|, the same criteria local() bisects for the
// contacts -- and the cone that has left the planet must come back empty
// rather than wrapped around it.
{
  const tG = E26.greatest_h;
  for (const which of ['l1', 'l2']) {
    const segs = Bess.shadowOutline(B, tG, which);
    ok(segs.length >= 1, `${which}: hay contorno en el instante del máximo`);
    let worst = 0, n = 0;
    for (const s of segs) for (const p of s) {
      const g = Bess.geom(B, Bess.observer(B, p[0], p[1], 0), tG);
      const e = which === 'l1' ? Math.abs(g.m - g.L1) : Math.abs(g.m - Math.abs(g.L2));
      if (e > worst) worst = e;
      n++;
    }
    ok(n > 10, `${which}: ${n} vértices sobre el cono`);
    close(worst, 0, 1e-3, `${which}: el peor vértice se aparta del cono (radios terrestres)`);
  }
  ok(Bess.shadowOutline(B, tG + 2.5, 'l1').length === 0,
     'la penumbra no toca la Tierra 2,5 h después del máximo');
  const ann = of('2027-02-06');
  ok(Bess.shadowOutline(ann.elements, ann.greatest_h, 'l2').length >= 1,
    '2027-02-06 anular: el contorno antumbral existe');

  // A cone that encloses a pole wraps it, and the ring it produces cannot
  // be closed as an ordinary polygon. The region has to say so: 2026-08-12
  // and 2033-03-30 put the penumbra over the north pole near maximum,
  // 2027-08-02 (gamma 0.14) never does, and the flags have to agree with
  // the ring itself -- a pole-wrapping ring sweeps longitudes almost all
  // the way round.
  {
    const r26 = Bess.shadowRegion(B, tG, 'l1');
    ok(r26.poleN === true, '2026-08-12 en el máximo: el polo N dentro de la penumbra');
    ok(r26.poleS === false, '...y el polo S fuera');
    const flat = r26.segs[0];
    let loMin = 999, loMax = -999;
    for (const p of flat) { loMin = Math.min(loMin, p[1]); loMax = Math.max(loMax, p[1]); }
    ok(loMax - loMin > 300, `el anillo envuelve el polo: barrido de longitud ${(loMax - loMin).toFixed(0)}°`);
    const r33 = Bess.shadowRegion(of('2033-03-30').elements, of('2033-03-30').greatest_h, 'l1');
    ok(r33.poleN === true, '2033-03-30 en el máximo: el polo N dentro de la penumbra');
    const r27 = Bess.shadowRegion(of('2027-08-02').elements, of('2027-08-02').greatest_h, 'l1');
    ok(r27.poleN === false && r27.poleS === false, '2027-08-02: ningún polo dentro');
    const late = Bess.shadowRegion(B, 1.5, 'l1');
    ok(late.poleN === false, '2026-08-12 a t=1,5: el polo ya está fuera');
    // La umbra del 2026 no envuelve nunca el polo: la totalidad se veía
    // bien precisamente por eso.
    ok(Bess.shadowRegion(B, tG, 'l2').poleN === false, 'la umbra del 2026 no envuelve el polo');
  }
}

// ---------------------------------------------------------------------------
// 8b. `geom` hands back what it already computed, and the callers trust it.
//     `totalidad.js` and `radiometry.js` read `g.e`, `g.xi` and `g.eta`
//     instead of evaluating the elements a second time and rebuilding the
//     observer's fundamental-plane coordinates out of three trigonometric
//     calls. That is an implicit contract across three files with nothing in
//     the language to hold it: drop any of the three and the disc dies inside
//     a requestAnimationFrame, mid-sweep, with a TypeError.
// ---------------------------------------------------------------------------
{
  const o = Bess.observer(B, 41.0, 1.0, 300);
  for (const t of [-2.5, -0.4, 0, 0.9, 3.1]) {
    const g = Bess.geom(B, o, t), e = Bess.evaluate(B, t);
    // `continue`, not a bare assertion: without it a missing `.e` reports one
    // failure and then dies on `g.e[k]`, so the six blocks below never run and
    // the summary line never prints.
    if (!ok(g.e !== undefined, `geom(${t}) returns the elements it evaluated`)) continue;
    for (const k of Object.keys(e))
      ok(g.e[k] === e[k], `geom(${t}).e.${k} equals evaluate(${t}).${k}`);
    const xi = o.rc * Math.sin(g.H);
    const eta = o.rs * Math.cos(g.d) - o.rc * Math.cos(g.H) * Math.sin(g.d);
    ok(Math.abs(g.xi - xi) < 1e-15, `geom(${t}).xi is the observer's xi`);
    ok(Math.abs(g.eta - eta) < 1e-15, `geom(${t}).eta is the observer's eta`);
  }
}

// ---------------------------------------------------------------------------
// 8c. `project` keeps the quantities that depend on the instant -- the
//     ellipsoid radius at the declination, its sine and cosine, and the
//     sidereal offset -- against the elements object it was handed. A cache
//     that answered from the wrong instant would put every point of a shadow
//     outline where it was a moment earlier: a plausible outline, in the
//     wrong place, which is this project's worst failure mode. The check is
//     that interleaving two instants changes nothing about either.
// ---------------------------------------------------------------------------
{
  const pts = [[0.1, 0.2], [-0.4, 0.35], [0.0, -0.6], [0.55, 0.0]];
  /* `project` answers for the instant and the elements it was handed, and for
     nothing it saw earlier. There is no cache behind it today -- the six
     per-instant quantities are worked out once per loop and passed down as
     numbers -- and this block exists so that putting one back has to be done
     correctly.

     The reference comes from a FRESH instance of the module and each instant
     is projected there before anything else touches it, because comparing an
     instant against its own earlier reading is not enough and looked like it
     was: a cache with one slot instead of one per instant answers the FIRST
     instant correctly for ever after and poisons every other one, so a check
     that interleaves A and B and then re-reads A sees nothing at all. That is
     what the first version of this block did, and it passed against exactly
     the defect it was written for. */
  const path = require.resolve('../js/besselian.js');
  const virgin = () => { delete require.cache[path]; return require(path); };

  for (const [tMine, tOther] of [[-1.5, 1.5], [1.5, -1.5]]) {
    const F = virgin();
    const truth = pts.map(([x, y]) => F.project(B, F.evaluate(B, tMine), x, y));

    const eMine = Bess.evaluate(B, tMine), eOther = Bess.evaluate(B, tOther);
    pts.forEach(([x, y]) => Bess.project(B, eOther, x, y));     // the other instant first
    const mine = pts.map(([x, y]) => Bess.project(B, eMine, x, y));

    pts.forEach((_, i) => {
      const a = truth[i], c = mine[i];
      ok((a === null) === (c === null), `t=${tMine} after t=${tOther}, point ${i}: same answer`);
      if (a && c) for (const k of ['lat', 'lon', 'zeta', 'H', 'cu'])
        ok(Object.is(a[k], c[k]),
           `t=${tMine} after t=${tOther}, point ${i}, ${k}: ${c[k]} not ${a[k]}`);
    });
  }
  // The two instants must not agree, or none of the above proves anything.
  const dA = Bess.project(B, Bess.evaluate(B, -1.5), 0.1, 0.2);
  const dB = Bess.project(B, Bess.evaluate(B, 1.5), 0.1, 0.2);
  ok(dA && dB && Math.abs(dA.lat - dB.lat) > 0.01 && Math.abs(dA.lon - dB.lon) > 1,
     'two instants three hours apart project the same point somewhere else');

  /* One of the six belongs to the ELEMENTS and not to the instant -- the
     sidereal offset -- so the same instant object arriving with a different
     elements set has to give a different answer. `project` is exported;
     nothing stops that, and a cache keyed on the instant alone would get it
     wrong by the difference of two sidereal offsets and still return
     something shaped like a coordinate. */
  const other = JSON.parse(JSON.stringify(B));
  other.delta_t_s = B.delta_t_s + 120;
  const e0 = Bess.evaluate(B, 0.4);
  const p1 = Bess.project(B, e0, 0.2, 0.1);
  const p2 = Bess.project(other, e0, 0.2, 0.1);
  ok(p1 && p2 && Math.abs(p1.lon - p2.lon) > 1e-6,
     'a different delta_t moves the longitude even for a cached instant');
}

// ---------------------------------------------------------------------------
// 9. The obscuration raster. Uniformly zero still renders as a valid map, and
//    the night side must stay out of it.
// ---------------------------------------------------------------------------
const G = Bess.obscurationGrid(B, 144, 72, 61);
let mx = 0, nz = 0;
for (const v of G.grid) { if (v > mx) mx = v; if (v > 0) nz++; }
close(mx, 1.0, 1e-3, 'greatest obscuration of the grid');
ok(nz > 300 && nz < G.grid.length * 0.5, `la zona parcial cubre ${nz} de ${G.grid.length} celdas`);
{
  // 2026-08-12 peaks over the Atlantic at 17:46 UT, so the Pacific antipode is
  // in darkness. A cell there carrying obscuration means the night-side test
  // has been dropped.
  const j = Math.floor((90 - (-20)) / 180 * 72), i = Math.floor((-170 + 180) / 360 * 144);
  ok(G.grid[j * 144 + i] === 0, 'a cell in the night hemisphere cannot carry obscuration');
}

// ---------------------------------------------------------------------------
// 10. The polynomial is a cubic and the cubic term matters. Dropping it left
//     every check above green.
// ---------------------------------------------------------------------------
{
  const quad = Object.assign({}, B, { x: B.x.slice(0, 3), y: B.y.slice(0, 3) });
  const a = Bess.evaluate(B, 3.0), b = Bess.evaluate(quad, 3.0);
  ok(Math.abs(a.x - b.x) > 1e-5 || Math.abs(a.y - b.y) > 1e-5,
     'the cubic term of x/y changes nothing at 3 h: the fit is suspect');
}

// ---------------------------------------------------------------------------
// 11. The grid against an independent per-point computation.
//
//     obscurationGrid prunes each row to the columns where the Sun can be up
//     and the penumbra can reach, and then refines the maximum in time. Both
//     are optimisations, and both have to be invisible: maxObscuration reaches
//     the same number from scratch, scanning the whole window with no pruning
//     and no grid. Checked over the four geometries that stress it -- annular
//     near the south pole, total across the north pole, low latitude, and a
//     non-central total whose axis misses the Earth.
// ---------------------------------------------------------------------------
{
  for (const id of ['2026-02-17', '2026-08-12', '2027-08-02', '2043-04-09']) {
    const Bx = of(id).elements;
    const nlon = 120, nlat = 60;
    const G = Bess.obscurationGrid(Bx, nlon, nlat, 121);
    let worst = 0, hit = 0, where = null;
    for (let j = 0; j < nlat; j++) {
      for (let i = 0; i < nlon; i++) {
        const la = 90 - (j + 0.5) * 180 / nlat, lo = -180 + (i + 0.5) * 360 / nlon;
        const a = G.grid[j * nlon + i];
        const b = Bess.maxObscuration(Bx, la, lo, { nt: 121 });
        if (a > 0.001) hit++;
        if (Math.abs(a - b) > worst) { worst = Math.abs(a - b); where = [la, lo, a, b]; }
      }
    }
    ok(hit > 150, `${id}: la malla de referencia apenas tiene eclipse (${hit} celdas)`);
    // 1e-6 and not zero: the grid is stored in a Float32Array and the
    // reference comes out in double, so the floor is single precision's 6e-8.
    ok(worst < 1e-6, `${id}: the grid disagrees with the point-by-point calculation ` +
       `(dif ${worst.toExponential(2)} en ${JSON.stringify(where)})`);
  }
}

// ---------------------------------------------------------------------------
// 12. obsAt is evaluate + geom + obscuration, with no object in between.
//
//     It was written by hand to avoid allocating in the hot loop, so it is a
//     copy of the arithmetic of two other functions and can drift from them in
//     any edit. Compared here over assorted points and instants, night
//     hemisphere and poles included.
// ---------------------------------------------------------------------------
{
  const Bx = of('2026-08-12').elements;
  let worst = 0, n = 0;
  for (const [la, lo] of [[41.65, -0.88], [0, 0], [89.5, 179], [-89.5, -179],
                          [65, -25], [-40, 150], [23.5, 90], [70, -60]]) {
    const o = Bess.observer(Bx, la, lo, 0);
    for (let k = 0; k <= 64; k++) {
      const t = -3.2 + 6.4 * k / 64;
      const g = Bess.geom(Bx, o, t);
      const ref = g.zeta <= 0 ? 0
        : Bess.obscuration(g.m, (g.L1 + g.L2) / 2, (g.L1 - g.L2) / 2);
      worst = Math.max(worst, Math.abs(ref - Bess.obsAt(Bx, o, t)));
      n++;
    }
  }
  ok(worst === 0, `obsAt se ha separado de geom+obscuration (dif ${worst}, ${n} muestras)`);
}

// ---------------------------------------------------------------------------
// 13. The contours.
//
//     The grid decides the topology; it does not decide the accuracy. Every
//     vertex is placed by bisecting the real function on the edge it falls on,
//     and the chords are subdivided until they approach the curve.
//
//     With one declared exception: above the TERMINATOR the function jumps
//     from zero to a finite value, because the Sun sets. There the region
//     boundary is a discontinuity and not a level curve, and |g - level| means
//     nothing. Those vertices are identified by the Sun's altitude at the
//     instant of their maximum and counted separately, not ignored in silence.
//
//     What is NOT filtered out is the world edge. The adversarial review of
//     August 2026 found that the band drawn was the wrong one up to 66 km
//     inside the map along the antimeridian and 39 km at the poles, across the
//     56 eclipses, and this file could not see it because it discarded exactly
//     that strip as "the frame".
// ---------------------------------------------------------------------------
const SUITE = ['2026-08-12', '2027-08-02', '2043-04-09', '2039-12-15', '2026-02-17'];
{
  const KM = 111.19;
  for (const id of SUITE) {
    const Bx = of(id).elements;
    const C = Bess.contours(Bx);
    ok(C.fallbacks === 0,
       `${id}: ${C.fallbacks} vertices with no sign change to bisect`);
    ok(C.vertices > 800 && C.vertices < 40000,
       `${id}: ${C.vertices} vertices, outside the drawing budget`);

    // the Sun's altitude at the instant of the maximum: separates terminator
    // from curve
    const onTerminator = (la, lo) => {
      const o = Bess.observer(Bx, la, lo, 0);
      let bz = 9, bo = -1;
      for (let k = 0; k < 121; k++) {
        const g = Bess.geom(Bx, o, -3.2 + 6.4 * k / 120);
        const aa = Bess.altaz(o, g);
        if (aa.alt <= 0) continue;
        const ob = Bess.obscuration(g.m, (g.L1 + g.L2) / 2, (g.L1 - g.L2) / 2);
        if (ob > bo) { bo = ob; bz = aa.alt; }
      }
      return bz < 0.5;
    };

    let malos = 0, muestras = 0, sinCerrar = 0, fuera = 0, fueraDelMundo = 0;
    C.rings.forEach((rings, li) => {
      const level = C.levels[li];
      for (const ring of rings) {
        const a = ring[0], b = ring[ring.length - 1];
        if (Math.hypot((a[1] - b[1]) * Math.cos(a[0] * Math.PI / 180), a[0] - b[0]) * KM > 400)
          sinCerrar++;
        const st = Math.max(1, Math.floor(ring.length / 40));
        for (let i = 0; i < ring.length; i += st) {
          const [la, lo] = ring[i];
          // A vertex may fall OUTSIDE the world, and must: that is where the
          // contours close against the frame, beyond what the view reaches.
          // What it may not do is fall outside the frame.
          if (Math.abs(la) > 91 || Math.abs(lo) > 181) fueraDelMundo++;
          if (Math.abs(la) >= 90 || Math.abs(lo) >= 180) continue;
          muestras++;
          const g = Bess.maxObscuration(Bx, la, lo);
          if (Math.abs(g - level) > 1e-3 && !onTerminator(la, lo)) malos++;
          // nesting: a vertex of one level has to sit inside the previous
          // level's region, or the parity fill inverts. Above the terminator
          // every level shares a boundary, so it does not apply.
          if (li > 0 && g < C.levels[li - 1] - 1e-6 && !onTerminator(la, lo)) fuera++;
        }
      }
    });
    ok(sinCerrar === 0, `${id}: ${sinCerrar} anillos no cierran`);
    ok(fueraDelMundo === 0, `${id}: ${fueraDelMundo} vertices outside the frame`);
    ok(malos === 0, `${id}: ${malos} of ${muestras} vertices are not on their contour ` +
       `y tampoco sobre el terminador`);
    ok(fuera === 0, `${id}: ${fuera} vertices of one level fall outside the level below`);
  }
}

// ---------------------------------------------------------------------------
// 14. The band drawn against the true one, at the world edge.
//
//     This is what the adversarial review found and this file could not see. A
//     point is taken, the band it falls in is computed from the function, and
//     the band the polygon paints it is read by counting crossings --- the
//     same parity rule `fill-rule: evenodd` applies in the browser. The
//     antimeridian and both poles are walked on purpose.
// ---------------------------------------------------------------------------
{
  const bandOf = (C, v) => { let b = -1; for (let i = 0; i < C.levels.length; i++) if (v >= C.levels[i]) b = i; return b; };
  const bandDrawn = (C, la, lo) => {
    let b = -1;
    for (let i = 0; i < C.rings.length; i++) {
      let inside = false;
      for (const ring of C.rings[i]) {
        for (let k = 0, j = ring.length - 1; k < ring.length; j = k++) {
          const [ya, xa] = ring[k], [yb, xb] = ring[j];
          if ((ya > la) !== (yb > la) && lo < (xb - xa) * (la - ya) / (yb - ya) + xa) inside = !inside;
        }
      }
      if (inside) b = i;
    }
    return b;
  };
  for (const id of SUITE) {
    const Bx = of(id).elements;
    const C = Bess.contours(Bx);
    let mal = 0, n = 0, peor = null;
    const probe = (la, lo) => {
      const v = Bess.maxObscuration(Bx, la, lo);
      // points hard against a threshold are not judged: there the correct band
      // depends on one digit and a disagreement says nothing
      if (C.levels.some(l => Math.abs(v - l) < 0.02)) return;
      n++;
      const b0 = bandOf(C, v), b1 = bandDrawn(C, la, lo);
      if (b0 !== b1) { mal++; if (!peor) peor = [la, lo, v, b0, b1]; }
    };
    for (let la = -88; la <= 88; la += 2) { probe(la, 179.6); probe(la, -179.6); }
    for (let lo = -178; lo < 180; lo += 4) { probe(89.6, lo); probe(-89.6, lo); probe(31, lo); probe(-31, lo); }
    ok(n > 200, `${id}: solo ${n} puntos juzgados`);
    ok(mal === 0, `${id}: ${mal} de ${n} puntos con la banda equivocada` +
       (peor ? ` (p. ej. ${peor[0]} ${peor[1]}: vale ${peor[2].toFixed(4)}, ` +
               `should be band ${peor[3]} and is painted as ${peor[4]})` : ''));
  }
}

// ---------------------------------------------------------------------------
// 15. No ring crosses itself.
//
//     With `fill-rule: evenodd` every loop inverts the fill, so a ring that
//     crosses itself paints the neighbouring band in the tongue it forms. The
//     nesting check in section 13 cannot see it, because it looks at the value
//     at each vertex and not at the polygon's topology.
// ---------------------------------------------------------------------------
{
  const corta = (p1, p2, p3, p4) => {
    const d = (p2[1] - p1[1]) * (p4[0] - p3[0]) - (p2[0] - p1[0]) * (p4[1] - p3[1]);
    if (Math.abs(d) < 1e-12) return false;
    const t = ((p3[1] - p1[1]) * (p4[0] - p3[0]) - (p3[0] - p1[0]) * (p4[1] - p3[1])) / d;
    const u = ((p3[1] - p1[1]) * (p2[0] - p1[0]) - (p3[0] - p1[0]) * (p2[1] - p1[1])) / d;
    return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9;
  };
  for (const id of SUITE) {
    const C = Bess.contours(of(id).elements);
    let n = 0;
    C.rings.forEach(rings => rings.forEach(r => {
      const m = r.length;
      for (let a = 0; a < m; a++) {
        for (let b = a + 2; b < m; b++) {
          if (a === 0 && b === m - 1) continue;
          if (corta(r[a], r[(a + 1) % m], r[b], r[(b + 1) % m])) n++;
        }
      }
    }));
    ok(n === 0, `${id}: ${n} autocruces de anillo`);
  }
}

// ---------------------------------------------------------------------------
// 16. The chord sagitta. The one thing vertex bisection does not bound by
//     construction, so it gets measured: from the midpoint of each chord the
//     real contour is searched for along the normal, and searched FAR --- five
//     chords --- because a short radius discards exactly the worst ones and
//     lets through the percentile being watched.
// ---------------------------------------------------------------------------
{
  const KM = 111.19, D2Rl = Math.PI / 180;
  const Bx = of('2026-08-12').elements;
  const C = Bess.contours(Bx);
  const sag = (level, a, b) => {
    const la = (a[0] + b[0]) / 2, lo = (a[1] + b[1]) / 2;
    if (Math.abs(la) >= 90 || Math.abs(lo) >= 180) return null;
    const cs = Math.cos(la * D2Rl);
    const dx = (b[1] - a[1]) * cs, dy = b[0] - a[0], L = Math.hypot(dx, dy);
    if (!(L > 0)) return null;
    const nx = -dy / L, ny = dx / L;
    const f = u => {
      const q = [la + ny * u, lo + nx * u / cs];
      if (Math.abs(q[0]) > 90 || Math.abs(q[1]) > 180) return null;
      return Bess.maxObscuration(Bx, q[0], q[1]) - level;
    };
    const R = Math.min(5 * L, 3);
    let f0 = f(-R), f1 = f(R);
    if (f0 === null || f1 === null || (f0 < 0) === (f1 < 0)) return null;
    let u0 = -R, u1 = R;
    for (let i = 0; i < 22; i++) {
      const u = (u0 + u1) / 2, fu = f(u);
      if (fu === null) return null;
      if ((f0 < 0) === (fu < 0)) { u0 = u; f0 = fu; } else { u1 = u; }
    }
    return Math.abs((u0 + u1) / 2) * KM;
  };
  // The terminator is set aside and counted, not glossed over: there the
  // region boundary is a jump in the function, "the curve" next door is
  // kilometres away and the measured distance is not the drawing's error.
  // Measured, EVERY chord worse than a kilometre has the Sun at 0.00 degrees
  // at its maximum.
  const enTerminador = (la, lo) => {
    const o = Bess.observer(Bx, la, lo, 0);
    let alt = 9, bo = -1;
    for (let k = 0; k < 121; k++) {
      const g = Bess.geom(Bx, o, -3.2 + 6.4 * k / 120);
      const aa = Bess.altaz(o, g);
      if (aa.alt <= 0) continue;
      const ob = Bess.obscuration(g.m, (g.L1 + g.L2) / 2, (g.L1 - g.L2) / 2);
      if (ob > bo) { bo = ob; alt = aa.alt; }
    }
    return alt < 0.5;
  };
  const vals = []; let saltoTerm = 0;
  C.rings.forEach((rings, li) => {
    for (const ring of rings) {
      const st = Math.max(1, Math.floor(ring.length / 25));
      for (let i = 0; i + 1 < ring.length; i += st) {
        const a = ring[i], b = ring[i + 1];
        const v = sag(C.levels[li], a, b);
        if (v === null) continue;
        if (v > 1 && enTerminador((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) { saltoTerm++; continue; }
        vals.push(v);
      }
    }
  });
  vals.sort((x, y) => x - y);
  const q = f => vals[Math.min(vals.length - 1, Math.floor(f * vals.length))];
  ok(vals.length > 100, `solo ${vals.length} cuerdas medidas`);
  ok(q(0.9) < 0.6, `la flecha de la cuerda en el percentil 90 es ${q(0.9).toFixed(2)} km`);
  ok(q(1) < 2, `la peor flecha fuera del terminador es ${q(1).toFixed(2)} km`);
  ok(saltoTerm < vals.length / 10,
     `${saltoTerm} de ${vals.length + saltoTerm} cuerdas apartadas por el terminador: ` +
     `too many for the exception to remain an exception`);
}

// ---------------------------------------------------------------------------
// 17. The visibility limit.
//
//     Drawn dashed, and it says one concrete thing: outside that line the Sun
//     is never eclipsed at any instant. So it is checked against local(),
//     which answers that same question in the panel and does it with 4001
//     instants and no grid at all.
//
//     The obscuration was not contoured at a tiny level, and this is why: near
//     the edge the eclipse lasts minutes and a 121-instant sweep reads it as
//     zero. The margin L1 - m is smooth in time and has no such problem.
// ---------------------------------------------------------------------------
{
  const KM = 111.19;
  for (const id of SUITE) {
    const Bx = of(id).elements;
    const C = Bess.contours(Bx);
    ok(C.visible.length > 0, `${id}: there is no visibility limit`);
    let dentroSinEclipse = 0, fueraConEclipse = 0, n = 0, ejemplo = null;
    // 40 km either side of the line: more than the grid step and far less than
    // the penumbra's radius, so the sign has to be settled.
    const D = 40 / KM;
    for (const ring of C.visible) {
      const st = Math.max(1, Math.floor(ring.length / 120));
      for (let i = 0; i < ring.length; i += st) {
        const [la, lo] = ring[i];
        if (Math.abs(la) > 88 || Math.abs(lo) > 178) continue;
        // the normal, by differencing against the neighbour
        const b = ring[(i + 1) % ring.length];
        const cs = Math.cos(la * Math.PI / 180);
        const dx = (b[1] - lo) * cs, dy = b[0] - la, L = Math.hypot(dx, dy);
        if (!(L > 0)) continue;
        const nx = -dy / L, ny = dx / L;
        const at = u => [la + ny * u, lo + nx * u / Math.max(1e-6, cs)];
        const p1 = at(D), p2 = at(-D);
        if (Math.abs(p1[0]) > 89 || Math.abs(p2[0]) > 89) continue;
        const m1 = Bess.visMargin(Bx, p1[0], p1[1]), m2 = Bess.visMargin(Bx, p2[0], p2[1]);
        // uno dentro y otro fuera, o el punto no sirve para juzgar
        if ((m1 > 0) === (m2 > 0)) continue;
        const dentro = m1 > 0 ? p1 : p2, fuera = m1 > 0 ? p2 : p1;
        n++;
        const ld = Bess.local(Bx, dentro[0], dentro[1], 0);
        const lf = Bess.local(Bx, fuera[0], fuera[1], 0);
        if (!ld || !(ld.visible_obscuration > 0)) {
          dentroSinEclipse++; if (!ejemplo) ejemplo = ['dentro', dentro];
        }
        if (lf && lf.visible_obscuration > 0) {
          fueraConEclipse++; if (!ejemplo) ejemplo = ['fuera', fuera];
        }
      }
    }
    ok(n > 25, `${id}: only ${n} points of the limit judged`);
    ok(dentroSinEclipse === 0,
       `${id}: ${dentroSinEclipse} of ${n} points 40 km INSIDE the limit with no eclipse` +
       (ejemplo ? ` (p. ej. ${ejemplo[0]} ${ejemplo[1].map(v => v.toFixed(3)).join(' ')})` : ''));
    ok(fueraConEclipse === 0,
       `${id}: ${fueraConEclipse} of ${n} points 40 km OUTSIDE the limit with a visible eclipse`);
  }
}

// ---------------------------------------------------------------------------
// 18. Not one tooth.
//
//     A spike is a vertex that sticks out of the line joining its two
//     neighbours by more than that line is long. On a well-resolved curve
//     there is none; above the terminator they appeared at tens of kilometres,
//     because there the region boundary is a jump and the grid crosses it in a
//     zigzag. What holds this up is the smoothing of the jump vertices, each
//     of which runs along ITS OWN edge and never leaves it.
// ---------------------------------------------------------------------------
{
  const KM = 111.19;
  for (const id of SUITE) {
    const C = Bess.contours(of(id).elements);
    let picos = 0, peor = 0, tot = 0, donde = null;
    const scan = rings => rings.forEach(r => {
      const m = r.length;
      for (let i = 0; i < m; i++) {
        const a = r[(i - 1 + m) % m], b = r[i], c = r[(i + 1) % m];
        if (Math.abs(b[0]) >= 89.5 || Math.abs(b[1]) >= 179.5) continue;
        if (Math.abs(a[1] - b[1]) > 5 || Math.abs(c[1] - b[1]) > 5) continue;
        const cs = Math.cos(b[0] * Math.PI / 180);
        const ax = (a[1] - b[1]) * cs, ay = a[0] - b[0];
        const cx = (c[1] - b[1]) * cs, cy = c[0] - b[0];
        const L = Math.hypot(cx - ax, cy - ay);
        if (!(L > 0)) continue;
        tot++;
        const h = Math.abs(ax * (cy - ay) - ay * (cx - ax)) / L * KM;
        if (h > 0.35 * L * KM && h > 0.5) {
          picos++;
          if (h > peor) { peor = h; donde = [b[0].toFixed(2), b[1].toFixed(2)]; }
        }
      }
    });
    C.rings.forEach(scan);
    scan(C.visible);
    ok(picos <= 8, `${id}: ${picos} spikes of ${tot} vertices, worst ${peor.toFixed(1)} km` +
       (donde ? ` en ${donde.join(' ')}` : ''));
    ok(peor < 25, `${id}: el peor pico mide ${peor.toFixed(1)} km`);
  }
}

console.log(fails ? `${fails} FAILURES`
                  : 'besselian.js OK — agrees with eclipsecat.py, DE440s and NASA');
process.exit(fails ? 1 : 0);
