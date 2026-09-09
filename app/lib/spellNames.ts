import { getBnetToken } from "@/app/lib/battlenet";
import { getWclToken } from "@/app/lib/wcl";

const spellNameCache = new Map<number, string>();
const spellIconCache = new Map<number, string | null>();

async function tryBattleNetName(id: number, token: string): Promise<string | null> {
  const response = await fetch(
    `https://us.api.blizzard.com/data/wow/spell/${id}?namespace=static-us&locale=en_US`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) return null;
  const data = await response.json();
  return data.name ?? null;
}

async function tryWclName(id: number, token: string): Promise<string | null> {
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

async function tryWclIcon(id: number, token: string): Promise<string | null> {
  const query = `
    query ($id: Int!) {
      gameData {
        ability(id: $id) {
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
    body: JSON.stringify({ query, variables: { id } }),
  });
  const json = await response.json();
  const iconFile = json?.data?.gameData?.ability?.icon;
  // WCL returns just the icon filename (e.g. "spell_arcane_arcane01.jpg").
  // Wowhead hosts these at a predictable CDN path we can use directly.
  return iconFile ? `https://wow.zamimg.com/images/wow/icons/large/${iconFile.replace(/\.(jpg|png)$/, "")}.jpg` : null;
}

async function resolveOneName(id: number, bnetToken: string, wclToken: string): Promise<string> {
  if (spellNameCache.has(id)) return spellNameCache.get(id)!;
  const fromBnet = await tryBattleNetName(id, bnetToken);
  const name = fromBnet ?? (await tryWclName(id, wclToken)) ?? `Unknown (${id})`;
  spellNameCache.set(id, name);
  return name;
}

async function resolveOneIcon(id: number, wclToken: string): Promise<string | null> {
  if (spellIconCache.has(id)) return spellIconCache.get(id)!;
  const icon = await tryWclIcon(id, wclToken);
  spellIconCache.set(id, icon);
  return icon;
}

export async function resolveSpellNames(ids: number[]): Promise<Record<number, string>> {
  const bnetToken = await getBnetToken();
  const wclToken = await getWclToken();
  const uniqueIds = [...new Set(ids)];

  const batchSize = 10;
  const result: Record<number, string> = {};

  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch = uniqueIds.slice(i, i + batchSize);
    const names = await Promise.all(batch.map((id) => resolveOneName(id, bnetToken, wclToken)));
    batch.forEach((id, idx) => {
      result[id] = names[idx];
    });
  }

  return result;
}

export async function resolveSpellIcons(ids: number[]): Promise<Record<number, string | null>> {
  const wclToken = await getWclToken();
  const uniqueIds = [...new Set(ids)];

  const batchSize = 10;
  const result: Record<number, string | null> = {};

  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch = uniqueIds.slice(i, i + batchSize);
    const icons = await Promise.all(batch.map((id) => resolveOneIcon(id, wclToken)));
    batch.forEach((id, idx) => {
      result[id] = icons[idx];
    });
  }

  return result;
}