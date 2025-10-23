"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthSession, getEffectiveUser, requireRole } from "@/lib/authz";

const REVALIDATE_PATHS = ["/dashboard", "/notices", "/admin/notices"];

const revalidateNotices = async () => {
  await Promise.all(REVALIDATE_PATHS.map((path) => revalidatePath(path)));
};

export async function acknowledgeNotice(noticeId: string) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  const effectiveUser = await getEffectiveUser();
  if (!effectiveUser || effectiveUser.role !== "AGENT" || !effectiveUser.id) {
    throw new Error("Nur Agenten können Hinweise bestätigen.");
  }

  const agentUserId = effectiveUser.id;

  const notice = await prisma.notice.findUnique({
    where: { id: noticeId },
    select: {
      visibility: true,
      recipients: { select: { userId: true } },
      isActive: true,
    },
  });

  if (!notice || !notice.isActive) {
    throw new Error("Hinweis wurde nicht gefunden oder ist nicht mehr aktiv.");
  }

  if (
    notice.visibility === "TARGETED" &&
    !notice.recipients.some((recipient) => recipient.userId === agentUserId)
  ) {
    throw new Error("Dieser Hinweis ist dir nicht zugewiesen.");
  }

  await prisma.noticeAcknowledgement.upsert({
    where: {
      noticeId_userId: {
        noticeId,
        userId: agentUserId,
      },
    },
    update: { readAt: new Date() },
    create: {
      noticeId,
      userId: agentUserId,
    },
  });

  await revalidateNotices();
}

type NoticeVisibility = "GLOBAL" | "TARGETED";

export async function createNotice(formData: FormData) {
  const session = await requireRole(["ADMIN"]);
  const createdById = session.user.id;
  if (!createdById) {
    throw new Error("Admin-Identität konnte nicht ermittelt werden.");
  }

  const title = String(formData.get("title") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const visibility = (formData.get("visibility") ?? "GLOBAL") as NoticeVisibility;
  const requireAcknowledgement = formData.get("requireAcknowledgement") === "on";
  const isActive = formData.has("isActive");
  const recipientIds = formData.getAll("recipients").map((value) => String(value));

  if (!title) throw new Error("Titel darf nicht leer sein.");
  if (!message) throw new Error("Nachricht darf nicht leer sein.");
  if (visibility === "TARGETED" && recipientIds.length === 0) {
    throw new Error("Bitte mindestens einen Agenten auswählen.");
  }

  await prisma.notice.create({
    data: {
      title,
      message,
      visibility,
      requireAcknowledgement,
      isActive,
      createdById,
      recipients:
        visibility === "TARGETED"
          ? {
              createMany: {
                data: recipientIds.map((userId) => ({ userId })),
              },
            }
          : undefined,
    },
  });

  await revalidateNotices();
}

export async function updateNoticeActiveState(noticeId: string, isActive: boolean) {
  await requireRole(["ADMIN"]);

  await prisma.notice.update({
    where: { id: noticeId },
    data: { isActive },
  });

  await revalidateNotices();
}

export async function updateNoticeRecipients(noticeId: string, recipientIds: string[]) {
  await requireRole(["ADMIN"]);

  const notice = await prisma.notice.findUnique({
    where: { id: noticeId },
    select: { visibility: true },
  });

  if (!notice) {
    throw new Error("Hinweis nicht gefunden.");
  }

  if (notice.visibility !== "TARGETED") {
    throw new Error("Globale Hinweise benötigen keine Empfängerliste.");
  }

  await prisma.$transaction([
    prisma.noticeRecipient.deleteMany({ where: { noticeId } }),
    prisma.noticeRecipient.createMany({
      data: recipientIds.map((userId) => ({ noticeId, userId })),
    }),
  ]);

  await revalidateNotices();
}

export async function deleteNotice(noticeId: string) {
  await requireRole(["ADMIN"]);

  await prisma.notice.delete({
    where: { id: noticeId },
  });

  await revalidateNotices();
}
