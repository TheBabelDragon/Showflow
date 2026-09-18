package com.schedule.model;

import com.schedule.SchedulingConfig;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

public class Show {

    private final String storeId;
    private final String id;
    private final String name;
    private final String theater;
    private final int guests;
    private final List<Showtime> showtimes;

    public Show(String storeId, String id, String name, int guests) {
        this(storeId, id, name, guests, SchedulingConfig.DEFAULT_THEATER);
    }

    public Show(String storeId, String id, String name, int guests, String theater) {
        this.storeId = Objects.requireNonNull(storeId, "storeId");
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

    /** @deprecated Prefer constructor with storeId for multi-store isolation. */
    @Deprecated
    public Show(String id, String name, int guests) {
        this("STORE-DEFAULT", id, name, guests, SchedulingConfig.DEFAULT_THEATER);
    }

    /** @deprecated Prefer constructor with storeId for multi-store isolation. */
    @Deprecated
    public Show(String id, String name, int guests, String theater) {
        this("STORE-DEFAULT", id, name, guests, theater);
    }

    public String getStoreId() {
        return storeId;
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
        Objects.requireNonNull(showtime, "showtime");
        if (!storeId.equals(showtime.getStoreId())) {
            throw new IllegalArgumentException(
                    "Showtime storeId " + showtime.getStoreId()
                            + " does not match show storeId " + storeId
            );
        }
        showtimes.add(showtime);
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
        return name + " [" + id + "] store=" + storeId
                + " - " + guests + " guests @ " + theater;
    }
}
