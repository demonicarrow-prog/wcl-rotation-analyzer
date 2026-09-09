import { getWclToken } from "@/app/lib/wcl";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { searchParams } = new URL(request.url);
  const fightID = Number(searchParams.get("fightID"));

  const token = await getWclToken();

  const query = `
    query ($code: String!, $fightIDs: [Int!]) {
      reportData {
        report(code: $code) {
          playerDetails(fightIDs: $fightIDs)
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

  const data = await response.json();
  const details = data?.data?.reportData?.report?.playerDetails?.data?.playerDetails ?? {};

  // Flatten healers/tanks/dps into one simple list
  const players = [
    ...(details.healers ?? []),
    ...(details.tanks ?? []),
    ...(details.dps ?? []),
  ].map((p: any) => ({ id: p.id, name: p.name }));

  return Response.json({ players });
}