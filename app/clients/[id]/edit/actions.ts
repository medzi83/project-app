"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

export async function updateClient(formData: FormData) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Nicht autorisiert");
  }

  const clientId = formData.get("clientId") as string;
  const name = formData.get("name") as string;
  const customerNo = formData.get("customerNo") as string;
  const contact = formData.get("contact") as string;
  const phone = formData.get("phone") as string;
  const serverId = formData.get("serverId") as string;
  const notes = formData.get("notes") as string;
  const agencyId = formData.get("agencyId") as string;
  const workStopped = formData.get("workStopped") === "on";
  const finished = formData.get("finished") === "on";

  await prisma.client.update({
    where: { id: clientId },
    data: {
      name: name || undefined,
      customerNo: customerNo || null,
      contact: contact || null,
      phone: phone || null,
      serverId: serverId || null,
      notes: notes || null,
      agencyId: agencyId || null,
      workStopped,
      finished,
    },
  });

  redirect(`/clients/${clientId}`);
}
