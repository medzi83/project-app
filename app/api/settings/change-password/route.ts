import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const runtime = 'nodejs';
export const preferredRegion = 'fra1';

export async function POST(req: NextRequest) {
  try {
    // Authentifizierung prüfen
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    // Validierung
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Alle Felder sind erforderlich" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Das neue Passwort muss mindestens 6 Zeichen lang sein" }, { status: 400 });
    }

    // Benutzer aus Datenbank laden
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }

    // Aktuelles Passwort überprüfen
    const isPasswordValid = bcrypt.compareSync(currentPassword, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Aktuelles Passwort ist falsch" }, { status: 400 });
    }

    // Neues Passwort hashen
    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    // Passwort in Datenbank aktualisieren
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ message: "Passwort erfolgreich geändert" }, { status: 200 });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
