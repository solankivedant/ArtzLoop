# 13 generative art / drawing toys

Same family as the kaleidoscope pad above: single-page browser apps, no backend, no login. Each one saves your session to a small downloadable file with its own extension, and you can re-upload that file later to pick up exactly where you left off.

1. **Kaleidoscope mandala pad** - draw with the cursor, it mirrors into an N-fold symmetric pattern in real time.
2. **Digital spirograph generator** - sliders for gear ratio and pen offset trace looping geometric curves.
3. **Ink marbling / suminagashi simulator** - drop simulated ink onto a virtual water surface, swirl with the cursor, then "print" it onto paper.
4. **Action-painting splatter simulator** - flick the cursor like a loaded brush; physics-based paint splatters across the canvas.
5. **Perlin flow-field particle painter** - hundreds of particles drift along an invisible noise field, leaving trailing color streaks.
6. **Pixel-art flipbook animator** - draw on a small pixel grid across multiple frames and preview them as a looping animation.
7. **Bubble painting simulator** - simulated soap bubbles pop on contact with the canvas, leaving circular color blooms.
8. **Digital string-art loom** - place pegs around a shape; the app auto-generates the thread paths between them.
9. **Voronoi stained-glass generator** - click points on the canvas; cells auto-generate and can be colored like stained glass.
10. **Cellular-automata art generator** - simple rule sets (Conway's-life-style) evolve a colorful grid frame by frame.
11. **Kaleidoscope photo tiler** - upload any photo, then drag a lens over it; the app tiles and mirrors whatever's under the lens into a live kaleidoscope pattern.
12. **Snowflake generator** - locked to 6-fold symmetry with a cool blue/white palette and a subtle "freeze" animation when you finish a shape.
13. **Sacred-geometry overlay pad** - draw circles and lines that snap to a Metatron's-cube-style grid, with symmetry applied across multiple axes at once.

## Notes on a couple of details

- **Why a zip instead of raw JSON:** bundling the thumbnail alongside the data means you can build a simple "gallery" screen later that shows previews of saved files without having to reopen and re-render each one.
- **Why Tone.js instead of an mp3:** generating the ambient pad in-browser means the whole app stays a single file with zero licensing risk - no need to source or clear a music track.
- **One extension or many:** using one shared extension (e.g. `.art`) across all 20 toys is simpler if you want a single "gallery" app that opens files from any of them; a unique extension per toy is friendlier if you're selling them as separate products.



