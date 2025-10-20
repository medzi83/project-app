import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const runtime = 'nodejs';
export const preferredRegion = 'fra1';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const minimal = searchParams.get("minimal") === "true";

    if (minimal) {
      // Return minimal client data for search including contact information
      const clients = await prisma.client.findMany({
        select: {
          id: true,
          name: true,
          customerNo: true,
          contact: true,
          email: true,
          phone: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      return NextResponse.json(clients);
    }

    // Default: return full client list
    const clients = await prisma.client.findMany({
      include: {
        _count: {
          select: {
            projects: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}
