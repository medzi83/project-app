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
    version: server.froxlorVersion || undefined,
  });

  return await client.testConnection();
}

export async function getMysqlServers(serverId: string) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return { success: false, message: "Nicht autorisiert", servers: [] };
  }

  const server = await prisma.server.findUnique({
    where: { id: serverId },
  });

  if (!server || !server.froxlorUrl || !server.froxlorApiKey || !server.froxlorApiSecret) {
    return { success: false, message: "Server nicht konfiguriert", servers: [] };
  }

  const client = new FroxlorClient({
    url: server.froxlorUrl,
    apiKey: server.froxlorApiKey,
    apiSecret: server.froxlorApiSecret,
    version: server.froxlorVersion || undefined,
  });

  try {
    const servers = await client.getMysqlServers();
    return { success: true, message: "Erfolgreich", servers };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Fehler beim Abrufen der MySQL-Server",
      servers: [],
    };
  }
}

export async function getCustomerMysqlServers(serverId: string, customerNo: string) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return { success: false, message: "Nicht autorisiert", servers: [] };
  }

  const server = await prisma.server.findUnique({
    where: { id: serverId },
  });

  if (!server || !server.froxlorUrl || !server.froxlorApiKey || !server.froxlorApiSecret) {
    return { success: false, message: "Server nicht konfiguriert", servers: [] };
  }

  const client = new FroxlorClient({
    url: server.froxlorUrl,
    apiKey: server.froxlorApiKey,
    apiSecret: server.froxlorApiSecret,
    version: server.froxlorVersion || undefined,
  });

  try {
    // Get customer data to find allowed MySQL servers
    const customer = await client.findCustomerByNumber(customerNo);
    if (!customer) {
      return { success: false, message: "Kunde nicht gefunden", servers: [] };
    }

    // Get all available MySQL servers
    const allServers = await client.getMysqlServers();

    // Filter to only show servers the customer is allowed to use
    // If customer.allowed_mysqlserver is not set or empty, return all servers (backward compatibility)
    const allowedServerIds = customer.allowed_mysqlserver || [];

    const filteredServers = allowedServerIds.length > 0
      ? allServers.filter(s => allowedServerIds.includes(s.id))
      : allServers;

    return { success: true, message: "Erfolgreich", servers: filteredServers };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Fehler beim Abrufen der MySQL-Server",
      servers: [],
    };
  }
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
    version: server.froxlorVersion || undefined,
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
    version: server.froxlorVersion || undefined,
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
    version: server.froxlorVersion || undefined,
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
    version: server.froxlorVersion || undefined,
  });

  // Build update data
  const updateData: {
    documentroot?: string;
    ssl_redirect: number;
    letsencrypt: number;
    phpsettingid?: number;
    selectserveralias?: number;
  } = {
    documentroot: documentroot || undefined,
    ssl_redirect: ssl_redirect ? 1 : 0,
    letsencrypt: letsencrypt ? 1 : 0,
    phpsettingid: phpsettingid ? parseInt(phpsettingid) : undefined,
  };

  // If enabling Let's Encrypt, set serveralias to "none" to allow ACME HTTP validation
  // selectserveralias: 0 = wildcard (*), 1 = www-alias, 2 = none
  if (letsencrypt) {
    updateData.selectserveralias = 2;
  }

  const result = await client.updateDomain(parseInt(domainId), updateData);

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
    version: server.froxlorVersion || undefined,
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

    // Find all clients with this customer number
    const clients = await prisma.client.findMany({
      where: { customerNo: customerNumber },
    });

    // Update agency assignment and create/update ClientServer entries
    for (const client of clients) {
      // Update agency if needed
      if (agencyId && client.agencyId !== agencyId) {
        await prisma.client.update({
          where: { id: client.id },
          data: { agencyId },
        });
      }

      // Create or update ClientServer entry
      await prisma.clientServer.upsert({
        where: {
          clientId_serverId: {
            clientId: client.id,
            serverId: serverId,
          },
        },
        create: {
          clientId: client.id,
          serverId: serverId,
          customerNo: customerNumber,
        },
        update: {
          customerNo: customerNumber,
        },
      });

      // Also update the legacy serverId field for backwards compatibility (if not already set)
      if (!client.serverId) {
        await prisma.client.update({
          where: { id: client.id },
          data: { serverId: serverId },
        });
      }
    }
  }

  // If customer exists, also fetch FTP accounts and stored passwords
  let ftpAccount: any = null;
  let storedFtpPassword: string | undefined;

  if (customer) {
    try {
      const ftpAccounts = await client.getCustomerFtpAccounts(customer.customerid);
      if (ftpAccounts.length > 0) {
        ftpAccount = ftpAccounts[0]; // Get primary FTP account

        // Try to find stored password in database
        const dbClient = await prisma.client.findFirst({
          where: { customerNo: customerNumber },
        });

        if (dbClient && dbClient.ftpPasswords) {
          const ftpPasswords = dbClient.ftpPasswords as Record<string, string>;
          storedFtpPassword = ftpPasswords[ftpAccount.id.toString()];
        }
      }
    } catch (error) {
      console.error('Failed to fetch FTP accounts:', error);
      // Don't fail the entire customer check if FTP fetch fails
    }
  }

  return {
    success: true,
    exists: !!customer,
    customer: customer || undefined,
    ftpAccount: ftpAccount || undefined,
    storedFtpPassword: storedFtpPassword || undefined,
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
  const ftp_password = formData.get("ftp_password") as string;
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
  // Froxlor 2.x expects an array of numbers, not a JSON string
  const allowed_phpconfigs = phpConfigIds.length > 0 ? phpConfigIds.map(id => parseInt(id)) : [1];

  // Get all selected MySQL servers (checkboxes)
  const mysqlServerIds: string[] = [];
  formData.forEach((value, key) => {
    if (key.startsWith("mysqlserver_") && value === "on") {
      mysqlServerIds.push(key.replace("mysqlserver_", ""));
    }
  });
  // Froxlor 2.x expects an array of numbers
  const allowed_mysqlserver = mysqlServerIds.length > 0 ? mysqlServerIds.map(id => parseInt(id)) : [];

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
    version: server.froxlorVersion || undefined,
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
      allowed_phpconfigs, // Fixed: Use allowed_phpconfigs for Froxlor 2.x
      allowed_mysqlserver, // Assign all available MySQL servers (Default + MariaDB 10.5, etc.)
      phpenabled: 1, // Enable PHP explicitly
      leregistered: leregistered ? 1 : 0,
    };

    if (documentroot && documentroot.trim()) {
      updateData.documentroot = documentroot;
    }

    const result = await client.updateCustomer(parseInt(existingCustomerId), updateData);

    // Update FTP password if provided (for existing customers)
    if (result.success && ftp_password && ftp_password.trim()) {
      try {
        // Small delay to ensure Froxlor has finished updating
        await new Promise(resolve => setTimeout(resolve, 500));

        // Get FTP accounts for the customer
        const ftpAccounts = await client.getCustomerFtpAccounts(parseInt(existingCustomerId));

        if (ftpAccounts.length > 0) {
          // Update the first (primary) FTP account with the new password
          const primaryFtpAccount = ftpAccounts[0];
          await client.updateFtpPassword(primaryFtpAccount.id, parseInt(existingCustomerId), ftp_password);
          console.log(`✓ FTP password updated for account ${primaryFtpAccount.username}`);

          // Save FTP password in database for later retrieval
          const dbClient = await prisma.client.findFirst({
            where: { customerNo: customerNumber }
          });

          if (dbClient) {
            const existingPasswords = (dbClient.ftpPasswords as Record<string, string>) || {};
            const ftpPasswords = { ...existingPasswords, [primaryFtpAccount.id.toString()]: ftp_password };
            await prisma.client.update({
              where: { id: dbClient.id },
              data: { ftpPasswords }
            });
            console.log(`✓ FTP password saved to database for client ${dbClient.name}`);
          }
        }
      } catch (error) {
        console.error('Failed to update FTP password:', error);
        // Don't fail the entire customer update if FTP password update fails
      }
    }

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
    allowed_mysqlserver, // Assign all available MySQL servers (Default + MariaDB 10.5, etc.)
    phpenabled: 1, // Enable PHP explicitly
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

  // Set FTP password for the primary FTP account if customer was created successfully
  if (result.success && result.customer && ftp_password) {
    try {
      // Small delay to ensure Froxlor has finished creating the FTP account
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Get FTP accounts for the customer
      const ftpAccounts = await client.getCustomerFtpAccounts(result.customer.customerid);

      if (ftpAccounts.length > 0) {
        // Update the first (primary) FTP account with the user-specified password
        const primaryFtpAccount = ftpAccounts[0];
        await client.updateFtpPassword(primaryFtpAccount.id, result.customer.customerid, ftp_password);
        console.log(`✓ FTP password set for account ${primaryFtpAccount.username}`);

        // Save FTP password in database for later retrieval
        // Find the client by customerNo to save the password
        const dbClient = await prisma.client.findUnique({
          where: { customerNo: customerNumber }
        });

        if (dbClient) {
          const ftpPasswords = { [primaryFtpAccount.id.toString()]: ftp_password };
          await prisma.client.update({
            where: { id: dbClient.id },
            data: { ftpPasswords }
          });
          console.log(`✓ FTP password saved to database for client ${dbClient.name}`);
        }
      }
    } catch (error) {
      console.error('Failed to set FTP password:', error);
      // Don't fail the entire customer creation if FTP password update fails
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
    version: server.froxlorVersion || undefined,
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

  return { success: true, message: "Funktion in Vorbereitung" };
}
