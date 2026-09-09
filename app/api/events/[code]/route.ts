import { getWclToken } from "@/app/lib/wcl";

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
            nextPageTimestamp
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

  // Tag each event with its source stream, then merge + sort by timestamp
  const merged = [
    ...casts.map((e: any) => ({ ...e, _source: "cast" })),
    ...buffs.map((e: any) => ({ ...e, _source: "buff" })),
    ...resources.map((e: any) => ({ ...e, _source: "resource" })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  return Response.json({
    count: merged.length,
    events: merged,
  });
}