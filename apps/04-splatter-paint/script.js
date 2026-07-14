
"use strict";
/* shared math helpers available to every toy */
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

/* #06 Action Splatter - flick the cursor like a loaded brush; droplets fly
 * off with your gesture's velocity and land as elongated splats. Every splat
 * is kept as vector data in the save file, so old sessions stay editable. */
(function(){
let api, drops = [], splats = [], lastP = null, lastT = 0, down = false, hue = 0;
function drawSplat(s){
  const c = api.ctx, rnd = mulberry32(s.seed);
  c.save();
  c.translate(s.x, s.y); c.rotate(s.ang);
  c.fillStyle = s.col;
  c.beginPath(); c.ellipse(0, 0, s.r*s.st, s.r, 0, 0, 7); c.fill();
  const n = 2 + Math.floor(rnd()*4);
  for (let i = 0; i < n; i++){
    const rx = s.r*s.st + rnd()*s.r*3, ry = (rnd()-.5)*s.r*2;
    c.beginPath(); c.arc(rx, ry, rnd()*s.r*.34 + .4, 0, 7); c.fill();
  }
  c.restore();
}
function land(d){
  const s = {
    x:Math.round(d.x*10)/10, y:Math.round(d.y*10)/10,
    r:Math.round(d.r*10)/10,
    ang:Math.round(Math.atan2(d.vy, d.vx)*100)/100,
    st:Math.round((1 + Math.min(2.2, Math.hypot(d.vx, d.vy)/140))*100)/100,
    col:d.col, seed:(Math.random()*1e9)|0,
  };
  splats.push(s);
  drawSplat(s);
  api.dirty();
}
window.TOY = {
  id:"splatter", file:"splatter.art",
  params:[
    { k:"tool", t:"icons", l:"", v:"brush", opts:[
      ["brush", '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/></svg>', "Brush"],
      ["eraser", '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>', "Eraser"],
    ]},
    { k:"flow",   t:"range", l:"Flow",   min:1, max:30, step:1, v:10, tool:"brush" },
    { k:"spread", t:"range", l:"Spread", min:0, max:100, step:1, v:45, u:"%", tool:"brush" },
    { k:"size",   t:"range", l:"Size",   min:1, max:20, step:.5, v:7, u:"px", tool:"brush" },
    { k:"esize",  t:"range", l:"Eraser", min:4, max:120, step:1, v:28, u:"px", tool:"eraser" },
    { k:"col",     t:"color",  l:"Paint",   v:"#e63946" },
    { k:"rainbow", t:"toggle", l:"Rainbow", v:false },
  ],
  init(a){ api = a; },
  pointer(type, x, y){
    const now = performance.now();
    if (type === "down"){ down = true; lastP = [x, y]; lastT = now; return; }
    if (type === "up"){ down = false; lastP = null; return; }
    if (!down || !lastP) return;
    const dt = Math.max(8, now - lastT)/1000;
    const vx = (x-lastP[0])/dt, vy = (y-lastP[1])/dt;
    const speed = Math.hypot(vx, vy);
    const n = Math.round(api.P.flow*Math.min(1.6, .25 + speed/900));
    for (let i = 0; i < n; i++){
      const sp = api.P.spread/100;
      const a = Math.random()*Math.PI*2, m = Math.random()*speed*sp*.6;
      hue = (hue + 7)%360;
      drops.push({
        x, y,
        vx: vx*.4 + Math.cos(a)*m, vy: vy*.4 + Math.sin(a)*m,
        r: (.35 + Math.random()*.9)*api.P.size,
        col: api.P.rainbow ? hsl(hue, 85, 58) : api.P.col,
      });
    }
    lastP = [x, y]; lastT = now;
  },
  frame(dt){
    for (let i = drops.length-1; i >= 0; i--){
      const d = drops[i];
      d.x += d.vx*dt; d.y += d.vy*dt;
      d.vx *= .88; d.vy *= .88;
      if (Math.hypot(d.vx, d.vy) < 60){ land(d); drops.splice(i, 1); }
    }
  },
  overlay(c){
    for (const d of drops){
      c.fillStyle = d.col;
      c.beginPath(); c.arc(d.x, d.y, d.r*.8, 0, 7); c.fill();
    }
  },
  clear(){ drops = []; splats = []; api.clearWorld(); },
  serialize(){ return { splats }; },
  restore(s){
    drops = [];
    api.clearWorld();
    if (s && s.splats){ splats = s.splats; for (const sp of splats) drawSplat(sp); }
    else if (s && s.png){ splats = []; api.drawDataURL(s.png); } // pre-2.1 saves
    else splats = [];
  },
};
})();

