/*
 * ArtzLoop shared Daily Challenge engine.
 *
 * Tool-agnostic: operates only on the common stroke schema every mirrored
 * drawing tool already uses -
 *   { pts:[[x,y],...], col:"#rrggbb", size:Number, sym:Number, mir:Boolean,
 *     rot:Number, hidden?:number[], cuts?:{...}, cutAll?:number[],
 *     colOverride?:{...} }
 * - so it can be reused by any tool that stores strokes this way (currently
 * only apps/01-kaleidoscope-mandala-pad; apps/09-snowflake-generator is a
 * planned follow-up, not wired up yet).
 *
 * Loaded as a plain global script (no type="module", no bundler) so it can
 * run straight from file:// like every other ArtzLoop tool - exposes a single
 * window.DailyChallenge object.
 */
(function(){
"use strict";

/* ---- deterministic "today's design" picker ----------------------------- */
function fnv1a(str){
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function todayKey(){
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}
function pickForToday(pool){
  if (!pool || !pool.length) return null;
  const idx = fnv1a(todayKey()) % pool.length;
  return pool[idx];
}

/* ---- standalone mandala renderer - mirrors script.js's geom()/drawCopySeg()/
 * drawWholeStroke() but works off any ctx/w/h/strokes, no live `api` needed */
function geomFor(w, h){ return { cx: w/2, cy: h/2, sc: Math.min(w, h)/2 }; }
function copyKeyOf(k, f){ return k*2 + (f < 0 ? 1 : 0); }
function cutSets(s){
  if (!s._ca) s._ca = new Set(s.cutAll || []);
  if (!s._c){
    s._c = {};
    if (s.cuts) for (const k in s.cuts) s._c[k] = new Set(s.cuts[k]);
  }
  return s;
}
function isCut(s, key, i){
  cutSets(s);
  return s._ca.has(i) || (s._c[key] && s._c[key].has(i));
}
function drawCopySeg(c, g, s, k, f, a, b){
  const an = Math.PI*2*k/s.sym + (s.rot || 0), co = Math.cos(an), si = Math.sin(an);
  c.beginPath();
  c.moveTo(g.cx + (a[0]*co - a[1]*f*si)*g.sc, g.cy + (a[0]*si + a[1]*f*co)*g.sc);
  c.lineTo(g.cx + (b[0]*co - b[1]*f*si)*g.sc, g.cy + (b[0]*si + b[1]*f*co)*g.sc);
  c.stroke();
}
function drawWholeStroke(c, g, s){
  c.lineWidth = Math.max(.5, (s.size || 0.01)*g.sc);
  c.lineCap = "round"; c.lineJoin = "round";
  const dot = s.pts.length === 1;
  for (let k = 0; k < s.sym; k++){
    for (const f of (s.mir ? [1, -1] : [1])){
      const key = copyKeyOf(k, f);
      if (s.hidden && s.hidden.indexOf(key) >= 0) continue;
      c.strokeStyle = (s.colOverride && s.colOverride[key]) || s.col;
      if (dot){
        if (!isCut(s, key, 0)) drawCopySeg(c, g, s, k, f, s.pts[0], s.pts[0]);
        continue;
      }
      for (let i = 1; i < s.pts.length; i++)
        if (!isCut(s, key, i)) drawCopySeg(c, g, s, k, f, s.pts[i-1], s.pts[i]);
    }
  }
}
// dark neutral background matching this tool family's canvas (see BGCOL.dark
// in shared/tool-core.js / each tool's style.css --bg)
const THUMB_BG = "#0b0b13";
function renderThumbnail(ctx, w, h, strokes){
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = THUMB_BG;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  if (!strokes || !strokes.length) return;
  const g = geomFor(w, h);
  for (const s of strokes){
    if (!s || !s.pts || !s.pts.length || !s.sym) continue;
    drawWholeStroke(ctx, g, s);
  }
}

/* ---- similarity scoring -------------------------------------------------
 * Works purely on stroke point vectors + colors, normalized by each design's
 * own bounding box so canvas size/zoom never affects the score. */
const SHAPE_DIST_FALLOFF = 0.35;  // normalized-unit mean point distance at which shape similarity bottoms out at 0
const COLOR_DELTAE_FALLOFF = 40;  // Lab deltaE76 at which color similarity bottoms out at 0
const SHAPE_WEIGHT = 0.7, COLOR_WEIGHT = 0.3;
// Completion is shape-only: any color, any overall scale (already handled by
// normalizeStrokeSet's own-bbox normalization above) is fine - only how
// closely the drawn shape traces the target counts toward "completed".
const COMPLETE_THRESHOLD = 90;

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

function computeBBox(strokes){
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const s of strokes)
    for (const p of s.pts){
      if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0];
      if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1];
    }
  if (maxx < minx) return { cx: 0, cy: 0, scale: 1 };
  const cx = (minx + maxx)/2, cy = (miny + maxy)/2;
  const halfW = (maxx - minx)/2, halfH = (maxy - miny)/2;
  return { cx, cy, scale: Math.max(halfW, halfH, 1e-6) };
}
// -> array (parallel to `strokes`) of point arrays, each normalized into a
// shared unit frame centered on the whole set's own bbox centroid
function normalizeStrokeSet(strokes){
  const b = computeBBox(strokes);
  return strokes.map(s => s.pts.map(p => [(p[0] - b.cx)/b.scale, (p[1] - b.cy)/b.scale]));
}
function centroidOf(pts){
  let sx = 0, sy = 0;
  for (const p of pts){ sx += p[0]; sy += p[1]; }
  return [sx/pts.length, sy/pts.length];
}
// Whole-shape comparison (Chamfer distance) rather than pairing individual
// strokes 1:1: a freehand recreation almost never lifts the pen at the same
// points as the original design, so two drawings that *look* the same can
// have completely different stroke counts/boundaries. Flattening every
// stroke's points into one cloud per drawing and matching nearest-point
// (both directions) scores the resulting silhouette, not how the artist
// happened to segment their pen strokes.
const CLOUD_CAP = 400; // bound the O(n*m) nearest-neighbor cost for busy drawings
function flattenCloud(strokes){
  const pts = [];
  for (const s of strokes) for (const p of s.pts) pts.push(p);
  return pts;
}
function downsampleEven(pts, cap){
  if (pts.length <= cap) return pts;
  const out = [];
  for (let i = 0; i < cap; i++) out.push(pts[Math.floor(i * pts.length / cap)]);
  return out;
}
function chamferMeanDist(a, b){
  if (!a.length || !b.length) return Infinity;
  let sum = 0;
  for (const pa of a){
    let best = Infinity;
    for (const pb of b){
      const dx = pa[0]-pb[0], dy = pa[1]-pb[1];
      const d = dx*dx + dy*dy;
      if (d < best) best = d;
    }
    sum += Math.sqrt(best);
  }
  return sum/a.length;
}
// userNorm/targetNorm: arrays (parallel to their strokes) of already
// bbox-normalized point arrays, from normalizeStrokeSet()
function wholeShapeSimilarity(userNorm, targetNorm){
  const userCloud = downsampleEven(userNorm.flat(), CLOUD_CAP);
  const targetCloud = downsampleEven(targetNorm.flat(), CLOUD_CAP);
  if (!userCloud.length || !targetCloud.length) return 0;
  const dFwd = chamferMeanDist(userCloud, targetCloud);
  const dRev = chamferMeanDist(targetCloud, userCloud);
  return clamp(1 - (dFwd + dRev)/2/SHAPE_DIST_FALLOFF, 0, 1);
}

