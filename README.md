# Showflow

Java-based show scheduling and staffing system. The scheduler reasons over
showtimes, rooms, workers, and a conflict graph. A/B/C are derived operational
windows, not independently entered set types.

## Browser tool

GitHub Pages target from `.github/workflows/static.yml` (`path: '.'`):

https://thebabeldragon.github.io/Showflow/

That URL serves repository-root `index.html`. On an iPhone it is the live tool:

workers → availability → shows → guests → showtimes (room + start + duration) → derived A/B/C → assignments → coverage → warnings → master day sheet

Static launcher files (do not replace the Java model):

* `index.html` — Pages document
* `style.css` — mobile-first surface
* `engine.js` — browser port of `src/main/java/com/schedule`
* `app.js` — editor + solver UI
* `.nojekyll` — Pages serves these files as-is

Local preview:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/index.html`.

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
style.css
engine.js
app.js
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
│   ├── AssignmentScore.java
│   ├── AssignmentSolver.java
│   ├── ConstraintEngine.java
│   ├── CoverageCalculator.java
│   ├── DiagnosticEngine.java
│   ├── LeadArbitrator.java
│   ├── ScheduleContext.java
│   ├── SoftScorer.java
│   └── SolveResult.java
├── model/
│   ├── Assignment.java
│   ├── CoverageGap.java
│   ├── Diagnostic.java
│   ├── Show.java
│   ├── Showtime.java
│   ├── TimeRange.java
│   ├── Worker.java
│   └── Zone.java
├── report/
│   ├── DaySheetGenerator.java
│   └── WorkerReportGenerator.java
└── ui/
    └── AdminConsole.java
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

Or after `javac`:

```bash
java -cp target/classes com.schedule.SampleRunner
```

The console prompts for:

1. Day label
2. Workers, zone preference, lead weight, availability
3. Shows, theater, guest counts
4. Showtimes: room, start, duration

Generated reports are written to:

```
output/
├── master-day-sheet.txt
└── <worker>-schedule.txt
```

The `output/` directory is intentionally excluded from version control.

## Design Principle

Showflow schedules against real showtimes, rooms, and workers.

A/B/C exist so operations can see the derived windows. They are not the
objects the solver assigns.
