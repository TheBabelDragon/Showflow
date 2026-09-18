package com.schedule.source;

import com.schedule.model.Show;
import com.schedule.model.Store;

import java.util.List;
import java.util.Objects;

/**
 * Placeholder for iCalendar feed ingestion.
 * Wire ICS parse + store-scoped normalization in a later milestone.
 */
public final class ICalendarShowtimeSource implements ShowtimeSource {

    @Override
    public List<Show> fetch(Store store) {
        Objects.requireNonNull(store, "store");
        if (!store.getSources().hasIcal()) {
            throw new IllegalStateException(
                    "Store " + store.getId() + " has no iCal URL configured"
            );
        }
        throw new UnsupportedOperationException(
                "ICalendarShowtimeSource not yet connected for " + store.getId()
                        + " (" + store.getSources().getIcalUrl() + ")"
        );
    }

    @Override
    public String sourceName() {
        return "ical";
    }
}
