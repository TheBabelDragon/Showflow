package com.schedule.engine;

import com.schedule.SchedulingConfig;
import com.schedule.model.FillSlot;
import com.schedule.model.OverlapWarning;
import com.schedule.model.SetTime;
import com.schedule.model.TimeRange;

import java.util.ArrayList;
import java.util.List;

public class OverlapAnalyzer {

    public List<OverlapWarning> analyze(
            FillSlot existing,
            FillSlot candidate
    ) {
        List<OverlapWarning> warnings = new ArrayList<>();

        analyzePair(
                existing,
                candidate,
                existing.getARange(),
                candidate.getARange(),
                SetTime.Type.A,
                true,
                warnings
        );

        analyzePair(
                existing,
                candidate,
                existing.getBRange(),
                candidate.getBRange(),
                SetTime.Type.B,
                false,
                warnings
        );

        analyzePair(
                existing,
                candidate,
                existing.getCRange(),
                candidate.getCRange(),
                SetTime.Type.C,
                false,
                warnings
        );

        return warnings;
    }

    private void analyzePair(
            FillSlot existing,
            FillSlot candidate,
            TimeRange existingRange,
            TimeRange candidateRange,
            SetTime.Type type,
            boolean hardConflict,
            List<OverlapWarning> warnings
    ) {
        if (existingRange == null || candidateRange == null) {
            return;
        }

        long overlap = existingRange.overlapMinutes(candidateRange);

        if (overlap <= 0) {
            return;
        }

        if (hardConflict) {
            warnings.add(new OverlapWarning(
                    candidate.getWorkerId(),
                    existing.getSetTimeId(),
                    candidate.getSetTimeId(),
                    type,
                    type,
                    overlap,
                    "A assignment conflicts with the protected A window"
            ));
            return;
        }

        if (type == SetTime.Type.B
                && overlap > SchedulingConfig.B_OVERLAP_TOLERANCE_MINUTES) {

            warnings.add(new OverlapWarning(
                    candidate.getWorkerId(),
                    existing.getSetTimeId(),
                    candidate.getSetTimeId(),
                    type,
                    type,
                    overlap,
                    "B overlap exceeds the allowed 30-minute tolerance"
            ));

            return;
        }

        if (type == SetTime.Type.C) {
            warnings.add(new OverlapWarning(
                    candidate.getWorkerId(),
                    existing.getSetTimeId(),
                    candidate.getSetTimeId(),
                    type,
                    type,
                    overlap,
                    "C assignment overlaps another C assignment"
            ));
        }
    }
}