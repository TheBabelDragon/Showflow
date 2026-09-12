package com.schedule.engine;

import com.schedule.SchedulingConfig;
import com.schedule.model.CoverageGap;
import com.schedule.model.FillSlot;
import com.schedule.model.SetTime;
import com.schedule.model.Show;

import java.util.ArrayList;
import java.util.List;

public class CoverageCalculator {

    public List<CoverageGap> calculate(
            List<Show> shows,
            List<FillSlot> assignments
    ) {
        List<CoverageGap> gaps = new ArrayList<>();

        for (Show show : shows) {
            int required = SchedulingConfig.workersRequired(show.getGuests());

            for (SetTime setTime : show.getSetTimes()) {
                int assigned = (int) assignments.stream()
                        .filter(slot ->
                                slot.getShowId().equals(show.getId())
                                        && slot.getSetTimeId().equals(setTime.getId())
                        )
                        .map(FillSlot::getWorkerId)
                        .distinct()
                        .count();

                if (assigned < required) {
                    gaps.add(new CoverageGap(
                            show.getId(),
                            setTime.getId(),
                            required,
                            assigned
                    ));
                }
            }
        }

        return gaps;
    }
}