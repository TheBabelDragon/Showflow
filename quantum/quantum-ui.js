/**
 * Quantum Optimization panel UI for GitHub Pages.
 * Modular Optimization Parameters — hard vs soft, presets, inspect, comparison.
 * Isolated experiment — does not replace the production solve path.
 */
(function (global) {
  "use strict";

  const isStandalone =
    document.documentElement.dataset.quantumStandalone === "1" ||
    /quantum\.html/i.test(location.pathname);

  const P = global.ShowflowOptimizationParams;

  const quantumState = {
    enabled: isStandalone,
    params: P ? P.defaults() : Object.assign({}, ShowflowQuboBuilder.DEFAULT_WEIGHTS),
    lastPolicy: null,
    lastComparison: null,
    inspectOpen: false,
    openGroups: { feasibility: true, overlap: true, workload: false, spatial: false, room: false }
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

  function readParamsFromDom(panel) {
    if (!P) return quantumState.params;
    const params = P.clone(quantumState.params);
    for (const s of P.PARAM_SCHEMA) {
      const el = panel.querySelector('[data-op="' + s.key + '"]');
      if (!el) continue;
      if (s.options) {
        params[s.key] = el.value;
      } else {
        const n = Number(el.value);
        if (!Number.isNaN(n)) params[s.key] = n;
      }
    }
    quantumState.params = params;
    return params;
  }

  function paramControl(s, value) {
    const kindBadge =
      s.kind === "hard"
        ? '<span class="op-kind op-hard">HARD</span>'
        : '<span class="op-kind op-soft">SOFT</span>';
    const unit = s.unit ? ' <span class="muted">' + s.unit + "</span>" : "";
    let input;
    if (s.options) {
      input =
        '<select data-op="' +
        s.key +
        '" class="op-select">' +
        s.options
          .map(function (o) {
            return (
              '<option value="' +
              o +
              '"' +
              (value === o ? " selected" : "") +
              ">" +
              o +
              "</option>"
            );
          })
          .join("") +
        "</select>";
    } else {
      const step = s.step != null ? s.step : 1;
      input =
        '<input type="range" min="' +
        s.min +
        '" max="' +
        s.max +
        '" step="' +
        step +
        '" data-op="' +
        s.key +
        '" value="' +
        value +
        '" class="op-slider">' +
        '<input type="number" min="' +
        s.min +
        '" max="' +
        s.max +
        '" step="' +
        step +
        '" data-op-num="' +
        s.key +
        '" value="' +
        value +
        '" class="op-num">';
    }
    return (
      '<div class="op-row" data-param="' +
      s.key +
      '">' +
      '<div class="op-label-row">' +
      "<label>" +
      escapeHtml(s.label) +
      unit +
      "</label>" +
      kindBadge +
      "</div>" +
      '<div class="op-controls">' +
      input +
      "</div>" +
      '<p class="op-desc muted">' +
      escapeHtml(s.description) +
      "</p>" +
      '<p class="op-effect muted">' +
      escapeHtml(s.effect) +
      "</p>" +
      "</div>"
    );
  }

  function renderParamGroups(params) {
    if (!P) {
      return '<p class="muted">Parameter model not loaded.</p>';
    }
    return P.GROUPS.map(function (g) {
      const open = quantumState.openGroups[g.id] !== false;
      const fields = P.PARAM_SCHEMA.filter(function (s) {
        return s.group === g.id;
      });
      const body = fields
        .map(function (s) {
          return paramControl(s, params[s.key] != null ? params[s.key] : s.default);
        })
        .join("");
      return (
        '<details class="op-group" data-group="' +
        g.id +
        '"' +
        (open ? " open" : "") +
        ">" +
        "<summary>" +
        escapeHtml(g.title) +
        "</summary>" +
        '<div class="op-group-body">' +
        body +
        "</div></details>"
      );
    }).join("");
  }

  function renderPanel() {
    const panel = ensurePanel();
    const params = quantumState.params;
    const cmp = quantumState.lastComparison;

    let comparisonHtml = isStandalone
      ? '<div class="empty">Load sample day, then Solve + compare (or Compare below).</div>'
      : '<div class="empty">Enable and run Compare after solving the normal schedule.</div>';

    if (cmp) {
      const c = cmp.classicMetrics || {};
      const q = cmp.candidateMetrics || {};
      const statusCls = cmp.conclusion && cmp.conclusion.passesValidation ? "ok" : "bad";
      const statusText =
        (cmp.conclusion && cmp.conclusion.statusLabel) ||
        (cmp.conclusion && cmp.conclusion.passesValidation ? "Candidate VALID" : "Candidate REJECTED");

      let measurableHtml = "";
      if (cmp.measurable && cmp.measurable.length) {
        measurableHtml =
          '<div class="op-measurable"><h4 class="muted">Measured effect of policy</h4><ul>' +
          cmp.measurable.map(function (m) {
            return "<li>" + escapeHtml(m) + "</li>";
          }).join("") +
          "</ul></div>";
      }

      comparisonHtml =
        '<div class="quantum-status ' +
        statusCls +
        '">' +
        escapeHtml(statusText) +
        "</div>" +
        '<div class="quantum-compare">' +
        '<div class="quantum-col">' +
        "<h3>Normal Scheduler</h3>" +
        '<div class="muted">Authoritative</div>' +
        "<table>" +
        '<tr><td>Coverage</td><td class="' +
        (c.fullyCovered ? "ok" : "bad") +
        '">' +
        (c.coveragePct != null ? c.coveragePct + "%" : "—") +
        "</td></tr>" +
        '<tr><td>Hard / gaps</td><td class="' +
        (c.gapCount ? "bad" : "ok") +
        '">' +
        (c.gapCount != null ? c.gapCount : "—") +
        "</td></tr>" +
        "<tr><td>Assignments</td><td>" +
        (c.assignmentCount != null ? c.assignmentCount : "—") +
        "</td></tr>" +
        '<tr><td>Warnings</td><td class="' +
        (c.warningCount ? "warn-text" : "ok") +
        '">' +
        (c.warningCount != null ? c.warningCount : "—") +
        "</td></tr>" +
        "<tr><td>B overlap (min)</td><td>" +
        (c.bOverlapTotal != null ? c.bOverlapTotal : "—") +
        "</td></tr>" +
        "<tr><td>C proximity events</td><td>" +
        (c.cProximityEvents != null ? c.cProximityEvents : "—") +
        "</td></tr>" +
        "<tr><td>Zone transitions</td><td>" +
        (c.zoneTransitions != null ? c.zoneTransitions : "—") +
        "</td></tr>" +
        "<tr><td>Workload variance</td><td>" +
        (c.workloadVariance != null ? c.workloadVariance : "—") +
        "</td></tr>" +
        "</table></div>" +
        '<div class="quantum-col">' +
        "<h3>Quantum Optimization</h3>" +
        '<div class="muted">' +
        escapeHtml(cmp.solution.method) +
        " · " +
        cmp.solution.runtimeMs.toFixed(1) +
        " ms</div>" +
        "<table>" +
        '<tr><td>Coverage</td><td class="' +
        (q.fullyCovered ? "ok" : "bad") +
        '">' +
        (q.coveragePct != null ? q.coveragePct + "%" : "—") +
        "</td></tr>" +
        '<tr><td>Hard / gaps</td><td class="' +
        (q.gapCount ? "bad" : "ok") +
        '">' +
        (q.gapCount != null ? q.gapCount : "—") +
        "</td></tr>" +
        "<tr><td>Assignments</td><td>" +
        (q.assignmentCount != null ? q.assignmentCount : "—") +
        "</td></tr>" +
        '<tr><td>Warnings</td><td class="' +
        (q.warningCount ? "warn-text" : "ok") +
        '">' +
        (q.warningCount != null ? q.warningCount : "—") +
        "</td></tr>" +
        "<tr><td>B overlap (min)</td><td>" +
        (q.bOverlapTotal != null ? q.bOverlapTotal : "—") +
        "</td></tr>" +
        "<tr><td>C proximity events</td><td>" +
        (q.cProximityEvents != null ? q.cProximityEvents : "—") +
        "</td></tr>" +
        "<tr><td>Zone transitions</td><td>" +
        (q.zoneTransitions != null ? q.zoneTransitions : "—") +
        "</td></tr>" +
        "<tr><td>Workload variance</td><td>" +
        (q.workloadVariance != null ? q.workloadVariance : "—") +
        "</td></tr>" +
        '<tr><td>QUBO energy</td><td class="ok">' +
        Number(cmp.solution.energy).toFixed(2) +
        "</td></tr>" +
        "<tr><td>Variables</td><td>" +
        cmp.model.variableCount +
        "</td></tr>" +
        '<tr><td>Rejected illegal</td><td class="' +
        (cmp.candidate.rejectedRawCount ? "warn-text" : "ok") +
        '">' +
        (cmp.candidate.rejectedRawCount || 0) +
        "</td></tr>" +
        "</table></div></div>" +
        measurableHtml;

      if (cmp.conclusion && cmp.conclusion.bullets) {
        comparisonHtml +=
          '<ul class="quantum-conclusion-list">' +
          cmp.conclusion.bullets
            .map(function (b) {
              return "<li>" + escapeHtml(b) + "</li>";
            })
            .join("") +
          "</ul>";
      }

      if (cmp.model && cmp.model.diagnostics) {
        const d = cmp.model.diagnostics;
        comparisonHtml +=
          '<div class="qubo-diagnostics">' +
          "<span><strong>" +
          d.variables +
          "</strong> variables</span>" +
          "<span><strong>" +
          d.linearTerms +
          "</strong> linear</span>" +
          "<span><strong>" +
          d.quadraticTerms +
          "</strong> quadratic</span>" +
          "<span><strong>" +
          d.hardPenalties +
          "</strong> hard-like</span>" +
          "<span><strong>" +
          d.softTerms +
          "</strong> soft</span>" +
          (d.totalWeightedTerms != null
            ? "<span><strong>" + d.totalWeightedTerms + "</strong> total weighted</span>"
            : "") +
          "</div>";
      }

      comparisonHtml +=
        '<p class="muted" style="margin-top:10px">' + escapeHtml(cmp.note) + "</p>";
    }

    const enableBlock = isStandalone
      ? ""
      : '<label class="quantum-toggle"><input type="checkbox" id="quantum-enable" ' +
        (quantumState.enabled ? "checked" : "") +
        "><span>Enable Quantum Optimization experiment</span></label>";

    const inspectBlock =
      quantumState.inspectOpen && cmp && cmp.inspectText
        ? '<div class="qubo-inspect"><h3>Inspect QUBO</h3><pre class="qubo-inspect-pre">' +
          escapeHtml(cmp.inspectText) +
          "</pre></div>"
        : "";

    panel.innerHTML =
      "<h2>Quantum Optimization <span class=\"quantum-badge\">Experimental</span></h2>" +
      '<p class="muted" style="margin:0 0 12px">' +
      "Modular optimization laboratory. Adjust operational assumptions → they become QUBO coefficients → " +
      "local classical / quantum-inspired solver → existing Showflow validator. " +
      "Comparison only — never mutates the live schedule. No quantum hardware required." +
      "</p>" +
      enableBlock +
      '<div id="quantum-body" style="' +
      (quantumState.enabled || isStandalone ? "" : "display:none") +
      '">' +
      '<h3 class="muted" style="margin:14px 0 8px">Optimization Parameters</h3>' +
      '<div class="op-presets transport">' +
      '<button type="button" data-preset="strict">Strict</button>' +
      '<button type="button" data-preset="balanced">Balanced</button>' +
      '<button type="button" data-preset="flexible">Flexible</button>' +
      '<button type="button" id="quantum-reset-params">Reset to defaults</button>' +
      "</div>" +
      '<div class="op-params">' +
      renderParamGroups(params) +
      "</div>" +
      '<div class="transport" style="margin-top:12px">' +
      '<button type="button" id="quantum-compare" class="primary">Solve + compare</button>' +
      '<button type="button" id="quantum-inspect">Inspect QUBO</button>' +
      '<button type="button" id="quantum-selftest">Run self-test</button>' +
      "</div>" +
      '<div id="quantum-selftest-out" class="muted" style="margin-top:8px"></div>' +
      '<h3 class="muted" style="margin:16px 0 8px">Comparison</h3>' +
      '<div id="quantum-comparison">' +
      comparisonHtml +
      "</div>" +
      inspectBlock +
      "</div>";

    wirePanel(panel);
  }

  function wirePanel(panel) {
    const enable = panel.querySelector("#quantum-enable");
    if (enable) {
      enable.addEventListener("change", function () {
        quantumState.enabled = enable.checked;
        if (!quantumState.enabled) quantumState.lastComparison = null;
        renderPanel();
      });
    }

    panel.querySelectorAll(".op-slider").forEach(function (range) {
      const key = range.getAttribute("data-op");
      const num = panel.querySelector('[data-op-num="' + key + '"]');
      range.addEventListener("input", function () {
        if (num) num.value = range.value;
      });
      if (num) {
        num.addEventListener("change", function () {
          range.value = num.value;
        });
      }
    });

    panel.querySelectorAll("details.op-group").forEach(function (det) {
      det.addEventListener("toggle", function () {
        const id = det.getAttribute("data-group");
        if (id) quantumState.openGroups[id] = det.open;
      });
    });

    panel.querySelectorAll("[data-preset]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!P) return;
        quantumState.params = P.applyPreset(btn.getAttribute("data-preset"));
        renderPanel();
      });
    });

    const resetBtn = panel.querySelector("#quantum-reset-params");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (P) quantumState.params = P.defaults();
        else quantumState.params = Object.assign({}, ShowflowQuboBuilder.DEFAULT_WEIGHTS);
        renderPanel();
      });
    }

    const compareBtn = panel.querySelector("#quantum-compare");
    if (compareBtn) {
      compareBtn.addEventListener("click", function () {
        readParamsFromDom(panel);
        runCompare();
      });
    }

    const inspectBtn = panel.querySelector("#quantum-inspect");
    if (inspectBtn) {
      inspectBtn.addEventListener("click", function () {
        quantumState.inspectOpen = !quantumState.inspectOpen;
        if (!quantumState.lastComparison) {
          readParamsFromDom(panel);
          runCompare();
        } else {
          renderPanel();
        }
      });
    }

    const testBtn = panel.querySelector("#quantum-selftest");
    if (testBtn) {
      testBtn.addEventListener("click", function () {
        const out = panel.querySelector("#quantum-selftest-out");
        const r = ShowflowQuantumOptimization.selfTest();
        out.textContent = r.passed
          ? "Self-test passed (" + r.total + "/" + r.total + ")"
          : "Self-test failed: " +
            r.failed +
            " of " +
            r.total +
            " — " +
            r.results
              .filter(function (x) {
                return !x.ok;
              })
              .map(function (x) {
                return x.name;
              })
              .join(", ");
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
    const prevPolicy = quantumState.lastPolicy;
    const comparison = ShowflowQuantumOptimization.runQuantumOptimization(
      snapshot,
      quantumState.params,
      state.result,
      prevPolicy
    );
    quantumState.lastComparison = comparison;
    if (comparison.policy) quantumState.lastPolicy = comparison.policy;
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
    init: init,
    renderPanel: renderPanel,
    runCompare: runCompare,
    getState: function () {
      return quantumState;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
