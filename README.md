# Showflow

Java-based show scheduling and staffing system that assigns workers across concrete set times, enforces availability and overlap rules, calculates coverage requirements, and generates a complete master day sheet with per-worker schedules.

## Browser tool

GitHub Pages target from `.github/workflows/static.yml` (`path: '.'`):

https://thebabeldragon.github.io/Showflow/

That URL serves repository-root `index.html`. On an iPhone it is the live tool:

workers → availability → shows → guest counts → concrete A/B/C set times → assignments → coverage → warnings → master day sheet

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

## What it does

Showflow takes:

* Workers and their availability
* Shows and guest counts
* Concrete A/B/C set times
* Staffing rules and overlap constraints

It then produces:

* Worker assignments
* Per-set coverage calculations
* Coverage gaps
* Overlap warnings
* A master day sheet
* Individual worker schedules

## Coverage

The default staffing target is:

1 worker per 10 guests

A show with 40 guests therefore requires:

4 workers per concrete set time

Each set time is evaluated independently.

## Set Types

| Type | Duration | Rule |
| --- | --- | --- |
| A | 30 min | Protected / hard conflict |
| B | 60 min | Up to 30 min overlap tolerated |
| C | 60 min | Overlap accepted with warning |

Assignments are selected using a scoring system that prefers workers with:

1. No prohibited overlap
2. Lower B overlap
3. Lower C overlap
4. Fewer existing assignments

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
├── SchedulingConfig.java
├── engine/
│   ├── AssignmentScore.java
│   ├── AssignmentSolver.java
│   ├── CoverageCalculator.java
│   ├── OverlapAnalyzer.java
│   └── SolveResult.java
├── model/
│   ├── CoverageGap.java
│   ├── FillSlot.java
│   ├── OverlapWarning.java
│   ├── SetTime.java
│   ├── Show.java
│   ├── TimeRange.java
│   └── Worker.java
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

The console prompts for:

1. Day label
2. Workers
3. Worker availability
4. Shows
5. Guest counts
6. Concrete set times

Generated reports are written to:

```
output/
├── master-day-sheet.txt
└── <worker>-schedule.txt
```

The `output/` directory is intentionally excluded from version control.

## Design Principle

Showflow schedules against real concrete set times, not abstract staffing blocks.

Every concrete set time gets its own coverage requirement, and every assignment is checked against worker availability and overlap rules.

The result is a complete operational day sheet rather than merely a list of staffing recommendations.
