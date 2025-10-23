import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

export async function GET() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ count: 0 });
  }

  // Get count of user's CLOSED feedbacks (RESOLVED or DISMISSED) that haven't been viewed yet
  const count = await prisma.feedback.count({
    where: {
      authorId: session.user.id,
      status: {
        in: ["RESOLVED", "DISMISSED"] // Only count closed feedbacks
      },
      viewedByAuthor: false, // Only count unviewed feedbacks
    }
  });

  return NextResponse.json({ count });
}
