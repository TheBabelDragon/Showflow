package com.schedule.model;

import com.schedule.SchedulingConfig;

import java.time.LocalTime;
import java.util.Objects;

/**
 * One concrete performance. A/B/C are derived operational windows,
 * not independently scheduled set types.
 *
 * <pre>
 * A = [start - 30m, start]
 * C = start + duration          // end event, not a range
 * B = [C - 45m, C]
 * </pre>
 *
 * <p><b>Same-calendar-day contract:</b> duration must not wrap past midnight.
 * External API / iCal sources must normalize multi-day events before mapping
 * into this model; the solver does not span calendar days.
 */
public class Showtime {

    private final String storeId;
    private final String id;
    private final int roomNumber;
    private final LocalTime start;
    private final int durationMinutes;
    private final TimeRange aWindow;
    private final TimeRange bWindow;
    private final LocalTime cEnd;
    private final TimeRange operationalSpan;

    public Showtime(
            String storeId,
            String id,
            int roomNumber,
            LocalTime start,
            int durationMinutes
    ) {
        this.storeId = Objects.requireNonNull(storeId, "storeId");
        this.id = Objects.requireNonNull(id, "id");
        this.start = Objects.requireNonNull(start, "start");

        if (roomNumber < SchedulingConfig.MIN_ROOM
                || roomNumber > SchedulingConfig.MAX_ROOM) {
            throw new IllegalArgumentException(
                    "Room must be " + SchedulingConfig.MIN_ROOM
                            + "-" + SchedulingConfig.MAX_ROOM
            );
        }
        if (durationMinutes <= 0) {
            throw new IllegalArgumentException("Duration must be positive");
        }

        this.roomNumber = roomNumber;
        this.durationMinutes = durationMinutes;

        LocalTime derivedAStart = start.minusMinutes(SchedulingConfig.A_LEAD_MINUTES);
        if (!derivedAStart.isBefore(start)) {
            throw new IllegalArgumentException(
                    "Showtime start must be at least "
                            + SchedulingConfig.A_LEAD_MINUTES
                            + " minutes after midnight so A can be derived"
            );
        }

        LocalTime derivedC = start.plusMinutes(durationMinutes);
        if (!start.isBefore(derivedC)) {
            throw new IllegalArgumentException(
                    "Same-calendar-day contract: duration wraps past midnight; "
                            + "normalize external sources before ingestion"
            );
        }

        LocalTime derivedBStart = derivedC.minusMinutes(SchedulingConfig.B_TRAIL_MINUTES);
        if (!derivedBStart.isBefore(derivedC)) {
            throw new IllegalArgumentException("Unable to derive B window from C");
        }

        this.aWindow = new TimeRange(derivedAStart, start);
        this.cEnd = derivedC;
        this.bWindow = new TimeRange(derivedBStart, derivedC);
        this.operationalSpan = new TimeRange(derivedAStart, derivedC);
    }

    /** @deprecated Prefer constructor with storeId for multi-store isolation. */
    @Deprecated
    public Showtime(
            String id,
            int roomNumber,
            LocalTime start,
            int durationMinutes
    ) {
        this("STORE-DEFAULT", id, roomNumber, start, durationMinutes);
    }

    public String getStoreId() {
        return storeId;
    }

    public String getId() {
        return id;
    }

    public int getRoomNumber() {
        return roomNumber;
    }

    public Zone getZone() {
        return Zone.ofRoom(roomNumber);
    }

    public LocalTime getStart() {
        return start;
    }

    public int getDurationMinutes() {
        return durationMinutes;
    }

    public TimeRange getAWindow() {
        return aWindow;
    }

    public TimeRange getBWindow() {
        return bWindow;
    }

    public LocalTime getCEnd() {
        return cEnd;
    }

    public TimeRange getOperationalSpan() {
        return operationalSpan;
    }

    @Override
    public String toString() {
        return "Showtime[" + id + "] store=" + storeId
                + " room " + roomNumber
                + " start " + start
                + " +" + durationMinutes + "m"
                + " A=" + aWindow
                + " B=" + bWindow
                + " C=" + cEnd;
    }
}
