let cachedToken: { token: string; expiresAt: number } | null = null;
const spellNameCache = new Map<number, string>();

export async function getBnetToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.BNET_CLIENT_ID;
  const clientSecret = process.env.BNET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing BNET_CLIENT_ID or BNET_CLIENT_SECRET in .env.local");
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenResponse = await fetch("https://oauth.battle.net/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    throw new Error(`Battle.net token request failed: ${errText}`);
  }

  const tokenData = await tokenResponse.json();

  cachedToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  };

  return cachedToken.token;
}

async function fetchSpellName(id: number, token: string): Promise<string> {
  if (spellNameCache.has(id)) {
    return spellNameCache.get(id)!;
  }

  const response = await fetch(
    `https://us.api.blizzard.com/data/wow/spell/${id}?namespace=static-us&locale=en_US`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const name = response.ok ? (await response.json()).name : `Unknown (${id})`;
  spellNameCache.set(id, name);
  return name;
}

export async function resolveSpellNames(ids: number[]): Promise<Record<number, string>> {
  const token = await getBnetToken();
  const uniqueIds = [...new Set(ids)];

  // Run lookups in parallel, but in small batches to avoid hammering the API
  const batchSize = 10;
  const result: Record<number, string> = {};

  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch = uniqueIds.slice(i, i + batchSize);
    const names = await Promise.all(batch.map((id) => fetchSpellName(id, token)));
    batch.forEach((id, idx) => {
      result[id] = names[idx];
    });
  }

  return result;
}