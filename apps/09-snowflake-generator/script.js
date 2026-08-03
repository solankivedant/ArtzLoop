
"use strict";
/* shared math helpers available to every tool */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function makeNoise2D(seed){
  const rnd=mulberry32(seed),p=new Uint8Array(512),base=[];
  for(let i=0;i<256;i++)base.push(i);
  for(let i=255;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=base[i];base[i]=base[j];base[j]=t;}
  for(let i=0;i<512;i++)p[i]=base[i&255];
  const g=new Float32Array(256);for(let i=0;i<256;i++)g[i]=rnd();
  const f=t=>t*t*(3-2*t);
  return function(x,y){
    const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;
    const aa=g[p[(p[xi&255]+yi)&255]],ba=g[p[(p[(xi+1)&255]+yi)&255]],
          ab=g[p[(p[xi&255]+yi+1)&255]],bb=g[p[(p[(xi+1)&255]+yi+1)&255]];
    const u=f(xf),v=f(yf),top=aa+(ba-aa)*u;
    return top+(ab+(bb-ab)*u-top)*v;
  };
}
function hsl(h,s,l,a){return "hsla("+((h%360)+360)%360+","+s+"%,"+l+"%,"+(a===undefined?1:a)+")";}
function hslToRgb(h,s,l){
  h=(((h%360)+360)%360)/360;s/=100;l/=100;
  const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q,
  f=t=>{t=((t%1)+1)%1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};
  return [Math.round(f(h+1/3)*255),Math.round(f(h)*255),Math.round(f(h-1/3)*255)];
}
function hexToRgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}

/* #12 Snowflake Generator - strokes mirror N-fold around the center (6-fold
 * by default, for that classic snowflake look), and finishing a stroke sets
 * off a soft freezing shimmer. Everything else - Eraser modes ("Trim this
 * piece" / "Trim all pieces" rub out just the segments under the cursor, one
 * copy / every copy; "Whole piece" removes the entire symmetric copy you
 * touch; "Whole stroke" removes the stroke and all of its copies at once),
 * Fill, Recolor and whole-piece select+rotate - works the same way as the
 * Kaleidoscope Mandala Pad. */
