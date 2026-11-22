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
- `lib/state.js` — pure helpers only (no JSX): `defaultState()`, `mergeWithDefaults()` (forward-compatible loader — always merges parsed data onto defaults, so new fields must be added here), date/format helpers, constants (`TABS`, …).
- `lib/persistence.js` — **Supabase-only** (localStorage fallback removed). `loadUserState(uid)` reassembles the in-memory state shape from the tables (`sleep_logs`, `water_logs`, `focus_days`, `exercise_logs`, `habits`, `habit_checks`, `canvas_pages`) plus `profiles` (`settings`/`stats`/`diet_plan`/`workout_plan`/`tasks` jsonb). `syncUserState(uid, cur, prev)` is a **targeted diff-sync**: it compares against the last-saved baseline and issues only the needed upserts/deletes per domain (date-keyed maps, id-keyed arrays, habits+checks, profile jsonb). `best_streak` is mirrored to a `profiles` column. The client never reads or writes anything XP-related (see “No gamification” below). Table-row IDs (`habits`, `exercise_logs`) are client-generated `crypto.randomUUID()` `uuid` PKs; ids inside jsonb (diet/workout plans, tasks) remain `Date.now()` — they're scoped to the user's own document, so collision doesn't matter there. A legacy `profiles.state` blob is migrated client-side on first load then nulled (`clearLegacyState`). **Array order is user-facing order**: `state.habits` is rendered in array order everywhere (calendar, home, agenda), and that order persists in `habits.pos` — sorted client-side by `pos` (stable sort over `.order("created_at")`) — **not** `.order("pos")`, so a DB that has not run the migration still loads instead of tripping the anti-clobber guard. Reorder rewrites `pos` for *every* habit (partial writes would leave legacy rows tied at 0).

  **Key-order matters for the diff-sync.** It compares by `JSON.stringify`, and every load re-runs `mergeWithDefaults`. So a normalizer that emits keys in a different order than the code creating the objects makes the first sync of every session re-upsert unchanged rows. When adding a normalizer, build new objects in the same key order (see `normalizeCanvasElement` and the element factories in `missoes/Prancheta.js`).
- `lib/supabaseClient.js` — exports `supabase`, which is **`null` when env vars are unset**. Every consumer guards on this. With no env the app has no persistence (in-memory only). Never assume `supabase` is non-null.

Persistence is fire-and-forget with debounce: mutate `state` via `setState` and the diff-sync happens automatically. Don't call `syncUserState` directly from feature pages. **Anti-clobber guard**: if the initial load throws, `AppContext` shows an error screen and never saves — so a flaky read can't overwrite good data with defaults.

### Routing

- `app/(app)/` route group — the authenticated shell. `layout.js` wraps children in `AppProvider` + `Chrome`: a shadcn `Sidebar` (`collapsible="icon"`, open state bound to `settings.sidebarCollapsed`, Ctrl/Cmd+B comes from `SidebarProvider`), a 56px top bar (page title, help, theme toggle) and, on mobile, a fixed bottom bar (the `TABS` + Perfil). Active tabs: `habitos` (Habit Tracker), `sono` (Sleep Tracker), `agua` (Water Tracker), `exercicio` (Workout Tracker), `diario` (Journaling), `leitura` (Reading), `missoes` (Board — the Trello-style kanban + Prancheta) — labels are English by owner choice, the rest of the copy is pt-BR. Every other folder (`mapa`, `foco`, `dieta`, …) is commented out of `TABS` and listed in `DISABLED_ROUTES`; its data stays in state and DB.
- `app/page.js` redirects `/` → `HOME_ROUTE` (currently `/habitos`).
- `app/login/` — Supabase auth. When `supabase` is null this is bypassed.
- Auth gate lives in `AppContext` load effect (redirects to `/login` if Supabase configured and no session) — not in middleware.

### The Prancheta (drawing canvas)

`app/(app)/missoes/Prancheta.js` is a self-contained SVG editor — the third `MISSOES_VIEWS` entry, alongside kanban/lista. SVG (not `<canvas>`) so every stroke stays a selectable object and the same markup exports as a file. All geometry is in **world coordinates**; `view = {x, y, zoom}` is only a `translate/scale` on a wrapping `<g>`, so zoom/pan never touch the data.

