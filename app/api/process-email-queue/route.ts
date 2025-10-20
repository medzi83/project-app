import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authz";
import { processEmailQueue } from "@/lib/email/send-service";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const preferredRegion = 'fra1';


/**
 * API-Route zum manuellen Auslösen der E-Mail-Queue-Verarbeitung
 * Kann auch von einem Cron-Job aufgerufen werden
 */
export async function POST(request: NextRequest) {
  // Check authentication (nur für manuelle Aufrufe)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Erlaube Zugriff entweder mit Admin-Session oder mit Cron-Secret
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // Kein Bearer Token, prüfe Session
    const session = await getAuthSession();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    // Bearer Token vorhanden, prüfe gegen Cron-Secret
    const token = authHeader.substring(7);
    if (!cronSecret || token !== cronSecret) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
  }

  try {
    console.log("Starting email queue processing...");
    const results = await processEmailQueue();
    console.log("Email queue processing completed:", results);

    return NextResponse.json({
      success: true,
      results,
      message: `Processed ${results.success + results.failed} emails. Success: ${results.success}, Failed: ${results.failed}`,
    });
  } catch (error) {
    console.error("Email queue processing error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint für Status-Abfrage
 */
export async function GET() {
  const session = await getAuthSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { prisma } = await import("@/lib/prisma");

    const stats = await prisma.emailQueue.groupBy({
      by: ["status"],
      _count: true,
    });

    const statusCounts = Object.fromEntries(stats.map((s) => [s.status, s._count]));

    return NextResponse.json({
      success: true,
      queueStats: statusCounts,
    });
  } catch (error) {
    console.error("Queue stats error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
