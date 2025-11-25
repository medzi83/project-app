"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import bcrypt from "bcryptjs";
import crypto from "crypto";

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
