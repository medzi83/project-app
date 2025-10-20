import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const runtime = 'nodejs';
export const preferredRegion = 'fra1';

export async function GET() {
  const session = await requireRole(["ADMIN","AGENT","CUSTOMER"]);
  const role = (session.user.role!) as "ADMIN"|"AGENT"|"CUSTOMER";
  const clientId = session.user.clientId ?? null;

  const where = role === "CUSTOMER" ? { clientId: clientId ?? undefined } : {};
  const projects = await prisma.project.findMany({
    where,
    include: { client: true, agent: true },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  await requireRole(["ADMIN","AGENT"]);
  const body = await req.json();
  const project = await prisma.project.create({
    data: {
      title: body.title,
      type: body.type ?? "WEBSITE",
      status: "WEBTERMIN",
      clientId: body.clientId,
      agentId: body.agentId ?? null,
      important: body.important ?? null,
    },
  });
  return NextResponse.json(project, { status: 201 });
}
