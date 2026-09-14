package com.schedule.engine;

import com.schedule.model.Assignment;
import com.schedule.model.Worker;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class LeadArbitrator {

    private final SoftScorer scorer;

    public LeadArbitrator(SoftScorer scorer) {
        this.scorer = scorer;
    }

    public void arbitrate(
            ScheduleContext.AnchoredShowtime anchored,
            List<Assignment> assignments,
            List<Worker> workers
    ) {
        List<Assignment> onShowtime = assignments.stream()
                .filter(assignment ->
                        assignment.getShowId().equals(anchored.show().getId())
                                && assignment.getShowtimeId().equals(anchored.showtimeId()))
                .toList();

        if (onShowtime.isEmpty()) {
            return;
        }

        onShowtime.forEach(assignment -> assignment.setLead(false));

        Map<String, Worker> workerById = workers.stream()
                .collect(Collectors.toMap(Worker::getId, worker -> worker));

        Assignment best = onShowtime.stream()
                .max(Comparator
                        .comparingLong((Assignment assignment) -> {
                            Worker worker = workerById.get(assignment.getWorkerId());
                            if (worker == null) {
                                return Long.MIN_VALUE;
                            }
                            return scorer.score(worker, anchored, assignments).leadScore();
                        })
                        .thenComparing(Assignment::getWorkerId))
                .orElse(null);

        if (best != null) {
            best.setLead(true);
        }
    }
}
