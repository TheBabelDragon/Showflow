package com.schedule.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

public class FillSlot {

    private final String workerId;
    private final String showId;
    private final String setTimeId;

    private final TimeRange aRange;
    private final TimeRange bRange;
    private final TimeRange cRange;

    private final int coverageSlot;
    private final List<OverlapWarning> warnings;

    public FillSlot(
            String workerId,
            String showId,
            String setTimeId,
            TimeRange aRange,
            TimeRange bRange,
            TimeRange cRange,
            int coverageSlot
    ) {
        this.workerId = Objects.requireNonNull(workerId, "workerId");
        this.showId = Objects.requireNonNull(showId, "showId");
        this.setTimeId = Objects.requireNonNull(setTimeId, "setTimeId");

        this.aRange = aRange;
        this.bRange = bRange;
        this.cRange = cRange;

        if (coverageSlot < 0) {
            throw new IllegalArgumentException(
                    "Coverage slot cannot be negative"
            );
        }

        this.coverageSlot = coverageSlot;
        this.warnings = new ArrayList<>();
    }

    public String getWorkerId() {
        return workerId;
    }

    public String getShowId() {
        return showId;
    }

    public String getSetTimeId() {
        return setTimeId;
    }

    public TimeRange getARange() {
        return aRange;
    }

    public TimeRange getBRange() {
        return bRange;
    }

    public TimeRange getCRange() {
        return cRange;
    }

    public int getCoverageSlot() {
        return coverageSlot;
    }

    public List<OverlapWarning> getWarnings() {
        return Collections.unmodifiableList(warnings);
    }

    public void addWarning(OverlapWarning warning) {
        warnings.add(
                Objects.requireNonNull(warning, "warning")
        );
    }

    public boolean hasWarnings() {
        return !warnings.isEmpty();
    }

    @Override
    public String toString() {
        return "FillSlot{" +
                "workerId='" + workerId + '\'' +
                ", showId='" + showId + '\'' +
                ", setTimeId='" + setTimeId + '\'' +
                ", coverageSlot=" + coverageSlot +
                ", warnings=" + warnings.size() +
                '}';
    }
}