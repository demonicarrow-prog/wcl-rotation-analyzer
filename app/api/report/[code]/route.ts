import { getWclToken } from "@/app/lib/wcl";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const token = await getWclToken();

  const query = `
    query ($code: String!, $fightIDs: [Int!]) {
      reportData {
        report(code: $code) {
          title
          fights(fightIDs: $fightIDs) {
            id
            name
            difficulty
            kill
            startTime
            endTime
          }
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
    body: JSON.stringify({ query, variables: { code, fightIDs: [105] } }),
  });

  const data = await response.json();

  return Response.json(data);
}