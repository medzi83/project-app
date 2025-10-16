import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getAuthSession } from "@/lib/authz";

export async function GET() {
  const session = await requireRole(["ADMIN", "AGENT"]);
  const feedbacks = await prisma.feedback.findMany({
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        }
      }
    },
    orderBy: [
      { status: "asc" },
      { createdAt: "desc" }
    ],
  });
  return NextResponse.json(feedbacks);
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const feedback = await prisma.feedback.create({
    data: {
      title: body.title,
      message: body.message,
      type: body.type ?? "SUGGESTION",
      authorId: session.user.id,
    },
  });

  return NextResponse.json(feedback, { status: 201 });
}
