package com.schedule.engine;

public record AssignmentScore(
        long bOverlapMinutes,
        long cOverlapMinutes,
        int existingAssignmentCount
) {

    public long totalScore() {
        return (bOverlapMinutes * 10)
                + (cOverlapMinutes * 20)
                + existingAssignmentCount;
    }

    @Override
    public String toString() {
        return "AssignmentScore{" +
                "bOverlapMinutes=" + bOverlapMinutes +
                ", cOverlapMinutes=" + cOverlapMinutes +
                ", existingAssignmentCount=" + existingAssignmentCount +
                ", totalScore=" + totalScore() +
                '}';
    }
}