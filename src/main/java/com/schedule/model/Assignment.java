package com.schedule.model;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

public class Assignment {

    private final String workerId;
    private final String showId;
    private final String showtimeId;
    private final int roomNumber;
    private final TimeRange aWindow;
    private final TimeRange bWindow;
    private final LocalTime cEnd;
    private final int coverageSlot;
    private final List<Diagnostic> diagnostics;
    private boolean lead;
    private long score;

    public Assignment(
            String workerId,
            String showId,
            Showtime showtime,
            int coverageSlot
    ) {
        this.workerId = Objects.requireNonNull(workerId, "workerId");
        this.showId = Objects.requireNonNull(showId, "showId");
        Objects.requireNonNull(showtime, "showtime");
        this.showtimeId = showtime.getId();
        this.roomNumber = showtime.getRoomNumber();
        this.aWindow = showtime.getAWindow();
        this.bWindow = showtime.getBWindow();
        this.cEnd = showtime.getCEnd();

        if (coverageSlot < 0) {
            throw new IllegalArgumentException("Coverage slot cannot be negative");
        }

        this.coverageSlot = coverageSlot;
        this.diagnostics = new ArrayList<>();
    }

    public String getWorkerId() {
        return workerId;
    }

    public String getShowId() {
        return showId;
    }

    public String getShowtimeId() {
        return showtimeId;
    }

    public int getRoomNumber() {
        return roomNumber;
    }

    public Zone getZone() {
        return Zone.ofRoom(roomNumber);
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
        return new TimeRange(aWindow.start(), cEnd);
    }

    public int getCoverageSlot() {
        return coverageSlot;
    }

    public boolean isLead() {
        return lead;
    }

    public void setLead(boolean lead) {
        this.lead = lead;
    }

    public long getScore() {
        return score;
    }

    public void setScore(long score) {
        this.score = score;
    }

    public List<Diagnostic> getDiagnostics() {
        return Collections.unmodifiableList(diagnostics);
    }

    public void addDiagnostic(Diagnostic diagnostic) {
        diagnostics.add(Objects.requireNonNull(diagnostic, "diagnostic"));
    }

    public boolean hasDiagnostics() {
        return !diagnostics.isEmpty();
    }

    @Override
    public String toString() {
        return "Assignment{" +
                "workerId='" + workerId + '\'' +
                ", showId='" + showId + '\'' +
                ", showtimeId='" + showtimeId + '\'' +
                ", room=" + roomNumber +
                ", coverageSlot=" + coverageSlot +
                ", lead=" + lead +
                ", diagnostics=" + diagnostics.size() +
                '}';
    }
}
