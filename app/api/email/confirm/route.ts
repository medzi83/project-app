"use server";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { sendProjectEmail } from "@/lib/email/send-service";
import { QueueStatus } from "@prisma/client";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const runtime = 'nodejs';
export const preferredRegion = 'fra1';


/**
 * GET - Fetch email details for confirmation
 */
export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const queueId = searchParams.get("queueId");

  if (!queueId) {
    return NextResponse.json({ error: "Missing queueId" }, { status: 400 });
  }

  const queuedEmail = await prisma.emailQueue.findUnique({
    where: { id: queueId },
    include: {
      project: {
        include: {
          client: true,
        },
      },
      trigger: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!queuedEmail) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  if (queuedEmail.status !== QueueStatus.PENDING_CONFIRMATION) {
    return NextResponse.json(
      { error: "Email is not pending confirmation" },
      { status: 400 }
    );
  }

  const clientRecord = queuedEmail.project.client as
    | { id: string; name: string; email?: string | null; contact?: string | null; agencyId?: string | null }
    | null;

  return NextResponse.json({
    id: queuedEmail.id,
    toEmail: queuedEmail.toEmail,
    ccEmails: queuedEmail.ccEmails,
    subject: queuedEmail.subject,
    body: queuedEmail.body,
    project: {
      id: queuedEmail.project.id,
      title: queuedEmail.project.title,
    },
    client: clientRecord
      ? {
          id: clientRecord.id,
          name: clientRecord.name,
          email: clientRecord.email ?? null,
          contact: clientRecord.contact ?? null,
          agencyId: clientRecord.agencyId ?? null,
        }
      : null,
    trigger: queuedEmail.trigger,
  });
}

/**
 * POST - Confirm and send email
 */
export async function POST(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { queueId, toEmail, ccEmails, body: customBody, contact } = body;

  if (!queueId) {
    return NextResponse.json({ error: "Missing queueId" }, { status: 400 });
  }

  const queuedEmail = await prisma.emailQueue.findUnique({
    where: { id: queueId },
    include: {
      project: {
        include: {
          client: true,
        },
      },
    },
  });

  if (!queuedEmail) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  if (queuedEmail.status !== QueueStatus.PENDING_CONFIRMATION) {
    return NextResponse.json(
      { error: "Email is not pending confirmation" },
      { status: 400 }
    );
  }

  // Update email address if changed
  const finalToEmail = toEmail || queuedEmail.toEmail;
  const finalCcEmails = ccEmails || queuedEmail.ccEmails?.split(",");
  const finalBody = customBody || queuedEmail.body;

  // Validate that email is provided
  if (!finalToEmail || finalToEmail.trim() === "") {
    return NextResponse.json(
      { error: "E-Mail-Adresse ist erforderlich" },
      { status: 400 }
    );
  }

  // If client email or contact was updated, save it
  const currentClient = queuedEmail.project.client as { email?: string | null; contact?: string | null } | null;
  const currentClientEmail = currentClient?.email ?? null;
  const currentClientContact = currentClient?.contact ?? null;

  const updateData: { email?: string; contact?: string } = {};

  if (toEmail && toEmail !== currentClientEmail) {
    updateData.email = toEmail;
  }

  if (contact !== undefined && contact !== currentClientContact) {
    updateData.contact = contact || null; // Empty string becomes null
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.client.update({
      where: { id: queuedEmail.project.clientId },
      data: updateData,
    });
  }

  // Update queue entry with new data if changed
  if (
    toEmail !== queuedEmail.toEmail ||
    ccEmails !== queuedEmail.ccEmails ||
    customBody !== queuedEmail.body
  ) {
    await prisma.emailQueue.update({
      where: { id: queueId },
      data: {
        toEmail: finalToEmail,
        ccEmails: finalCcEmails ? finalCcEmails.join(",") : null,
        body: finalBody,
      },
    });
  }

  // Send the email immediately
  try {
    await sendProjectEmail({
      projectId: queuedEmail.projectId,
      to: finalToEmail,
      cc: finalCcEmails,
      subject: queuedEmail.subject,
      body: finalBody,
      triggerId: queuedEmail.triggerId,
    });

    // Update queue status to SENT
    await prisma.emailQueue.update({
      where: { id: queueId },
      data: {
        status: QueueStatus.SENT,
        sentAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending email:", error);

    // Update queue with error
    await prisma.emailQueue.update({
      where: { id: queueId },
      data: {
        status: QueueStatus.FAILED,
        error: error instanceof Error ? error.message : "Unknown error",
        attempts: queuedEmail.attempts + 1,
      },
    });

    return NextResponse.json(
      {
        error: "Failed to send email",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Cancel email confirmation
 */
export async function DELETE(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const queueId = searchParams.get("queueId");

  if (!queueId) {
    return NextResponse.json({ error: "Missing queueId" }, { status: 400 });
  }

  const queuedEmail = await prisma.emailQueue.findUnique({
    where: { id: queueId },
  });

  if (!queuedEmail) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  if (queuedEmail.status !== QueueStatus.PENDING_CONFIRMATION) {
    return NextResponse.json(
      { error: "Email is not pending confirmation" },
      { status: 400 }
    );
  }

  // Delete the queue entry
  await prisma.emailQueue.delete({
    where: { id: queueId },
  });

  return NextResponse.json({ success: true });
}
