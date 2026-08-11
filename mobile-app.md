# ArtzLoop — Mobile App Brief

What ArtzLoop is, everything currently planned for it, and everything
specific to shipping it as an iOS/Android app. This is the single doc to
hand to anyone scoping the mobile build — it pulls together the relevant
parts of [future-scope.md](future-scope.md) and [tech-stack.md](tech-stack.md)
and adds the mobile-only detail (native plugins, store requirements,
offline behavior, submission checklist) that isn't in either.

Companion docs, for the parts this file intentionally doesn't repeat:
- [future-scope.md](future-scope.md) — full backend system design, data
  model, API surface, security, rollout phases.
- [tech-stack.md](tech-stack.md) — the concrete stack for the whole
  "ArtzLoop Cloud" platform layer, mobile is [§6](tech-stack.md#6-mobile-app)
  of that doc.
- [CLAUDE.md](CLAUDE.md) / [.claude/rules/](.claude/rules/) — the
  ground rules and conventions every existing tool already follows.

---

## Table of contents

1. [What ArtzLoop is](#1-what-artzloop-is)
2. [The tool catalog today](#2-the-tool-catalog-today)
3. [Current technical state](#3-current-technical-state)
4. [Guiding principles (carry into mobile unchanged)](#4-guiding-principles-carry-into-mobile-unchanged)
5. [Future scope — the full feature set](#5-future-scope--the-full-feature-set)
6. [Mobile track decision](#6-mobile-track-decision)
7. [Mobile architecture](#7-mobile-architecture)
8. [Native plugins the app needs](#8-native-plugins-the-app-needs)
9. [Offline behavior on mobile](#9-offline-behavior-on-mobile)
10. [Monetization on mobile](#10-monetization-on-mobile)
11. [App Store / Play Store submission checklist](#11-app-store--play-store-submission-checklist)
12. [Where mobile sits in the rollout order](#12-where-mobile-sits-in-the-rollout-order)
13. [Open decisions specific to mobile](#13-open-decisions-specific-to-mobile)

---

## 1. What ArtzLoop is

ArtzLoop is a collection of single-page, offline-capable generative art /
drawing tools for the browser. Each tool is its own self-contained app —
draw with mouse, touch, or pen on a canvas — sharing a common save/load
file format and procedural ambient audio. **No backend, no login, no
analytics, no network calls at runtime.**

- Every tool runs by opening its `index.html` directly (`file://` works)
  or from any static host — no install step, no server.
- State lives entirely in an exported `.art` file (a renamed `.zip` with
  `data.json` + a `preview.png` thumbnail) plus `localStorage` autosave.
  There is nothing to sync and nothing stored anywhere but the user's own
  device/file unless a future cloud layer is explicitly opted into.
- Ambient background audio is generated procedurally in-browser via
  Tone.js — never a licensed/recorded track, so there's zero music
  licensing risk to carry into an app store submission either.
- A shared `gallery/` app opens `.art` files and shows thumbnail previews
  across tools.

## 2. The tool catalog today

10 tools live in `apps/`, each `apps/NN-<kebab-case-name>/`:

| # | Tool | Mechanic |
|---|------|----------|
| 01 | Kaleidoscope mandala pad | Cursor strokes mirror into an N-fold symmetric pattern in real time |
| 02 | Digital spirograph generator | Sliders for gear ratio and pen offset trace looping geometric curves |
| 03 | Ink marbling / suminagashi simulator | Drop simulated ink on virtual water, swirl with the cursor, "print" onto paper |
| 04 | Action-painting splatter simulator | Flick the cursor like a loaded brush; physics-based paint splatters |
| 05 | Pixel-art flipbook animator | Draw on a small pixel grid across multiple frames, preview as a loop |
| 06 | Bubble painting simulator | Simulated soap bubbles pop on contact, leaving circular color blooms |
| 07 | Digital string-art loom | Place pegs around a shape; app auto-generates thread paths between them |
| 08 | Kaleidoscope photo tiler | Upload a photo, drag a lens over it; tiles/mirrors what's under the lens live |
| 09 | Snowflake generator | Locked to 6-fold symmetry, blue/white palette, "freeze" finish animation |
| 10 | Sacred-geometry overlay pad | Circles/lines snap to a Metatron's-cube grid, symmetry across multiple axes |

Full spec + the master build prompt used to generate each one: [artzloop.md](artzloop.md).
This list grows over time — treat it as a living catalog, not a fixed 10.

## 3. Current technical state

| Layer | What it is now |
|---|---|
| Frontend | Static HTML/CSS/vanilla JS per tool, Canvas2D, Pointer Events (mouse/touch/pen identically) |
| Audio | Tone.js via CDN, soft ambient pad (~-18dB), starts on first interaction |
| Save format | JSZip-built `.art` files, client-side only |
| Storage | `localStorage` autosave (~every 10s) + a "resume last session?" prompt — nothing leaves the device |
| Backend | **None** |
| Hosting | Static hosting (`vercel.json` → `dist/`); also works from `file://` |
| PWA groundwork | `manifest.json` (installable, standalone display, dark theme) + `sw.js` (service worker) already exist at the repo root — a head start for the mobile wrap, see [§7](#7-mobile-architecture) |
| Accounts / DB / payments | **None** |

## 4. Guiding principles (carry into mobile unchanged)

These are load-bearing for the mobile build specifically, not just the
web version — an app store reviewer and a user opening the app offline
both need this to hold:

1. **Every tool keeps working fully offline, with zero account, forever.**
   Cloud features (profile, sync, leaderboards, challenges, IAP) are
   strictly additive and opt-in — the app must behave the same with
   airplane mode on as with it off, degrading gracefully rather than
   erroring or blocking the canvas.
2. **No dark patterns.** No forced sign-in wall on first open, no
   full-screen upsell interstitials. This is also an Apple/Google review
   risk area (forced account creation before any value is shown is a
   common rejection reason) — following this rule already keeps the app
   store-review-safe.
3. **Local-first, cloud-second.** A user's art is never *only* on a
   server they don't control. `.art` export/share-sheet remains the
   source of truth on mobile; cloud sync is a convenience layer.
4. **One brand, two tiers.** The static tool collection ("ArtzLoop Core")
   ships in the app exactly as it works on the web; the platform layer
   ("ArtzLoop Cloud" — accounts, social, competitive, paid) is bolted on
   top and must never regress Core to make itself easier to build.

## 5. Future scope — the full feature set

Condensed from [future-scope.md §4](future-scope.md#4-product-scope--the-full-app)
and [§12](future-scope.md#12-feature-prds-lightweight) — the full "ArtzLoop
Cloud" product, all of which the mobile app eventually surfaces:

| Area | Feature |
|---|---|
| Identity | Sign up / log in, profile page, avatar, display name, bio |
| Progress | XP / level, per-tool stats, streaks, badges/achievements |
| Content | Cloud-saved art gallery (synced `.art` history), shareable art with a stable ID/URL |
| Engagement | Daily challenge per tool (shared seed/prompt for everyone that day) |
| Competitive | Global + friends leaderboards (per tool, daily/weekly/all-time), 1v1 duels, timed tournaments |
| Social | Follow other users, activity feed, share a piece via a short link/ID, comments/reactions (moderation-gated) |
| Monetization | Subscription tier, one-off IAP (brush packs, cosmetic tool packs, avatar frames) |

Backend/system design for all of this (data model, API surface, security,
anti-cheat, rollout phases) is fully specified in future-scope.md — not
repeated here since none of it is mobile-specific. What *is* mobile-specific
starts at [§6](#6-mobile-track-decision) below.

## 6. Mobile track decision

Two realistic tracks — start with Track A, don't start with Track B.

### Track A — wrap the web app (recommended starting point)
Use **Capacitor** (Ionic's native wrapper) around the same app shell +
existing tools, unchanged. This works because every tool already meets
the bar Capacitor needs:
- Canvas2D + Pointer Events already work identically inside a WebView.
- Tone.js runs fine in a WebView (audio-context unlock on first touch,
  same requirement as web).
- `manifest.json` + `sw.js` already exist, so the app is already
  installable/offline-capable as a PWA — Capacitor builds on top of that
  rather than starting from zero.
- Add native plugins only where the web genuinely can't reach: push
  notifications, IAP, haptics, native share sheet (see [§8](#8-native-plugins-the-app-needs)).

Ships iOS + Android from **one codebase**, reuses 100% of the existing
tools untouched, and is the fastest way to validate whether a mobile
audience and mobile monetization are worth further investment.

### Track B — native rewrite (only if Track A's perf ceiling is hit)
React Native + `react-native-skia` (or fully native Canvas per platform)
for a specific tool where WebView performance genuinely isn't enough.
Unlikely for these tools — they're 2D Canvas workloads, not 3D/game-engine
ones. Treat as a per-tool decision if it ever comes up, never an all-10
rewrite.

## 7. Mobile architecture

```
                    ┌───────────────────────────┐
                    │   Capacitor native shell    │
                    │   (iOS .ipa / Android .apk)  │
                    └─────────────┬───────────────┘
                                  │  loads
                    ┌─────────────▼───────────────┐
                    │   WebView                     │
                    │   (same Next.js app shell +   │
                    │    existing apps/*/index.html)│
                    └─────────────┬───────────────┘
                                  │  bridges via
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                          │
┌───────▼────────┐   ┌────────────▼───────────┐   ┌──────────▼─────────┐
│ shared/         │   │ Capacitor plugins        │   │ shared/            │
│ artzloop-sdk.js │   │ (Push, RevenueCat IAP,    │   │ tool-core.js       │
│ (optional, no-  │   │  Haptics, Share, Camera   │   │ (unchanged: save/  │
│  op if offline) │   │  for photo-tiler upload)  │   │  load, audio, UI)  │
└─────────────────┘   └───────────────────────────┘   └────────────────────┘
```

Key point: the tools themselves (`apps/*/index.html` + `script.js` +
`style.css`) do not need to know they're running inside Capacitor. The
same `shared/artzloop-sdk.js` bridge described in
[future-scope §5.1](future-scope.md#51-how-existing-tools-plug-in-without-a-rewrite)
covers both web and mobile — every SDK call is a no-op offline, so a tool
opened with no network on a phone behaves exactly like one opened via
`file://` on a laptop.

## 8. Native plugins the app needs

Only where the web genuinely can't reach — everything else stays as
plain web code shared with the browser version:

| Plugin | Used for | Notes |
|---|---|---|
| `@revenuecat/purchases-capacitor` | Subscriptions + cosmetic IAP | See [§10](#10-monetization-on-mobile) — required, not optional, once monetization ships on mobile |
| Push Notifications | Daily challenge reminders, duel results | Opt-in, off by default — matches the "no dark patterns" rule; never a blocking permission prompt on first open |
| Haptics | Light tactile feedback on stroke commit / fill / erase actions | Purely additive polish, never required for a tool to function |
| Share | Native share sheet for exporting `.art` files and sharing art links | Replaces/augments the web `<a download>` flow |
| Camera / Filesystem | Photo import for the Kaleidoscope Photo Tiler (`apps/08-kaleidoscope-photo-tiler`) | Needs an explicit permission rationale string for both stores; tool must keep working via the existing `<input type="file">` picker if permission is denied |
| App (lifecycle) | Pause ambient audio when backgrounded, resume autosave on foreground | Prevents Tone.js continuing to play/CPU-spin in the background |

## 9. Offline behavior on mobile

This is the part most likely to trip up an app store review or a real
user, so it's called out on its own:

- **First open, no network, no account**: every tool must be fully usable
  immediately — draw, save (to device storage / native share sheet),
  load, mute — identically to the web version. No blocking splash, no
  forced onboarding, no "check your connection" wall.
- **Airplane mode mid-session**: any cloud SDK call (`submitScore`,
  `shareArt`, `getTodayChallenge`) fails silently and the tool falls back
  to its normal free-draw behavior — per the SDK contract in
  [future-scope §5.1](future-scope.md#51-how-existing-tools-plug-in-without-a-rewrite),
  a tool must never block core drawing on a network call.
- **Local save is still the source of truth on mobile**: `.art` export
  goes through the native share sheet (save to Files / send via
  another app) in addition to/instead of a browser download; autosave to
  device-local storage continues even fully offline.
- **CI-testable**: once Phase 0's offline smoke test exists (see
  [future-scope §16](future-scope.md#16-engineering-rules--conventions)),
  run the same check inside the Capacitor build with network disabled
  before every store submission.

## 10. Monetization on mobile

- IAP routes through **RevenueCat** from day one, not Stripe directly —
  unifies Apple/Google/Stripe entitlements against the same
  `Entitlement` table described in
  [future-scope §6](future-scope.md#6-data-model). This is already
  flagged as the recommended default in
  [future-scope §18](future-scope.md#18-open-questions--decisions-needed)
  and [tech-stack §6](tech-stack.md#6-mobile-app) — deciding it now avoids
  a second billing migration later.
- **Apple requires native IAP for any digital good/subscription bought
  inside the app** — the iOS app cannot link out to a Stripe Checkout
  page to route around Apple's cut. Google is more permissive but
  RevenueCat covers both with one integration regardless.
- Free tier stays fully creatively capable on mobile too — every tool's
  core mechanic is free forever, no crippled free tier as an upsell
  tactic (matches [future-scope §13](future-scope.md#13-monetization-rules)).
  IAP catalog is cosmetic/convenience only: brush packs, avatar frames,
  cloud storage beyond a free cap — never pay-to-win on leaderboards.
- Clear one-tap cancel/restore-purchases flow — required by both stores'
  review guidelines, not just good practice.

## 11. App Store / Play Store submission checklist

Requirements specific to shipping this app in both stores, beyond what
the web version needs:

- [ ] **Privacy policy URL** — required by both stores even though the
  app itself has "no analytics" — the moment accounts/cloud sync exist,
  a real policy is mandatory (what's collected, retention, how to
  delete).
- [ ] **In-app account deletion flow** — Apple explicitly requires this
  for any app with account creation; can't be "email support to delete."
- [ ] **Age rating questionnaire** — both stores require this; nothing in
  the current tool set should trigger a mature rating, but the
  questionnaire still has to be filled out accurately.
- [ ] **Permission rationale strings** — camera (photo tiler upload),
  push notifications, photo library access — each needs a clear,
  user-facing reason shown before the OS permission prompt fires.
- [ ] **App icons + screenshots** per required size for each store
  (iOS: multiple resolutions; Android: adaptive icon + feature graphic).
- [ ] **IAP entitlement restore** — "Restore Purchases" button, required
  by Apple review guidelines.
- [ ] **Sign in with Apple** — if any other third-party OAuth login
  (Google, etc.) is offered on iOS, Apple requires Sign in with Apple
  also be offered as an equal option.
- [ ] **Offline functionality demonstrated in review notes** — since the
  app can be fully used with no account, explicitly note this for
  reviewers so they don't get stuck expecting a login wall.
- [ ] **Data safety form (Google Play)** — declares what data is
  collected/shared, must match the actual SDK behavior (none, until
  cloud features are opted into).
- [ ] **Export compliance (Apple)** — standard encryption questionnaire
  (HTTPS-only network calls typically qualify for the exempt path).

## 12. Where mobile sits in the rollout order

Mobile is **Phase 5** in the overall rollout — it depends on the backend
phases before it, it is not a parallel track:

| Phase | Must exist before mobile ships | Why mobile needs it |
|---|---|---|
| 0 — Performance | CDN, vendored libs, service worker | The WebView loads the same static assets; slow/broken web = slow/broken app |
| 1 — Platform foundation | Auth, profile, cloud art sync, API skeleton | Mobile's account/sync screens have nothing to call otherwise |
| 2 — Monetization MVP | Stripe subscriptions/IAP validated on web | Confirms willingness to pay *before* paying Apple/Google's cut + RevenueCat integration cost |
| 3 — Engagement | Daily challenges, leaderboards, async duels | Mobile push notifications (challenge reminders, duel results) need these to exist server-side first |
| 4 — Live multiplayer | WebSocket gateway, co-draw rooms | Only if live multiplayer ships on mobile at launch — can be deferred past Phase 5 if not |
| **5 — Mobile** | — | Capacitor wrap + RevenueCat IAP + store submission, this doc |

This mirrors [future-scope §15](future-scope.md#15-rollout-phases--roadmap)
and [tech-stack §8](tech-stack.md#8-suggested-order-of-operations): validate
the backend and monetization on web first, since it's far cheaper to learn
"will anyone pay" before building live multiplayer and submitting to two
app stores than after.

## 13. Open decisions specific to mobile

Carried from [future-scope §18](future-scope.md#18-open-questions--decisions-needed)
and [tech-stack §9](tech-stack.md#9-decisions-only-the-project-owner-can-make),
narrowed to what actually blocks starting the mobile build:

- **Mobile app, ever?** Track A (Capacitor) is the recommendation *if* the
  project owner decides to invest in mobile at all — that decision itself
  is still open.
- **Track A vs. Track B** — start Track A; only revisit a native rewrite
  if a specific tool's WebView performance ceiling is actually hit in
  practice, not preemptively.
- **Push notification strategy** — which events warrant a push (challenge
  reset, duel result, streak-about-to-break?) needs a real decision, kept
  opt-in and minimal per the "no dark patterns" rule.
- **iOS Sign in with Apple** — only becomes mandatory once another
  third-party OAuth login is offered; decide the login provider set
  before building the mobile auth screen.
- **Budget** — Apple Developer Program ($99/yr) + Google Play one-time
  registration fee + RevenueCat pricing tier, on top of the Phase 1
  infra costs already flagged in future-scope — needs sign-off before
  Phase 5 setup begins.
