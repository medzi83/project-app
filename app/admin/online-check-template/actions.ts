"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/**
 * Erstellt ein neues Template-Item
 */
export async function createTemplateItem(data: {
  label: string;
  description?: string;
}) {
  await requireRole(["ADMIN"]);

  // Höchste sortOrder ermitteln
  const maxItem = await prisma.onlineCheckTemplateItem.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const newSortOrder = (maxItem?.sortOrder ?? -1) + 1;

  await prisma.onlineCheckTemplateItem.create({
    data: {
      label: data.label,
      description: data.description || null,
      sortOrder: newSortOrder,
    },
  });

  revalidatePath("/admin/online-check-template");
  return { success: true };
}

/**
 * Aktualisiert ein Template-Item
 */
export async function updateTemplateItem(
  id: string,
  data: {
    label?: string;
    description?: string | null;
  }
) {
  await requireRole(["ADMIN"]);

  await prisma.onlineCheckTemplateItem.update({
    where: { id },
    data: {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.description !== undefined && { description: data.description }),
    },
  });

  revalidatePath("/admin/online-check-template");
  return { success: true };
}

/**
 * Löscht ein Template-Item
 */
export async function deleteTemplateItem(id: string) {
  await requireRole(["ADMIN"]);

  // Item löschen
  await prisma.onlineCheckTemplateItem.delete({
    where: { id },
  });

  // sortOrder der verbleibenden Items neu berechnen
  const remainingItems = await prisma.onlineCheckTemplateItem.findMany({
    orderBy: { sortOrder: "asc" },
  });

  await prisma.$transaction(
    remainingItems.map((item, index) =>
      prisma.onlineCheckTemplateItem.update({
        where: { id: item.id },
        data: { sortOrder: index },
      })
    )
  );

  revalidatePath("/admin/online-check-template");
  return { success: true };
}

/**
 * Verschiebt ein Item nach oben oder unten
 */
export async function moveTemplateItem(id: string, direction: "up" | "down") {
  await requireRole(["ADMIN"]);

  // Aktuelles Item holen
  const currentItem = await prisma.onlineCheckTemplateItem.findUnique({
    where: { id },
  });

  if (!currentItem) {
    return { success: false, error: "Item nicht gefunden" };
  }

  // Alle Items sortiert holen
  const allItems = await prisma.onlineCheckTemplateItem.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const currentIndex = allItems.findIndex((item) => item.id === id);

  if (direction === "up" && currentIndex > 0) {
    // Mit vorherigem Item tauschen
    const prevItem = allItems[currentIndex - 1];
    await prisma.$transaction([
      prisma.onlineCheckTemplateItem.update({
        where: { id: currentItem.id },
        data: { sortOrder: prevItem.sortOrder },
      }),
      prisma.onlineCheckTemplateItem.update({
        where: { id: prevItem.id },
        data: { sortOrder: currentItem.sortOrder },
      }),
    ]);
  } else if (direction === "down" && currentIndex < allItems.length - 1) {
    // Mit nächstem Item tauschen
    const nextItem = allItems[currentIndex + 1];
    await prisma.$transaction([
      prisma.onlineCheckTemplateItem.update({
        where: { id: currentItem.id },
        data: { sortOrder: nextItem.sortOrder },
      }),
      prisma.onlineCheckTemplateItem.update({
        where: { id: nextItem.id },
        data: { sortOrder: currentItem.sortOrder },
      }),
    ]);
  }

  revalidatePath("/admin/online-check-template");
  return { success: true };
}

/**
 * Aktualisiert die Sortierung mehrerer Items auf einmal
 */
export async function reorderTemplateItems(
  items: { id: string; sortOrder: number }[]
) {
  await requireRole(["ADMIN"]);

  await prisma.$transaction(
    items.map((item) =>
      prisma.onlineCheckTemplateItem.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      })
    )
  );

  revalidatePath("/admin/online-check-template");
  return { success: true };
}
