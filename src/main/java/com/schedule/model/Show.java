package com.schedule.model;

import com.schedule.SchedulingConfig;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

public class Show {

    private final String id;
    private final String name;
    private final String theater;
    private final int guests;
    private final List<Showtime> showtimes;

    public Show(String id, String name, int guests) {
        this(id, name, guests, SchedulingConfig.DEFAULT_THEATER);
    }

    public Show(String id, String name, int guests, String theater) {
        this.id = Objects.requireNonNull(id, "id");
        this.name = Objects.requireNonNull(name, "name");
        this.theater = theater == null || theater.isBlank()
                ? SchedulingConfig.DEFAULT_THEATER
                : theater;

        if (guests < 0) {
            throw new IllegalArgumentException("Guests cannot be negative");
        }

        this.guests = guests;
        this.showtimes = new ArrayList<>();
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getTheater() {
        return theater;
    }

    public int getGuests() {
        return guests;
    }

    public List<Showtime> getShowtimes() {
        return Collections.unmodifiableList(showtimes);
    }

    public void addShowtime(Showtime showtime) {
        showtimes.add(Objects.requireNonNull(showtime, "showtime"));
    }

    public int workersRequired() {
        return SchedulingConfig.workersRequired(guests);
    }

    public Showtime showtime(String showtimeId) {
        return showtimes.stream()
                .filter(showtime -> showtime.getId().equals(showtimeId))
                .findFirst()
                .orElse(null);
    }

    @Override
    public String toString() {
        return name + " [" + id + "] - " + guests + " guests @ " + theater;
    }
}
