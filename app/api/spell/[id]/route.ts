import { getBnetToken } from "@/app/lib/battlenet";
import { getWclToken } from "@/app/lib/wcl";

async function tryBattleNet(id: string) {
  const token = await getBnetToken();
  const response = await fetch(
    `https://us.api.blizzard.com/data/wow/spell/${id}?namespace=static-us&locale=en_US`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) return null;
  const data = await response.json();
  return { id: data.id, name: data.name, source: "battlenet" };
}

async function tryWcl(id: string) {
  const token = await getWclToken();
  const query = `
    query ($id: Int!) {
      gameData {
        ability(id: $id) {
          id
          name
          icon
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
    body: JSON.stringify({ query, variables: { id: Number(id) } }),
  });
  const json = await response.json();
  const ability = json?.data?.gameData?.ability;
  if (!ability || !ability.name) return null;
  return { id: ability.id, name: ability.name, source: "wcl" };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const bnetResult = await tryBattleNet(id);
  if (bnetResult) return Response.json(bnetResult);

  const wclResult = await tryWcl(id);
  if (wclResult) return Response.json(wclResult);

  return Response.json(
    { error: `Spell lookup failed for ID ${id} in both sources` },
    { status: 404 }
  );
}