"use server";

import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { FroxlorClient, createFroxlorClientFromServer } from "@/lib/froxlor";
import type { FroxlorCustomerUpdateInput } from "@/lib/froxlor";
import type { PaymentInterval, PaymentMethod, ContractService } from "@prisma/client";

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

  // Only admins and agents can update client data
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AGENT")) {
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
  const uploadLinksJson = formData.get("uploadLinks") as string;
  const workStopped = formData.get("workStopped") === "on";
  const finished = formData.get("finished") === "on";

  // Parse upload links JSON
  let uploadLinksData: string[] | undefined = undefined;
  if (uploadLinksJson) {
    try {
      const parsedLinks = JSON.parse(uploadLinksJson);
      if (Array.isArray(parsedLinks) && parsedLinks.length > 0) {
        uploadLinksData = parsedLinks;
      }
    } catch (error) {
      console.error("Error parsing upload links:", error);
    }
  }

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
        uploadLinks: uploadLinksData,
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

export async function updateFtpAccountPassword(formData: FormData) {
  const session = await getAuthSession();

  // Only admins can update FTP passwords
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, message: "Nicht autorisiert" };
  }

  const serverId = formData.get("serverId") as string;
  const ftpId = formData.get("ftpId") as string;
  const customerId = formData.get("customerId") as string;
  const clientId = formData.get("clientId") as string;
  const newPassword = formData.get("newPassword") as string;

  if (!serverId || !ftpId || !customerId || !clientId || !newPassword) {
    return { success: false, message: "Fehlende Parameter" };
  }

  try {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return { success: false, message: "Server nicht gefunden" };
    }

    const froxlorClient = createFroxlorClientFromServer(server);

    if (!froxlorClient) {
      return { success: false, message: "Froxlor-Konfiguration unvollständig" };
    }

    const result = await froxlorClient.updateFtpPassword(parseInt(ftpId), parseInt(customerId), newPassword);

    if (result.success) {
      // Save password in database
      const client = await prisma.client.findUnique({
        where: { id: clientId }
      });

      if (client) {
        const ftpPasswords = (client.ftpPasswords as Record<string, string>) || {};
        ftpPasswords[ftpId] = newPassword;

        await prisma.client.update({
          where: { id: clientId },
          data: { ftpPasswords }
        });
      }

      // No revalidation needed - page will be reloaded by component
      return { success: true, message: "FTP-Passwort erfolgreich aktualisiert" };
    }

    return { success: false, message: result.message };
  } catch (error) {
    console.error("Error updating FTP password:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Fehler beim Aktualisieren des FTP-Passworts"
    };
  }
}

export async function deleteProject(formData: FormData) {
  const session = await getAuthSession();

  // Only admins can delete projects
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, message: "Nicht autorisiert" };
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim();

  if (!projectId) {
    return { success: false, message: "Projekt-ID fehlt" };
  }

  try {
    // Delete project and all related data in a transaction
    await prisma.$transaction([
      prisma.projectNote.deleteMany({ where: { projectId } }),
      prisma.projectDomainHistory.deleteMany({ where: { projectId } }),
      prisma.projectWebsite.deleteMany({ where: { projectId } }),
      prisma.projectFilm.deleteMany({ where: { projectId } }),
      prisma.project.delete({ where: { id: projectId } }),
    ]);

    // Revalidate relevant paths
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/dashboard");

    if (clientId) {
      revalidatePath(`/clients/${clientId}`);
    }

    return { success: true, message: "Projekt erfolgreich gelöscht" };
  } catch (error) {
    console.error("Error deleting project:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Fehler beim Löschen des Projekts"
    };
  }
}

// ==================== Vertragsdaten Actions ====================

