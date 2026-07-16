# ArtzLoop — Future Scope

Planning document for evolving ArtzLoop from a static, offline, no-backend tool
collection into a performant, high-concurrency web app with accounts, daily
challenges, scoring, leaderboards, social sharing, competitions, and
monetization.

This is a **planning document, not a build order**. Nothing here changes the
current app until a phase below is explicitly kicked off. The current 13
tools keep working exactly as documented in [CLAUDE.md](CLAUDE.md) throughout —
see [Guiding Principles](#guiding-principles) for why that matters.

---

## Table of contents

1. [Current state & why "slow with many people" happens today](#1-current-state--why-slow-with-many-people-happens-today)
2. [Guiding principles](#guiding-principles)
3. [Phase 0 — Performance & reliability (no backend required)](#3-phase-0--performance--reliability-no-backend-required)
4. [Product scope — the "full app"](#4-product-scope--the-full-app)
5. [System design](#5-system-design)
6. [Data model](#6-data-model)
7. [API surface](#7-api-surface)
8. [Tech stack](#8-tech-stack)
9. [Load balancing & scaling strategy](#9-load-balancing--scaling-strategy)
10. [Data, sync & "memory" model](#10-data-sync--memory-model)
11. [Design specs](#11-design-specs)
12. [Feature PRDs (lightweight)](#12-feature-prds-lightweight)
13. [Monetization rules](#13-monetization-rules)
14. [Security & anti-cheat](#14-security--anti-cheat)
15. [Rollout phases / roadmap](#15-rollout-phases--roadmap)
16. [Engineering rules & conventions](#16-engineering-rules--conventions)
17. [Setup checklist (when Phase 1 actually starts)](#17-setup-checklist-when-phase-1-actually-starts)
18. [Open questions / decisions needed](#18-open-questions--decisions-needed)

---

## 1. Current state & why "slow with many people" happens today

ArtzLoop today has **no server**: every tool is static HTML/CSS/JS served
as-is (`file://` or any static host), with two third-party CDN scripts
(Tone.js, JSZip) loaded per page and all state living in the exported
`.art` file or `localStorage`. There is no app server to "load balance" in
the traditional sense — so slowness under concurrent load is almost
certainly one of these, not a compute bottleneck:

- **Cold CDN requests**: `cdnjs.cloudflare.com` script tags block rendering
  until they resolve; if the CDN edge nearest a user is congested or the
  request is a cache-miss, first paint stalls. This is the most likely
  cause of "some people load slow."
- **No caching headers / no CDN in front of the static host** — if the repo
  is hosted somewhere without aggressive edge caching, every visitor
  re-downloads the same unchanged JS/CSS instead of hitting a cache.
- **Large inline SVGs in `index.html`** — the launcher grid embeds full SVG
  markup per card (some tool cards are 3–5 KB of inline path data ×13),
  which is parsed on every load of the root page.
- **No lazy loading** — every tool's `script.js` runs its full init
  (canvas setup, Tone.js synth graph) on load, even before the user
  interacts, which is wasted work on slow devices.

None of this needs "load balancing" yet — it needs **static delivery
hardening**, covered in [Phase 0](#3-phase-0--performance--reliability-no-backend-required).
Real load balancing (multiple app server instances behind a balancer)
only becomes relevant once Phase 1+ introduces a backend with per-request
compute (auth, score validation, leaderboard queries, live competitions).

---

## Guiding principles

These carry forward from [CLAUDE.md](CLAUDE.md) and should not be silently
abandoned as the project grows a backend:

1. **The current 13 tools must keep working fully offline, with zero
   account, forever.** Cloud features (profile, sync, leaderboards,
   challenges, competitions, billing) are strictly **additive and
   opt-in** — a tool opened with no network and no login must behave
   exactly as it does today, degrading gracefully rather than erroring.
2. **No dark patterns.** Per `.claude/rules/design.md`: no forced
   sign-in walls, no aggressive upsells inside the creative surface. The
   canvas stays the most prominent thing on screen; monetization UI is
   quiet and dismissible.
3. **Local-first, cloud-second.** A user's art and progress should never
   be *only* on a server they don't control. Local save/export
   (`.art` files) remains the source of truth; the backend is a
   convenience layer (sync, sharing, leaderboards) on top of it.
4. **One brand, two tiers of investment.** Treat the static tool
   collection as "ArtzLoop Core" (what exists today) and the new
   platform layer as "ArtzLoop Cloud" (accounts, social, competitive,
   paid). Core must never regress to make Cloud easier to build.

---

## 3. Phase 0 — Performance & reliability (no backend required)

Do this regardless of whether the full-app expansion ever happens — it's
cheap, reversible, and fixes the actual complaint ("low responding /
takes time to respond, especially with many people").

### 3.1 Static delivery
- Front the static site with a real CDN (Cloudflare Pages, Netlify, or
  Vercel static hosting, or Cloudflare in front of GitHub Pages). All of
  these give free global edge caching, HTTP/2+, and Brotli compression
  with zero app-server code.
- Set long `Cache-Control: immutable` headers on versioned assets
  (`shared/*.js`, `apps/*/style.css`, `apps/*/script.js`) and cache-bust
  via a query string or content hash on deploy.
- **Vendor Tone.js and JSZip instead of loading from `cdnjs`.** Copy the
  pinned versions into `shared/vendor/` and serve them from the same
  origin/CDN as everything else. This removes a third-party DNS lookup +
  TLS handshake + possible cache-miss from the critical path of every
  tool's first paint, and removes the "app breaks if cdnjs is down"
  failure mode entirely (this is also friendlier to the "double-click
  `index.html`, no network needed" promise in CLAUDE.md — currently the
  music/save features silently degrade if the CDN is unreachable).
- Add `<link rel="preconnect">` / `rel="preload"` for the vendored
  scripts and the tool's own `script.js`/`style.css`.
- Minify `shared/tool-core.js` and each tool's `script.js`/`style.css` at
  deploy time (esbuild or terser) — currently shipped unminified.

### 3.2 Runtime perf
- Defer Tone.js audio-graph construction until first user interaction
  (some tools may already do this per `.claude/rules/design.md` — audit
  all 13 for consistency).
- Lazy-render the launcher grid's inline SVGs (or switch to `<img
  src="data:...">`/sprite sheet) so `index.html` parses faster with 8+
  cards.
- Add a `manifest.json` + service worker (Workbox) so repeat visits are
  served from the browser cache instantly and the app keeps working
  offline after first visit — this directly compounds with principle #1
  above (offline-first) instead of conflicting with it.

### 3.3 Observability (so "slow" is measurable, not anecdotal)
- Add [web-vitals](https://github.com/GoogleChrome/web-vitals) reporting
  (LCP/INP/CLS) beaconed to a lightweight endpoint or a free tier of
  Cloudflare Web Analytics / Plausible (privacy-respecting, no cookies —
  keeps the "no analytics" spirit of CLAUDE.md as close as possible;
  flag this explicitly to the user before enabling since it's a change
  to the "no analytics" ground rule).
- Add uptime monitoring (UptimeRobot / Better Uptime free tier) on the
  root URL and a couple of tool URLs.

**Outcome of Phase 0:** faster, more consistent load times for everyone,
zero backend, zero new infrastructure to operate, fully reversible.

---

## 4. Product scope — the "full app"

Everything below is genuinely new product surface. Grouped by theme:

| Area | Feature |
|---|---|
| Identity | Sign up / log in, profile page, avatar, display name, bio |
| Progress | XP / level, per-tool stats, streaks, badges/achievements |
| Content | Cloud-saved art gallery (synced `.art` history), shareable art with a stable ID/URL |
| Engagement | Daily challenge per tool (shared seed/prompt for everyone that day) |
| Competitive | Global + friends leaderboards (per tool, daily/weekly/all-time), 1v1 duels, timed tournaments |
| Social | Follow other users, activity feed, share a piece or profile via a short link/ID, comments/reactions (optional, moderation-gated) |
| Monetization | Subscription tier (removes limits, unlocks cosmetic packs / extra tools), one-off in-app purchases (brush packs, tool packs, avatar frames) |

---

## 5. System design

```
                                   ┌─────────────────────┐
                                   │        CDN            │  (Cloudflare)
                                   │  static tools + app     │
                                   │  shell + assets         │
                                   └─────────┬───────────┘
                                             │
                       ┌─────────────────────┼─────────────────────┐
                       │                     │                     │
               ┌───────▼───────┐   ┌─────────▼─────────┐   ┌───────▼───────┐
               │  Web/App shell │   │   API Gateway /     │   │  WebSocket    │
               │ (Next/SvelteKit│   │   Load Balancer      │   │  Gateway      │
               │  — profile,    │   │  (rate limit, authN) │   │ (competitions,│
               │  leaderboard,  │   └─────────┬─────────┘   │  live LB)     │
               │  challenge UI) │             │              └───────┬───────┘
               └───────┬───────┘   ┌─────────▼─────────┐            │
                       │           │   API service pool  │◄───────────┘
                       │           │  (stateless Node/TS, │
                       │           │   horizontally scaled)│
                       │           └───┬───────┬───────┬─┘
                       │               │       │       │
                       │      ┌────────▼─┐ ┌───▼───┐ ┌─▼──────────┐
                       │      │ Postgres  │ │ Redis  │ │ Object store│
                       │      │ (primary +│ │ (cache,│ │ (S3/R2:     │
                       │      │  replicas)│ │  LB    │ │  .art files,│
                       │      └───────────┘ │  ZSETs,│ │  thumbnails,│
                       │                    │  rate  │ │  avatars)   │
                       │                    │  limit)│ └─────────────┘
                       │                    └────────┘
               ┌───────▼────────┐
               │  Individual tool │  (existing static apps/*/index.html,
               │  pages (unchg'd)│   loaded inside the shell; talk to the
               └───────┬────────┘   API via a small SDK, see 5.1)
                       │
               ┌───────▼────────┐
               │ Async workers   │  (BullMQ/SQS: thumbnail gen, score
               │ (queue-driven)  │   validation, challenge seed rollover,
               └────────┬────────┘   Stripe webhook processing, email)
                        │
               ┌────────▼────────┐
               │ Stripe (billing)│
               └─────────────────┘
```

### 5.1 How existing tools plug in without a rewrite
Introduce a small first-party script, `shared/artzloop-sdk.js`, that each
tool optionally includes:

- `ArtzLoop.isOnline()` / `ArtzLoop.currentUser()` — no-ops returning
  `null` if the SDK can't reach the API (offline, API down, no account) —
  **tool code must treat every SDK call as optional**, never block core
  drawing on it.
- `ArtzLoop.submitScore(toolId, value, proof)` — fire-and-forget; queues
  locally (IndexedDB) and retries when back online.
- `ArtzLoop.getTodayChallenge(toolId)` — returns `null` offline; tool falls
  back to its normal free-draw mode.
- `ArtzLoop.shareArt(blob) → shareId` — uploads to object storage,
  returns a short ID; if it fails, the existing local `.art` download
  still works exactly as today.

This keeps every one of the 13 tools' `script.js`/`style.css` untouched by
default — the SDK is additive, and a tool only needs new UI (e.g. "Today's
Challenge" banner, "Share" button) when its owner decides to wire it up.

---

## 6. Data model

Relational core (Postgres), sketched as entities + key fields:

```
User            (id, email, auth_provider, display_name, avatar_url,
                 plan_tier, created_at)
Profile         (user_id FK, bio, privacy_level, stats_cache JSONB)
ArtPiece        (id, user_id FK, tool_id, storage_key, thumbnail_key,
                 visibility, share_code UNIQUE, created_at)
Score           (id, user_id FK, tool_id, challenge_id FK NULL, value,
                 proof_hash, verified BOOL, submitted_at)
DailyChallenge  (id, tool_id, date, seed, params JSONB, reward_xp)
ChallengeRun    (id, user_id FK, challenge_id FK, score, completed_at)
LeaderboardCache (tool_id, period[daily|weekly|alltime], ranked JSONB,
                 refreshed_at)   -- materialized from Score, see 9.3
Competition     (id, type[duel|tournament], tool_id, status,
                 starts_at, ends_at, rules JSONB)
CompetitionEntry (competition_id FK, user_id FK, result JSONB, rank)
Follow          (follower_id FK, followee_id FK, created_at)
ShareLink       (id, target_type[art|profile], target_id, code UNIQUE,
                 expires_at NULL, view_count)
Subscription    (id, user_id FK, stripe_customer_id, plan, status,
                 renews_at, cancel_at)
Purchase        (id, user_id FK, sku, stripe_payment_id, granted_at)
Entitlement     (user_id FK, feature_key, source[sub|purchase],
                 expires_at NULL)
```

Indexing notes: `Score(tool_id, challenge_id, value)` for leaderboard
queries, `ArtPiece(share_code)` unique index for O(1) share resolution,
partial index on `Subscription(status='active')` for entitlement checks.

---

## 7. API surface

REST, versioned under `/api/v1`, OpenAPI-documented so a typed client can
be generated for the app shell and (later) any mobile client.

```
Auth
  POST /auth/signup            POST /auth/login
  POST /auth/oauth/:provider   POST /auth/refresh
  POST /auth/logout

Profile
  GET  /me                     PATCH /me
  GET  /users/:id              GET  /users/:id/art

Art
  POST /art                    GET  /art/:id
  POST /art/:id/share  → { shareCode }
  GET  /share/:code    → resolves to art or profile

Scores & challenges
  GET  /challenges/today?tool=:toolId
  POST /challenges/:id/complete
  POST /scores                 (server re-validates proof before writing)
  GET  /leaderboards/:toolId?period=daily|weekly|alltime&scope=global|friends

Competitions
  POST /competitions           POST /competitions/:id/join
  GET  /competitions/:id
  WS   /ws/competitions/:id    (live score push)

Social
  POST /follow/:userId         DELETE /follow/:userId
  GET  /feed

Billing
  POST /billing/checkout-session
  POST /billing/portal-session
  POST /webhooks/stripe        (signature-verified, idempotent)
```

Auth model: short-lived JWT access token (15 min) + httpOnly refresh
cookie; all mutating endpoints require CSRF protection if cookie-based.

---

## 8. Tech stack

| Layer | Recommendation | Why |
|---|---|---|
| Existing tools | Unchanged: vanilla HTML/CSS/JS, Canvas2D, Tone.js | Zero risk to what already works |
| App shell (new) | Next.js or SvelteKit, TypeScript | Owns profile/leaderboard/challenge/paywall UI; tools embed as-is |
| API server | Node.js + TypeScript, Fastify (lean) or NestJS (structured) | Same language as frontend → shared types, faster hiring/onboarding |
| Realtime | Socket.IO self-hosted, or managed (Ably/Pusher) for MVP | Managed removes ops burden for competitions/live leaderboard at low initial volume |
| Primary DB | PostgreSQL (managed: RDS / Neon / Supabase) | Relational integrity for users/scores/billing; mature tooling |
| Cache / ephemeral | Redis (managed: Upstash / Elasticache) | Leaderboard sorted sets, rate limiting, session cache |
| Object storage | Cloudflare R2 or AWS S3 | `.art` files, thumbnails, avatars; R2 has no egress fee |
| Queue / async | BullMQ (Redis-backed) or SQS | Thumbnail generation, score verification, webhook handling |
| Auth | Managed (Clerk / Supabase Auth / Auth0) for MVP; revisit self-hosted only at scale | Cuts weeks off Phase 1, handles OAuth + email flows correctly |
| Billing | Stripe (Billing + Checkout) | Industry standard, handles subscriptions + one-off IAP + webhooks |
| Hosting/infra | Fly.io or Render for API (MVP); ECS Fargate or Kubernetes only if/when scale demands it | Low ops overhead first; avoid Kubernetes complexity until there's a real reason |
| CDN | Cloudflare | Free tier covers Phase 0 needs and stays useful at scale |
| CI/CD | GitHub Actions (already in repo) | Extend existing `ci.yml` pattern rather than introducing a new system |
| Observability | Sentry (errors) + Grafana Cloud or Better Stack (metrics/logs) | Managed, low setup cost, scales down in price when traffic is low |

---

## 9. Load balancing & scaling strategy

This is the direct answer to "load balance ... while using many people,"
scoped to the point where a real backend exists (Phase 1+):

### 9.1 Static layer
Already solved by the CDN in Phase 0 — this layer scales to effectively
unlimited concurrent users for free, since tools and the app shell's
static assets are cached at the edge.

### 9.2 API layer
- API servers are **stateless** (no in-memory session state — sessions
  live in Redis/JWT) so any instance can serve any request.
- Run at least 2 instances behind a load balancer at all times (no
  single point of failure), autoscale on CPU + p95 latency.
- Health checks with automatic instance replacement on failure.
- Rate limit per-user and per-IP at the edge (Cloudflare) and again at
  the API gateway, so one abusive client can't degrade service for
  everyone else — directly addresses "low responding... while using
  many people."

### 9.3 Database layer (usually the real bottleneck, not the app servers)
- Connection pooling (PgBouncer) — Postgres has a hard connection limit;
  without pooling, autoscaling the API layer just exhausts the DB first.
- Read replicas for read-heavy paths (leaderboards, profile views);
  writes (score submission, purchases) go to primary.
- **Leaderboards specifically should not be live Postgres `ORDER BY`
  queries under load.** Maintain a Redis sorted set (`ZADD` on score
  submit, `ZREVRANGE` to read) per `tool_id + period`; Postgres remains
  the source of truth, Redis is the fast read path. This is the single
  highest-leverage change for "leaderboard page feels slow with many
  people."
- Cache profile/leaderboard reads with a short TTL (5–30s) — leaderboard
  data doesn't need to be real-time-perfect.

### 9.4 Real-time / competitions
- WebSocket gateway is a separate scaling concern from the REST API
  (long-lived connections vs. short requests) — run it as its own
  service/pool, sticky-session-aware or backed by a pub/sub broker
  (Redis Pub/Sub) so any gateway instance can broadcast to any
  connected client regardless of which instance they're on.

### 9.5 Async work off the request path
Anything that isn't needed to answer the current HTTP request
(thumbnail generation, email, Stripe webhook side-effects, daily
challenge rollover) goes through a queue, not inline — this keeps
user-facing p95 latency low even when background work spikes.

### 9.6 Load testing before every phase ships
Use k6 or Artillery against a staging environment sized like production,
targeting realistic concurrency (start at 10× current expected peak) —
catch regressions before real users do.

---

## 10. Data, sync & "memory" model

"Memory" here means: what the system remembers about a user/session, and
how local and cloud state reconcile.

- **Local-first**: every save still produces a local `.art` file exactly
  as today (principle #3). Cloud sync is an *additional* copy, not a
  replacement.
- **Sync direction**: on save, if online + logged in, the SDK also
  uploads to `POST /art` in the background; on load, the app shell can
  show "your cloud gallery" merged with local saves by content hash so
  the same piece isn't duplicated.
- **Conflict resolution**: last-write-wins by timestamp for simple
  fields (profile bio, settings); art pieces are immutable once
  uploaded (edits create a new version, not an overwrite) so there's
  nothing to conflict.
- **Offline queue**: score submissions, challenge completions, and art
  uploads attempted while offline are queued in IndexedDB and flushed
  on reconnect, in order, with idempotency keys so a retry can't double-
  count a score.
- **Session memory**: JWT access token in memory (not localStorage, to
  reduce XSS exposure), refresh token in an httpOnly cookie.
- **Retention & privacy**: define a data retention policy up front
  (e.g., inactive free accounts' cloud art pruned after N months with
  warning email; paid accounts retained); support account data export
  and deletion (GDPR-style "right to be forgotten") from day one of
  Phase 1 — much cheaper to build in than retrofit.

---

## 11. Design specs

New surfaces, all following the existing dark-first, quiet-chrome visual
language from `.claude/rules/design.md` (neutral colors, canvas/content
stays the visual focus, no ads, no forced walls):

- **Home / launcher (evolved)**: today's static grid becomes a feed —
  "Continue where you left off," "Today's challenges" row, then the
  existing tool grid unchanged below it. Logged-out users see exactly
  today's experience, untouched.
- **Profile**: avatar, display name, level/XP bar, stat tiles (streak,
  total pieces, best ranks), tabs for Gallery / Achievements / Activity.
- **Leaderboard**: per-tool tabs, period switch (daily/weekly/all-time),
  global vs. friends toggle, current user's row pinned/highlighted even
  if off-screen.
- **Challenge**: banner on a tool's own page ("Today's challenge: ..."),
  countdown to reset, streak indicator; completing it drops the user
  back into normal free-draw mode for that tool.
- **Duel/competition**: split view or turn-based comparison of the same
  prompt/seed between two users, live score ticker via WebSocket.
- **Paywall/upgrade**: a single dismissible modal or a quiet inline
  "Unlock" affordance next to gated features — never a full-screen
  interstitial, never on first open (per the "no upsells" rule).

---

## 12. Feature PRDs (lightweight)

Each entry: goal → primary user story → MVP scope → success metric.

**Accounts & profile**
Goal: give returning users a persistent identity across devices.
Story: "As a user, I want my art and progress to follow me to a new
device." MVP: email + one OAuth provider, profile page, cloud gallery
sync. Metric: % of active users with an account within 30 days of
launch.

**Daily challenges**
Goal: give users a reason to come back daily. Story: "As a user, I want
a fresh, shared prompt each day so I'm creating with everyone else, not
just alone." MVP: one challenge per tool per day (server-generated seed/
params), streak counter. Metric: D1/D7 retention lift vs. non-challenge
cohort.

**Score & leaderboard**
Goal: add light competitive structure without turning tools into games
they weren't designed to be. Story: "As a user, I want to see how my
best work/run compares to others." MVP: per-tool score definition (tool
owner decides what "score" means, e.g. speed or symmetry-accuracy),
global + friends leaderboard, daily/weekly/all-time. Metric: leaderboard
page views per DAU.

**In-app sharing with ID**
Goal: let a piece travel outside the app and bring people back in.
Story: "As a user, I want a link I can send that shows my art and invites
the viewer to try the tool." MVP: `POST /art/:id/share` → short code →
public view page with a "Try this tool" CTA. Metric: share → new-user
signup conversion rate.

**Competitions**
Goal: structured head-to-head or tournament play. Story: "As a user, I
want to challenge a friend directly, not just compare leaderboard
positions passively." MVP: 1v1 duel on a shared seed, async (not
required to be simultaneous) with a result screen. Metric: duels
completed per week.

**Subscriptions & IAP**
Goal: sustainable revenue without compromising the free creative core.
Story: "As a paying user, I want extra creative options (packs, no
limits) without the free experience feeling crippled to push me toward
paying." MVP: one subscription tier (e.g., removes cloud-storage limits,
unlocks cosmetic brush/color packs across all tools) + a small catalog of
one-off cosmetic IAP. Metric: free→paid conversion rate, refund rate.

---

## 13. Monetization rules

- Free tier must remain **fully creatively capable** — every existing
  tool's core mechanic stays free forever (matches principle #2: no
  crippled free tier as an upsell tactic).
- Paid tier value = convenience + extras: cloud storage beyond a
  generous free cap, cosmetic packs, early access to new tools/challenges,
  competition perks (e.g., private tournaments) — not gameplay-blocking
  gates.
- IAP catalog is cosmetic/convenience only, never pay-to-win on
  leaderboards (a paid brush pack must not itself score higher — keep
  scoring based on skill/creativity, not purchased power).
- All billing state changes flow through signed, idempotent Stripe
  webhooks into the `Entitlement` table — client-side purchase state is
  never trusted directly.
- Clear, one-click cancel and data export; refund policy stated up front.

---

## 14. Security & anti-cheat

- OWASP Top 10 baseline on every API endpoint; input validation at the
  edge of the API (schema validation, e.g. zod) before touching business
  logic.
- Secrets in a managed secret store (not `.env` in the repo), rotated
  per environment.
- Dependency scanning in CI (`npm audit` / Dependabot) — extend the
  existing `ci.yml` rather than a parallel system.
- **Score integrity**: define what "score" means per tool precisely
  enough to validate server-side (e.g., re-derive a speed-run score from
  a submitted action log/timestamp trail rather than trusting a raw
  number). Rate-limit score submissions per user. Flag statistical
  outliers (e.g., top 0.1% by a wide margin) for manual review before
  they hit public leaderboards.
- Daily challenge seeds are generated **server-side only** and not
  derivable/predictable client-side, so a challenge can't be "solved"
  before it's issued.
- Share links: unguessable codes (not sequential IDs), optional
  expiry, no PII exposed on public share pages beyond what the user
  opted to make public.

---

## 15. Rollout phases / roadmap

| Phase | Scope | Depends on backend? |
|---|---|---|
| **0 — Performance** | CDN, vendored libs, caching, service worker, web-vitals monitoring | No |
| **1 — Platform foundation** | Auth, profile, cloud art sync (additive to local save), hosting/infra, CI/CD for backend, API skeleton | Yes — first backend |
| **2 — Engagement** | Score model per tool, daily challenges, leaderboards (Redis-backed) | Yes |
| **3 — Social & competitive** | Sharing with ID, follow/feed, 1v1 duels, WebSocket live updates | Yes |
| **4 — Monetization** | Subscriptions, IAP catalog, entitlements, paywall UI, Stripe integration | Yes |
| **5 — Scale hardening** | Load testing, autoscaling tuning, read replicas, observability maturity, cost review | Yes |

Each phase should ship independently usable and behind its own feature
flag — Phase 2 must not block on Phase 3, etc. A phase is "done" when its
feature's success metric (see [section 12](#12-feature-prds-lightweight))
has a baseline measurement, not just when the code merges.

---

## 16. Engineering rules & conventions

Extends `.claude/rules/` for the new backend/platform layer:

- **Backward compatibility is non-negotiable**: no change may make a
  tool require an account or network to function at its current level.
  CI should include an offline-mode smoke test (serve with network
  disabled, verify core draw/save/load still works) once the SDK exists.
- **API versioning**: breaking changes get a new `/api/v2` path;
  `v1` stays supported for a published deprecation window, never broken
  in place.
- **Every schema migration is reversible**: write the down-migration
  before merging the up-migration; test rollback in CI/staging.
- **Every new service ships with**: health check endpoint, structured
  logs, basic metrics, and an owner in an on-call rotation (even if
  that's one person initially) before it touches production traffic.
- **Feature flags** for anything user-facing and new — allows instant
  rollback without a deploy.
- **Testing bar**: unit tests for business logic, integration tests for
  API endpoints against a real (containerized) Postgres/Redis, load
  test before a phase's traffic-sensitive features (leaderboard,
  competitions) ship.
- **Design consistency review**: any new screen gets checked against
  `.claude/rules/design.md` before shipping — the platform layer must
  look and feel like it belongs to the same product as the tools.

---

## 17. Setup checklist (when Phase 1 actually starts)

1. Stand up managed Postgres + Redis + object storage (dev/staging/prod
   environments, separate credentials each).
2. Pick and configure managed auth provider; implement `/auth/*`.
3. Scaffold API service (Fastify/NestJS + TypeScript), OpenAPI spec,
   generated client for the app shell.
4. Scaffold app shell (Next.js/SvelteKit) with routing for `/profile`,
   `/leaderboard`, `/challenges`; embed existing tools unchanged.
5. Build `shared/artzloop-sdk.js` per [5.1](#51-how-existing-tools-plug-in-without-a-rewrite);
   wire into one pilot tool first (not all 13 at once).
6. Stand up CI/CD for the backend (extend GitHub Actions), staging
   environment on the same infra pattern as production.
7. Add observability (Sentry + metrics) before the first real user
   traffic hits the new services.
8. Only after 1–7 are stable: begin Phase 2 (score/challenges/
   leaderboard).

---

## 18. Open questions / decisions needed

These are genuine calls only the project owner can make — flagged rather
than guessed:

- **Brand/positioning**: does "ArtzLoop Cloud" ship as an evolution of
  the same domain/app, or a clearly separate product tier/URL? Affects
  routing, marketing, and how hard the "tools still work offline" promise
  needs to be visually communicated to new users.
- **Which tools get a "score" first?** Not all 13 tools have an obvious
  competitive metric (e.g., Ink Marbling is exploratory, not
  timed/precision-based). Needs a per-tool design pass before Phase 2.
- **Managed vs. self-hosted auth/realtime long-term**: fine to start
  managed (Clerk/Ably) for speed; revisit self-hosting only if cost or
  control becomes a real constraint at scale — don't pre-optimize.
- **Mobile app, ever?** If yes eventually, IAP should route through
  RevenueCat from day one instead of Stripe-only, to avoid a second
  billing migration later.
- **Budget/timeline** for Phase 1 infra (managed services above have
  real monthly cost even at low traffic) — needs sign-off before
  setup checklist item 1.
