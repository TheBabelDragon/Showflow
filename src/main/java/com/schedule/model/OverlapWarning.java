package com.schedule.model;

public record OverlapWarning(
        String workerId,
        String existingAssignmentId,
        String newAssignmentId,
        SetTime.Type existingType,
        SetTime.Type newType,
        long overlapMinutes,
        String message
) {
    @Override
    public String toString() {
        return "WARNING: " + message +
                " (" + overlapMinutes + " min overlap)";
    }
}