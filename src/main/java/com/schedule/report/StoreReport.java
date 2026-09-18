package com.schedule.report;

import com.schedule.model.ScheduleRevision;
import com.schedule.model.Store;

import java.util.Objects;

/**
 * One schedule revision rendered as multiple operational surfaces.
 */
public final class StoreReport {

    private final Store store;
    private final ScheduleRevision revision;
    private final String daySheetText;
    private final String jsonPayload;
    private final String icalPayload;

    public StoreReport(
            Store store,
            ScheduleRevision revision,
            String daySheetText,
            String jsonPayload,
            String icalPayload
    ) {
        this.store = Objects.requireNonNull(store, "store");
        this.revision = Objects.requireNonNull(revision, "revision");
        this.daySheetText = daySheetText == null ? "" : daySheetText;
        this.jsonPayload = jsonPayload == null ? "{}" : jsonPayload;
        this.icalPayload = icalPayload == null ? "" : icalPayload;
    }

    public Store getStore() {
        return store;
    }

    public ScheduleRevision getRevision() {
        return revision;
    }

    public String getDaySheetText() {
        return daySheetText;
    }

    public String getJsonPayload() {
        return jsonPayload;
    }

    public String getIcalPayload() {
        return icalPayload;
    }
}
