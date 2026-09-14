package com.schedule.engine;

public record AssignmentScore(
        long zoneAffinity,
        long roomFamilyAffinity,
        long aOverlapMinutes,
        long bOverlapMinutes,
        long cProximityMinutes,
        int existingAssignmentCount,
        int zoneTransitions,
        int leadWeight,
        int existingLeadCount
) {

    public long coverageScore() {
        return zoneAffinity
                + roomFamilyAffinity
                - (aOverlapMinutes * com.schedule.SchedulingConfig.A_OVERLAP_PENALTY)
                - (bOverlapMinutes * com.schedule.SchedulingConfig.B_OVERLAP_PENALTY)
                - proximityPenalty()
                - ((long) existingAssignmentCount * com.schedule.SchedulingConfig.WORKLOAD_PENALTY)
                - ((long) zoneTransitions * com.schedule.SchedulingConfig.TRANSITION_PENALTY);
    }

    public long leadScore() {
        return ((long) leadWeight * com.schedule.SchedulingConfig.LEAD_WEIGHT_FACTOR)
                + zoneAffinity
                - ((long) existingLeadCount * com.schedule.SchedulingConfig.LEAD_LOAD_PENALTY)
                - (aOverlapMinutes * 2)
                - (bOverlapMinutes)
                - proximityPenalty()
                - ((long) zoneTransitions * com.schedule.SchedulingConfig.TRANSITION_PENALTY);
    }

    private long proximityPenalty() {
        if (cProximityMinutes <= 0) {
            return 0;
        }
        if (cProximityMinutes > com.schedule.SchedulingConfig.C_PROXIMITY_MINUTES) {
            return 0;
        }
        long tightness = com.schedule.SchedulingConfig.C_PROXIMITY_MINUTES - cProximityMinutes + 1;
        return tightness * com.schedule.SchedulingConfig.C_PROXIMITY_PENALTY;
    }

    @Override
    public String toString() {
        return "AssignmentScore{coverage=" + coverageScore()
                + ", lead=" + leadScore()
                + ", zone=" + zoneAffinity
                + ", family=" + roomFamilyAffinity
                + ", a=" + aOverlapMinutes
                + ", b=" + bOverlapMinutes
                + ", cProx=" + cProximityMinutes
                + ", load=" + existingAssignmentCount
                + "}";
    }
}
