export async function GET() {
    const clientId = process.env.WCL_CLIENT_ID;
    const clientSecret = process.env.WCL_CLIENT_SECRET;
  
    if (!clientId || !clientSecret) {
      return Response.json({ error: "Missing WCL credentials in .env.local" }, { status: 500 });
    }
  
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  
    const tokenResponse = await fetch("https://www.warcraftlogs.com/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
  
    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      return Response.json({ error: "Token request failed", details: errText }, { status: 500 });
    }
  
    const tokenData = await tokenResponse.json();
    return Response.json({ success: true, hasToken: !!tokenData.access_token });
  }