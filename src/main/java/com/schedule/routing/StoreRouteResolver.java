package com.schedule.routing;

import com.schedule.model.RoutePolicy;
import com.schedule.model.Store;
import com.schedule.model.StoreSources;
import com.schedule.source.ApiShowtimeSource;
import com.schedule.source.ICalendarShowtimeSource;
import com.schedule.source.ManualShowtimeSource;
import com.schedule.source.ShowtimeSource;

import java.util.Objects;

/**
 * Selects the showtime source for a store without hard-coding URLs in the solver.
 */
public final class StoreRouteResolver {

    private final ShowtimeSource manualFallback;

    public StoreRouteResolver() {
        this(new ManualShowtimeSource(java.util.List.of()));
    }

    public StoreRouteResolver(ShowtimeSource manualFallback) {
        this.manualFallback = Objects.requireNonNull(manualFallback, "manualFallback");
    }

    public ShowtimeSource sourceFor(Store store) {
        Objects.requireNonNull(store, "store");
        StoreSources sources = store.getSources();
        RoutePolicy.Mode mode = store.getRouting().getMode();

        return switch (mode) {
            case PRIMARY -> primary(sources);
            case FALLBACK -> fallback(sources);
            case RECONCILE -> primary(sources); // reconciler lands in a later milestone
        };
    }

    private ShowtimeSource primary(StoreSources sources) {
        if (sources.hasApi()) {
            return new ApiShowtimeSource();
        }
        if (sources.hasIcal()) {
            return new ICalendarShowtimeSource();
        }
        if (sources.isManual()) {
            return manualFallback;
        }
        return manualFallback;
    }

    private ShowtimeSource fallback(StoreSources sources) {
        if (sources.hasApi()) {
            return new ApiShowtimeSource();
        }
        if (sources.hasIcal()) {
            return new ICalendarShowtimeSource();
        }
        return manualFallback;
    }
}
