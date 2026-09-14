package com.schedule.model;

import java.util.Objects;

public record Diagnostic(
        Code code,
        String workerId,
        String existingShowtimeId,
        String newShowtimeId,
        long metricMinutes,
        boolean exceptionApplied,
        String message
) {

    public enum Code {
        A_OVERLAP,
        B_OVERLAP,
        C_PROXIMITY,
        ROOM_FAMILY_SWITCH,
        ZONE_SWITCH,
        WORKLOAD,
        FIRST_SET_A_EXCEPTION,
        DOUBLE_A,
        LEAD_QUALITY
    }

    public Diagnostic {
        Objects.requireNonNull(code, "code");
        Objects.requireNonNull(message, "message");
    }

    @Override
    public String toString() {
        String extra = exceptionApplied ? " [exception]" : "";
        if (metricMinutes > 0) {
            return "WARNING: " + message + " (" + metricMinutes + " min)" + extra;
        }
        return "WARNING: " + message + extra;
    }
}
