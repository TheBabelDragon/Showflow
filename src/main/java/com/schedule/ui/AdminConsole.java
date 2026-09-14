package com.schedule.ui;

import com.schedule.model.Show;
import com.schedule.model.Showtime;
import com.schedule.model.TimeRange;
import com.schedule.model.Worker;
import com.schedule.model.Zone;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;

public class AdminConsole {

    private final Scanner scanner;

    public AdminConsole() {
        this.scanner = new Scanner(System.in);
    }

    public List<Worker> readWorkers() {
        List<Worker> workers = new ArrayList<>();

        int count = readInt("Number of workers: ", 0);

        for (int i = 0; i < count; i++) {
            System.out.println("\nWorker " + (i + 1));

            String id = readRequired("Worker ID: ");
            String name = readRequired("Worker name: ");

            Worker worker = new Worker(id, name);

            String zone = readOptional("Preferred zone (MAIN/SIDE/blank): ");
            if ("MAIN".equalsIgnoreCase(zone)) {
                worker.setPreferredZone(Zone.MAIN);
            } else if ("SIDE".equalsIgnoreCase(zone)) {
                worker.setPreferredZone(Zone.SIDE);
            }

            int leadWeight = readInt("Lead weight 0-10 (default theater): ", 0);
            if (leadWeight <= 10) {
                worker.setLeadWeight(null, leadWeight);
            }

            int availabilityCount =
                    readInt("Number of availability windows: ", 0);

            for (int j = 0; j < availabilityCount; j++) {
                System.out.println("  Availability window " + (j + 1));

                LocalTime start = readTime("  Start (HH:mm): ");
                LocalTime end = readTime("  End (HH:mm): ");

                worker.addAvailability(new TimeRange(start, end));
            }

            workers.add(worker);
        }

        return workers;
    }

    public List<Show> readShows() {
        List<Show> shows = new ArrayList<>();

        int count = readInt("Number of shows: ", 0);

        for (int i = 0; i < count; i++) {
            System.out.println("\nShow " + (i + 1));

            String id = readRequired("Show ID: ");
            String name = readRequired("Show name: ");
            String theater = readOptional("Theater (blank = default): ");
            int guests = readInt("Guest count: ", 0);

            Show show = theater.isBlank()
                    ? new Show(id, name, guests)
                    : new Show(id, name, guests, theater);

            int showtimeCount = readInt("Number of showtimes: ", 0);

            for (int j = 0; j < showtimeCount; j++) {
                System.out.println("  Showtime " + (j + 1));

                String showtimeId = readRequired("  Showtime ID: ");
                int room = readInt("  Room (1-7): ", 1);
                LocalTime start = readTime("  Start (HH:mm): ");
                int duration = readInt("  Duration minutes: ", 1);

                show.addShowtime(new Showtime(showtimeId, room, start, duration));
            }

            shows.add(show);
        }

        return shows;
    }

    public String readDayLabel() {
        return readRequired("Day label: ");
    }

    private String readRequired(String prompt) {
        while (true) {
            System.out.print(prompt);
            String value = scanner.nextLine().trim();
            if (!value.isEmpty()) {
                return value;
            }
            System.out.println("Value is required.");
        }
    }

    private String readOptional(String prompt) {
        System.out.print(prompt);
        return scanner.nextLine().trim();
    }

    private int readInt(String prompt, int minimum) {
        while (true) {
            System.out.print(prompt);
            String input = scanner.nextLine().trim();
            try {
                int value = Integer.parseInt(input);
                if (value >= minimum) {
                    return value;
                }
                System.out.println("Value must be at least " + minimum + ".");
            } catch (NumberFormatException e) {
                System.out.println("Enter a valid integer.");
            }
        }
    }

    private LocalTime readTime(String prompt) {
        while (true) {
            System.out.print(prompt);
            String input = scanner.nextLine().trim();
            try {
                return LocalTime.parse(input);
            } catch (Exception e) {
                System.out.println("Enter time as HH:mm.");
            }
        }
    }
}