/* Lab color distance (ΔE76) for the 0.3-weighted color term */
function hexToRgbNorm(hex){
  const n = parseInt((hex || "#888888").replace("#", "").slice(0, 6).padEnd(6, "8"), 16);
  return [((n>>16)&255)/255, ((n>>8)&255)/255, (n&255)/255];
}
function srgbToLinear(c){ return c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
const D65 = [0.95047, 1.0, 1.08883];
function fLab(t){ return t > 0.008856 ? Math.cbrt(t) : (7.787*t + 16/116); }
function hexToLab(hex){
  const [r0, g0, b0] = hexToRgbNorm(hex);
  const r = srgbToLinear(r0), g = srgbToLinear(g0), b = srgbToLinear(b0);
  const x = r*0.4124564 + g*0.3575761 + b*0.1804375;
  const y = r*0.2126729 + g*0.7151522 + b*0.0721750;
  const z = r*0.0193339 + g*0.1191920 + b*0.9503041;
  const fx = fLab(x/D65[0]), fy = fLab(y/D65[1]), fz = fLab(z/D65[2]);
  return [116*fy - 16, 500*(fx-fy), 200*(fy-fz)];
}
function colorSimilarity(colA, colB){
  const labA = hexToLab(colA), labB = hexToLab(colB);
  const dE = Math.hypot(labA[0]-labB[0], labA[1]-labB[1], labA[2]-labB[2]);
  return clamp(1 - dE/COLOR_DELTAE_FALLOFF, 0, 1);
}

// simple O(n*m) greedy nearest-centroid matching - stroke counts are always
// small (a handful per design), so a full Hungarian assignment is overkill
function greedyMatch(userCentroids, targetCentroids){
  const pairs = [];
  for (let i = 0; i < userCentroids.length; i++)
    for (let j = 0; j < targetCentroids.length; j++)
      pairs.push([Math.hypot(userCentroids[i][0]-targetCentroids[j][0], userCentroids[i][1]-targetCentroids[j][1]), i, j]);
  pairs.sort((a, b) => a[0] - b[0]);
  const usedU = new Set(), usedT = new Set(), matches = [];
  for (const [, i, j] of pairs){
    if (usedU.has(i) || usedT.has(j)) continue;
    usedU.add(i); usedT.add(j);
    matches.push([i, j]);
  }
  return matches;
}

function score(userStrokes, targetStrokes){
  userStrokes = (userStrokes || []).filter(s => s && s.pts && s.pts.length);
  targetStrokes = (targetStrokes || []).filter(s => s && s.pts && s.pts.length);
  if (!userStrokes.length || !targetStrokes.length)
    return { overall: 0, shape: 0, color: 0, userStrokeCount: userStrokes.length, targetStrokeCount: targetStrokes.length };

  const userNorm = normalizeStrokeSet(userStrokes);
  const targetNorm = normalizeStrokeSet(targetStrokes);

  // Shape score compares the two drawings as whole silhouettes (see
  // wholeShapeSimilarity) - deliberately not tied to matching individual
  // strokes 1:1, since how many times the artist lifted the pen shouldn't
  // affect whether the resulting picture looks the same.
  const shapeSim = wholeShapeSimilarity(userNorm, targetNorm);

  // Color stays a per-stroke nearest-centroid comparison (informational
  // only - it does not gate "completed", see COMPLETE_THRESHOLD below).
  const userC = userNorm.map(centroidOf);
  const targetC = targetNorm.map(centroidOf);
  const matches = greedyMatch(userC, targetC);
  let colorSum = 0;
  for (const [ui, ti] of matches) colorSum += colorSimilarity(userStrokes[ui].col, targetStrokes[ti].col);
  const colorSim = matches.length ? colorSum/matches.length : 0;

  return {
    overall: clamp(SHAPE_WEIGHT*shapeSim + COLOR_WEIGHT*colorSim, 0, 1)*100,
    shape: shapeSim*100,
    color: colorSim*100,
    userStrokeCount: userStrokes.length,
    targetStrokeCount: targetStrokes.length,
  };
}

/* ---- history persistence ------------------------------------------------ */
const HISTORY_CAP_DAYS = 90;
function historyKey(toolId){ return "artzloop.challenge." + toolId + ".history"; }
function loadHistory(toolId){
  try {
    const raw = localStorage.getItem(historyKey(toolId));
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
function saveResult(toolId, dateKey, result){
  const hist = loadHistory(toolId);
  const prev = hist[dateKey];
  // a completed attempt always outranks a non-completed one, regardless of
  // the raw overall number (color differences shouldn't cost a completion)
  const better = !prev ||
    (result.completed && !prev.completed) ||
    (result.completed === !!prev.completed &&
      (result.overall > prev.overall ||
        (result.overall === prev.overall && result.elapsedMs < prev.elapsedMs)));
  if (better) hist[dateKey] = { elapsedMs: result.elapsedMs, overall: result.overall, completed: !!result.completed, completedAt: Date.now() };
  const keys = Object.keys(hist).sort();
  while (keys.length > HISTORY_CAP_DAYS) delete hist[keys.shift()];
  try { localStorage.setItem(historyKey(toolId), JSON.stringify(hist)); } catch (e) {}
  return hist[dateKey];
}
function formatElapsed(ms){
  const totalSec = Math.max(0, Math.round(ms/1000));
  const m = Math.floor(totalSec/60), s = totalSec % 60;
  return m + ":" + String(s).padStart(2, "0");
}

/* ---- UI: modal (preview / confirm-clear / results) + floating timer pill */
function mount(toolId, opts){
  opts = opts || {};
  const pool = opts.pool || [];
  const getUserStrokes = opts.getUserStrokes || (() => []);
  const clearCanvas = opts.clearCanvas || (() => {});
  const buttonEl = opts.buttonEl;

  // ---- modal shell (built once per page load) ----
  let modal = document.getElementById("challengeModal"), modalBody;
  if (!modal){
    modal = document.createElement("div");
    modal.id = "challengeModal";
    const sheet = document.createElement("div");
    sheet.className = "sheet challengeSheet";
    const closeX = document.createElement("button");
    closeX.type = "button"; closeX.className = "btn icon x";
    closeX.textContent = "✕";
    closeX.onclick = () => modal.classList.remove("show");
    modalBody = document.createElement("div");
    modalBody.className = "challengeBody";
    sheet.appendChild(closeX);
    sheet.appendChild(modalBody);
    modal.appendChild(sheet);
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("show"); });
  } else {
    modalBody = modal.querySelector(".challengeBody");
  }

  // ---- floating timer pill (built once per page load) ----
  let pill = document.getElementById("challengePill");
  if (!pill){
    pill = document.createElement("div");
    pill.id = "challengePill";
    pill.innerHTML =
      '<span class="cpTime">0:00</span>' +
      '<button type="button" class="btn primary cpSubmit">Submit</button>' +
      '<button type="button" class="btn icon cpCancel" title="Cancel challenge">✕</button>';
    document.body.appendChild(pill);
  }
  const cpTime = pill.querySelector(".cpTime");
  const cpSubmit = pill.querySelector(".cpSubmit");
  const cpCancel = pill.querySelector(".cpCancel");

  // ---- persistent reference thumbnail (built once per page load) ----
  // Stays visible in the opposite corner from the timer pill for the whole
  // armed+drawing window, not just in the pre-start preview modal - a
  // one-time glance isn't enough to recreate a multi-stroke design from
  // memory. Square canvas, own-center geometry (see geomFor/renderThumbnail
  // above) so the design renders evenly centered on both axes regardless of
  // this widget's on-screen size.
  let refPanel = document.getElementById("challengeRefPanel"), refCanvas;
  if (!refPanel){
    refPanel = document.createElement("div");
    refPanel.id = "challengeRefPanel";
    const label = document.createElement("div"); label.className = "crpLabel"; label.textContent = "Reference";
    refCanvas = document.createElement("canvas");
    // 190 matches the existing Target/Yours compare thumbnails elsewhere in
    // this file - large enough for a busy multi-stroke design's line detail
    // to actually read at a glance while drawing, not just as a silhouette
    refCanvas.width = refCanvas.height = 190; // square: geomFor centers on w/2,h/2 evenly on both axes
    refPanel.appendChild(refCanvas);
    refPanel.appendChild(label);
    document.body.appendChild(refPanel);
  } else {
    refCanvas = refPanel.querySelector("canvas");
  }

  let armed = false, started = false, startTime = 0, rafId = null, targetDesign = null;

  function refreshButtonDoneState(){
    if (!buttonEl) return;
    const todays = loadHistory(toolId)[todayKey()];
    buttonEl.classList.toggle("done", !!(todays && todays.completed));
  }
  refreshButtonDoneState();

  function tick(){
    if (!started) return;
    cpTime.textContent = formatElapsed(performance.now() - startTime);
    rafId = requestAnimationFrame(tick);
  }
  // The clock starts the moment the challenge is armed (Start Challenge
  // clicked), not on the first stroke - "practice before you commit" isn't
  // free thinking time here, matching the "Time: 0:03 already on the pill
  // before I've drawn anything" expectation.
  function showPillArmed(){
    armed = true; started = true; startTime = performance.now();
    cpTime.textContent = "0:00";
    pill.classList.add("show");
    if (targetDesign) renderThumbnail(refCanvas.getContext("2d"), refCanvas.width, refCanvas.height, targetDesign.strokes);
    refPanel.classList.toggle("show", !!targetDesign);
    rafId = requestAnimationFrame(tick);
  }
  // kept as a no-op call target - apps/*/script.js notifies on every
  // committed stroke, but the timer no longer waits on it (see showPillArmed)
  function onStrokeCommitted(){}
  function cancelChallenge(){
    armed = false; started = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    pill.classList.remove("show");
    refPanel.classList.remove("show");
  }
  cpCancel.onclick = cancelChallenge;

  function doSubmit(){
    if (!started) return;
    const elapsedMs = performance.now() - startTime;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null; armed = false; started = false;
    pill.classList.remove("show");
    refPanel.classList.remove("show");
    const userStrokes = getUserStrokes();
    const result = score(userStrokes, (targetDesign && targetDesign.strokes) || []);
    const completed = result.shape >= COMPLETE_THRESHOLD;
    saveResult(toolId, todayKey(), { overall: result.overall, elapsedMs, completed });
    refreshButtonDoneState();
    renderResults(result, elapsedMs, userStrokes, completed);
    modal.classList.add("show");
  }
  cpSubmit.onclick = doSubmit;

  function clearBody(){ modalBody.innerHTML = ""; }
  function addActions(...buttons){
    const row = document.createElement("div"); row.className = "challengeActions";
    for (const b of buttons) row.appendChild(b);
    modalBody.appendChild(row);
    return row;
  }
  function makeBtn(label, cls){
    const b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = label;
    return b;
  }

  function renderPreview(){
    clearBody();
    targetDesign = pickForToday(pool);
    const h = document.createElement("h2"); h.textContent = "Daily Challenge";
    const sub = document.createElement("div"); sub.className = "sub";
    sub.textContent = todayKey() + " - recreate this design freehand (any color, any size), then submit to see your score.";
    modalBody.appendChild(h); modalBody.appendChild(sub);
    const todays = loadHistory(toolId)[todayKey()];
    if (todays && todays.completed){
      const done = document.createElement("div");
      done.className = "challengeCompleteBanner done";
      done.textContent = "✓ Already completed today (best shape-match run kept) - try again to improve it.";
      modalBody.appendChild(done);
    }
    const wrap = document.createElement("div"); wrap.className = "challengeThumbWrap";
    const canvas = document.createElement("canvas");
    canvas.width = 260; canvas.height = 260; canvas.className = "challengeThumb";
    wrap.appendChild(canvas);
    modalBody.appendChild(wrap);
    if (targetDesign) renderThumbnail(canvas.getContext("2d"), canvas.width, canvas.height, targetDesign.strokes);
    else {
      const p = document.createElement("div"); p.className = "sub"; p.textContent = "No challenge design available yet.";
      modalBody.appendChild(p);
    }
    const start = makeBtn("Start Challenge", "btn primary");
    start.onclick = () => attemptStart();
    const close = makeBtn("Close", "btn");
    close.onclick = () => modal.classList.remove("show");
    addActions(start, close);
  }
  function attemptStart(){
    if (getUserStrokes().length > 0) renderConfirmClear();
    else beginChallenge();
  }
  function renderConfirmClear(){
    clearBody();
    const h = document.createElement("h2"); h.textContent = "Clear your canvas?";
    const sub = document.createElement("div"); sub.className = "sub";
    sub.textContent = "Starting the Daily Challenge clears your current canvas first. Continue?";
    modalBody.appendChild(h); modalBody.appendChild(sub);
    const yes = makeBtn("Yes, clear", "btn primary");
    yes.onclick = () => beginChallenge();
    const no = makeBtn("Cancel", "btn");
    no.onclick = () => renderPreview();
    addActions(yes, no);
  }
  function beginChallenge(){
    clearCanvas();
    modal.classList.remove("show");
    showPillArmed();
  }
  function renderResults(result, elapsedMs, userStrokes, completed){
    clearBody();
    const h = document.createElement("h2");
    h.textContent = completed ? "Challenge Completed!" : "Challenge Results";
    const banner = document.createElement("div");
    banner.className = "challengeCompleteBanner" + (completed ? " done" : "");
    banner.textContent = completed
      ? "Shape match " + Math.round(result.shape) + "% - that clears the " + COMPLETE_THRESHOLD + "% bar. Color and overall size don't count against you."
      : "Shape match " + Math.round(result.shape) + "% - needs " + COMPLETE_THRESHOLD + "% to complete (color and size don't count either way).";
    const sub = document.createElement("div"); sub.className = "sub";
    sub.textContent = "Time: " + formatElapsed(elapsedMs);
    modalBody.appendChild(h); modalBody.appendChild(banner); modalBody.appendChild(sub);

    const row = document.createElement("div"); row.className = "challengeScoreRow";
    const item = (label, val) => {
      const d = document.createElement("div"); d.className = "challengeScoreItem";
      const b = document.createElement("b"); b.textContent = Math.round(val);
      const s = document.createElement("span"); s.textContent = label;
      d.appendChild(b); d.appendChild(s);
      return d;
    };
    row.appendChild(item("Overall", result.overall));
    row.appendChild(item("Shape", result.shape));
    row.appendChild(item("Color", result.color));
    modalBody.appendChild(row);

    const compare = document.createElement("div"); compare.className = "challengeCompare";
    const mkThumb = (label, strokes) => {
      const item2 = document.createElement("div"); item2.className = "challengeCompareItem";
      const lab = document.createElement("div"); lab.textContent = label;
      const c = document.createElement("canvas"); c.width = 190; c.height = 190; c.className = "challengeThumb";
      item2.appendChild(lab); item2.appendChild(c);
      renderThumbnail(c.getContext("2d"), c.width, c.height, strokes);
      return item2;
    };
    compare.appendChild(mkThumb("Target", (targetDesign && targetDesign.strokes) || []));
    compare.appendChild(mkThumb("Yours", userStrokes));
    modalBody.appendChild(compare);

    const again = makeBtn("Try Again", "btn primary");
    again.onclick = () => attemptStart();
    const done = makeBtn("Done", "btn");
    done.onclick = () => modal.classList.remove("show");
    addActions(again, done);
  }

  function openModal(){
    if (armed){ pill.classList.add("show"); modal.classList.remove("show"); return; }
    renderPreview();
    modal.classList.add("show");
  }
  if (buttonEl) buttonEl.onclick = openModal;

  return { onStrokeCommitted, openModal, cancelChallenge };
}

window.DailyChallenge = {
  pickForToday, renderThumbnail, score, loadHistory, saveResult, formatElapsed, mount,
};
})();
