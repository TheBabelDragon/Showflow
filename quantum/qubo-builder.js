/**
 * Browser QUBO builder for Showflow Quantum Optimization experiment.
 * Consumes an explicit optimization parameter / policy model.
 * Uses engine.js helpers (CONFIG, deriveWindows, overlaps, eligible semantics).
 * Does not mutate live state. Does not read UI elements.
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

  function resolveConfig(weightsOrParams) {
    if (global.ShowflowOptimizationParams) {
      const P = global.ShowflowOptimizationParams;
      if (weightsOrParams && weightsOrParams.params) {
        return P.toBuilderConfig(weightsOrParams.params);
      }
      if (weightsOrParams && (weightsOrParams.maxBOverlapMinutes != null || weightsOrParams.bOverlapPenalty != null)) {
        return P.toBuilderConfig(weightsOrParams);
      }
      if (weightsOrParams && weightsOrParams.hardConflict != null) {
        const base = P.defaults();
        if (weightsOrParams.hardConflict != null) base.hardConflictPenalty = weightsOrParams.hardConflict;
        if (weightsOrParams.missingCoverage != null) base.missingCoveragePenalty = weightsOrParams.missingCoverage;
        if (weightsOrParams.bOverlap != null) base.bOverlapPenalty = weightsOrParams.bOverlap;
        if (weightsOrParams.cProximity != null) base.cProximityPenalty = weightsOrParams.cProximity;
        if (weightsOrParams.workloadBalance != null) base.workloadBalanceWeight = weightsOrParams.workloadBalance;
        if (weightsOrParams.zoneTransition != null) base.zoneTransitionWeight = weightsOrParams.zoneTransition;
        if (weightsOrParams.roomFamily != null) base.roomFamilyWeight = weightsOrParams.roomFamily;
        if (weightsOrParams.leadPreference != null) base.leadPreferenceWeight = weightsOrParams.leadPreference;
        return P.toBuilderConfig(base);
      }
      return P.toBuilderConfig(P.defaults());
    }
    const W = Object.assign({}, DEFAULT_WEIGHTS, weightsOrParams || {});
    return {
      hardConflict: W.hardConflict,
      missingCoverage: W.missingCoverage,
      bOverlap: W.bOverlap,
      cProximity: W.cProximity,
      workloadBalance: W.workloadBalance,
      zoneTransition: W.zoneTransition,
      roomFamily: W.roomFamily,
      leadPreference: W.leadPreference,
      maxAOverlapMinutes: 0,
      maxBOverlapMinutes: (typeof CONFIG !== "undefined" && CONFIG.B_OVERLAP_TOLERANCE_MINUTES) || 30,
      preferredBOverlapMinutes: 0,
      bOverlapCurve: "linear",
      cProximityMinutes: (typeof CONFIG !== "undefined" && CONFIG.C_PROXIMITY_MINUTES) || 15,
      firstSetGuestLimit: (typeof CONFIG !== "undefined" && CONFIG.FIRST_SET_A_EXCEPTION_GUEST_LIMIT) || 10,
      params: null
    };
  }

  function cloneWeights(w) {
    return Object.assign({}, DEFAULT_WEIGHTS, w || {});
  }

  function bOverlapSoftCoeff(excessMinutes, penalty, curve) {
    if (excessMinutes <= 0 || penalty === 0) return 0;
    if (curve === "quadratic") {
      return penalty * ((excessMinutes * excessMinutes) / 30);
    }
    return penalty * (excessMinutes / 30);
  }

  function buildQubo(snapshot, weightsOrParams) {
    const cfg = resolveConfig(weightsOrParams);
    const W = cfg;
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
    const annotations = [];

    function addLin(i, c, note) {
      if (Math.abs(c) < 1e-15) return;
      linear[i] += c;
      if (note) annotations.push({ type: "linear", i, c, note });
    }
    function addQuad(i, j, c, note) {
      if (Math.abs(c) < 1e-15) return;
      if (i > j) {
        const t = i;
        i = j;
        j = t;
      }
      if (i === j) {
        linear[i] += c;
        if (note) annotations.push({ type: "linear", i, c, note });
        return;
      }
      const k = i + "," + j;
      quadratic[k] = (quadratic[k] || 0) + c;
      if (note) annotations.push({ type: "quadratic", i, j, c, note });
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
        for (const i of idxs) addLin(i, Pcov, "discourage surplus on zero-req showtime");
        continue;
      }
      constant += Pcov * req * req;
      for (const i of idxs) addLin(i, Pcov * (1 - 2 * req), "coverage linear");
      for (let a = 0; a < idxs.length; a++) {
        for (let b = a + 1; b < idxs.length; b++) {
          addQuad(idxs[a], idxs[b], 2 * Pcov, "coverage pair");
        }
      }
    }

    const Phard = W.hardConflict;
    const maxB = W.maxBOverlapMinutes;
    const prefB = W.preferredBOverlapMinutes;
    const bPen = W.bOverlap;
    const bCurve = W.bOverlapCurve;
    const cWin = W.cProximityMinutes;
    const cPen = W.cProximity;
    const guestLimit = W.firstSetGuestLimit;

    for (let a = 0; a < variables.length; a++) {
      const va = variables[a];
      for (let b = a + 1; b < variables.length; b++) {
        const vb = variables[b];
        if (va.workerId !== vb.workerId) continue;

        if (va.showId === vb.showId && va.showtimeId === vb.showtimeId) {
          addQuad(a, b, Phard, "A conflict · same showtime");
          continue;
        }

        if (isHardConflict(va, vb, cohort, maxB, guestLimit, W.maxAOverlapMinutes)) {
          addQuad(a, b, Phard, "hard conflict");
          continue;
        }

        const aO = overlapMinutes(va.windows.aWindow, vb.windows.aWindow);
        if (aO > 0) {
          const fam = familyAffinity(va.room, vb.room);
          addQuad(a, b, -W.roomFamily * (fam / 60), "room-family / A soft");
        }

        const bO = overlapMinutes(va.windows.bWindow, vb.windows.bWindow);
        if (bO > prefB) {
          const excess = bO - prefB;
          const coeff = bOverlapSoftCoeff(excess, bPen, bCurve);
          if (coeff !== 0) {
            addQuad(a, b, coeff, "B overlap soft · excess " + excess + "m · " + bCurve);
          }
        }

        const cD = Math.abs(va.windows.cEnd - vb.windows.cEnd);
        if (cD > 0 && cD <= cWin) {
          const tight = cWin - cD + 1;
          addQuad(a, b, cPen * (tight / Math.max(1, cWin)), "C proximity");
        }

        if (va.zone !== vb.zone) {
          addQuad(a, b, W.zoneTransition, "zone transition");
        }
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
          addQuad(idxs[a], idxs[b], W.workloadBalance * 0.25, "workload balance");
        }
      }
    }

    for (const v of variables) {
      addLin(v.index, W.leadPreference * (v.leadWeight / 10), "lead preference");
      if (v.preferredZone) {
        if (v.preferredZone === v.zone) {
          addLin(v.index, -Math.abs(W.roomFamily), "preferred zone match");
        } else {
          addLin(v.index, Math.abs(W.roomFamily) * 0.5, "preferred zone mismatch");
        }
      }
    }

    return {
      variables,
      linear,
      quadratic,
      constant,
      weights: {
        hardConflict: W.hardConflict,
        missingCoverage: W.missingCoverage,
        bOverlap: W.bOverlap,
        cProximity: W.cProximity,
        workloadBalance: W.workloadBalance,
        zoneTransition: W.zoneTransition,
        roomFamily: W.roomFamily,
        leadPreference: W.leadPreference
      },
      config: cfg,
      params: cfg.params,
      variableCount: variables.length,
      cohort: [...cohort],
      annotations,
      snapshotMeta: {
        workerCount: workers.length,
        showCount: shows.length,
        showtimeCount: items.length
      }
    };
  }

  function isHardConflict(va, vb, cohort, maxB, guestLimit, maxA) {
    maxB = maxB != null ? maxB : (CONFIG.B_OVERLAP_TOLERANCE_MINUTES || 30);
    guestLimit = guestLimit != null ? guestLimit : (CONFIG.FIRST_SET_A_EXCEPTION_GUEST_LIMIT || 10);
    maxA = maxA != null ? maxA : 0;

    const sa = va.windows;
    const sb = vb.windows;

    const aO = overlapMinutes(sa.aWindow, sb.aWindow);
    if (aO > maxA) {
      const exc =
        cohort.has(va.showtimeId) &&
        cohort.has(vb.showtimeId) &&
        va.guests < guestLimit &&
        vb.guests < guestLimit;
      if (!exc) return true;
    }
    if (overlaps(sa.aWindow, sb.bWindow) || overlaps(sa.bWindow, sb.aWindow)) return true;
    if (
      (sb.cEnd > sa.aWindow.start && sb.cEnd < sa.aWindow.end) ||
      (sa.cEnd > sb.aWindow.start && sa.cEnd < sb.aWindow.end)
    ) {
      return true;
    }
    if (overlapMinutes(sa.bWindow, sb.bWindow) > maxB) return true;
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

  function modelFingerprint(model) {
    let h = model.variableCount + "|" + Number(model.constant).toFixed(4);
    const lin = model.linear || [];
    for (let i = 0; i < lin.length; i++) {
      if (Math.abs(lin[i]) > 1e-12) h += "|L" + i + ":" + Number(lin[i]).toFixed(4);
    }
    const keys = Object.keys(model.quadratic || {}).sort();
    for (const k of keys) {
      const c = model.quadratic[k];
      if (Math.abs(c) > 1e-12) h += "|Q" + k + ":" + Number(c).toFixed(4);
    }
    return h;
  }

  global.ShowflowQuboBuilder = {
    DEFAULT_WEIGHTS,
    cloneWeights,
    resolveConfig,
    buildQubo,
    energy,
    isHardConflict,
    bOverlapSoftCoeff,
    modelFingerprint
  };
})(typeof window !== "undefined" ? window : globalThis);
