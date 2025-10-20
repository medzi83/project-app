import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const preferredRegion = 'fra1';


export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN"]);
  const { id } = await params;
  const body = await _.json();

  const feedback = await prisma.feedback.update({
    where: { id },
    data: {
      status: body.status,
    },
  });

  return NextResponse.json(feedback);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN"]);
  const { id } = await params;

  await prisma.feedback.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
