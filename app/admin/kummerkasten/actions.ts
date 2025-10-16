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

  await prisma.feedback.update({
    where: { id },
    data: { status: status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED" },
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
