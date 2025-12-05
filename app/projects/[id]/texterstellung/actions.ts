"use server";

import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { revalidatePath } from "next/cache";

// Start the Texterstellung process by copying bullet points
export async function startTexterstellung(
  projectId: string,
  menuItems: { id: string; name: string; content: string }[],
  generalText?: { id: string; name: string; content: string }
) {
  const session = await getAuthSession();
  if (!session) throw new Error("Nicht authentifiziert");

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "AGENT") {
    throw new Error("Keine Berechtigung");
  }

  // Check if texterstellung already exists
  const existing = await prisma.texterstellung.findUnique({
    where: { projectId },
  });

  if (existing) {
    throw new Error("Texterstellung wurde bereits gestartet");
  }

  // Prepare all items including general text if provided
  const allItems = [
    ...menuItems.map((item) => ({
      menuItemId: item.id,
      menuItemName: item.name,
      bulletPoints: item.content,
      bulletPointsCopiedAt: new Date(),
      status: "PENDING" as const,
    })),
  ];

  // Add general text (Weitere Texte) as an item if provided
  if (generalText) {
    allItems.push({
      menuItemId: generalText.id,
      menuItemName: generalText.name,
      bulletPoints: generalText.content,
      bulletPointsCopiedAt: new Date(),
      status: "PENDING" as const,
    });
  }

  // Create texterstellung with items
  const texterstellung = await prisma.texterstellung.create({
    data: {
      projectId,
      status: "IN_PROGRESS",
      startedAt: new Date(),
      startedByUserId: session.user.id,
      startedByName: session.user.name || "Unbekannt",
      items: {
        create: allItems,
      },
    },
  });

  revalidatePath(`/projects/${projectId}/texterstellung`);
  return { success: true, texterstellungId: texterstellung.id };
}

// Save a draft text for an item
export async function saveTextDraft(
  itemId: string,
  content: string,
  projectId: string
) {
  const session = await getAuthSession();
  if (!session) throw new Error("Nicht authentifiziert");

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "AGENT") {
    throw new Error("Keine Berechtigung");
  }

  const item = await prisma.texterstellungItem.findUnique({
    where: { id: itemId },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });

  if (!item) throw new Error("Item nicht gefunden");

  // Check if there's an existing draft version without customer decision
  const latestVersion = item.versions[0];
  if (latestVersion && !latestVersion.customerDecision) {
    // Update existing draft
    await prisma.texterstellungVersion.update({
      where: { id: latestVersion.id },
      data: {
        content,
        createdByUserId: session.user.id,
        createdByName: session.user.name || "Unbekannt",
      },
    });
  } else {
    // Create new version
    const nextVersionNumber = (latestVersion?.versionNumber || 0) + 1;
    await prisma.texterstellungVersion.create({
      data: {
        itemId,
        versionNumber: nextVersionNumber,
        content,
        createdByUserId: session.user.id,
        createdByName: session.user.name || "Unbekannt",
      },
    });
  }

  // Update item status to DRAFT
  await prisma.texterstellungItem.update({
    where: { id: itemId },
    data: { status: "DRAFT" },
  });

  revalidatePath(`/projects/${projectId}/texterstellung`);
  return { success: true };
}

// Mark a single text as complete
export async function markTextAsComplete(
  itemId: string,
  projectId: string
) {
  const session = await getAuthSession();
  if (!session) throw new Error("Nicht authentifiziert");

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "AGENT") {
    throw new Error("Keine Berechtigung");
  }

  const item = await prisma.texterstellungItem.findUnique({
    where: { id: itemId },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });

  if (!item) throw new Error("Item nicht gefunden");
  if (!item.versions[0]) throw new Error("Kein Text vorhanden");

  // Update item status to APPROVED (fertig)
  await prisma.texterstellungItem.update({
    where: { id: itemId },
    data: { status: "APPROVED" },
  });

  // Update texterstellung status
  await updateTexterstellungStatus(item.texterstellungId);

  revalidatePath(`/projects/${projectId}/texterstellung`);
  return { success: true };
}

