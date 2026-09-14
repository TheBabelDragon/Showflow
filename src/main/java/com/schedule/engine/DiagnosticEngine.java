package com.schedule.engine;

import com.schedule.SchedulingConfig;
import com.schedule.model.Assignment;
import com.schedule.model.Diagnostic;
import com.schedule.model.Showtime;
import com.schedule.model.Worker;
import com.schedule.model.Zone;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Always-on diagnostics. Legal assignments still get evaluated.
 */
public class DiagnosticEngine {

    private final ConstraintEngine constraints;

    public DiagnosticEngine(ConstraintEngine constraints) {
        this.constraints = constraints;
    }

    public List<Diagnostic> evaluate(
            Worker worker,
            ScheduleContext.AnchoredShowtime candidate,
            Assignment created,
            List<Assignment> prior,
            List<Assignment> allAssignments,
            ScheduleContext context,
            Map<String, Worker> workers
    ) {
        List<Diagnostic> diagnostics = new ArrayList<>();
        Showtime showtime = candidate.showtime();

        List<Assignment> mine = prior.stream()
                .filter(assignment -> assignment.getWorkerId().equals(worker.getId()))
                .sorted(Comparator.comparing(assignment -> assignment.getAWindow().start()))
                .toList();

        for (Assignment existing : mine) {
            long aOverlap = existing.getAWindow().overlapMinutes(showtime.getAWindow());
            if (aOverlap > 0) {
                boolean exception = constraints.firstSetExceptionApplies(
                        existing, candidate, context
                );
                diagnostics.add(new Diagnostic(
                        Diagnostic.Code.A_OVERLAP,
                        worker.getId(),
                        existing.getShowtimeId(),
                        showtime.getId(),
                        aOverlap,
                        exception,
                        exception
                                ? "First-set A overlap permitted because each room is under "
                                + SchedulingConfig.FIRST_SET_A_EXCEPTION_GUEST_LIMIT
                                + " guests"
                                : "A windows overlap"
                ));
                diagnostics.add(new Diagnostic(
                        Diagnostic.Code.DOUBLE_A,
                        worker.getId(),
                        existing.getShowtimeId(),
                        showtime.getId(),
                        aOverlap,
                        exception,
                        doubleAMessage(existing.getRoomNumber(), showtime.getRoomNumber())
                ));
                if (exception) {
                    diagnostics.add(new Diagnostic(
                            Diagnostic.Code.FIRST_SET_A_EXCEPTION,
                            worker.getId(),
                            existing.getShowtimeId(),
                            showtime.getId(),
                            aOverlap,
                            true,
                            "First-set-of-day A exception used"
                    ));
                }
            }

            long bOverlap = existing.getBWindow().overlapMinutes(showtime.getBWindow());
            if (bOverlap > 0) {
                boolean excessive = bOverlap > SchedulingConfig.B_OVERLAP_TOLERANCE_MINUTES;
                diagnostics.add(new Diagnostic(
                        Diagnostic.Code.B_OVERLAP,
                        worker.getId(),
                        existing.getShowtimeId(),
                        showtime.getId(),
                        bOverlap,
                        false,
                        excessive
                                ? "B overlap exceeds the "
                                + SchedulingConfig.B_OVERLAP_TOLERANCE_MINUTES
                                + "-minute tolerance"
                                : "B windows overlap"
                ));
            }

            long cDelta = ConstraintEngine.cProximityMinutes(existing, showtime);
            if (cDelta <= SchedulingConfig.C_PROXIMITY_MINUTES) {
                diagnostics.add(new Diagnostic(
                        Diagnostic.Code.C_PROXIMITY,
                        worker.getId(),
                        existing.getShowtimeId(),
                        showtime.getId(),
                        cDelta,
                        false,
                        cDelta == 0
                                ? "C end events coincide"
                                : "C end events are within "
                                + SchedulingConfig.C_PROXIMITY_MINUTES
                                + " minutes"
                ));
            }

            if (existing.getZone() != showtime.getZone()) {
                diagnostics.add(new Diagnostic(
                        Diagnostic.Code.ZONE_SWITCH,
                        worker.getId(),
                        existing.getShowtimeId(),
                        showtime.getId(),
                        0,
                        false,
                        "Worker moves between " + existing.getZone()
                                + " and " + showtime.getZone()
                ));
            }

            if (!Zone.sameFamily(existing.getRoomNumber(), showtime.getRoomNumber())
                    && aOverlap > 0) {
                diagnostics.add(new Diagnostic(
                        Diagnostic.Code.ROOM_FAMILY_SWITCH,
                        worker.getId(),
                        existing.getShowtimeId(),
                        showtime.getId(),
                        aOverlap,
                        false,
                        "Overlapping A covers different room families ("
                                + existing.getRoomNumber()
                                + " and "
                                + showtime.getRoomNumber()
                                + ")"
                ));
            }
        }

        int load = mine.size() + 1;
        if (load >= 4) {
            diagnostics.add(new Diagnostic(
                    Diagnostic.Code.WORKLOAD,
                    worker.getId(),
                    null,
                    showtime.getId(),
                    load,
                    false,
                    "Worker already carries " + load + " showtimes"
            ));
        }

        if (created.isLead()) {
            int weight = worker.leadWeight(candidate.show().getTheater());
            int bestPeer = allAssignments.stream()
                    .filter(assignment ->
                            assignment.getShowId().equals(candidate.show().getId())
                                    && assignment.getShowtimeId().equals(showtime.getId()))
                    .mapToInt(assignment -> {
                        Worker peer = workers.get(assignment.getWorkerId());
                        return peer == null ? 0 : peer.leadWeight(candidate.show().getTheater());
                    })
                    .max()
                    .orElse(weight);
            if (weight <= 3 || weight + 2 <= bestPeer) {
                diagnostics.add(new Diagnostic(
                        Diagnostic.Code.LEAD_QUALITY,
                        worker.getId(),
                        null,
                        showtime.getId(),
                        weight,
                        false,
                        "Lead weight " + weight + "/10 for " + candidate.show().getTheater()
                ));
            }
        }

        return diagnostics;
    }

    private String doubleAMessage(int leftRoom, int rightRoom) {
        if (Zone.preferredPair(leftRoom, rightRoom)) {
            return "Double-A on preferred pair " + leftRoom + " <-> " + rightRoom;
        }
        if (Zone.sameFamily(leftRoom, rightRoom)) {
            return "Double-A inside the same room family";
        }
        return "Double-A across room families " + leftRoom + " <-> " + rightRoom;
    }
}
