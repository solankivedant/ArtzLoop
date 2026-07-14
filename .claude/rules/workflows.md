# Workflows

## Building a new toy

1. Pick the next unbuilt idea from the numbered list in `artzloop.md`.
2. Fill in the bracketed parts of the "Master build prompt" in `artzloop.md` (APP_NAME, CONCEPT, mechanic-specific interaction, EXT) - or use the `.claude/skills/new-toy` skill, which does this step for you.
3. Create `apps/<NN>-<kebab-case-name>/` and put the toy's `index.html`, `style.css`, `script.js` (and any assets) there. `NN` is the number from the idea list, zero-padded.
4. Implement save/load and ambient audio by reusing `shared/` rather than rewriting them - copy the relevant module into `script.js` rather than reimplementing it, or import it if using the Vite path.
5. Follow `.claude/rules/technical-defaults.md` and `.claude/rules/design.md` for every implementation decision not spelled out in the per-toy CONCEPT.

## Testing a toy before calling it done

- Open the toy directly (double-click `index.html`, or serve statically) and manually exercise it - type-checking or a test suite alone does not verify a canvas/pointer-driven UI.
- Golden path: draw/interact with the core mechanic, confirm the control bar sliders/inputs affect it live, save a file, reload the page, load the saved file back, and confirm state (including parameters and canvas contents) is restored exactly.
- Edge cases to check: resizing the window/canvas, touch input (or a touch-emulation devtools mode), mute/unmute persists across reload, localStorage autosave resume prompt appears after a refresh mid-session.
- Confirm the app has zero network requests at runtime (check devtools Network tab) aside from the initial load of CDN scripts (Tone.js, JSZip).

## Adding to the gallery

- Once a toy has a working `.art` (or its own extension) save format, register it with the `gallery/` app so saved files from that toy can be browsed by thumbnail.
- The gallery must stay read-only and static-hostable - no new backend requirements introduced here either.

## When toys diverge from the shared format

- If a toy is going to be sold as a standalone product (see `artzloop.md` notes on "one extension or many"), it may use its own file extension instead of `.art`. Note this explicitly in that toy's folder (e.g. a one-line note at the top of its `index.html`) so it's clear it's intentionally not gallery-compatible.
