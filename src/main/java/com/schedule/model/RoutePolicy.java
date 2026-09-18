package com.schedule.model;

/**
 * How a store selects and combines showtime sources.
 */
public final class RoutePolicy {

    public enum Mode {
        /** Single authoritative source (first configured). */
        PRIMARY,
        /** Prefer API, fall back to iCal, then manual. */
        FALLBACK,
        /** Future: reconcile multiple sources into canonical showtimes. */
        RECONCILE
    }

    private final Mode mode;

    public RoutePolicy(Mode mode) {
        this.mode = mode == null ? Mode.PRIMARY : mode;
    }

    public static RoutePolicy defaults() {
        return new RoutePolicy(Mode.PRIMARY);
    }

    public Mode getMode() {
        return mode;
    }
}
