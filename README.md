# ArtzLoop

A collection of offline-capable generative art / drawing tools for the browser. Each tool is a self-contained app — draw with mouse, touch, or pen on a canvas — sharing a common save/load file format and procedural ambient audio. No backend, no login, no analytics, no network calls at runtime.

Open [index.html](index.html) to browse the full grid of tools.

## Tools

| # | Tool | Folder |
|---|-----|--------|
| 01 | Kaleidoscope mandala pad | [apps/01-kaleidoscope-mandala-pad](apps/01-kaleidoscope-mandala-pad/index.html) |
| 02 | Digital spirograph generator | [apps/02-spirograph](apps/02-spirograph/index.html) |
| 03 | Ink marbling / suminagashi simulator | [apps/03-ink-marbling](apps/03-ink-marbling/index.html) |
| 04 | Action-painting splatter simulator | [apps/04-splatter-paint](apps/04-splatter-paint/index.html) |
| 05 | Pixel-art flipbook animator | [apps/05-pixel-flipbook](apps/05-pixel-flipbook/index.html) |
| 06 | Bubble painting simulator | [apps/06-bubble-paint](apps/06-bubble-paint/index.html) |
| 07 | Digital string-art loom | [apps/07-string-art](apps/07-string-art/index.html) |
| 08 | Kaleidoscope photo tiler | [apps/08-kaleidoscope-photo-tiler](apps/08-kaleidoscope-photo-tiler/index.html) |
| 09 | Snowflake generator | [apps/09-snowflake-generator](apps/09-snowflake-generator/index.html) |
| 10 | Sacred-geometry overlay pad | [apps/10-sacred-geometry-pad](apps/10-sacred-geometry-pad/index.html) |
| 11 | Block painting | [apps/11-block-painting](apps/11-block-painting/index.html) |
| 12 | Coloring game | [apps/12-coloring-game](apps/12-coloring-game/index.html) |

See [artzloop.md](artzloop.md) for the full tool spec and the master build prompt used to generate each one.

## Running locally

No install and no build step — every tool runs by opening its `index.html` directly in a browser (`file://` works fine).

To serve the whole collection over `http://localhost` instead (needed if you want relative links between tools and the gallery to behave like a real site):

```bash
npm run dev
```

This starts a static file server at the repo root — open `http://localhost:8080` for the tool grid.

## Repo layout

- `index.html` — root launcher: card grid linking to every tool.
- `apps/` — one folder per tool, each with its own `index.html`, `style.css`, and `script.js`.
- `shared/` — code shared across tools: `tool-core.js` (control bar UI, zoom, save/load, autosave, ambient audio), `artz-format.js`, `ambient-pad.js`.
- `gallery/` — app for browsing saved `.art` files by thumbnail (in progress).
- `artzloop.md` — source spec: tool list + master build prompt template.
- `.claude/` — Claude Code project configuration (rules, agents, skills used to generate and maintain the tools).

## Save file format

Each tool saves to a `.art` file — a renamed `.zip` containing `data.json` (state + parameters) and `preview.png` (a thumbnail). Load a `.art` file via each tool's Load button or by dragging it onto the canvas.

## CI

A [CI check](.github/workflows/ci.yml) verifies the launcher grid in `index.html` stays in sync with the folders in `apps/` on every push and pull request.

## Contributing / building a new tool

See [.claude/rules/workflows.md](.claude/rules/workflows.md) for the tool-authoring workflow, and [.claude/rules/technical-defaults.md](.claude/rules/technical-defaults.md) / [.claude/rules/design.md](.claude/rules/design.md) for the technical and UX conventions every tool follows.

## License

[MIT](LICENSE)
