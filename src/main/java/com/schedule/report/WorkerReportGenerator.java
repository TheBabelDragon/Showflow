package com.schedule.report;

import com.schedule.engine.SolveResult;
import com.schedule.model.Assignment;
import com.schedule.model.Diagnostic;
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
                .collect(Collectors.toMap(Show::getId, show -> show));

        List<Assignment> assignments = result.getAssignments().stream()
                .filter(slot -> slot.getWorkerId().equals(worker.getId()))
                .sorted(Comparator.comparing(slot -> slot.getAWindow().start()))
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
            for (Assignment slot : assignments) {
                Show show = showById.get(slot.getShowId());

                out.append("- ")
                        .append(show == null ? slot.getShowId() : show.getName())
                        .append(" / room ")
                        .append(slot.getRoomNumber())
                        .append(" / ")
                        .append(slot.getShowtimeId())
                        .append(" / start ")
                        .append(slot.getAWindow().end())
                        .append(" / C ")
                        .append(slot.getCEnd())
                        .append(slot.isLead() ? " / LEAD" : "")
                        .append("\n");

                if (slot.hasDiagnostics()) {
                    for (Diagnostic warning : slot.getDiagnostics()) {
                        out.append("    WARNING: ").append(warning).append("\n");
                    }
                }
            }
        }

        out.append("\nTOTAL ASSIGNMENTS: ")
                .append(assignments.size())
                .append("\n");

        List<Diagnostic> workerWarnings = result.getWarnings().stream()
                .filter(warning -> worker.getId().equals(warning.workerId()))
                .toList();

        out.append("\nOVERLAP WARNINGS\n");
        out.append("------------------------------------------------------------\n");

        if (workerWarnings.isEmpty()) {
            out.append("NONE\n");
        } else {
            for (Diagnostic warning : workerWarnings) {
                out.append("- ").append(warning).append("\n");
            }
        }

        out.append("\n============================================================\n");
        out.append("END WORKER SCHEDULE\n");
        out.append("============================================================\n");

        return out.toString();
    }
}
