import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { getMailServerForAgency } from "@/lib/email/mailserver-service";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

export async function POST(request: NextRequest) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SECURITY: Only ADMIN and AGENT can send emails
  if (!["ADMIN", "AGENT"].includes(session.user.role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { clientId, toEmail, subject, body: emailBody } = body;

    // Validate input
    if (!clientId || !toEmail || !subject || !emailBody) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
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

    // Get mail server based on client's agency
    const mailServer = await getMailServerForAgency(client.agencyId);

    // The email body already contains the signature from the render-client-template endpoint
    // or has been edited by the user, so we use it as-is
    const finalEmailBody = emailBody;

    // Configure nodemailer transport
    const transportConfig: SMTPTransport.Options = {
      host: mailServer.host,
      port: mailServer.port,
      secure: mailServer.port === 465,
      tls: {
        rejectUnauthorized: false,
      },
    };

    if (mailServer.username && mailServer.password) {
      transportConfig.auth = {
        user: mailServer.username,
        pass: mailServer.password,
      };
    }

    if (mailServer.useTls && mailServer.port !== 465) {
      transportConfig.secure = false;
      transportConfig.requireTLS = true;
    }

    const transporter = nodemailer.createTransport(transportConfig);

    // Verify connection
    try {
      await transporter.verify();
    } catch (error) {
      console.error("Mail server verification failed:", error);
      throw new Error(
        `Mail server connection failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    // Prepare mail options
    const mailOptions = {
      from: mailServer.fromName
        ? `"${mailServer.fromName}" <${mailServer.fromEmail}>`
        : mailServer.fromEmail,
      to: toEmail,
      subject,
      text: finalEmailBody.replace(/<[^>]*>/g, ""), // Strip HTML for text version
      html: finalEmailBody,
    };

    // Send email
    try {
      const info = await transporter.sendMail(mailOptions);

      // Log success - without projectId (client-level email)
      await prisma.emailLog.create({
        data: {
          clientId,
          toEmail,
          subject,
          body: finalEmailBody,
          success: true,
          mailServerId: mailServer.id,
        },
      });

      return NextResponse.json({
        success: true,
        messageId: info.messageId,
      });
    } catch (error) {
      console.error("Email send failed:", error);

      // Log failure
      await prisma.emailLog.create({
        data: {
          clientId,
          toEmail,
          subject,
          body: finalEmailBody,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          mailServerId: mailServer.id,
        },
      });

      throw error;
    }
  } catch (error) {
    console.error("Error sending client email:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send email",
      },
      { status: 500 }
    );
  }
}
