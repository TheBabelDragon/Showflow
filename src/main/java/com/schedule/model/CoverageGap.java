package com.schedule.model;

public record CoverageGap(
        String showId,
        String showtimeId,
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
                ", showtimeId='" + showtimeId + '\'' +
                ", required=" + required +
                ", assigned=" + assigned +
                ", missing=" + missing() +
                '}';
    }
}
