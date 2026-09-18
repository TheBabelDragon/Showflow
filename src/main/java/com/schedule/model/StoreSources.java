package com.schedule.model;

/**
 * Upstream showtime ingestion routes for a store.
 * At least one source should be active; multiple can be reconciled later.
 */
public final class StoreSources {

    private final String showtimeApiUrl;
    private final String icalUrl;
    private final boolean manual;

    public StoreSources(String showtimeApiUrl, String icalUrl, boolean manual) {
        this.showtimeApiUrl = showtimeApiUrl;
        this.icalUrl = icalUrl;
        this.manual = manual;
    }

    public static StoreSources manualOnly() {
        return new StoreSources(null, null, true);
    }

    public static StoreSources api(String url) {
        return new StoreSources(url, null, false);
    }

    public static StoreSources ical(String url) {
        return new StoreSources(null, url, false);
    }

    public String getShowtimeApiUrl() {
        return showtimeApiUrl;
    }

    public String getIcalUrl() {
        return icalUrl;
    }

    public boolean isManual() {
        return manual;
    }

    public boolean hasApi() {
        return showtimeApiUrl != null && !showtimeApiUrl.isBlank();
    }

    public boolean hasIcal() {
        return icalUrl != null && !icalUrl.isBlank();
    }
}
