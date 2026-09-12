Showflow

Java-based show scheduling and staffing system that assigns workers across concrete set times, enforces availability and overlap rules, calculates coverage requirements, and generates a complete master day sheet with per-worker schedules.

What it does

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

Coverage

The default staffing target is:

1 worker per 10 guests

A show with 40 guests therefore requires:

4 workers per concrete set time

Each set time is evaluated independently.

Set Types

Type	Duration	Rule
A	30 min	Protected / hard conflict
B	60 min	Up to 30 min overlap tolerated
C	60 min	Overlap accepted with warning

Assignments are selected using a scoring system that prefers workers with:

1. No prohibited overlap
2. Lower B overlap
3. Lower C overlap
4. Fewer existing assignments

Project Structure

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

Build

Requires:

* Java 17+
* Maven

Build:

mvn package

Run

java -jar target/showflow.jar

The console prompts for:

1. Day label
2. Workers
3. Worker availability
4. Shows
5. Guest counts
6. Concrete set times

Output

Generated reports are written to:

output/
├── master-day-sheet.txt
└── <worker>-schedule.txt

The output/ directory is intentionally excluded from version control.

Design Principle

Showflow schedules against real concrete set times, not abstract staffing blocks.

Every concrete set time gets its own coverage requirement, and every assignment is checked against worker availability and overlap rules.

The result is a complete operational day sheet rather than merely a list of staffing recommendations.