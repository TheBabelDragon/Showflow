/**
 * Progressive enhancements for Quantum Optimization UI.
 * Loads after quantum-ui.js and upgrades comparison rendering when available.
 * Does not replace the production scheduler.
 */
(function (global) {
  "use strict";

  function enhance() {
    const UI = global.ShowflowQuantumUI;
    const QO = global.ShowflowQuantumOptimization;
    const Builder = global.ShowflowQuboBuilder;
    if (!UI || !QO || !Builder) return;

    if (typeof Builder.formatInspect !== "function") {
      Builder.formatInspect = function (model, maxTerms) {
        const limit = maxTerms || 40;
        const lines = ["--- Variables ---"];
        const vars = model.variables || [];
        for (let i = 0; i < vars.length; i++) {
          const v = vars[i];
          lines.push(
            "x" + i + " = " + (v.workerName || v.workerId) + " / " + (v.showtimeId || v.showId) +
            " · room " + v.room + " · zone " + v.zone
          );
        }
        lines.push("");
        lines.push("--- Linear (nonzero) ---");
        let shown = 0;
        for (let i = 0; i < (model.linear || []).length && shown < limit; i++) {
          const c = model.linear[i];
          if (!c || Math.abs(c) < 1e-12) continue;
          lines.push("Q[x" + i + "] = " + (c >= 0 ? "+" : "") + Number(c).toFixed(2));
          shown++;
        }
        lines.push("");
        lines.push("--- Quadratic (top by |coeff|) ---");
        const keys = Object.keys(model.quadratic || {}).sort(function (a, b) {
          return Math.abs(model.quadratic[b]) - Math.abs(model.quadratic[a]);
        });
        for (let t = 0; t < keys.length && t < limit; t++) {
          const k = keys[t];
          const c = model.quadratic[k];
          if (Math.abs(c) < 1e-12) continue;
          lines.push("Q[x" + k.replace(",", ",x") + "] = " + (c >= 0 ? "+" : "") + Number(c).toFixed(2));
        }
        const d = model.diagnostics;
        if (d) {
          lines.push("");
          lines.push("Diagnostics: " + d.variables + " vars, " + d.linearTerms + " linear, " +
            d.quadraticTerms + " quadratic, " + d.hardPenalties + " hard, " + d.softTerms + " soft");
        }
        return lines.join("\n");
      };
    }

    const origRun = QO.runQuantumOptimization;
    if (origRun && !QO._enhanced) {
      QO._enhanced = true;
      QO.runQuantumOptimization = function (snapshot, weights, classicResult) {
        const result = origRun(snapshot, weights, classicResult);
        if (!result.model) result.model = {};
        if (!result.model.diagnostics && result.model.variableCount != null) {
          try {
            const model = Builder.buildQubo(snapshot, weights);
            if (model.diagnostics) result.model.diagnostics = model.diagnostics;
            if (!result.inspectText) result.inspectText = Builder.formatInspect(model, 48);
            result.model.variables = model.variables;
            result.model.linear = model.linear;
            result.model.quadratic = model.quadratic;
            result.model.constant = model.constant;
          } catch (e) {}
        }
        if (!result.conclusion) {
          const c = result.classicMetrics || {};
          const q = result.candidateMetrics || {};
          const bullets = [];
          const passes = result.candidate && result.candidate.fullyCovered && (result.candidate.rejectedRawCount || 0) === 0;
          bullets.push(passes ? "Candidate passes Showflow validation" : "Candidate reported with residual issues");
          if (c.bOverlapTotal != null && q.bOverlapTotal != null) {
            const d = c.bOverlapTotal - q.bOverlapTotal;
            if (d > 0) bullets.push(d + " fewer B-overlap minute(s)");
            else if (d < 0) bullets.push(Math.abs(d) + " more B-overlap minute(s)");
            else bullets.push("Same B-overlap total");
          }
          if (c.workloadVariance != null && q.workloadVariance != null) {
            const cv = c.workloadVariance, qv = q.workloadVariance;
            if (cv > 0.001 && qv < cv) bullets.push(Math.round((100 * (cv - qv)) / cv) + "% better workload balance");
            else bullets.push("Similar workload balance");
          }
          const hardDelta = (q.hardViolations != null ? q.hardViolations : 0) - (c.hardViolations != null ? c.hardViolations : 0);
          if (hardDelta === 0) bullets.push("0 additional hard violations");
          else if (hardDelta > 0) bullets.push(hardDelta + " additional hard-related issue(s)");
          else bullets.push(Math.abs(hardDelta) + " fewer hard-related issue(s)");
          result.conclusion = { passesValidation: !!passes, bullets: bullets };
        }
        if (!result.note || result.note.indexOf("quantum-compatible") < 0) {
          result.note = "Quantum Optimization currently uses a local classical / quantum-inspired solver. " +
            "The QUBO formulation is quantum-compatible; no quantum hardware is required. " +
            "Candidates are validated by the existing scheduler rules and never mutate the live schedule.";
        }
        return result;
      };
    }

    const state = UI.getState();
    if (!state._enhWatch) {
      state._enhWatch = true;
      state.inspectOpen = state.inspectOpen || false;
      const origRender = UI.renderPanel;
      UI.renderPanel = function () {
        origRender();
        upgradeDom();
      };
      setTimeout(upgradeDom, 50);
    }

    function upgradeDom() {
      const panel = document.getElementById("quantum-panel");
      if (!panel) return;
      const transport = panel.querySelector(".transport");
      if (transport && !document.getElementById("quantum-inspect")) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.id = "quantum-inspect";
        btn.textContent = "Inspect QUBO";
        transport.insertBefore(btn, transport.children[1] || null);
        btn.addEventListener("click", function () {
          state.inspectOpen = !state.inspectOpen;
          if (!state.lastComparison) UI.runCompare();
          else UI.renderPanel();
        });
      }
      const cmp = state.lastComparison;
      if (cmp) {
        let diagHost = panel.querySelector(".qubo-diagnostics");
        const d = (cmp.model && cmp.model.diagnostics) || null;
        if (d && !diagHost) {
          const h = document.createElement("h3");
          h.className = "muted";
          h.style.margin = "16px 0 8px";
          h.textContent = "QUBO model";
          const strip = document.createElement("div");
          strip.className = "qubo-diagnostics";
          strip.innerHTML = "<span><strong>" + d.variables + "</strong> variables</span>" +
            "<span><strong>" + d.linearTerms + "</strong> linear</span>" +
            "<span><strong>" + d.quadraticTerms + "</strong> quadratic</span>" +
            "<span><strong>" + d.hardPenalties + "</strong> hard groups</span>" +
            "<span><strong>" + d.softTerms + "</strong> soft terms</span>";
          const cmpSection = panel.querySelector("#quantum-comparison");
          if (cmpSection && cmpSection.parentNode) {
            cmpSection.parentNode.insertBefore(h, cmpSection);
            cmpSection.parentNode.insertBefore(strip, cmpSection);
          }
        }
        if (cmp.conclusion && !panel.querySelector(".quantum-conclusion")) {
          const box = document.createElement("div");
          box.className = "quantum-conclusion";
          const icon = cmp.conclusion.passesValidation ? "\u2713" : "!";
          const cls = cmp.conclusion.passesValidation ? "ok" : "warn-text";
          box.innerHTML = '<p class="' + cls + '" style="margin:0 0 6px;font-weight:600">' + icon + " " +
            (cmp.conclusion.passesValidation ? "Candidate passes Showflow validation" : "Candidate reported with residual issues") +
            '</p><ul class="quantum-conclusion-list">' +
            (cmp.conclusion.bullets || []).map(function (b) { return "<li>" + escapeHtml(b) + "</li>"; }).join("") +
            "</ul>";
          const cmpEl = panel.querySelector("#quantum-comparison");
          if (cmpEl) cmpEl.appendChild(box);
        }
        let inspect = panel.querySelector(".qubo-inspect");
        if (state.inspectOpen && cmp.inspectText) {
          if (!inspect) {
            inspect = document.createElement("div");
            inspect.className = "qubo-inspect";
            const body = panel.querySelector("#quantum-body");
            if (body) body.appendChild(inspect);
          }
          inspect.innerHTML = "<h3>Inspect QUBO</h3><pre class=\"qubo-inspect-pre\">" + escapeHtml(cmp.inspectText) + "</pre>";
        } else if (inspect) {
          inspect.remove();
        }
      }
    }

    function escapeHtml(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, """);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhance);
  } else {
    enhance();
  }
  setTimeout(enhance, 100);
  setTimeout(enhance, 500);
})(typeof window !== "undefined" ? window : globalThis);