(function(){
let api, live = null, strokes = [], fills = [], cursor = null, recolorHover = null, freeze = null;
let selection = { strokes:new Set(), fills:new Set() }, rotBase = null, selBBox = null;
// current angular reference frame for the whole snowflake - since rotating
// always spins the entire piece (selection is always everything), every
// existing stroke/fill's own .rot stays in lockstep with this value; new
// strokes/fills need to start at this same angle too, or their mirror axes
// come out misaligned with a snowflake that's already been spun.
let globalRot = 0, curRotDelta = 0;
function geom(){ return { cx:api.W/2, cy:api.H/2, sc:Math.min(api.W,api.H)/2 }; }
// converts a raw cursor point (in the snowflake's current, possibly-spun
// visual frame) into the canonical/pre-spin frame every stroke's .pts are
// stored in - i.e. the inverse of the rotation drawCopySeg re-applies via
// s.rot. Storing the compensated point (instead of the raw one) alongside
// rot:globalRot is what lets a brand-new stroke land exactly under the
// cursor AND mirror about the snowflake's current (already-rotated) axis at
// the same time.
function toCanonical(n){
  if (!globalRot) return n;
  const co = Math.cos(globalRot), si = Math.sin(globalRot);
  return [n[0]*co + n[1]*si, n[1]*co - n[0]*si];
}
/* grow the world so every mirrored copy of a point fits - copies landing
 * far from the cursor were getting clipped at the old world edge */
function growForPoint(n, sym, mir, rot){
  const g = geom();
  for (let k = 0; k < sym; k++)
    for (const f of (mir ? [1,-1] : [1])){
      const an = Math.PI*2*k/sym + (rot||0), co = Math.cos(an), si = Math.sin(an);
      api.grow(g.cx + (n[0]*co - n[1]*f*si)*g.sc, g.cy + (n[0]*si + n[1]*f*co)*g.sc);
    }
}
function growForAll(){
  let m = 0;
  for (const s of strokes)
    for (const p of s.pts) m = Math.max(m, Math.hypot(p[0], p[1]) + s.size);
  if (!m) return;
  const g = geom();
  api.grow(g.cx - m*g.sc, g.cy - m*g.sc);
  api.grow(g.cx + m*g.sc, g.cy + m*g.sc);
}
function copyKey(k, f){ return k*2 + (f < 0 ? 1 : 0); }
// runtime Sets mirroring the serializable cut arrays
function sets(s){
  if (!s._ca) s._ca = new Set(s.cutAll || []);
  if (!s._c){
    s._c = {};
    if (s.cuts) for (const k in s.cuts) s._c[k] = new Set(s.cuts[k]);
  }
  return s;
}
function isCut(s, key, i){
  sets(s);
  return s._ca.has(i) || (s._c[key] && s._c[key].has(i));
}
function segCount(s){ return Math.max(1, s.pts.length - 1); }

function drawCopySeg(c, s, k, f, a, b){
  const g = geom();
  // the rotation offset is added AFTER the mirror flip (f) is applied below,
  // so it rigidly spins both the direct and the mirrored copies the same way -
  // adding it to the point coordinates instead would spin the mirrored half
  // backwards, since a reflection reverses the sense of rotation.
  const an = Math.PI*2*k/s.sym + (s.rot||0), co = Math.cos(an), si = Math.sin(an);
  c.beginPath();
  c.moveTo(g.cx + (a[0]*co - a[1]*f*si)*g.sc, g.cy + (a[0]*si + a[1]*f*co)*g.sc);
  c.lineTo(g.cx + (b[0]*co - b[1]*f*si)*g.sc, g.cy + (b[0]*si + b[1]*f*co)*g.sc);
  c.stroke();
}
function liveSeg(a, b, s){ // used while drawing - no cuts yet
  const c = api.ctx, g = geom();
  c.strokeStyle = s.col;
  c.lineWidth = Math.max(.5, s.size * g.sc);
  c.lineCap = "round"; c.lineJoin = "round";
  c.shadowColor = s.col; c.shadowBlur = c.lineWidth*2.6;
  for (let k = 0; k < s.sym; k++)
    for (const f of (s.mir ? [1,-1] : [1]))
      drawCopySeg(c, s, k, f, a, b);
  c.shadowBlur = 0;
}
function drawWholeStroke(s){
  const c = api.ctx, g = geom();
  c.lineWidth = Math.max(.5, s.size * g.sc);
  c.lineCap = "round"; c.lineJoin = "round";
  c.shadowColor = s.col; c.shadowBlur = c.lineWidth*2.6;
  const dot = s.pts.length === 1;
  for (let k = 0; k < s.sym; k++){
    for (const f of (s.mir ? [1,-1] : [1])){
      const key = copyKey(k, f);
      if (s.hidden && s.hidden.indexOf(key) >= 0) continue; // copy erased whole
      // per-copy recolor overrides the stroke's shared color for just this
      // one symmetric copy, leaving every other copy on the original color
      c.strokeStyle = (s.colOverride && s.colOverride[key]) || s.col;
      if (dot){
        if (!isCut(s, key, 0)) drawCopySeg(c, s, k, f, s.pts[0], s.pts[0]);
        continue;
      }
      for (let i = 1; i < s.pts.length; i++)
        if (!isCut(s, key, i)) drawCopySeg(c, s, k, f, s.pts[i-1], s.pts[i]);
    }
  }
  c.shadowBlur = 0;
}
function redraw(skipFills){
  growForAll();
  api.clearWorld();
  for (const s of strokes) drawWholeStroke(s);
  if (!skipFills) applyFills(); // flood-filling is the expensive part - skip it for interactive drag previews
}
// world-logical point -> backing-store pixel coords, via the world ctx's own
// transform (scale + pan baked in) so we don't need to know wdpr/wx0/wy0
function worldToBacking(wx, wy){
  const m = api.ctx.getTransform();
  return [m.a*wx + m.c*wy + m.e, m.b*wx + m.d*wy + m.f];
}
// paint-bucket flood fill: samples the already-rendered raster (strokes are
// the boundaries) and replaces the contiguous region under the seed point.
// Capped to a window around the seed and aborted if the fill reaches that
// window's edge - on this infinite/growable canvas an "open" region has no
// natural bound, so we no-op rather than paint a fake hard edge or
// flood-fill an unbounded area.
const FILL_WALL = 40;   // alpha at/above this is "ink" - always a hard stop
const FILL_TOL = 30;    // color tolerance used only when re-filling an already-painted region
const FILL_WIN = 1100;
const FILL_CENTER_EPS = 4; // px radius (backing space) below which angle-around-center is noise, not signal
function normAngle(a){ // -> [-PI, PI)
  a = a % (Math.PI*2);
  if (a >= Math.PI) a -= Math.PI*2;
  if (a < -Math.PI) a += Math.PI*2;
  return a;
}
// confines a flood fill to the snowflake wedge (symmetric sector) it was seeded
// in: `wedge` gives the sector's center axis (in the same backing-pixel angle
// space as bx/by) and fold count, in the same terms applyFills() used to place
// this specific copy. Hand-drawn strokes almost never meet pixel-perfectly at
// the seam between adjacent copies, so the "background" is one contiguous
// region spanning every wedge - without this, a fill seeded in one wedge's
// pocket flows straight through that seam gap into its neighbors, then theirs,
// etc, no matter how large the connected region turns out to be.
function makeWedgeTest(wedge, bx, by){
  if (!wedge || wedge.sym <= 1) return null;
  const { cx, cy, sym, axis, mir } = wedge;
  const half = Math.PI / sym;
  const seedR = Math.hypot(bx - cx, by - cy);
  if (seedR < FILL_CENTER_EPS) return null; // seed itself is too close to center to have a meaningful angle
  // this copy's own true position - the wedge is centered here, not on `axis`
  // (axis is only the shared mirror-reflection line, constant across every k;
  // using it as the wedge center made the bounds check compare the seed's
  // absolute angle against a fixed 0 deg reference instead of its own copy,
  // so any fill seeded more than half a wedge away from absolute angle 0
  // excluded itself on the very first pixel and silently painted nothing)
  const seedAngle = Math.atan2(by - cy, bx - cx);
  const seedDelta = normAngle(seedAngle - axis); // seed's side of the mirror line, for the mir check below
  return (x, y) => {
    const dx = x - cx, dy = y - cy;
    if (Math.hypot(dx, dy) < FILL_CENTER_EPS) return true; // never exclude the near-center hub itself
    const angle = Math.atan2(dy, dx);
    if (Math.abs(normAngle(angle - seedAngle)) > half + 1e-6) return false; // different fold index than the seed
    if (mir){
      const delta = normAngle(angle - axis);
      if (Math.sign(delta) !== Math.sign(seedDelta) && Math.abs(delta) > 1e-3 && Math.abs(seedDelta) > 1e-3) return false; // wrong mirror half
    }
    return true;
  };
}
function floodFillAt(bx, by, hexColor, wedge){
  const ctx = api.ctx, cw = api.world.width, ch = api.world.height;
  bx = Math.round(bx); by = Math.round(by);
  if (bx < 0 || by < 0 || bx >= cw || by >= ch) return;
  const x0 = Math.max(0, bx - FILL_WIN), y0 = Math.max(0, by - FILL_WIN);
  const x1 = Math.min(cw, bx + FILL_WIN), y1 = Math.min(ch, by + FILL_WIN);
  const ww = x1 - x0, hh = y1 - y0;
  if (ww <= 0 || hh <= 0) return;
  const img = ctx.getImageData(x0, y0, ww, hh);
  const d = img.data;
  const sx = bx - x0, sy = by - y0, si = (sy*ww + sx)*4;
  const tr = d[si], tg = d[si+1], tb = d[si+2], ta = d[si+3];
  const [fr, fg, fb] = hexToRgb(hexColor);
  const seedIsInk = ta >= FILL_WALL;
  if (seedIsInk && Math.abs(tr-fr) <= 2 && Math.abs(tg-fg) <= 2 && Math.abs(tb-fb) <= 2 && ta >= 253) return; // already this color
  // background (transparent-ish) seeds flow through anything else background-ish and
  // stop dead at the first opaque-enough pixel - a firm alpha wall, not a color-distance
  // guess, so the fill hugs the ink's antialiased edge instead of eating into it unevenly.
  // an ink-colored seed (clicked on an already-filled/painted pixel) only re-spreads across
  // pixels matching that same painted color, so it can't leak past a differently colored line.
  const match = seedIsInk
    ? (i) => d[i+3] >= FILL_WALL && Math.abs(d[i]-tr) <= FILL_TOL && Math.abs(d[i+1]-tg) <= FILL_TOL && Math.abs(d[i+2]-tb) <= FILL_TOL
    : (i) => d[i+3] < FILL_WALL;
  const inWedge = makeWedgeTest(wedge, bx, by); // null = no wedge constraint (sym<=1, or seed too near center)
  const seen = new Uint8Array(ww*hh);
  const stack = [sx, sy];
  let touchedEdge = false;
  while (stack.length){
    const y = stack.pop(), x = stack.pop();
    if (x < 0 || y < 0 || x >= ww || y >= hh) continue;
    const idx = y*ww + x;
    if (seen[idx]) continue;
    const i = idx*4;
    if (!match(i)) continue;
    seen[idx] = 1; // mark visited even if wedge-excluded below, so we don't re-test it from every neighbor
    if (inWedge && !inWedge(x + x0, y + y0)) continue;
    if (x === 0 || y === 0 || x === ww-1 || y === hh-1) touchedEdge = true;
    d[i] = fr; d[i+1] = fg; d[i+2] = fb; d[i+3] = 255;
    stack.push(x+1, y, x-1, y, x, y+1, x, y-1);
  }
  if (touchedEdge) return;
  ctx.putImageData(img, x0, y0);
}
// read-only sibling of floodFillAt, used to erase a fill: traces the same
// connected same-color region under the cursor (without painting it) so the
// eraser can tell which fill produced whatever's under the cursor, no
// matter how far the click lands from that fill's original seed point.
function floodTraceRegion(bx, by){
  const ctx = api.ctx, cw = api.world.width, ch = api.world.height;
  bx = Math.round(bx); by = Math.round(by);
  if (bx < 0 || by < 0 || bx >= cw || by >= ch) return null;
  const x0 = Math.max(0, bx - FILL_WIN), y0 = Math.max(0, by - FILL_WIN);
  const x1 = Math.min(cw, bx + FILL_WIN), y1 = Math.min(ch, by + FILL_WIN);
  const ww = x1 - x0, hh = y1 - y0;
  if (ww <= 0 || hh <= 0) return null;
  const img = ctx.getImageData(x0, y0, ww, hh);
  const d = img.data;
  const sx = bx - x0, sy = by - y0, si = (sy*ww + sx)*4;
  const tr = d[si], tg = d[si+1], tb = d[si+2], ta = d[si+3];
  if (ta < FILL_WALL) return null; // clicked on bare background - nothing painted to erase
  const match = (i) => d[i+3] >= FILL_WALL && Math.abs(d[i]-tr) <= FILL_TOL &&
    Math.abs(d[i+1]-tg) <= FILL_TOL && Math.abs(d[i+2]-tb) <= FILL_TOL;
  const seen = new Uint8Array(ww*hh);
  const stack = [sx, sy];
  let touchedEdge = false;
  while (stack.length){
    const y = stack.pop(), x = stack.pop();
    if (x < 0 || y < 0 || x >= ww || y >= hh) continue;
    const idx = y*ww + x;
    if (seen[idx]) continue;
    const i = idx*4;
    if (!match(i)) continue;
    seen[idx] = 1;
    if (x === 0 || y === 0 || x === ww-1 || y === hh-1) touchedEdge = true;
    stack.push(x+1, y, x-1, y, x, y+1, x, y-1);
  }
  if (touchedEdge) return null; // region isn't bounded within our window - same safety rule as placing a fill
  return {
    contains(px, py){
      const lx = Math.round(px) - x0, ly = Math.round(py) - y0;
      return lx >= 0 && ly >= 0 && lx < ww && ly < hh && !!seen[ly*ww + lx];
    },
  };
}
function applyFills(){
  for (const f of fills){
    const g = geom();
    // seed's own angle is compared against this same center, transformed
    // through the identical worldToBacking map, so panning/zooming can't
    // skew the angle comparison even though it moves both points together
    const [cxB, cyB] = worldToBacking(g.cx, g.cy);
    for (let k = 0; k < f.sym; k++){
      for (const ff of (f.mir ? [1,-1] : [1])){
        if (f.hidden && f.hidden.indexOf(copyKey(k, ff)) >= 0) continue; // this copy was erased
        const an = Math.PI*2*k/f.sym + (f.rot||0), co = Math.cos(an), si = Math.sin(an);
        const wx = g.cx + (f.pt[0]*co - f.pt[1]*ff*si)*g.sc;
        const wy = g.cy + (f.pt[0]*si + f.pt[1]*ff*co)*g.sc;
        const [bx, by] = worldToBacking(wx, wy);
        const key = copyKey(k, ff);
        const wedge = { cx:cxB, cy:cyB, sym:f.sym, axis:an, mir:f.mir };
        floodFillAt(bx, by, (f.colOverride && f.colOverride[key]) || f.col, wedge);
      }
    }
  }
}
function distToSeg(px, py, ax, ay, bx, by){
  const dx = bx-ax, dy = by-ay;
  const len2 = dx*dx + dy*dy;
  let t = len2 ? ((px-ax)*dx + (py-ay)*dy)/len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx*t), py - (ay + dy*t));
}
// segment indices of copy (k, f) touched by the cursor (normalized coords)
function copySegHits(s, k, f, nx, ny, rad){
  const an = Math.PI*2*k/s.sym + (s.rot||0), co = Math.cos(an), si = Math.sin(an);
  const rx = nx*co + ny*si, ry = (-nx*si + ny*co)*f; // cursor in base space
  const thr = rad + s.size/2, hits = [], pts = s.pts;
  if (pts.length === 1){
    if (Math.hypot(rx-pts[0][0], ry-pts[0][1]) < thr) hits.push(0);
    return hits;
  }
  for (let i = 1; i < pts.length; i++)
    if (!isCut(s, copyKey(k, f), i) &&
        distToSeg(rx, ry, pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1]) < thr)
      hits.push(i);
  return hits;
}
function addCuts(s, key, idxs, everyCopy){
  sets(s);
  if (everyCopy){
    s.cutAll = s.cutAll || [];
    for (const i of idxs) if (!s._ca.has(i)){ s._ca.add(i); s.cutAll.push(i); }
  } else {
    s.cuts = s.cuts || {};
    s.cuts[key] = s.cuts[key] || [];
    s._c[key] = s._c[key] || new Set();
    for (const i of idxs) if (!s._c[key].has(i)){ s._c[key].add(i); s.cuts[key].push(i); }
  }
}
function fullyErased(s){
  sets(s);
  const n = segCount(s), copies = [];
  for (let k = 0; k < s.sym; k++)
    for (const f of (s.mir ? [1,-1] : [1])) copies.push(copyKey(k, f));
  for (const key of copies){
    if (s.hidden && s.hidden.indexOf(key) >= 0) continue;
    for (let i = (s.pts.length === 1 ? 0 : 1); i <= (s.pts.length === 1 ? 0 : n); i++)
      if (!isCut(s, key, i)) return false;
  }
  return true;
}
function eraseAt(nx, ny){
  const g = geom();
  const rad = api.P.esize/g.sc;
  for (let i = strokes.length-1; i >= 0; i--){
    const s = strokes[i];
    for (let k = 0; k < s.sym; k++){
      for (const f of (s.mir ? [1,-1] : [1])){
        const key = copyKey(k, f);
        if (s.hidden && s.hidden.indexOf(key) >= 0) continue;
        const hits = copySegHits(s, k, f, nx, ny, rad);
        if (!hits.length) continue;
        const mode = api.P.emode;
        if (mode === "vecall"){
          strokes.splice(i, 1);             // the whole stroke, every copy
        } else if (mode === "vec"){
          s.hidden = s.hidden || [];        // this symmetric copy, whole
          if (s.hidden.indexOf(key) < 0) s.hidden.push(key);
          if (fullyErased(s)) strokes.splice(i, 1);
        } else {
          addCuts(s, key, hits, mode === "all");
          if (fullyErased(s)) strokes.splice(i, 1);
        }
        redraw();
        api.dirty();
        return; // topmost piece only, one bite per event
      }
    }
  }
}
// erases a filled area rather than a drawn line: traces the connected
// painted region under the cursor, then finds the topmost fill whose copy
// seed lands inside that region - works no matter where in the (possibly
// large) filled area you click, not just near where the fill was placed.
function eraseFillAt(nx, ny){
  const g = geom();
  const wx = g.cx + nx*g.sc, wy = g.cy + ny*g.sc;
  const [bx, by] = worldToBacking(wx, wy);
  const region = floodTraceRegion(bx, by);
  if (!region) return;
  for (let i = fills.length - 1; i >= 0; i--){
    const fl = fills[i];
    for (let k = 0; k < fl.sym; k++){
      for (const f of (fl.mir ? [1,-1] : [1])){
        const key = copyKey(k, f);
        if (fl.hidden && fl.hidden.indexOf(key) >= 0) continue;
        const an = Math.PI*2*k/fl.sym + (fl.rot||0), co = Math.cos(an), si = Math.sin(an);
        const cwx = g.cx + (fl.pt[0]*co - fl.pt[1]*f*si)*g.sc;
        const cwy = g.cy + (fl.pt[0]*si + fl.pt[1]*f*co)*g.sc;
        const [cbx, cby] = worldToBacking(cwx, cwy);
        if (!region.contains(cbx, cby)) continue;
        if (api.P.emode === "fillvecall"){
          fills.splice(i, 1); // the whole fill, every mirrored copy
        } else {
          fl.hidden = fl.hidden || [];
          if (fl.hidden.indexOf(key) < 0) fl.hidden.push(key);
          const total = fl.sym * (fl.mir ? 2 : 1);
          if (fl.hidden.length >= total) fills.splice(i, 1);
        }
        redraw();
        api.dirty();
        return; // topmost fill only, one bite per event
      }
    }
  }
}
// picks whatever's under the cursor - a stroke's line first (a narrow hit
// band around the actual path), falling back to a filled region if the
// click didn't land on any line - and recolors it to the current brush
// color. "one" only recolors the specific symmetric copy under the cursor
// (stored as a per-copy override so the rest of the piece is untouched);
// "all" recolors the whole stroke/fill, which covers every one of its
// copies at once since they already share a single .col field.
// pure hit-test (no mutation) so the same result can both drive the
// hover highlight drawn every frame AND the actual recolor on click.
function findRecolorTarget(nx, ny){
  const g = geom();
  const rad = api.P.size/g.sc + 2/g.sc;
  for (let i = strokes.length-1; i >= 0; i--){
    const s = strokes[i];
    for (let k = 0; k < s.sym; k++){
      for (const f of (s.mir ? [1,-1] : [1])){
        const key = copyKey(k, f);
        if (s.hidden && s.hidden.indexOf(key) >= 0) continue;
        if (copySegHits(s, k, f, nx, ny, rad).length) return { type:"stroke", s, k, f, key };
      }
    }
  }
  const wx = g.cx + nx*g.sc, wy = g.cy + ny*g.sc;
  const [bx, by] = worldToBacking(wx, wy);
  const region = floodTraceRegion(bx, by);
  if (!region) return null;
  for (let i = fills.length - 1; i >= 0; i--){
    const fl = fills[i];
    for (let k = 0; k < fl.sym; k++){
      for (const f of (fl.mir ? [1,-1] : [1])){
        const key = copyKey(k, f);
        if (fl.hidden && fl.hidden.indexOf(key) >= 0) continue;
        const an = Math.PI*2*k/fl.sym + (fl.rot||0), co = Math.cos(an), si = Math.sin(an);
        const cwx = g.cx + (fl.pt[0]*co - fl.pt[1]*f*si)*g.sc;
        const cwy = g.cy + (fl.pt[0]*si + fl.pt[1]*f*co)*g.sc;
        const [cbx, cby] = worldToBacking(cwx, cwy);
        if (region.contains(cbx, cby)) return { type:"fill", fl, k, f, key };
      }
    }
  }
  return null;
}
function applyRecolor(hit){
  if (!hit) return;
  const obj = hit.type === "stroke" ? hit.s : hit.fl;
  if (api.P.rmode === "all"){ obj.col = api.P.col; delete obj.colOverride; }
  else { obj.colOverride = obj.colOverride || {}; obj.colOverride[hit.key] = api.P.col; }
  redraw();
  api.dirty();
}
// highlights whatever a click would actually recolor - just the one
// symmetric copy findRecolorTarget picked out when in "This copy only"
// mode, or every one of that stroke/fill's copies when in "Whole piece"
// mode, so the highlight always previews the real outcome.
function drawRecolorHighlight(c, hit){
  const g = geom();
  const whole = api.P.rmode === "all";
  const obj = hit.type === "stroke" ? hit.s : hit.fl;
  const copies = whole
    ? Array.from({ length: obj.sym }, (_, k) => k).flatMap(k => obj.mir ? [[k,1],[k,-1]] : [[k,1]])
    : [[hit.k, hit.f]];
  c.save();
  c.strokeStyle = "rgba(255,255,255,.9)";
  for (const [k, f] of copies){
    const key = copyKey(k, f);
    if (obj.hidden && obj.hidden.indexOf(key) >= 0) continue;
    if (hit.type === "stroke"){
      const s = obj, an = Math.PI*2*k/s.sym + (s.rot||0), co = Math.cos(an), si = Math.sin(an);
      const toXY = p => [g.cx + (p[0]*co - p[1]*f*si)*g.sc, g.cy + (p[0]*si + p[1]*f*co)*g.sc];
      c.lineWidth = Math.max(3, s.size*g.sc + 6);
      c.lineCap = "round"; c.lineJoin = "round"; c.globalAlpha = .5;
      c.beginPath();
      const [x0, y0] = toXY(s.pts[0]);
      if (s.pts.length === 1) c.arc(x0, y0, c.lineWidth/2, 0, 7);
      else { c.moveTo(x0, y0); for (let i = 1; i < s.pts.length; i++){ const [x,y] = toXY(s.pts[i]); c.lineTo(x, y); } }
      c.stroke();
    } else {
      const fl = obj, an = Math.PI*2*k/fl.sym + (fl.rot||0), co = Math.cos(an), si = Math.sin(an);
      const wx = g.cx + (fl.pt[0]*co - fl.pt[1]*f*si)*g.sc, wy = g.cy + (fl.pt[0]*si + fl.pt[1]*f*co)*g.sc;
      c.lineWidth = 3; c.globalAlpha = .85;
      c.beginPath(); c.arc(wx, wy, 13, 0, 7); c.stroke();
    }
  }
  c.restore();
}
// ---- select-all / delete / rotate ---------------------------------------
// Selection is a single unit - the whole piece of art, every stroke and
// fill together - rather than a marquee-drag sub-selection.
function forEachCopyPoint(itemSym, itemMir, itemRot, hidden, basePts, cb){
  const g = geom();
  for (let k = 0; k < itemSym; k++){
    for (const f of (itemMir ? [1,-1] : [1])){
      if (hidden && hidden.indexOf(copyKey(k, f)) >= 0) continue;
      const an = Math.PI*2*k/itemSym + itemRot, co = Math.cos(an), si = Math.sin(an);
      for (const p of basePts)
        cb(g.cx + (p[0]*co - p[1]*f*si)*g.sc, g.cy + (p[0]*si + p[1]*f*co)*g.sc);
    }
  }
}
function recomputeSelBBox(){
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  const consider = (x, y) => { if (x<minx) minx=x; if (x>maxx) maxx=x; if (y<miny) miny=y; if (y>maxy) maxy=y; };
  for (const i of selection.strokes){
    const s = strokes[i]; if (!s) continue;
    forEachCopyPoint(s.sym, s.mir, s.rot||0, s.hidden, s.pts, consider);
  }
  for (const i of selection.fills){
    const fl = fills[i]; if (!fl) continue;
    forEachCopyPoint(fl.sym, fl.mir, fl.rot||0, fl.hidden, [fl.pt], consider);
  }
  selBBox = maxx < minx ? null : { x0:minx, y0:miny, x1:maxx, y1:maxy };
}
function selectAll(){
  selection = {
    strokes: new Set(strokes.map((_, i) => i)),
    fills: new Set(fills.map((_, i) => i)),
  };
  recomputeSelBBox();
}
function clearSelection(){ selection = { strokes:new Set(), fills:new Set() }; selBBox = null; rotBase = null; }
function getSelectionBBox(){ return selBBox; }
function deleteSelection(){
  if (!selection.strokes.size && !selection.fills.size) return;
  for (const i of [...selection.strokes].sort((a, b) => b-a)) strokes.splice(i, 1);
  for (const i of [...selection.fills].sort((a, b) => b-a)) fills.splice(i, 1);
  clearSelection();
  redraw();
  api.dirty();
}
// rotation is stored as a per-item angle OFFSET added into the same "an"
// used to render every mirrored copy, rather than rotating the stored
// points directly - "an" is applied as the last step, after the mirror
// flip, so nudging it spins every copy - both the direct and the mirrored
// half - the same way.
function rotateSelectionStart(){
  rotBase = {
    strokes: [...selection.strokes].map(i => ({ i, rot: strokes[i].rot || 0 })),
    fills: [...selection.fills].map(i => ({ i, rot: fills[i].rot || 0 })),
  };
}
function rotateSelectionPreview(delta){
  if (!rotBase) return;
  curRotDelta = delta;
  for (const { i, rot } of rotBase.strokes){ const s = strokes[i]; if (s) s.rot = rot + delta; }
  for (const { i, rot } of rotBase.fills){ const fl = fills[i]; if (fl) fl.rot = rot + delta; }
  recomputeSelBBox();
  redraw(true); // skip re-flooding fills while dragging - that's the expensive part, deferred to commit
}
function rotateSelectionCommit(){
  globalRot += curRotDelta; // also the baseline new strokes/fills adopt, and the angle readout's source
  curRotDelta = 0;
  rotBase = null;
  redraw(); // one full redraw, fills included, now that dragging has stopped
  api.dirty();
}
window.TOOL = {
  id:"snowflake", file:"snowflake.art",
  params:[
    { k:"tool", t:"icons", l:"", v:"brush", opts:[
      ["brush", '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/></svg>', "Brush"],
      ["eraser", '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>', "Eraser"],
      ["fill", '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/></svg>', "Fill"],
      ["recolor", '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><circle cx="18" cy="18" r="3" fill="currentColor" stroke="none"/></svg>', "Recolor"],
    ]},
    { k:"emode", t:"select", l:"Erase", v:"one", tool:"eraser", opts:[
      ["one","Trim this piece"],["all","Trim all pieces"],["vec","Whole piece"],["vecall","Whole stroke"],
      ["fillvec","Erase fill (this part)"],["fillvecall","Erase fill (all parts)"],
    ] },
    { k:"esize", t:"range",  l:"Eraser",   min:1, max:100, step:1, v:8, u:"px", tool:"eraser" },
    { k:"rmode", t:"select", l:"Recolor", v:"one", tool:"recolor", opts:[
      ["one","This copy only"],["all","Whole piece (all copies)"],
    ] },
    { k:"fmode", t:"select", l:"Fill", v:"all", tool:"fill", opts:[
      ["all","All pieces (mirrored)"],["one","This piece only"],
    ] },
    { k:"col",  t:"color",  l:"Color",    v:"#cfe9ff" },
    { k:"mir",  t:"toggle", l:"Mirror",   v:true },
    { k:"sym",  t:"range",  l:"Symmetry", min:1, max:24, step:1, v:6, tool:"brush" },
    { k:"size", t:"range",  l:"Brush",    min:1, max:24, step:1, v:4, u:"px", tool:"brush" },
  ],
  init(a){ api = a; },
  onParam(k){ if (k === "tool") api.syncCursor(); },
  pointer(type, x, y){
    cursor = [x, y];
    const g = geom(), n = [(x-g.cx)/g.sc, (y-g.cy)/g.sc];
    if (api.P.tool === "eraser"){
      if (type === "down") this._er = true;
      if (type === "up"){ this._er = false; return; }
      if (this._er){
        if (api.P.emode === "fillvec" || api.P.emode === "fillvecall") eraseFillAt(n[0], n[1]);
        else eraseAt(n[0], n[1]);
      }
      return;
    }
    if (api.P.tool === "fill"){
      if (type === "down"){
        const cn = toCanonical(n);
        // "one" reuses the same sym:1/mir:false shape a lone non-mirrored
        // stroke would use, so applyFills only ever paints this single copy
        const one = api.P.fmode === "one";
        growForPoint(cn, one ? 1 : api.P.sym, one ? false : api.P.mir, globalRot);
        fills.push({ pt:cn, col:api.P.col, sym:one ? 1 : api.P.sym, mir:one ? false : api.P.mir, rot:globalRot });
        redraw();
        api.dirty();
      }
      return;
    }
    if (api.P.tool === "recolor"){
      if (type === "up"){ this._rcDown = false; return; }
      if (type === "down") this._rcDown = true;
      recolorHover = findRecolorTarget(n[0], n[1]); // recomputed every move, so the highlight tracks the cursor live
      if (this._rcDown) applyRecolor(recolorHover);
      return;
    }
    if (type === "down"){
      const cn = toCanonical(n);
      live = { pts:[cn], col:api.P.col, size:api.P.size/g.sc, sym:api.P.sym, mir:api.P.mir, rot:globalRot };
      growForPoint(cn, live.sym, live.mir, globalRot);
      liveSeg(cn, cn, live);
    } else if (type === "move" && live){
      const p = live.pts[live.pts.length-1];
      const cn = toCanonical(n);
      if (Math.hypot(cn[0]-p[0], cn[1]-p[1]) < 0.002) return;
      live.pts.push(cn);
      growForPoint(cn, live.sym, live.mir, globalRot);
      liveSeg(p, cn, live);
    } else if (type === "up" && live){
      strokes.push(live);
      freeze = { s:live, t:0 }; // the "freeze" shimmer plays on whatever stroke you just finished
      live = null;
      api.dirty();
    }
  },
  frame(dt){ if (freeze && (freeze.t += dt) > 1.4) freeze = null; },
  overlay(c){
    if (freeze){ // the "freeze" shimmer: a white echo that swells and fades
      const g = geom(), a = 1 - freeze.t/1.4;
      c.strokeStyle = "rgba(255,255,255," + (a*.8).toFixed(3) + ")";
      c.lineWidth = Math.max(1, freeze.s.size*g.sc*(1 + freeze.t*1.6));
      c.lineCap = "round"; c.lineJoin = "round";
      for (let k = 0; k < freeze.s.sym; k++)
        for (const f of (freeze.s.mir ? [1,-1] : [1])){
          const pts = freeze.s.pts;
          if (pts.length === 1) drawCopySeg(c, freeze.s, k, f, pts[0], pts[0]);
          else for (let i = 1; i < pts.length; i++) drawCopySeg(c, freeze.s, k, f, pts[i-1], pts[i]);
        }
    }
    if (api.P.tool === "eraser" && cursor && !api.selectMode){
      // the ring's border is a fixed width in *screen* pixels (divided by
      // zoom to cancel out the overlay's own zoom scale) rather than a fixed
      // width in world units, so it never balloons at a small eraser size or
      // thins to invisible at a large one, like a crisp SVG icon at any size.
      const z = api.zoom || 1;
      c.strokeStyle = "rgba(255,110,130,.85)";
      c.lineWidth = 1.5/z; c.setLineDash([4/z, 4/z]);
      c.beginPath(); c.arc(cursor[0], cursor[1], api.P.esize, 0, 7); c.stroke();
      c.setLineDash([]);
    }
    if (api.P.tool === "fill" && cursor && !api.selectMode){
      // a small paint-bucket glyph (same path data as the toolbar icon)
      // replaces the plain crosshair while Fill is the active tool, so it's
      // obvious at a glance which tool is armed - the drip is tinted with
      // the color about to be applied, same live-preview trick as recolor's
      // dot below. Fixed on-screen size (divided by zoom), same as above.
      const z = api.zoom || 1;
      c.save();
      c.translate(cursor[0], cursor[1]);
      c.scale(0.8/z, 0.8/z);
      c.translate(-12, -11);
      c.lineWidth = 2; c.lineJoin = "round"; c.lineCap = "round";
      c.fillStyle = "rgba(21,21,33,.92)"; c.strokeStyle = "#fff";
      c.stroke(new Path2D("m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"));
      c.fill(new Path2D("m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"));
      c.stroke(new Path2D("m5 2 5 5"));
      c.stroke(new Path2D("M2 13h15"));
      const drip = new Path2D("M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z");
      c.fillStyle = api.P.col; c.fill(drip);
      c.lineWidth = 1.2; c.strokeStyle = "rgba(255,255,255,.9)"; c.stroke(drip);
      c.restore();
    }
    if (api.P.tool === "recolor" && cursor && !api.selectMode){
      if (recolorHover) drawRecolorHighlight(c, recolorHover);
      // the cursor itself is a pointer-arrow-plus-dot glyph, matching this
      // tool's own sidebar icon, filled with the color about to be applied.
      const z = api.zoom || 1;
      c.save();
      c.translate(cursor[0], cursor[1]);
      c.scale(1/z, 1/z);
      c.beginPath();
      c.moveTo(0, 0); c.lineTo(7.07, 16.97); c.lineTo(9.58, 9.58); c.lineTo(16.97, 7.07); c.closePath();
      c.fillStyle = "rgba(21,21,33,.92)"; c.strokeStyle = "#fff"; c.lineWidth = 1.6;
      c.fill(); c.stroke();
      c.beginPath(); c.arc(15, 15, 3, 0, 7);
      c.fillStyle = api.P.col; c.fill();
      c.lineWidth = 1.2; c.strokeStyle = "rgba(255,255,255,.9)"; c.stroke();
      c.restore();
    }
    const bbox = getSelectionBBox();
    if (bbox){
      const pad = 14;
      c.save();
      c.strokeStyle = "rgba(120,170,255,.9)";
      c.fillStyle = "rgba(120,170,255,.08)";
      c.lineWidth = 1.4; c.setLineDash([7, 5]);
      c.beginPath();
      c.rect(bbox.x0 - pad, bbox.y0 - pad, (bbox.x1-bbox.x0) + pad*2, (bbox.y1-bbox.y0) + pad*2);
      c.fill(); c.stroke();
      c.restore();
    }
  },
  clear(){ strokes = []; fills = []; live = null; freeze = null; globalRot = 0; curRotDelta = 0; recolorHover = null; clearSelection(); api.clearWorld(); },
  serialize(){
    // strip runtime Sets; keep pts + cuts (the editable "layers")
    return { globalRot, strokes: strokes.map(s => ({
      pts:s.pts, col:s.col, size:s.size, sym:s.sym, mir:s.mir, rot:s.rot||0,
      hidden:s.hidden, cuts:s.cuts, cutAll:s.cutAll, colOverride:s.colOverride,
    })), fills: fills.map(f => ({
      pt:f.pt, col:f.col, sym:f.sym, mir:f.mir, rot:f.rot||0, hidden:f.hidden, colOverride:f.colOverride,
    })) };
  },
  restore(s){
    strokes = ((s && s.strokes) || []).map(st => ({
      pts:st.pts, col:st.col, size:st.size,
      sym: st.sym != null ? st.sym : 6,  // old saves predate adjustable symmetry - default to the classic 6-fold
      mir: st.mir != null ? st.mir : true,
      rot: st.rot || 0,
      hidden:st.hidden, cuts:st.cuts, cutAll:st.cutAll, colOverride:st.colOverride,
    }));
    fills = (s && s.fills) || [];
    globalRot = (s && s.globalRot) || 0;
    curRotDelta = 0;
    live = null; freeze = null; recolorHover = null; clearSelection(); redraw();
  },
  selectAll, getSelectionBBox, clearSelection, deleteSelection,
  rotateSelectionStart, rotateSelectionPreview, rotateSelectionCommit,
  getGlobalRot: () => globalRot,
};
})();

