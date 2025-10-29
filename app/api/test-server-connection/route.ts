import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authz";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const preferredRegion = 'fra1';

export async function POST(request: NextRequest) {
  // Check authentication and admin role
  const session = await getAuthSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { froxlorUrl, froxlorApiKey, froxlorApiSecret, froxlorVersion } = body;

    // If no Froxlor credentials provided, we can't test
    if (!froxlorUrl || !froxlorApiKey || !froxlorApiSecret) {
      return NextResponse.json({
        success: false,
        error: "Froxlor URL, API Key und API Secret sind erforderlich für den Test",
      });
    }

    // Determine API version (default to 2.0+)
    const isLegacyApi = froxlorVersion === '1.x';

    // Test Froxlor API connection
    const froxlorTestUrl = `${froxlorUrl.replace(/\/$/, "")}/api.php`;

    let response: Response;

    if (isLegacyApi) {
      // Legacy Froxlor 1.x: apikey/secret in request body
      response = await fetch(froxlorTestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          header: {
            apikey: froxlorApiKey,
            secret: froxlorApiSecret,
          },
          body: {
            command: "Froxlor.listFunctions",
          },
        }),
      });
    } else {
      // Modern Froxlor 2.0+: HTTP Basic Authentication
      const authString = Buffer.from(`${froxlorApiKey}:${froxlorApiSecret}`).toString('base64');

      response = await fetch(froxlorTestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${authString}`,
        },
        body: JSON.stringify({
          command: "Froxlor.listFunctions",
        }),
      });
    }

    const data = await response.json();

    // Check HTTP status codes for errors
    if (!response.ok) {
      // Both versions use status_message for errors
      const errorMsg = data.status_message || data.message || response.statusText;
      return NextResponse.json({
        success: false,
        error: `HTTP ${response.status}: ${errorMsg}`,
      });
    }

    // Check success based on API version
    const isSuccess = isLegacyApi
      ? data.status === 200
      : (data.data !== undefined && data.data !== null);

    if (isSuccess) {
      // Connection successful
      return NextResponse.json({
        success: true,
        message: `Verbindung erfolgreich! Froxlor ${froxlorVersion || '2.0+'} API ist erreichbar.`,
      });
    }

    // If no data and no error status, something unexpected happened
    return NextResponse.json({
      success: false,
      error: data.status_message || "Unerwartete API-Antwort",
    });
  } catch (error) {
    console.error("Server connection test error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unbekannter Fehler beim Verbindungstest",
    });
  }
}
