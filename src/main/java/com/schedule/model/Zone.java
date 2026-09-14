package com.schedule.model;

import com.schedule.SchedulingConfig;

public enum Zone {
    MAIN,
    SIDE;

    public static Zone ofRoom(int roomNumber) {
        if (roomNumber < SchedulingConfig.MIN_ROOM
                || roomNumber > SchedulingConfig.MAX_ROOM) {
            throw new IllegalArgumentException(
                    "Room must be " + SchedulingConfig.MIN_ROOM
                            + "-" + SchedulingConfig.MAX_ROOM
            );
        }

        return roomNumber <= SchedulingConfig.MAIN_ZONE_LAST_ROOM
                ? MAIN
                : SIDE;
    }

    public static boolean sameFamily(int leftRoom, int rightRoom) {
        return ofRoom(leftRoom) == ofRoom(rightRoom);
    }

    public static boolean preferredPair(int leftRoom, int rightRoom) {
        int a = Math.min(leftRoom, rightRoom);
        int b = Math.max(leftRoom, rightRoom);
        return (a == 1 && (b == 2 || b == 3))
                || (a == 2 && b == 4)
                || (a == 5 && b == 6)
                || (a == 6 && b == 7);
    }
}
