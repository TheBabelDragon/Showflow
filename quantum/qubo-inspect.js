/**
 * QUBO inspect + diagnostics helpers.
 * Extends ShowflowQuboBuilder with formatInspect and post-build diagnostics
 * when the base builder does not yet include them.
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
    const quadratic = model.quadratic || {};
    for (const k of Object.keys(quadratic)) {
      if (Math.abs(quadratic[k]) > 1e-15) quadraticNonZero++;
    }
    return {
      variables: model.variableCount || 0,
      linearTerms: linearNonZero,
      quadraticTerms: quadraticNonZero,
      hardPenalties: "—",
      softTerms: linearNonZero + quadraticNonZero
    };
  }

  function formatInspect(model, maxTerms) {
    const limit = maxTerms || 40;
    const lines = [];
    const vars = model.variables || [];
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
    lines.push("--- Linear terms (sample) ---");
    let shown = 0;
    for (let i = 0; i < vars.length && shown < limit; i++) {
      const c = model.linear && model.linear[i];
      if (!c || Math.abs(c) < 1e-12) continue;
      const sign = c >= 0 ? "+" : "";
      lines.push("Q[x" + i + "] = " + sign + Number(c).toFixed(2));
      shown++;
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
      lines.push("Q[x" + k.replace(",", ",x") + "] = " + sign + Number(c).toFixed(2));
    }
    const d = model.diagnostics || computeDiagnostics(model);
    lines.push("");
    lines.push("--- Diagnostics ---");
    lines.push(
      "Variables: " +
        d.variables +
        " · Linear: " +
        d.linearTerms +
        " · Quadratic: " +
        d.quadraticTerms
    );
    return lines.join("\n");
  }

  if (typeof B.formatInspect !== "function") {
    B.formatInspect = formatInspect;
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
