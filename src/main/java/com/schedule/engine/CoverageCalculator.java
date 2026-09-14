package com.schedule.engine;

import com.schedule.SchedulingConfig;
import com.schedule.model.Assignment;
import com.schedule.model.CoverageGap;
import com.schedule.model.Show;
import com.schedule.model.Showtime;

import java.util.ArrayList;
import java.util.List;

public class CoverageCalculator {

    public List<CoverageGap> calculate(
            List<Show> shows,
            List<Assignment> assignments
    ) {
        List<CoverageGap> gaps = new ArrayList<>();

        for (Show show : shows) {
            int required = SchedulingConfig.workersRequired(show.getGuests());

            for (Showtime showtime : show.getShowtimes()) {
                int assigned = (int) assignments.stream()
                        .filter(slot ->
                                slot.getShowId().equals(show.getId())
                                        && slot.getShowtimeId().equals(showtime.getId())
                        )
                        .map(Assignment::getWorkerId)
                        .distinct()
                        .count();

                if (assigned < required) {
                    gaps.add(new CoverageGap(
                            show.getId(),
                            showtime.getId(),
                            required,
                            assigned
                    ));
                }
            }
        }

        return gaps;
    }
}
