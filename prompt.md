# ArtzLoop — Mobile UI Design Prompt

Use this as a single prompt to generate the complete mobile app UI —
every screen, in one consistent visual system. Read the whole thing before
producing anything; the screens all have to look like one product, not a
set of unrelated mockups.

---

## What this app is

A collection of generative art / drawing toys. Each one is a full-screen
canvas you draw on with a finger or stylus — mirrored kaleidoscope
patterns, spirograph curves, ink marbling, paint splatter, pixel-art
flipbooks, soap-bubble blooms, string art, photo kaleidoscopes,
snowflakes, sacred-geometry grids, and more added over time. The product
has no login wall, no ads, no analytics inside the creative surface — it
opens straight into making something. On top of the free creative core
there's an optional layer of accounts, daily challenges, leaderboards,
duels, a synced art gallery, and a subscription/cosmetic-pack store — all
of that is additive and never blocks the core drawing experience.

Design for a calm, focused, "instrument" feeling — closer to a musical
instrument or a premium creative tool than a game or a social app. The
art the person is making is always the most visually prominent thing on
the screen. Every control is quiet, small, and gets out of the way.

---

## Brand & visual identity

**Overall mood**: dark, ambient, softly glowing — meant to be used with
the room lights off as comfortably as with them on. Minimal chrome.
Generous negative space around controls. Nothing competes with the
canvas.

### Color palette

Use these as design tokens — do not invent new hues, only tints/shades of
these:

| Token | Hex / value | Use |
|---|---|---|
| Background | `#0b0b13` | App background, canvas dark mode |
| Background (light canvas mode) | `#f6f4ef` | Alternate canvas background for bright rooms — warm off-white, never pure white |
| Surface / panel | `#151521` | Cards, sheets, bars, modals |
| Surface hover/pressed | `rgba(255,255,255,0.08)` overlay on surface | Button/list-item states |
| Hairline / divider | `rgba(255,255,255,0.09)` | Borders, separators — always this faint, never a hard gray line |
| Text primary | `#eceaf6` | Headings, primary labels, values |
| Text secondary | `#9494ad` | Captions, helper text, inactive labels |
| Accent 1 (primary) | `#6d7cff` | Primary actions, active states, focus rings, links |
| Accent 2 (secondary) | `#3fd8d0` | Paired with Accent 1 in gradients, secondary highlights |
| Accent gradient | `linear-gradient(120deg, #6d7cff, #8a5cf6)` | Primary buttons, hero brand mark |
| Accent glow | `0 0 12px rgba(109,124,255,0.8)` | Soft glow behind the brand mark / active icons only — use sparingly, never on every element |
| Destructive | a warm coral/red in the same desaturated family as the rest of the palette (e.g. `#ff6e82`) | Delete, erase, cancel-subscription confirmations only |

Both a dark and a light variant of the *canvas itself* must exist (users
toggle this per drawing), but the surrounding app chrome — nav bars,
sheets, buttons — stays on the dark palette above at all times. Chrome
does not get a separate "light mode"; only the drawing surface does.

### Typography

- System UI font stack (the platform-native sans-serif — San Francisco on
  iOS, Roboto/system on Android). No custom display font; this is a tool,
  not a marketing site.
- Monospace font (Consolas/SF Mono/Roboto Mono) for numeric readouts:
  zoom percentage, brush-size values, coordinate/slider values, hex color
  codes, streak counters.
- Small, restrained type scale: captions ~11–12px, body ~13–14px,
  section headers ~15–17px semi-bold, one large hero size (~24–28px) for
  the home screen's title only. Nothing shouts.

### Shape & elevation

- Corner radius: 9–14px on cards, buttons, and sheets; fully round (pill)
  on toggles, chips, and icon buttons.
- Flat, borderless surfaces with a 1px hairline border in the divider
  color — not drop shadows. Depth comes from subtle background contrast
  (`#151521` panel over `#0b0b13` base), not shadow.
- Icons: simple 2px-stroke line icons, rounded line caps and joins, no
  fill except small accent dots/badges. Consistent 18–20px sizing in bars,
  larger (24–28px) in primary tab/nav positions.

### Motion

- Fast, quiet transitions (~120–180ms ease) on every state change —
  button press, panel open/close, tab switch. Nothing bounces or
  overshoots. A toggle's knob slides; a sheet rises; a value updates —
  all understated.
- The one place motion is allowed to be expressive is inside the
  generative art itself (e.g. a finishing "freeze" animation on a
  completed piece) — never in the chrome around it.

---

## Global patterns (apply to every screen)

- **No login wall, ever, on first open.** The app opens directly into the
  creative home screen. Account creation is reachable from a quiet
  profile/settings entry point, never forced before the user can draw
  something.
- **Bottom tab bar** for primary navigation (Home, Gallery, Challenges,
  Profile — four items max, icons + tiny labels), consistent across every
  non-canvas screen. The canvas screens themselves hide the tab bar
  entirely to maximize drawing space, replaced by a minimal top bar and a
  bottom control strip specific to that tool.
- **Bottom sheets**, not full-screen takeovers, for secondary settings,
  tool options, and pickers — keeps the person's place in the flow and
  matches the "quiet, non-blocking" tone.
- **One primary action per screen**, styled with the accent gradient;
  every other action is a plain outlined or ghost button in the neutral
  palette. Never more than one gradient-filled button visible at once.
- **Empty states are warm, not sparse** — a soft illustration in the
  accent palette plus one short sentence and one primary action (e.g. an
  empty gallery invites "make your first piece," not a blank void).
