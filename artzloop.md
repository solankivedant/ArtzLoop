# 12 generative art / drawing tools

Same family as the kaleidoscope pad above: single-page browser apps, no backend, no login. Each one saves your session to a small downloadable file with its own extension, and you can re-upload that file later to pick up exactly where you left off.

1. **Kaleidoscope mandala pad** - draw with the cursor, it mirrors into an N-fold symmetric pattern in real time.
2. **Digital spirograph generator** - sliders for gear ratio and pen offset trace looping geometric curves.
3. **Ink marbling / suminagashi simulator** - drop simulated ink onto a virtual water surface, swirl with the cursor, then "print" it onto paper.
4. **Action-painting splatter simulator** - flick the cursor like a loaded brush; physics-based paint splatters across the canvas.
5. **Pixel-art flipbook animator** - draw on a small pixel grid across multiple frames and preview them as a looping animation.
6. **Bubble painting simulator** - simulated soap bubbles pop on contact with the canvas, leaving circular color blooms.
7. **Digital string-art loom** - place pegs around a shape; the app auto-generates the thread paths between them.
8. **Kaleidoscope photo tiler** - upload any photo, then drag a lens over it; the app tiles and mirrors whatever's under the lens into a live kaleidoscope pattern.
9. **Snowflake generator** - locked to 6-fold symmetry with a cool blue/white palette and a subtle "freeze" animation when you finish a shape.
10. **Sacred-geometry overlay pad** - draw circles and lines that snap to a Metatron's-cube-style grid, with symmetry applied across multiple axes at once.
11. **Block painting** - a relaxing tile/mosaic painter: tap or drag across an adjustable grid (16×16 up to 48×48) to paint tactile, beveled blocks with a 12+ color palette, a 3×3 brush, a fill bucket, an eraser, and optional mirror symmetry (horizontal/vertical/quad).
12. **Coloring game** - pick from built-in coloring templates (mandala, flower garden, abstract waves, geometric animal, cosmic pattern), tap a closed region to fill it with the selected color, recolor freely with solid/gradient/speckle fill styles.

## Notes on a couple of details

- **Numbering:** each entry's number matches its `apps/NN-` folder prefix, kept in sync whenever a tool is added or removed.
- **Why a zip instead of raw JSON:** bundling the thumbnail alongside the data means you can build a simple "gallery" screen later that shows previews of saved files without having to reopen and re-render each one.
- **Why Tone.js instead of an mp3:** generating the ambient pad in-browser means the whole app stays a single file with zero licensing risk - no need to source or clear a music track.
- **One extension or many:** using one shared extension (e.g. `.art`) across all 20 tools is simpler if you want a single "gallery" app that opens files from any of them; a unique extension per tool is friendlier if you're selling them as separate products.



