import { getBnetToken } from "@/app/lib/battlenet";
import { getWclToken } from "@/app/lib/wcl";

const spellNameCache = new Map<number, string>();

async function tryBattleNet(id: number, token: string): Promise<string | null> {
  const response = await fetch(
    `https://us.api.blizzard.com/data/wow/spell/${id}?namespace=static-us&locale=en_US`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) return null;
  const data = await response.json();
  return data.name ?? null;
}

async function tryWcl(id: number, token: string): Promise<string | null> {
  const query = `
    query ($id: Int!) {
      gameData {
        ability(id: $id) {
          name
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
    body: JSON.stringify({ query, variables: { id } }),
  });
  const json = await response.json();
  return json?.data?.gameData?.ability?.name ?? null;
}

async function resolveOne(id: number, bnetToken: string, wclToken: string): Promise<string> {
  if (spellNameCache.has(id)) return spellNameCache.get(id)!;

  const fromBnet = await tryBattleNet(id, bnetToken);
  const name = fromBnet ?? (await tryWcl(id, wclToken)) ?? `Unknown (${id})`;

  spellNameCache.set(id, name);
  return name;
}

export async function resolveSpellNames(ids: number[]): Promise<Record<number, string>> {
  const bnetToken = await getBnetToken();
  const wclToken = await getWclToken();
  const uniqueIds = [...new Set(ids)];

  const batchSize = 10;
  const result: Record<number, string> = {};

  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch = uniqueIds.slice(i, i + batchSize);
    const names = await Promise.all(batch.map((id) => resolveOne(id, bnetToken, wclToken)));
    batch.forEach((id, idx) => {
      result[id] = names[idx];
    });
  }

  return result;
}