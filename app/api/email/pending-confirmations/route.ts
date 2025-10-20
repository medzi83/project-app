import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const runtime = 'nodejs';
export const preferredRegion = 'fra1';


/**
 * GET - Check for pending email confirmations
 */
export async function GET() {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all emails pending confirmation (created in last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const pendingEmails = await prisma.emailQueue.findMany({
    where: {
      status: "PENDING_CONFIRMATION",
      createdAt: {
        gte: fiveMinutesAgo,
      },
    },
    select: {
      id: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return NextResponse.json({
    queueIds: pendingEmails.map((e) => e.id),
  });
}