/* ArtzLoop core runtime - canonical copy lives in shared/tool-core.js.
 * Owns: floating tool panel, camera (pan/zoom over an auto-growing "infinite"
 * world canvas), black/white background, undo/redo history, download/upload
 * (.art), localStorage autosave + resume, generative music, tool-grid popup.
 * The tool supplies window.TOOL (id, file, params, init, pointer, frame,
 * overlay, clear, serialize, restore, onParam, bgChanged, pixelated). */
(function(){
const T = window.TOOL;
const $ = id => document.getElementById(id);
const APP_VERSION = "2.3.0";
const KEY_AUTO = "artzloop." + T.id + ".autosave";
const KEY_BG = "artzloop.bg", KEY_MUTE = "artzloop.muted", KEY_TRACK = "artzloop.track";
const KEY_PANEL = "artzloop.panel";
const BGCOL = { dark:"#0b0b13", light:"#f6f4ef" };
const BACKING_MAX = 200e6; // max world backing pixels (~800MB RGBA) - well under real browsers' canvas-area limits
const DIM_MAX = 14000; // max single backing dimension - keeps a very elongated (non-square) drawing under real browsers' per-axis canvas limits even though its area alone is still under BACKING_MAX

let bgMode = localStorage.getItem(KEY_BG) === "light" ? "light" : "dark";
let gridOn = localStorage.getItem("artzloop.grid") !== "0";
let dirtyFlag = false;

/* ---- world canvas: grows on demand as you draw past its edges ---------- */
const screen = $("screen"), sctx = screen.getContext("2d");
let W, H;                       // "home" rect size (initial viewport)
let world, wctx, wdpr;          // backing store + its pixel ratio
let wx0 = 0, wy0 = 0, WW = 0, WH = 0; // world-rect the backing covers
let camX = 0, camY = 0, zoom = 1;     // camera: world point at screen center

function fitScreen(){
  const r = screen.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  screen.width = Math.round(r.width * dpr);
  screen.height = Math.round(r.height * dpr);
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function worldTransform(){
  wctx.setTransform(wdpr, 0, 0, wdpr, -wx0*wdpr, -wy0*wdpr);
}
function rebuildWorld(nx0, ny0, nW, nH){
  let nd = wdpr;
  if (nW*nH*nd*nd > BACKING_MAX) nd = 1;
  if (nW*nH*nd*nd > BACKING_MAX) return false; // hard cap reached
  if (nW*nd > DIM_MAX || nH*nd > DIM_MAX) return false; // a single axis alone would exceed the browser's real canvas limit
  const nc = document.createElement("canvas");
  nc.width = Math.round(nW*nd);
  nc.height = Math.round(nH*nd);
  const nctx = nc.getContext("2d");
  nctx.setTransform(nd, 0, 0, nd, -nx0*nd, -ny0*nd);
  nctx.drawImage(world, wx0, wy0, WW, WH); // old content, logical coords
  world = nc; wctx = nctx; wdpr = nd;
  wx0 = nx0; wy0 = ny0; WW = nW; WH = nH;
  return true;
}
function ensureVisible(x, y){
  const pad = 120, chunk = 900;
  let nx0 = wx0, ny0 = wy0, nx1 = wx0 + WW, ny1 = wy0 + WH, grow = false;
  if (x < nx0 + pad){ nx0 = Math.floor(x - chunk); grow = true; }
  if (y < ny0 + pad){ ny0 = Math.floor(y - chunk); grow = true; }
  if (x > nx1 - pad){ nx1 = Math.ceil(x + chunk); grow = true; }
  if (y > ny1 - pad){ ny1 = Math.ceil(y + chunk); grow = true; }
  if (grow) rebuildWorld(nx0, ny0, nx1 - nx0, ny1 - ny0);
}

/* ---- undo / redo ------------------------------------------------------ */
let history = [], hIdx = -1, restoring = false, settleTimer = null;
function urButtons(){
  $("undoBtn").disabled = hIdx <= 0;
  $("redoBtn").disabled = hIdx >= history.length - 1;
}
function snapshot(){
  if (restoring) return;
  let s;
  try { s = JSON.stringify(T.serialize()); } catch (e){ return; }
  if (s === history[hIdx]) return;
  history.splice(hIdx + 1);
  history.push(s);
  if (history.length > 24) history.shift();
  hIdx = history.length - 1;
  urButtons();
}
function scheduleSnapshot(){
  clearTimeout(settleTimer);
  settleTimer = setTimeout(snapshot, 350);
}
function resetHistory(){
  clearTimeout(settleTimer);
  history = []; hIdx = -1;
  snapshot();
}
function applyHistory(){
  restoring = true;
  try { T.restore(JSON.parse(history[hIdx])); }
  finally { restoring = false; }
  dirtyFlag = true;
  urButtons();
}
function doUndo(){ if (hIdx > 0){ hIdx--; applyHistory(); } }
function doRedo(){ if (hIdx < history.length - 1){ hIdx++; applyHistory(); } }
$("undoBtn").onclick = doUndo;
$("redoBtn").onclick = doRedo;
window.addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === "z" && !e.shiftKey){ e.preventDefault(); doUndo(); }
  else if (k === "y" || (k === "z" && e.shiftKey)){ e.preventDefault(); doRedo(); }
});

