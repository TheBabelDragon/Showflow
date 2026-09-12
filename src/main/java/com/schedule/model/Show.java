package com.schedule.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

public class Show {

    private final String id;
    private final String name;
    private final int guests;
    private final List<SetTime> setTimes;

    public Show(String id, String name, int guests) {
        this.id = Objects.requireNonNull(id, "id");
        this.name = Objects.requireNonNull(name, "name");

        if (guests < 0) {
            throw new IllegalArgumentException("Guests cannot be negative");
        }

        this.guests = guests;
        this.setTimes = new ArrayList<>();
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public int getGuests() {
        return guests;
    }

    public List<SetTime> getSetTimes() {
        return Collections.unmodifiableList(setTimes);
    }

    public void addSetTime(SetTime setTime) {
        setTimes.add(
                Objects.requireNonNull(setTime, "setTime")
        );
    }

    public int workersRequired() {
        return (guests + 9) / 10;
    }

    @Override
    public String toString() {
        return name + " [" + id + "] - " + guests + " guests";
    }
}