"use server";

import { getAuthSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { FroxlorClient } from "@/lib/froxlor";
import type { FroxlorCustomerCreateInput, FroxlorCustomerUpdateInput } from "@/lib/froxlor";
import { redirect } from "next/navigation";

export async function testFroxlorConnection(serverId: string) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return { success: false, message: "Nicht autorisiert" };
  }

  const server = await prisma.server.findUnique({
    where: { id: serverId },
  });

  if (!server) {
    return { success: false, message: "Server nicht gefunden" };
  }

  if (!server.froxlorUrl || !server.froxlorApiKey || !server.froxlorApiSecret) {
    return {
      success: false,
      message: "Froxlor-Zugangsdaten unvollständig. Bitte in der Serververwaltung konfigurieren.",
    };
  }

  const client = new FroxlorClient({
    url: server.froxlorUrl,
    apiKey: server.froxlorApiKey,
    apiSecret: server.froxlorApiSecret,
  });

  return await client.testConnection();
}

export async function getPhpConfigs(serverId: string) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return { success: false, message: "Nicht autorisiert", configs: [] };
  }

  const server = await prisma.server.findUnique({
    where: { id: serverId },
  });

  if (!server || !server.froxlorUrl || !server.froxlorApiKey || !server.froxlorApiSecret) {
    return { success: false, message: "Server nicht konfiguriert", configs: [] };
  }

  const client = new FroxlorClient({
    url: server.froxlorUrl,
    apiKey: server.froxlorApiKey,
    apiSecret: server.froxlorApiSecret,
  });

  const configs = await client.getPhpConfigs();

  return {
    success: true,
    configs,
    message: "PHP-Konfigurationen abgerufen",
  };
}

export async function getCustomerDomains(serverId: string, customerId: number) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return { success: false, message: "Nicht autorisiert", domains: [], standardDomainId: null };
  }

  const server = await prisma.server.findUnique({
    where: { id: serverId },
  });

  if (!server || !server.froxlorUrl || !server.froxlorApiKey || !server.froxlorApiSecret) {
    return { success: false, message: "Server nicht konfiguriert", domains: [], standardDomainId: null };
  }

  const client = new FroxlorClient({
    url: server.froxlorUrl,
    apiKey: server.froxlorApiKey,
    apiSecret: server.froxlorApiSecret,
  });

  const domains = await client.getCustomerDomains(customerId);

  return {
    success: true,
    domains,
    message: `${domains.length} Domain(s) abgerufen`,
  };
}

export async function getCustomerStandardDomain(serverId: string, customerId: number, standardSubdomainId: number) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return { success: false, message: "Nicht autorisiert", domain: null };
  }

  const server = await prisma.server.findUnique({
    where: { id: serverId },
  });

  if (!server || !server.froxlorUrl || !server.froxlorApiKey || !server.froxlorApiSecret) {
    return { success: false, message: "Server nicht konfiguriert", domain: null };
  }

  const client = new FroxlorClient({
    url: server.froxlorUrl,
    apiKey: server.froxlorApiKey,
    apiSecret: server.froxlorApiSecret,
  });

  const domain = await client.getCustomerStandardDomain(customerId, standardSubdomainId);

  return {
    success: !!domain,
    domain,
    message: domain ? "Standard-Domain abgerufen" : "Standard-Domain nicht gefunden",
  };
}

export async function updateStandardDomain(formData: FormData) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return { success: false, message: "Nicht autorisiert" };
  }

  const serverId = formData.get("serverId") as string;
  const domainId = formData.get("domainId") as string;
  const documentroot = formData.get("domain_documentroot") as string;
  const ssl_redirect = formData.get("domain_ssl_redirect") === "on";
  const letsencrypt = formData.get("domain_letsencrypt") === "on";
  const phpsettingid = formData.get("domain_phpsettingid") as string;

  const server = await prisma.server.findUnique({
    where: { id: serverId },
  });

  if (!server || !server.froxlorUrl || !server.froxlorApiKey || !server.froxlorApiSecret) {
    return { success: false, message: "Server nicht konfiguriert" };
  }

  const client = new FroxlorClient({
    url: server.froxlorUrl,
    apiKey: server.froxlorApiKey,
    apiSecret: server.froxlorApiSecret,
  });

  const result = await client.updateDomain(parseInt(domainId), {
    documentroot: documentroot || undefined,
    ssl_redirect: ssl_redirect ? 1 : 0,
    letsencrypt: letsencrypt ? 1 : 0,
    phpsettingid: phpsettingid ? parseInt(phpsettingid) : undefined,
  });

  return result;
}

