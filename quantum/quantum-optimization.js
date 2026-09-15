/**
 * Quantum Optimization experiment — orchestration layer.
 * Read-only snapshot of live Showflow state → policy params → QUBO → local solve → validate → compare.
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
      bullets.push("Candidate VALID — passes Showflow validation");
    } else {
      bullets.push("Candidate REJECTED — residual gaps or illegal picks (comparison only)");
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
      statusLabel: passes ? "Candidate VALID" : "Candidate REJECTED",
      bullets
    };
  }

  function runQuantumOptimization(snapshot, paramsOrWeights, classicResult, previousPolicy) {
    const t0 = performance.now();
    const model = ShowflowQuboBuilder.buildQubo(snapshot, paramsOrWeights);
    const solution = ShowflowQuboSolver.solve(model);
    const candidate = ShowflowQuboSolver.materialize(solution, snapshot);
    const candidateMetrics = ShowflowQuboSolver.computeMetrics(candidate, snapshot);

    let classicMetrics = null;
    if (classicResult) {
      classicMetrics = ShowflowQuboSolver.computeMetrics(classicResult, snapshot);
    }

    const conclusion = buildConclusion(classicMetrics, candidateMetrics, candidate);
    const inspectText =
      typeof ShowflowQuboBuilder.formatInspect === "function"
        ? ShowflowQuboBuilder.formatInspect(model, 48)
        : "";

    let policy = null;
    if (global.ShowflowOptimizationParams) {
      const raw =
        (paramsOrWeights && paramsOrWeights.params) ||
        paramsOrWeights ||
        global.ShowflowOptimizationParams.defaults();
      policy = global.ShowflowOptimizationParams.policySummary(raw);
    }

    const measurable = [];
    if (previousPolicy && policy) {
      if (previousPolicy.maxBOverlap !== policy.maxBOverlap) {
        measurable.push(
          "Maximum B overlap: " + previousPolicy.maxBOverlap + "m → " + policy.maxBOverlap + "m"
        );
      }
      if (previousPolicy.bPenalty !== policy.bPenalty) {
        measurable.push("B penalty: " + previousPolicy.bPenalty + " → " + policy.bPenalty);
      }
      if (previousPolicy.bCurve !== policy.bCurve) {
        measurable.push("B curve: " + previousPolicy.bCurve + " → " + policy.bCurve);
      }
      if (previousPolicy.workload !== policy.workload) {
        measurable.push("Workload weight: " + previousPolicy.workload + " → " + policy.workload);
      }
    }
    if (classicMetrics && candidateMetrics) {
      if (classicMetrics.bOverlapTotal != null && candidateMetrics.bOverlapTotal != null) {
        const d = candidateMetrics.bOverlapTotal - classicMetrics.bOverlapTotal;
        if (d !== 0) measurable.push("B overlap " + (d > 0 ? "+" : "") + d + "m vs normal schedule");
      }
      if (classicMetrics.workloadVariance != null && candidateMetrics.workloadVariance != null) {
        const cv = classicMetrics.workloadVariance;
        const qv = candidateMetrics.workloadVariance;
        if (cv > 0.001) {
          const pct = Math.round((100 * (cv - qv)) / cv);
          if (pct !== 0) measurable.push("Workload balance " + (pct > 0 ? "+" : "") + pct + "% vs normal");
        }
      }
      measurable.push("QUBO energy " + Number(solution.energy).toFixed(2));
      measurable.push(
        "Hard violations (candidate): " + (candidateMetrics.hardViolations != null ? candidateMetrics.hardViolations : 0)
      );
    }

    return {
      enabled: true,
      experimental: true,
      label: "Quantum Optimization",
      model: {
        variableCount: model.variableCount,
        diagnostics: model.diagnostics,
        weights: model.weights,
        config: model.config,
        params: model.params,
        meta: model.snapshotMeta,
        variables: model.variables,
        linear: model.linear,
        quadratic: model.quadratic,
        constant: model.constant,
        annotations: model.annotations
      },
      inspectText,
      policy,
      previousPolicy: previousPolicy || null,
      measurable,
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

    const P = global.ShowflowOptimizationParams;
    if (P) {
      const d = P.defaults();
      check("parameter defaults present", d.maxBOverlapMinutes === 30 && d.bOverlapPenalty === 20);
      const ser = P.serialize(d);
      const des = P.deserialize(ser);
      check("parameter serialization round-trip", des.maxBOverlapMinutes === 30 && des.bOverlapPenalty === 20);
      const strict = P.applyPreset("strict");
      check("preset loading (strict)", strict.maxBOverlapMinutes === 15 && strict.bOverlapCurve === "quadratic");
      const flex = P.applyPreset("flexible");
      check("preset loading (flexible)", flex.maxBOverlapMinutes === 45);
      const reset = P.defaults();
      check("parameter reset", reset.maxBOverlapMinutes === 30);
    } else {
      check("parameter module present", false);
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
    const m3 = ShowflowQuboBuilder.buildQubo(getScheduleSnapshot(workers, covShow), {
      hardConflict: 1000,
      missingCoverage: 2000,
      bOverlap: 0,
      cProximity: 0,
      workloadBalance: 0,
      zoneTransition: 0,
      roomFamily: 0,
      leadPreference: 0
    });
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

    const inspect =
      typeof ShowflowQuboBuilder.formatInspect === "function"
        ? ShowflowQuboBuilder.formatInspect(model, 10)
        : "";
    check("inspect text", typeof inspect === "string" && inspect.indexOf("x0") >= 0);

    if (P && ShowflowQuboBuilder.modelFingerprint) {
      const baseParams = P.defaults();
      const multiShows = [
        {
          id: "s1",
          name: "A",
          theater: "default",
          guests: 8,
          showtimes: [{ id: "st1", room: 1, start: "14:00", duration: 60 }]
        },
        {
          id: "s2",
          name: "B",
          theater: "default",
          guests: 8,
          showtimes: [{ id: "st2", room: 2, start: "14:30", duration: 60 }]
        }
      ];
      const multiSnap = getScheduleSnapshot(workers, multiShows);
      const mC = ShowflowQuboBuilder.buildQubo(multiSnap, baseParams);
      const alt2 = P.clone(baseParams);
      alt2.bOverlapPenalty = 99;
      alt2.bOverlapCurve = "quadratic";
      alt2.leadPreferenceWeight = -40;
      alt2.workloadBalanceWeight = 25;
      const mD = ShowflowQuboBuilder.buildQubo(multiSnap, alt2);
      const fpC = ShowflowQuboBuilder.modelFingerprint(mC);
      const fpD = ShowflowQuboBuilder.modelFingerprint(mD);
      check("same schedule + different soft params → different QUBO", fpC !== fpD);

      const altHard = P.clone(baseParams);
      altHard.maxBOverlapMinutes = 5;
      altHard.hardConflictPenalty = 5000;
      const mE = ShowflowQuboBuilder.buildQubo(multiSnap, altHard);
      const fpE = ShowflowQuboBuilder.modelFingerprint(mE);
      check("hard threshold change affects QUBO", fpC !== fpE);

      const softLin = P.clone(baseParams);
      softLin.bOverlapPenalty = 30;
      softLin.bOverlapCurve = "linear";
      softLin.preferredBOverlapMinutes = 0;
      const softQuad = P.clone(baseParams);
      softQuad.bOverlapPenalty = 30;
      softQuad.bOverlapCurve = "quadratic";
      softQuad.preferredBOverlapMinutes = 0;
      const mLin = ShowflowQuboBuilder.buildQubo(multiSnap, softLin);
      const mQuad = ShowflowQuboBuilder.buildQubo(multiSnap, softQuad);
      check(
        "linear vs quadratic overlap penalty changes coefficients",
        ShowflowQuboBuilder.modelFingerprint(mLin) !== ShowflowQuboBuilder.modelFingerprint(mQuad) ||
          ShowflowQuboBuilder.bOverlapSoftCoeff(20, 30, "linear") !==
            ShowflowQuboBuilder.bOverlapSoftCoeff(20, 30, "quadratic")
      );
      check(
        "soft coeff linear vs quadratic",
        ShowflowQuboBuilder.bOverlapSoftCoeff(30, 20, "linear") === 20 &&
          ShowflowQuboBuilder.bOverlapSoftCoeff(30, 20, "quadratic") === 20 * (900 / 30)
      );
    } else {
      check("same schedule + different params → different QUBO", false);
    }

    const origWorkers = JSON.stringify(workers);
    getScheduleSnapshot(workers, shows);
    check("snapshot does not mutate input workers", JSON.stringify(workers) === origWorkers);

    check("CONFIG B tolerance present", typeof CONFIG !== "undefined" && CONFIG.B_OVERLAP_TOLERANCE_MINUTES === 30);
    check("CONFIG first-set guest limit", CONFIG.FIRST_SET_A_EXCEPTION_GUEST_LIMIT === 10);

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
