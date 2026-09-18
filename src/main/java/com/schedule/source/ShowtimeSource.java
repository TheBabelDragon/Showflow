package com.schedule.source;

import com.schedule.model.Show;
import com.schedule.model.Store;

import java.util.List;

/**
 * Fetches (or supplies) shows/showtimes for one store.
 * Implementations must never return data for a different storeId.
 */
public interface ShowtimeSource {

    List<Show> fetch(Store store);

    /** Short label for ScheduleRevision.source */
    String sourceName();
}
