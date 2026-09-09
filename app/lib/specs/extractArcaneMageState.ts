import type { ArcaneMageState } from "./arcaneMageSunfury";

const BUFF_IDS = {
  clearcasting: 263725,
  arcaneSalvoStackBuff: 1242974,
  prismaticBoltReady: 1295942,
  overpoweredMissiles: 1277009,
  arcaneSoul: 451038,
};

type RawEvent = {
  timestamp: number;
  type: string;
  abilityGameID?: number;
  abilityName?: string;
  stack?: number;
  resourceChange?: number;
  resourceChangeType?: number;
  maxResourceAmount?: number;
  _source: "cast" | "buff" | "resource";
};

export type CastWithState = {
  timestamp: number;
  ability: string;
  state: ArcaneMageState;
};

export function extractStatesAtCasts(events: RawEvent[]): CastWithState[] {
  let clearcastingStacks = 0;
  let arcaneSalvo = 0;
  let hasPrismaticBolt = false;
  let hasOverpoweredMissile = false;
  let inArcaneSoul = false;
  let arcaneCharges = 0;
  let previousCast: string | null = null;

  const results: CastWithState[] = [];

  for (const e of events) {
    if (e._source === "buff") {
      if (e.abilityGameID === BUFF_IDS.clearcasting) {
        if (e.type === "applybuff") clearcastingStacks = 1;
        if (e.type === "applybuffstack") clearcastingStacks = e.stack ?? clearcastingStacks + 1;
        if (e.type === "removebuff") clearcastingStacks = 0;
      }
      if (e.abilityGameID === BUFF_IDS.arcaneSalvoStackBuff) {
        if (e.type === "applybuff") arcaneSalvo = 1;
        if (e.type === "applybuffstack" || e.type === "refreshbuff") arcaneSalvo = e.stack ?? arcaneSalvo;
        if (e.type === "removebuff") arcaneSalvo = 0;
      }
      if (e.abilityGameID === BUFF_IDS.prismaticBoltReady) {
        if (e.type === "applybuff") hasPrismaticBolt = true;
        if (e.type === "removebuff") hasPrismaticBolt = false;
      }
      if (e.abilityGameID === BUFF_IDS.overpoweredMissiles) {
        if (e.type === "applybuff") hasOverpoweredMissile = true;
        if (e.type === "removebuff") hasOverpoweredMissile = false;
      }
      if (e.abilityGameID === BUFF_IDS.arcaneSoul) {
        if (e.type === "applybuff") inArcaneSoul = true;
        if (e.type === "removebuff") inArcaneSoul = false;
      }
    }

    if (e._source === "resource") {
      if (e.resourceChangeType === 16 && e.maxResourceAmount === 4) {
        arcaneCharges = Math.min(4, arcaneCharges + (e.resourceChange ?? 0));
      }
    }

    if (e._source === "cast" && e.type === "cast") {
      results.push({
        timestamp: e.timestamp,
        ability: e.abilityName ?? String(e.abilityGameID),
        state: {
          clearcastingStacks,
          hasPrismaticBolt,
          hasOverpoweredMissile,
          arcaneCharges,
          arcaneSalvo,
          inArcaneSoul,
          midCastArcaneBlastWithNewCC: false,
          previousCast,
        },
      });

      // Update previousCast AFTER snapshotting current state (this cast becomes "previous" for the next one)
      previousCast = e.abilityName ?? String(e.abilityGameID);
    }
  }

  return results;
}