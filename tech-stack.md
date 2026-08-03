# ArtzLoop — Going Online: Tech Stack & Platform Plan

Companion to [future-scope.md](future-scope.md). That document is the deep
system design (data model, full API surface, security, rollout phases) —
**read it first**. This document answers the narrower question asked on top
of it: *"what stack do we actually stand up to host this online in real
time, with a proper backend, a database, an API gateway, a multiplayer
layer, a way to earn money, and a mobile app?"*

Nothing here changes the current 13 offline tools. Per [future-scope.md
guiding principles](future-scope.md#guiding-principles), they keep working
with zero account, zero network, forever. Everything below is a new layer
("ArtzLoop Cloud") bolted on top.

---

## 1. Current stack (today, for reference)

| Layer | What it is now |
|---|---|
| Frontend | Static HTML/CSS/vanilla JS per tool, Canvas2D, Pointer Events |
| Audio | Tone.js via CDN |
| Save format | JSZip-built `.art` files (client-side only) |
| Storage | `localStorage` autosave only — nothing leaves the browser |
| Backend | **None** |
| Hosting | Static hosting (`vercel.json` → `dist/`), works from `file://` too |
| Accounts / DB / payments | **None** |

Everything from here down is net-new.

---

## 2. Full stack for "ArtzLoop Cloud"

| Layer | Recommendation | Role |
|---|---|---|
| App shell | Next.js (TypeScript) | Profile, leaderboards, challenges, multiplayer lobby, paywall UI. Existing tools embed inside it unchanged. |
| Mobile app | Capacitor wrapping the same web app (see [§6](#6-mobile-app)) | iOS/Android without a second frontend codebase |
| API server | Node.js + TypeScript, Fastify | Stateless REST, horizontally scaled behind a load balancer |
| API Gateway / edge | Cloudflare (WAF, rate limiting, caching) in front of the Fastify pool | See [§4](#4-api-gateway) — you don't need a separate gateway product at MVP scale |
| Realtime / multiplayer | Socket.IO (self-hosted) or Ably/Pusher (managed) + Redis Pub/Sub | Live duels, co-draw rooms, live leaderboard ticks — see [§5](#5-multiplayer--live-competitive-layer) |
| Primary database | PostgreSQL (Neon or Supabase to start; RDS if you outgrow serverless Postgres) | Users, scores, art metadata, billing — full schema in [future-scope §6](future-scope.md#6-data-model) |
| Cache / realtime state | Redis (Upstash to start) | Leaderboard sorted sets, rate limiting, matchmaking queues, session cache |
| Object storage | Cloudflare R2 (no egress fee) | `.art` files, thumbnails, avatars |
| Auth | Clerk or Supabase Auth (managed) | Email + OAuth, cuts weeks off Phase 1 |
| Payments | Stripe (web) + RevenueCat (mobile IAP wrapper, see [§7](#7-monetization--earning-platform)) | Subscriptions, one-off purchases, payouts |
| Queue / async work | BullMQ (Redis-backed) | Thumbnails, score verification, Stripe webhooks, challenge rollover |
| Hosting/infra | Fly.io or Render for the API; Vercel/Cloudflare Pages for the app shell | Low ops burden until real scale forces Kubernetes |
| CDN | Cloudflare | Already the right call from Phase 0 |
| CI/CD | GitHub Actions (extend the existing workflow) | One pipeline, not a parallel system |
| Observability | Sentry + Grafana Cloud/Better Stack | Errors + metrics, cheap at low traffic |

This is the same stack as [future-scope §8](future-scope.md#8-tech-stack) —
restated here as the answer to "what do I actually provision," in the order
you'd stand it up.

---

## 3. Hosting & deploy, concretely

1. **Static tools + app shell** → Vercel or Cloudflare Pages. Push to `main`
   triggers a build (`npm run build` already exists) and deploys to the
   CDN edge. Zero servers to manage for this layer, ever.
2. **API service** → Fly.io (or Render). Deploy the Fastify app as a
   container; run **≥2 machines** from day one so there's no single point
   of failure, autoscale on CPU/p95 latency.
3. **Database/Redis/object storage** → managed services (Neon/Supabase,
   Upstash, R2). Don't self-host any of these at MVP — the ops cost isn't
   worth it until traffic actually demands it.
4. **Environments**: separate dev/staging/prod credentials for every managed
   service from the start (cheap to do now, expensive to retrofit).
5. **Secrets**: managed secret store (Fly/Render secrets, or Doppler), never
   committed `.env` files.

---

## 4. API Gateway

"API gateway" here is really **two layers**, not one product:

- **Edge layer (Cloudflare)** — already in front of everything for CDN
  purposes. Add: rate limiting per-IP, a WAF ruleset, and bot protection.
  This is your first line of defense and costs nothing extra on top of
  what Phase 0 already sets up.
- **Application gateway (the Fastify API pool itself)** — handles
  authentication (JWT verification), per-user rate limiting, request
  validation (zod schemas), and routes to the right internal handler. At
  this scale, a dedicated gateway product (Kong, AWS API Gateway, Apigee)
  is **overkill** — it adds latency and ops surface for a problem two
  middleware functions already solve.

**Only reach for a dedicated gateway product** if you end up with multiple
independent backend services that each need centralized auth/routing (e.g.
once the multiplayer service, billing service, and core API are three
separately-deployed things) — revisit at that point, not before.

---

## 5. Multiplayer / live competitive layer

"Multiplayer game like other apps" maps to a few concrete, buildable
mechanics — pick one to start rather than all three:

| Mode | What it looks like | Tech needed |
|---|---|---|
| **Async duel** (already scoped in [future-scope §12](future-scope.md#12-feature-prds-lightweight)) | Two players draw against the same seed/prompt, not simultaneously; result screen compares scores | REST only — no realtime infra needed, cheapest to ship first |
| **Live co-draw room** (Gartic Phone / drawful-style) | Multiple users draw or guess together in real time in a shared room | WebSocket gateway (Socket.IO), Redis Pub/Sub for cross-instance broadcast, a room/lobby state machine |
| **Live shared canvas** (truly simultaneous multi-cursor drawing) | Everyone draws on the *same* canvas at once, like a collaborative whiteboard | Needs a CRDT library (Yjs) or OT to merge concurrent strokes without conflicts — this is the highest-complexity option, don't start here |

**Recommended order**: async duel (Phase 2, no new infra) → live co-draw
rooms (Phase 3, adds the WebSocket gateway) → shared live canvas only if
user demand clearly asks for it (it's a materially harder distributed-systems
problem than the other two).

Scaling notes for the WebSocket layer are already covered in [future-scope
§9.4](future-scope.md#94-real-time--competitions) — run it as its own
service, pub/sub-backed so any gateway instance can broadcast to any client.

---

## 6. Mobile app

Two realistic tracks. Don't start with Track B.

### Track A — wrap the web app (start here)
Use **Capacitor** (Ionic's native wrapper) around the Next.js app shell +
existing tools. This works because the tools already meet the bar Capacitor
needs:
- Canvas2D + Pointer Events already work identically inside a WebView.
- Tone.js runs fine in a WebView (test audio-context unlock on first touch,
  same as web).
- Add native plugins only where the web can't reach: push notifications,
  RevenueCat IAP, haptics, share sheet.

This ships iOS + Android from **one codebase**, reuses 100% of the existing
tools untouched, and is the fastest way to test whether a mobile audience
and mobile monetization are worth further investment.

### Track B — native rewrite (only if Track A's perf ceiling is hit)
React Native + `react-native-skia` (or a fully native Canvas per platform)
for tools where WebView performance genuinely isn't enough (unlikely for
these tools — they're 2D Canvas, not 3D/game-engine workloads). Treat this
as a per-tool decision, not an all-13 rewrite.

### Mobile-specific requirements, regardless of track
- **IAP**: route through **RevenueCat** from day one (unifies Apple/Google/
  Stripe entitlements), not Stripe-only — this is already flagged as a
  decision in [future-scope §18](future-scope.md#18-open-questions--decisions-needed)
  and is much cheaper to decide now than migrate later.
- **App Store / Play Store review requirements**: privacy policy URL,
  in-app account-deletion flow (Apple requires this explicitly), age
  rating, and — important — **Apple requires IAP for any digital
  good/subscription purchased inside the app**; you cannot link out to
  Stripe Checkout from inside the iOS app to dodge Apple's cut.
- **Push notifications** for challenge reminders / duel results — needs
  its own opt-in flow, off by default, matching the "no dark patterns"
  rule from [design.md](.claude/rules/design.md).

---

## 7. Monetization / "earning platform"

Builds on [future-scope §13](future-scope.md#13-monetization-rules), which
already sets the non-negotiable rule: **the free tier stays fully
creatively capable — no crippled free tier, no ads inside the tool itself**
(that's an explicit ground rule in [design.md](.claude/rules/design.md),
not just a preference). Everything below has to fit inside that constraint.

| Revenue stream | How it works | Notes |
|---|---|---|
| Subscription | Removes cloud storage limits, unlocks cosmetic packs, early access | Primary recurring revenue — already scoped in future-scope |
| Cosmetic IAP | Brush packs, avatar frames, color palettes | Never pay-to-win on leaderboards — cosmetic only |
| Competition entry fees | Optional paid tournament entry with a prize pool or bragging-rights payout | Needs Stripe Connect (or RevenueCat's payout support) if any money flows back *out* to users — adds real compliance surface (money transmission rules vary by country), treat as a later phase, not MVP |
| Print-on-demand marketplace | User exports art → order a print (poster/shirt) via Printful/Printify API | New surface, not in future-scope yet — straightforward Stripe Checkout + a fulfillment API integration, no inventory to hold |
| Ads | **Not recommended inside the tool** — conflicts directly with the existing "no ads inside the tool" ground rule. If pursued at all, it would have to live *outside* the creative surface (e.g. a rewarded-video option on a non-canvas screen) — flag this explicitly to the project owner before building anything here, it's a real policy change, not an implementation detail. |

**Sequencing recommendation**: ship subscriptions + cosmetic IAP first (it's
already fully scoped, lowest legal/compliance complexity). Validate people
will actually pay before building competition payouts or a print
marketplace, both of which add real operational and compliance weight
(payouts, fulfillment, customer service).

---

## 8. Suggested order of operations

1. **Phase 0** (already scoped, no backend) — perf hardening. Do this
   regardless; it's cheap and fixes real complaints today.
2. **Phase 1** — backend foundation: Postgres + Redis + R2, managed auth,
   Fastify API skeleton, Next.js app shell, deploy pipeline. Nothing
   user-facing yet beyond accounts + cloud save sync.
3. **Phase 2** — monetization MVP: subscription + cosmetic IAP via Stripe
   (web only). Validates willingness to pay before investing further.
4. **Phase 3** — engagement + async multiplayer: daily challenges,
   leaderboards, async duels (no WebSocket infra needed yet).
5. **Phase 4** — live multiplayer: WebSocket gateway, co-draw rooms.
6. **Phase 5** — mobile: Capacitor wrap + RevenueCat IAP, submit to both
   stores.
7. **Phase 6** — scale hardening + optional marketplace/print-on-demand,
   only once 1–5 have real usage data justifying the investment.

This reorders [future-scope's phase table](future-scope.md#15-rollout-phases--roadmap)
slightly to put monetization validation *before* building the heavier
multiplayer and mobile investments — cheaper to learn "will anyone pay"
early than after building live multiplayer and two app-store submissions.

---

## 9. Decisions only the project owner can make

Carried over and extended from [future-scope §18](future-scope.md#18-open-questions--decisions-needed):

- **Ads** — explicitly against a current ground rule; needs a conscious
  decision, not a default.
- **Which multiplayer mode ships first** — async duel is by far the
  cheapest; live co-draw is a materially bigger infra commitment.
- **Competition entry fees / payouts** — introduces money-transmission
  compliance questions worth a real legal check before building.
- **Track A vs. Track B mobile** — start Track A (Capacitor); only revisit
  if a specific tool's performance clearly can't hold up in a WebView.
- **Print-on-demand partner** (Printful vs. Printify vs. others) — affects
  margin and fulfillment regions.
- **Budget/timeline** for the managed services in [§2](#2-full-stack-for-artzloop-cloud) —
  all have real monthly cost even at low traffic; needs sign-off before
  Phase 1 setup begins.
