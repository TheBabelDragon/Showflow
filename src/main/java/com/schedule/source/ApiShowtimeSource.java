package com.schedule.source;

import com.schedule.model.Show;
import com.schedule.model.Store;

import java.util.List;
import java.util.Objects;

/**
 * Placeholder for corporate / store showtime API ingestion.
 * Wire HTTP client + JSON mapping in a later milestone.
 */
public final class ApiShowtimeSource implements ShowtimeSource {

    @Override
    public List<Show> fetch(Store store) {
        Objects.requireNonNull(store, "store");
        if (!store.getSources().hasApi()) {
            throw new IllegalStateException(
                    "Store " + store.getId() + " has no showtime API URL configured"
            );
        }
        // Future: HTTP GET store.getSources().getShowtimeApiUrl() and map to Show[].
        throw new UnsupportedOperationException(
                "ApiShowtimeSource not yet connected for " + store.getId()
                        + " (" + store.getSources().getShowtimeApiUrl() + ")"
        );
    }

    @Override
    public String sourceName() {
        return "api";
    }
}
