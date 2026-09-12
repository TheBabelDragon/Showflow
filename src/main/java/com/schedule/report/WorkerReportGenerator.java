package com.schedule.report;

import com.schedule.engine.SolveResult;
import com.schedule.model.FillSlot;
import com.schedule.model.OverlapWarning;
import com.schedule.model.Show;
import com.schedule.model.Worker;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class WorkerReportGenerator {

    public String generate(
            Worker worker,
            List<Show> shows,
            SolveResult result
    ) {
        Map<String, Show> showById = shows.stream()
                .collect(Collectors.toMap(
                        Show::getId,
                        show -> show
                ));

        List<FillSlot> assignments = result.getAssignments().stream()
                .filter(slot ->
                        slot.getWorkerId().equals(worker.getId()))
                .sorted(Comparator.comparing(
                        this::startTime
                ))
                .toList();

        StringBuilder out = new StringBuilder();

        out.append("============================================================\n");
        out.append("SHOWFLOW WORKER SCHEDULE\n");
        out.append("============================================================\n");
        out.append("WORKER: ")
                .append(worker.getName())
                .append(" [")
                .append(worker.getId())
                .append("]\n\n");

        out.append("ASSIGNMENTS\n");
        out.append("------------------------------------------------------------\n");

        if (assignments.isEmpty()) {
            out.append("NONE\n");
        } else {
            for (FillSlot slot : assignments) {
                Show show = showById.get(slot.getShowId());

                out.append("- ")
                        .append(show == null
                                ? slot.getShowId()
                                : show.getName())
                        .append(" / ")
                        .append(slot.getSetTimeId())
                        .append(" / ")
                        .append(slotType(slot))
                        .append(" / ")
                        .append(slotRange(slot))
                        .append("\n");

                if (slot.hasWarnings()) {
                    for (OverlapWarning warning : slot.getWarnings()) {
                        out.append("    WARNING: ")
                                .append(warning)
                                .append("\n");
                    }
                }
            }
        }

        out.append("\nTOTAL ASSIGNMENTS: ")
                .append(assignments.size())
                .append("\n");

        List<OverlapWarning> workerWarnings =
                result.getWarnings().stream()
                        .filter(warning ->
                                warning.workerId().equals(worker.getId()))
                        .toList();

        out.append("\nOVERLAP WARNINGS\n");
        out.append("------------------------------------------------------------\n");

        if (workerWarnings.isEmpty()) {
            out.append("NONE\n");
        } else {
            for (OverlapWarning warning : workerWarnings) {
                out.append("- ")
                        .append(warning)
                        .append("\n");
            }
        }

        out.append("\n============================================================\n");
        out.append("END WORKER SCHEDULE\n");
        out.append("============================================================\n");

        return out.toString();
    }

    private java.time.LocalTime startTime(FillSlot slot) {
        if (slot.getARange() != null) {
            return slot.getARange().start();
        }

        if (slot.getBRange() != null) {
            return slot.getBRange().start();
        }

        return slot.getCRange().start();
    }

    private String slotType(FillSlot slot) {
        if (slot.getARange() != null) {
            return "A";
        }

        if (slot.getBRange() != null) {
            return "B";
        }

        return "C";
    }

    private String slotRange(FillSlot slot) {
        if (slot.getARange() != null) {
            return slot.getARange().toString();
        }

        if (slot.getBRange() != null) {
            return slot.getBRange().toString();
        }

        return slot.getCRange().toString();
    }
}