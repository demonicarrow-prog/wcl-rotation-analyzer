import { getWclToken } from "@/app/lib/wcl";
import { resolveSpellNames } from "@/app/lib/spellNames";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { searchParams } = new URL(request.url);

  const fightID = Number(searchParams.get("fightID"));
  const sourceID = Number(searchParams.get("sourceID"));

  const token = await getWclToken();

  const query = `
    query ($code: String!, $fightIDs: [Int!], $sourceID: Int) {
      reportData {
        report(code: $code) {
          events(
            fightIDs: $fightIDs
            sourceID: $sourceID
            dataType: Buffs
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
    body: JSON.stringify({ query, variables: { code, fightIDs: [fightID], sourceID } }),
  });

  const json = await response.json();
  const events = json?.data?.reportData?.report?.events?.data ?? [];

  const ownBuffs = events.filter((e: any) => e.sourceID === sourceID);
  const uniqueIds: number[] = [...new Set(ownBuffs.map((e: any) => e.abilityGameID))] as number[];

  const names = await resolveSpellNames(uniqueIds);

  const result = uniqueIds
    .map((id) => ({ id, name: names[id] }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return Response.json({ count: result.length, buffs: result });
}