/* ---- parameter controls --------------------------------------------- */
const PV = {}, setters = {};
let onToolSwitch = null; // no-op here - this tool manages its own eraser cursor via overlay(), not screen.style.cursor
// Every param renders inline in the sidebar EXCEPT ones tagged with a
// `tool:"<key>"` field matching one of the tool-switcher's own option keys -
// those live in a small popup that opens off that specific tool icon (e.g.
// Symmetry + Brush size behind the Brush icon, Erase mode + Eraser size
// behind the Eraser icon), the same pattern a tool would hand-roll itself,
// just declarative. Untagged controls (Mirror, ...) stay visible in the
// sidebar by default - there's no generic catch-all settings dump.
function buildControls(){
  const host = $("controls");
  // every param's value goes live in PV immediately, even ones whose DOM
  // control is built lazily inside a tool popup - a param a tool reads every
  // frame (brush size, symmetry, ...) must never be undefined just because
  // nobody has opened that tool's popup yet. Only the DOM element itself is
  // deferred; the value always exists.
  for (const p of T.params) if (p.t !== "button") PV[p.k] = p.v;
  const toolParam = T.params.find(p => p.k === "tool" && p.t === "icons");
  const byTool = {};
  for (const p of T.params){
    if (p === toolParam || p.t === "color") continue;
    if (toolParam && p.tool && toolParam.opts.some(o => o[0] === p.tool))
      (byTool[p.tool] = byTool[p.tool] || []).push(p);
  }
  if (toolParam) buildToolIcons(host, toolParam, byTool);
  // color comes right after the tool icons, then every remaining untagged
  // control (Mirror, ...) in its declared order - a fixed reading order
  // every tool shares: tools, color, on/off extras.
  for (const p of T.params) if (p.t === "color") buildOneControl(host, p);
  for (const p of T.params){
    if (p === toolParam || p.t === "color") continue;
    if (toolParam && p.tool && byTool[p.tool] && byTool[p.tool].includes(p)) continue; // rendered in its tool's popup instead
    buildOneControl(host, p);
  }
}
// wires one tool icon's popup: params tagged for that tool build inside a
// shared floating panel that opens off the icon. Clicking a tool icon both
// switches the active tool (as always) and opens/updates that popup;
// clicking the already-open tool's icon again closes it.
function buildToolIcons(host, p, byTool){
  PV[p.k] = p.v;
  const lab = document.createElement("label"); lab.className = "ctl"; lab.dataset.key = p.k;
  if (p.l){
    const cap = document.createElement("span"); cap.textContent = p.l;
    lab.appendChild(cap);
  }
  const wrap = document.createElement("div"); wrap.className = "iconrow";
  const btns = {};
  const mark = () => { for (const v in btns) btns[v].classList.toggle("active", PV[p.k] === v); };
  const pop = document.createElement("div");
  pop.className = "toolpop";
  document.body.appendChild(pop);
  let openKey = null;
  function position(anchor){
    const r = anchor.getBoundingClientRect(), pr = pop.getBoundingClientRect();
    let x = r.left - pr.width - 12;
    if (x < 8) x = Math.min(window.innerWidth - pr.width - 8, r.right + 12);
    const y = Math.max(8, Math.min(window.innerHeight - pr.height - 8, r.top - pr.height/2 + r.height/2));
    pop.style.left = x + "px"; pop.style.top = y + "px";
  }
  function closePop(){ pop.classList.remove("show"); openKey = null; }
  function openPopFor(key, anchor){
    const params = byTool[key];
    if (!params || !params.length){ closePop(); return; }
    if (openKey === key && pop.classList.contains("show")){ closePop(); return; }
    pop.innerHTML = "";
    for (const gp of params) buildOneControl(pop, gp);
    openKey = key;
    pop.classList.add("show");
    position(anchor);
  }
  for (const o of p.opts){
    const b = document.createElement("button"); b.type = "button"; b.className = "ibtn";
    b.innerHTML = o[1].replace(/width="19" height="19"/, 'width="15" height="15"'); b.title = o[2] || o[0];
    b.dataset.key = p.k + ":" + o[0];
    b.onclick = () => {
      PV[p.k] = o[0]; mark();
      if (T.onParam) T.onParam(p.k, o[0]);
      if (onToolSwitch) onToolSwitch();
      openPopFor(o[0], b);
    };
    btns[o[0]] = b; wrap.appendChild(b);
  }
  mark();
  lab.appendChild(wrap);
  setters[p.k] = () => mark();
  host.appendChild(lab);
  window.addEventListener("pointerdown", e => {
    if (!pop.classList.contains("show")) return;
    if (!pop.contains(e.target) && !wrap.contains(e.target)) closePop();
  });
  window.addEventListener("resize", () => { if (openKey) position(btns[openKey]); });
}
function buildOneControl(host, p){
    if (p.t === "button"){
      const b = document.createElement("button");
      b.className = "chip"; b.textContent = p.l;
      b.onclick = () => p.fn();
      host.appendChild(b); return;
    }
    // the value may already be live in PV (buildControls initializes every
    // param up front) and may already differ from p.v's static default - a
    // deferred/lazily-built control (behind a tool popup) must pick up
    // wherever the value currently is, not reset it back to the default.
    if (!(p.k in PV)) PV[p.k] = p.v;
    const cur = PV[p.k];
    const lab = document.createElement("label"); lab.className = "ctl"; lab.dataset.key = p.k;
    if (p.l){
      const cap = document.createElement("span");
      cap.textContent = p.l + (p.u ? " (" + p.u + ")" : "");
      lab.appendChild(cap);
    }
    if (p.t === "range"){
      const wrap = document.createElement("span"); wrap.className = "stepper";
      const dec = document.createElement("button"); dec.type = "button"; dec.className = "step"; dec.textContent = "−";
      const inp = document.createElement("input"); inp.type = "number";
      inp.min = p.min; inp.max = p.max; inp.step = p.step || 1; inp.value = cur;
      const inc = document.createElement("button"); inc.type = "button"; inc.className = "step"; inc.textContent = "+";
      const st = p.step || 1;
      const commit = v => {
        if (isNaN(v)) v = p.v;
        v = Math.max(p.min, Math.min(p.max, Math.round(v/st)*st));
        if (st < 1) v = +v.toFixed(2);
        inp.value = v; PV[p.k] = v;
        if (T.onParam) T.onParam(p.k, v);
      };
      dec.onclick = () => commit(+inp.value - st);
      inc.onclick = () => commit(+inp.value + st);
      inp.addEventListener("change", () => commit(+inp.value));
      wrap.appendChild(dec); wrap.appendChild(inp); wrap.appendChild(inc);
      lab.appendChild(wrap);
      setters[p.k] = v => { inp.value = v; };
    } else if (p.t === "color"){
      const sw = document.createElement("button"); sw.type = "button"; sw.className = "swatch";
      sw.style.background = cur;
      const i = document.createElement("input"); i.type = "color"; i.value = cur; i.className = "hiddenpick";
      i.addEventListener("input", () => { PV[p.k] = i.value; sw.style.background = i.value; if (T.onParam) T.onParam(p.k, i.value); });
      sw.onclick = () => openPalette(sw, i);
      lab.appendChild(sw); lab.appendChild(i);
      setters[p.k] = v => { i.value = v; sw.style.background = v; };
    } else if (p.t === "icons"){
      const wrap = document.createElement("div"); wrap.className = "iconrow";
      const btns = {};
      const mark = () => { for (const v in btns) btns[v].classList.toggle("active", PV[p.k] === v); };
      for (const o of p.opts){
        const b = document.createElement("button"); b.type = "button"; b.className = "ibtn";
        b.innerHTML = o[1].replace(/width="19" height="19"/, 'width="15" height="15"'); b.title = o[2] || o[0];
        b.dataset.key = p.k + ":" + o[0];
        b.onclick = () => { PV[p.k] = o[0]; mark(); if (T.onParam) T.onParam(p.k, o[0]); };
        btns[o[0]] = b; wrap.appendChild(b);
      }
      mark();
      lab.appendChild(wrap);
      setters[p.k] = () => mark();
    } else if (p.t === "toggle"){
      const w = document.createElement("span"); w.className = "switch";
      const i = document.createElement("input"); i.type = "checkbox"; i.checked = !!cur;
      const k = document.createElement("span"); k.className = "knob";
      w.appendChild(i); w.appendChild(k);
      i.addEventListener("change", () => { PV[p.k] = i.checked; if (T.onParam) T.onParam(p.k, i.checked); });
      lab.appendChild(w);
      setters[p.k] = v => { i.checked = !!v; };
    } else if (p.t === "select"){
      const s = document.createElement("select");
      for (const [v, l] of p.opts){
        const o = document.createElement("option"); o.value = v; o.textContent = l;
        s.appendChild(o);
      }
      s.value = cur;
      s.addEventListener("change", () => { PV[p.k] = s.value; if (T.onParam) T.onParam(p.k, s.value); });
      lab.appendChild(s);
      setters[p.k] = v => { s.value = v; };
    }
    host.appendChild(lab);
}
function applyParams(vals){
  for (const k in vals) if (k in PV){ PV[k] = vals[k]; if (setters[k]) setters[k](vals[k]); }
  if (T.onParam) for (const k in vals) if (k in PV) T.onParam(k, PV[k]);
  if ("tool" in vals && onToolSwitch) onToolSwitch();
}

