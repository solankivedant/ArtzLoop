# ArtzLoop

A collection of single-page, offline-capable generative art / drawing tools for the browser. Each tool is its own self-contained app (mouse/touch/pen input on a canvas), with a shared save/load file format and shared procedural ambient audio. No backend, no login, no analytics.

The full product spec - the list of tool concepts and the reusable "master build prompt" used to generate each one - lives in [artzloop.md](artzloop.md). Read it before building or modifying any tool.

## Repo layout

- `artzloop.md` - source spec: tool list + master build prompt template.
- `index.html` - root launcher: numbered card grid with SVG reference thumbnails linking to all tools (each tool also has this grid as an in-app popup via the ▦ button).
- `apps/` - one folder per tool (e.g. `apps/01-kaleidoscope-mandala-pad/`), each with its own `index.html`, `style.css`, and `script.js`. All tools are generated from a shared template + core runtime + per-tool mechanic; the build sources live in the session scratchpad and the canonical runtime in `shared/tool-core.js`.
- `shared/` - code shared across tools: `tool-core.js` (control bar UI, zoom, black/white canvas toggle, save/load, autosave, ambient audio, tool-grid popup), plus `artz-format.js` and `ambient-pad.js` as standalone module copies. Tools copy this code into their own `script.js` rather than reimplementing it.
- `gallery/` - the gallery app that opens `.art` files and shows thumbnail previews across tools.
- `.claude/` - project-specific Claude Code configuration:
  - `rules/technical-defaults.md` - tech stack and architecture defaults every tool follows.
  - `rules/workflows.md` - how a new tool gets built, tested, and saved/loaded.
  - `rules/design.md` - UI/UX conventions shared across all tools.
  - `skills/new-tool/` - skill for scaffolding a new tool from the master prompt.
  - `agents/` - specialized agents for this project.

## Ground rules

- Every tool is a standalone deliverable: it must run by double-clicking `index.html`, no install step, no server, no network calls.
- Don't add a backend, database, or account system to any tool - state lives entirely in the exported `.art` file plus `localStorage` autosave.
- Reuse `shared/` for save/load and audio instead of duplicating that logic per tool.
- See `.claude/rules/` for the specifics before writing code.
