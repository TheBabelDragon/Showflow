package com.schedule.engine;

import com.schedule.SchedulingConfig;
import com.schedule.model.Assignment;
import com.schedule.model.Showtime;
import com.schedule.model.Worker;

import java.time.Duration;
import java.util.List;

/**
 * Hard eligibility only. Diagnostics are a separate engine and always run.
 */
public class ConstraintEngine {

    public boolean eligible(
            Worker worker,
            ScheduleContext.AnchoredShowtime candidate,
            List<Assignment> assignments,
            ScheduleContext context
    ) {
        Showtime showtime = candidate.showtime();

        if (!worker.isAvailable(showtime.getOperationalSpan())) {
            return false;
        }

        for (Assignment existing : assignments) {
            if (!existing.getWorkerId().equals(worker.getId())) {
                continue;
            }

            if (existing.getShowtimeId().equals(showtime.getId())
                    && existing.getShowId().equals(candidate.show().getId())) {
                return false;
            }

            if (hasOrdinaryAConflict(existing, showtime, candidate, context)) {
                return false;
            }

            if (hasExcessiveBOverlap(existing, showtime)) {
                return false;
            }
        }

        return true;
    }

    boolean firstSetExceptionApplies(
            Assignment existing,
            ScheduleContext.AnchoredShowtime candidate,
            ScheduleContext context
    ) {
        if (context == null) {
            return false;
        }
        if (!context.inFirstSetCohort(existing.getShowtimeId())
                || !context.inFirstSetCohort(candidate.showtime().getId())) {
            return false;
        }

        ScheduleContext.AnchoredShowtime existingAnchored =
                context.find(existing.getShowId(), existing.getShowtimeId());
        if (existingAnchored == null) {
            return false;
        }

        return existingAnchored.guests() < SchedulingConfig.FIRST_SET_A_EXCEPTION_GUEST_LIMIT
                && candidate.guests() < SchedulingConfig.FIRST_SET_A_EXCEPTION_GUEST_LIMIT;
    }

    private boolean hasOrdinaryAConflict(
            Assignment existing,
            Showtime candidate,
            ScheduleContext.AnchoredShowtime anchored,
            ScheduleContext context
    ) {
        if (existing.getAWindow().overlaps(candidate.getAWindow())) {
            return !firstSetExceptionApplies(existing, anchored, context);
        }

        if (existing.getAWindow().overlaps(candidate.getBWindow())) {
            return true;
        }
        if (existing.getBWindow().overlaps(candidate.getAWindow())) {
            return true;
        }

        return aOverlapsC(existing, candidate);
    }

    private boolean aOverlapsC(Assignment existing, Showtime candidate) {
        return strictlyInside(existing.getAWindow(), candidate.getCEnd())
                || strictlyInside(candidate.getAWindow(), existing.getCEnd());
    }

    private boolean strictlyInside(com.schedule.model.TimeRange range, java.time.LocalTime time) {
        return time.isAfter(range.start()) && time.isBefore(range.end());
    }

    private boolean hasExcessiveBOverlap(Assignment existing, Showtime candidate) {
        return existing.getBWindow().overlapMinutes(candidate.getBWindow())
                > SchedulingConfig.B_OVERLAP_TOLERANCE_MINUTES;
    }

    static long cProximityMinutes(Assignment existing, Showtime candidate) {
        return Math.abs(Duration.between(existing.getCEnd(), candidate.getCEnd()).toMinutes());
    }
}
