/*
 * Daily Challenge design pool for apps/01-kaleidoscope-mandala-pad.
 *
 * Loaded as a plain global script (before shared/daily-challenge.js) so the
 * whole thing still works from file:// with zero network calls - no fetch()
 * of a .json file, just a global array assignment.
 *
 * Each entry is { id, strokes:[{pts,col,size,sym,mir,rot}] } - the exact
 * shape apps/01-kaleidoscope-mandala-pad's "Download > Challenge design
 * .json" button exports. To add a real day's design: draw it in the tool,
 * click that download button, then paste the exported object in as a new
 * array element below.
 */
window.CHALLENGE_POOL_KALEIDOSCOPE = [
  // PLACEHOLDER - replace with real hand-curated / exported designs. This
  // one is just a small 3-stroke flourish (sym:6, mirrored) authored by hand
  // to prove the pick/render/score pipeline end-to-end: a petal outline, an
  // inner vein, and a small outer accent stroke, radiating out from near the
  // center so mirroring produces a simple flower/star shape.
  {
    id: "placeholder-01",
    strokes: [
      { pts: [[0.02, 0.05], [0.11, 0.22], [0.15, 0.40], [0.09, 0.56]], col: "#ff9de2", size: 0.028, sym: 6, mir: true, rot: 0 },
      { pts: [[0.00, 0.08], [0.05, 0.20], [0.04, 0.34]], col: "#5ee6ff", size: 0.018, sym: 6, mir: true, rot: 0 },
      { pts: [[0.12, 0.32], [0.22, 0.36], [0.30, 0.30]], col: "#ffd166", size: 0.022, sym: 6, mir: true, rot: 0 },
    ],
  },
];