- **Offline is a first-class, silent state** — no error banners for
  missing network. Anything that needs a connection (cloud sync,
  leaderboards, challenges) simply shows its last-known/local state or a
  quiet "you're offline" caption, never a blocking dialog.
- **Touch targets** minimum 44×44pt, generous spacing between
  destructive and non-destructive actions so a mis-tap can't delete
  something.
- **Respect safe areas / notches / gesture bars** on every screen —
  bottom control strips and tab bars sit above the home indicator with
  proper padding.

---

## Screens to design

Design all of the following as one cohesive set, in both a phone
portrait layout (primary) and a tablet/landscape adaptation where noted.

### 1. Splash / first launch
Minimal — the brand mark (gradient glyph) fading in on the base
background, sub-second, no tagline animation, no swipe-through
onboarding carousel. Leads straight into the home screen.

### 2. Home
A card grid of every available drawing tool (2 columns on phone, more on
tablet), each card showing a small live-style preview thumbnail, the
tool's name, and a subtle numbered tag. Above the grid: a "continue where
you left off" row surfacing the most recent piece, and a slim "today's
challenges" row of small chips (only shown when signed in / online — the
grid alone is a complete, satisfying screen when signed out or offline).
A search/filter affordance sits at the top if the tool count grows large.

### 3. Canvas / tool screen (shared template, used by every tool)
Full-bleed canvas dominates the screen. A minimal top bar holds only:
back, the tool's name, a save icon, and an overflow menu. All tool-specific
controls (brush size, symmetry, color, mode switches) live in a slim
bottom control strip with a couple of icon buttons; tapping one expands a
compact bottom sheet with sliders/swatches for just that control, never a
permanent sidebar eating canvas space. A floating pinch-to-zoom/pan
affordance and a small persistent mute icon complete the bar. Undo/redo as
a pair of icon buttons. The whole strip can be swiped down to hide for a
distraction-free full-screen draw mode, with a small tap-to-reveal handle.

### 4. Gallery
A scrollable grid of thumbnail previews of saved pieces (local device
saves and, if signed in, cloud-synced ones merged together, each clearly
but quietly labeled as "on this device" vs "synced"). Tapping a thumbnail
opens a detail view with the full image, the tool it was made in, date,
and actions: open in tool, share, export, delete. A toggle filters by
tool.

### 5. Piece detail / share
Full-image view of one saved piece with the same quiet top bar pattern,
a primary "Share" action (native share sheet) and secondary actions
(re-open to keep drawing, export, delete — delete uses the destructive
color and a confirmation step).

### 6. Profile
Avatar, display name, a level/XP bar in the accent gradient, a row of
compact stat tiles (streak, total pieces made, best ranks), and tabs for
Gallery / Achievements / Activity. Settings gear icon in the top-right
leads to account/app settings. Signed-out state shows the same layout
with a single quiet "sign in to save progress across devices" prompt
instead of stats — never a modal forcing the choice.

### 7. Leaderboard
Per-tool tabs across the top, a period switch (daily / weekly / all-time)
as a segmented control, global-vs-friends toggle, a scrollable ranked
list with rank, avatar, name, and score — the current user's own row
stays pinned at the bottom of the visible list (or highlighted in place)
even when their rank is far down.

### 8. Daily challenge
A banner/card on the relevant tool's entry point plus its own dedicated
screen: the day's prompt or seed, a countdown to reset, a streak
indicator, and a single "start" action that drops straight into the
canvas pre-loaded with today's challenge. Completing it returns to normal
free-draw mode for that tool with a small completion badge.

### 9. Duel / competition
A split or stacked comparison view of two people's results on the same
prompt — side-by-side thumbnails, scores, and a winner indicator once
both are in. An "invite" flow to challenge a specific friend, and a
lightweight live status indicator while waiting on the other player.

### 10. Paywall / upgrade
A single, dismissible sheet (never a full-screen interstitial, never
shown on first open) listing what the paid tier adds — framed as extra
creative options and convenience, not as things the free tier is missing
punitively. One clear price, one gradient-styled primary action, a
visible close affordance, and a small "restore purchases" link.

### 11. Settings
Grouped list style: account (sign out, delete account/data — a real,
findable in-app flow, not buried), notifications (all opt-in toggles, off
by default), appearance (canvas light/dark default), audio, subscription
management, privacy policy / terms links, app version.

### 12. Onboarding permission prompts
When a native permission is actually needed (camera for photo-based
tools, notifications for challenge reminders), show one small in-app
explanation card first, in the same quiet visual language, before the
system permission dialog fires — never request permissions speculatively
on first launch.

---

## Interaction & tone rules to hold across every screen

- The canvas is always the hero; no screen should visually compete with
  the art someone is mid-way through making.
- Never block core drawing on a network call, an account, or a loading
  spinner — everything creative works instantly and fully offline.
- No dark patterns: no forced walls, no full-screen ads, no upsell
  interstitials, no countdown-pressure purchase prompts.
- Every destructive action (delete piece, delete account, cancel
  subscription) gets an explicit, unhurried confirmation step.
- Keep the same iconography, spacing, and color tokens identical across
  every screen listed above — this should read as one continuous product,
  not a set of independently designed pages.

---

## What to produce

High-fidelity mobile mockups (iOS and Android sizing) for every screen
listed above, as one connected set sharing the exact color tokens,
typography, spacing, and component styles defined here. Show at least one
canvas/tool screen in both its expanded-controls and hidden-controls
states, and show the paywall as an overlay on top of the profile screen
to demonstrate it's a sheet, not a separate page. Where a screen has a
meaningfully different signed-out or offline state, show that variant
alongside the signed-in one.
