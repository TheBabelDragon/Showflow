/**
 * Quantum Optimization experiment — orchestration layer.
 * Read-only snapshot of live Showflow state → QUBO → local solve → validate → compare.
 * Never mutates authoritative schedule state.
 */
(function (global) {
  "use strict";

  function getScheduleSnapshot(workers, shows) {
    return {
      workers: JSON.parse(JSON.stringify(workers || [])),
      shows: JSON.parse(JSON.stringify(shows || [])),
      capturedAt: Date.now()
    };
  }

  function buildConclusion(classicMetrics, candidateMetrics, candidate) {
    const c = classicMetrics || {};
    const q = candidateMetrics || {};
    const bullets = [];

    const passes =
      (candidate && candidate.fullyCovered && (candidate.rejectedRawCount || 0) === 0) ||
      (q.gapCount === 0 && (q.hardViolations || 0) === 0);

    if (passes) {
      bullets.push("Candidate passes Showflow validation");
    } else {
      bullets.push(
        "Candidate has residual issues (gaps or rejected illegal picks) — still reported for comparison only"
      );
    }

    if (c.bOverlapTotal != null && q.bOverlapTotal != null) {
      const d = c.bOverlapTotal - q.bOverlapTotal;
      if (d > 0) bullets.push(d + " fewer B-overlap minute(s)");
      else if (d < 0) bullets.push(Math.abs(d) + " more B-overlap minute(s)");
      else bullets.push("Same B-overlap total");
    }

    if (c.workloadVariance != null && q.workloadVariance != null) {
      const cv = c.workloadVariance;
      const qv = q.workloadVariance;
      if (cv > 0.001 && qv < cv) {
        const pct = Math.round((100 * (cv - qv)) / cv);
        bullets.push(pct + "% better workload balance");
      } else if (qv > cv + 0.001) {
        bullets.push("Higher workload variance");
      } else {
        bullets.push("Similar workload balance");
      }
    }

    if (c.zoneTransitions != null && q.zoneTransitions != null) {
      const d = c.zoneTransitions - q.zoneTransitions;
      if (d > 0) bullets.push(d + " fewer zone transition(s)");
      else if (d < 0) bullets.push(Math.abs(d) + " more zone transition(s)");
    }

    if (c.cProximityEvents != null && q.cProximityEvents != null) {
      const d = c.cProximityEvents - q.cProximityEvents;
      if (d > 0) bullets.push(d + " fewer C-proximity event(s)");
      else if (d < 0) bullets.push(Math.abs(d) + " more C-proximity event(s)");
    }

    const hardDelta =
      (q.hardViolations != null ? q.hardViolations : 0) -
      (c.hardViolations != null ? c.hardViolations : 0);
    if (hardDelta === 0) bullets.push("0 additional hard violations");
    else if (hardDelta > 0) bullets.push(hardDelta + " additional hard-related issue(s)");
    else bullets.push(Math.abs(hardDelta) + " fewer hard-related issue(s)");

    return {
      passesValidation: !!passes,
      bullets
    };
  }

  function runQuantumOptimization(snapshot, weights, classicResult) {
    const t0 = performance.now();
    const model = ShowflowQuboBuilder.buildQubo(snapshot, weights);
    const solution = ShowflowQuboSolver.solve(model);
    const candidate = ShowflowQuboSolver.materialize(solution, snapshot);
    const candidateMetrics = ShowflowQuboSolver.computeMetrics(candidate, snapshot);

    let classicMetrics = null;
    if (classicResult) {
      classicMetrics = ShowflowQuboSolver.computeMetrics(classicResult, snapshot);
    }

    const conclusion = buildConclusion(classicMetrics, candidateMetrics, candidate);
    const inspectText = ShowflowQuboBuilder.formatInspect(model, 48);

    return {
      enabled: true,
      experimental: true,
      label: "Quantum Optimization",
      model: {
        variableCount: model.variableCount,
        diagnostics: model.diagnostics,
        weights: model.weights,
        meta: model.snapshotMeta,
        variables: model.variables,
        annotated: model.annotated,
        linear: model.linear,
        quadratic: model.quadratic,
        constant: model.constant
      },
      inspectText,
      solution: {
        energy: solution.energy,
        runtimeMs: solution.runtimeMs,
        method: solution.method,
        selectedCount: solution.selected.length
      },
      candidate,
      candidateMetrics,
      classicMetrics,
      conclusion,
      totalMs: performance.now() - t0,
      note:
        "Quantum Optimization currently uses a local classical / quantum-inspired solver. " +
        "The QUBO formulation is quantum-compatible; no quantum hardware is required. " +
        "Candidates are validated by the existing scheduler rules and never mutate the live schedule."
    };
  }

  function selfTest() {
    const results = [];
    function check(name, cond) {
      results.push({ name, ok: !!cond });
    }

    const workers = [
      {
        id: "w1",
        name: "Jane",
        preferredZone: "MAIN",
        leadWeight: 8,
        availability: [{ start: "09:00", end: "18:00" }]
      },
      {
        id: "w2",
        name: "Alex",
        preferredZone: "MAIN",
        leadWeight: 5,
        availability: [{ start: "09:00", end: "18:00" }]
      }
    ];
    const shows = [
      {
        id: "s1",
        name: "Main",
        theater: "default",
        guests: 8,
        showtimes: [{ id: "Show01_0900", room: 1, start: "10:00", duration: 60 }]
      }
    ];
    const snap = getScheduleSnapshot(workers, shows);
    const model = ShowflowQuboBuilder.buildQubo(snap, null);
    check("variable generation (eligible)", model.variableCount === 2);
    check("diagnostics present", model.diagnostics && model.diagnostics.variables === 2);

    const sol = ShowflowQuboSolver.solve(model);
    check("solver returns assignment", sol.assignment.length === 2);
    const mat = ShowflowQuboSolver.materialize(sol, snap);
    check("exact coverage for 8 guests", mat.assignmentCount === 1 && mat.fullyCovered);

    const unavailable = [
      {
        id: "w1",
        name: "Jane",
        preferredZone: "MAIN",
        leadWeight: 5,
        availability: [{ start: "20:00", end: "23:00" }]
      }
    ];
    const m2 = ShowflowQuboBuilder.buildQubo(getScheduleSnapshot(unavailable, shows), null);
    check("unavailable worker excluded", m2.variableCount === 0);

    const covShow = [
      {
        id: "s1",
        name: "Main",
        theater: "default",
        guests: 15,
        showtimes: [{ id: "st1", room: 1, start: "14:00", duration: 60 }]
      }
    ];
    const m3 = ShowflowQuboBuilder.buildQubo(
      getScheduleSnapshot(workers, covShow),
      {
        hardConflict: 1000,
        missingCoverage: 2000,
        bOverlap: 0,
        cProximity: 0,
        workloadBalance: 0,
        zoneTransition: 0,
        roomFamily: 0,
        leadPreference: 0
      }
    );
    check("coverage vars", m3.variableCount === 2);
    const eBoth = ShowflowQuboBuilder.energy(m3, [true, true]);
    const eOne = ShowflowQuboBuilder.energy(m3, [true, false]);
    check("exact coverage lower energy", eBoth < eOne);

    const conflictShows = [
      {
        id: "s1",
        name: "A",
        theater: "default",
        guests: 12,
        showtimes: [{ id: "st1", room: 1, start: "14:00", duration: 60 }]
      },
      {
        id: "s2",
        name: "B",
        theater: "default",
        guests: 12,
        showtimes: [{ id: "st2", room: 2, start: "14:00", duration: 90 }]
      }
    ];
    const oneWorker = [workers[0]];
    const m4 = ShowflowQuboBuilder.buildQubo(getScheduleSnapshot(oneWorker, conflictShows), null);
    const forced = {
      assignment: m4.variables.map(() => true),
      selected: m4.variables.slice(),
      energy: 0,
      runtimeMs: 0,
      method: "forced"
    };
    const mat4 = ShowflowQuboSolver.materialize(forced, getScheduleSnapshot(oneWorker, conflictShows));
    check("invalid candidate rejected", mat4.assignmentCount <= 1);

    const empty = ShowflowQuboBuilder.buildQubo(getScheduleSnapshot([], []), null);
    check("empty model", empty.variableCount === 0);

    const inspect = ShowflowQuboBuilder.formatInspect(model, 10);
    check("inspect text", typeof inspect === "string" && inspect.indexOf("x0") >= 0);

    const failed = results.filter((r) => !r.ok);
    return {
      passed: failed.length === 0,
      total: results.length,
      failed: failed.length,
      results
    };
  }

  global.ShowflowQuantumOptimization = {
    getScheduleSnapshot,
    runQuantumOptimization,
    selfTest,
    DEFAULT_WEIGHTS: ShowflowQuboBuilder.DEFAULT_WEIGHTS
  };
})(typeof window !== "undefined" ? window : globalThis);
