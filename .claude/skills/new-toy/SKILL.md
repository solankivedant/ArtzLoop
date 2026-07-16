---
name: new-toy
description: Scaffold a new ArtzLoop generative art tool from the master build prompt in artzloop.md. Use when starting to build one of the 20 tool ideas, or any new tool added to the list later.
---

# New tool

Scaffolds a single tool from the "Master build prompt" template in [artzloop.md](../../../artzloop.md).

## Steps

1. Ask (or infer from the user's request) which tool idea from the numbered list in `artzloop.md` to build, if not already specified.
2. Read `artzloop.md` in full - the CONCEPT and mechanic-specific behavior for each idea are only sketched in the numbered list; do not invent behavior that contradicts it.
3. Fill in the master build prompt template's bracketed placeholders:
   - `APP_NAME` - a short, specific name for the tool.
   - `CONCEPT` - expand the 1-sentence idea-list description into the 1-2 sentence concept.
   - The mechanic-specific bullet under CORE INTERACTION - describe precisely what a single stroke/interaction produces (e.g. "each stroke is mirrored N times around the center point" for the kaleidoscope pad).
   - `EXT` and `[default-name]` - use the shared `.artz` extension unless the user has said this tool is a standalone sale item (see `artzloop.md`'s "one extension or many" note), in which case pick a tool-specific extension.
4. Apply `.claude/rules/technical-defaults.md`, `.claude/rules/workflows.md`, and `.claude/rules/design.md` - the filled-in prompt is the concept brief, those rule files are the implementation contract.
5. Create `apps/<NN>-<kebab-case-name>/index.html` (`NN` = the idea's number in the list, zero-padded to 2 digits) and implement it there, reusing `shared/` for save/load and ambient audio rather than reimplementing them inline.
6. Before reporting the tool done, follow the testing steps in `.claude/rules/workflows.md` - open it in a browser and actually exercise draw → save → reload → load.
