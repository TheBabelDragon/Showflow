# Showflow

Java-based show scheduling and staffing system. The scheduler reasons over
showtimes, rooms, workers, and a conflict graph. A/B/C are derived operational
windows, not independently entered set types.

## Browser tool

GitHub Pages target from `.github/workflows/static.yml` (`path: '.'`):

| Page | URL |
|------|-----|
| **Scheduler** (production) | https://thebabeldragon.github.io/Showflow/ |
| **Quantum Optimization** (experimental) | https://thebabeldragon.github.io/Showflow/quantum.html |

Both pages share day state via `localStorage`. The scheduler remains authoritative;
Quantum Optimization is comparison-only and never mutates the live schedule.

**Scheduler** flow:

workers → availability → shows → guests → showtimes (room + start + duration) → derived A/B/C → assignments → coverage → warnings → master day sheet

**Quantum Optimization** flow:

read-only snapshot → modular parameters → QUBO → local solver → existing validation → compare metrics

Static launcher files (do not replace the Java model):

* `index.html` — production scheduler
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
* Quantum Optimization: `http://localhost:8080/quantum.html`

Pages source is GitHub Actions (`static.yml`). If the URL 404s, enable Settings → Pages → Source → GitHub Actions.

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
quantum.html
style.css
engine.js
app.js
quantum/
├── optimization-params.js
├── op-params.css
├── qubo-builder.js
├── qubo-inspect.js
├── qubo-solver.js
├── quantum-optimization.js
├── quantum-ui.js
└── quantum-enhancements.js
.nojekyll
.babel/manifest.yml
.babel/capabilities.yml
.github/workflows/static.yml
.github/workflows/maven-publish.yml
src/main/java/com/schedule/
├── Main.java
├── SampleRunner.java
├── SchedulingConfig.java
├── engine/
├── qubo/
├── model/
├── report/
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

### What the optimization layer does

```
USER PARAMETERS
      ↓
POLICY MODEL  (quantum/optimization-params.js)
      ↓
CONSTRAINT / OBJECTIVE GENERATION
      ↓
QUBO  (quantum/qubo-builder.js)
      ↓
SOLVER  (local classical / quantum-inspired)
      ↓
CANDIDATE
      ↓
SHOWFLOW VALIDATOR  (existing engine.js / Java rules)
      ↓
MEASURED COMPARISON
```

The existing deterministic Showflow scheduler remains authoritative. Quantum
Optimization is an isolated read-only proposal layer: it snapshots state,
builds a QUBO from an explicit parameter model, solves, materializes a
candidate, and runs that candidate through the same validation path. It never
mutates the live schedule.

### Modular parameter model

One authoritative schema lives in `quantum/optimization-params.js`.

**Hard constraint parameters** (feasibility):

| Parameter | Default | Role |
|-----------|---------|------|
| Maximum A overlap | 0 min | A-window overlap above this is a hard conflict (first-set exception still applies) |
| Maximum B overlap | 30 min | B-window overlap above this is a hard conflict (matches production tolerance) |
| Hard conflict penalty | 1000 | Quadratic strength for illegal pairs |
| Missing coverage penalty | 2000 | Exact staffing count per showtime |
| First-set A exception guest limit | 10 | Named opening-cohort exception |

**Soft preference parameters** (objective):

| Parameter | Default | Role |
|-----------|---------|------|
| Preferred B overlap | 0 min | Soft penalty starts above this preferred threshold |
| B overlap penalty | 20 | Soft weight for excess B minutes |
| B overlap penalty curve | linear | `linear` or `quadratic` scaling of excess minutes |
| C proximity window | 15 min | Distance threshold for C-end soft terms |
| C proximity penalty | 8 | Soft weight for tight C ends |
| Workload balance weight | 4 | Discourage concentrating work on one worker |
| Zone transition weight | 5 | MAIN ↔ SIDE moves |
| Room-family pairing weight | 3 | Preferred / same-family room pairs + preferred zone |
| Theater-lead preference weight | −10 | Linear preference scaled by lead weight |

Overlap is the reference modular policy: preferred threshold, maximum permitted
threshold, penalty strength, and penalty curve all feed the QUBO coefficients.
Changing them changes the mathematical model (verified by self-test fingerprint).

Presets (`Strict`, `Balanced`, `Flexible`) only populate the same parameter
object. After a preset, any individual control remains editable. **Reset to
defaults** restores the schema defaults.

### Inspect QUBO

After a solve, **Inspect QUBO** shows variables, linear/quadratic term counts,
hard-like vs soft terms, policy summary, and annotated representative
coefficients (e.g. `Q[x0,x1] = +1000  hard conflict`).

### Comparison

Side-by-side **Normal Scheduler** vs **Quantum Optimization** metrics
(coverage, hard/gaps, B overlap, workload variance, zone transitions, QUBO
energy). The existing validator decides:

* **Candidate VALID**
* **Candidate REJECTED**

Measured policy deltas (e.g. maximum B overlap change, energy, workload %)
are shown when parameters change between solves.

### Files

| Path | Role |
|------|------|
| `quantum/optimization-params.js` | Single parameter schema, defaults, presets, serialization |
| `quantum/qubo-builder.js` | Policy → QUBO (hard thresholds + soft coefficients) |
| `quantum/qubo-inspect.js` | Diagnostics + human-readable inspect text |
| `quantum/qubo-solver.js` | Local exhaustive / simulated annealing |
| `quantum/quantum-optimization.js` | Orchestration, metrics, self-tests |
| `quantum/quantum-ui.js` | Optimization Parameters UI, comparison, inspect |
| `quantum/op-params.css` | Parameter control styles |

### Terminology

* **QUBO** — mathematical optimization representation
* **Quantum Optimization** — experimental feature name in the UI
* **Quantum hardware** — optional future solver backend; the QUBO formulation
  is designed so a real backend could implement the same solver interface
  without rewriting the parameter model

### Why the existing scheduler remains authoritative

Hard-rule semantics (A/B/C windows, first-set A exception, B tolerance of 30
minutes in production, coverage math, lead arbitration) are defined by the
Java engine and its browser port `engine.js`. Quantum Optimization may explore
alternate *policies* for proposal generation, but acceptance is always decided
by the existing validator. The live schedule is never silently rewritten.

## Design Principle

Showflow schedules against real showtimes, rooms, and workers.

A/B/C exist so operations can see the derived windows. They are not the
objects the solver assigns.
