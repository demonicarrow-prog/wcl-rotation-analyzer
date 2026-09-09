import type { ShadowPriestState } from "./shadowPriestArchon";

const DEBUFF_IDS = {
  vampiricTouch: 34914,
  shadowWordPain: 589,
  shadowWordMadness: 335467,
};

const BUFF_IDS = {
  voidform: 194249,
};

// Base durations in ms - used to compute "% remaining" from apply/refresh timestamps.
// NOTE: these are baseline values and may be extended by talents (e.g. Misery extends
// VT/SWP to 21s). Treat this as an approximation until validated against real data.
const BASE_DURATIONS_MS = {
  vampiricTouch: 21000,
  shadowWordPain: 16000,
  shadowWordMadness: 12000, // needs validation - approximate
};

// Base cooldowns in ms for the Archon major cooldowns, pulled from current (patch 12.1)
// guides as of this writing. These do NOT account for haste, talent CDR (e.g. Perfected
// Form/Sustained Potency-style effects), or trinket procs, so treat "available" as an
// approximation - validate against a log where you know for certain what was on CD.
const COOLDOWNS_MS = {
  halo: 60000, // 1 min base
  voidform: 120000, // 2 min base (this is the "Voidform" cast itself, not the buff)
  powerInfusion: 120000, // 2 min base
  voidVolley: 15000, // short CD spammed on cooldown during Voidform - needs validation
};

// Real ability names as they appear in WCL cast events for these cooldowns.
const COOLDOWN_ABILITY_NAMES = {
  halo: "Halo",
  voidform: "Voidform",
  powerInfusion: "Power Infusion",
  voidVolley: "Void Volley",
};

type RawEvent = {
  timestamp: number;
  type: string;
  abilityGameID?: number;
  targetID?: number;
  sourceID?: number;
  resourceChange?: number;
  resourceChangeType?: number;
  maxResourceAmount?: number;
  abilityName?: string;
  _source: "cast" | "buff" | "debuff" | "resource";
};

export type CastWithState = {
  timestamp: number;
  ability: string;
  state: ShadowPriestState;
};

export function extractStatesAtCasts(events: RawEvent[], sourceID: number): CastWithState[] {
  let insanity = 0;
  let inVoidform = false;
  let vtAppliedAt: number | null = null;
  let swpAppliedAt: number | null = null;
  let madnessAppliedAt: number | null = null;
  let previousCast: string | null = null;

  // null = never cast yet this pull, which we treat as "available" (assume full CDs at pull).
  let lastHaloCastAt: number | null = null;
  let lastVoidformCastAt: number | null = null;
  let lastPowerInfusionCastAt: number | null = null;
  let lastVoidVolleyCastAt: number | null = null;

  const results: CastWithState[] = [];

  function pctRemaining(appliedAt: number | null, durationMs: number, now: number): number {
    if (appliedAt === null) return 0;
    const elapsed = now - appliedAt;
    const remaining = durationMs - elapsed;
    if (remaining <= 0) return 0;
    return (remaining / durationMs) * 100;
  }

  function isAvailable(lastCastAt: number | null, cooldownMs: number, now: number): boolean {
    if (lastCastAt === null) return true;
    return now - lastCastAt >= cooldownMs;
  }

  for (const e of events) {
    if (e._source === "debuff" && e.sourceID === sourceID) {
      if (e.abilityGameID === DEBUFF_IDS.vampiricTouch) {
        if (e.type === "applydebuff" || e.type === "refreshdebuff") vtAppliedAt = e.timestamp;
        if (e.type === "removedebuff") vtAppliedAt = null;
      }
      if (e.abilityGameID === DEBUFF_IDS.shadowWordPain) {
        if (e.type === "applydebuff" || e.type === "refreshdebuff") swpAppliedAt = e.timestamp;
        if (e.type === "removedebuff") swpAppliedAt = null;
      }
      if (e.abilityGameID === DEBUFF_IDS.shadowWordMadness) {
        if (e.type === "applydebuff" || e.type === "refreshdebuff") madnessAppliedAt = e.timestamp;
        if (e.type === "removedebuff") madnessAppliedAt = null;
      }
    }

    if (e._source === "buff") {
      if (e.abilityGameID === BUFF_IDS.voidform) {
        if (e.type === "applybuff") inVoidform = true;
        if (e.type === "removebuff") inVoidform = false;
      }
    }

    if (e._source === "resource") {
      if (e.resourceChangeType === 13 && e.maxResourceAmount === 10000) {
        // WCL reports Insanity scaled by 100 - convert to real 0-100 value
        insanity = Math.min(100, insanity + (e.resourceChange ?? 0) / 100);
      }
    }

    if (e._source === "cast" && e.type === "cast") {
      // Availability reflects what was true immediately BEFORE this cast happened,
      // so grading this cast against "should Halo/Voidform/PI/Void Volley have been
      // used here" is judged on cooldown state as of that moment - same pattern as
      // previousCast below.
      results.push({
        timestamp: e.timestamp,
        ability: e.abilityName ?? String(e.abilityGameID),
        state: {
          insanity,
          vtRemainingPct: pctRemaining(vtAppliedAt, BASE_DURATIONS_MS.vampiricTouch, e.timestamp),
          swpRemainingPct: pctRemaining(swpAppliedAt, BASE_DURATIONS_MS.shadowWordPain, e.timestamp),
          swMadnessRemainingPct: pctRemaining(madnessAppliedAt, BASE_DURATIONS_MS.shadowWordMadness, e.timestamp),
          inVoidform,
          haloAvailable: isAvailable(lastHaloCastAt, COOLDOWNS_MS.halo, e.timestamp),
          voidformAvailable: isAvailable(lastVoidformCastAt, COOLDOWNS_MS.voidform, e.timestamp),
          powerInfusionAvailable: isAvailable(lastPowerInfusionCastAt, COOLDOWNS_MS.powerInfusion, e.timestamp),
          voidVolleyAvailable: isAvailable(lastVoidVolleyCastAt, COOLDOWNS_MS.voidVolley, e.timestamp),
          mindBlastCharges: 0, // TODO: not implemented - needs cooldown/charge tracking layer
          tentacleSlamCharges: 0, // TODO: not implemented - same as above
          targetHealthPct: 100, // TODO: not implemented - needs health-tracking from damage events
          previousCast,
        },
      });

      const castName = e.abilityName ?? String(e.abilityGameID);
      if (castName === COOLDOWN_ABILITY_NAMES.halo) lastHaloCastAt = e.timestamp;
      if (castName === COOLDOWN_ABILITY_NAMES.voidform) lastVoidformCastAt = e.timestamp;
      if (castName === COOLDOWN_ABILITY_NAMES.powerInfusion) lastPowerInfusionCastAt = e.timestamp;
      if (castName === COOLDOWN_ABILITY_NAMES.voidVolley) lastVoidVolleyCastAt = e.timestamp;

      previousCast = castName;
    }
  }

  return results;
}