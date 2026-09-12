package com.schedule.model;

public record CoverageGap(
        String showId,
        String setTimeId,
        int required,
        int assigned
) {
    public int missing() {
        return Math.max(0, required - assigned);
    }

    public boolean isCovered() {
        return assigned >= required;
    }

    @Override
    public String toString() {
        return "CoverageGap{" +
                "showId='" + showId + '\'' +
                ", setTimeId='" + setTimeId + '\'' +
                ", required=" + required +
                ", assigned=" + assigned +
                ", missing=" + missing() +
                '}';
    }
}