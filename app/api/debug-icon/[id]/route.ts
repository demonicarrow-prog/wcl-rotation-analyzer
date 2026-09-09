import { resolveSpellIcons, resolveSpellNames } from "@/app/lib/spellNames";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = Number(id);

  const names = await resolveSpellNames([numId]);
  const icons = await resolveSpellIcons([numId]);

  return Response.json({ id: numId, name: names[numId], iconUrl: icons[numId] });
}