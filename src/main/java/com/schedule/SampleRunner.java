package com.schedule;

import com.schedule.engine.AssignmentSolver;
import com.schedule.engine.SolveResult;
import com.schedule.model.RoutePolicy;
import com.schedule.model.ScheduleRevision;
import com.schedule.model.Show;
import com.schedule.model.Showtime;
import com.schedule.model.Store;
import com.schedule.model.StoreOutputs;
import com.schedule.model.StoreSchedule;
import com.schedule.model.StoreSources;
import com.schedule.model.TimeRange;
import com.schedule.model.Worker;
import com.schedule.model.Zone;
import com.schedule.report.StoreReport;
import com.schedule.report.StoreReportGenerator;
import com.schedule.source.ManualShowtimeSource;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

/**
 * Sample day for STORE-001 (Mesa North). Demonstrates store-scoped solve
 * + multi-representation report from one ScheduleRevision.
 */
public final class SampleRunner {

    public static final String STORE_ID = "STORE-001";

    public static void main(String[] args) {
        Store store = new Store(
                STORE_ID,
                "Mesa North",
                "MESA-N",
                "America/Phoenix",
                "123 Demo Way, Mesa AZ",
                StoreSources.manualOnly(),
                StoreOutputs.forStore(STORE_ID),
                RoutePolicy.defaults()
        );

        Worker ava = new Worker(STORE_ID, "w1", "Ava",
                List.of(new TimeRange(LocalTime.of(10, 0), LocalTime.of(22, 0))),
                Map.of("default", 9),
                Zone.MAIN);
        Worker ben = new Worker(STORE_ID, "w2", "Ben",
                List.of(new TimeRange(LocalTime.of(12, 0), LocalTime.of(23, 0))),
                Map.of("default", 7),
                Zone.MAIN);
        Worker cara = new Worker(STORE_ID, "w3", "Cara",
                List.of(new TimeRange(LocalTime.of(10, 0), LocalTime.of(18, 0))),
                Map.of("default", 8),
                Zone.SIDE);
        Worker drew = new Worker(STORE_ID, "w4", "Drew",
                List.of(new TimeRange(LocalTime.of(16, 0), LocalTime.of(23, 0))),
                Map.of("default", 4),
                Zone.SIDE);
        Worker eden = new Worker(STORE_ID, "w5", "Eden",
                List.of(), Map.of("default", 6), null);

        Show main = new Show(STORE_ID, "s1", "Main Stage", 8);
        main.addShowtime(new Showtime(STORE_ID, "main-open", 1, LocalTime.of(14, 0), 60));
        main.addShowtime(new Showtime(STORE_ID, "main-eve", 2, LocalTime.of(18, 0), 90));

        Show side = new Show(STORE_ID, "s2", "Side Room", 7);
        side.addShowtime(new Showtime(STORE_ID, "side-open", 5, LocalTime.of(14, 0), 60));
        side.addShowtime(new Showtime(STORE_ID, "side-eve", 6, LocalTime.of(17, 30), 60));

        Show gallery = new Show(STORE_ID, "s3", "Gallery", 22);
        gallery.addShowtime(new Showtime(STORE_ID, "gallery-eve", 3, LocalTime.of(19, 0), 60));

        List<Worker> workers = List.of(ava, ben, cara, drew, eden);
        List<Show> shows = new ManualShowtimeSource(
                List.of(main, side, gallery)
        ).fetch(store);

        LocalDate scheduleDate = LocalDate.of(2026, 9, 19);

        StoreSchedule schedule = new StoreSchedule(
                store, scheduleDate, workers, shows, Instant.now(), "sample-v1"
        );

        SolveResult result = new AssignmentSolver().solve(
                schedule.getWorkers(), schedule.getShows()
        );

        ScheduleRevision revision = new ScheduleRevision(
                store.getId(),
                Instant.now(),
                "manual",
                schedule.getSourceRevision(),
                result
        );

        StoreReport report = new StoreReportGenerator().generate(schedule, revision);

        System.out.println(report.getDaySheetText());
        System.out.println("--- JSON (" + store.getOutputs().getApiPath() + ") ---");
        System.out.println(report.getJsonPayload());
        System.out.println("--- iCal (" + store.getOutputs().getIcalPath() + ") ---");
        System.out.println(report.getIcalPayload());
        System.out.println("Store: " + store.getId()
                + "  date: " + schedule.getScheduleDate()
                + "  revision: " + revision.getRevisionId());
    }
}
