package com.schedule;

import com.schedule.engine.AssignmentSolver;
import com.schedule.engine.SolveResult;
import com.schedule.model.Show;
import com.schedule.model.Showtime;
import com.schedule.model.TimeRange;
import com.schedule.model.Worker;
import com.schedule.model.Zone;
import com.schedule.report.DaySheetGenerator;

import java.time.LocalTime;
import java.util.List;
import java.util.Map;

public final class SampleRunner {

    public static void main(String[] args) {
        Worker ava = new Worker("w1", "Ava",
                List.of(new TimeRange(LocalTime.of(10, 0), LocalTime.of(22, 0))),
                Map.of("default", 9),
                Zone.MAIN);
        Worker ben = new Worker("w2", "Ben",
                List.of(new TimeRange(LocalTime.of(12, 0), LocalTime.of(23, 0))),
                Map.of("default", 7),
                Zone.MAIN);
        Worker cara = new Worker("w3", "Cara",
                List.of(new TimeRange(LocalTime.of(10, 0), LocalTime.of(18, 0))),
                Map.of("default", 8),
                Zone.SIDE);
        Worker drew = new Worker("w4", "Drew",
                List.of(new TimeRange(LocalTime.of(16, 0), LocalTime.of(23, 0))),
                Map.of("default", 4),
                Zone.SIDE);
        Worker eden = new Worker("w5", "Eden", List.of(), Map.of("default", 6), null);

        Show main = new Show("s1", "Main Stage", 8);
        main.addShowtime(new Showtime("main-open", 1, LocalTime.of(14, 0), 60));
        main.addShowtime(new Showtime("main-eve", 2, LocalTime.of(18, 0), 90));

        Show side = new Show("s2", "Side Room", 7);
        side.addShowtime(new Showtime("side-open", 5, LocalTime.of(14, 0), 60));
        side.addShowtime(new Showtime("side-eve", 6, LocalTime.of(17, 30), 60));

        Show gallery = new Show("s3", "Gallery", 22);
        gallery.addShowtime(new Showtime("gallery-eve", 3, LocalTime.of(19, 0), 60));

        List<Worker> workers = List.of(ava, ben, cara, drew, eden);
        List<Show> shows = List.of(main, side, gallery);

        SolveResult result = new AssignmentSolver().solve(workers, shows);
        System.out.println(new DaySheetGenerator().generate(
                "Saturday Floor", workers, shows, result
        ));
    }
}
