package com.schedule.engine;

import com.schedule.SchedulingConfig;
import com.schedule.model.Assignment;
import com.schedule.model.Showtime;
import com.schedule.model.Worker;
import com.schedule.model.Zone;

import java.util.List;

public class SoftScorer {

    public AssignmentScore score(
            Worker worker,
            ScheduleContext.AnchoredShowtime candidate,
            List<Assignment> assignments
    ) {
        Showtime showtime = candidate.showtime();
        Zone established = establishedZone(worker, assignments);
        long zoneAffinity = zoneAffinity(worker, established, showtime.getZone());

        long family = 0;
        long aOverlap = 0;
        long bOverlap = 0;
        long closestC = Long.MAX_VALUE;
        int existingCount = 0;
        int transitions = 0;
        int leadCount = 0;

        Assignment previous = lastAssignment(worker, assignments);

        for (Assignment existing : assignments) {
            if (!existing.getWorkerId().equals(worker.getId())) {
                continue;
            }

            existingCount++;
            if (existing.isLead()) {
                leadCount++;
            }

            if (existing.getAWindow().overlaps(showtime.getAWindow())) {
                aOverlap += existing.getAWindow().overlapMinutes(showtime.getAWindow());
                family += familyAffinity(existing.getRoomNumber(), showtime.getRoomNumber());
            }

            bOverlap += existing.getBWindow().overlapMinutes(showtime.getBWindow());

            long cDelta = ConstraintEngine.cProximityMinutes(existing, showtime);
            if (cDelta < closestC) {
                closestC = cDelta;
            }
        }

        if (previous != null && previous.getZone() != showtime.getZone()) {
            transitions = 1;
        }

        if (closestC == Long.MAX_VALUE) {
            closestC = 0;
        }

        return new AssignmentScore(
                zoneAffinity,
                family,
                aOverlap,
                bOverlap,
                closestC,
                existingCount,
                transitions,
                worker.leadWeight(candidate.show().getTheater()),
                leadCount
        );
    }

    static Zone establishedZone(Worker worker, List<Assignment> assignments) {
        Zone fromWork = null;
        for (Assignment assignment : assignments) {
            if (!assignment.getWorkerId().equals(worker.getId())) {
                continue;
            }
            if (fromWork == null) {
                fromWork = assignment.getZone();
            } else if (fromWork != assignment.getZone()) {
                return null;
            }
        }
        if (fromWork != null) {
            return fromWork;
        }
        return worker.getPreferredZone();
    }

    static long zoneAffinity(Worker worker, Zone established, Zone candidateZone) {
        Zone reference = established != null ? established : worker.getPreferredZone();
        if (reference == null) {
            return 0;
        }
        if (reference == candidateZone) {
            return SchedulingConfig.ZONE_MATCH_BONUS;
        }
        return -SchedulingConfig.ZONE_MISMATCH_PENALTY;
    }

    static long familyAffinity(int existingRoom, int candidateRoom) {
        if (Zone.preferredPair(existingRoom, candidateRoom)) {
            return SchedulingConfig.PREFERRED_PAIR_BONUS;
        }
        if (Zone.sameFamily(existingRoom, candidateRoom)) {
            return SchedulingConfig.SAME_FAMILY_BONUS;
        }
        return -SchedulingConfig.CROSS_FAMILY_PENALTY;
    }

    static Assignment lastAssignment(Worker worker, List<Assignment> assignments) {
        Assignment last = null;
        for (Assignment assignment : assignments) {
            if (assignment.getWorkerId().equals(worker.getId())) {
                last = assignment;
            }
        }
        return last;
    }
}