export async function checkCustomerNumber(serverId: string, customerNumber: string, debug = false) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return { success: false, message: "Nicht autorisiert", exists: false };
  }

  const server = await prisma.server.findUnique({
    where: { id: serverId },
  });

  if (!server || !server.froxlorUrl || !server.froxlorApiKey || !server.froxlorApiSecret) {
    return { success: false, message: "Server nicht konfiguriert", exists: false };
  }

  const client = new FroxlorClient({
    url: server.froxlorUrl,
    apiKey: server.froxlorApiKey,
    apiSecret: server.froxlorApiSecret,
  });

  const customer = await client.findCustomerByNumber(customerNumber, debug);

  // If customer found and we have customerNumber in DB, update the server reference
  if (customer && customerNumber) {
    // Determine if customer should be assigned to an agency based on customer number
    let agencyId: string | undefined;

    if (customerNumber.startsWith("3")) {
      // Find or create Vendoweb agency
      let vendowebAgency = await prisma.agency.findFirst({
        where: { name: "Vendoweb" },
      });

      if (!vendowebAgency) {
        vendowebAgency = await prisma.agency.create({
          data: {
            name: "Vendoweb",
            contactEmail: "info@vendoweb.de",
            contactPhone: "",
          },
        });
      }

      agencyId = vendowebAgency.id;
    } else if (customerNumber.startsWith("2")) {
      // Find or create Eventomaxx agency
      let eventomaxxAgency = await prisma.agency.findFirst({
        where: { name: "Eventomaxx" },
      });

      if (!eventomaxxAgency) {
        eventomaxxAgency = await prisma.agency.create({
          data: {
            name: "Eventomaxx",
            contactEmail: "info@eventomaxx.de",
            contactPhone: "",
          },
        });
      }

      agencyId = eventomaxxAgency.id;
    }

    // Update server reference and agency assignment
    await prisma.client.updateMany({
      where: { customerNo: customerNumber },
      data: {
        serverId: serverId,
        ...(agencyId ? { agencyId } : {}),
      },
    });
  }

  return {
    success: true,
    exists: !!customer,
    customer: customer || undefined,
    message: customer ? "Kunde gefunden" : "Kunde nicht gefunden",
  };
}

