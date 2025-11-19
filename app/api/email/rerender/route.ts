"use server";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

/**
 * POST - Re-render email body with updated client data
 * This is called after client data (email/contact) is updated in the pre-dialog
 * Note: preferredRegion cannot be used with "use server" - will use default region
 */
export async function POST(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const queueId = searchParams.get("queueId");

  if (!queueId) {
    return NextResponse.json({ error: "Missing queueId" }, { status: 400 });
  }

  try {
    // Fetch the queue item with all necessary relations
    const queuedEmail = await prisma.emailQueue.findUnique({
      where: { id: queueId },
      include: {
        project: {
          include: {
            client: {
              include: {
                agency: true,
              },
            },
            agent: {
              select: {
                name: true,
                fullName: true,
                roleTitle: true,
                email: true,
                categories: true,
              },
            },
            website: true,
            film: {
              include: {
                filmer: true,
                cutter: true,
                previewVersions: {
                  orderBy: { sentDate: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
        trigger: {
          include: {
            template: true,
          },
        },
      },
    });

    if (!queuedEmail || !queuedEmail.trigger?.template) {
      return NextResponse.json({ error: "Email or template not found" }, { status: 404 });
    }

    // IMPORTANT: Re-fetch client data to get the LATEST data after update
    // The queue might have stale client data
    const freshClient = await prisma.client.findUnique({
      where: { id: queuedEmail.project.clientId },
      include: {
        agency: true,
      },
    });

    if (!freshClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Import the replacePlaceholders function from trigger-service
    // For now, we'll use a simplified inline version
    const formatDate = (value?: Date | null) =>
      value ? new Date(value).toLocaleDateString("de-DE") : "";

    const formatDateTime = (value?: Date | null) =>
      value ? new Date(value).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "";

    const formatWebterminType = (type?: string | null) => {
      switch (type) {
        case "TELEFONISCH": return "Telefonisch";
        case "BEIM_KUNDEN": return "Beim Kunden";
        case "IN_DER_AGENTUR": return "In der Agentur";
        case "OHNE_TERMIN": return "Ohne Termin";
        default: return "";
      }
    };

    const project = queuedEmail.project;
    const client = freshClient; // Use fresh client data instead of cached queue data
    const agent = project.agent;
    const website = project.website;
    const film = project.film;

    const latestPreview = film?.previewVersions?.[0];

    const replacements: Record<string, string> = {
      "{{project.title}}": project.title ?? "",
      "{{project.id}}": project.id,
      "{{project.status}}": project.status ?? "",
      "{{project.webDate}}": formatDateTime(website?.webDate ?? null),
      "{{project.webterminType}}": formatWebterminType(website?.webterminType),
      "{{project.demoDate}}": formatDate(website?.demoDate ?? null),
      "{{project.agentName}}": agent?.name ?? "",

      "{{client.name}}": client?.name ?? "",
      "{{client.customerNo}}": client?.customerNo ?? "",
      "{{client.contact}}": [client?.firstname, client?.lastname].filter(Boolean).join(' ') || "",
      "{{client.phone}}": client?.phone ?? "",
      "{{client.email}}": client?.email ?? "",

      "{{agent.name}}": agent?.name ?? "",
      "{{agent.fullName}}": agent?.fullName ?? "",
      "{{agent.roleTitle}}": agent?.roleTitle ?? "",
      "{{agent.email}}": agent?.email ?? "",
      "{{agent.categories}}": agent?.categories?.join(", ") ?? "",

      "{{website.domain}}": website?.domain ?? "",
      "{{website.webDate}}": formatDateTime(website?.webDate ?? null),
      "{{website.demoDate}}": formatDate(website?.demoDate ?? null),
      "{{website.demoLink}}": website?.demoLink ?? "",

      "{{film.scope}}": film?.scope ?? "",
      "{{film.status}}": film?.status ?? "",
      "{{film.shootDate}}": formatDate(film?.shootDate ?? null),
      "{{film.filmerName}}": film?.filmer?.name ?? "",
      "{{film.cutterName}}": film?.cutter?.name ?? "",
      "{{film.previewLink}}": latestPreview?.link ?? "",
      "{{film.previewDate}}": latestPreview?.sentDate ? formatDate(latestPreview.sentDate) : "",
      "{{film.previewVersion}}": latestPreview?.version?.toString() ?? "",
      "{{film.finalLink}}": film?.finalLink ?? "",
      "{{film.onlineLink}}": film?.onlineLink ?? "",
    };

    let renderedBody = queuedEmail.trigger.template.body;
    for (const [placeholder, value] of Object.entries(replacements)) {
      renderedBody = renderedBody.replaceAll(placeholder, value);
    }

    // Add signature based on fresh client's agency
    const agencyId = client.agency?.id ?? null;
    const signature = await prisma.emailSignature.findFirst({
      where: { agencyId },
      orderBy: { createdAt: "asc" },
    });

    if (signature) {
      let signatureBody = signature.body;
      for (const [placeholder, value] of Object.entries(replacements)) {
        signatureBody = signatureBody.replaceAll(placeholder, value);
      }
      renderedBody = renderedBody + "\n\n" + signatureBody;
    }

    // Update the queue with re-rendered body and updated email
    await prisma.emailQueue.update({
      where: { id: queueId },
      data: {
        body: renderedBody,
        toEmail: client.email ?? "",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error re-rendering email:", error);
    return NextResponse.json(
      { error: "Failed to re-render email" },
      { status: 500 }
    );
  }
}
