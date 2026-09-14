package com.schedule.engine;

import com.schedule.model.Show;
import com.schedule.model.Showtime;
import com.schedule.model.TimeRange;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Flattened showtime graph plus the named first-set-of-day cohort.
 */
public final class ScheduleContext {

    public record AnchoredShowtime(Show show, Showtime showtime) {
        public AnchoredShowtime {
            Objects.requireNonNull(show, "show");
            Objects.requireNonNull(showtime, "showtime");
        }

        public String showtimeId() {
            return showtime.getId();
        }

        public TimeRange aWindow() {
            return showtime.getAWindow();
        }

        public int guests() {
            return show.getGuests();
        }
    }

    private final List<AnchoredShowtime> showtimes;
    private final Set<String> firstSetCohortIds;

    private ScheduleContext(
            List<AnchoredShowtime> showtimes,
            Set<String> firstSetCohortIds
    ) {
        this.showtimes = List.copyOf(showtimes);
        this.firstSetCohortIds = Set.copyOf(firstSetCohortIds);
    }

    public static ScheduleContext from(List<Show> shows) {
        List<AnchoredShowtime> anchored = new ArrayList<>();
        for (Show show : shows) {
            for (Showtime showtime : show.getShowtimes()) {
                anchored.add(new AnchoredShowtime(show, showtime));
            }
        }

        anchored.sort(Comparator
                .comparing((AnchoredShowtime item) -> item.showtime().getStart())
                .thenComparing(item -> item.show().getId())
                .thenComparing(AnchoredShowtime::showtimeId));

        return new ScheduleContext(anchored, buildFirstSetCohort(anchored));
    }

    public List<AnchoredShowtime> showtimes() {
        return showtimes;
    }

    public Set<String> firstSetCohortIds() {
        return firstSetCohortIds;
    }

    public boolean inFirstSetCohort(String showtimeId) {
        return firstSetCohortIds.contains(showtimeId);
    }

    public AnchoredShowtime find(String showId, String showtimeId) {
        return showtimes.stream()
                .filter(item -> item.show().getId().equals(showId)
                        && item.showtime().getId().equals(showtimeId))
                .findFirst()
                .orElse(null);
    }

    /**
     * Earliest shared/overlapping start-time window containing the day's
     * initial showtimes. Built as the A-window connected component that
     * includes every showtime sharing the earliest start.
     */
    static Set<String> buildFirstSetCohort(List<AnchoredShowtime> anchored) {
        if (anchored.isEmpty()) {
            return Set.of();
        }

        LocalTime earliest = anchored.stream()
                .map(item -> item.showtime().getStart())
                .min(LocalTime::compareTo)
                .orElseThrow();

        Set<String> cohort = new LinkedHashSet<>();
        for (AnchoredShowtime item : anchored) {
            if (item.showtime().getStart().equals(earliest)) {
                cohort.add(item.showtimeId());
            }
        }

        boolean expanded = true;
        while (expanded) {
            expanded = false;
            for (AnchoredShowtime candidate : anchored) {
                if (cohort.contains(candidate.showtimeId())) {
                    continue;
                }
                for (AnchoredShowtime member : anchored) {
                    if (!cohort.contains(member.showtimeId())) {
                        continue;
                    }
                    if (candidate.aWindow().overlaps(member.aWindow())) {
                        cohort.add(candidate.showtimeId());
                        expanded = true;
                        break;
                    }
                }
            }
        }

        return Collections.unmodifiableSet(new HashSet<>(cohort));
    }
}
