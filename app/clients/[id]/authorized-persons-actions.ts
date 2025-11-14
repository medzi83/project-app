"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

type AuthorizedPersonInput = {
  salutation?: string;
  firstname: string;
  lastname: string;
  email: string;
  position?: string;
  phone?: string;
  notes?: string;
};

/**
 * Create a new authorized person for a client
 */
export async function createAuthorizedPerson(clientId: string, data: AuthorizedPersonInput) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return { success: false, error: "Nicht authentifiziert" };
    }

    // Check if user has permission (ADMIN or AGENT)
    if (session.user.role !== "ADMIN" && session.user.role !== "AGENT") {
      return { success: false, error: "Keine Berechtigung" };
    }

    const authorizedPerson = await prisma.authorizedPerson.create({
      data: {
        clientId,
        ...data,
      },
    });

    revalidatePath(`/clients/${clientId}`);

    return { success: true, data: authorizedPerson };
  } catch (error) {
    console.error("Error creating authorized person:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Fehler beim Erstellen"
    };
  }
}

/**
 * Update an authorized person
 */
export async function updateAuthorizedPerson(
  id: string,
  clientId: string,
  data: Partial<AuthorizedPersonInput>
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return { success: false, error: "Nicht authentifiziert" };
    }

    // Check if user has permission (ADMIN or AGENT)
    if (session.user.role !== "ADMIN" && session.user.role !== "AGENT") {
      return { success: false, error: "Keine Berechtigung" };
    }

    const authorizedPerson = await prisma.authorizedPerson.update({
      where: { id },
      data,
    });

    revalidatePath(`/clients/${clientId}`);

    return { success: true, data: authorizedPerson };
  } catch (error) {
    console.error("Error updating authorized person:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Fehler beim Aktualisieren"
    };
  }
}

/**
 * Delete an authorized person
 */
export async function deleteAuthorizedPerson(id: string, clientId: string) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return { success: false, error: "Nicht authentifiziert" };
    }

    // Check if user has permission (ADMIN or AGENT)
    if (session.user.role !== "ADMIN" && session.user.role !== "AGENT") {
      return { success: false, error: "Keine Berechtigung" };
    }

    await prisma.authorizedPerson.delete({
      where: { id },
    });

    revalidatePath(`/clients/${clientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting authorized person:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Fehler beim Löschen"
    };
  }
}
