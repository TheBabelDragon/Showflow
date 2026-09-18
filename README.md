# Showflow

Java-based show scheduling and staffing system. The scheduler reasons over
showtimes, rooms, workers, and a conflict graph. A/B/C are derived operational
windows, not independently entered set types.

**Store** is a first-class scheduling identity. Each store has its own workers,
showtimes, timezone, sources, and report surface. Store isolation is absolute.

`storeId` = physical location · `theater` = lead/scoring context · `room` = physical room.
Theater is **not** repurposed as location.

## Browser tool

GitHub Pages target from `.github/workflows/static.yml` (`path: '.'`):

| Page | URL |
|------|-----|
| **Scheduler** (production) | https://thebabeldragon.github.io/Showflow/ |
| **Store operations** | https://thebabeldragon.github.io/Showflow/stores/ |
| **Quantum Optimization** (experimental) | https://thebabeldragon.github.io/Showflow/quantum.html |

Both scheduler pages share day state via `localStorage`. The scheduler remains authoritative;
Quantum Optimization is comparison-only and never mutates the live schedule.

**Scheduler** flow:

workers → availability → shows → guests → showtimes (room + start + duration) → derived A/B/C → assignments → coverage → warnings → master day sheet

**Multi-store (Phase 1)** flow:

```
Store config (timezone, sources, outputs)
  → ShowtimeSource (Manual | API stub | iCal stub)
  → StoreSchedule (store + date + workers + shows)
  → AssignmentSolver (unchanged scoring)
  → ScheduleRevision (revisionId + scheduleHash)
  → StoreReportGenerator → text + JSON + iCal
```

**Quantum Optimization** flow:

read-only snapshot → modular parameters → QUBO → local solver → existing validation → compare metrics

Static launcher files (do not replace the Java model):

* `index.html` — production scheduler
* `stores/` — store picker + per-store report shells
* `quantum.html` — Quantum Optimization experiment
* `style.css` — mobile-first surface
* `engine.js` — browser port of `src/main/java/com/schedule`
* `app.js` — editor + solver UI
* `quantum/` — isolated QUBO builder, solver, and experiment UI
* `.nojekyll` — Pages serves these files as-is

Local preview:

```bash
python3 -m http.server 8080
```

* Scheduler: `http://localhost:8080/index.html`
* Stores: `http://localhost:8080/stores/`
* Quantum Optimization: `http://localhost:8080/quantum.html`

Pages source is GitHub Actions (`static.yml`). If the URL 404s, enable Settings → Pages → Source → GitHub Actions.

## Multi-store architecture

### Identity boundary

```
Store
 ├── workers[]     (storeId mandatory)
 ├── shows[]       (storeId mandatory)
 ├── timezone
 ├── sources / outputs / routing
 └── StoreSchedule (scheduleDate + isolation checks)
      └── ScheduleRevision → SolveResult → JSON → HTML + iCal
```

`StoreSchedule` rejects any worker or show whose `storeId` does not match.
Deprecated constructors without `storeId` default to `STORE-DEFAULT` for older call sites.

### Same-calendar-day contract

`Showtime` duration must not wrap past midnight. External API/iCal sources must
normalize multi-day events **before** mapping into the model. The solver does not
span calendar days; date + store timezone live on `StoreSchedule` / `Store`.

### Source routing

`StoreRouteResolver` selects a `ShowtimeSource` per store. API and iCal adapters
are stubs in Phase 1; Manual is wired. The solver never hard-codes upstream URLs.

### Reports

Canonical path: **one** `ScheduleRevision` → JSON model → HTML text + iCal.
Paths are store-scoped (`/stores/STORE-001/`, `calendar.ics`, API shape).

### Phased rollout

| Phase | Scope |
|-------|--------|
| **1** (this branch) | Store, StoreSchedule, routing stubs, store HTML shells, SampleRunner |
| **2** | Live API + iCal ingestion + normalization |
| **3** | Full JSON API + worker calendars |
| **4** | Adaptive refresh + change detection |

Solver scoring is intentionally untouched in Phase 1.

