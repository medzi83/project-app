import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getAuthSession();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { templateId, email, agencyId } = body;

    if (!templateId || !email || !agencyId) {
      return NextResponse.json(
        { error: "Template ID, E-Mail und Agentur sind erforderlich" },
        { status: 400 }
      );
    }

    // Hole Template
    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json({ error: "Template nicht gefunden" }, { status: 404 });
    }

    // Hole Agentur
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        id: true,
        name: true,
        contactEmail: true,
        contactPhone: true,
        mailServers: true,
      },
    });

    if (!agency) {
      return NextResponse.json({ error: "Agentur nicht gefunden" }, { status: 404 });
    }

    // Hole Mailserver (von Agentur oder Standard)
    let mailServer = agency.mailServers && agency.mailServers.length > 0 ? agency.mailServers[0] : null;
    if (!mailServer) {
      mailServer = await prisma.mailServer.findFirst({
        where: { agencyId: null },
      });
    }

    if (!mailServer) {
      return NextResponse.json(
        { error: "Kein Mailserver konfiguriert" },
        { status: 500 }
      );
    }

    // Ersetze Template-Variablen mit Test-Daten
    const allReplacements: Record<string, string> = {
      // Agentur-Variablen (echte Daten)
      "{{agency.name}}": agency.name,
      "{{agency.email}}": agency.contactEmail || "nicht vorhanden",
      "{{agency.phone}}": agency.contactPhone || "nicht vorhanden",
      // Platzhalter für andere Variablen (Test-Daten)
      "{{client.name}}": "Test Kunde GmbH",
      "{{client.contact}}": "Max Mustermann",
      "{{client.phone}}": "+49 123 456789",
      "{{client.customerNo}}": "K-12345",
      "{{project.title}}": "Test Webseiten-Projekt",
      "{{project.status}}": "In Umsetzung",
      "{{project.webDate}}": new Date().toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }),
      "{{project.webterminType}}": "Telefonisch",
      "{{project.demoDate}}": new Date().toLocaleDateString("de-DE"),
      "{{project.lastMaterialAt}}": new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString("de-DE"),
      "{{project.agentName}}": "Test Agent",
      "{{website.domain}}": "www.test-projekt.de",
      "{{website.demoLink}}": "https://demo.test-projekt.de",
      "{{film.scope}}": "Imagefilm",
      "{{film.status}}": "In Produktion",
      "{{film.shootDate}}": new Date().toLocaleDateString("de-DE"),
      "{{film.filmerName}}": "Test Filmer",
      "{{film.cutterName}}": "Test Cutter",
      "{{film.previewLink}}": "https://preview.test.de/film",
      "{{film.previewDate}}": new Date().toLocaleDateString("de-DE"),
      "{{film.finalLink}}": "https://final.test.de/film",
      "{{film.onlineLink}}": "https://online.test.de/film",
      "{{agent.name}}": "Test Agent",
      "{{agent.fullName}}": "Test Agent Vollständiger Name",
      "{{agent.roleTitle}}": "Webdesigner",
      "{{agent.email}}": "agent@test.de",
      "{{agent.categories}}": "WEBSEITE, FILM",
    };

    // Funktionaler Ansatz: reduce statt Reassignment
    const processedBody = Object.entries(allReplacements).reduce((text, [placeholder, value]) => {
      const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return text.replace(new RegExp(escapedPlaceholder, "g"), value);
    }, template.body);

    const processedSubject = Object.entries(allReplacements).reduce((text, [placeholder, value]) => {
      const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return text.replace(new RegExp(escapedPlaceholder, "g"), value);
    }, template.subject);

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
      return NextResponse.json(
        { error: `Mailserver-Verbindung fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}` },
        { status: 500 }
      );
    }

    // Prepare mail options
    const mailOptions = {
      from: mailServer.fromName
        ? `"${mailServer.fromName}" <${mailServer.fromEmail}>`
        : mailServer.fromEmail,
      to: email,
      subject: `[TEST] ${processedSubject}`,
      text: processedBody.replace(/<[^>]*>/g, ""), // Strip HTML for text version
      html: `
        <div style="border: 3px solid #f59e0b; padding: 16px; margin-bottom: 16px; background-color: #fffbeb;">
          <strong style="color: #b45309;">⚠️ TEST-E-MAIL</strong><br>
          <span style="color: #92400e;">Dies ist eine Test-E-Mail. Template: ${template.title}</span>
        </div>
        ${processedBody}
      `,
    };

    // Send email
    try {
      const info = await transporter.sendMail(mailOptions);

      return NextResponse.json({
        success: true,
        message: "Test-E-Mail erfolgreich versendet",
        messageId: info.messageId,
      });
    } catch (error) {
      console.error("Email send failed:", error);
      return NextResponse.json(
        { error: `E-Mail-Versand fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Test email error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
