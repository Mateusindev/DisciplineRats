# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **Bun** (lockfile `bun.lock` — never generate npm/yarn lockfiles).

```bash
bun install
bun run dev     # dev server at http://localhost:3000
bun run build   # production build
bun run start   # serve the build
bun run lint    # next lint
```

There is no test suite. `bun run build` is the effective correctness gate.

## Architecture

Single-user self-discipline dashboard. **Next.js 15 App Router + React 19 + Tailwind v4**, JavaScript (no TypeScript). All UI is client-side; there are **no Next API routes** — the browser talks directly to Supabase, protected by Row Level Security.

### State model — one in-memory object, normalized storage

The entire app state (settings, stats, tasks, habits, sleep, exerciseLogs, focusHistory, dietPlan, workoutPlan) is a **single JSON object in memory**, living in one React context. **Storage is normalized** (not a single blob): time-series logs live in their own tables; config/plans/tasks stay as `jsonb` on `profiles`. The in-memory shape is unchanged from the old blob — the persistence layer maps between shape and tables.

- `app/(app)/AppContext.js` — `AppProvider` holds `state` in `useState`, exposes it plus actions via `useApp()`. Owns: initial load, day-rollover logic, debounced save (600ms after any `state` change), the global Pomodoro timer, toasts, and the settings modal. **This is the file to read first** — nearly all mutation flows through here.
- `lib/state.js` — pure helpers only (no JSX): `defaultState()`, `mergeWithDefaults()` (forward-compatible loader — always merges parsed data onto defaults, so new fields must be added here), gamification math, date/format helpers, constants (`TABS`, `TIERS`, `XP`).
- `lib/persistence.js` — **Supabase-only** (localStorage fallback removed). `loadUserState(uid)` reassembles the in-memory state shape from the tables (`sleep_logs`, `focus_days`, `exercise_logs`, `habits`, `habit_checks`) plus `profiles` (`settings`/`stats`/`diet_plan`/`workout_plan`/`tasks` jsonb). `syncUserState(uid, cur, prev)` is a **targeted diff-sync**: it compares against the last-saved baseline and issues only the needed upserts/deletes per domain (date-keyed maps, id-keyed arrays, habits+checks, profile jsonb). `xp`/`best_streak` are mirrored to `profiles` columns for the leaderboard. Table-row IDs (`habits`, `exercise_logs`) are client-generated `crypto.randomUUID()` `uuid` PKs; ids inside jsonb (diet/workout plans, tasks) remain `Date.now()` — they're scoped to the user's own document, so collision doesn't matter there. A legacy `profiles.state` blob is migrated client-side on first load then nulled (`clearLegacyState`).
- `lib/supabaseClient.js` — exports `supabase`, which is **`null` when env vars are unset**. Every consumer guards on this. With no env the app has no persistence (in-memory only). Never assume `supabase` is non-null.

Persistence is fire-and-forget with debounce: mutate `state` via `setState` and the diff-sync happens automatically. Don't call `syncUserState` directly from feature pages. **Anti-clobber guard**: if the initial load throws, `AppContext` shows an error screen and never saves — so a flaky read can't overwrite good data with defaults.

### Routing

- `app/(app)/` route group — the authenticated shell. `layout.js` wraps children in `AppProvider` + `Chrome` (sidebar/navbar/bottom-nav from `TABS`). Each tab is a folder: `foco`, `habitos`, `sono`, `exercicio`, `dieta`, `analise`.
- `app/page.js` redirects `/` → `/foco`.
- `app/login/` — Supabase auth. When `supabase` is null this is bypassed.
- Auth gate lives in `AppContext` load effect (redirects to `/login` if Supabase configured and no session) — not in middleware.

### Gamification

XP/level/streak rules are in `lib/state.js` (`XP`, `award`, `streakMult`, `gamify`, `tierFor`) and applied in `AppContext` (`completeFocusSession`) and feature pages. `GAMIFICATION.md` documents the rules but says they live in `app/page.js` — that is **stale**; the source of truth is `lib/state.js`. Streak multiplier is applied at the moment XP is awarded, so it must be computed before adding XP.

### The global Pomodoro timer

Lives in `AppContext` (state `phase`/`secondsLeft`/`isRunning`/`cyclePos`), so it survives navigation between pages. It anchors on wall-clock time (`endRef = Date.now() + secondsLeft*1000`) rather than counting interval ticks, making it immune to background-tab throttling; a `visibilitychange` handler resyncs on return. `TimerWidget` (also in AppContext) renders a floating mini-timer on every page except `/foco`.

### Styling

- Tailwind v4 configured entirely in `app/globals.css` via `@theme` — a full Material-3 dark token palette (`bg-surface-container`, `text-on-surface-variant`, `text-primary-container`, etc.). Use these semantic tokens, not raw hex. App is dark-only (`<html className="dark">`).
- Fonts and Material Symbols are imported via Google Fonts `@import` in globals.css. Icons use the `<MI name="..." />` component.
- Shared primitives in `components/ui.js`: `MI`, `Caps`, `StarRating`, `Stepper`, `StatTile`, `inputCls`.

### Conventions

- Import alias `@/*` → repo root (see `jsconfig.json`), e.g. `@/lib/state`, `@/components/ui`.
- UI copy is Portuguese (pt-BR). Product name is "Discipline Rats"; older internal name "Foco de Ferro" persists in the package name (`foco-de-ferro`), storage key, and schema comments.
- `supabase/schema.sql` is the DB setup — run once in the Supabase SQL editor. Defines `profiles`, RLS policies, a new-user trigger, and the public `leaderboard` view.
