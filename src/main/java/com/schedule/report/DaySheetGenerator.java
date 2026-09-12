package com.schedule.report;

import com.schedule.SchedulingConfig;
import com.schedule.engine.SolveResult;
import com.schedule.model.CoverageGap;
import com.schedule.model.FillSlot;
import com.schedule.model.Show;
import com.schedule.model.SetTime;
import com.schedule.model.Worker;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class DaySheetGenerator {

    public String generate(
            String dayLabel,
            List<Worker> workers,
            List<Show> shows,
            SolveResult result
    ) {
        StringBuilder out = new StringBuilder();

        Map<String, Worker> workerById = workers.stream()
                .collect(Collectors.toMap(
                        Worker::getId,
                        worker -> worker
                ));

        Map<String, Show> showById = shows.stream()
                .collect(Collectors.toMap(
                        Show::getId,
                        show -> show
                ));

        out.append("============================================================\n");
        out.append("SHOWFLOW MASTER DAY SHEET\n");
        out.append("============================================================\n");
        out.append("DAY: ").append(dayLabel).append("\n\n");

        out.append("SYSTEM SUMMARY\n");
        out.append("------------------------------------------------------------\n");
        out.append("Guests per worker target: ")
                .append(SchedulingConfig.GUESTS_PER_WORKER)
                .append("\n");
        out.append("Assignments: ")
                .append(result.assignmentCount())
                .append("\n");
        out.append("Coverage gaps: ")
                .append(result.gapCount())
                .append("\n");
        out.append("Warnings: ")
                .append(result.getWarnings().size())
                .append("\n");
        out.append("Fully covered: ")
                .append(result.isFullyCovered())
                .append("\n\n");

        out.append("SHOW COVERAGE\n");
        out.append("------------------------------------------------------------\n");

        for (Show show : shows) {
            int required =
                    SchedulingConfig.workersRequired(show.getGuests());

            out.append(show.getName())
                    .append(" [")
                    .append(show.getId())
                    .append("] - ")
                    .append(show.getGuests())
                    .append(" guests, ")
                    .append(required)
                    .append(" workers per set\n");

            for (SetTime setTime : show.getSetTimes()) {
                int assigned = (int) result.getAssignments().stream()
                        .filter(slot ->
                                slot.getShowId().equals(show.getId())
                                        && slot.getSetTimeId()
                                        .equals(setTime.getId())
                        )
                        .map(FillSlot::getWorkerId)
                        .distinct()
                        .count();

                out.append("  ")
                        .append(setTime.getType())
                        .append(" ")
                        .append(setTime.getRange())
                        .append(" -> ")
                        .append(assigned)
                        .append("/")
                        .append(required)
                        .append("\n");
            }

            out.append("\n");
        }

        out.append("MASTER ASSIGNMENT SCHEDULE\n");
        out.append("------------------------------------------------------------\n");

        result.getAssignments().stream()
                .sorted(Comparator
                        .comparing((FillSlot slot) ->
                                slot.getARange() != null
                                        ? slot.getARange().start()
                                        : slot.getBRange() != null
                                        ? slot.getBRange().start()
                                        : slot.getCRange().start())
                        .thenComparing(FillSlot::getShowId)
                        .thenComparing(FillSlot::getSetTimeId))
                .forEach(slot -> {
                    Worker worker =
                            workerById.get(slot.getWorkerId());

                    Show show =
                            showById.get(slot.getShowId());

                    out.append(formatAssignment(
                            worker,
                            show,
                            slot
                    ));
                });

        out.append("\nCOVERAGE GAPS\n");
        out.append("------------------------------------------------------------\n");

        if (result.getCoverageGaps().isEmpty()) {
            out.append("NONE\n");
        } else {
            for (CoverageGap gap : result.getCoverageGaps()) {
                Show show = showById.get(gap.showId());

                out.append(show == null
                                ? gap.showId()
                                : show.getName())
                        .append(" / ")
                        .append(gap.setTimeId())
                        .append(": missing ")
                        .append(gap.missing())
                        .append(" worker(s)\n");
            }
        }

        out.append("\nWARNINGS\n");
        out.append("------------------------------------------------------------\n");

        if (result.getWarnings().isEmpty()) {
            out.append("NONE\n");
        } else {
            result.getWarnings().forEach(warning ->
                    out.append("- ")
                            .append(warning)
                            .append("\n")
            );
        }

        out.append("\n============================================================\n");
        out.append("END MASTER DAY SHEET\n");
        out.append("============================================================\n");

        return out.toString();
    }

    private String formatAssignment(
            Worker worker,
            Show show,
            FillSlot slot
    ) {
        String workerName =
                worker == null
                        ? slot.getWorkerId()
                        : worker.getName();

        String showName =
                show == null
                        ? slot.getShowId()
                        : show.getName();

        SetTime.Type type = null;
        String range = "";

        if (slot.getARange() != null) {
            type = SetTime.Type.A;
            range = slot.getARange().toString();
        } else if (slot.getBRange() != null) {
            type = SetTime.Type.B;
            range = slot.getBRange().toString();
        } else if (slot.getCRange() != null) {
            type = SetTime.Type.C;
            range = slot.getCRange().toString();
        }

        return String.format(
                "%-12s %-24s %-4s %-17s coverage-slot=%d%s%n",
                workerName,
                showName,
                type,
                range,
                slot.getCoverageSlot(),
                slot.hasWarnings()
                        ? " [WARNINGS]"
                        : ""
        );
    }
}