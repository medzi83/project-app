"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

export async function updateFeedbackStatus(formData: FormData) {
  await requireRole(["ADMIN"]);

  const id = formData.get("id") as string;
  const status = formData.get("status") as string;

  if (!id || !status) {
    throw new Error("Missing required fields");
  }

  const newStatus = status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";

  await prisma.feedback.update({
    where: { id },
    data: {
      status: newStatus,
      // Mark as unviewed when status changes to RESOLVED or DISMISSED so the author gets notified
      viewedByAuthor: (newStatus === "RESOLVED" || newStatus === "DISMISSED") ? false : undefined,
    },
  });

  revalidatePath("/admin/kummerkasten");
}

export async function updateFeedbackResponse(formData: FormData) {
  await requireRole(["ADMIN"]);

  const id = formData.get("id") as string;
  const response = formData.get("response") as string;

  if (!id) {
    throw new Error("Missing feedback ID");
  }

  await prisma.feedback.update({
    where: { id },
    data: {
      adminResponse: response || null,
      // Mark as unviewed when response is added/updated so the author gets notified
      viewedByAuthor: false,
    },
  });

  revalidatePath("/admin/kummerkasten");
}

export async function deleteFeedback(formData: FormData) {
  await requireRole(["ADMIN"]);

  const id = formData.get("id") as string;

  if (!id) {
    throw new Error("Missing feedback ID");
  }

  await prisma.feedback.delete({
    where: { id },
  });

  revalidatePath("/admin/kummerkasten");
}
