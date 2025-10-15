"use server";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { sendProjectEmail } from "@/lib/email/send-service";

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

  if (queuedEmail.status !== "PENDING_CONFIRMATION") {
    return NextResponse.json(
      { error: "Email is not pending confirmation" },
      { status: 400 }
    );
  }

  const clientRecord = queuedEmail.project.client as
    | { id: string; name: string; email?: string | null }
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
  const { queueId, toEmail, ccEmails, body: customBody } = body;

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

  if (queuedEmail.status !== "PENDING_CONFIRMATION") {
    return NextResponse.json(
      { error: "Email is not pending confirmation" },
      { status: 400 }
    );
  }

  // Update email address if changed
  const finalToEmail = toEmail || queuedEmail.toEmail;
  const finalCcEmails = ccEmails || queuedEmail.ccEmails?.split(",");
  const finalBody = customBody || queuedEmail.body;

  // If client email was updated, save it
  const currentClientEmail =
    (queuedEmail.project.client as { email?: string | null } | null)?.email ?? null;

  if (toEmail && toEmail !== currentClientEmail) {
    await prisma.client.update({
      where: { id: queuedEmail.project.clientId },
      data: { email: toEmail },
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
        status: "SENT",
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
        status: "FAILED",
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

  if (queuedEmail.status !== "PENDING_CONFIRMATION") {
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