// Mark a single text as incomplete (back to draft)
export async function markTextAsIncomplete(
  itemId: string,
  projectId: string
) {
  const session = await getAuthSession();
  if (!session) throw new Error("Nicht authentifiziert");

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "AGENT") {
    throw new Error("Keine Berechtigung");
  }

  const item = await prisma.texterstellungItem.findUnique({
    where: { id: itemId },
  });

  if (!item) throw new Error("Item nicht gefunden");

  // Update item status back to DRAFT
  await prisma.texterstellungItem.update({
    where: { id: itemId },
    data: { status: "DRAFT" },
  });

  // Update texterstellung status
  await updateTexterstellungStatus(item.texterstellungId);

  revalidatePath(`/projects/${projectId}/texterstellung`);
  return { success: true };
}

// Mark all texts as complete at once
export async function markAllTextsAsComplete(
  texterstellungId: string,
  projectId: string
) {
  const session = await getAuthSession();
  if (!session) throw new Error("Nicht authentifiziert");

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "AGENT") {
    throw new Error("Keine Berechtigung");
  }

  // Get all items that have a draft
  const items = await prisma.texterstellungItem.findMany({
    where: {
      texterstellungId,
      status: "DRAFT",
    },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });

  // Only mark items that have content as complete
  const itemsWithContent = items.filter(
    (item) => item.versions[0]?.content
  );

  if (itemsWithContent.length === 0) {
    throw new Error("Keine Texte zum Abschließen vorhanden");
  }

  // Update all items to APPROVED
  await prisma.texterstellungItem.updateMany({
    where: {
      id: { in: itemsWithContent.map((i) => i.id) },
    },
    data: { status: "APPROVED" },
  });

  // Update texterstellung status
  await updateTexterstellungStatus(texterstellungId);

  revalidatePath(`/projects/${projectId}/texterstellung`);
  return { success: true, count: itemsWithContent.length };
}

// Update texter note for a specific item
export async function updateTexterNote(
  itemId: string,
  note: string,
  projectId: string
) {
  const session = await getAuthSession();
  if (!session) throw new Error("Nicht authentifiziert");

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "AGENT") {
    throw new Error("Keine Berechtigung");
  }

  await prisma.texterstellungItem.update({
    where: { id: itemId },
    data: { texterNote: note || null },
  });

  revalidatePath(`/projects/${projectId}/texterstellung`);
  return { success: true };
}

// Delete complete texterstellung (ADMIN only)
export async function deleteTexterstellung(
  texterstellungId: string,
  projectId: string
) {
  const session = await getAuthSession();
  if (!session) throw new Error("Nicht authentifiziert");

  const role = session.user.role;
  if (role !== "ADMIN") {
    throw new Error("Nur Administratoren können die Texterstellung löschen");
  }

  // Delete all versions for all items
  await prisma.texterstellungVersion.deleteMany({
    where: {
      item: {
        texterstellungId,
      },
    },
  });

  // Delete all items
  await prisma.texterstellungItem.deleteMany({
    where: { texterstellungId },
  });

  // Delete the texterstellung itself
  await prisma.texterstellung.delete({
    where: { id: texterstellungId },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/texterstellung`);
  return { success: true };
}

// Helper to update the overall texterstellung status
async function updateTexterstellungStatus(texterstellungId: string) {
  const items = await prisma.texterstellungItem.findMany({
    where: { texterstellungId },
  });

  // Mindestens ein Item muss existieren und alle müssen APPROVED sein
  const allApproved = items.length > 0 && items.every((i) => i.status === "APPROVED");
  const anyDraft = items.some((i) => i.status === "DRAFT");

  let status: "PENDING" | "IN_PROGRESS" | "COMPLETED";

  if (allApproved) {
    status = "COMPLETED";
  } else if (anyDraft) {
    status = "IN_PROGRESS";
  } else {
    status = "PENDING";
  }

  const updateData: { status: typeof status; completedAt?: Date } = { status };
  if (status === "COMPLETED") {
    updateData.completedAt = new Date();
  }

  const texterstellung = await prisma.texterstellung.update({
    where: { id: texterstellungId },
    data: updateData,
  });

  // Wenn Texterstellung abgeschlossen, automatisch Textit-Status auf JA_JA setzen
  if (status === "COMPLETED") {
    await prisma.projectWebsite.update({
      where: { projectId: texterstellung.projectId },
      data: { textit: "JA_JA" },
    });
  }
}