### Sample

```bash
mvn -q -DincludeScope=compile compile exec:java -Dexec.mainClass=com.schedule.SampleRunner
```

Runs **STORE-001 (Mesa North)** for 2026-09-19 through solve + multi-representation report.

## Babel launcher contract

Manifest: `.babel/manifest.yml`

Pages entrypoint documented there:

* kind: `pages`
* path: `index.html`
* url: `https://thebabeldragon.github.io/Showflow/`

Capabilities: `.babel/capabilities.yml`

The Java package remains the authoritative scheduling model. The browser files implement the same rules so Pages can run without a JVM.

## Timing model

Each showtime is entered as room + start + duration.

```
A = [start - 30m, start]
C = start + duration          // end event, not a range
B = [C - 45m, C]
```

Example: start 19:00, duration 60.

* A 18:30-19:00
* B 19:15-20:00
* C 20:00

Coverage is computed per showtime, not per A/B/C fragment.

## Engine shape

```
HARD CONSTRAINTS
      |
 reject / eligible
      |
 SOFT SCORING
   coverage · proximity · room-family · lead
      |
 best arbitration
      |
 DIAGNOSTICS  (always emitted)
      |
 assignments + warnings
```

Warnings are not a scheduler option. The constraint engine decides legality.
The diagnostic engine reports undesirable conditions even when an assignment
is legal.

### Hard constraints

* availability across the operational span `[A start, C]`
* no duplicate worker on the same showtime
* ordinary A conflict
* excessive B overlap (over 30 minutes)

### Named first-set A exception

The first-set cohort is the A-window connected component that contains every
showtime sharing the day's earliest start.

Inside that cohort only:

* A overlap is normally a hard conflict
* exception: A overlap is permitted when each affected room has fewer than 10 guests
* the warning is still emitted
* after the opening cohort, normal A protection returns

### Soft preferences

Very strong:

* lead weight for the show's theater
* keep a worker in their established / preferred zone (MAIN 1-4, SIDE 5-7)
* avoid unnecessary A overlap
* same-family room pairing, especially 1-2, 1-3, 2-4, 5-6, 6-7

Moderate:

* lower B overlap
* lower C proximity
* balanced workload
* fewer zone transitions

Zone mismatch never rejects a candidate.

### Lead

Lead is a role on a showtime, not a separate assignment. Exactly one assigned
worker is arbitrated into Lead using theater-specific weight 0-10 plus zone
continuity, conflict pressure, and existing lead load. A 10/10 worker who
cannot legally cover the showtime does not become Lead.

## Project Structure

```
index.html
stores/
├── index.html
├── STORE-001/
└── STORE-002/
quantum.html
style.css
engine.js
app.js
quantum/
src/main/java/com/schedule/
├── Main.java
├── SampleRunner.java
├── SchedulingConfig.java
├── engine/          # AssignmentSolver scoring unchanged
├── model/           # Store, StoreSchedule, ScheduleRevision, storeId fields
├── source/          # ShowtimeSource adapters
├── routing/         # StoreRouteResolver
├── report/          # DaySheet + StoreReportGenerator
└── ui/
```

## Build

Requires:

* Java 17+
* Maven

```bash
mvn package
java -jar target/showflow.jar
```

Non-interactive sample:

```bash
mvn -q -DincludeScope=compile compile exec:java -Dexec.mainClass=com.schedule.SampleRunner
```

## Quantum Optimization

User-facing name: **Quantum Optimization** (experimental).

Open: https://thebabeldragon.github.io/Showflow/quantum.html

Internal modules use `qubo` terminology because QUBO is the mathematical
representation. The browser does **not** run on quantum hardware.

The existing deterministic Showflow scheduler remains authoritative. Quantum
Optimization is an isolated read-only proposal layer.

## Design Principle

Showflow schedules against real showtimes, rooms, and workers.

A/B/C exist so operations can see the derived windows. They are not the
objects the solver assigns.

Store isolation exists so multi-location operations never share workers,
timezones, or routing configuration by accident.
