/**
 * Single authoritative parameter model for Quantum Optimization.
 * Hard constraints determine feasibility; soft parameters determine preference.
 * UI, QUBO builder, and solver all consume this model — never read DOM directly
 * from the builder.
 */
(function (global) {
  "use strict";

  /**
   * Parameter schema. Each entry documents:
   *   key, label, unit, kind (hard|soft), default, min, max, step, group, description, effect
   * Overlap is the reference modular policy: preferred / maximum / penalty / curve.
   */
  const PARAM_SCHEMA = [
    // —— FEASIBILITY (hard) ——
    {
      key: "maxAOverlapMinutes",
      label: "Maximum A overlap",
      unit: "min",
      kind: "hard",
      default: 0,
      min: 0,
      max: 60,
      step: 5,
      group: "feasibility",
      description: "Maximum permitted A-window overlap between assignments of the same worker (0 = none, except first-set exception).",
      effect: "Pairs exceeding this become hard conflicts (large QUBO penalty)."
    },
    {
      key: "maxBOverlapMinutes",
      label: "Maximum B overlap",
      unit: "min",
      kind: "hard",
      default: 30,
      min: 0,
      max: 90,
      step: 5,
      group: "feasibility",
      description: "Maximum permitted B-window overlap. Matches the production scheduler tolerance by default.",
      effect: "B overlap above this threshold is a hard conflict."
    },
    {
      key: "hardConflictPenalty",
      label: "Hard conflict penalty",
      unit: "",
      kind: "hard",
      default: 1000,
      min: 100,
      max: 10000,
      step: 50,
      group: "feasibility",
      description: "Quadratic penalty strength applied to every hard-infeasible pair.",
      effect: "Larger values make illegal pairs strongly disfavored by the solver."
    },
    {
      key: "missingCoveragePenalty",
      label: "Missing coverage penalty",
      unit: "",
      kind: "hard",
      default: 2000,
      min: 100,
      max: 20000,
      step: 100,
      group: "feasibility",
      description: "Penalty for under- or over-covering a showtime relative to required workers.",
      effect: "Drives exact staffing count per showtime."
    },
    {
      key: "firstSetGuestLimit",
      label: "First-set A exception guest limit",
      unit: "guests",
      kind: "hard",
      default: 10,
      min: 0,
      max: 40,
      step: 1,
      group: "feasibility",
      description: "Inside the opening first-set cohort, A overlap is allowed when each room has fewer guests than this limit.",
      effect: "Controls the named first-set A exception used by both scheduler and QUBO."
    },

    // —— OVERLAP (modular demonstration) ——
    {
      key: "preferredBOverlapMinutes",
      label: "Preferred B overlap",
      unit: "min",
      kind: "soft",
      default: 0,
      min: 0,
      max: 60,
      step: 5,
      group: "overlap",
      description: "Ideal B-window overlap. Soft penalty applies only to minutes above this preferred value (up to the hard maximum).",
      effect: "Shapes the soft B-overlap objective; does not change feasibility."
    },
    {
      key: "bOverlapPenalty",
      label: "B overlap penalty",
      unit: "",
      kind: "soft",
      default: 20,
      min: 0,
      max: 200,
      step: 1,
      group: "overlap",
      description: "Soft weight for excess B-window overlap (minutes above preferred, scaled).",
      effect: "Higher values discourage B overlap more strongly in the objective."
    },
    {
      key: "bOverlapCurve",
      label: "B overlap penalty curve",
      unit: "",
      kind: "soft",
      default: "linear",
      options: ["linear", "quadratic"],
      group: "overlap",
      description: "How excess B overlap is scaled: linear in minutes, or quadratic (minutes² / 30).",
      effect: "Changes the mathematical form of soft B-overlap terms in the QUBO."
    },
    {
      key: "cProximityMinutes",
      label: "C proximity window",
      unit: "min",
      kind: "soft",
      default: 15,
      min: 0,
      max: 60,
      step: 5,
      group: "overlap",
      description: "C-end events closer than this window incur a soft proximity penalty.",
      effect: "Defines the distance threshold for C-proximity soft terms."
    },
    {
      key: "cProximityPenalty",
      label: "C proximity penalty",
      unit: "",
      kind: "soft",
      default: 8,
      min: 0,
      max: 100,
      step: 1,
      group: "overlap",
      description: "Soft weight for tight C-end proximity.",
      effect: "Discourages back-to-back C events within the proximity window."
    },

    // —— WORKLOAD ——
    {
      key: "workloadBalanceWeight",
      label: "Workload balance weight",
      unit: "",
      kind: "soft",
      default: 4,
      min: 0,
      max: 50,
      step: 0.5,
      group: "workload",
      description: "Penalty for concentrating many showtimes on the same worker.",
      effect: "Encourages spreading assignments across the crew."
    },

    // —— SPATIAL / ZONE ——
    {
      key: "zoneTransitionWeight",
      label: "Zone transition weight",
      unit: "",
      kind: "soft",
      default: 5,
      min: 0,
      max: 50,
      step: 0.5,
      group: "spatial",
      description: "Cost of a worker moving between MAIN and SIDE zones on consecutive assignments.",
      effect: "Prefers zone continuity."
    },

    // —— ROOM / LEAD ——
    {
      key: "roomFamilyWeight",
      label: "Room-family pairing weight",
      unit: "",
      kind: "soft",
      default: 3,
      min: 0,
      max: 50,
      step: 0.5,
      group: "room",
      description: "Bonus for preferred / same-family room pairs when A windows interact; also used for preferred-zone linear terms.",
      effect: "Favors operationally friendly room combinations and preferred zones."
    },
    {
      key: "leadPreferenceWeight",
      label: "Theater-lead preference weight",
      unit: "",
      kind: "soft",
      default: -10,
      min: -50,
      max: 0,
      step: 1,
      group: "room",
      description: "Linear preference (typically negative energy) scaled by a worker's lead weight for the theater.",
      effect: "Encourages higher-lead-weight workers to be selected where they can cover."
    }
  ];

  const GROUPS = [
    { id: "feasibility", title: "Feasibility (hard constraints)" },
    { id: "overlap", title: "Overlap" },
    { id: "workload", title: "Workload" },
    { id: "spatial", title: "Spatial / zone" },
    { id: "room", title: "Room / lead" }
  ];

  function defaults() {
    const p = {};
    for (const s of PARAM_SCHEMA) {
      p[s.key] = s.default;
    }
    return p;
  }

  function clone(params) {
    return Object.assign({}, defaults(), params || {});
  }

  function serialize(params) {
    return JSON.stringify(clone(params));
  }

  function deserialize(json) {
    try {
      const o = typeof json === "string" ? JSON.parse(json) : json;
      return clone(o);
    } catch (e) {
      return defaults();
    }
  }

  /** Presets populate the same modular model — no separate solvers. */
  const PRESETS = {
    strict: {
      maxAOverlapMinutes: 0,
      maxBOverlapMinutes: 15,
      hardConflictPenalty: 2000,
      missingCoveragePenalty: 3000,
      firstSetGuestLimit: 8,
      preferredBOverlapMinutes: 0,
      bOverlapPenalty: 40,
      bOverlapCurve: "quadratic",
      cProximityMinutes: 10,
      cProximityPenalty: 15,
      workloadBalanceWeight: 8,
      zoneTransitionWeight: 10,
      roomFamilyWeight: 5,
      leadPreferenceWeight: -15
    },
    balanced: defaults(),
    flexible: {
      maxAOverlapMinutes: 10,
      maxBOverlapMinutes: 45,
      hardConflictPenalty: 800,
      missingCoveragePenalty: 1500,
      firstSetGuestLimit: 12,
      preferredBOverlapMinutes: 10,
      bOverlapPenalty: 8,
      bOverlapCurve: "linear",
      cProximityMinutes: 20,
      cProximityPenalty: 4,
      workloadBalanceWeight: 2,
      zoneTransitionWeight: 2,
      roomFamilyWeight: 2,
      leadPreferenceWeight: -6
    }
  };

  function applyPreset(name) {
    const base = PRESETS[name];
    if (!base) return defaults();
    return clone(base);
  }

  /**
   * Map modular params → legacy weight bag used by older call sites,
   * plus explicit hard thresholds the QUBO builder must honor.
   */
  function toBuilderConfig(params) {
    const p = clone(params);
    return {
      // soft / objective weights (legacy keys kept for compatibility)
      hardConflict: p.hardConflictPenalty,
      missingCoverage: p.missingCoveragePenalty,
      bOverlap: p.bOverlapPenalty,
      cProximity: p.cProximityPenalty,
      workloadBalance: p.workloadBalanceWeight,
      zoneTransition: p.zoneTransitionWeight,
      roomFamily: p.roomFamilyWeight,
      leadPreference: p.leadPreferenceWeight,
      // modular hard / soft thresholds
      maxAOverlapMinutes: p.maxAOverlapMinutes,
      maxBOverlapMinutes: p.maxBOverlapMinutes,
      preferredBOverlapMinutes: p.preferredBOverlapMinutes,
      bOverlapCurve: p.bOverlapCurve === "quadratic" ? "quadratic" : "linear",
      cProximityMinutes: p.cProximityMinutes,
      firstSetGuestLimit: p.firstSetGuestLimit,
      // full params snapshot
      params: p
    };
  }

  /**
   * Human-readable policy summary for before/after measurement.
   */
  function policySummary(params) {
    const p = clone(params);
    return {
      maxBOverlap: p.maxBOverlapMinutes,
      preferredBOverlap: p.preferredBOverlapMinutes,
      bPenalty: p.bOverlapPenalty,
      bCurve: p.bOverlapCurve,
      cProximityWindow: p.cProximityMinutes,
      cPenalty: p.cProximityPenalty,
      workload: p.workloadBalanceWeight,
      zoneTransition: p.zoneTransitionWeight,
      roomFamily: p.roomFamilyWeight,
      lead: p.leadPreferenceWeight,
      hardConflict: p.hardConflictPenalty,
      coverage: p.missingCoveragePenalty
    };
  }

  global.ShowflowOptimizationParams = {
    PARAM_SCHEMA,
    GROUPS,
    PRESETS,
    defaults,
    clone,
    serialize,
    deserialize,
    applyPreset,
    toBuilderConfig,
    policySummary
  };
})(typeof window !== "undefined" ? window : globalThis);
