"use server";

import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { revalidatePath } from "next/cache";

export async function deleteEmailLog(emailLogId: string) {
  const session = await getAuthSession();

  // Only admins can delete email logs
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized: Only admins can delete email logs");
  }

  // Get email log to determine client for revalidation
  const emailLog = await prisma.emailLog.findUnique({
    where: { id: emailLogId },
    include: {
      project: {
        select: {
          clientId: true,
        },
      },
    },
  });

  if (!emailLog) {
    throw new Error("Email log not found");
  }

  // Delete the email log
  await prisma.emailLog.delete({
    where: { id: emailLogId },
  });

  // Revalidate client page
  if (emailLog.project?.clientId) {
    revalidatePath(`/clients/${emailLog.project.clientId}`);
  }

  return { success: true };
}
