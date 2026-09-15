/**
 * Progressive enhancements for Quantum Optimization UI.
 * Kept thin — primary controls live in quantum-ui.js with the modular parameter model.
 * Does not replace the production scheduler.
 */
(function (global) {
  "use strict";

  function enhance() {
    // Ensure formatInspect exists even if inspect module load order varies
    const Builder = global.ShowflowQuboBuilder;
    if (Builder && typeof Builder.formatInspect !== "function" && Builder.computeDiagnostics) {
      // no-op: qubo-inspect.js owns the rich formatter
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhance);
  } else {
    enhance();
  }
})(typeof window !== "undefined" ? window : globalThis);