The rule that keeps it from thrashing the app: **one global write per gesture.** The in-flight stroke lives in `draft` and an in-flight move/resize in `preview`, both local state mirrored into refs (`draftRef`/`previewRef`) — `pointermove` is a continuous event, so React may not have flushed the last `setState` when `pointerup` fires, and the refs are what the commit reads. Undo/redo history is local per page and reset on page switch.

### Water Tracker (`/agua`)

Ported from the standalone `DevwiseWater` page (vanilla HTML/JS) into the app's state, tokens and shadcn primitives. `state.water = { [date]: { goal, entries: [{ id, ml, time }] } }` — one `water_logs` row per day (`user_id,date` PK, `entries` jsonb), diffed with `diffDateMap` like sleep. `goal` is stored per day so changing the goal doesn't recolour past days; `setWaterGoal` updates `settings.waterGoal` and today's row only. An empty day is deleted, not kept as `[]`. Entries are created by `makeWaterEntry` **outside** the `setState` updater (an updater may run twice; an id generated inside it would differ between runs). The table is optional at runtime: `loadUserState`/`syncUserState` ignore a missing-table error (`isMissingTable`) so a DB without `supabase/patch-agua.sql` still loads and saves everything else — any other error still trips the anti-clobber guard. The reminder (`settings.waterReminder`, 0/60/120 min, 7h–22h, only below goal) lives in `AppContext`, so it fires on any tab. The glass is SVG; `--level` (viewBox units) on `.water-level` drives the fill via CSS transition, and the water colour is the accent (`primary-container`) because it is data — CSS lives at the end of `globals.css` (`.water-*`, `.glass-*`).

### No gamification

The app **has no gamification**: no XP, levels, tiers, badges, leaderboard, groups, streak multiplier, penalties or bonuses, and no pet shop. Streaks stay (`stats.streak`/`bestStreak`, habit streaks, journal streak) because they are tracking, not scoring. `GAMIFICATION.md` is historical.

The DB still carries the old columns and objects (`profiles.xp`, `xp` on log tables, `xp_events`, `apply_xp_delta`, `leaderboard`, groups, `pet_entitlements`, `profiles.pet`) — nothing was dropped, the client just ignores them: `normalizeStats` discards a legacy `stats.xp`, log rows are written without `xp` (DB defaults to 0), `milestones`/`penaltyDate` on habits pass through untouched so nobody's data is erased. `routineChecks` values are `0` — the key existing *is* the check; the legacy `__all__` bonus key is dropped on the next edit of that day.

### The mascot (the rat)

One fixed animal: the rat from the logo. No species, coat, gear, name or growth — `components/PetArt.js` exports a single pure-SVG `Bicho({ act, size })` (act: `idle`/`walk`/`sit`/`sleep`/`happy`). CSS `transform` overrides the SVG `transform` attribute, so every animated piece is a **child** `<g>` of the one carrying `translate`/`scale`.

It rides the whole app: `components/BichoDaTela.js` is rendered once by `Chrome` (`app/(app)/layout.js`) above `children`, and `lib/petMood.js` (`petScene(tab, state)`) decides what he makes of the current tab — pose, one line, optional percentage. It is a single pure function because the whole app state is one object, so "how are habits doing today" is answerable from outside `/habitos`. The strip hides itself wherever `petScene` returns null (`/sono` has its own strip, anything outside `TABS`) — there is no exception list to maintain. Tone rule: `warn` is reserved for something actually overdue (a late card, a diet over goal, a streak at risk, a week ending short). A morning with nothing checked yet is `idle`, and a brand-new account never gets scolded — otherwise the strip becomes noise people learn to skip.

`sono/BichoDaNoite.js` is the same strip shape as `BichoDaTela`, deliberately: richer night scenes were prototyped and the slim strip won — the sleep record is already drawn above it by the duration ring and the verdict chips. It reads the **form state**, not the saved entry, so editing a time changes the pose and the bar before saving.

Habits also carry an optional **mínimo executável** (`habits.minimum`): a text describing the smallest version that still counts. `markHabitMinimum` marks the day *bypassing the checklist lock* — a minimum day is a completed day, deliberately indistinguishable from any other in every surface (same solid dot on the calendar, same "Feito hoje" label, same streak). What the app measures is showing up, and a hollow dot turned the bad day the feature exists to rescue into a permanent asterisk. `habits.min_days` still records the date, but it is **not** a UI label: it only tells `toggleHabitStep` that the mark came from outside the checklist, so reopening a step must not unmark it; closing the last step drops the date from `min_days` (internal `clearMinDay`) and hands control back to the checklist. Only `/habitos` exposes the action — Home, Agenda and Calendário still enforce the full lock.

