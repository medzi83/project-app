import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

export async function POST(request: NextRequest) {
  // Check authentication and admin role
  const session = await getAuthSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { mailServerId, testEmail } = body;

    // Validate input
    if (!mailServerId || !testEmail) {
      return NextResponse.json({
        success: false,
        error: "Mailserver-ID und Test-E-Mail-Adresse sind erforderlich",
      });
    }

    // Fetch mail server configuration from database
    const mailServer = await prisma.mailServer.findUnique({
      where: { id: mailServerId },
    });

    if (!mailServer) {
      return NextResponse.json({
        success: false,
        error: "Mailserver nicht gefunden",
      });
    }

    // Configure nodemailer transporter
    const transportConfig: SMTPTransport.Options = {
      host: mailServer.host,
      port: mailServer.port,
      secure: mailServer.port === 465, // Use SSL for port 465
      tls: {
        rejectUnauthorized: false, // Accept self-signed certificates for testing
      },
    };

    // Add authentication if credentials are provided
    if (mailServer.username && mailServer.password) {
      transportConfig.auth = {
        user: mailServer.username,
        pass: mailServer.password,
      };
    }

    // Handle TLS/STARTTLS
    if (mailServer.useTls && mailServer.port !== 465) {
      transportConfig.secure = false;
      transportConfig.requireTLS = true;
    }

    const transporter = nodemailer.createTransport(transportConfig);

    // Verify connection configuration
    try {
      await transporter.verify();
    } catch (verifyError) {
      console.error("Mail server verification failed:", verifyError);
      return NextResponse.json({
        success: false,
        error: `Verbindung fehlgeschlagen: ${verifyError instanceof Error ? verifyError.message : "Unbekannter Fehler"}`,
      });
    }

    // Send test email
    const mailOptions = {
      from: mailServer.fromName
        ? `"${mailServer.fromName}" <${mailServer.fromEmail}>`
        : mailServer.fromEmail,
      to: testEmail,
      subject: "Test-E-Mail von Projektverwaltung",
      text: `Dies ist eine Test-E-Mail vom Mailserver "${mailServer.name}".\n\nKonfiguration:\n- Host: ${mailServer.host}\n- Port: ${mailServer.port}\n- Verschlüsselung: ${mailServer.useTls ? "TLS / STARTTLS" : "Keine"}\n- Absender: ${mailServer.fromEmail}\n\nWenn Sie diese E-Mail erhalten haben, funktioniert die Mailserver-Konfiguration korrekt.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Test-E-Mail von Projektverwaltung</h2>
          <p>Dies ist eine Test-E-Mail vom Mailserver <strong>"${mailServer.name}"</strong>.</p>

          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #666;">Konfiguration:</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Host:</strong> ${mailServer.host}</li>
              <li><strong>Port:</strong> ${mailServer.port}</li>
              <li><strong>Verschlüsselung:</strong> ${mailServer.useTls ? "TLS / STARTTLS" : "Keine"}</li>
              <li><strong>Absender:</strong> ${mailServer.fromEmail}</li>
            </ul>
          </div>

          <p style="color: #28a745;">Wenn Sie diese E-Mail erhalten haben, funktioniert die Mailserver-Konfiguration korrekt.</p>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #999;">Diese E-Mail wurde automatisch vom Admin-Bereich der Projektverwaltung generiert.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    return NextResponse.json({
      success: true,
      message: `Test-E-Mail erfolgreich an ${testEmail} versendet! Message-ID: ${info.messageId}`,
    });
  } catch (error) {
    console.error("Mail server test error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unbekannter Fehler beim E-Mail-Versand",
    });
  }
}