/* ArtzLoop core runtime - canonical copy lives in shared/toy-core.js.
 * Owns: floating tool panel, camera (pan/zoom over an auto-growing "infinite"
 * world canvas), black/white background, undo/redo history, download/upload
 * (.art), localStorage autosave + resume, generative music, toy-grid popup.
 * The toy supplies window.TOY (id, file, params, init, pointer, frame,
 * overlay, clear, serialize, restore, onParam, bgChanged, pixelated). */
(function(){
const T = window.TOY;
const $ = id => document.getElementById(id);
const APP_VERSION = "2.2.0";
const KEY_AUTO = "artzloop." + T.id + ".autosave";
const KEY_BG = "artzloop.bg", KEY_MUTE = "artzloop.muted", KEY_TRACK = "artzloop.track";
const KEY_PANEL = "artzloop.panel";
const KEY_ERASER = "artzloop.eraserSize";
const BGCOL = { dark:"#0b0b13", light:"#f6f4ef" };
const BACKING_MAX = 48e6; // max world backing pixels (~192MB RGBA)

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
let onToolSwitch = null; // set once the eraser section (below) exists, so switching tools can update the canvas cursor
// Every param renders inline in the sidebar EXCEPT ones tagged with a
// `tool:"<key>"` field matching one of the tool-switcher's own option keys -
// those live in a small popup that opens off that specific tool icon (e.g.
// Symmetry + Brush size behind the Brush icon, Erase mode + Eraser size
// behind the Eraser icon), the same pattern a toy would hand-roll itself,
// just declarative. Untagged controls (Mirror, Rainbow, ...) stay visible
// in the sidebar by default - there's no generic catch-all settings dump.
function buildControls(){
  const host = $("controls");
  // every param's value goes live in PV immediately, even ones whose DOM
  // control is built lazily inside a tool popup - a param a toy reads every
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
  // control (Mirror, Rainbow, ...) in its declared order - a fixed reading
  // order every toy shares: tools, color, on/off extras.
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
// clicking the already-open tool's icon again closes it - same toggle
// behavior a hand-wired per-toy popup would have.
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
const PAL_BRAND = ["#5ee6ff","#6d7cff","#3fd8d0","#f4c542"]; // ArtzLoop accents, incl. this toy's default
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

/* ---- api handed to the toy ------------------------------------------ */
const api = {
  get W(){ return W; }, get H(){ return H; },
  get ctx(){ return wctx; }, get world(){ return world; },
  P: PV,
  bg: () => bgMode,
  ink: () => bgMode === "dark" ? "#eceaf6" : "#20202c",
  grow(x, y){ ensureVisible(x, y); }, // let toys extend the world beyond the pointer
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
};

/* ---- camera / blit ----------------------------------------------------- */
function viewSize(){
  const r = screen.getBoundingClientRect();
  return { vw:r.width, vh:r.height };
}
// faint world-space grid under the art - follows pan/zoom, never saved.
// Two levels: zooming in fades a finer sub-grid into each cell.
function drawGrid(v){
  if (!gridOn) return;
  const cell = 44;
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
  drawRasterRotatePreview(v);
  if (T.overlay){
    sctx.save();
    sctx.translate(v.vw/2 - camX*zoom, v.vh/2 - camY*zoom);
    sctx.scale(zoom, zoom);
    T.overlay(sctx);
    sctx.restore();
  }
  drawEraserCursorRing(v);
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
  if (eraserActive()){
    if (PV.esize != null){
      const p = T.params.find(pp => pp.k === "esize");
      let v = PV.esize * (e.deltaY < 0 ? 1.12 : 1/1.12);
      if (p) v = Math.max(p.min, Math.min(p.max, v));
      PV.esize = v;
      if (setters.esize) setters.esize(v);
      if (T.onParam) T.onParam("esize", v);
    } else {
      eraserSize = Math.max(4, Math.min(240, eraserSize * (e.deltaY < 0 ? 1.12 : 1/1.12)));
      try { localStorage.setItem(KEY_ERASER, eraserSize); } catch (err) {}
    }
    return;
  }
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

/* ---- pointer input: pan vs toy ------------------------------------------ */
let panMode = false, spaceHeld = false, panning = null;
const panBtn = $("panBtn");
panBtn.onclick = () => {
  panMode = !panMode;
  panBtn.classList.toggle("active", panMode);
  if (panMode) screen.style.cursor = "grab";
  else if (onToolSwitch) onToolSwitch();
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
    if (!panMode){ if (onToolSwitch) onToolSwitch(); else screen.style.cursor = "crosshair"; }
  }
});
function toWorldXY(clientX, clientY){
  const r = screen.getBoundingClientRect();
  return [camX + (clientX - r.left - r.width/2)/zoom,
          camY + (clientY - r.top - r.height/2)/zoom];
}
function ptr(type, e){
  if (selectMode) return;
  const evs = (type === "move" && e.getCoalescedEvents) ? e.getCoalescedEvents() : [e];
  for (const ev of evs){
    const p = toWorldXY(ev.clientX, ev.clientY);
    if (eraserActive()){
      eraserCursor = p;
      if (type === "down") erasing = true;
      else if (type === "up"){ erasing = false; continue; }
      if (erasing){
        ensureVisible(p[0] - eraserSize, p[1] - eraserSize);
        ensureVisible(p[0] + eraserSize, p[1] + eraserSize);
        eraseAtWorld(p[0], p[1]);
        dirtyFlag = true; scheduleSnapshot();
      }
      continue;
    }
    if (!T.pointer) continue;
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
  ptr("down", e);
});
screen.addEventListener("pointermove", e => {
  if (panning){
    camX -= (e.clientX - panning[0])/zoom;
    camY -= (e.clientY - panning[1])/zoom;
    panning = [e.clientX, e.clientY];
    return;
  }
  ptr("move", e);
});
function endPtr(e){
  if (panning){
    panning = null;
    if (panMode || spaceHeld) screen.style.cursor = "grab";
    else if (onToolSwitch) onToolSwitch();
    else screen.style.cursor = "crosshair";
    return;
  }
  ptr("up", e);
}
screen.addEventListener("pointerup", endPtr);
screen.addEventListener("pointercancel", endPtr);

/* ---- select-all + rotate/delete -----------------------------------------
 * Uses the toy's own precise per-object hooks (T.selectAll/getSelectionBBox/
 * deleteSelection/rotateSelectionStart/Preview/Commit[/getGlobalRot]) when it
 * provides them - e.g. a toy with discrete vector strokes can rotate each
 * object individually. Any toy that doesn't provide those hooks gets a
 * generic whole-canvas raster fallback instead: "select" grabs everything
 * currently drawn (via contentBBox), "rotate" spins a snapshot of those
 * pixels as one rigid image and bakes it back in on release, "delete" clears
 * the canvas. This makes the bottom-bar Select tool work the same way in
 * every toy regardless of its internal data model. */
const selectBtn = $("selectBtn"), selDeleteBtn = $("selDelete"), selRotateBtn = $("selRotate"), rotDeg = $("rotDeg");
let selectMode = false, rotating = null, curDragDelta = 0, rasterRot = null;
function hasVectorSelect(){
  return !!(T.selectAll && T.getSelectionBBox && T.deleteSelection &&
    T.rotateSelectionStart && T.rotateSelectionPreview && T.rotateSelectionCommit);
}
function rasterBBox(){
  const b = contentBBox();
  return { x0:b.x, y0:b.y, x1:b.x + b.w, y1:b.y + b.h };
}
function currentSelBBox(){
  if (!selectBtn) return null;
  if (hasVectorSelect()) return T.getSelectionBBox();
  return selectMode ? rasterBBox() : null;
}
function rasterRotateStart(bbox){
  const cx = (bbox.x0 + bbox.x1)/2, cy = (bbox.y0 + bbox.y1)/2;
  const w = Math.max(1, bbox.x1 - bbox.x0), h = Math.max(1, bbox.y1 - bbox.y0);
  const diag = Math.ceil(Math.hypot(w, h)) + 16; // square big enough to hold any rotation
  ensureVisible(cx - diag/2, cy - diag/2); ensureVisible(cx + diag/2, cy + diag/2);
  const snap = document.createElement("canvas");
  snap.width = diag; snap.height = diag;
  snap.getContext("2d").drawImage(world,
    (cx - diag/2 - wx0)*wdpr, (cy - diag/2 - wy0)*wdpr, diag*wdpr, diag*wdpr,
    0, 0, diag, diag);
  rasterRot = { snap, diag, cx, cy };
}
function rasterRotateCommit(){
  if (!rasterRot) return;
  const { snap, diag, cx, cy } = rasterRot;
  ensureVisible(cx - diag/2, cy - diag/2); ensureVisible(cx + diag/2, cy + diag/2);
  wctx.clearRect(cx - diag/2, cy - diag/2, diag, diag);
  wctx.save();
  wctx.translate(cx, cy);
  wctx.rotate(curDragDelta);
  wctx.drawImage(snap, -diag/2, -diag/2, diag, diag);
  wctx.restore();
  rasterRot = null;
  dirtyFlag = true; scheduleSnapshot();
}
function drawRasterRotatePreview(v){
  if (!rasterRot || !rotating) return;
  const { snap, diag, cx, cy } = rasterRot;
  const sx = v.vw/2 + (cx - camX)*zoom, sy = v.vh/2 + (cy - camY)*zoom;
  sctx.fillStyle = BGCOL[bgMode];
  sctx.fillRect(sx - diag/2*zoom - 2, sy - diag/2*zoom - 2, diag*zoom + 4, diag*zoom + 4);
  sctx.save();
  sctx.translate(sx, sy);
  sctx.rotate(curDragDelta);
  sctx.drawImage(snap, -diag/2*zoom, -diag/2*zoom, diag*zoom, diag*zoom);
  sctx.restore();
}
function toScreenXY(wx, wy){
  const v = viewSize(), r = screen.getBoundingClientRect();
  return [r.left + v.vw/2 + (wx - camX)*zoom, r.top + v.vh/2 + (wy - camY)*zoom];
}
function showRotDeg(){
  const base = hasVectorSelect() ? ((T.getGlobalRot && T.getGlobalRot()) || 0) : 0;
  const deg = Math.round((((base + curDragDelta)*180/Math.PI + 180) % 360 + 360) % 360 - 180);
  rotDeg.textContent = (deg > 0 ? "+" : "") + deg + "°";
  const r = selRotateBtn.getBoundingClientRect();
  rotDeg.style.left = (r.left + r.width/2) + "px";
  rotDeg.style.top = (r.bottom + 8) + "px";
  rotDeg.classList.add("show");
}
function positionSelectUI(){
  if (!selectBtn) return;
  const bbox = currentSelBBox();
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
if (selectBtn){
  selectBtn.onclick = () => {
    selectMode = !selectMode;
    selectBtn.classList.toggle("active", selectMode);
    if (selectMode){
      if (panMode){ panMode = false; panBtn.classList.remove("active"); }
      if (hasVectorSelect()) T.selectAll();
    } else if (hasVectorSelect()) T.clearSelection();
    if (selectMode) screen.style.cursor = "crosshair";
    else if (onToolSwitch) onToolSwitch();
  };
  selDeleteBtn.onclick = () => {
    if (hasVectorSelect()){ T.deleteSelection(); return; }
    if (!confirm("Clear the whole canvas?")) return;
    T.clear();
    camX = W/2; camY = H/2; setZoom(1);
    dirtyFlag = true; scheduleSnapshot();
    selectMode = false; selectBtn.classList.remove("active");
  };
  selRotateBtn.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    selRotateBtn.setPointerCapture(e.pointerId);
    const p = toWorldXY(e.clientX, e.clientY);
    const bbox = currentSelBBox();
    const cx = hasVectorSelect() ? W/2 : (bbox.x0 + bbox.x1)/2;
    const cy = hasVectorSelect() ? H/2 : (bbox.y0 + bbox.y1)/2;
    rotating = { cx, cy, start: Math.atan2(p[1] - cy, p[0] - cx) };
    curDragDelta = 0;
    if (hasVectorSelect()) T.rotateSelectionStart();
    else rasterRotateStart(bbox);
    showRotDeg();
  });
  selRotateBtn.addEventListener("pointermove", e => {
    if (!rotating) return;
    const p = toWorldXY(e.clientX, e.clientY);
    curDragDelta = Math.atan2(p[1] - rotating.cy, p[0] - rotating.cx) - rotating.start;
    if (hasVectorSelect()) T.rotateSelectionPreview(curDragDelta);
    showRotDeg();
  });
  const endRotate = () => {
    if (!rotating) return;
    rotating = null;
    if (hasVectorSelect()) T.rotateSelectionCommit();
    else rasterRotateCommit();
    curDragDelta = 0;
    showRotDeg();
  };
  selRotateBtn.addEventListener("pointerup", endRotate);
  selRotateBtn.addEventListener("pointercancel", endRotate);
}

/* ---- generic raster eraser ----------------------------------------------
 * Eraser is a sidebar tool icon like any other (not a separate bottom-bar
 * toggle) - a toy declares an "eraser" option on its own "tool" icons param,
 * same as it would for "brush". If the toy handles that value itself inside
 * T.pointer(), it sets T.customEraser = true to opt out; otherwise this
 * erases pixels straight out of the world canvas whenever that tool is
 * active, so any toy gets a working eraser with zero extra per-toy code.
 * The eraser's radius uses the toy's own "esize" param when it declares one
 * (grouped in the Eraser icon's popup, same as a hand-built one would be);
 * otherwise it falls back to a shared size, adjustable with the scroll
 * wheel while the tool is active. Any toy that repaints its own state fresh
 * every frame (e.g. a live simulation) will paint back over an erased area
 * on the next tick; toys whose canvas is the persistent record of what's
 * been drawn (most of them) keep the erase. */
let erasing = false, eraserCursor = null;
let eraserSize = +localStorage.getItem(KEY_ERASER) || 28;
function eraserActive(){ return !T.customEraser && PV.tool === "eraser"; }
function currentEraserSize(){ return PV.esize != null ? PV.esize : eraserSize; }
function eraseAtWorld(wx, wy){
  wctx.save();
  wctx.globalCompositeOperation = "destination-out";
  wctx.beginPath(); wctx.arc(wx, wy, currentEraserSize()/2, 0, Math.PI*2); wctx.fill();
  wctx.restore();
}
function drawEraserCursorRing(v){
  if (!eraserActive() || !eraserCursor) return;
  const sx = v.vw/2 + (eraserCursor[0] - camX)*zoom, sy = v.vh/2 + (eraserCursor[1] - camY)*zoom;
  sctx.save();
  sctx.strokeStyle = "rgba(255,110,130,.85)";
  sctx.lineWidth = 1.5; sctx.setLineDash([4, 4]);
  sctx.beginPath(); sctx.arc(sx, sy, currentEraserSize()/2*zoom, 0, Math.PI*2); sctx.stroke();
  sctx.restore();
}
onToolSwitch = () => {
  screen.style.cursor = eraserActive() ? "none" : ((panMode || spaceHeld) ? "grab" : "crosshair");
};
window.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = (e.target && e.target.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  const k = e.key.toLowerCase();
  if (k === "s" && selectBtn){ e.preventDefault(); selectBtn.click(); }
  else if ((e.key === "Delete" || e.key === "Backspace") && selectMode && selDeleteBtn){
    e.preventDefault(); selDeleteBtn.click();
  }
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
  if (e.altKey && k === "c"){
    e.preventDefault();
    const sw = document.querySelector('[data-key="col"] .swatch');
    if (sw) sw.click();
    return;
  }
  if (ctrl || e.altKey || typingInField(e)) return;
  if (k === "b"){ applyParams({ tool:"brush" }); }
  else if (k === "e"){ applyParams({ tool:"eraser" }); }
});

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
    if (data.app !== T.id) throw new Error('This file was saved by "' + data.app + '", not this toy.');
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

/* ---- toy-grid popup ------------------------------------------------------ */
const modal = $("modal");
$("toysBtn").onclick = () => modal.classList.add("show");
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

