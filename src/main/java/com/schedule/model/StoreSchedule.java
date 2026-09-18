package com.schedule.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * One store's workers + shows ready for the existing AssignmentSolver.
 * Never mixes data from another store.
 */
public final class StoreSchedule {

    private final Store store;
    private final List<Worker> workers;
    private final List<Show> shows;
    private final Instant loadedAt;
    private final String sourceRevision;

    public StoreSchedule(
            Store store,
            List<Worker> workers,
            List<Show> shows,
            Instant loadedAt,
            String sourceRevision
    ) {
        this.store = Objects.requireNonNull(store, "store");
        this.workers = List.copyOf(workers == null ? List.of() : workers);
        this.shows = List.copyOf(shows == null ? List.of() : shows);
        this.loadedAt = loadedAt == null ? Instant.now() : loadedAt;
        this.sourceRevision = sourceRevision == null ? "" : sourceRevision;

        String expected = store.getId();
        for (Worker worker : this.workers) {
            if (!expected.equals(worker.getStoreId())) {
                throw new IllegalArgumentException(
                        "Worker " + worker.getId() + " storeId " + worker.getStoreId()
                                + " does not match store " + expected
                );
            }
        }
        for (Show show : this.shows) {
            if (!expected.equals(show.getStoreId())) {
                throw new IllegalArgumentException(
                        "Show " + show.getId() + " storeId " + show.getStoreId()
                                + " does not match store " + expected
                );
            }
        }
    }

    public Store getStore() {
        return store;
    }

    public List<Worker> getWorkers() {
        return workers;
    }

    public List<Show> getShows() {
        return shows;
    }

    public Instant getLoadedAt() {
        return loadedAt;
    }

    public String getSourceRevision() {
        return sourceRevision;
    }
}
