/*
 * ArtzLoop shared save/load module - the canonical .art implementation.
 *
 * .art is a renamed .zip containing:
 *   data.json    - { appVersion, app, createdAt, canvasWidth, canvasHeight, state, params }
 *   preview.png  - thumbnail of the canvas at save time
 *
 * Single-file tools inline a copy of these functions (marked "copied from
 * shared/artz-format.js"); Vite-based tools import this module directly.
 * Requires JSZip (CDN) to be loaded globally.
 */

const ARTZ_VERSION = "1.0.0";

/**
 * Package state into an .art blob and trigger a download.
 * @param {object} opts
 * @param {string} opts.app        short app id, e.g. "kaleido"
 * @param {HTMLCanvasElement} opts.canvas  source for the preview thumbnail
 * @param {object} opts.state      tool-specific state (strokes, cells, ...)
 * @param {object} opts.params     current UI parameter values
 * @param {string} opts.filename   download name, e.g. "mandala.art"
 */
async function saveArtz({ app, canvas, state, params, filename }) {
  if (typeof JSZip === "undefined") {
    throw new Error("JSZip not loaded - saving needs the JSZip CDN script.");
  }
  const data = {
    appVersion: ARTZ_VERSION,
    app,
    createdAt: new Date().toISOString(),
    canvasWidth: canvas.clientWidth,
    canvasHeight: canvas.clientHeight,
    state,
    params,
  };
  const zip = new JSZip();
  zip.file("data.json", JSON.stringify(data));
  zip.file("preview.png", makeThumbnail(canvas).split(",")[1], { base64: true });
  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Read an .art File back into { data, previewDataUrl }.
 * Throws if the file isn't a valid .art container for `app`
 * (pass app: null to accept any tool's file, e.g. in the gallery).
 */
async function loadArtz(file, { app = null } = {}) {
  if (typeof JSZip === "undefined") {
    throw new Error("JSZip not loaded - loading needs the JSZip CDN script.");
  }
  const zip = await JSZip.loadAsync(file);
  const entry = zip.file("data.json");
  if (!entry) throw new Error("Not an ArtzLoop file (missing data.json).");
  const data = JSON.parse(await entry.async("string"));
  if (app && data.app !== app) {
    throw new Error(`This file was saved by "${data.app}", not this tool.`);
  }
  const major = String(data.appVersion || "0").split(".")[0];
  if (major !== ARTZ_VERSION.split(".")[0]) {
    console.warn(`Loading save from format version ${data.appVersion}; current is ${ARTZ_VERSION}.`);
  }
  let previewDataUrl = null;
  const preview = zip.file("preview.png");
  if (preview) previewDataUrl = "data:image/png;base64," + (await preview.async("base64"));
  return { data, previewDataUrl };
}

/** 320px-wide PNG data URL of the canvas, for preview.png. */
function makeThumbnail(canvas, width = 320) {
  const scale = width / canvas.width;
  const thumb = document.createElement("canvas");
  thumb.width = width;
  thumb.height = Math.max(1, Math.round(canvas.height * scale));
  thumb.getContext("2d").drawImage(canvas, 0, 0, thumb.width, thumb.height);
  return thumb.toDataURL("image/png");
}

/* ---- localStorage autosave ---------------------------------------- */

/** Persist a lightweight session snapshot (no thumbnail) every call. */
function autosave(storageKey, { app, state, params }) {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ appVersion: ARTZ_VERSION, app, savedAt: Date.now(), state, params })
    );
  } catch {
    /* storage full or blocked - autosave is best-effort */
  }
}

/** Returns the parsed snapshot or null. */
function readAutosave(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearAutosave(storageKey) {
  try {
    localStorage.removeItem(storageKey);
  } catch {}
}
