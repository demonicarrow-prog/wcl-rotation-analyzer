export type ArcaneMageState = {
    clearcastingStacks: number;
    hasPrismaticBolt: boolean;
    hasOverpoweredMissile: boolean;
    arcaneCharges: number;
    arcaneSalvo: number;
    inArcaneSoul: boolean;
    midCastArcaneBlastWithNewCC: boolean;
    previousCast: string | null;
  };
  
  export type ArcaneMageAction =
    | "ArcaneBarrage"
    | "ArcaneMissiles"
    | "PrismaticBolt"
    | "ArcaneBlast"
    | "ArcaneOrb";
  
  const SALVO_CAP = 25;
  
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
  
    // Override: Salvo is capped - banking more CC into Missiles wastes stacks, dump now
    if (s.arcaneSalvo >= SALVO_CAP) {
      return { action: "ArcaneBarrage", reason: "Salvo at cap, must dump before building more" };
    }
  
    const hasCC = s.clearcastingStacks > 0;
  
    // 2+ CC stacks -> chain Missiles, but only if there's room left in Salvo to bank into
    if (s.clearcastingStacks >= 2) {
      return { action: "ArcaneMissiles", reason: "2+ Clearcasting stacks, chain Missiles" };
    }
  
    if (s.hasOverpoweredMissile && hasCC) {
      return { action: "ArcaneMissiles", reason: "Overpowered Missile proc, spend it" };
    }
  
    if (s.hasPrismaticBolt) {
      if (hasCC) {
        return { action: "ArcaneMissiles", reason: "Spend CC before using held Prismatic Bolt" };
      }
      return { action: "PrismaticBolt", reason: "Prismatic Bolt available, no CC to spend first" };
    }
  
    if (hasCC) {
      return { action: "ArcaneMissiles", reason: "Spend Clearcasting proc" };
    }
  
    if (s.arcaneCharges < 2) {
      return { action: "ArcaneOrb", reason: "Low Arcane Charges, refill with Orb" };
    }
  
    if (s.arcaneSalvo >= 24) {
      return { action: "ArcaneBarrage", reason: "Salvo at/near cap, dump it" };
    }
  
    return { action: "ArcaneBlast", reason: "Filler: building toward CC proc or Salvo cap" };
  }