/* ---- shared color palette popup - presets + a built-in HSV picker ------
 * (no native <input type=color> dialog: those are OS-styled, inconsistent
 * across platforms, and impossible to skin - drawing our own keeps the
 * whole flow on-brand) */
const PAL_COLORS = ["#000000","#7f7f7f","#880015","#ed1c24","#ff7f27","#fff200","#22b14c","#00a2e8",
  "#3f48cc","#a349a4","#ffffff","#c3c3c3","#b97a57","#ffaec9","#ffc90e","#efe4b0"];
const PAL_BRAND = ["#5ee6ff","#6d7cff","#3fd8d0","#f4c542","#cfe9ff"]; // ArtzLoop accents
function hsv2rgb(h, s, v){
  const c = v*s, x = c*(1 - Math.abs((h/60)%2 - 1)), m = v - c;
  let r, g, b;
  if (h < 60){ r=c; g=x; b=0; } else if (h < 120){ r=x; g=c; b=0; }
  else if (h < 180){ r=0; g=c; b=x; } else if (h < 240){ r=0; g=x; b=c; }
  else if (h < 300){ r=x; g=0; b=c; } else { r=c; g=0; b=x; }
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
}
function rgb2hsv(r, g, b){
  r/=255; g/=255; b/=255;
  const mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx - mn;
  let h = 0;
  if (d){ if (mx===r) h = 60*(((g-b)/d)%6); else if (mx===g) h = 60*((b-r)/d+2); else h = 60*((r-g)/d+4); }
  if (h < 0) h += 360;
  return { h, s: mx ? d/mx : 0, v: mx };
}
function rgb2hex(r, g, b){ return "#" + [r,g,b].map(n => n.toString(16).padStart(2,"0")).join(""); }
function hex2rgb(hex){ const n = parseInt(hex.slice(1), 16); return [(n>>16)&255, (n>>8)&255, n&255]; }

const palette = document.createElement("div");
palette.id = "palette";
let palPick = null, palAnchor = null;
const palCur = document.createElement("div"); palCur.className = "palCur";
const palCurSw = document.createElement("span"); palCurSw.className = "palCurSw";
const palCurHex = document.createElement("span"); palCurHex.className = "palCurHex";
palCur.appendChild(palCurSw); palCur.appendChild(palCurHex);
palette.appendChild(palCur);
function addSwatch(col){
  const b = document.createElement("button");
  b.type = "button"; b.className = "pcol"; b.style.background = col; b.title = col;
  b.onclick = () => {
    if (palPick){ palPick.value = col; palPick.dispatchEvent(new Event("input")); }
    for (const o of palette.querySelectorAll(".pcol")) o.classList.remove("sel");
    b.classList.add("sel");
    pcustom.classList.remove("show"); palMore.classList.remove("active");
    palette.classList.remove("show");
  };
  palette.appendChild(b);
}
for (const col of PAL_COLORS) addSwatch(col);
const palLabel = document.createElement("div");
palLabel.className = "palLabel"; palLabel.textContent = "ArtzLoop";
palette.appendChild(palLabel);
for (const col of PAL_BRAND) addSwatch(col);

const palMore = document.createElement("button");
palMore.type = "button"; palMore.className = "pmore";
palMore.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="7.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="16.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="16.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="7.5" cy="12" r="1.3" fill="currentColor" stroke="none"/></svg><span>Custom color</span>';
palette.appendChild(palMore);

const pcustom = document.createElement("div"); pcustom.className = "pcustom";
const svCanvas = document.createElement("canvas"); svCanvas.className = "svCanvas"; svCanvas.width = 122; svCanvas.height = 78;
const hueCanvas = document.createElement("canvas"); hueCanvas.className = "hueCanvas"; hueCanvas.width = 122; hueCanvas.height = 12;
const hexRow = document.createElement("div"); hexRow.className = "hexRow";
const hexPre = document.createElement("span"); hexPre.className = "hexPre"; hexPre.textContent = "#";
const hexInput = document.createElement("input"); hexInput.type = "text"; hexInput.maxLength = 6;
hexInput.className = "hexInput"; hexInput.spellcheck = false; hexInput.autocomplete = "off";
hexRow.appendChild(hexPre); hexRow.appendChild(hexInput);
pcustom.appendChild(svCanvas); pcustom.appendChild(hueCanvas); pcustom.appendChild(hexRow);
palette.appendChild(pcustom);
document.body.appendChild(palette);

const svCtx = svCanvas.getContext("2d"), hueCtx = hueCanvas.getContext("2d");
let curH = 195, curS = .6, curV = .95;
function drawHue(){
  const g = hueCtx.createLinearGradient(0, 0, hueCanvas.width, 0);
  for (let i = 0; i <= 6; i++) g.addColorStop(i/6, "hsl(" + (i*60) + ",100%,50%)");
  hueCtx.fillStyle = g; hueCtx.fillRect(0, 0, hueCanvas.width, hueCanvas.height);
  const x = Math.max(1.5, Math.min(hueCanvas.width - 1.5, curH/360*hueCanvas.width));
  hueCtx.strokeStyle = "#fff"; hueCtx.lineWidth = 2;
  hueCtx.strokeRect(x - 1.5, .5, 3, hueCanvas.height - 1);
}
function drawSV(){
  const w = svCanvas.width, h = svCanvas.height;
  const [r, g, b] = hsv2rgb(curH, 1, 1);
  svCtx.fillStyle = "rgb(" + r + "," + g + "," + b + ")"; svCtx.fillRect(0, 0, w, h);
  let lg = svCtx.createLinearGradient(0, 0, w, 0);
  lg.addColorStop(0, "#fff"); lg.addColorStop(1, "rgba(255,255,255,0)");
  svCtx.fillStyle = lg; svCtx.fillRect(0, 0, w, h);
  let dg = svCtx.createLinearGradient(0, 0, 0, h);
  dg.addColorStop(0, "rgba(0,0,0,0)"); dg.addColorStop(1, "#000");
  svCtx.fillStyle = dg; svCtx.fillRect(0, 0, w, h);
  const px = curS*w, py = (1 - curV)*h;
  svCtx.beginPath(); svCtx.arc(px, py, 5, 0, 7);
  svCtx.strokeStyle = "#fff"; svCtx.lineWidth = 2; svCtx.stroke();
  svCtx.beginPath(); svCtx.arc(px, py, 5.5, 0, 7);
  svCtx.strokeStyle = "rgba(0,0,0,.45)"; svCtx.lineWidth = 1; svCtx.stroke();
}
function applyCustom(fromHex){
  const [r, g, b] = hsv2rgb(curH, curS, curV);
  const hex = rgb2hex(r, g, b);
  if (palPick){ palPick.value = hex; palPick.dispatchEvent(new Event("input")); }
  palCurSw.style.background = hex;
  palCurHex.textContent = hex;
  if (!fromHex) hexInput.value = hex.slice(1);
  for (const o of palette.querySelectorAll(".pcol")) o.classList.toggle("sel", o.title.toLowerCase() === hex);
}
let svDrag = false, hueDrag = false;
function svPick(e){
  const r = svCanvas.getBoundingClientRect();
  curS = Math.max(0, Math.min(1, (e.clientX - r.left)/r.width));
  curV = 1 - Math.max(0, Math.min(1, (e.clientY - r.top)/r.height));
  drawSV(); applyCustom();
}
function huePick(e){
  const r = hueCanvas.getBoundingClientRect();
  curH = Math.max(0, Math.min(359.999, (e.clientX - r.left)/r.width*360));
  drawHue(); drawSV(); applyCustom();
}
svCanvas.addEventListener("pointerdown", e => { svDrag = true; svCanvas.setPointerCapture(e.pointerId); svPick(e); });
svCanvas.addEventListener("pointermove", e => { if (svDrag) svPick(e); });
svCanvas.addEventListener("pointerup", () => svDrag = false);
hueCanvas.addEventListener("pointerdown", e => { hueDrag = true; hueCanvas.setPointerCapture(e.pointerId); huePick(e); });
hueCanvas.addEventListener("pointermove", e => { if (hueDrag) huePick(e); });
hueCanvas.addEventListener("pointerup", () => hueDrag = false);
hexInput.addEventListener("input", () => {
  hexInput.value = hexInput.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
  if (hexInput.value.length === 6){
    const [r, g, b] = hex2rgb("#" + hexInput.value);
    const hsv = rgb2hsv(r, g, b);
    curH = hsv.h; curS = hsv.s; curV = hsv.v;
    drawHue(); drawSV(); applyCustom(true);
  }
});
hexInput.addEventListener("blur", () => {
  if (hexInput.value.length !== 6) hexInput.value = rgb2hex.apply(null, hsv2rgb(curH, curS, curV)).slice(1);
});

