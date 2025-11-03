import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

/**
 * GET /api/admin/servers
 * Returns list of all servers for admin use
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const servers = await prisma.server.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({ success: true, servers });
  } catch (error) {
    console.error("[API /admin/servers] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch servers" },
      { status: 500 }
    );
  }
}
