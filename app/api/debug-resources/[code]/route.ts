import { getWclToken } from "@/app/lib/wcl";

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
            dataType: Resources
            limit: 50
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
  return Response.json(json?.data?.reportData?.report?.events?.data ?? []);
}