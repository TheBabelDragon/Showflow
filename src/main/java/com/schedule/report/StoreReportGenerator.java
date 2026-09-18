package com.schedule.report;

import com.schedule.engine.SolveResult;
import com.schedule.model.Assignment;
import com.schedule.model.ScheduleRevision;
import com.schedule.model.Show;
import com.schedule.model.Store;
import com.schedule.model.StoreSchedule;
import com.schedule.model.Worker;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Builds day-sheet text, JSON API body, and store-level iCalendar
 * from a single ScheduleRevision — no independent recomputation.
 */
public final class StoreReportGenerator {

    private final DaySheetGenerator daySheetGenerator = new DaySheetGenerator();

    public StoreReport generate(StoreSchedule schedule, ScheduleRevision revision) {
        Objects.requireNonNull(schedule, "schedule");
        Objects.requireNonNull(revision, "revision");
        if (!schedule.getStore().getId().equals(revision.getStoreId())) {
            throw new IllegalArgumentException("Store and revision storeId mismatch");
        }

        Store store = schedule.getStore();
        List<Worker> workers = schedule.getWorkers();
        List<Show> shows = schedule.getShows();
        SolveResult result = revision.getResult();

        String dayLabel = store.getName() + " — " + store.getId()
                + "  " + schedule.getScheduleDate()
                + "  rev " + revision.getRevisionId();
        String daySheet = daySheetGenerator.generate(dayLabel, workers, shows, result);
        String json = buildJson(store, schedule, revision, workers, shows, result);
        String ical = buildIcal(store, schedule, revision, workers, shows, result);

        return new StoreReport(store, revision, daySheet, json, ical);
    }

    private String buildJson(
            Store store,
            StoreSchedule schedule,
            ScheduleRevision revision,
            List<Worker> workers,
            List<Show> shows,
            SolveResult result
    ) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\n");
        sb.append("  \"store\": {\n");
        sb.append("    \"id\": \"").append(esc(store.getId())).append("\",\n");
        sb.append("    \"name\": \"").append(esc(store.getName())).append("\",\n");
        sb.append("    \"timezone\": \"").append(esc(store.getTimezone())).append("\"\n");
        sb.append("  },\n");
        sb.append("  \"scheduleDate\": \"").append(schedule.getScheduleDate()).append("\",\n");
        sb.append("  \"generatedAt\": \"").append(revision.getGeneratedAt()).append("\",\n");
        sb.append("  \"revisionId\": \"").append(esc(revision.getRevisionId())).append("\",\n");
        sb.append("  \"scheduleHash\": \"").append(esc(revision.getScheduleHash())).append("\",\n");
        sb.append("  \"source\": \"").append(esc(revision.getSource())).append("\",\n");
        sb.append("  \"status\": {\n");
        sb.append("    \"fullyCovered\": ").append(result.isFullyCovered()).append(",\n");
        sb.append("    \"assignments\": ").append(result.assignmentCount()).append(",\n");
        sb.append("    \"coverageGaps\": ").append(result.gapCount()).append(",\n");
        sb.append("    \"warnings\": ").append(result.getWarnings().size()).append("\n");
        sb.append("  },\n");
        sb.append("  \"shows\": ").append(shows.size()).append(",\n");
        sb.append("  \"workers\": ").append(workers.size()).append(",\n");
        sb.append("  \"assignmentCount\": ").append(result.assignmentCount()).append("\n");
        sb.append("}\n");
        return sb.toString();
    }

    private String buildIcal(
            Store store,
            StoreSchedule schedule,
            ScheduleRevision revision,
            List<Worker> workers,
            List<Show> shows,
            SolveResult result
    ) {
        Map<String, Worker> workerById = workers.stream()
                .collect(Collectors.toMap(Worker::getId, w -> w));
        Map<String, Show> showById = shows.stream()
                .collect(Collectors.toMap(Show::getId, s -> s));

        ZoneId zone = ZoneId.of(store.getTimezone());
        DateTimeFormatter icalFmt = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss");

        StringBuilder sb = new StringBuilder();
        sb.append("BEGIN:VCALENDAR\r\n");
        sb.append("VERSION:2.0\r\n");
        sb.append("PRODID:-//Showflow//").append(store.getId()).append("//EN\r\n");
        sb.append("X-WR-CALNAME:Showflow ").append(store.getName()).append("\r\n");
        sb.append("X-SHOWFLOW-REVISION:").append(revision.getRevisionId()).append("\r\n");
        sb.append("X-SHOWFLOW-DATE:").append(schedule.getScheduleDate()).append("\r\n");

        for (Assignment a : result.getAssignments()) {
            Worker worker = workerById.get(a.getWorkerId());
            Show show = showById.get(a.getShowId());
            String workerName = worker == null ? a.getWorkerId() : worker.getName();
            String showName = show == null ? a.getShowId() : show.getName();
            String role = a.isLead() ? "Lead" : "Coverage";

            ZonedDateTime start = ZonedDateTime.of(
                    schedule.getScheduleDate(),
                    a.getAWindow().end(),
                    zone
            );
            ZonedDateTime end = ZonedDateTime.of(
                    schedule.getScheduleDate(),
                    a.getCEnd(),
                    zone
            );

            String uid = store.getId() + "-worker-" + a.getWorkerId()
                    + "-" + a.getShowtimeId() + "-slot" + a.getCoverageSlot();

            sb.append("BEGIN:VEVENT\r\n");
            sb.append("UID:").append(uid).append("\r\n");
            sb.append("DTSTART;TZID=").append(store.getTimezone()).append(":")
                    .append(start.format(icalFmt)).append("\r\n");
            sb.append("DTEND;TZID=").append(store.getTimezone()).append(":")
                    .append(end.format(icalFmt)).append("\r\n");
            sb.append("SUMMARY:").append(showName)
                    .append(" — Room ").append(a.getRoomNumber())
                    .append(" (").append(workerName).append(")\r\n");
            sb.append("LOCATION:").append(store.getName())
                    .append(" (").append(store.getId()).append(")\r\n");
            sb.append("DESCRIPTION:").append(role).append("\r\n");
            sb.append("END:VEVENT\r\n");
        }

        sb.append("END:VCALENDAR\r\n");
        return sb.toString();
    }

    private static String esc(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n");
    }
}
