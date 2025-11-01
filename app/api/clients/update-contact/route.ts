"use server";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

/**
 * POST - Update client email and/or contact
 * Note: preferredRegion cannot be used with "use server" - will use default region
 */
export async function POST(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { clientId, email, salutation, firstname, lastname, agencyId } = body;

  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }

  // SECURITY: Check authorization
  if (session.user.role === "CUSTOMER") {
    // Customers can only update their own client data
    if (session.user.clientId !== clientId) {
      return NextResponse.json({ error: "Forbidden: Cannot update other clients" }, { status: 403 });
    }
  } else if (!["ADMIN", "AGENT"].includes(session.user.role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate email if provided
  if (email && typeof email === "string") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
    }
  }

  try {
    // Update client
    const updateData: {
      email?: string | null;
      salutation?: string | null;
      firstname?: string | null;
      lastname?: string | null;
      agencyId?: string | null;
    } = {};

    if (email !== undefined) {
      updateData.email = email || null;
    }

    if (salutation !== undefined) {
      updateData.salutation = salutation || null;
    }

    if (firstname !== undefined) {
      updateData.firstname = firstname || null;
    }

    if (lastname !== undefined) {
      updateData.lastname = lastname || null;
    }

    if (agencyId !== undefined) {
      updateData.agencyId = agencyId || null;
    }

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      client: {
        id: updatedClient.id,
        name: updatedClient.name,
        email: updatedClient.email,
        salutation: updatedClient.salutation,
        firstname: updatedClient.firstname,
        lastname: updatedClient.lastname,
      },
    });
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Kunden" },
      { status: 500 }
    );
  }
}
