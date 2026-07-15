# ArtzLoop

A collection of offline-capable generative art / drawing toys for the browser. Each toy is a self-contained app — draw with mouse, touch, or pen on a canvas — sharing a common save/load file format and procedural ambient audio. No backend, no login, no analytics, no network calls at runtime.

Open [index.html](index.html) to browse the full grid of toys.

## Toys

| # | Toy | Folder |
|---|-----|--------|
| 01 | Kaleidoscope mandala pad | [apps/01-kaleidoscope-mandala-pad](apps/01-kaleidoscope-mandala-pad/index.html) |
| 02 | Digital spirograph generator | [apps/02-spirograph](apps/02-spirograph/index.html) |
| 03 | Ink marbling / suminagashi simulator | [apps/03-ink-marbling](apps/03-ink-marbling/index.html) |
| 04 | Action-painting splatter simulator | [apps/04-splatter-paint](apps/04-splatter-paint/index.html) |
| 05 | Perlin flow-field particle painter | [apps/05-flow-field](apps/05-flow-field/index.html) |
| 06 | Pixel-art flipbook animator | [apps/06-pixel-flipbook](apps/06-pixel-flipbook/index.html) |
| 07 | Bubble painting simulator | [apps/07-bubble-paint](apps/07-bubble-paint/index.html) |
| 08 | Digital string-art loom | [apps/08-string-art](apps/08-string-art/index.html) |
| 09 | Voronoi stained-glass generator | [apps/09-voronoi-glass](apps/09-voronoi-glass/index.html) |
| 10 | Cellular-automata art generator | [apps/10-cellular-automata](apps/10-cellular-automata/index.html) |
| 11 | Kaleidoscope photo tiler | [apps/11-kaleidoscope-photo-tiler](apps/11-kaleidoscope-photo-tiler/index.html) |
| 12 | Snowflake generator | [apps/12-snowflake-generator](apps/12-snowflake-generator/index.html) |
| 13 | Sacred-geometry overlay pad | [apps/13-sacred-geometry-pad](apps/13-sacred-geometry-pad/index.html) |

See [artzloop.md](artzloop.md) for the full toy spec and the master build prompt used to generate each one.

## Running locally

No install and no build step — every toy runs by opening its `index.html` directly in a browser (`file://` works fine).

To serve the whole collection over `http://localhost` instead (needed if you want relative links between toys and the gallery to behave like a real site):

```bash
npm run dev
```

This starts a static file server at the repo root — open `http://localhost:8080` for the toy grid.

## Repo layout

- `index.html` — root launcher: card grid linking to every toy.
- `apps/` — one folder per toy, each with its own `index.html`, `style.css`, and `script.js`.
- `shared/` — code shared across toys: `toy-core.js` (control bar UI, zoom, save/load, autosave, ambient audio), `artz-format.js`, `ambient-pad.js`.
- `gallery/` — app for browsing saved `.art` files by thumbnail (in progress).
- `artzloop.md` — source spec: toy list + master build prompt template.
- `.claude/` — Claude Code project configuration (rules, agents, skills used to generate and maintain the toys).

## Save file format

Each toy saves to a `.art` file — a renamed `.zip` containing `data.json` (state + parameters) and `preview.png` (a thumbnail). Load a `.art` file via each toy's Load button or by dragging it onto the canvas.

## CI

A [CI check](.github/workflows/ci.yml) verifies the launcher grid in `index.html` stays in sync with the folders in `apps/` on every push and pull request.

## Contributing / building a new toy

See [.claude/rules/workflows.md](.claude/rules/workflows.md) for the toy-authoring workflow, and [.claude/rules/technical-defaults.md](.claude/rules/technical-defaults.md) / [.claude/rules/design.md](.claude/rules/design.md) for the technical and UX conventions every toy follows.

## License

[MIT](LICENSE)
