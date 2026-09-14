package com.schedule;

public final class SchedulingConfig {

    private SchedulingConfig() {
    }

    // Coverage
    public static final int GUESTS_PER_WORKER = 10;
    public static final int FIRST_SET_A_EXCEPTION_GUEST_LIMIT = 10;

    // Rooms / zones
    public static final int MIN_ROOM = 1;
    public static final int MAX_ROOM = 7;
    public static final int MAIN_ZONE_LAST_ROOM = 4;

    // Derived operational windows
    public static final int A_LEAD_MINUTES = 30;
    public static final int B_TRAIL_MINUTES = 45;

    // Overlap / proximity
    public static final int B_OVERLAP_TOLERANCE_MINUTES = 30;
    public static final int C_PROXIMITY_MINUTES = 15;

    // Soft scoring: higher is better
    public static final int LEAD_WEIGHT_FACTOR = 100;
    public static final int ZONE_MATCH_BONUS = 80;
    public static final int ZONE_MISMATCH_PENALTY = 80;
    public static final int PREFERRED_PAIR_BONUS = 60;
    public static final int SAME_FAMILY_BONUS = 30;
    public static final int CROSS_FAMILY_PENALTY = 50;
    public static final int A_OVERLAP_PENALTY = 40;
    public static final int B_OVERLAP_PENALTY = 8;
    public static final int C_PROXIMITY_PENALTY = 12;
    public static final int WORKLOAD_PENALTY = 5;
    public static final int TRANSITION_PENALTY = 15;
    public static final int LEAD_LOAD_PENALTY = 25;

    public static final String DEFAULT_THEATER = "default";

    public static int workersRequired(int guests) {
        if (guests <= 0) {
            return 0;
        }

        return (guests + GUESTS_PER_WORKER - 1) / GUESTS_PER_WORKER;
    }
}
