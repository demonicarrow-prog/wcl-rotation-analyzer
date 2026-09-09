import { getBnetToken } from "@/app/lib/battlenet";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const token = await getBnetToken();

  const response = await fetch(
    `https://us.api.blizzard.com/data/wow/spell/${id}?namespace=static-us&locale=en_US`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    return Response.json(
      { error: `Spell lookup failed for ID ${id}`, status: response.status },
      { status: response.status }
    );
  }

  const data = await response.json();

  return Response.json({
    id: data.id,
    name: data.name,
  });
}