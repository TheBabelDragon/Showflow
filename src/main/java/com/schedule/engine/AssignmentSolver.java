package com.schedule.engine;

import com.schedule.SchedulingConfig;
import com.schedule.model.Assignment;
import com.schedule.model.CoverageGap;
import com.schedule.model.Diagnostic;
import com.schedule.model.Show;
import com.schedule.model.Worker;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public class AssignmentSolver {

    private final ConstraintEngine constraintEngine;
    private final SoftScorer softScorer;
    private final LeadArbitrator leadArbitrator;
    private final DiagnosticEngine diagnosticEngine;
    private final CoverageCalculator coverageCalculator;

    public AssignmentSolver() {
        this.constraintEngine = new ConstraintEngine();
        this.softScorer = new SoftScorer();
        this.leadArbitrator = new LeadArbitrator(softScorer);
        this.diagnosticEngine = new DiagnosticEngine(constraintEngine);
        this.coverageCalculator = new CoverageCalculator();
    }

    public SolveResult solve(List<Worker> workers, List<Show> shows) {
        ScheduleContext context = ScheduleContext.from(shows);
        List<Assignment> assignments = new ArrayList<>();

        for (ScheduleContext.AnchoredShowtime anchored : context.showtimes()) {
            int required = SchedulingConfig.workersRequired(anchored.guests());
            Set<String> assignedWorkerIds = new HashSet<>();

            for (int slot = 0; slot < required; slot++) {
                Worker bestWorker = null;
                AssignmentScore bestScore = null;

                for (Worker worker : workers) {
                    if (assignedWorkerIds.contains(worker.getId())) {
                        continue;
                    }
                    if (!constraintEngine.eligible(worker, anchored, assignments, context)) {
                        continue;
                    }

                    AssignmentScore score = softScorer.score(worker, anchored, assignments);
                    if (bestWorker == null
                            || score.coverageScore() > bestScore.coverageScore()
                            || (score.coverageScore() == bestScore.coverageScore()
                            && worker.getId().compareTo(bestWorker.getId()) < 0)) {
                        bestWorker = worker;
                        bestScore = score;
                    }
                }

                if (bestWorker == null) {
                    continue;
                }

                Assignment assignment = new Assignment(
                        bestWorker.getId(),
                        anchored.show().getId(),
                        anchored.showtime(),
                        slot
                );
                assignment.setScore(bestScore.coverageScore());
                assignments.add(assignment);
                assignedWorkerIds.add(bestWorker.getId());
            }

            leadArbitrator.arbitrate(anchored, assignments, workers);
        }

        Map<String, Worker> workerById = workers.stream()
                .collect(Collectors.toMap(Worker::getId, worker -> worker));

        List<Diagnostic> warnings = new ArrayList<>();
        List<Assignment> chronological = assignments.stream()
                .sorted(Comparator
                        .comparing((Assignment assignment) -> assignment.getAWindow().start())
                        .thenComparing(Assignment::getShowtimeId)
                        .thenComparing(Assignment::getWorkerId))
                .toList();

        List<Assignment> seen = new ArrayList<>();
        for (Assignment assignment : chronological) {
            Worker worker = workerById.get(assignment.getWorkerId());
            ScheduleContext.AnchoredShowtime anchored =
                    context.find(assignment.getShowId(), assignment.getShowtimeId());
            if (worker == null || anchored == null) {
                seen.add(assignment);
                continue;
            }

            List<Diagnostic> slotDiagnostics = diagnosticEngine.evaluate(
                    worker,
                    anchored,
                    assignment,
                    seen,
                    assignments,
                    context,
                    workerById
            );
            for (Diagnostic diagnostic : slotDiagnostics) {
                assignment.addDiagnostic(diagnostic);
            }
            warnings.addAll(slotDiagnostics);
            seen.add(assignment);
        }

        List<CoverageGap> gaps = coverageCalculator.calculate(shows, assignments);
        return new SolveResult(assignments, gaps, warnings);
    }
}