export async function updateClientContract(formData: FormData) {
  const session = await getAuthSession();

  // Only admins and agents can update contract data
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AGENT")) {
    return { success: false, message: "Nicht autorisiert" };
  }

  const clientId = formData.get("clientId") as string;

  if (!clientId) {
    return { success: false, message: "Client-ID fehlt" };
  }

  // Parse form data
  const contractStartStr = formData.get("contractStart") as string;
  const contractDurationStr = formData.get("contractDuration") as string;
  const setupFeeStr = formData.get("setupFee") as string;
  const paymentIntervalStr = formData.get("paymentInterval") as string;
  const paymentMethodStr = formData.get("paymentMethod") as string;
  const monthlyAmountStr = formData.get("monthlyAmount") as string;
  const servicesStr = formData.getAll("services") as string[];
  const street = formData.get("street") as string;
  const houseNumber = formData.get("houseNumber") as string;
  const postalCode = formData.get("postalCode") as string;
  const city = formData.get("city") as string;
  const phone1 = formData.get("phone1") as string;
  const phone2 = formData.get("phone2") as string;
  const mobile = formData.get("mobile") as string;
  const note = formData.get("note") as string;
  const minTermEndStr = formData.get("minTermEnd") as string;
  const cancellationStr = formData.get("cancellation") as string;
  const sepaMandate = formData.get("sepaMandate") as string;
  const createdBy = formData.get("createdBy") as string;

  // Parse values
  const contractStart = contractStartStr ? new Date(contractStartStr) : null;
  const contractDuration = contractDurationStr ? parseInt(contractDurationStr, 10) : null;
  const setupFee = setupFeeStr ? parseFloat(setupFeeStr.replace(",", ".")) : null;
  const paymentInterval = paymentIntervalStr as PaymentInterval | null;
  const paymentMethod = paymentMethodStr as PaymentMethod | null;
  const monthlyAmount = monthlyAmountStr ? parseFloat(monthlyAmountStr.replace(",", ".")) : null;
  const services = servicesStr.filter(s => s) as ContractService[];
  const minTermEnd = minTermEndStr ? new Date(minTermEndStr) : null;
  const cancellation = cancellationStr || null; // Freitext, kein Datum

  try {
    // Upsert contract data
    await prisma.clientContract.upsert({
      where: { clientId },
      update: {
        contractStart,
        contractDuration,
        setupFee,
        paymentInterval,
        paymentMethod,
        monthlyAmount,
        services,
        street: street || null,
        houseNumber: houseNumber || null,
        postalCode: postalCode || null,
        city: city || null,
        phone1: phone1 || null,
        phone2: phone2 || null,
        mobile: mobile || null,
        note: note || null,
        minTermEnd,
        cancellation,
        sepaMandate: sepaMandate || null,
        createdBy: createdBy || null,
      },
      create: {
        clientId,
        contractStart,
        contractDuration,
        setupFee,
        paymentInterval,
        paymentMethod,
        monthlyAmount,
        services,
        street: street || null,
        houseNumber: houseNumber || null,
        postalCode: postalCode || null,
        city: city || null,
        phone1: phone1 || null,
        phone2: phone2 || null,
        mobile: mobile || null,
        note: note || null,
        minTermEnd,
        cancellation,
        sepaMandate: sepaMandate || null,
        createdBy: createdBy || null,
      },
    });

    revalidatePath(`/clients/${clientId}`);
    return { success: true, message: "Vertragsdaten erfolgreich gespeichert" };
  } catch (error) {
    console.error("Error updating client contract:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Fehler beim Speichern der Vertragsdaten"
    };
  }
}

export async function deleteClientContract(clientId: string) {
  const session = await getAuthSession();

  // Only admins can delete contract data
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, message: "Nicht autorisiert" };
  }

  try {
    await prisma.clientContract.delete({
      where: { clientId },
    });

    revalidatePath(`/clients/${clientId}`);
    return { success: true, message: "Vertragsdaten erfolgreich gelöscht" };
  } catch (error) {
    console.error("Error deleting client contract:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Fehler beim Löschen der Vertragsdaten"
    };
  }
}

// ==================== Domain Actions ====================

export async function updateDomainSettings(formData: FormData) {
  const session = await getAuthSession();

  // Only admins can update domain settings
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, message: "Nicht autorisiert" };
  }

  const serverId = formData.get("serverId") as string;
  const domainId = formData.get("domainId") as string;
  const clientId = formData.get("clientId") as string;
  const letsencrypt = formData.get("letsencrypt") as string;
  const phpsettingid = formData.get("phpsettingid") as string;

  if (!serverId || !domainId) {
    return { success: false, message: "Fehlende Parameter" };
  }

  try {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return { success: false, message: "Server nicht gefunden" };
    }

    const froxlorClient = createFroxlorClientFromServer(server);

    if (!froxlorClient) {
      return { success: false, message: "Froxlor-Konfiguration unvollständig" };
    }

    // Build update data - only include fields that were provided
    const updateData: {
      letsencrypt?: number;
      ssl_redirect?: number;
      phpsettingid?: number;
      selectserveralias?: number;
    } = {};

    if (letsencrypt !== null && letsencrypt !== undefined) {
      const leValue = parseInt(letsencrypt, 10);
      updateData.letsencrypt = leValue;
      // If enabling Let's Encrypt, also enable SSL redirect and set serveralias to "none"
      // Froxlor can only validate non-wildcard domains via ACME HTTP
      // selectserveralias: 0 = wildcard (*), 1 = www-alias, 2 = none
      if (leValue === 1) {
        updateData.ssl_redirect = 1;
        updateData.selectserveralias = 2; // 2 = none (no alias)
      }
    }

    if (phpsettingid) {
      updateData.phpsettingid = parseInt(phpsettingid, 10);
    }

    const result = await froxlorClient.updateDomain(parseInt(domainId, 10), updateData);

    if (result.success) {
      // Revalidate the client page to show updated data
      if (clientId) {
        revalidatePath(`/clients/${clientId}`);
      }
      return { success: true, message: "Domain-Einstellungen erfolgreich aktualisiert" };
    }

    return { success: false, message: result.message };
  } catch (error) {
    console.error("Error updating domain settings:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Fehler beim Aktualisieren der Domain-Einstellungen"
    };
  }
}
