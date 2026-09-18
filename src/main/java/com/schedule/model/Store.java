package com.schedule.model;

import java.util.Objects;

/**
 * First-class scheduling identity. Store isolation is absolute:
 * workers, shows, showtimes, timezone, and routing never cross stores.
 */
public final class Store {

    private final String id;
    private final String name;
    private final String code;
    private final String timezone;
    private final String address;
    private final StoreSources sources;
    private final StoreOutputs outputs;
    private final RoutePolicy routing;

    public Store(
            String id,
            String name,
            String code,
            String timezone,
            String address,
            StoreSources sources,
            StoreOutputs outputs,
            RoutePolicy routing
    ) {
        this.id = Objects.requireNonNull(id, "id");
        this.name = Objects.requireNonNull(name, "name");
        this.code = code == null || code.isBlank() ? id : code;
        this.timezone = timezone == null || timezone.isBlank()
                ? "America/Phoenix"
                : timezone;
        this.address = address == null ? "" : address;
        this.sources = sources == null ? StoreSources.manualOnly() : sources;
        this.outputs = outputs == null ? StoreOutputs.forStore(id) : outputs;
        this.routing = routing == null ? RoutePolicy.defaults() : routing;
    }

    public static Store of(String id, String name) {
        return new Store(id, name, id, "America/Phoenix", "",
                StoreSources.manualOnly(), StoreOutputs.forStore(id), RoutePolicy.defaults());
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getCode() {
        return code;
    }

    public String getTimezone() {
        return timezone;
    }

    public String getAddress() {
        return address;
    }

    public StoreSources getSources() {
        return sources;
    }

    public StoreOutputs getOutputs() {
        return outputs;
    }

    public RoutePolicy getRouting() {
        return routing;
    }

    @Override
    public String toString() {
        return name + " [" + id + "]";
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Store store)) {
            return false;
        }
        return id.equals(store.id);
    }

    @Override
    public int hashCode() {
        return id.hashCode();
    }
}