**Both habits and sleep are recorded retroactively.** In `/habitos` the page opens on `HabitBlocks` — today's tiles at every width (tap = mark today, mínimo button inline, a done tile changes as a whole: accent border/fill, check, "Feito hoje") — and below it, desktop only, the month calendar ("Histórico"), which is the retro form, so retro marking needs the wide layout: every already-lived cell is clickable (`dayEditable` — future and pre-`createdAt` days are not), and `toggleHabitState(prev, id, date)`/`logRelapse(h, date)` take the date. Two rules make that safe: the microactivity lock applies **only to `date === getDateStr(0)`** (step checks are a today-only artifact — `pruneStepChecks` keeps ~a week and no other date is editable in the UI, so enforcing it on a past day would block a record through a door that doesn't exist). `/sono` picks the night with a date field (`RETRO_DAYS` = 30 back), reloading the form from `state.sleep[date]` on change, so editing an old night is the same form.

### The global Pomodoro timer

Lives in `AppContext` (state `phase`/`secondsLeft`/`isRunning`/`cyclePos`), so it survives navigation between pages. It anchors on wall-clock time (`endRef = Date.now() + secondsLeft*1000`) rather than counting interval ticks, making it immune to background-tab throttling; a `visibilitychange` handler resyncs on return. `TimerWidget` (also in AppContext) renders a floating mini-timer on every page except `/foco`.

### Styling

- Tailwind v4 configured entirely in `app/globals.css` via `@theme`. Two vocabularies over **one** palette: the Material-3 names the pages were written with (`bg-surface-container`, `text-on-surface-variant`, `text-primary-container`…) and the shadcn names (`bg-card`, `text-muted-foreground`, `border-border`…) point at the same values. Use tokens, never raw hex. Dark is the `@theme` default; `html.light` overrides (toggled by `lib/themes.js`, default mode in `defaultState()` is light).
- **Colour rule:** neutral zinc surfaces (no navy/slate). `primary` is *ink* (near-white on dark, near-black on light) — titles, primary buttons, active states. `primary-container` is the **only accent**, royal blue (`#3b82f6` dark with near-black text on it / `#2563eb` light with white text, one step darker so it holds 4.5:1 on white) and it goes on **data only**: done habit, progress fill, ring arc, chart line. Not on nav, headings, borders or generic buttons.
- **One typeface:** Geist via `next/font` in `app/layout.js` (`--font-geist` → `--font-sans`). The legacy classes `font-headline-*`, `font-label-caps`, `font-display-timer` still exist but all resolve to Geist; prefer plain Tailwind sizes. Copy is **sentence case** — no tracked uppercase mono labels (the old look). `lib/petMood.js` lines are lower case and `BichoDaTela` capitalises the first letter with `first-letter:uppercase`.
- **shadcn/ui** (JS, `components.json`, style new-york, Radix via the `radix-ui` package) lives in `components/ui/*.jsx`; add more with `bunx shadcn@latest add <name>` — then check the generated imports use `@/lib/utils` for `cn` (the CLI once wrote `from "cn"` and installed a bogus npm package). The old hand-rolled primitives moved from `components/ui.js` to `components/ui/index.js` (`MI`, `Caps`, `StarRating`, `Stepper`, `StatTile`, `PageHeader`, `Select`, `inputCls`, `textareaCls`), so `@/components/ui` imports keep working.
- Icons: Material Symbols through `<MI name="..." />` (weight 300, imported in globals.css). shadcn internals use lucide for their own chevrons/close icons.
- `.glass-card` survives as a plain card (surface + 1px border, no blur) because ~90 call sites use it.

### Conventions

- Import alias `@/*` → repo root (see `jsconfig.json`), e.g. `@/lib/state`, `@/components/ui`.
- UI copy is Portuguese (pt-BR). Product name is "Discipline Rats"; older internal name "Foco de Ferro" persists in the package name (`foco-de-ferro`), storage key, and schema comments.
- `supabase/schema.sql` is the DB setup — run once in the Supabase SQL editor. Defines `profiles`, RLS policies, a new-user trigger, and the public `leaderboard` view.
