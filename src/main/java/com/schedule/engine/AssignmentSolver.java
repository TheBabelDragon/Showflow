package com.schedule.engine;

import com.schedule.SchedulingConfig;
import com.schedule.model.CoverageGap;
import com.schedule.model.FillSlot;
import com.schedule.model.OverlapWarning;
import com.schedule.model.SetTime;
import com.schedule.model.Show;
import com.schedule.model.TimeRange;
import com.schedule.model.Worker;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class AssignmentSolver {

    private final OverlapAnalyzer overlapAnalyzer;
    private final CoverageCalculator coverageCalculator;

    public AssignmentSolver() {
        this.overlapAnalyzer = new OverlapAnalyzer();
        this.coverageCalculator = new CoverageCalculator();
    }

    public SolveResult solve(
            List<Worker> workers,
            List<Show> shows
    ) {
        List<FillSlot> assignments = new ArrayList<>();
        List<OverlapWarning> warnings = new ArrayList<>();

        for (Show show : shows) {
            int requiredWorkers =
                    SchedulingConfig.workersRequired(show.getGuests());

            for (SetTime setTime : show.getSetTimes()) {

                Set<String> assignedWorkerIds = new HashSet<>();

                for (int slot = 0; slot < requiredWorkers; slot++) {

                    Worker bestWorker = workers.stream()
                            .filter(worker ->
                                    !assignedWorkerIds.contains(worker.getId()))
                            .filter(worker ->
                                    isAvailable(worker, setTime))
                            .filter(worker ->
                                    isCompatible(worker, setTime, assignments))
                            .min(Comparator.comparingLong(worker ->
                                    scoreWorker(
                                            worker,
                                            setTime,
                                            assignments
                                    ).totalScore()))
                            .orElse(null);

                    if (bestWorker == null) {
                        continue;
                    }

                    FillSlot fillSlot = createFillSlot(
                            bestWorker,
                            show,
                            setTime,
                            slot
                    );

                    List<OverlapWarning> slotWarnings =
                            analyzeAgainstWorkerAssignments(
                                    bestWorker,
                                    fillSlot,
                                    assignments
                            );

                    fillSlotWarnings(fillSlot, slotWarnings);

                    assignments.add(fillSlot);
                    warnings.addAll(slotWarnings);
                    assignedWorkerIds.add(bestWorker.getId());
                }
            }
        }

        List<CoverageGap> gaps =
                coverageCalculator.calculate(shows, assignments);

        return new SolveResult(assignments, gaps, warnings);
    }

    private boolean isAvailable(
            Worker worker,
            SetTime setTime
    ) {
        return worker.isAvailable(setTime.getRange());
    }

    private boolean isCompatible(
            Worker worker,
            SetTime setTime,
            List<FillSlot> assignments
    ) {
        FillSlot candidate = createFillSlot(
                worker,
                null,
                setTime,
                0
        );

        for (FillSlot existing : assignments) {
            if (!existing.getWorkerId().equals(worker.getId())) {
                continue;
            }

            if (hasHardAConflict(existing, candidate)) {
                return false;
            }

            if (hasExcessiveBOverlap(existing, candidate)) {
                return false;
            }
        }

        return true;
    }

    private boolean hasHardAConflict(
            FillSlot existing,
            FillSlot candidate
    ) {
        TimeRange existingA = existing.getARange();
        TimeRange candidateA = candidate.getARange();

        if (existingA != null && candidateA != null
                && existingA.overlaps(candidateA)) {
            return true;
        }

        if (existingA != null && candidate.getBRange() != null
                && existingA.overlaps(candidate.getBRange())) {
            return true;
        }

        if (existingA != null && candidate.getCRange() != null
                && existingA.overlaps(candidate.getCRange())) {
            return true;
        }

        if (candidateA != null && existing.getBRange() != null
                && candidateA.overlaps(existing.getBRange())) {
            return true;
        }

        if (candidateA != null && existing.getCRange() != null
                && candidateA.overlaps(existing.getCRange())) {
            return true;
        }

        return false;
    }

    private boolean hasExcessiveBOverlap(
            FillSlot existing,
            FillSlot candidate
    ) {
        if (existing.getBRange() == null
                || candidate.getBRange() == null) {
            return false;
        }

        return existing.getBRange()
                .overlapMinutes(candidate.getBRange())
                > SchedulingConfig.B_OVERLAP_TOLERANCE_MINUTES;
    }

    private AssignmentScore scoreWorker(
            Worker worker,
            SetTime setTime,
            List<FillSlot> assignments
    ) {
        FillSlot candidate = createFillSlot(
                worker,
                null,
                setTime,
                0
        );

        long bOverlap = 0;
        long cOverlap = 0;
        int existingCount = 0;

        for (FillSlot existing : assignments) {
            if (!existing.getWorkerId().equals(worker.getId())) {
                continue;
            }

            existingCount++;

            if (existing.getBRange() != null
                    && candidate.getBRange() != null) {
                bOverlap += existing.getBRange()
                        .overlapMinutes(candidate.getBRange());
            }

            if (existing.getCRange() != null
                    && candidate.getCRange() != null) {
                cOverlap += existing.getCRange()
                        .overlapMinutes(candidate.getCRange());
            }
        }

        return new AssignmentScore(
                bOverlap,
                cOverlap,
                existingCount
        );
    }

    private List<OverlapWarning> analyzeAgainstWorkerAssignments(
            Worker worker,
            FillSlot candidate,
            List<FillSlot> assignments
    ) {
        List<OverlapWarning> warnings = new ArrayList<>();

        for (FillSlot existing : assignments) {
            if (!existing.getWorkerId().equals(worker.getId())) {
                continue;
            }

            warnings.addAll(
                    overlapAnalyzer.analyze(existing, candidate)
            );
        }

        return warnings;
    }

    private FillSlot createFillSlot(
            Worker worker,
            Show show,
            SetTime setTime,
            int coverageSlot
    ) {
        TimeRange range = setTime.getRange();

        TimeRange aRange = null;
        TimeRange bRange = null;
        TimeRange cRange = null;

        switch (setTime.getType()) {
            case A -> aRange = range;
            case B -> bRange = range;
            case C -> cRange = range;
        }

        return new FillSlot(
                worker.getId(),
                show == null ? "candidate" : show.getId(),
                setTime.getId(),
                aRange,
                bRange,
                cRange,
                coverageSlot
        );
    }

    private void fillSlotWarnings(
            FillSlot slot,
            List<OverlapWarning> warnings
    ) {
        for (OverlapWarning warning : warnings) {
            slot.addWarning(warning);
        }
    }
}