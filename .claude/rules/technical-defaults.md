# Technical defaults

Applies to every toy in `apps/` and to `shared/` and `gallery/`, unless a toy's own spec explicitly overrides it.

## Stack

- Each toy lives in its own `apps/<NN>-<kebab-case-name>/` folder as three files: `index.html`, `style.css`, `script.js` - linked with plain `<link rel="stylesheet">` / `<script src="script.js">` tags (no `type="module"`), so the folder still works from `file://` or any static host with no build step and no server.
  - A Vite + vanilla TypeScript project is acceptable if a toy needs component structure, as long as the shipped artifact is still a static bundle with no backend.
- Rendering: HTML5 Canvas 2D API. Use `requestAnimationFrame` for any continuous animation loop - never `setInterval` for frame-driven rendering.
- Input: Pointer Events (`pointerdown`/`pointermove`/`pointerup`), not raw mouse-only events, so mouse, touch, and pen all work.
- JavaScript: vanilla ES2020+. No framework required; if component structure is genuinely needed, plain Web Components or Preact only.
- Audio: Tone.js via CDN for procedurally generated ambient background sound. Never embed licensed/recorded music files.
- Save file packaging: JSZip via CDN.
- No external database, no backend, no network calls at runtime. All state lives in the exported file plus optional `localStorage` autosave.

## Save / load format

- Container: a renamed `.zip` (shared `.art` extension across all toys unless a toy is being sold standalone, in which case it may use its own extension - see `artzloop.md` notes).
- Contents: `data.json` (`{ appVersion, createdAt, canvasWidth, canvasHeight, state, parameters, ... }`) plus `preview.png` (base64 PNG thumbnail of the current canvas).
- Save: build the JSON, zip with JSZip, trigger download via `Blob` + `<a download>`.
- Load: accept via `<input type="file">` or drag-and-drop onto the canvas, unzip with JSZip, parse `data.json`, restore canvas size, replay/repaint state, re-apply every parameter to the UI controls.
- Autosave to `localStorage` roughly every 10 seconds; on load, offer a "resume last session?" prompt if local data exists.
- Always bump/check `appVersion` on load so old saves degrade gracefully instead of throwing.

## What not to add

- No sign-in, accounts, or telemetry/analytics in any toy.
- No server-side code, no API calls, no third-party trackers.
- No licensed audio/music assets - ambient sound is always generated in-browser via Tone.js.
