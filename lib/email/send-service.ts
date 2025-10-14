import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { prisma } from "@/lib/prisma";
import { getMailServerForProject } from "./mailserver-service";

type SendEmailOptions = {
  projectId: string;
  to: string;
  cc?: string[];
  subject: string;
  body: string;
  triggerId?: string;
};

/**
 * Sendet eine E-Mail für ein Projekt mit automatischer Mailserver-Auswahl
 */
export async function sendProjectEmail(options: SendEmailOptions) {
  const { projectId, to, cc, subject, body, triggerId } = options;

  // Hole passenden Mailserver
  const mailServer = await getMailServerForProject(projectId);

  // Konfiguriere nodemailer Transport
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
    throw new Error(`Mail server connection failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  // Prepare mail options
  const mailOptions = {
    from: mailServer.fromName
      ? `"${mailServer.fromName}" <${mailServer.fromEmail}>`
      : mailServer.fromEmail,
    to,
    cc: cc && cc.length > 0 ? cc.join(", ") : undefined,
    subject,
    text: body.replace(/<[^>]*>/g, ""), // Strip HTML for text version
    html: body,
  };

  // Send email
  try {
    const info = await transporter.sendMail(mailOptions);

    // Log success
    await prisma.emailLog.create({
      data: {
        projectId,
        triggerId,
        toEmail: to,
        ccEmails: cc && cc.length > 0 ? cc.join(", ") : null,
        subject,
        body,
        success: true,
        mailServerId: mailServer.id,
      },
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Email send failed:", error);

    // Log failure
    await prisma.emailLog.create({
      data: {
        projectId,
        triggerId,
        toEmail: to,
        ccEmails: cc && cc.length > 0 ? cc.join(", ") : null,
        subject,
        body,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        mailServerId: mailServer.id,
      },
    });

    throw error;
  }
}

/**
 * Verarbeitet E-Mails aus der Queue
 */
export async function processEmailQueue() {
  const now = new Date();

  // Hole alle fälligen E-Mails aus der Queue
  const queuedEmails = await prisma.emailQueue.findMany({
    where: {
      status: "PENDING",
      scheduledFor: {
        lte: now,
      },
    },
    include: {
      project: {
        include: {
          client: true,
        },
      },
      mailServer: true,
      trigger: true,
    },
    take: 50, // Maximal 50 E-Mails pro Durchlauf
  });

  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const email of queuedEmails) {
    // Update status to SENDING
    await prisma.emailQueue.update({
      where: { id: email.id },
      data: {
        status: "SENDING",
        lastAttempt: new Date(),
      },
    });

    try {
      // Use explicit mailServer if set, otherwise determine from project
      const mailServer = email.mailServer || (await getMailServerForProject(email.projectId));

      // Configure transport
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

      // Send email
      const mailOptions = {
        from: mailServer.fromName
          ? `"${mailServer.fromName}" <${mailServer.fromEmail}>`
          : mailServer.fromEmail,
        to: email.toEmail,
        cc: email.ccEmails || undefined,
        subject: email.subject,
        text: email.body.replace(/<[^>]*>/g, ""),
        html: email.body,
      };

      await transporter.sendMail(mailOptions);

      // Update queue status
      await prisma.emailQueue.update({
        where: { id: email.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      });

      // Log success
      await prisma.emailLog.create({
        data: {
          projectId: email.projectId,
          triggerId: email.triggerId,
          toEmail: email.toEmail,
          ccEmails: email.ccEmails,
          subject: email.subject,
          body: email.body,
          success: true,
          mailServerId: mailServer.id,
        },
      });

      results.success++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      results.failed++;
      results.errors.push(`Email ${email.id}: ${errorMessage}`);

      // Update queue with error
      await prisma.emailQueue.update({
        where: { id: email.id },
        data: {
          status: email.attempts >= 3 ? "FAILED" : "PENDING",
          attempts: email.attempts + 1,
          error: errorMessage,
        },
      });

      // Log failure
      await prisma.emailLog.create({
        data: {
          projectId: email.projectId,
          triggerId: email.triggerId,
          toEmail: email.toEmail,
          ccEmails: email.ccEmails,
          subject: email.subject,
          body: email.body,
          success: false,
          error: errorMessage,
          mailServerId: email.mailServerId,
        },
      });
    }
  }

  return results;
}
