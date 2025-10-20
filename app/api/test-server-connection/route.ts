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
    const { froxlorUrl, froxlorApiKey, froxlorApiSecret } = body;

    // If no Froxlor credentials provided, we can't test
    if (!froxlorUrl || !froxlorApiKey || !froxlorApiSecret) {
      return NextResponse.json({
        success: false,
        error: "Froxlor URL, API Key und API Secret sind erforderlich für den Test",
      });
    }

    // Test Froxlor API connection
    const froxlorTestUrl = `${froxlorUrl.replace(/\/$/, "")}/api.php`;

    const response = await fetch(froxlorTestUrl, {
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

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `HTTP Fehler: ${response.status} ${response.statusText}`,
      });
    }

    const data = await response.json();

    // Check if Froxlor API returned an error
    if (data.status === 403 || data.status === 401) {
      return NextResponse.json({
        success: false,
        error: "Authentifizierung fehlgeschlagen. Bitte API Key und Secret prüfen.",
      });
    }

    if (data.status !== 200) {
      return NextResponse.json({
        success: false,
        error: data.message || `Froxlor API Fehler: Status ${data.status}`,
      });
    }

    // Connection successful
    return NextResponse.json({
      success: true,
      message: "Verbindung erfolgreich! Froxlor API ist erreichbar.",
    });
  } catch (error) {
    console.error("Server connection test error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unbekannter Fehler beim Verbindungstest",
    });
  }
}