function repositionPalette(){
  if (!palAnchor) return;
  const r = palAnchor.getBoundingClientRect(), pr = palette.getBoundingClientRect();
  let x = r.left - pr.width - 12; // beside the panel, flipping if cramped
  if (x < 8) x = Math.min(window.innerWidth - pr.width - 8, r.right + 12);
  const y = Math.max(8, Math.min(window.innerHeight - pr.height - 8, r.top - pr.height/2 + r.height/2));
  palette.style.left = x + "px";
  palette.style.top = y + "px";
}
palMore.onclick = () => {
  const showing = pcustom.classList.toggle("show");
  palMore.classList.toggle("active", showing);
  if (showing){
    const cur = (palPick && palPick.value) || "#5ee6ff";
    const [r, g, b] = hex2rgb(cur);
    const hsv = rgb2hsv(r, g, b);
    curH = hsv.h; curS = hsv.s || 0; curV = hsv.v || 1;
    hexInput.value = cur.slice(1);
    drawHue(); drawSV();
  }
  repositionPalette();
};
function openPalette(anchor, input){
  if (palAnchor === anchor && palette.classList.contains("show")){ palette.classList.remove("show"); return; } // second click on the same swatch toggles it shut
  palPick = input; palAnchor = anchor;
  pcustom.classList.remove("show"); palMore.classList.remove("active");
  const cur = (input.value || "").toLowerCase();
  palCurSw.style.background = cur;
  palCurHex.textContent = cur;
  for (const b of palette.querySelectorAll(".pcol"))
    b.classList.toggle("sel", b.title.toLowerCase() === cur);
  palette.classList.add("show");
  repositionPalette();
}
window.addEventListener("pointerdown", e => {
  if (!palette.contains(e.target) && !e.target.classList.contains("swatch"))
    palette.classList.remove("show");
});

/* ---- api handed to the tool ------------------------------------------ */
const api = {
  get W(){ return W; }, get H(){ return H; },
  get ctx(){ return wctx; }, get world(){ return world; },
  get selectMode(){ return selectMode; }, // true while the runtime's own drag-select is active
  get zoom(){ return zoom; }, // lets a tool keep an overlay's on-screen stroke width constant across zoom levels
  P: PV,
  bg: () => bgMode,
  ink: () => bgMode === "dark" ? "#eceaf6" : "#20202c",
  grow(x, y){ ensureVisible(x, y); }, // let tools extend the world beyond the pointer
  dirty(){ dirtyFlag = true; scheduleSnapshot(); },
  clearWorld(){
    wctx.save(); wctx.setTransform(1,0,0,1,0,0);
    wctx.clearRect(0, 0, world.width, world.height);
    wctx.restore();
  },
  toDataURL(){ return world.toDataURL("image/png"); },
  drawDataURL(url, cb){
    const im = new Image();
    im.onload = () => { wctx.drawImage(im, 0, 0, W, H); if (cb) cb(); };
    im.src = url;
  },
  // re-derives the cursor from the now-current tool - called whenever the
  // "tool" param changes, from the tool-specific onParam() below, since
  // toolCursor()/panMode/screen all live in this closure, not that one.
  syncCursor(){ screen.style.cursor = (panMode || spaceHeld) ? "grab" : toolCursor(); },
};

/* ---- camera / blit ----------------------------------------------------- */
function viewSize(){
  const r = screen.getBoundingClientRect();
  return { vw:r.width, vh:r.height };
}
// faint grid guide - fixed on-screen spacing that never changes with zoom
// (only the pan offset shifts it); purely a framing aid, never saved/exported.
function drawGrid(v){
  if (!gridOn) return;
  const cell = 44; // matches the shared framing-grid constant used by every other tool
  sctx.strokeStyle = bgMode === "dark" ? "rgba(255,255,255,.06)" : "rgba(20,20,44,.075)";
  sctx.lineWidth = 1;
  sctx.beginPath();
  const ox = ((v.vw/2 - camX*zoom) % cell + cell) % cell;
  for (let sx = ox; sx <= v.vw; sx += cell){
    const px = Math.round(sx) + .5;
    sctx.moveTo(px, 0); sctx.lineTo(px, v.vh);
  }
  const oy = ((v.vh/2 - camY*zoom) % cell + cell) % cell;
  for (let sy = oy; sy <= v.vh; sy += cell){
    const py = Math.round(sy) + .5;
    sctx.moveTo(0, py); sctx.lineTo(v.vw, py);
  }
  sctx.stroke();
}
function blit(){
  const v = viewSize();
  sctx.fillStyle = BGCOL[bgMode];
  sctx.fillRect(0, 0, v.vw, v.vh);
  drawGrid(v);
  sctx.imageSmoothingEnabled = !T.pixelated;
  sctx.drawImage(world,
    v.vw/2 + (wx0 - camX)*zoom, v.vh/2 + (wy0 - camY)*zoom,
    WW*zoom, WH*zoom);
  if (T.overlay){
    sctx.save();
    sctx.translate(v.vw/2 - camX*zoom, v.vh/2 - camY*zoom);
    sctx.scale(zoom, zoom);
    T.overlay(sctx);
    sctx.restore();
  }
}
function setZoom(z){
  zoom = Math.min(8, Math.max(0.04, z));
  $("zoomPct").value = Math.round(zoom * 100) + "%";
}
// bounding box of everything drawn, in world coords (downsampled alpha scan)
function contentBBox(){
  const sw = 220, sh = Math.max(1, Math.round(220 * world.height / world.width));
  const c = document.createElement("canvas");
  c.width = sw; c.height = sh;
  const x = c.getContext("2d");
  x.drawImage(world, 0, 0, sw, sh);
  let d;
  try { d = x.getImageData(0, 0, sw, sh).data; }
  catch (e){ return { x:0, y:0, w:W, h:H }; }
  let minx = sw, miny = sh, maxx = -1, maxy = -1;
  for (let j = 0; j < sh; j++)
    for (let i = 0; i < sw; i++)
      if (d[(j*sw + i)*4 + 3] > 0){
        if (i < minx) minx = i;
        if (i > maxx) maxx = i;
        if (j < miny) miny = j;
        if (j > maxy) maxy = j;
      }
  if (maxx < 0) return { x:0, y:0, w:W, h:H }; // nothing drawn yet
  const px = WW/sw, py = WH/sh; // sample cell size in world units
  return {
    x: wx0 + minx*px - px, y: wy0 + miny*py - py,
    w: (maxx - minx + 3)*px, h: (maxy - miny + 3)*py,
  };
}
function fitContent(){
  // fit above the zoom bar / tool panel when either sits over the bottom of
  // the canvas; if they were dragged elsewhere, use the full canvas
  const v = viewSize(), b = contentBBox(), pad = 46;
  const sr = screen.getBoundingClientRect();
  let bar = 0;
  for (const el of [$("zoombar"), $("panel")]){
    const r = el.getBoundingClientRect();
    if (r.left < sr.right && r.right > sr.left &&
        r.top > sr.top + sr.height*.55 && r.top < sr.bottom)
      bar = Math.max(bar, sr.bottom - r.top + 14);
  }
  bar = Math.min(bar, v.vh*.4);
  setZoom(Math.min(v.vw/(b.w + pad*2), (v.vh - bar)/(b.h + pad*2)));
  camX = b.x + b.w/2;
  camY = b.y + b.h/2 + (bar/2)/zoom;
}
$("zoomIn").onclick = () => setZoom(zoom * 1.25);
$("zoomOut").onclick = () => setZoom(zoom / 1.25);
const zoomPctEl = $("zoomPct");
zoomPctEl.addEventListener("focus", () => { zoomPctEl.value = Math.round(zoom*100).toString(); zoomPctEl.select(); });
zoomPctEl.addEventListener("keydown", e => {
  if (e.key === "Enter"){ e.preventDefault(); zoomPctEl.blur(); }
  else if (e.key === "Escape"){ zoomPctEl.value = Math.round(zoom*100) + "%"; zoomPctEl.blur(); }
});
zoomPctEl.addEventListener("blur", () => {
  const n = parseFloat(zoomPctEl.value.replace(/[^0-9.]/g, ""));
  if (!isNaN(n) && n > 0) setZoom(n/100);
  else zoomPctEl.value = Math.round(zoom*100) + "%";
});
$("zoomFit").onclick = fitContent;
screen.addEventListener("wheel", e => {
  e.preventDefault();
  const r = screen.getBoundingClientRect();
  const mx = e.clientX - r.left - r.width/2, my = e.clientY - r.top - r.height/2;
  const wx = camX + mx/zoom, wy = camY + my/zoom;
  setZoom(zoom * (e.deltaY < 0 ? 1.09 : 1/1.09));
  camX = wx - mx/zoom;  // keep the point under the cursor fixed
  camY = wy - my/zoom;
}, { passive:false });

/* the zoom bar can be dragged anywhere by its grip; position persists */
const zbar = $("zoombar"), zgrip = $("zgrip"), KEY_ZBAR = "artzloop.zoombar";
function setZbarPos(x, y, vert){
  zbar.classList.toggle("v", !!vert);
  const r = zbar.getBoundingClientRect();
  x = Math.max(8, Math.min(window.innerWidth - r.width - 8, x));
  y = Math.max(56, Math.min(window.innerHeight - r.height - 8, y));
  zbar.style.left = x + "px";
  zbar.style.top = y + "px";
  zbar.style.bottom = "auto";
  zbar.style.transform = "none";
}
let zbarDrag = null;
zgrip.addEventListener("pointerdown", e => {
  e.preventDefault();
  zgrip.setPointerCapture(e.pointerId);
  const r = zbar.getBoundingClientRect();
  zbarDrag = [e.clientX - r.left, e.clientY - r.top];
});
zgrip.addEventListener("pointermove", e => {
  if (!zbarDrag) return;
  const vert = e.clientX < 140 || e.clientX > window.innerWidth - 140;
  setZbarPos(e.clientX - zbarDrag[0], e.clientY - zbarDrag[1], vert);
});
zgrip.addEventListener("pointerup", () => {
  if (!zbarDrag) return;
  zbarDrag = null;
  const r = zbar.getBoundingClientRect();
  try { localStorage.setItem(KEY_ZBAR, JSON.stringify({ x:r.left, y:r.top, v:zbar.classList.contains("v") })); } catch (e) {}
});
try {
  const zp = JSON.parse(localStorage.getItem(KEY_ZBAR));
  if (zp && typeof zp.x === "number") setZbarPos(zp.x, zp.y, zp.v);
} catch (e) {}

