import { NextResponse } from "next/server";
import { processEmailQueue } from "@/lib/email/send-service";
import { getAuthSession } from "@/lib/authz";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const runtime = 'nodejs';
export const preferredRegion = 'fra1';

/**
 * API Route to process the email queue
 * Can be called manually or by a cron job
 */
export async function POST() {
  // Check if user is admin
  const session = await getAuthSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const results = await processEmailQueue();

    return NextResponse.json({
      success: true,
      message: `Processed ${results.success + results.failed} emails`,
      results,
    });
  } catch (error) {
    console.error("Error processing email queue:", error);
    return NextResponse.json(
      {
        error: "Failed to process email queue",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * Allow GET as well for easier testing
 */
export async function GET() {
  return POST();
}
