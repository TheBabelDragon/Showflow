package com.schedule.source;

import com.schedule.model.Show;
import com.schedule.model.Store;

import java.util.List;
import java.util.Objects;

/**
 * In-memory / editor-supplied showtimes for a store.
 */
public final class ManualShowtimeSource implements ShowtimeSource {

    private final List<Show> shows;

    public ManualShowtimeSource(List<Show> shows) {
        this.shows = List.copyOf(Objects.requireNonNull(shows, "shows"));
    }

    @Override
    public List<Show> fetch(Store store) {
        Objects.requireNonNull(store, "store");
        String storeId = store.getId();
        for (Show show : shows) {
            if (!storeId.equals(show.getStoreId())) {
                throw new IllegalStateException(
                        "Manual show " + show.getId() + " belongs to "
                                + show.getStoreId() + ", not " + storeId
                );
            }
        }
        return shows;
    }

    @Override
    public String sourceName() {
        return "manual";
    }
}