export async function createOrUpdateFroxlorCustomer(formData: FormData) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return { success: false, message: "Nicht autorisiert" };
  }

  const serverId = formData.get("serverId") as string;
  const customerNumber = formData.get("customerNumber") as string;
  const firstname = formData.get("firstname") as string;
  const name = formData.get("name") as string;
  const company = formData.get("company") as string;
  const email = formData.get("email") as string;
  const loginname = formData.get("loginname") as string;
  const password = formData.get("password") as string;
  const diskspace_gb = formData.get("diskspace_gb") as string;
  const mysqls = formData.get("mysqls") as string;
  const ftps = formData.get("ftps") as string;
  const documentroot = formData.get("documentroot") as string;
  const deactivated = formData.get("deactivated") === "on";
  const leregistered = formData.get("leregistered") === "on";
  const existingCustomerId = formData.get("existingCustomerId") as string;

  // Get all selected PHP configs (checkboxes)
  const phpConfigIds: string[] = [];
  formData.forEach((value, key) => {
    if (key.startsWith("phpconfig_") && value === "on") {
      phpConfigIds.push(key.replace("phpconfig_", ""));
    }
  });
  const allowed_phpconfigs = phpConfigIds.length > 0 ? `[${phpConfigIds.join(",")}]` : "[1]";

  // Convert GB to MB for Froxlor API
  // 1 GB input = 1000 MB (decimal, not binary)
  // Froxlor expects MB and will display it correctly
  const diskspaceMB = parseInt(diskspace_gb) * 1000;

  const server = await prisma.server.findUnique({
    where: { id: serverId },
  });

  if (!server || !server.froxlorUrl || !server.froxlorApiKey || !server.froxlorApiSecret) {
    return { success: false, message: "Server nicht konfiguriert" };
  }

  const client = new FroxlorClient({
    url: server.froxlorUrl,
    apiKey: server.froxlorApiKey,
    apiSecret: server.froxlorApiSecret,
  });

  // Update existing customer
  if (existingCustomerId) {
    const updateData: FroxlorCustomerUpdateInput = {
      customernumber: customerNumber,
      firstname,
      name,
      company,
      email,
      diskspace: diskspaceMB,
      mysqls: Number.parseInt(mysqls, 10) || 0,
      ftps: Number.parseInt(ftps, 10) || 0,
      deactivated: deactivated ? 1 : 0,
      phpsettings: allowed_phpconfigs,
      leregistered: leregistered ? 1 : 0,
    };

    if (documentroot && documentroot.trim()) {
      updateData.documentroot = documentroot;
    }

    const result = await client.updateCustomer(parseInt(existingCustomerId), updateData);
    return result;
  }

  // Create new customer
  // In this system, loginname = customerNumber
  const createData: FroxlorCustomerCreateInput = {
    customernumber: customerNumber,
    firstname,
    name,
    company,
    email: "server@eventomaxx.de", // Always this email
    loginname: loginname || customerNumber,
    password,
    diskspace: diskspaceMB,
    mysqls: Number.parseInt(mysqls, 10) || 0,
    ftps: Number.parseInt(ftps, 10) || 0,
    deactivated: deactivated ? 1 : 0,
    allowed_phpconfigs,
    leregistered: leregistered ? 1 : 0,
  };

  if (documentroot && documentroot.trim()) {
    createData.documentroot = documentroot;
  }

  // Extract the server domain from froxlorUrl for standard subdomain
  // e.g., "https://vautron06.server-nord.de" -> "vautron06.server-nord.de"
  let standardSubdomain: string | undefined;
  if (server.froxlorUrl) {
    try {
      const url = new URL(server.froxlorUrl);
      standardSubdomain = url.hostname;
    } catch (e) {
      console.warn('Could not parse froxlorUrl for standard subdomain:', e);
    }
  }

  // Create the customer
  const result = await client.createCustomer(createData, standardSubdomain);

  // If customer was created successfully and we have a PHP config, set it for the standard subdomain
  if (result.success && result.customer && phpConfigIds.length > 0) {
    // Use the LAST selected PHP config (usually the highest/newest version)
    const primaryPhpConfigId = parseInt(phpConfigIds[phpConfigIds.length - 1]);

    // Get the customer to find the standard subdomain ID
    const customer = await client.getCustomer(result.customer.customerid);

    if (customer && customer.standardsubdomain) {
      // Small delay to ensure Froxlor has finished creating everything
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Set the PHP configuration for the standard subdomain
      await client.updateDomain(parseInt(customer.standardsubdomain), {
        phpsettingid: primaryPhpConfigId,
        phpenabled: 1,
        openbasedir: 1,
      });
    }
  }

  return result;
}

export async function manageDomain(formData: FormData) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const clientId = formData.get("clientId") as string;
  const serverId = formData.get("serverId") as string;

  // TODO: Implement domain management
  console.log("Manage domain:", { clientId, serverId });

  return { success: true, message: "Funktion in Vorbereitung" };
}

export async function getCustomerDetails(serverId: string, customerNo: string) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return { success: false, message: "Nicht autorisiert", customer: null, standardDomain: null };
  }

  const server = await prisma.server.findUnique({
    where: { id: serverId },
  });

  if (!server || !server.froxlorUrl || !server.froxlorApiKey || !server.froxlorApiSecret) {
    return { success: false, message: "Server nicht konfiguriert", customer: null, standardDomain: null };
  }

  const client = new FroxlorClient({
    url: server.froxlorUrl,
    apiKey: server.froxlorApiKey,
    apiSecret: server.froxlorApiSecret,
  });

  const customer = await client.findCustomerByNumber(customerNo);

  if (!customer) {
    return { success: false, message: "Kunde nicht gefunden", customer: null, standardDomain: null };
  }

  let standardDomain = "";
  if (customer.standardsubdomain) {
    const stdDomain = await client.getCustomerStandardDomain(
      customer.customerid,
      customer.standardsubdomain
    );
    if (stdDomain) {
      standardDomain = stdDomain.domain;
    }
  }

  return {
    success: true,
    message: "Kundendaten abgerufen",
    customer: {
      customerNo,
      documentRoot: customer.documentroot || "",
      customerId: customer.customerid,
    },
    standardDomain,
  };
}

export async function installJoomla(formData: FormData) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const clientId = formData.get("clientId") as string;
  const serverId = formData.get("serverId") as string;

  // TODO: Implement Joomla installation via kickstart.php
  console.log("Install Joomla:", { clientId, serverId });

  return { success: true, message: "Funktion in Vorbereitung" };
}
