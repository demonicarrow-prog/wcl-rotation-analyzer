import { getWclToken } from "@/app/lib/wcl";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { searchParams } = new URL(request.url);
  const characterName = searchParams.get("name");

  if (!characterName) {
    return Response.json({ error: "Pass ?name=YourCharacterName" }, { status: 400 });
  }

  const token = await getWclToken();

  const query = `
    query ($code: String!) {
      reportData {
        report(code: $code) {
          fights {
            id
            name
            kill
            startTime
            endTime
          }
          masterData {
            actors(type: "Player") {
              id
              name
            }
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
    body: JSON.stringify({ query, variables: { code } }),
  });

  const json = await response.json();
  const report = json?.data?.reportData?.report;
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });

  const matchingActors = report.masterData.actors.filter(
    (a: any) => a.name.toLowerCase() === characterName.toLowerCase()
  );

  if (matchingActors.length === 0) {
    return Response.json({ error: `No player named "${characterName}" found in this report` }, { status: 404 });
  }

  // A player can have different actor IDs across different fights in rare cases,
  // but usually just one - report all matches to be safe.
  const sourceID = matchingActors[0].id;

  const fights = report.fights.map((f: any) => ({
    fightId: f.id,
    name: f.name,
    kill: f.kill,
    durationSeconds: Math.round((f.endTime - f.startTime) / 1000),
    sourceID,
  }));

  return Response.json({ characterName, sourceID, fights });
}