package com.schedule.model;

import java.time.Duration;
import java.time.LocalTime;
import java.util.Objects;

public record TimeRange(LocalTime start, LocalTime end) {

    public TimeRange {
        Objects.requireNonNull(start, "start");
        Objects.requireNonNull(end, "end");

        if (!start.isBefore(end)) {
            throw new IllegalArgumentException("Time range start must be before end");
        }
    }

    public long durationMinutes() {
        return Duration.between(start, end).toMinutes();
    }

    public boolean contains(LocalTime time) {
        return !time.isBefore(start) && time.isBefore(end);
    }

    public boolean contains(TimeRange other) {
        return !other.start.isBefore(start) && !other.end.isAfter(end);
    }

    public boolean overlaps(TimeRange other) {
        return start.isBefore(other.end) && other.start.isBefore(end);
    }

    public long overlapMinutes(TimeRange other) {
        if (!overlaps(other)) {
            return 0;
        }

        LocalTime overlapStart =
                start.isAfter(other.start) ? start : other.start;

        LocalTime overlapEnd =
                end.isBefore(other.end) ? end : other.end;

        return Duration.between(overlapStart, overlapEnd).toMinutes();
    }

    @Override
    public String toString() {
        return start + " - " + end;
    }
}