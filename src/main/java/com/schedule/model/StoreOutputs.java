package com.schedule.model;

/**
 * Store-specific report and API surface paths.
 */
public final class StoreOutputs {

    private final String htmlBase;
    private final String icalPath;
    private final String apiPath;

    public StoreOutputs(String htmlBase, String icalPath, String apiPath) {
        this.htmlBase = htmlBase;
        this.icalPath = icalPath;
        this.apiPath = apiPath;
    }

    public static StoreOutputs forStore(String storeId) {
        String base = "/stores/" + storeId + "/";
        return new StoreOutputs(
                base,
                base + "calendar.ics",
                "/api/stores/" + storeId + "/schedule"
        );
    }

    public String getHtmlBase() {
        return htmlBase;
    }

    public String getIcalPath() {
        return icalPath;
    }

    public String getApiPath() {
        return apiPath;
    }
}
