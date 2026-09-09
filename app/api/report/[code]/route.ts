import { getWclToken } from "@/app/lib/wcl";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const token = await getWclToken();

  const query = `
    query ($code: String!) {
      reportData {
        report(code: $code) {
          title
          fights {
            id
            name
            difficulty
            kill
            startTime
            endTime
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

  const data = await response.json();
  return Response.json(data?.data?.reportData?.report ?? { error: "Report not found" });
}