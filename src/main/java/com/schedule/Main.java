package com.schedule;

import com.schedule.engine.AssignmentSolver;
import com.schedule.engine.SolveResult;
import com.schedule.model.Show;
import com.schedule.model.Worker;
import com.schedule.report.DaySheetGenerator;
import com.schedule.report.WorkerReportGenerator;
import com.schedule.ui.AdminConsole;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Interactive single-store session. Store identity is chosen once;
 * all workers and shows share that storeId.
 */
public class Main {

    public static void main(String[] args) {
        System.out.println("============================================================");
        System.out.println("SHOWFLOW");
        System.out.println("Show Scheduling & Staffing Assignment System");
        System.out.println("============================================================");
        System.out.println();

        AdminConsole console = new AdminConsole();

        String storeId = console.readStoreId();
        String dayLabel = console.readDayLabel();
        List<Worker> workers = console.readWorkers(storeId);
        List<Show> shows = console.readShows(storeId);

        AssignmentSolver solver = new AssignmentSolver();

        SolveResult result = solver.solve(workers, shows);

        DaySheetGenerator daySheetGenerator = new DaySheetGenerator();

        String daySheet = daySheetGenerator.generate(
                storeId + " / " + dayLabel,
                workers,
                shows,
                result
        );

        System.out.println();
        System.out.println(daySheet);

        WorkerReportGenerator workerReportGenerator = new WorkerReportGenerator();

        Path outputDirectory = Path.of("output");

        try {
            Files.createDirectories(outputDirectory);

            Files.writeString(
                    outputDirectory.resolve("master-day-sheet.txt"),
                    daySheet
            );

            for (Worker worker : workers) {
                String report = workerReportGenerator.generate(
                        worker,
                        shows,
                        result
                );

                String filename = sanitizeFilename(worker.getName()) + "-schedule.txt";

                Files.writeString(outputDirectory.resolve(filename), report);
            }

            System.out.println(
                    "Reports written to: " + outputDirectory.toAbsolutePath()
            );

        } catch (IOException e) {
            System.err.println("Unable to write reports: " + e.getMessage());
        }

        System.out.println();
        System.out.println("SHOWFLOW COMPLETE");
    }

    private static String sanitizeFilename(String value) {
        return value.trim().replaceAll("[^a-zA-Z0-9._-]+", "_");
    }
}
