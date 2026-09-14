package com.schedule.engine;

import com.schedule.model.Assignment;
import com.schedule.model.CoverageGap;
import com.schedule.model.Diagnostic;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class SolveResult {

    private final List<Assignment> assignments;
    private final List<CoverageGap> coverageGaps;
    private final List<Diagnostic> warnings;

    public SolveResult(
            List<Assignment> assignments,
            List<CoverageGap> coverageGaps,
            List<Diagnostic> warnings
    ) {
        this.assignments = new ArrayList<>(assignments);
        this.coverageGaps = new ArrayList<>(coverageGaps);
        this.warnings = new ArrayList<>(warnings);
    }

    public List<Assignment> getAssignments() {
        return Collections.unmodifiableList(assignments);
    }

    public List<CoverageGap> getCoverageGaps() {
        return Collections.unmodifiableList(coverageGaps);
    }

    public List<Diagnostic> getWarnings() {
        return Collections.unmodifiableList(warnings);
    }

    public boolean isFullyCovered() {
        return coverageGaps.stream().allMatch(CoverageGap::isCovered);
    }

    public int assignmentCount() {
        return assignments.size();
    }

    public int gapCount() {
        return coverageGaps.stream().mapToInt(CoverageGap::missing).sum();
    }
}