/* ---- generative music - 4 continuous tracks --------------------------- */
const music = (function(){
  let started = false, nodes = null;
  let muted = localStorage.getItem(KEY_MUTE) === "1";
  let track = localStorage.getItem(KEY_TRACK) || "pad";
  if (!["pad","drone","bells","arp"].includes(track)) track = "pad";

  function dispose(){
    if (!nodes) return;
    for (const n of nodes){
      try { if (n.stop) n.stop(); } catch (e) {}
      try { if (n.dispose) n.dispose(); } catch (e) {}
    }
    nodes = null;
  }
  function build(){
    dispose();
    const reverb = new Tone.Reverb({ decay:6, wet:.42 }).toDestination();
    const filter = new Tone.Filter(950, "lowpass").connect(reverb);
    const out = new Tone.Gain(1).connect(filter);
    nodes = [out, filter, reverb];
    if (track === "pad"){
      const syn = new Tone.PolySynth(Tone.Synth, {
        oscillator:{ type:"sine" },
        envelope:{ attack:2.5, decay:1.5, sustain:.7, release:8 },
      }).connect(out);
      syn.volume.value = -19;
      const chords = [["C3","G3","C4","E4"],["A2","E3","A3","D4"],["G2","D3","G3","C4"],["A2","E3","C4","G4"]];
      let i = 0;
      const loop = new Tone.Loop(t => { syn.triggerAttackRelease(chords[i++ % chords.length], 7, t); }, 6).start(0);
      nodes.push(syn, loop);
    } else if (track === "drone"){
      const o1 = new Tone.Oscillator("C2", "sine").connect(out).start();
      const o2 = new Tone.Oscillator("G2", "sine").connect(out).start();
      const o3 = new Tone.Oscillator("C3", "triangle").connect(out).start();
      o1.volume.value = -24; o2.volume.value = -27; o3.volume.value = -31;
      const lfo = new Tone.LFO(.05, 260, 1100).start();
      lfo.connect(filter.frequency);
      nodes.push(o1, o2, o3, lfo);
    } else if (track === "bells"){
      const syn = new Tone.PolySynth(Tone.Synth, {
        oscillator:{ type:"triangle" },
        envelope:{ attack:.005, decay:1.8, sustain:0, release:2.2 },
      }).connect(out);
      syn.volume.value = -21;
      const notes = ["C5","D5","E5","G5","A5","C6","G4","A4","E5"];
      const loop = new Tone.Loop(t => {
        if (Math.random() < .62)
          syn.triggerAttackRelease(notes[(Math.random()*notes.length)|0], 1.6, t);
      }, .42).start(0);
      nodes.push(syn, loop);
    } else if (track === "arp"){
      const delay = new Tone.FeedbackDelay(.375, .38).connect(out);
      const syn = new Tone.Synth({
        oscillator:{ type:"sine" },
        envelope:{ attack:.02, decay:.28, sustain:.18, release:.6 },
      }).connect(delay);
      syn.volume.value = -20;
      const pat = new Tone.Pattern((t, n) => syn.triggerAttackRelease(n, .22, t),
        ["C4","E4","G4","A4","C5","A4","G4","E4"], "up");
      pat.interval = "8n";
      pat.start(0);
      nodes.push(syn, delay, pat);
    }
  }
  async function start(){
    if (started || muted || typeof Tone === "undefined") return;
    started = true;
    await Tone.start();
    Tone.Transport.start();
    build();
    Tone.Destination.mute = muted;
  }
  function setTrack(name){
    track = name;
    localStorage.setItem(KEY_TRACK, name);
    if (started && !muted && typeof Tone !== "undefined") build();
  }
  function toggleMute(){
    muted = !muted;
    localStorage.setItem(KEY_MUTE, muted ? "1" : "0");
    if (typeof Tone !== "undefined" && started) Tone.Destination.mute = muted;
    if (!muted) start();
    return muted;
  }
  return { start, toggleMute, setTrack, get muted(){ return muted; }, get track(){ return track; } };
})();
const muteBtn = $("muteBtn");
const ICON_SOUND = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9v6h4l5 5V4L9 9H5Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a9 9 0 0 1 0 12"/></svg>';
const ICON_MUTE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9v6h4l5 5V4L9 9H5Z"/><path d="m17 9 5 6"/><path d="m22 9-5 6"/></svg>';
function renderMute(){ muteBtn.innerHTML = music.muted ? ICON_MUTE : ICON_SOUND; }
muteBtn.onclick = () => { music.toggleMute(); renderMute(); };
renderMute();
const musicSel = $("musicSel");
musicSel.value = music.track;
musicSel.addEventListener("change", () => music.setTrack(musicSel.value));

/* ---- floating tool panel (drag by grip; horizontal near the bottom) ---- */
const panel = $("panel"), grip = $("grip");
function setPanelPos(x, y, horiz){
  panel.classList.toggle("h", horiz);
  panel.classList.toggle("v", !horiz);
  const r = panel.getBoundingClientRect();
  x = Math.max(8, Math.min(window.innerWidth - r.width - 8, x));
  y = Math.max(56, Math.min(window.innerHeight - r.height - 8, y));
  panel.style.left = x + "px";
  panel.style.top = y + "px";
  panel.style.right = "auto";
}
let panelDrag = null;
grip.addEventListener("pointerdown", e => {
  e.preventDefault();
  grip.setPointerCapture(e.pointerId);
  const r = panel.getBoundingClientRect();
  panelDrag = [e.clientX - r.left, e.clientY - r.top];
});
grip.addEventListener("pointermove", e => {
  if (!panelDrag) return;
  const horiz = e.clientY > window.innerHeight - 150;
  setPanelPos(e.clientX - panelDrag[0], e.clientY - panelDrag[1], horiz);
});
grip.addEventListener("pointerup", () => {
  if (!panelDrag) return;
  panelDrag = null;
  const r = panel.getBoundingClientRect();
  try {
    localStorage.setItem(KEY_PANEL, JSON.stringify({
      x:r.left, y:r.top, h:panel.classList.contains("h"),
    }));
  } catch (e) {}
});
function placePanel(){
  let pp = null;
  try { pp = JSON.parse(localStorage.getItem(KEY_PANEL)); } catch (e) {}
  if (pp && typeof pp.x === "number") setPanelPos(pp.x, pp.y, !!pp.h);
  else {
    const r = panel.getBoundingClientRect();
    setPanelPos(window.innerWidth - r.width - 14,
      Math.max(70, (window.innerHeight - r.height)/2), false);
  }
}
window.addEventListener("resize", () => {
  fitScreen();
  const r = panel.getBoundingClientRect();
  setPanelPos(r.left, r.top, panel.classList.contains("h"));
  if (zbar.style.left){
    const zr = zbar.getBoundingClientRect();
    setZbarPos(zr.left, zr.top, zbar.classList.contains("v"));
  }
});

/* ---- pointer input: pan vs tool ------------------------------------------ */
let panMode = false, spaceHeld = false, panning = null;
// select mode has no drag step - toggling it on/off just selects/deselects
// the whole piece of art in one shot (dragging a marquee and hit-testing
// every point of every stroke against it, every frame, was the slow part).
let selectMode = false, rotating = null;
const panBtn = $("panBtn"), selectBtn = $("selectBtn");
// eraser/fill/recolor each draw their own cursor glyph in overlay() - the
// native crosshair would just double up with it, so hide it (cursor:none)
// for those tools and only fall back to crosshair for brush, which has no
// glyph of its own.
function toolCursor(){
  const t = api.P.tool;
  return (t === "eraser" || t === "fill" || t === "recolor") ? "none" : "crosshair";
}
panBtn.onclick = () => {
  panMode = !panMode;
  panBtn.classList.toggle("active", panMode);
  if (panMode && selectMode){ selectMode = false; selectBtn.classList.remove("active"); if (T.clearSelection) T.clearSelection(); }
  screen.style.cursor = panMode ? "grab" : toolCursor();
};
selectBtn.onclick = () => {
  selectMode = !selectMode;
  selectBtn.classList.toggle("active", selectMode);
  if (selectMode){
    if (panMode){ panMode = false; panBtn.classList.remove("active"); }
    if (T.selectAll) T.selectAll();
  } else if (T.clearSelection) T.clearSelection();
  screen.style.cursor = selectMode ? "crosshair" : ((panMode || spaceHeld) ? "grab" : toolCursor());
};
window.addEventListener("keydown", e => {
  if (e.code === "Space" && !spaceHeld && e.target === document.body){
    spaceHeld = true;
    screen.style.cursor = "grab";
    e.preventDefault();
  }
});
window.addEventListener("keyup", e => {
  if (e.code === "Space"){
    spaceHeld = false;
    if (!panMode) screen.style.cursor = toolCursor();
  }
});
function toWorldXY(clientX, clientY){
  const r = screen.getBoundingClientRect();
  return [camX + (clientX - r.left - r.width/2)/zoom,
          camY + (clientY - r.top - r.height/2)/zoom];
}
function ptr(type, e){
  if (!T.pointer) return;
  const evs = (type === "move" && e.getCoalescedEvents) ? e.getCoalescedEvents() : [e];
  for (const ev of evs){
    const p = toWorldXY(ev.clientX, ev.clientY);
    // grow the world under an active drawing gesture
    if (type === "down" || (type === "move" && e.buttons)) ensureVisible(p[0], p[1]);
    T.pointer(type, p[0], p[1], ev);
  }
}
screen.addEventListener("pointerdown", e => {
  e.preventDefault();
  screen.setPointerCapture(e.pointerId);
  music.start();
  if (panMode || spaceHeld || e.button === 1){
    panning = [e.clientX, e.clientY];
    screen.style.cursor = "grabbing";
    return;
  }
  if (selectMode) return; // nothing to draw while managing the selection
  ptr("down", e);
});
screen.addEventListener("pointermove", e => {
  if (panning){
    camX -= (e.clientX - panning[0])/zoom;
    camY -= (e.clientY - panning[1])/zoom;
    panning = [e.clientX, e.clientY];
    return;
  }
  if (selectMode) return;
  ptr("move", e);
});
function endPtr(e){
  if (panning){
    panning = null;
    screen.style.cursor = (panMode || spaceHeld) ? "grab" : toolCursor();
    return;
  }
  if (selectMode) return;
  ptr("up", e);
}
screen.addEventListener("pointerup", endPtr);
screen.addEventListener("pointercancel", endPtr);

