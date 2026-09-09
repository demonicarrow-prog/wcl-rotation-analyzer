export type ArcaneMageState = {
    clearcastingStacks: number;
    hasPrismaticBolt: boolean;
    hasOverpoweredMissile: boolean;
    arcaneCharges: number;
    arcaneSalvo: number;
    inArcaneSoul: boolean;
    midCastArcaneBlastWithNewCC: boolean;
    previousCast: string | null; // the real WCL name of the immediately preceding cast
  };
  
  export type ArcaneMageAction =
    | "ArcaneBarrage"
    | "ArcaneMissiles"
    | "PrismaticBolt"
    | "ArcaneBlast"
    | "ArcaneOrb";
  
  export function evaluateArcaneMagePriority(s: ArcaneMageState): {
    action: ArcaneMageAction;
    reason: string;
  } {
    // Highest priority: always Barrage immediately after Prismatic Bolt, no exceptions.
    if (s.previousCast === "Prismatic Bolt") {
      return { action: "ArcaneBarrage", reason: "Must Barrage immediately after Prismatic Bolt" };
    }
  
    // Override: CC procs mid-Blast cast -> Barrage regardless of Salvo
    if (s.midCastArcaneBlastWithNewCC) {
      return { action: "ArcaneBarrage", reason: "CC proc'd mid-Blast, Barrage regardless of Salvo" };
    }
  
    // Override: In Arcane Soul, Barrage until Salvo is fully spent
    if (s.inArcaneSoul && s.arcaneSalvo > 0) {
      return { action: "ArcaneBarrage", reason: "Arcane Soul window, dumping Salvo" };
    }
  
    const hasCC = s.clearcastingStacks > 0;
  
    // Override: 2+ CC stacks -> always chain 2x Missiles, ignore OPM
    if (s.clearcastingStacks >= 2) {
      return { action: "ArcaneMissiles", reason: "2+ Clearcasting stacks, chain Missiles" };
    }
  
    // Have Overpowered Missile + CC -> Missile first
    if (s.hasOverpoweredMissile && hasCC) {
      return { action: "ArcaneMissiles", reason: "Overpowered Missile proc, spend it" };
    }
  
    // Have Prismatic Bolt available
    if (s.hasPrismaticBolt) {
      if (hasCC) {
        return { action: "ArcaneMissiles", reason: "Spend CC before using held Prismatic Bolt" };
      }
      return { action: "PrismaticBolt", reason: "Prismatic Bolt available, no CC to spend first" };
    }
  
    // No Prismatic Bolt, no OPM
    if (hasCC) {
      return { action: "ArcaneMissiles", reason: "Spend Clearcasting proc" };
    }
  
    // 0 CC, no P.bolt, no OPM
    if (s.arcaneCharges < 2) {
      return { action: "ArcaneOrb", reason: "Low Arcane Charges, refill with Orb" };
    }
  
    if (s.arcaneSalvo >= 24) {
      return { action: "ArcaneBarrage", reason: "Salvo at/near cap, dump it" };
    }
  
    return { action: "ArcaneBlast", reason: "Filler: building toward CC proc or Salvo cap" };
  }