import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole(["ADMIN","AGENT","CUSTOMER"]);
  const project = await prisma.project.findUnique({
    where: { id },
    include: { client: true, agent: true, notes: { include: { author: true } } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.user.role === "CUSTOMER" && project.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(project);
}
