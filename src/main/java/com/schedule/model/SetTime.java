package com.schedule.model;

import java.time.LocalTime;
import java.util.Objects;

public class SetTime {

    public enum Type {
        A,
        B,
        C
    }

    private final String id;
    private final Type type;
    private final TimeRange range;

    public SetTime(String id, Type type, LocalTime start) {
        this.id = Objects.requireNonNull(id, "id");
        this.type = Objects.requireNonNull(type, "type");
        Objects.requireNonNull(start, "start");

        int duration = switch (type) {
            case A -> 30;
            case B, C -> 60;
        };

        this.range = new TimeRange(
                start,
                start.plusMinutes(duration)
        );
    }

    public String getId() {
        return id;
    }

    public Type getType() {
        return type;
    }

    public TimeRange getRange() {
        return range;
    }

    public LocalTime getStart() {
        return range.start();
    }

    public LocalTime getEnd() {
        return range.end();
    }

    @Override
    public String toString() {
        return type + " [" + id + "] " + range;
    }
}