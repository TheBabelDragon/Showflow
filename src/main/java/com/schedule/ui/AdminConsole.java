package com.schedule.ui;

import com.schedule.model.SetTime;
import com.schedule.model.Show;
import com.schedule.model.TimeRange;
import com.schedule.model.Worker;

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

            int availabilityCount =
                    readInt("Number of availability windows: ", 0);

            for (int j = 0; j < availabilityCount; j++) {
                System.out.println(
                        "  Availability window " + (j + 1)
                );

                LocalTime start =
                        readTime("  Start (HH:mm): ");

                LocalTime end =
                        readTime("  End (HH:mm): ");

                worker.addAvailability(
                        new TimeRange(start, end)
                );
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
            int guests = readInt("Guest count: ", 0);

            Show show = new Show(id, name, guests);

            int setCount =
                    readInt("Number of set times: ", 0);

            for (int j = 0; j < setCount; j++) {
                System.out.println(
                        "  Set time " + (j + 1)
                );

                String setId =
                        readRequired("  Set ID: ");

                SetTime.Type type =
                        readSetType("  Type (A/B/C): ");

                LocalTime start =
                        readTime("  Start (HH:mm): ");

                show.addSetTime(
                        new SetTime(
                                setId,
                                type,
                                start
                        )
                );
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

    private int readInt(
            String prompt,
            int minimum
    ) {
        while (true) {
            System.out.print(prompt);

            String input = scanner.nextLine().trim();

            try {
                int value = Integer.parseInt(input);

                if (value >= minimum) {
                    return value;
                }

                System.out.println(
                        "Value must be at least " + minimum + "."
                );

            } catch (NumberFormatException e) {
                System.out.println(
                        "Enter a valid integer."
                );
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
                System.out.println(
                        "Enter time as HH:mm."
                );
            }
        }
    }

    private SetTime.Type readSetType(String prompt) {
        while (true) {
            System.out.print(prompt);

            String input =
                    scanner.nextLine()
                            .trim()
                            .toUpperCase();

            try {
                return SetTime.Type.valueOf(input);

            } catch (IllegalArgumentException e) {
                System.out.println(
                        "Enter A, B, or C."
                );
            }
        }
    }
}