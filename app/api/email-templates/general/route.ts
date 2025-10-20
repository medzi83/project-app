import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const templates = await prisma.emailTemplate.findMany({
      where: {
        category: "GENERAL",
      },
      select: {
        id: true,
        title: true,
        subject: true,
        body: true,
      },
      orderBy: {
        title: "asc",
      },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error fetching general email templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch email templates" },
      { status: 500 }
    );
  }
}
