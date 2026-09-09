import { getWclToken } from "@/app/lib/wcl";
import { resolveSpellNames } from "@/app/lib/spellNames";

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

async function fetchFightStart(token: string, code: string, fightID: number) {
  const query = `
    query ($code: String!, $fightIDs: [Int!]) {
      reportData {
        report(code: $code) {
          fights(fightIDs: $fightIDs) {
            startTime
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
    body: JSON.stringify({ query, variables: { code, fightIDs: [fightID] } }),
  });

  const json = await response.json();
  return json?.data?.reportData?.report?.fights?.[0]?.startTime ?? 0;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { searchParams } = new URL(request.url);

  const fightID = Number(searchParams.get("fightID"));
  const sourceID = Number(searchParams.get("sourceID"));

  const token = await getWclToken();

  const [casts, buffs, resources, fightStart] = await Promise.all([
    fetchEvents(token, code, fightID, sourceID, "Casts"),
    fetchEvents(token, code, fightID, sourceID, "Buffs"),
    fetchEvents(token, code, fightID, sourceID, "Resources"),
    fetchFightStart(token, code, fightID),
  ]);

  // Only keep buffs the player applied to themself (own procs/buffs),
  // dropping raid buffs/effects other players put on them
  const ownBuffs = buffs.filter((e: any) => e.sourceID === sourceID);

  const merged = [
    ...casts.map((e: any) => ({ ...e, _source: "cast" })),
    ...ownBuffs.map((e: any) => ({ ...e, _source: "buff" })),
    ...resources.map((e: any) => ({ ...e, _source: "resource" })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  const abilityIds = merged
    .map((e) => e.abilityGameID)
    .filter((id): id is number => typeof id === "number");

  const spellNames = await resolveSpellNames(abilityIds);

  const withNames = merged.map((e) => ({
    ...e,
    abilityName: e.abilityGameID ? spellNames[e.abilityGameID] : undefined,
    relativeTime: e.timestamp - fightStart,
  }));

  return Response.json({
    count: withNames.length,
    fightStart,
    events: withNames,
  });
}