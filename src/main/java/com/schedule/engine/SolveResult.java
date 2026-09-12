package com.schedule.engine;

import com.schedule.model.CoverageGap;
import com.schedule.model.FillSlot;
import com.schedule.model.OverlapWarning;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class SolveResult {

    private final List<FillSlot> assignments;
    private final List<CoverageGap> coverageGaps;
    private final List<OverlapWarning> warnings;

    public SolveResult(
            List<FillSlot> assignments,
            List<CoverageGap> coverageGaps,
            List<OverlapWarning> warnings
    ) {
        this.assignments = new ArrayList<>(assignments);
        this.coverageGaps = new ArrayList<>(coverageGaps);
        this.warnings = new ArrayList<>(warnings);
    }

    public List<FillSlot> getAssignments() {
        return Collections.unmodifiableList(assignments);
    }

    public List<CoverageGap> getCoverageGaps() {
        return Collections.unmodifiableList(coverageGaps);
    }

    public List<OverlapWarning> getWarnings() {
        return Collections.unmodifiableList(warnings);
    }

    public boolean isFullyCovered() {
        return coverageGaps.stream()
                .allMatch(CoverageGap::isCovered);
    }

    public int assignmentCount() {
        return assignments.size();
    }

    public int gapCount() {
        return coverageGaps.stream()
                .mapToInt(CoverageGap::missing)
                .sum();
    }
}