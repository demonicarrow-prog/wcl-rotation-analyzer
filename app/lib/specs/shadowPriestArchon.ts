export type ShadowPriestState = {
  insanity: number; // 0-100
  vtRemainingPct: number; // % of Vampiric Touch's max duration remaining (0 if not active)
  swpRemainingPct: number; // % of Shadow Word: Pain's max duration remaining (0 if not active)
  swMadnessRemainingPct: number; // % of Shadow Word: Madness's max duration remaining (0 if not active)
  inVoidform: boolean;
  haloAvailable: boolean; // true if Halo's ~1min cooldown has elapsed (or never cast this pull)
  voidformAvailable: boolean; // true if Voidform's ~2min cooldown has elapsed (or never cast this pull)
  powerInfusionAvailable: boolean; // true if Power Infusion's ~2min cooldown has elapsed (or never cast this pull)
  voidVolleyAvailable: boolean; // true if Void Volley's ~15s cooldown has elapsed (or never cast this pull)
  mindBlastCharges: number; // 0-2
  tentacleSlamCharges: number; // 0-2 (assumed cap, needs validation)
  targetHealthPct: number; // 0-100, target of current cast
  previousCast: string | null;
};

export type ShadowPriestAction =
  | "VampiricTouch"
  | "ShadowWordPain"
  | "Halo"
  | "Voidform"
  | "PowerInfusion"
  | "ShadowWordDeath"
  | "ShadowWordMadness"
  | "TentacleSlam"
  | "MindBlast"
  | "MindFlayInsanity"
  | "VoidVolley"
  | "MindFlay";

const PANDEMIC_THRESHOLD = 30; // refresh DoTs at <=30% duration remaining

export function evaluateShadowPriestPriority(s: ShadowPriestState): {
  action: ShadowPriestAction;
  reason: string;
} {
  // 1. Keep core DoTs active - highest priority
  if (s.vtRemainingPct <= 0) {
    return { action: "VampiricTouch", reason: "Vampiric Touch not active, apply it" };
  }
  if (s.swpRemainingPct <= 0) {
    return { action: "ShadowWordPain", reason: "Shadow Word: Pain not active, apply it" };
  }
  if (s.vtRemainingPct <= PANDEMIC_THRESHOLD) {
    return { action: "VampiricTouch", reason: "Vampiric Touch in pandemic window, refresh" };
  }
  if (s.swpRemainingPct <= PANDEMIC_THRESHOLD) {
    return { action: "ShadowWordPain", reason: "Shadow Word: Pain in pandemic window, refresh" };
  }

  // 2. Major cooldowns (Archon-specific: Halo, Voidform, Power Infusion)
  // Voidform is the anchor cooldown - use it the moment it's up. Power Infusion should
  // always be combined with Voidform (per current guides), so it's gated on already being
  // in Voidform rather than firing independently. Halo has a much shorter cooldown and
  // cycles on its own, so it's checked separately and doesn't wait on the other two.
  // NOTE: cooldown values are base (no haste/talent CDR accounted for) - validate against
  // a log where you know for certain what was actually available.
  if (s.voidformAvailable) {
    return { action: "Voidform", reason: "Voidform off cooldown, use as main cooldown" };
  }
  if (s.inVoidform && s.powerInfusionAvailable) {
    return { action: "PowerInfusion", reason: "In Voidform and Power Infusion available, sync them" };
  }
  if (s.haloAvailable) {
    return { action: "Halo", reason: "Halo off cooldown, use it" };
  }

  // 3. Void Volley - short (~15s) cooldown spent on cooldown throughout the Voidform
  // window, similar to how Void Bolt worked previously. Checked ahead of SW:Madness/Mind
  // Flay: Insanity so it doesn't get starved out by Insanity-spending priorities while
  // in Voidform. NOTE: cooldown value needs validation.
  // TEMP DIAGNOSTIC MARKER - remove "MARKER123 - " once confirmed this code is live.
  if (s.inVoidform && s.voidVolleyAvailable) {
    return { action: "VoidVolley", reason: "MARKER123 - In Voidform and Void Volley off cooldown, use it" };
  }

  // 4. Shadow Word: Madness uptime, avoiding Insanity capping
  const insanityDeficit = 100 - s.insanity;
  if (s.swMadnessRemainingPct <= 0 || insanityDeficit <= 35 || s.inVoidform) {
    if (s.insanity >= 30) {
      // Rough cost approximation for SW:Madness - needs validation
      return { action: "ShadowWordMadness", reason: "Maintain Shadow Word: Madness, avoid capping Insanity" };
    }
  }

  // 5. Tentacle Slam - maintenance tool, use before capping charges or if VT missing
  if (s.tentacleSlamCharges >= 2) {
    return { action: "TentacleSlam", reason: "About to cap Tentacle Slam charges" };
  }

  // 6. Mind Blast - avoid losing charges
  if (s.mindBlastCharges >= 2) {
    return { action: "MindBlast", reason: "Mind Blast capped on charges, use one" };
  }

  // 7. Shadow Word: Death execute range
  if (s.targetHealthPct <= 20) {
    return { action: "ShadowWordDeath", reason: "Target below 20% health, execute" };
  }

  // 8. Mind Flay: Insanity if Madness active
  if (s.swMadnessRemainingPct > 0) {
    return { action: "MindFlayInsanity", reason: "Shadow Word: Madness active, use Mind Flay: Insanity" };
  }

  // 9. Filler (Void Volley on cooldown, or not in Voidform at all)
  return { action: "MindFlay", reason: "Filler: nothing higher priority available" };
}