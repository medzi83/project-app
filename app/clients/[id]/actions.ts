"use server";

import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { FroxlorClient } from "@/lib/froxlor";
import type { FroxlorCustomerUpdateInput } from "@/lib/froxlor";

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

export async function updateClientBasicData(formData: FormData) {
  const session = await getAuthSession();

  // Only admins can update client data
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, message: "Nicht autorisiert" };
  }

  const clientId = formData.get("clientId") as string;
  const name = formData.get("name") as string;
  const customerNo = formData.get("customerNo") as string;
  const salutation = formData.get("salutation") as string;
  const firstname = formData.get("firstname") as string;
  const lastname = formData.get("lastname") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const serverId = formData.get("serverId") as string;
  const agencyId = formData.get("agencyId") as string;
  const notes = formData.get("notes") as string;
  const workStopped = formData.get("workStopped") === "on";
  const finished = formData.get("finished") === "on";

  try {
    await prisma.client.update({
      where: { id: clientId },
      data: {
        name: name || undefined,
        customerNo: customerNo || null,
        salutation: salutation || null,
        firstname: firstname || null,
        lastname: lastname || null,
        email: email || null,
        phone: phone || null,
        serverId: serverId || null,
        agencyId: agencyId || null,
        notes: notes || null,
        workStopped,
        finished,
      },
    });

    // Revalidate the page to show updated data
    revalidatePath(`/clients/${clientId}`);
    return { success: true, message: "Kundendaten erfolgreich aktualisiert" };
  } catch (error) {
    console.error("Error updating client:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Fehler beim Aktualisieren der Kundendaten"
    };
  }
}

export async function assignDomainToProject(formData: FormData) {
  const session = await getAuthSession();

  // Only admins can assign domains
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, message: "Nicht autorisiert" };
  }

  const projectId = formData.get("projectId") as string;
  const domain = formData.get("domain") as string;
  const previousDomain = formData.get("previousDomain") as string;

  if (!projectId) {
    return { success: false, message: "Projekt-ID fehlt" };
  }

  try {
    // Check if domain is already assigned to another project
    let warningMessage = "";
    if (domain) {
      const existingAssignment = await prisma.projectWebsite.findFirst({
        where: {
          domain: domain,
          projectId: { not: projectId },
        },
        include: {
          project: {
            select: {
              title: true,
            },
          },
        },
      });

      if (existingAssignment) {
        warningMessage = ` (vorher zugeordnet zu: ${existingAssignment.project.title})`;

        // Remove domain from previous project and add to history
        await prisma.projectWebsite.update({
          where: { projectId: existingAssignment.projectId },
          data: { domain: null },
        });

        // Close previous assignment in history
        await prisma.projectDomainHistory.updateMany({
          where: {
            projectId: existingAssignment.projectId,
            domain: domain,
            removedAt: null,
          },
          data: {
            removedAt: new Date(),
            reason: `Domain zu anderem Projekt verschoben (${projectId})`,
          },
        });
      }
    }

    // If previous domain exists, close it in history
    if (previousDomain && previousDomain !== domain) {
      await prisma.projectDomainHistory.updateMany({
        where: {
          projectId: projectId,
          domain: previousDomain,
          removedAt: null,
        },
        data: {
          removedAt: new Date(),
          reason: domain ? "Domain gewechselt" : "Domain entfernt",
        },
      });
    }

    // Update project with new domain
    await prisma.projectWebsite.update({
      where: { projectId: projectId },
      data: { domain: domain || null },
    });

    // Create history entry for new domain
    if (domain) {
      await prisma.projectDomainHistory.create({
        data: {
          projectId: projectId,
          domain: domain,
        },
      });
    }

    // Get the client ID to revalidate the correct page
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { clientId: true },
    });

    // Revalidate the client detail page
    if (project?.clientId) {
      revalidatePath(`/clients/${project.clientId}`);
    }
    revalidatePath(`/clients`);

    return {
      success: true,
      message: `Domain erfolgreich zugeordnet${warningMessage}`
    };
  } catch (error) {
    console.error("Error assigning domain to project:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Fehler beim Zuordnen der Domain"
    };
  }
}

export async function updateFroxlorCustomerData(formData: FormData) {
  const session = await getAuthSession();

  // Only admins can update Froxlor data
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, message: "Nicht autorisiert" };
  }

  const serverId = formData.get("serverId") as string;
  const customerId = formData.get("customerId") as string;
  const firstname = formData.get("firstname") as string;
  const name = formData.get("name") as string;
  const company = formData.get("company") as string;
  const email = formData.get("email") as string;
  const diskspace_gb = formData.get("diskspace_gb") as string;
  const mysqls = formData.get("mysqls") as string;
  const ftps = formData.get("ftps") as string;
  const deactivated = formData.get("deactivated") === "on";

  // Convert GB to MB for Froxlor API
  const diskspaceMB = parseInt(diskspace_gb) * 1000;

  const server = await prisma.server.findUnique({
    where: { id: serverId },
  });

  if (!server || !server.froxlorUrl || !server.froxlorApiKey || !server.froxlorApiSecret) {
    return { success: false, message: "Server nicht konfiguriert" };
  }

  const froxlorClient = new FroxlorClient({
    url: server.froxlorUrl,
    apiKey: server.froxlorApiKey,
    apiSecret: server.froxlorApiSecret,
  });

  const updateData: FroxlorCustomerUpdateInput = {
    firstname,
    name,
    company,
    email,
    diskspace: diskspaceMB,
    mysqls: Number.parseInt(mysqls, 10) || 0,
    ftps: Number.parseInt(ftps, 10) || 0,
    deactivated: deactivated ? 1 : 0,
  };

  try {
    const result = await froxlorClient.updateCustomer(parseInt(customerId), updateData);

    if (result.success) {
      // Revalidate the page to show updated data
      revalidatePath(`/clients`);
      return { success: true, message: "Kundendaten erfolgreich aktualisiert" };
    }

    return { success: false, message: result.message };
  } catch (error) {
    console.error("Error updating Froxlor customer:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Fehler beim Aktualisieren der Kundendaten"
    };
  }
}
