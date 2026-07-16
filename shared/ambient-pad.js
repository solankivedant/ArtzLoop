/*
 * ArtzLoop shared ambient audio module - the canonical Tone.js pad.
 *
 * A slow-attack PolySynth looping a pentatonic chord progression through a
 * low-pass filter and reverb, mixed at -18dB. Started on first user gesture
 * (browser autoplay rules); mute preference persists in localStorage.
 *
 * Single-file tools inline a copy (marked "copied from shared/ambient-pad.js");
 * Vite-based tools import this module. Requires Tone.js (CDN) globally.
 */

const AMBIENT_MUTE_KEY = "artzloop.muted"; // shared across all tools

function createAmbientPad() {
  let started = false;
  let muted = localStorage.getItem(AMBIENT_MUTE_KEY) === "1";

  // C-major pentatonic (C D E G A) voicings, cycled every 8 seconds.
  const chords = [
    ["C3", "G3", "C4", "E4"],
    ["A2", "E3", "A3", "D4"],
    ["G2", "D3", "G3", "C4"],
    ["A2", "E3", "C4", "G4"],
  ];

  async function start() {
    if (started || muted || typeof Tone === "undefined") return;
    started = true;
    await Tone.start();
    const reverb = new Tone.Reverb({ decay: 6, wet: 0.45 }).toDestination();
    const filter = new Tone.Filter(850, "lowpass").connect(reverb);
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 2.5, decay: 1.5, sustain: 0.6, release: 5 },
    }).connect(filter);
    pad.volume.value = -18;
    let i = 0;
    new Tone.Loop((time) => {
      pad.triggerAttackRelease(chords[i % chords.length], 6, time);
      i++;
    }, 8).start(0);
    Tone.Transport.start();
    Tone.Destination.mute = muted;
  }

  function toggleMute() {
    muted = !muted;
    localStorage.setItem(AMBIENT_MUTE_KEY, muted ? "1" : "0");
    if (typeof Tone !== "undefined" && started) Tone.Destination.mute = muted;
    if (!muted) start(); // unmuting counts as the user gesture
    return muted;
  }

  return {
    start, // call from the first pointerdown
    toggleMute, // returns new muted state
    get muted() {
      return muted;
    },
  };
}
