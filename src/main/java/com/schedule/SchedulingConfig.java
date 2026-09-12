package com.schedule;

public final class SchedulingConfig {

    private SchedulingConfig() {
    }

    // Coverage
    public static final int GUESTS_PER_WORKER = 10;

    // Assignment durations
    public static final int A_MINUTES = 30;
    public static final int B_MINUTES = 60;
    public static final int C_MINUTES = 60;

    // Overlap rules
    public static final int A_PROTECTED_WINDOW_MINUTES = 30;
    public static final int B_OVERLAP_TOLERANCE_MINUTES = 30;

    // Scoring weights
    public static final int B_OVERLAP_PENALTY = 10;
    public static final int C_OVERLAP_PENALTY = 20;

    public static int workersRequired(int guests) {
        if (guests <= 0) {
            return 0;
        }

        return (guests + GUESTS_PER_WORKER - 1) / GUESTS_PER_WORKER;
    }
}