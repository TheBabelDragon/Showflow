/* Browser port of src/main/java/com/schedule — Java remains authoritative. */

const CONFIG = {
  GUESTS_PER_WORKER: 10,
  A_MINUTES: 30,
  B_MINUTES: 60,
  C_MINUTES: 60,
  B_OVERLAP_TOLERANCE_MINUTES: 30,
  B_OVERLAP_PENALTY: 10,
  C_OVERLAP_PENALTY: 20
};

function workersRequired(guests) {
  if (guests <= 0) return 0;
  return Math.floor((guests + CONFIG.GUESTS_PER_WORKER - 1) / CONFIG.GUESTS_PER_WORKER);
}

function parseHm(value) {
  const text = String(value || "").trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function formatHm(minutes) {
  const wrapped = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
}

function durationFor(type) {
  if (type === "A") return CONFIG.A_MINUTES;
  return CONFIG.B_MINUTES;
}

function rangeFromType(startHm, type) {
  const start = parseHm(startHm);
  if (start == null) return null;
  return { start, end: start + durationFor(type) };
}

function rangeLabel(range) {
  if (!range) return "";
  return formatHm(range.start) + " - " + formatHm(range.end);
}

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

function containsRange(window, required) {
  return required.start >= window.start && required.end <= window.end;
}

function overlapMinutes(a, b) {
  if (!overlaps(a, b)) return 0;
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return end - start;
}

function isAvailable(worker, setRange) {
  if (!worker.availability || worker.availability.length === 0) return true;
  return worker.availability.some((window) => {
    const range = { start: parseHm(window.start), end: parseHm(window.end) };
    if (range.start == null || range.end == null || range.start >= range.end) return false;
    return containsRange(range, setRange);
  });
}

function createFillSlot(worker, show, setTime, coverageSlot) {
  const range = rangeFromType(setTime.start, setTime.type);
  return {
    workerId: worker.id,
    showId: show ? show.id : "candidate",
    setTimeId: setTime.id,
    aRange: setTime.type === "A" ? range : null,
    bRange: setTime.type === "B" ? range : null,
    cRange: setTime.type === "C" ? range : null,
    coverageSlot,
    warnings: []
  };
}

function slotRange(slot) {
  return slot.aRange || slot.bRange || slot.cRange;
}

function slotType(slot) {
  if (slot.aRange) return "A";
  if (slot.bRange) return "B";
  return "C";
}

function hasHardAConflict(existing, candidate) {
  const existingA = existing.aRange;
  const candidateA = candidate.aRange;
  if (existingA && candidateA && overlaps(existingA, candidateA)) return true;
  if (existingA && candidate.bRange && overlaps(existingA, candidate.bRange)) return true;
  if (existingA && candidate.cRange && overlaps(existingA, candidate.cRange)) return true;
  if (candidateA && existing.bRange && overlaps(candidateA, existing.bRange)) return true;
  if (candidateA && existing.cRange && overlaps(candidateA, existing.cRange)) return true;
  return false;
}

function hasExcessiveBOverlap(existing, candidate) {
  if (!existing.bRange || !candidate.bRange) return false;
  return overlapMinutes(existing.bRange, candidate.bRange) > CONFIG.B_OVERLAP_TOLERANCE_MINUTES;
}

function isCompatible(worker, setTime, assignments) {
  const candidate = createFillSlot(worker, null, setTime, 0);
  for (const existing of assignments) {
    if (existing.workerId !== worker.id) continue;
    if (hasHardAConflict(existing, candidate)) return false;
    if (hasExcessiveBOverlap(existing, candidate)) return false;
  }
  return true;
}

function scoreWorker(worker, setTime, assignments) {
  const candidate = createFillSlot(worker, null, setTime, 0);
  let bOverlap = 0;
  let cOverlap = 0;
  let existingCount = 0;
  for (const existing of assignments) {
    if (existing.workerId !== worker.id) continue;
    existingCount += 1;
    if (existing.bRange && candidate.bRange) {
      bOverlap += overlapMinutes(existing.bRange, candidate.bRange);
    }
    if (existing.cRange && candidate.cRange) {
      cOverlap += overlapMinutes(existing.cRange, candidate.cRange);
    }
  }
  return bOverlap * CONFIG.B_OVERLAP_PENALTY
    + cOverlap * CONFIG.C_OVERLAP_PENALTY
    + existingCount;
}

function analyzePair(existing, candidate, existingRange, candidateRange, type) {
  if (!existingRange || !candidateRange) return null;
  const overlap = overlapMinutes(existingRange, candidateRange);
  if (overlap <= 0) return null;
  if (type === "A") {
    return {
      workerId: candidate.workerId,
      existingAssignmentId: existing.setTimeId,
      newAssignmentId: candidate.setTimeId,
      existingType: type,
      newType: type,
      overlapMinutes: overlap,
      message: "A assignment conflicts with the protected A window"
    };
  }
  if (type === "B" && overlap > CONFIG.B_OVERLAP_TOLERANCE_MINUTES) {
    return {
      workerId: candidate.workerId,
      existingAssignmentId: existing.setTimeId,
      newAssignmentId: candidate.setTimeId,
      existingType: type,
      newType: type,
      overlapMinutes: overlap,
      message: "B overlap exceeds the allowed 30-minute tolerance"
    };
  }
  if (type === "C") {
    return {
      workerId: candidate.workerId,
      existingAssignmentId: existing.setTimeId,
      newAssignmentId: candidate.setTimeId,
      existingType: type,
      newType: type,
      overlapMinutes: overlap,
      message: "C assignment overlaps another C assignment"
    };
  }
  return null;
}

function analyzeAgainstWorkerAssignments(worker, candidate, assignments) {
  const warnings = [];
  for (const existing of assignments) {
    if (existing.workerId !== worker.id) continue;
    const pairs = [
      analyzePair(existing, candidate, existing.aRange, candidate.aRange, "A"),
      analyzePair(existing, candidate, existing.bRange, candidate.bRange, "B"),
      analyzePair(existing, candidate, existing.cRange, candidate.cRange, "C")
    ];
    for (const warning of pairs) {
      if (warning) warnings.push(warning);
    }
  }
  return warnings;
}

function solve(workers, shows) {
  const assignments = [];
  const warnings = [];
  for (const show of shows) {
    const required = workersRequired(show.guests);
    for (const setTime of show.setTimes) {
      const setRange = rangeFromType(setTime.start, setTime.type);
      if (!setRange) continue;
      const assignedWorkerIds = new Set();
      for (let slot = 0; slot < required; slot += 1) {
        let best = null;
        let bestScore = Number.POSITIVE_INFINITY;
        for (const worker of workers) {
          if (assignedWorkerIds.has(worker.id)) continue;
          if (!isAvailable(worker, setRange)) continue;
          if (!isCompatible(worker, setTime, assignments)) continue;
          const score = scoreWorker(worker, setTime, assignments);
          if (score < bestScore) {
            bestScore = score;
            best = worker;
          }
        }
        if (!best) continue;
        const fillSlot = createFillSlot(best, show, setTime, slot);
        const slotWarnings = analyzeAgainstWorkerAssignments(best, fillSlot, assignments);
        fillSlot.warnings = slotWarnings;
        assignments.push(fillSlot);
        warnings.push(...slotWarnings);
        assignedWorkerIds.add(best.id);
      }
    }
  }
  const gaps = [];
  for (const show of shows) {
    const required = workersRequired(show.guests);
    for (const setTime of show.setTimes) {
      const assigned = new Set(
        assignments
          .filter((slot) => slot.showId === show.id && slot.setTimeId === setTime.id)
          .map((slot) => slot.workerId)
      ).size;
      if (assigned < required) {
        gaps.push({
          showId: show.id,
          setTimeId: setTime.id,
          required,
          assigned,
          missing: required - assigned
        });
      }
    }
  }
  const gapCount = gaps.reduce((sum, gap) => sum + gap.missing, 0);
  return {
    assignments,
    coverageGaps: gaps,
    warnings,
    assignmentCount: assignments.length,
    gapCount,
    fullyCovered: gaps.length === 0
  };
}

function generateDaySheet(dayLabel, workers, shows, result) {
  const workerById = Object.fromEntries(workers.map((worker) => [worker.id, worker]));
  const showById = Object.fromEntries(shows.map((show) => [show.id, show]));
  const lines = [];
  lines.push("============================================================");
  lines.push("SHOWFLOW MASTER DAY SHEET");
  lines.push("============================================================");
  lines.push("DAY: " + dayLabel);
  lines.push("");
  lines.push("SYSTEM SUMMARY");
  lines.push("------------------------------------------------------------");
  lines.push("Guests per worker target: " + CONFIG.GUESTS_PER_WORKER);
  lines.push("Assignments: " + result.assignmentCount);
  lines.push("Coverage gaps: " + result.gapCount);
  lines.push("Warnings: " + result.warnings.length);
  lines.push("Fully covered: " + result.fullyCovered);
  lines.push("");
  lines.push("SHOW COVERAGE");
  lines.push("------------------------------------------------------------");
  for (const show of shows) {
    const required = workersRequired(show.guests);
    lines.push(show.name + " [" + show.id + "] - " + show.guests + " guests, " + required + " workers per set");
    for (const setTime of show.setTimes) {
      const assigned = new Set(
        result.assignments
          .filter((slot) => slot.showId === show.id && slot.setTimeId === setTime.id)
          .map((slot) => slot.workerId)
      ).size;
      const range = rangeFromType(setTime.start, setTime.type);
      lines.push("  " + setTime.type + " " + rangeLabel(range) + " -> " + assigned + "/" + required);
    }
    lines.push("");
  }
  lines.push("MASTER ASSIGNMENT SCHEDULE");
  lines.push("------------------------------------------------------------");
  const sorted = result.assignments.slice().sort((a, b) => {
    const aStart = slotRange(a).start;
    const bStart = slotRange(b).start;
    if (aStart !== bStart) return aStart - bStart;
    if (a.showId !== b.showId) return a.showId.localeCompare(b.showId);
    return a.setTimeId.localeCompare(b.setTimeId);
  });
  for (const slot of sorted) {
    const worker = workerById[slot.workerId];
    const show = showById[slot.showId];
    const workerName = worker ? worker.name : slot.workerId;
    const showName = show ? show.name : slot.showId;
    const type = slotType(slot);
    const range = rangeLabel(slotRange(slot));
    const warn = slot.warnings.length ? " [WARNINGS]" : "";
    const row = workerName.padEnd(12)
      + showName.padEnd(24)
      + type.padEnd(4)
      + range.padEnd(17)
      + "coverage-slot=" + slot.coverageSlot
      + warn;
    lines.push(row);
  }
  lines.push("");
  lines.push("COVERAGE GAPS");
  lines.push("------------------------------------------------------------");
  if (result.coverageGaps.length === 0) {
    lines.push("NONE");
  } else {
    for (const gap of result.coverageGaps) {
      const show = showById[gap.showId];
      lines.push((show ? show.name : gap.showId) + " / " + gap.setTimeId + ": missing " + gap.missing + " worker(s)");
    }
  }
  lines.push("");
  lines.push("WARNINGS");
  lines.push("------------------------------------------------------------");
  if (result.warnings.length === 0) {
    lines.push("NONE");
  } else {
    for (const warning of result.warnings) {
      lines.push("- WARNING: " + warning.message + " (" + warning.overlapMinutes + " min overlap)");
    }
  }
  lines.push("");
  lines.push("============================================================");
  lines.push("END MASTER DAY SHEET");
  lines.push("============================================================");
  return lines.join("\n");
}

function generateWorkerSheet(worker, shows, result) {
  const showById = Object.fromEntries(shows.map((show) => [show.id, show]));
  const assignments = result.assignments
    .filter((slot) => slot.workerId === worker.id)
    .slice()
    .sort((a, b) => slotRange(a).start - slotRange(b).start);
  const lines = [];
  lines.push("============================================================");
  lines.push("SHOWFLOW WORKER SCHEDULE");
  lines.push("============================================================");
  lines.push("WORKER: " + worker.name + " [" + worker.id + "]");
  lines.push("");
  lines.push("ASSIGNMENTS");
  lines.push("------------------------------------------------------------");
  if (assignments.length === 0) {
    lines.push("NONE");
  } else {
    for (const slot of assignments) {
      const show = showById[slot.showId];
      lines.push("- " + (show ? show.name : slot.showId) + " / " + slot.setTimeId + " / " + slotType(slot) + " / " + rangeLabel(slotRange(slot)));
      for (const warning of slot.warnings) {
        lines.push("    WARNING: " + warning.message + " (" + warning.overlapMinutes + " min overlap)");
      }
    }
  }
  lines.push("");
  lines.push("TOTAL ASSIGNMENTS: " + assignments.length);
  const workerWarnings = result.warnings.filter((warning) => warning.workerId === worker.id);
  lines.push("");
  lines.push("OVERLAP WARNINGS");
  lines.push("------------------------------------------------------------");
  if (workerWarnings.length === 0) {
    lines.push("NONE");
  } else {
    for (const warning of workerWarnings) {
      lines.push("- WARNING: " + warning.message + " (" + warning.overlapMinutes + " min overlap)");
    }
  }
  lines.push("");
  lines.push("============================================================");
  lines.push("END WORKER SCHEDULE");
  lines.push("============================================================");
  return lines.join("\n");
}

function sampleDay() {
  return {
    dayLabel: "Saturday Floor",
    workers: [
      { id: "w1", name: "Ava", availability: [{ start: "10:00", end: "22:00" }] },
      { id: "w2", name: "Ben", availability: [{ start: "12:00", end: "23:00" }] },
      { id: "w3", name: "Cara", availability: [{ start: "10:00", end: "18:00" }] },
      { id: "w4", name: "Drew", availability: [{ start: "16:00", end: "23:00" }] },
      { id: "w5", name: "Eden", availability: [] }
    ],
    shows: [
      {
        id: "s1",
        name: "Main Stage",
        guests: 40,
        setTimes: [
          { id: "main-a1", type: "A", start: "14:00" },
          { id: "main-b1", type: "B", start: "18:00" },
          { id: "main-c1", type: "C", start: "20:00" }
        ]
      },
      {
        id: "s2",
        name: "Side Room",
        guests: 22,
        setTimes: [
          { id: "side-a1", type: "A", start: "15:00" },
          { id: "side-b1", type: "B", start: "17:30" },
          { id: "side-c1", type: "C", start: "19:30" }
        ]
      }
    ]
  };
}
