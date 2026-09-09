import { getWclToken } from "@/app/lib/wcl";
import { resolveSpellNames } from "@/app/lib/spellNames";
import { extractStatesAtCasts } from "@/app/lib/specs/extractArcaneMageState";
import { evaluateArcaneMagePriority, ArcaneMageAction } from "@/app/lib/specs/arcaneMageSunfury";

async function fetchEvents(
  token: string,
  code: string,
  fightID: number,
  sourceID: number,
  dataType: string
) {
  const query = `
    query ($code: String!, $fightIDs: [Int!], $sourceID: Int, $dataType: EventDataType!) {
      reportData {
        report(code: $code) {
          events(
            fightIDs: $fightIDs
            sourceID: $sourceID
            dataType: $dataType
            limit: 10000
          ) {
            data
          }
        }
      }
    }
  `;

  const response = await fetch("https://www.warcraftlogs.com/api/v2/client", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { code, fightIDs: [fightID], sourceID, dataType },
    }),
  });

  const json = await response.json();
  return json?.data?.reportData?.report?.events?.data ?? [];
}

const ACTION_TO_REAL_NAME: Record<ArcaneMageAction, string> = {
  ArcaneBarrage: "Arcane Barrage",
  ArcaneMissiles: "Arcane Missiles",
  PrismaticBolt: "Prismatic Bolt",
  ArcaneBlast: "Arcane Blast",
  ArcaneOrb: "Arcane Orb",
};

const ROTATION_SPELLS = new Set(Object.values(ACTION_TO_REAL_NAME));

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { searchParams } = new URL(request.url);

  const fightID = Number(searchParams.get("fightID"));
  const sourceID = Number(searchParams.get("sourceID"));

  const token = await getWclToken();

  const [casts, buffs, resources] = await Promise.all([
    fetchEvents(token, code, fightID, sourceID, "Casts"),
    fetchEvents(token, code, fightID, sourceID, "Buffs"),
    fetchEvents(token, code, fightID, sourceID, "Resources"),
  ]);

  const ownBuffs = buffs.filter((e: any) => e.sourceID === sourceID);

  const merged = [
    ...casts.map((e: any) => ({ ...e, _source: "cast" as const })),
    ...ownBuffs.map((e: any) => ({ ...e, _source: "buff" as const })),
    ...resources.map((e: any) => ({ ...e, _source: "resource" as const })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  const abilityIds = merged
    .map((e) => e.abilityGameID)
    .filter((id): id is number => typeof id === "number");
  const spellNames = await resolveSpellNames(abilityIds);

  const withNames = merged.map((e) => ({
    ...e,
    abilityName: e.abilityGameID ? spellNames[e.abilityGameID] : undefined,
  }));

  const castsWithState = extractStatesAtCasts(withNames);

  const firstTouchIndex = castsWithState.findIndex((c) => c.ability === "Touch of the Magi");
  const openerEndsAtIndex = firstTouchIndex === -1 ? -1 : firstTouchIndex;

  const graded = castsWithState.map((c, i) => {
    const isOpener = openerEndsAtIndex !== -1 && i <= openerEndsAtIndex;
    const isRotationSpell = ROTATION_SPELLS.has(c.ability);
    const shouldGrade = isRotationSpell && !isOpener;

    const recommendation = evaluateArcaneMagePriority(c.state);
    const recommendedRealName = ACTION_TO_REAL_NAME[recommendation.action];

    return {
      timestamp: c.timestamp,
      actualCast: c.ability,
      recommendedCast: shouldGrade ? recommendedRealName : null,
      reason: isOpener
        ? "Opener sequence — not graded against steady-state priority"
        : isRotationSpell
        ? recommendation.reason
        : "Not a core rotation spell — not graded",
      correct: shouldGrade ? c.ability === recommendedRealName : null,
      graded: shouldGrade,
      state: c.state,
    };
  });

  const gradedOnly = graded.filter((g) => g.graded);
  const correctCount = gradedOnly.filter((g) => g.correct).length;

  return Response.json({
    totalCasts: graded.length,
    gradedCasts: gradedOnly.length,
    correctCasts: correctCount,
    accuracy: gradedOnly.length > 0 ? correctCount / gradedOnly.length : null,
    results: graded,
  });
}