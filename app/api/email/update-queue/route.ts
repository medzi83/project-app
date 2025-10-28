import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { QueueStatus } from "@prisma/client";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const preferredRegion = 'fra1';

/**
 * POST - Update queue email address
 */
export async function POST(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { queueId, toEmail } = body;

    if (!queueId) {
      return NextResponse.json({ error: "Missing queueId" }, { status: 400 });
    }

    if (!toEmail || toEmail.trim() === "") {
      return NextResponse.json({ error: "Missing toEmail" }, { status: 400 });
    }

    // Check if queue exists and is pending confirmation
    const queuedEmail = await prisma.emailQueue.findUnique({
      where: { id: queueId },
    });

    if (!queuedEmail) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    if (queuedEmail.status !== QueueStatus.PENDING_CONFIRMATION) {
      return NextResponse.json(
        { error: "Email is not pending confirmation" },
        { status: 400 }
      );
    }

    // Update queue with email
    await prisma.emailQueue.update({
      where: { id: queueId },
      data: { toEmail },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating queue:", error);
    return NextResponse.json(
      {
        error: "Failed to update queue",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
