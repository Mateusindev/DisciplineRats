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
- `lib/persistence.js` — **Supabase-only** (localStorage fallback removed). `loadUserState(uid)` reassembles the in-memory state shape from the tables (`sleep_logs`, `focus_days`, `exercise_logs`, `habits`, `habit_checks`, `canvas_pages`) plus `profiles` (`settings`/`stats`/`diet_plan`/`workout_plan`/`tasks` jsonb). `syncUserState(uid, cur, prev)` is a **targeted diff-sync**: it compares against the last-saved baseline and issues only the needed upserts/deletes per domain (date-keyed maps, id-keyed arrays, habits+checks, profile jsonb). `xp`/`best_streak` are mirrored to `profiles` columns for the leaderboard. Table-row IDs (`habits`, `exercise_logs`) are client-generated `crypto.randomUUID()` `uuid` PKs; ids inside jsonb (diet/workout plans, tasks) remain `Date.now()` — they're scoped to the user's own document, so collision doesn't matter there. A legacy `profiles.state` blob is migrated client-side on first load then nulled (`clearLegacyState`). **Array order is user-facing order**: `state.habits` is rendered in array order everywhere (calendar, home, agenda), and that order persists in `habits.pos` — sorted client-side by `pos` (stable sort over `.order("created_at")`) — **not** `.order("pos")`, so a DB that has not run the migration still loads instead of tripping the anti-clobber guard. Reorder rewrites `pos` for *every* habit (partial writes would leave legacy rows tied at 0).

  **Key-order matters for the diff-sync.** It compares by `JSON.stringify`, and every load re-runs `mergeWithDefaults`. So a normalizer that emits keys in a different order than the code creating the objects makes the first sync of every session re-upsert unchanged rows. When adding a normalizer, build new objects in the same key order (see `normalizeCanvasElement` and the element factories in `missoes/Prancheta.js`).
- `lib/supabaseClient.js` — exports `supabase`, which is **`null` when env vars are unset**. Every consumer guards on this. With no env the app has no persistence (in-memory only). Never assume `supabase` is non-null.

Persistence is fire-and-forget with debounce: mutate `state` via `setState` and the diff-sync happens automatically. Don't call `syncUserState` directly from feature pages. **Anti-clobber guard**: if the initial load throws, `AppContext` shows an error screen and never saves — so a flaky read can't overwrite good data with defaults.

### Routing

- `app/(app)/` route group — the authenticated shell. `layout.js` wraps children in `AppProvider` + `Chrome` (sidebar/navbar/bottom-nav from `TABS`). Each tab is a folder: `foco`, `habitos`, `sono`, `exercicio`, `dieta`, `analise`.
- `app/page.js` redirects `/` → `/foco`.
- `app/login/` — Supabase auth. When `supabase` is null this is bypassed.
- Auth gate lives in `AppContext` load effect (redirects to `/login` if Supabase configured and no session) — not in middleware.

### The Prancheta (drawing canvas)

`app/(app)/missoes/Prancheta.js` is a self-contained SVG editor — the third `MISSOES_VIEWS` entry, alongside kanban/lista. SVG (not `<canvas>`) so every stroke stays a selectable object and the same markup exports as a file. All geometry is in **world coordinates**; `view = {x, y, zoom}` is only a `translate/scale` on a wrapping `<g>`, so zoom/pan never touch the data.

The rule that keeps it from thrashing the app: **one global write per gesture.** The in-flight stroke lives in `draft` and an in-flight move/resize in `preview`, both local state mirrored into refs (`draftRef`/`previewRef`) — `pointermove` is a continuous event, so React may not have flushed the last `setState` when `pointerup` fires, and the refs are what the commit reads. Undo/redo history is local per page and reset on page switch.

### Gamification

XP/level/streak rules are in `lib/state.js` (`XP`, `award`, `streakMult`, `gamify`, `tierFor`) and applied in `AppContext` (`completeFocusSession`) and feature pages. `GAMIFICATION.md` documents the rules but says they live in `app/page.js` — that is **stale**; the source of truth is `lib/state.js`. Streak multiplier is applied at the moment XP is awarded, so it must be computed before adding XP.

**XP does exactly one thing: grow the pet.** It buys nothing. `stats.xp` is the lifetime progress ledger (level, tier, pet growth stage, badges, leaderboard) and only ever goes up — there is no spend path, so nothing can shrink the pet.

**The cat's art lives in `components/PetArt.js`, not in the page that shows it.** `Cat`/`Toy`/`Scene`/`GearPreview` are pure SVG with no state, so two screens draw the same animal: `perfil/Pet.js` (the pen — wandering, petting, naming, shop) and `sono/GatoDaNoite.js` (the cat in bed). Two rules survive the split: CSS `transform` overrides the SVG `transform` attribute, so every animated piece is a **child** `<g>` of the one carrying `translate`/`scale`; and head/face/neck gear is drawn inside the head group so it inherits `headScale` and scales with a kitten's oversized head for free.

The cat also rides the whole app: `components/GatoDaTela.js` is rendered once by `Chrome` (`app/(app)/layout.js`) above `children`, and `lib/petMood.js` (`petScene(tab, state)`) decides what he makes of the current tab — pose, one line, optional percentage. It is a single pure function because the whole app state is one object, so "how are habits doing today" is answerable from outside `/habitos`. The strip hides itself wherever `petScene` returns null (`/sono` has the bed scene, `/perfil` has the pen, anything outside `TABS`) — there is no exception list to maintain. Tone rule: `warn` is reserved for something actually overdue (a late card, a diet over goal, a streak at risk, a week ending short). A morning with nothing checked yet is `idle`, and a brand-new account never gets scolded — otherwise the strip becomes noise people learn to skip.

`sono/GatoDaNoite.js` renders the sleep record as a scene rather than decoration: the arc is 19h→7h, the thick segment is the sleep window, the moon marks bedtime, a dashed tick marks `settings.sleepLimit`, and the lit stars are the quality rating. The moon/sun are HTML positioned in `%` over the same box as the `preserveAspectRatio="none"` arc SVG, both from the shared `arcY(t)` — that is what keeps them on the curve at any width. It reads the **form state**, not the saved entry, so editing a time moves the moon live.

**Every accessory beyond one free item per category is paid (R$ 0.99, single price).** Ownership of a paid item is an `item_id` row in `pet_entitlements` — a table with a SELECT-only policy, written exclusively by the `mp-webhook` Edge Function (service key, bypasses RLS). There is deliberately **no client-side "owned" list**: `profiles` lets the owner rewrite their own row, so any such field would be a self-grant. `normalizePet` drops `owned`/`spent` if they appear in stored data, and `petOwns(state, id)` is the trust boundary — read it before touching ownership. The catalog exists twice on purpose (`PET_ITEMS` paints the UI, `functions/_shared/items.ts` charges); `bun run check:pet` fails if they drift, including if a free item ever becomes sellable. See `supabase/functions/mp-webhook/README.md`.

Habits also carry an optional **mínimo executável** (`habits.minimum`): a text describing the smallest version that still counts. `markHabitMinimum` marks the day *bypassing the checklist lock*, pays half the priority XP, and records the date in `habits.min_days` — so a minimum day is never indistinguishable from a full one (the calendar paints it hollow, same blue). `completeHabitFull` promotes a minimum day to full, paying only the difference; `toggleHabitStep` routes into it when the last step closes on a minimum day, and never unmarks a minimum day when a step is reopened. Only `/habitos` exposes the action — Home, Agenda and Calendário still enforce the full lock.

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
