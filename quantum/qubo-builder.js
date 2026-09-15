/**
 * Browser QUBO builder for Showflow Quantum Optimization experiment.
 * Uses engine.js helpers (CONFIG, deriveWindows, overlaps, eligible semantics).
 * Does not mutate live state.
 */
(function (global) {
  "use strict";

  const DEFAULT_WEIGHTS = {
    hardConflict: 1000,
    missingCoverage: 2000,
    bOverlap: 20,
    cProximity: 8,
    workloadBalance: 4,
    zoneTransition: 5,
    roomFamily: 3,
    leadPreference: -10
  };

  function cloneWeights(w) {
    return Object.assign({}, DEFAULT_WEIGHTS, w || {});
  }

  function buildQubo(snapshot, weights) {
    const W = cloneWeights(weights);
    const workers = snapshot.workers || [];
    const shows = snapshot.shows || [];
    const items = flattenShowtimes(shows);
    const cohort = buildFirstSetCohort(items);

    const variables = [];
    const keyToIndex = {};

    for (const cand of items) {
      for (const worker of workers) {
        if (!isAvailable(worker, cand.windows.operationalSpan)) continue;
        const key = worker.id + "|" + cand.show.id + "|" + cand.showtime.id;
        const index = variables.length;
        variables.push({
          index,
          key,
          workerId: worker.id,
          workerName: worker.name,
          showId: cand.show.id,
          showtimeId: cand.showtime.id,
          room: +cand.showtime.room,
          zone: zoneOfRoom(cand.showtime.room),
          guests: cand.guests,
          windows: cand.windows,
          theater: cand.show.theater || CONFIG.DEFAULT_THEATER,
          leadWeight: leadWeight(worker, cand.show.theater),
          preferredZone: worker.preferredZone || null
        });
        keyToIndex[key] = index;
      }
    }

    const linear = new Float64Array(variables.length);
    const quadratic = Object.create(null);
    let constant = 0;

    function addLin(i, c) {
      if (Math.abs(c) < 1e-15) return;
      linear[i] += c;
    }
    function addQuad(i, j, c) {
      if (Math.abs(c) < 1e-15) return;
      if (i > j) {
        const t = i;
        i = j;
        j = t;
      }
      if (i === j) {
        linear[i] += c;
        return;
      }
      const k = i + "," + j;
      quadratic[k] = (quadratic[k] || 0) + c;
    }

    const byShowtime = Object.create(null);
    const requiredByKey = Object.create(null);
    for (const v of variables) {
      const k = v.showId + "|" + v.showtimeId;
      if (!byShowtime[k]) byShowtime[k] = [];
      byShowtime[k].push(v.index);
      requiredByKey[k] = workersRequired(v.guests);
    }
    for (const cand of items) {
      const k = cand.show.id + "|" + cand.showtime.id;
      if (requiredByKey[k] == null) {
        requiredByKey[k] = workersRequired(cand.guests);
        byShowtime[k] = byShowtime[k] || [];
      }
    }

    const Pcov = W.missingCoverage;
    for (const k of Object.keys(byShowtime)) {
      const idxs = byShowtime[k];
      const req = requiredByKey[k] || 0;
      if (req <= 0) {
        for (const i of idxs) addLin(i, Pcov);
        continue;
      }
      constant += Pcov * req * req;
      for (const i of idxs) addLin(i, Pcov * (1 - 2 * req));
      for (let a = 0; a < idxs.length; a++) {
        for (let b = a + 1; b < idxs.length; b++) {
          addQuad(idxs[a], idxs[b], 2 * Pcov);
        }
      }
    }

    const Phard = W.hardConflict;
    for (let a = 0; a < variables.length; a++) {
      const va = variables[a];
      for (let b = a + 1; b < variables.length; b++) {
        const vb = variables[b];
        if (va.workerId !== vb.workerId) continue;

        if (va.showId === vb.showId && va.showtimeId === vb.showtimeId) {
          addQuad(a, b, Phard);
          continue;
        }

        if (isHardConflict(va, vb, cohort)) {
          addQuad(a, b, Phard);
          continue;
        }

        const aO = overlapMinutes(va.windows.aWindow, vb.windows.aWindow);
        if (aO > 0) {
          const fam = familyAffinity(va.room, vb.room);
          addQuad(a, b, -W.roomFamily * (fam / 60));
        }
        const bO = overlapMinutes(va.windows.bWindow, vb.windows.bWindow);
        if (bO > 0) addQuad(a, b, W.bOverlap * (bO / 30));
        const cD = Math.abs(va.windows.cEnd - vb.windows.cEnd);
        if (cD > 0 && cD <= CONFIG.C_PROXIMITY_MINUTES) {
          const tight = CONFIG.C_PROXIMITY_MINUTES - cD + 1;
          addQuad(a, b, W.cProximity * (tight / CONFIG.C_PROXIMITY_MINUTES));
        }
        if (va.zone !== vb.zone) addQuad(a, b, W.zoneTransition);
      }
    }

    const byWorker = Object.create(null);
    for (const v of variables) {
      if (!byWorker[v.workerId]) byWorker[v.workerId] = [];
      byWorker[v.workerId].push(v.index);
    }
    for (const wid of Object.keys(byWorker)) {
      const idxs = byWorker[wid];
      for (let a = 0; a < idxs.length; a++) {
        for (let b = a + 1; b < idxs.length; b++) {
          addQuad(idxs[a], idxs[b], W.workloadBalance * 0.25);
        }
      }
    }

    for (const v of variables) {
      addLin(v.index, W.leadPreference * (v.leadWeight / 10));
      if (v.preferredZone) {
        if (v.preferredZone === v.zone) addLin(v.index, -Math.abs(W.roomFamily));
        else addLin(v.index, Math.abs(W.roomFamily) * 0.5);
      }
    }

    return {
      variables,
      linear,
      quadratic,
      constant,
      weights: W,
      variableCount: variables.length,
      cohort: [...cohort],
      snapshotMeta: {
        workerCount: workers.length,
        showCount: shows.length,
        showtimeCount: items.length
      }
    };
  }

  function isHardConflict(va, vb, cohort) {
    const sa = va.windows;
    const sb = vb.windows;
    if (overlaps(sa.aWindow, sb.aWindow)) {
      const exc =
        cohort.has(va.showtimeId) &&
        cohort.has(vb.showtimeId) &&
        va.guests < CONFIG.FIRST_SET_A_EXCEPTION_GUEST_LIMIT &&
        vb.guests < CONFIG.FIRST_SET_A_EXCEPTION_GUEST_LIMIT;
      if (!exc) return true;
    }
    if (overlaps(sa.aWindow, sb.bWindow) || overlaps(sa.bWindow, sb.aWindow)) return true;
    if (
      (sb.cEnd > sa.aWindow.start && sb.cEnd < sa.aWindow.end) ||
      (sa.cEnd > sb.aWindow.start && sa.cEnd < sb.aWindow.end)
    ) {
      return true;
    }
    if (overlapMinutes(sa.bWindow, sb.bWindow) > CONFIG.B_OVERLAP_TOLERANCE_MINUTES) return true;
    return false;
  }

  function energy(model, assignment) {
    let e = model.constant;
    const n = model.variableCount;
    for (let i = 0; i < n; i++) {
      if (!assignment[i]) continue;
      e += model.linear[i];
      for (let j = i + 1; j < n; j++) {
        if (!assignment[j]) continue;
        const c = model.quadratic[i + "," + j];
        if (c) e += c;
      }
    }
    return e;
  }

  global.ShowflowQuboBuilder = {
    DEFAULT_WEIGHTS,
    cloneWeights,
    buildQubo,
    energy,
    isHardConflict
  };
})(typeof window !== "undefined" ? window : globalThis);
