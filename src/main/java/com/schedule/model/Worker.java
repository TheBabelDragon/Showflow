package com.schedule.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

public class Worker {

    private final String id;
    private final String name;
    private final List<TimeRange> availability;

    public Worker(String id, String name) {
        this(id, name, List.of());
    }

    public Worker(String id, String name, List<TimeRange> availability) {
        this.id = Objects.requireNonNull(id, "id");
        this.name = Objects.requireNonNull(name, "name");
        this.availability = new ArrayList<>(availability);
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public List<TimeRange> getAvailability() {
        return Collections.unmodifiableList(availability);
    }

    public void addAvailability(TimeRange range) {
        availability.add(
                Objects.requireNonNull(range, "range")
        );
    }

    public boolean isAvailable(TimeRange required) {
        if (availability.isEmpty()) {
            return true;
        }

        return availability.stream()
                .anyMatch(window -> window.contains(required));
    }

    @Override
    public String toString() {
        return name + " [" + id + "]";
    }
}