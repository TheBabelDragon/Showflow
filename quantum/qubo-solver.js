/**
 * Local classical / quantum-inspired QUBO solver for browser Quantum Optimization.
 * Exhaustive for tiny models; simulated annealing otherwise.
 * No cloud dependency.
 */
(function (global) {
  "use strict";

  const EXHAUSTIVE_LIMIT = 22;

  function solve(model, options) {
    const opts = options || {};
    const start = performance.now();
    const n = model.variableCount;
    if (n === 0) {
      return {
        assignment: [],
        selected: [],
        energy: model.constant,
        runtimeMs: performance.now() - start,
        method: "empty"
      };
    }

    let best;
    let method;
    if (n <= EXHAUSTIVE_LIMIT) {
      best = exhaustive(model);
      method = "exhaustive";
    } else {
      best = anneal(model, opts);
      method = "simulated-annealing";
    }

    const selected = [];
    for (let i = 0; i < n; i++) {
      if (best[i]) selected.push(model.variables[i]);
    }

    return {
      assignment: best,
      selected,
      energy: ShowflowQuboBuilder.energy(model, best),
      runtimeMs: performance.now() - start,
      method
    };
  }

  function exhaustive(model) {
    const n = model.variableCount;
    const limit = 1 << n;
    let best = new Array(n).fill(false);
    let bestE = Infinity;
    const cur = new Array(n).fill(false);
    for (let mask = 0; mask < limit; mask++) {
      for (let i = 0; i < n; i++) cur[i] = ((mask >>> i) & 1) === 1;
      const e = ShowflowQuboBuilder.energy(model, cur);
      if (e < bestE - 1e-12) {
        bestE = e;
        best = cur.slice();
      } else if (Math.abs(e - bestE) < 1e-12) {
        const bc = best.reduce((s, x) => s + (x ? 1 : 0), 0);
        const cc = cur.reduce((s, x) => s + (x ? 1 : 0), 0);
        if (cc < bc || (cc === bc && lexLess(cur, best))) best = cur.slice();
      }
    }
    return best;
  }

  function lexLess(a, b) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return !a[i] && b[i];
    }
    return false;
  }

  function anneal(model, opts) {
    const n = model.variableCount;
    const steps = opts.steps || Math.min(25000, 400 * n * n);
    const t0 = opts.t0 || 80;
    const t1 = opts.t1 || 0.005;
    let seed = (n * 2654435761) >>> 0;
    function rnd() {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    let cur = new Array(n).fill(false);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < n; i++) {
        cur[i] = !cur[i];
        const eOn = ShowflowQuboBuilder.energy(model, cur);
        cur[i] = !cur[i];
        const eOff = ShowflowQuboBuilder.energy(model, cur);
        if (eOn < eOff) cur[i] = true;
      }
    }

    let curE = ShowflowQuboBuilder.energy(model, cur);
    let best = cur.slice();
    let bestE = curE;

    for (let s = 0; s < steps; s++) {
      const t = t0 * Math.pow(t1 / t0, s / steps);
      const i = (rnd() * n) | 0;
      cur[i] = !cur[i];
      const e = ShowflowQuboBuilder.energy(model, cur);
      const d = e - curE;
      if (d < 0 || rnd() < Math.exp(-d / Math.max(t, 1e-12))) {
        curE = e;
        if (e < bestE) {
          bestE = e;
          best = cur.slice();
        }
      } else {
        cur[i] = !cur[i];
      }
    }
    return best;
  }

  function materialize(solution, snapshot) {
    const workers = snapshot.workers || [];
    const shows = snapshot.shows || [];
    const items = flattenShowtimes(shows);
    const cohort = buildFirstSetCohort(items);
    const workerById = Object.fromEntries(workers.map((w) => [w.id, w]));

    const raw = (solution.selected || []).slice().sort((a, b) => {
      const wa = a.windows ? a.windows.start : 0;
      const wb = b.windows ? b.windows.start : 0;
      return wa - wb || String(a.showtimeId).localeCompare(String(b.showtimeId)) || String(a.workerId).localeCompare(String(b.workerId));
    });

    const legal = [];
    for (const v of raw) {
      const worker = workerById[v.workerId];
      const cand = items.find((i) => i.show.id === v.showId && i.showtime.id === v.showtimeId);
      if (!worker || !cand) continue;
      if (!eligible(worker, cand, legal, cohort)) continue;
      const slot = legal.filter((a) => a.showId === v.showId && a.showtimeId === v.showtimeId).length;
      legal.push(createAssignment(worker, cand, slot, 0));
    }

    for (const cand of items) {
      arbitrateLead(cand, legal, workers);
    }

    const chrono = legal.slice().sort((a, b) => a.aWindow.start - b.aWindow.start || String(a.showtimeId).localeCompare(String(b.showtimeId)) || String(a.workerId).localeCompare(String(b.workerId)));
    const warnings = [];
    const seen = [];
    for (const a of chrono) {
      const w = workerById[a.workerId];
      const c = items.find((i) => i.show.id === a.showId && i.showtime.id === a.showtimeId);
      if (w && c) {
        a.warnings = evaluateDiagnostics(w, c, a, seen, legal, cohort, workers);
        warnings.push(...a.warnings);
      }
      seen.push(a);
    }
    const gaps = [];
    for (const show of shows) {
      const req = workersRequired(show.guests);
      for (const st of showtimesOf(show)) {
        const assigned = new Set(legal.filter((s) => s.showId === show.id && s.showtimeId === st.id).map((s) => s.workerId)).size;
        if (assigned < req) {
          gaps.push({
            showId: show.id,
            showtimeId: st.id,
            setTimeId: st.id,
            required: req,
            assigned,
            missing: req - assigned
          });
        }
      }
    }

    return {
      assignments: legal,
      coverageGaps: gaps,
      warnings,
      assignmentCount: legal.length,
      gapCount: gaps.reduce((s, g) => s + g.missing, 0),
      fullyCovered: gaps.length === 0,
      firstSetCohort: [...cohort],
      rejectedRawCount: Math.max(0, (solution.selected || []).length - legal.length)
    };
  }

  function computeMetrics(result, snapshot) {
    const assignments = (result && result.assignments) || [];
    let bOverlapTotal = 0;
    let cProxEvents = 0;
    let zoneTransitions = 0;
    const load = Object.create(null);
    for (let i = 0; i < assignments.length; i++) {
      const a = assignments[i];
      load[a.workerId] = (load[a.workerId] || 0) + 1;
      for (let j = i + 1; j < assignments.length; j++) {
        const b = assignments[j];
        if (a.workerId !== b.workerId) continue;
        bOverlapTotal += overlapMinutes(a.bWindow, b.bWindow);
        const cD = Math.abs(a.cEnd - b.cEnd);
        if (cD <= CONFIG.C_PROXIMITY_MINUTES) cProxEvents++;
        if (a.zone !== b.zone) zoneTransitions++;
      }
    }
    const loads = Object.keys(load).map((k) => load[k]);
    const workloadVar =
      loads.length <= 1
        ? 0
        : (() => {
            const mean = loads.reduce((s, x) => s + x, 0) / loads.length;
            return loads.reduce((s, x) => s + (x - mean) * (x - mean), 0) / loads.length;
          })();

    const requiredTotal = (snapshot.shows || []).reduce((s, show) => {
      return s + workersRequired(show.guests) * showtimesOf(show).length;
    }, 0);
    const covered = requiredTotal - (result.gapCount || 0);
    const coveragePct = requiredTotal === 0 ? 100 : Math.round((1000 * Math.max(0, covered)) / requiredTotal) / 10;

    const hardViolations = (result.rejectedRawCount || 0) + (result.gapCount || 0);

    return {
      coveragePct,
      hardViolations,
      gapCount: result.gapCount || 0,
      assignmentCount: result.assignmentCount || 0,
      warningCount: (result.warnings || []).length,
      bOverlapTotal,
      cProximityEvents: cProxEvents,
      zoneTransitions,
      workloadVariance: Math.round(workloadVar * 100) / 100,
      fullyCovered: !!result.fullyCovered
    };
  }

  global.ShowflowQuboSolver = {
    EXHAUSTIVE_LIMIT,
    solve,
    materialize,
    computeMetrics
  };
})(typeof window !== "undefined" ? window : globalThis);
