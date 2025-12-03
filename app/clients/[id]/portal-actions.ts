"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { getMailServerForAgency } from "@/lib/email/mailserver-service";

/**
 * Generate a random password for the customer portal
 */
function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
}

/**
 * Enable portal access for a client and generate initial password
 */
export async function enablePortalAccess(clientId: string): Promise<{
  success: boolean;
  password?: string;
  error?: string;
}> {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return { success: false, error: "Keine Berechtigung" };
  }

  try {
    // Check if client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, email: true, portalEnabled: true },
    });

    if (!client) {
      return { success: false, error: "Kunde nicht gefunden" };
    }

    if (!client.email) {
      return { success: false, error: "Kunde hat keine E-Mail-Adresse hinterlegt" };
    }

    // Generate new password
    const plainPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // Update client
    await prisma.client.update({
      where: { id: clientId },
      data: {
        portalEnabled: true,
        portalPasswordHash: hashedPassword,
        portalInvitedAt: new Date(),
      },
    });

    revalidatePath(`/clients/${clientId}`);

    return { success: true, password: plainPassword };
  } catch (error) {
    console.error("Error enabling portal access:", error);
    return { success: false, error: "Fehler beim Aktivieren des Portal-Zugangs" };
  }
}

/**
 * Disable portal access for a client
 */
export async function disablePortalAccess(clientId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return { success: false, error: "Keine Berechtigung" };
  }

  try {
    await prisma.client.update({
      where: { id: clientId },
      data: {
        portalEnabled: false,
      },
    });

    revalidatePath(`/clients/${clientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error disabling portal access:", error);
    return { success: false, error: "Fehler beim Deaktivieren des Portal-Zugangs" };
  }
}

/**
 * Reset portal password and generate a new one
 */
export async function resetPortalPassword(clientId: string): Promise<{
  success: boolean;
  password?: string;
  error?: string;
}> {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return { success: false, error: "Keine Berechtigung" };
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, portalEnabled: true },
    });

    if (!client) {
      return { success: false, error: "Kunde nicht gefunden" };
    }

    if (!client.portalEnabled) {
      return { success: false, error: "Portal-Zugang ist nicht aktiviert" };
    }

    // Generate new password
    const plainPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    await prisma.client.update({
      where: { id: clientId },
      data: {
        portalPasswordHash: hashedPassword,
      },
    });

    revalidatePath(`/clients/${clientId}`);

    return { success: true, password: plainPassword };
  } catch (error) {
    console.error("Error resetting portal password:", error);
    return { success: false, error: "Fehler beim Zurücksetzen des Passworts" };
  }
}

/**
 * Send portal credentials to the client via email
 */
export async function sendPortalCredentialsEmail(
  clientId: string,
  password: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return { success: false, error: "Keine Berechtigung" };
  }

  try {
    // Get client with agency information
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        email: true,
        firstname: true,
        lastname: true,
        name: true,
        portalEnabled: true,
        agencyId: true,
      },
    });

    if (!client) {
      return { success: false, error: "Kunde nicht gefunden" };
    }

    if (!client.email) {
      return { success: false, error: "Kunde hat keine E-Mail-Adresse hinterlegt" };
    }

    if (!client.portalEnabled) {
      return { success: false, error: "Portal-Zugang ist nicht aktiviert" };
    }

    // Get mail server for the client's agency
    const mailServer = await getMailServerForAgency(client.agencyId);

    // Configure nodemailer Transport
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
      return {
        success: false,
        error: `Mailserver-Verbindung fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
      };
    }

    // Prepare greeting name
    const greeting = client.firstname
      ? `${client.firstname} ${client.lastname || ""}`.trim()
      : client.name;

    // Prepare email content
    const subject = "Ihre Zugangsdaten für das Kundenportal";
    const body = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3b82f6, #06b6d4); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
    .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }
    .credentials { background: white; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .credential-row { margin: 10px 0; }
    .credential-label { font-weight: bold; color: #64748b; font-size: 12px; text-transform: uppercase; }
    .credential-value { font-size: 16px; color: #1e293b; margin-top: 4px; font-family: monospace; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { background: #f1f5f9; padding: 20px; border-radius: 0 0 10px 10px; font-size: 12px; color: #64748b; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin-top: 20px; color: #92400e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">Willkommen im Kundenportal!</h1>
    </div>
    <div class="content">
      <p>Guten Tag ${greeting},</p>
      <p>Ihr Zugang zum Kundenportal wurde eingerichtet. Mit dem Portal haben Sie Zugriff auf alle wichtigen Informationen zu Ihren Projekten:</p>
      <ul>
        <li>Webdokumentation einsehen und bestätigen</li>
        <li>Bilder und Dokumente hochladen</li>
        <li>Stichpunkte für die Texterstellung einreichen</li>
      </ul>

      <div class="credentials">
        <h3 style="margin-top: 0; color: #3b82f6;">Ihre Zugangsdaten</h3>
        <div class="credential-row">
          <div class="credential-label">Portal-URL</div>
          <div class="credential-value">https://portal.server-nord.de</div>
        </div>
        <div class="credential-row">
          <div class="credential-label">Ihre E-Mail-Adresse (Benutzername)</div>
          <div class="credential-value">${client.email}</div>
        </div>
        <div class="credential-row">
          <div class="credential-label">Ihr Passwort</div>
          <div class="credential-value">${password}</div>
        </div>
      </div>

      <a href="https://portal.server-nord.de" class="button" style="color: white;">Zum Kundenportal</a>

      <div class="warning">
        <strong>Hinweis:</strong> Bitte bewahren Sie Ihre Zugangsdaten sicher auf. Sie können Ihr Passwort jederzeit im Portal unter "Mein Profil" ändern.
      </div>
    </div>
    <div class="footer">
      <p>Diese E-Mail wurde automatisch generiert. Bei Fragen wenden Sie sich bitte an Ihren Ansprechpartner.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Prepare mail options
    const mailOptions = {
      from: mailServer.fromName
        ? `"${mailServer.fromName}" <${mailServer.fromEmail}>`
        : mailServer.fromEmail,
      to: client.email,
      subject,
      text: `Guten Tag ${greeting},\n\nIhr Zugang zum Kundenportal wurde eingerichtet.\n\nZugangsdaten:\n- Portal-URL: https://portal.server-nord.de\n- E-Mail: ${client.email}\n- Passwort: ${password}\n\nBitte bewahren Sie Ihre Zugangsdaten sicher auf. Sie können Ihr Passwort jederzeit im Portal unter "Mein Profil" ändern.\n\nMit freundlichen Grüßen`,
      html: body,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    // Log success
    await prisma.emailLog.create({
      data: {
        clientId,
        toEmail: client.email,
        subject,
        body,
        success: true,
        mailServerId: mailServer.id,
      },
    });

    // Update portalInvitedAt to track when credentials were sent
    await prisma.client.update({
      where: { id: clientId },
      data: {
        portalInvitedAt: new Date(),
      },
    });

    revalidatePath(`/clients/${clientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error sending portal credentials email:", error);

    // Try to log the failure
    try {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { email: true },
      });

      if (client?.email) {
        await prisma.emailLog.create({
          data: {
            clientId,
            toEmail: client.email,
            subject: "Ihre Zugangsdaten für das Kundenportal",
            body: "Fehler beim Senden",
            success: false,
            error: error instanceof Error ? error.message : "Unbekannter Fehler",
          },
        });
      }
    } catch {
      // Ignore logging errors
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Fehler beim Senden der E-Mail",
    };
  }
}
