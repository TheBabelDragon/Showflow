package com.schedule.model;

import com.schedule.SchedulingConfig;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public class Worker {

    private final String storeId;
    private final String id;
    private final String name;
    private final List<TimeRange> availability;
    private final Map<String, Integer> leadWeightByTheater;
    private Zone preferredZone;

    public Worker(String storeId, String id, String name) {
        this(storeId, id, name, List.of(), Map.of(), null);
    }

    public Worker(String storeId, String id, String name, List<TimeRange> availability) {
        this(storeId, id, name, availability, Map.of(), null);
    }

    public Worker(
            String storeId,
            String id,
            String name,
            List<TimeRange> availability,
            Map<String, Integer> leadWeightByTheater,
            Zone preferredZone
    ) {
        this.storeId = Objects.requireNonNull(storeId, "storeId");
        this.id = Objects.requireNonNull(id, "id");
        this.name = Objects.requireNonNull(name, "name");
        this.availability = new ArrayList<>(availability);
        this.leadWeightByTheater = new HashMap<>();
        if (leadWeightByTheater != null) {
            leadWeightByTheater.forEach(this::setLeadWeight);
        }
        this.preferredZone = preferredZone;
    }

    /** @deprecated Prefer constructor with storeId for multi-store isolation. */
    @Deprecated
    public Worker(String id, String name) {
        this("STORE-DEFAULT", id, name, List.of(), Map.of(), null);
    }

    /** @deprecated Prefer constructor with storeId for multi-store isolation. */
    @Deprecated
    public Worker(String id, String name, List<TimeRange> availability) {
        this("STORE-DEFAULT", id, name, availability, Map.of(), null);
    }

    /** @deprecated Prefer constructor with storeId for multi-store isolation. */
    @Deprecated
    public Worker(
            String id,
            String name,
            List<TimeRange> availability,
            Map<String, Integer> leadWeightByTheater,
            Zone preferredZone
    ) {
        this("STORE-DEFAULT", id, name, availability, leadWeightByTheater, preferredZone);
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

    public List<TimeRange> getAvailability() {
        return Collections.unmodifiableList(availability);
    }

    public void addAvailability(TimeRange range) {
        availability.add(Objects.requireNonNull(range, "range"));
    }

    public Zone getPreferredZone() {
        return preferredZone;
    }

    public void setPreferredZone(Zone preferredZone) {
        this.preferredZone = preferredZone;
    }

    public Map<String, Integer> getLeadWeightByTheater() {
        return Collections.unmodifiableMap(leadWeightByTheater);
    }

    public void setLeadWeight(String theater, int weight) {
        String key = theater == null || theater.isBlank()
                ? SchedulingConfig.DEFAULT_THEATER
                : theater;
        if (weight < 0 || weight > 10) {
            throw new IllegalArgumentException("Lead weight must be 0-10");
        }
        leadWeightByTheater.put(key, weight);
    }

    public int leadWeight(String theater) {
        String key = theater == null || theater.isBlank()
                ? SchedulingConfig.DEFAULT_THEATER
                : theater;
        return leadWeightByTheater.getOrDefault(key, 5);
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
        return name + " [" + id + "] store=" + storeId;
    }
}