/* ---- floating Delete / Rotate controls for the active selection -------- */
const selDeleteBtn = $("selDelete"), selRotateBtn = $("selRotate");
function toScreenXY(wx, wy){
  const v = viewSize(), r = screen.getBoundingClientRect();
  return [r.left + v.vw/2 + (wx - camX)*zoom, r.top + v.vh/2 + (wy - camY)*zoom];
}
function positionSelectUI(){
  const bbox = T.getSelectionBBox && T.getSelectionBBox();
  if (!bbox){
    selDeleteBtn.classList.remove("show");
    selRotateBtn.classList.remove("show");
    rotDeg.classList.remove("show");
    return;
  }
  const [sx0, sy0] = toScreenXY(bbox.x0, bbox.y0), [sx1, sy1] = toScreenXY(bbox.x1, bbox.y1);
  const left = Math.min(sx0, sx1), right = Math.max(sx0, sx1);
  const top = Math.min(sy0, sy1), bottom = Math.max(sy0, sy1);
  selDeleteBtn.style.left = (right + 6) + "px";
  selDeleteBtn.style.top = (top - 36) + "px";
  selDeleteBtn.classList.add("show");
  selRotateBtn.style.left = ((left + right)/2 - 15) + "px";
  selRotateBtn.style.top = (bottom + 14) + "px";
  selRotateBtn.classList.add("show");
  showRotDeg();
}
selDeleteBtn.onclick = () => { if (T.deleteSelection) T.deleteSelection(); };
// rotation always pivots on the snowflake's own center (W/2,H/2 in world
// coords, same point the tool treats as its origin) - not the selection's own
// bbox center - so the drag gesture directly mirrors what actually spins.
// The readout always shows the ART'S ABSOLUTE angle (persisted rotation +
// any live in-progress drag delta), never a delta that resets to 0 - so
// reselecting a piece that was rotated earlier (this session or loaded from
// a save) shows its real angle immediately instead of looking "reset".
const rotDeg = $("rotDeg");
let curDragDelta = 0;
function showRotDeg(){
  const base = (T.getGlobalRot && T.getGlobalRot()) || 0;
  const totalRad = base + curDragDelta;
  const deg = Math.round(((totalRad*180/Math.PI + 180) % 360 + 360) % 360 - 180); // normalized to -180..180
  rotDeg.textContent = (deg > 0 ? "+" : "") + deg + "°";
  const r = selRotateBtn.getBoundingClientRect();
  rotDeg.style.left = (r.left + r.width/2) + "px";
  rotDeg.style.top = (r.bottom + 8) + "px";
  rotDeg.classList.add("show");
}
selRotateBtn.addEventListener("pointerdown", e => {
  e.preventDefault(); e.stopPropagation();
  selRotateBtn.setPointerCapture(e.pointerId);
  const p = toWorldXY(e.clientX, e.clientY);
  rotating = { cx:W/2, cy:H/2, start:Math.atan2(p[1] - H/2, p[0] - W/2) };
  curDragDelta = 0;
  if (T.rotateSelectionStart) T.rotateSelectionStart();
  showRotDeg();
});
selRotateBtn.addEventListener("pointermove", e => {
  if (!rotating) return;
  const p = toWorldXY(e.clientX, e.clientY);
  const ang = Math.atan2(p[1] - rotating.cy, p[0] - rotating.cx);
  curDragDelta = ang - rotating.start;
  if (T.rotateSelectionPreview) T.rotateSelectionPreview(curDragDelta);
  showRotDeg();
});
function endRotate(){
  if (!rotating) return;
  rotating = null;
  curDragDelta = 0;
  if (T.rotateSelectionCommit) T.rotateSelectionCommit();
  showRotDeg(); // stays visible post-drag, now showing the newly committed absolute angle
}
selRotateBtn.addEventListener("pointerup", endRotate);
selRotateBtn.addEventListener("pointercancel", endRotate);

/* ---- black / white canvas ---------------------------------------------- */
function renderBgBtn(){
  $("bgLabel").textContent = bgMode === "dark" ? "Dark" : "Light";
  $("bgBtn").setAttribute("data-tip", bgMode === "dark"
    ? "Switch the canvas to a white background"
    : "Switch the canvas to a black background");
}
$("bgBtn").onclick = () => {
  bgMode = bgMode === "dark" ? "light" : "dark";
  localStorage.setItem(KEY_BG, bgMode);
  renderBgBtn();
  if (T.bgChanged) T.bgChanged();
  dirtyFlag = true;
};
renderBgBtn();

/* ---- grid on/off ---- */
function renderGridBtn(){
  $("gridBtn").classList.toggle("active", gridOn);
  $("gridBtn").setAttribute("data-tip", gridOn ? "Hide the canvas grid" : "Show the canvas grid");
}
$("gridBtn").onclick = () => {
  gridOn = !gridOn;
  localStorage.setItem("artzloop.grid", gridOn ? "1" : "0");
  renderGridBtn();
};
renderGridBtn();

/* ---- download / upload (.art) - canonical copy in shared/artz-format.js */
function makeThumb(width){
  width = width || 340;
  const b = contentBBox();
  const c = document.createElement("canvas");
  c.width = width;
  c.height = Math.max(1, Math.round(width * b.h / b.w));
  const x = c.getContext("2d");
  x.fillStyle = BGCOL[bgMode];
  x.fillRect(0, 0, c.width, c.height);
  const s = width / b.w;
  x.setTransform(s, 0, 0, s, -b.x*s, -b.y*s);
  x.drawImage(world, wx0, wy0, WW, WH);
  return c.toDataURL("image/png");
}
// user-editable save name - sanitized, extension appended per download type
const dlNameInput = $("dlNameInput");
const dlDefaultBase = T.file.replace(/\.[^.]+$/, "");
dlNameInput.value = dlDefaultBase;
function dlBaseName(){
  const v = dlNameInput.value.trim().replace(/[\\/:*?"<>|]+/g, "_");
  return v || dlDefaultBase;
}
async function doDownload(){
  if (typeof JSZip === "undefined"){ alert("Downloading needs the JSZip script - go online once and reload."); return; }
  const data = {
    appVersion: APP_VERSION, app: T.id, createdAt: new Date().toISOString(),
    canvasWidth: W, canvasHeight: H, bg: bgMode,
    state: T.serialize(), params: Object.assign({}, PV),
  };
  const zip = new JSZip();
  zip.file("data.json", JSON.stringify(data));
  zip.file("preview.png", makeThumb().split(",")[1], { base64:true });
  const blob = await zip.generateAsync({ type:"blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = dlBaseName() + T.file.slice(T.file.lastIndexOf("."));
  a.click();
  URL.revokeObjectURL(a.href);
}
function applySession(data){
  if (data.bg && data.bg !== bgMode){
    bgMode = data.bg;
    localStorage.setItem(KEY_BG, bgMode);
    renderBgBtn();
  }
  applyParams(data.params || {});
  T.restore(data.state || {});
  if (T.bgChanged) T.bgChanged();
  resetHistory();
  setTimeout(fitContent, 120); // bring the restored art into view
}
async function doUpload(file){
  if (typeof JSZip === "undefined"){ alert("Uploading needs the JSZip script - go online once and reload."); return; }
  try {
    const zip = await JSZip.loadAsync(file);
    const entry = zip.file("data.json");
    if (!entry) throw new Error("Not an ArtzLoop file (missing data.json).");
    const data = JSON.parse(await entry.async("string"));
    if (data.app !== T.id) throw new Error('This file was saved by "' + data.app + '", not this tool.');
    applySession(data);
    dirtyFlag = true;
  } catch (err){
    alert("Couldn't open that file: " + err.message);
  }
}
// flat image export - the drawn content, padded, on the current background
// (or, if transparent, on no background at all - the world canvas already
// has nothing painted outside your strokes, so skipping the fill is enough)
function exportImage(type, transparent){
  const b = contentBBox(), pad = 24;
  let s = wdpr;
  const mw = b.w + pad*2, mh = b.h + pad*2;
  if (Math.max(mw, mh)*s > 4096) s = 4096/Math.max(mw, mh);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(mw*s));
  c.height = Math.max(1, Math.round(mh*s));
  const x = c.getContext("2d");
  if (!transparent){
    x.fillStyle = BGCOL[bgMode];
    x.fillRect(0, 0, c.width, c.height);
  }
  x.setTransform(s, 0, 0, s, (pad - b.x)*s, (pad - b.y)*s);
  x.drawImage(world, wx0, wy0, WW, WH);
  const a = document.createElement("a");
  a.href = c.toDataURL(type === "jpeg" ? "image/jpeg" : "image/png", .92);
  a.download = dlBaseName() + (type === "jpeg" ? ".jpg" : ".png");
  a.click();
}
const dlMenu = $("dlMenu"), dlWrap = $("saveBtn").parentElement;
$("saveBtn").onclick = () => dlMenu.classList.toggle("show");
window.addEventListener("pointerdown", e => {
  if (!dlWrap.contains(e.target)) dlMenu.classList.remove("show");
});
$("dlArt").onclick = () => { dlMenu.classList.remove("show"); doDownload(); };
$("dlPng").onclick = () => { dlMenu.classList.remove("show"); exportImage("png", false); };
$("dlPngT").onclick = () => { dlMenu.classList.remove("show"); exportImage("png", true); };
$("dlJpg").onclick = () => { dlMenu.classList.remove("show"); exportImage("jpeg", false); };
$("loadBtn").onclick = () => $("fileInput").click();
$("fileInput").addEventListener("change", e => {
  if (e.target.files[0]) doUpload(e.target.files[0]);
  e.target.value = "";
});
screen.addEventListener("dragover", e => e.preventDefault());
screen.addEventListener("drop", e => {
  e.preventDefault();
  if (e.dataTransfer.files[0]) doUpload(e.dataTransfer.files[0]);
});

/* ---- clear -------------------------------------------------------------- */
$("clearBtn").onclick = () => {
  if (!confirm("Clear the whole canvas?")) return;
  T.clear();
  camX = W/2; camY = H/2; setZoom(1);
  dirtyFlag = true;
  scheduleSnapshot();
};

/* ---- tool-grid popup ------------------------------------------------------ */
const modal = $("modal");
$("toolsBtn").onclick = () => modal.classList.add("show");
$("modalX").onclick = () => modal.classList.remove("show");
modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("show"); });

/* ---- help popup ------------------------------------------------------------ */
const helpModal = $("helpModal");
$("helpBtn").onclick = () => helpModal.classList.add("show");
$("helpX").onclick = () => helpModal.classList.remove("show");
helpModal.addEventListener("click", e => { if (e.target === helpModal) helpModal.classList.remove("show"); });

window.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  modal.classList.remove("show");
  helpModal.classList.remove("show");
  if (selectMode) selectBtn.click();
});
// keyboard shortcuts - Ctrl/Cmd combos work anywhere, bare letters are
// ignored while typing in a text field (hex input, filename, etc.)
function typingInField(e){
  const t = e.target;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}
window.addEventListener("keydown", e => {
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (ctrl && k === "s"){ e.preventDefault(); $("quickSaveBtn").click(); return; }
  if (ctrl && k === "o"){ e.preventDefault(); $("loadBtn").click(); return; }
  if (ctrl && k === "m"){ e.preventDefault(); applyParams({ mir: !PV.mir }); return; }
  if (e.altKey && k === "c"){
    e.preventDefault();
    const sw = document.querySelector('[data-key="col"] .swatch');
    if (sw) sw.click();
    return;
  }
  if (ctrl || e.altKey || typingInField(e)) return;
  if (k === "s"){ e.preventDefault(); selectBtn.click(); }
  else if (k === "b"){ applyParams({ tool:"brush" }); }
  else if (k === "e"){ applyParams({ tool:"eraser" }); }
  else if (k === "f"){ applyParams({ tool:"fill" }); }
  else if (k === "r"){ applyParams({ tool:"recolor" }); }
  else if ((k === "delete" || k === "backspace") && T.getSelectionBBox && T.getSelectionBBox()){
    e.preventDefault();
    T.deleteSelection();
  }
});

/* ---- boot ----------------------------------------------------------------- */
// writes the same payload the autosave interval does - shared by the timer
// and by the quick-save button, so a manual click can't fall out of sync
function writeAutosave(){
  dirtyFlag = false;
  try {
    localStorage.setItem(KEY_AUTO, JSON.stringify({
      appVersion: APP_VERSION, app: T.id, savedAt: Date.now(), bg: bgMode,
      state: T.serialize(), params: Object.assign({}, PV),
    }));
    return true;
  } catch (e) { return false; } // storage full or blocked
}
const quickSaveBtn = $("quickSaveBtn");
quickSaveBtn.onclick = () => {
  const ok = writeAutosave();
  quickSaveBtn.classList.add(ok ? "saved" : "save-failed");
  setTimeout(() => quickSaveBtn.classList.remove("saved", "save-failed"), 1100);
};
function boot(){
  fitScreen();
  const r = screen.getBoundingClientRect();
  W = Math.max(680, Math.round(r.width));
  H = Math.max(440, Math.round(r.height));
  wdpr = Math.min(window.devicePixelRatio || 1, 2);
  wx0 = 0; wy0 = 0; WW = W; WH = H;
  world = document.createElement("canvas");
  world.width = Math.round(WW * wdpr);
  world.height = Math.round(WH * wdpr);
  wctx = world.getContext("2d");
  worldTransform();
  camX = W/2; camY = H/2;
  buildControls();
  requestAnimationFrame(placePanel);
  T.init(api);
  resetHistory();

  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY_AUTO)); } catch (e) {}
  if (saved && saved.app === T.id && saved.state){
    $("resume").classList.add("show");
    $("resumeYes").onclick = () => { applySession(saved); $("resume").classList.remove("show"); };
    $("resumeNo").onclick = () => {
      try { localStorage.removeItem(KEY_AUTO); } catch (e) {}
      $("resume").classList.remove("show");
    };
  }
  setInterval(() => { if (dirtyFlag) writeAutosave(); }, 10000);

  let last = performance.now();
  (function loop(now){
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (T.frame) T.frame(dt, now / 1000);
    blit();
    positionSelectUI();
    requestAnimationFrame(loop);
  })(performance.now());
}
boot();
})();
