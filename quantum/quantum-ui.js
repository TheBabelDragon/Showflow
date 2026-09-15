/**
 * Quantum Optimization panel UI for GitHub Pages.
 * Isolated experiment — does not replace the production solve path.
 */
(function (global) {
  "use strict";

  const WEIGHT_FIELDS = [
    { key: "hardConflict", label: "Hard Conflict" },
    { key: "missingCoverage", label: "Missing Coverage" },
    { key: "bOverlap", label: "B Overlap" },
    { key: "cProximity", label: "C Proximity" },
    { key: "workloadBalance", label: "Workload Balance" },
    { key: "zoneTransition", label: "Zone Transition" },
    { key: "roomFamily", label: "Room Family" },
    { key: "leadPreference", label: "Lead Preference" }
  ];

  const isStandalone =
    document.documentElement.dataset.quantumStandalone === "1" ||
    /quantum\.html/i.test(location.pathname);

  const quantumState = {
    enabled: isStandalone,
    weights: Object.assign({}, ShowflowQuboBuilder.DEFAULT_WEIGHTS),
    lastComparison: null
  };

  function ensurePanel() {
    let panel = document.getElementById("quantum-panel");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.className = "panel quantum-panel";
    panel.id = "quantum-panel";
    const host = document.getElementById("quantum-host");
    if (host) {
      host.appendChild(panel);
    } else {
      const resultPanel = document.getElementById("result-panel");
      if (resultPanel && resultPanel.parentNode) {
        resultPanel.parentNode.insertBefore(panel, resultPanel);
      } else if (document.querySelector(".wrap")) {
        document.querySelector(".wrap").appendChild(panel);
      }
    }
    return panel;
  }

  function readWeightsFromDom(panel) {
    const w = Object.assign({}, quantumState.weights);
    WEIGHT_FIELDS.forEach((f) => {
      const input = panel.querySelector('[data-qw="' + f.key + '"]');
      if (input) w[f.key] = Number(input.value);
    });
    quantumState.weights = w;
    return w;
  }

  function renderPanel() {
    const panel = ensurePanel();
    const weights = quantumState.weights;
    const cmp = quantumState.lastComparison;

    const weightRows = WEIGHT_FIELDS.map((f) => {
      return `<label class="field">
        <span>${f.label}</span>
        <input type="number" step="any" data-qw="${f.key}" value="${weights[f.key]}">
      </label>`;
    }).join("");

    let comparisonHtml = isStandalone
      ? '<div class="empty">Load sample day, then Solve + compare (or Compare below).</div>'
      : '<div class="empty">Enable and run Compare after solving the normal schedule.</div>';
    if (cmp) {
      const c = cmp.classicMetrics || {};
      const q = cmp.candidateMetrics || {};
      comparisonHtml = `
        <div class="quantum-compare">
          <div class="quantum-col">
            <h3>Current schedule</h3>
            <div class="muted">Existing scheduler</div>
            <table>
              <tr><td>Coverage</td><td class="${c.fullyCovered ? "ok" : "bad"}">${c.coveragePct != null ? c.coveragePct + "%" : "—"}</td></tr>
              <tr><td>Hard / gaps</td><td class="${c.gapCount ? "bad" : "ok"}">${c.gapCount != null ? c.gapCount : "—"}</td></tr>
              <tr><td>Assignments</td><td>${c.assignmentCount != null ? c.assignmentCount : "—"}</td></tr>
              <tr><td>Warnings</td><td class="${c.warningCount ? "warn-text" : "ok"}">${c.warningCount != null ? c.warningCount : "—"}</td></tr>
              <tr><td>B overlap (min)</td><td>${c.bOverlapTotal != null ? c.bOverlapTotal : "—"}</td></tr>
              <tr><td>C proximity events</td><td>${c.cProximityEvents != null ? c.cProximityEvents : "—"}</td></tr>
              <tr><td>Zone transitions</td><td>${c.zoneTransitions != null ? c.zoneTransitions : "—"}</td></tr>
              <tr><td>Workload variance</td><td>${c.workloadVariance != null ? c.workloadVariance : "—"}</td></tr>
            </table>
          </div>
          <div class="quantum-col">
            <h3>Quantum candidate</h3>
            <div class="muted">${escapeHtml(cmp.solution.method)} · ${cmp.solution.runtimeMs.toFixed(1)} ms</div>
            <table>
              <tr><td>Coverage</td><td class="${q.fullyCovered ? "ok" : "bad"}">${q.coveragePct != null ? q.coveragePct + "%" : "—"}</td></tr>
              <tr><td>Hard / gaps</td><td class="${q.gapCount ? "bad" : "ok"}">${q.gapCount != null ? q.gapCount : "—"}</td></tr>
              <tr><td>Assignments</td><td>${q.assignmentCount != null ? q.assignmentCount : "—"}</td></tr>
              <tr><td>Warnings</td><td class="${q.warningCount ? "warn-text" : "ok"}">${q.warningCount != null ? q.warningCount : "—"}</td></tr>
              <tr><td>B overlap (min)</td><td>${q.bOverlapTotal != null ? q.bOverlapTotal : "—"}</td></tr>
              <tr><td>C proximity events</td><td>${q.cProximityEvents != null ? q.cProximityEvents : "—"}</td></tr>
              <tr><td>Zone transitions</td><td>${q.zoneTransitions != null ? q.zoneTransitions : "—"}</td></tr>
              <tr><td>Workload variance</td><td>${q.workloadVariance != null ? q.workloadVariance : "—"}</td></tr>
              <tr><td>QUBO energy</td><td class="ok">${Number(cmp.solution.energy).toFixed(2)}</td></tr>
              <tr><td>Variables</td><td>${cmp.model.variableCount}</td></tr>
              <tr><td>Rejected illegal</td><td class="${cmp.candidate.rejectedRawCount ? "warn-text" : "ok"}">${cmp.candidate.rejectedRawCount || 0}</td></tr>
            </table>
          </div>
        </div>
        <p class="muted" style="margin-top:10px">${escapeHtml(cmp.note)}</p>
      `;
    }

    const enableBlock = isStandalone
      ? ""
      : `<label class="quantum-toggle">
        <input type="checkbox" id="quantum-enable" ${quantumState.enabled ? "checked" : ""}>
        <span>Enable Quantum Optimization experiment</span>
      </label>`;

    panel.innerHTML = `
      <h2>Quantum Optimization <span class="quantum-badge">Experimental</span></h2>
      <p class="muted" style="margin:0 0 12px">
        Local classical / quantum-inspired solver over a QUBO model of the current schedule.
        Comparison only — does not replace the live schedule. No quantum hardware required.
      </p>
      ${enableBlock}
      <div id="quantum-body" style="${quantumState.enabled || isStandalone ? "" : "display:none"}">
        <h3 class="muted" style="margin:14px 0 8px">Optimization weights</h3>
        <div class="quantum-weights">${weightRows}</div>
        <div class="transport">
          <button type="button" id="quantum-compare" class="primary">Compare</button>
          <button type="button" id="quantum-reset-weights">Reset weights</button>
          <button type="button" id="quantum-selftest">Run self-test</button>
        </div>
        <div id="quantum-selftest-out" class="muted" style="margin-top:8px"></div>
        <h3 class="muted" style="margin:16px 0 8px">Comparison</h3>
        <div id="quantum-comparison">${comparisonHtml}</div>
      </div>
    `;

    const enable = panel.querySelector("#quantum-enable");
    if (enable) {
      enable.addEventListener("change", () => {
        quantumState.enabled = enable.checked;
        if (!quantumState.enabled) quantumState.lastComparison = null;
        renderPanel();
      });
    }
    const compareBtn = panel.querySelector("#quantum-compare");
    if (compareBtn) {
      compareBtn.addEventListener("click", () => {
        readWeightsFromDom(panel);
        runCompare();
      });
    }
    const resetBtn = panel.querySelector("#quantum-reset-weights");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        quantumState.weights = Object.assign({}, ShowflowQuboBuilder.DEFAULT_WEIGHTS);
        renderPanel();
      });
    }
    const testBtn = panel.querySelector("#quantum-selftest");
    if (testBtn) {
      testBtn.addEventListener("click", () => {
        const out = panel.querySelector("#quantum-selftest-out");
        const r = ShowflowQuantumOptimization.selfTest();
        out.textContent = r.passed
          ? "Self-test passed (" + r.total + "/" + r.total + ")"
          : "Self-test failed: " + r.failed + " of " + r.total + " — " + r.results.filter((x) => !x.ok).map((x) => x.name).join(", ");
        out.className = r.passed ? "ok" : "bad";
      });
    }
  }

  function runCompare() {
    if (typeof state === "undefined") return;
    if (!state.result) {
      state.result = solve(state.workers, state.shows);
      if (typeof renderResult === "function") renderResult();
    }
    const snapshot = ShowflowQuantumOptimization.getScheduleSnapshot(state.workers, state.shows);
    const comparison = ShowflowQuantumOptimization.runQuantumOptimization(
      snapshot,
      quantumState.weights,
      state.result
    );
    quantumState.lastComparison = comparison;
    renderPanel();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function init() {
    renderPanel();
  }

  global.ShowflowQuantumUI = {
    init,
    renderPanel,
    runCompare,
    getState: () => quantumState
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
