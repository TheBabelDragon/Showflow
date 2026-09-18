package com.schedule.model;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

/**
 * One store's workers + shows for one calendar date, ready for AssignmentSolver.
 * Never mixes data from another store.
 *
 * <p>Solver continues to use {@link java.time.LocalTime} internally. The store
 * timezone + this date make external calendars and APIs unambiguous.
 */
public final class StoreSchedule {

    private final Store store;
    private final LocalDate scheduleDate;
    private final List<Worker> workers;
    private final List<Show> shows;
    private final Instant loadedAt;
    private final String sourceRevision;

    public StoreSchedule(
            Store store,
            LocalDate scheduleDate,
            List<Worker> workers,
            List<Show> shows,
            Instant loadedAt,
            String sourceRevision
    ) {
        this.store = Objects.requireNonNull(store, "store");
        this.scheduleDate = Objects.requireNonNull(scheduleDate, "scheduleDate");
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

    /** Convenience when date is "today" in the store timezone is chosen by the caller. */
    public StoreSchedule(
            Store store,
            List<Worker> workers,
            List<Show> shows,
            Instant loadedAt,
            String sourceRevision
    ) {
        this(store, LocalDate.now(), workers, shows, loadedAt, sourceRevision);
    }

    public Store getStore() {
        return store;
    }

    public LocalDate getScheduleDate() {
        return scheduleDate;
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
