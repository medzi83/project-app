"use server";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

/**
 * GET - List all agencies
 * Note: preferredRegion cannot be used with "use server" - will use default region
 */
export async function GET() {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SECURITY: Only ADMIN and AGENT can access agencies list
  if (!["ADMIN", "AGENT"].includes(session.user.role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const agencies = await prisma.agency.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({ agencies });
  } catch (error) {
    console.error("Error fetching agencies:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Agenturen" },
      { status: 500 }
    );
  }
}
