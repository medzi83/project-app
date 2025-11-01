import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

export async function POST(request: NextRequest) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SECURITY: Only ADMIN and AGENT can render templates
  if (!["ADMIN", "AGENT"].includes(session.user.role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { templateId, clientId } = body;

    if (!templateId || !clientId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Fetch template
    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        title: true,
        subject: true,
        body: true,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Fetch client with agency
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        agency: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Fetch current user (agent/admin)
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        fullName: true,
        email: true,
        roleTitle: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Load signature for agency
    const signature = await prisma.emailSignature.findFirst({
      where: { agencyId: client.agencyId },
      orderBy: { createdAt: "asc" },
    });

    // Replace placeholders
    const replacePlaceholders = (text: string) => {
      const clientContact = [client.firstname, client.lastname].filter(Boolean).join(' ') || "";
      return text
        .replace(/\{\{client\.name\}\}/g, client.name || "")
        .replace(/\{\{client\.contact\}\}/g, clientContact)
        .replace(/\{\{client\.customerNo\}\}/g, client.customerNo || "")
        .replace(/\{\{client\.phone\}\}/g, client.phone || "")
        .replace(/\{\{agent\.name\}\}/g, currentUser.name || "")
        .replace(/\{\{agent\.fullName\}\}/g, currentUser.fullName || "")
        .replace(/\{\{agent\.roleTitle\}\}/g, currentUser.roleTitle || "")
        .replace(/\{\{agent\.email\}\}/g, currentUser.email || "")
        .replace(/\{\{agency\.name\}\}/g, client.agency?.name || "");
    };

    // Build subject and body with placeholders replaced
    const renderedSubject = replacePlaceholders(template.subject);
    let renderedBody = replacePlaceholders(template.body);

    // Append signature if available
    if (signature) {
      const signatureWithData = replacePlaceholders(signature.body);
      renderedBody = renderedBody + "\n\n" + signatureWithData;
    }

    return NextResponse.json({
      subject: renderedSubject,
      body: renderedBody,
    });
  } catch (error) {
    console.error("Error rendering template:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to render template",
      },
      { status: 500 }
    );
  }
}
