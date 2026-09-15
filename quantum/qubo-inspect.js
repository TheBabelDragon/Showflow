/**
 * QUBO inspect + diagnostics helpers.
 * Extends ShowflowQuboBuilder with formatInspect and post-build diagnostics.
 */
(function (global) {
  "use strict";

  const B = global.ShowflowQuboBuilder;
  if (!B) return;

  function computeDiagnostics(model) {
    let linearNonZero = 0;
    const linear = model.linear || [];
    for (let i = 0; i < linear.length; i++) {
      if (Math.abs(linear[i]) > 1e-15) linearNonZero++;
    }
    let quadraticNonZero = 0;
    let hardLike = 0;
    let softLike = 0;
    const quadratic = model.quadratic || {};
    const hardThresh = (model.config && model.config.hardConflict) || 500;
    for (const k of Object.keys(quadratic)) {
      const c = quadratic[k];
      if (Math.abs(c) > 1e-15) {
        quadraticNonZero++;
        if (Math.abs(c) >= hardThresh * 0.5) hardLike++;
        else softLike++;
      }
    }
    return {
      variables: model.variableCount || 0,
      linearTerms: linearNonZero,
      quadraticTerms: quadraticNonZero,
      hardPenalties: hardLike,
      softTerms: softLike + linearNonZero,
      totalWeightedTerms: linearNonZero + quadraticNonZero
    };
  }

  function formatInspect(model, maxTerms) {
    const limit = maxTerms || 48;
    const lines = [];
    const vars = model.variables || [];
    const d = model.diagnostics || computeDiagnostics(model);

    lines.push("=== Inspect QUBO ===");
    lines.push(
      "Variables: " +
        d.variables +
        " · Linear: " +
        d.linearTerms +
        " · Quadratic: " +
        d.quadraticTerms +
        " · Hard-like: " +
        d.hardPenalties +
        " · Soft: " +
        d.softTerms +
        " · Total weighted: " +
        d.totalWeightedTerms
    );
    if (model.config) {
      const c = model.config;
      lines.push(
        "Policy: maxB=" +
          c.maxBOverlapMinutes +
          "m · prefB=" +
          c.preferredBOverlapMinutes +
          "m · Bpen=" +
          c.bOverlap +
          " · curve=" +
          c.bOverlapCurve +
          " · hard=" +
          c.hardConflict
      );
    }
    lines.push("");

    lines.push("--- Variables ---");
    for (let i = 0; i < vars.length; i++) {
      const v = vars[i];
      lines.push(
        "x" +
          i +
          " = " +
          (v.workerName || v.workerId) +
          " / " +
          (v.showtimeId || v.showId) +
          " · room " +
          v.room +
          " · zone " +
          v.zone
      );
    }
    lines.push("");

    // Annotated representative terms when available
    const anns = model.annotations || [];
    if (anns.length) {
      lines.push("--- Representative terms (annotated) ---");
      const byAbs = anns.slice().sort(function (a, b) {
        return Math.abs(b.c) - Math.abs(a.c);
      });
      let shown = 0;
      for (let t = 0; t < byAbs.length && shown < limit; t++) {
        const a = byAbs[t];
        if (Math.abs(a.c) < 1e-12) continue;
        const sign = a.c >= 0 ? "+" : "";
        if (a.type === "quadratic") {
          lines.push(
            "Q[x" + a.i + ",x" + a.j + "] = " + sign + Number(a.c).toFixed(2) + "    " + (a.note || "")
          );
        } else {
          lines.push("Q[x" + a.i + "] = " + sign + Number(a.c).toFixed(2) + "    " + (a.note || ""));
        }
        shown++;
      }
      lines.push("");
    }

    lines.push("--- Linear terms (nonzero sample) ---");
    let shownL = 0;
    for (let i = 0; i < vars.length && shownL < Math.min(20, limit); i++) {
      const c = model.linear && model.linear[i];
      if (!c || Math.abs(c) < 1e-12) continue;
      const sign = c >= 0 ? "+" : "";
      lines.push("Q[x" + i + "] = " + sign + Number(c).toFixed(2));
      shownL++;
    }
    lines.push("");

    lines.push("--- Quadratic terms (strongest) ---");
    const keys = Object.keys(model.quadratic || {}).sort(function (a, b) {
      return Math.abs(model.quadratic[b]) - Math.abs(model.quadratic[a]);
    });
    for (let t = 0; t < keys.length && t < limit; t++) {
      const k = keys[t];
      const c = model.quadratic[k];
      if (Math.abs(c) < 1e-12) continue;
      const sign = c >= 0 ? "+" : "";
      const parts = k.split(",");
      lines.push("Q[x" + parts[0] + ",x" + parts[1] + "] = " + sign + Number(c).toFixed(2));
    }

    return lines.join("\n");
  }

  if (typeof B.formatInspect !== "function") {
    B.formatInspect = formatInspect;
  } else {
    B.formatInspect = formatInspect; // always use richer version
  }
  B.computeDiagnostics = computeDiagnostics;

  const origBuild = B.buildQubo;
  if (origBuild && !B._inspectWrapped) {
    B._inspectWrapped = true;
    B.buildQubo = function (snapshot, weights) {
      const model = origBuild(snapshot, weights);
      if (!model.diagnostics) {
        model.diagnostics = computeDiagnostics(model);
      }
      return model;
    };
  }
})(typeof window !== "undefined" ? window : globalThis);
