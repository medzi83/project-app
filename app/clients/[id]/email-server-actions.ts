"use server";

import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { createFroxlorClientFromServer, FroxlorClient } from "@/lib/froxlor";
import type { FroxlorCustomerCreateInput, FroxlorEmailAddress, FroxlorEmailForwarder, FroxlorDomain } from "@/lib/froxlor";

/**
 * Setzt den E-Mail-Server für einen Kunden
 */
export async function setEmailServer(
  clientId: string,
  serverId: string | null,
  customerNo: string | null
) {
  const session = await getAuthSession();

  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AGENT")) {
    return { success: false, error: "Nicht autorisiert" };
  }

  try {
    await prisma.client.update({
      where: { id: clientId },
      data: {
        emailServerId: serverId || null,
        emailCustomerNo: customerNo || null,
      },
    });

    revalidatePath(`/clients/${clientId}`);
    return { success: true };
  } catch (error) {
    console.error("Error setting email server:", error);
    return { success: false, error: "Fehler beim Speichern" };
  }
}

/**
 * Prüft ob ein Kunde auf dem angegebenen Server in Froxlor existiert
 */
export async function checkFroxlorCustomer(
  serverId: string,
  customerNo: string
): Promise<{
  success: boolean;
  error?: string;
  customer?: {
    customerid: string;
    loginname: string;
    name: string;
    firstname: string;
    company: string;
    email: string;
    diskspace_gb?: number;
    email_imap?: number;
    email_pop3?: number;
  };
}> {
  const session = await getAuthSession();

  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AGENT")) {
    return { success: false, error: "Nicht autorisiert" };
  }

  try {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return { success: false, error: "Server nicht gefunden" };
    }

    if (!server.froxlorApiKey || !server.froxlorApiSecret || !server.froxlorUrl) {
      return { success: false, error: "Server hat keine Froxlor-API-Konfiguration" };
    }

    const froxlor = createFroxlorClientFromServer(server);
    if (!froxlor) {
      return { success: false, error: "Froxlor-Client konnte nicht erstellt werden" };
    }

    // Suche Kunden anhand der Kundennummer (loginname)
    const customer = await froxlor.findCustomerByNumber(customerNo);

    if (!customer) {
      return { success: false, error: `Kein Kunde mit Loginname "${customerNo}" auf diesem Server gefunden` };
    }

    // Speicherplatz von KB in GB umrechnen (Froxlor speichert in KB)
    const diskspaceKB = customer.diskspace ? parseInt(customer.diskspace) : 0;
    const diskspaceGB = Math.round(diskspaceKB / 1024 / 1024);

    // Froxlor API gibt "imap" und "pop3" als Strings zurück ("0" oder "1")
    const imapEnabled = customer.imap === 1 || customer.imap === "1" ? 1 : 0;
    const pop3Enabled = customer.pop3 === 1 || customer.pop3 === "1" ? 1 : 0;

    return {
      success: true,
      customer: {
        customerid: String(customer.customerid),
        loginname: customer.loginname,
        name: customer.name || "",
        firstname: customer.firstname || "",
        company: customer.company || "",
        email: customer.email || "",
        diskspace_gb: diskspaceGB || 2,
        email_imap: imapEnabled,
        email_pop3: pop3Enabled,
      },
    };
  } catch (error) {
    console.error("Error checking Froxlor customer:", error);
    return { success: false, error: "Fehler bei der Froxlor-Abfrage" };
  }
}

/**
 * Erstellt einen neuen Kunden auf dem Froxlor E-Mail-Server
 */
export async function createFroxlorEmailCustomer(
  serverId: string,
  customerData: {
    customerNo: string;
    firstname: string;
    name: string;
    company: string;
    email: string;
    diskspace_gb?: number;
  }
): Promise<{
  success: boolean;
  error?: string;
  customer?: {
    customerid: string;
    loginname: string;
    name: string;
    firstname: string;
    company: string;
    email: string;
    diskspace_gb?: number;
  };
}> {
  const session = await getAuthSession();

  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AGENT")) {
    return { success: false, error: "Nicht autorisiert" };
  }

  try {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return { success: false, error: "Server nicht gefunden" };
    }

    if (!server.froxlorApiKey || !server.froxlorApiSecret || !server.froxlorUrl) {
      return { success: false, error: "Server hat keine Froxlor-API-Konfiguration" };
    }

    const froxlor = new FroxlorClient({
      url: server.froxlorUrl,
      apiKey: server.froxlorApiKey,
      apiSecret: server.froxlorApiSecret,
      version: server.froxlorVersion || undefined,
    });

    // Prüfen ob der Kunde bereits existiert
    const existingCustomer = await froxlor.findCustomerByNumber(customerData.customerNo);
    if (existingCustomer) {
      return {
        success: false,
        error: `Kunde mit Loginname "${customerData.customerNo}" existiert bereits auf diesem Server`
      };
    }

    // Standard-Subdomain aus Server-URL extrahieren
    let standardSubdomain: string | undefined;
    if (server.froxlorUrl) {
      try {
        const url = new URL(server.froxlorUrl);
        standardSubdomain = url.hostname;
      } catch {
        console.warn('Could not parse froxlorUrl for standard subdomain');
      }
    }

    // Neuen Kunden anlegen - minimale Einstellungen für E-Mail-Server
    const diskspaceGB = customerData.diskspace_gb || 2; // Standard: 2 GB
    const diskspaceMB = diskspaceGB * 1000; // Froxlor erwartet MB

    const createData: FroxlorCustomerCreateInput = {
      customernumber: customerData.customerNo,
      firstname: customerData.firstname,
      name: customerData.name,
      company: customerData.company,
      email: customerData.email || "server@eventomaxx.de",
      loginname: customerData.customerNo,
      password: generateRandomPassword(),
      diskspace: diskspaceMB,
      mysqls: 0, // Keine MySQL-Datenbanken für reinen E-Mail-Server
      ftps: 0, // Keine FTP-Konten
      emails: 10, // E-Mail-Adressen erlauben
      email_accounts: 10,
      email_forwarders: 10,
      email_quota: diskspaceMB, // E-Mail-Quota = Speicherplatz
      deactivated: 0,
      phpenabled: 0, // PHP nicht benötigt für E-Mail
    };

    const result = await froxlor.createCustomer(createData, standardSubdomain);

    if (!result.success) {
      return { success: false, error: result.message || "Fehler beim Anlegen des Kunden" };
    }

    if (!result.customer) {
      return { success: false, error: "Kunde wurde erstellt, aber keine Daten zurückgegeben" };
    }

    return {
      success: true,
      customer: {
        customerid: String(result.customer.customerid),
        loginname: result.customer.loginname,
        name: result.customer.name || "",
        firstname: result.customer.firstname || "",
        company: result.customer.company || "",
        email: result.customer.email || "",
        diskspace_gb: diskspaceGB,
      },
    };
  } catch (error) {
    console.error("Error creating Froxlor customer:", error);
    return { success: false, error: "Fehler beim Anlegen des Froxlor-Kunden" };
  }
}

/**
 * Aktualisiert einen bestehenden Kunden auf dem Froxlor E-Mail-Server
 */
export async function updateFroxlorEmailCustomer(
  serverId: string,
  customerId: number,
  customerData: {
    firstname?: string;
    name?: string;
    company?: string;
    email?: string;
    diskspace_gb?: number;
    email_imap?: number;
    email_pop3?: number;
  }
): Promise<{
  success: boolean;
  error?: string;
  customer?: {
    customerid: string;
    loginname: string;
    name: string;
    firstname: string;
    company: string;
    email: string;
    diskspace_gb?: number;
    email_imap?: number;
    email_pop3?: number;
  };
}> {
  const session = await getAuthSession();

  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AGENT")) {
    return { success: false, error: "Nicht autorisiert" };
  }

  try {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return { success: false, error: "Server nicht gefunden" };
    }

    if (!server.froxlorApiKey || !server.froxlorApiSecret || !server.froxlorUrl) {
      return { success: false, error: "Server hat keine Froxlor-API-Konfiguration" };
    }

    const froxlor = new FroxlorClient({
      url: server.froxlorUrl,
      apiKey: server.froxlorApiKey,
      apiSecret: server.froxlorApiSecret,
      version: server.froxlorVersion || undefined,
    });

    // Update-Daten zusammenstellen
    const updateData: Record<string, unknown> = {};

    if (customerData.firstname !== undefined) {
      updateData.firstname = customerData.firstname;
    }
    if (customerData.name !== undefined) {
      updateData.name = customerData.name;
    }
    if (customerData.company !== undefined) {
      updateData.company = customerData.company;
    }
    if (customerData.email !== undefined) {
      updateData.email = customerData.email;
    }
    if (customerData.diskspace_gb !== undefined) {
      const diskspaceMB = customerData.diskspace_gb * 1000;
      updateData.diskspace = diskspaceMB;
      updateData.email_quota = diskspaceMB;
    }
    if (customerData.email_imap !== undefined) {
      updateData.email_imap = customerData.email_imap;
    }
    if (customerData.email_pop3 !== undefined) {
      updateData.email_pop3 = customerData.email_pop3;
    }

    const result = await froxlor.updateCustomer(customerId, updateData);

    if (!result.success) {
      return { success: false, error: result.message || "Fehler beim Aktualisieren des Kunden" };
    }

    // Kundendaten neu laden
    const updatedCustomer = await froxlor.getCustomer(customerId);

    if (!updatedCustomer) {
      return { success: false, error: "Kunde wurde aktualisiert, aber Daten konnten nicht geladen werden" };
    }

    // Speicherplatz von KB in GB umrechnen (Froxlor speichert in KB)
    const diskspaceKB = updatedCustomer.diskspace ? parseInt(updatedCustomer.diskspace) : 0;
    const diskspaceGB = Math.round(diskspaceKB / 1024 / 1024);

    // Froxlor API gibt "imap" und "pop3" als Strings zurück ("0" oder "1")
    const imapEnabled = updatedCustomer.imap === 1 || updatedCustomer.imap === "1" ? 1 : 0;
    const pop3Enabled = updatedCustomer.pop3 === 1 || updatedCustomer.pop3 === "1" ? 1 : 0;

    return {
      success: true,
      customer: {
        customerid: String(updatedCustomer.customerid),
        loginname: updatedCustomer.loginname,
        name: updatedCustomer.name || "",
        firstname: updatedCustomer.firstname || "",
        company: updatedCustomer.company || "",
        email: updatedCustomer.email || "",
        diskspace_gb: diskspaceGB,
        email_imap: imapEnabled,
        email_pop3: pop3Enabled,
      },
    };
  } catch (error) {
    console.error("Error updating Froxlor customer:", error);
    return { success: false, error: "Fehler beim Aktualisieren des Froxlor-Kunden" };
  }
}

/**
 * Generiert ein zufälliges Passwort mit 10 Zeichen
 */
function generateRandomPassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const allChars = uppercase + lowercase + numbers;

  let password = '';

  // Mindestens eines von jedem Typ
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];

  // Restliche 7 Zeichen zufällig
  for (let i = 0; i < 7; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Passwort mischen
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Ruft E-Mail-Adressen für einen Kunden vom Froxlor-Server ab
 */
export async function getCustomerEmailAddresses(
  serverId: string,
  customerId: number
): Promise<{
  success: boolean;
  error?: string;
  emails?: Array<{
    id: number;
    email: string;
    email_full: string;
    destination: string;
    iscatchall: boolean;
    hasMailbox: boolean;
  }>;
}> {
  const session = await getAuthSession();

  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AGENT")) {
    return { success: false, error: "Nicht autorisiert" };
  }

  try {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return { success: false, error: "Server nicht gefunden" };
    }

    if (!server.froxlorApiKey || !server.froxlorApiSecret || !server.froxlorUrl) {
      return { success: false, error: "Server hat keine Froxlor-API-Konfiguration" };
    }

    const froxlor = new FroxlorClient({
      url: server.froxlorUrl,
      apiKey: server.froxlorApiKey,
      apiSecret: server.froxlorApiSecret,
      version: server.froxlorVersion || undefined,
    });

    const emailAddresses = await froxlor.getCustomerEmailAddresses(customerId);

    return {
      success: true,
      emails: emailAddresses.map(email => ({
        id: email.id,
        email: email.email,
        email_full: email.email_full,
        destination: email.destination,
        iscatchall: email.iscatchall === 1,
        hasMailbox: email.popaccountid > 0,
      })),
    };
  } catch (error) {
    console.error("Error fetching email addresses:", error);
    return { success: false, error: "Fehler beim Abrufen der E-Mail-Adressen" };
  }
}

// ============================================
// Domain Management Actions
// ============================================

/**
 * Ruft alle E-Mail-Domains für einen Kunden vom Froxlor-Server ab
 * Filtert automatisch die Standard-Subdomain (z.B. E25065.vautron06.server-nord.de) heraus
 */
export async function getCustomerEmailDomains(
  serverId: string,
  customerId: number,
  customerLoginname?: string
): Promise<{
  success: boolean;
  error?: string;
  domains?: Array<{
    id: string;
    domain: string;
    isEmailDomain: boolean;
    letsencrypt: boolean;
    sslRedirect: boolean;
  }>;
}> {
  const session = await getAuthSession();

  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AGENT")) {
    return { success: false, error: "Nicht autorisiert" };
  }

  try {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return { success: false, error: "Server nicht gefunden" };
    }

    const froxlor = createFroxlorClientFromServer(server);
    if (!froxlor) {
      return { success: false, error: "Froxlor-Client konnte nicht erstellt werden" };
    }

    const domains = await froxlor.getCustomerDomains(customerId);

    // Standard-Subdomain herausfiltern
    // Diese folgt dem Muster: {loginname}.{server-hostname}
    // z.B. E25065.vautron06.server-nord.de
    const filteredDomains = domains.filter(domain => {
      // Wenn kein Loginname bekannt ist, alle Domains anzeigen
      if (!customerLoginname) return true;

      // Prüfen ob die Domain mit dem Loginname beginnt (Standard-Subdomain)
      const domainLower = domain.domain.toLowerCase();
      const loginnameLower = customerLoginname.toLowerCase();

      // Standard-Subdomain: loginname.{rest}
      if (domainLower.startsWith(loginnameLower + '.')) {
        return false;
      }

      return true;
    });

    return {
      success: true,
      domains: filteredDomains.map(domain => ({
        id: domain.id,
        domain: domain.domain,
        isEmailDomain: domain.isemaildomain === '1' || domain.isemaildomain === 1,
        letsencrypt: domain.letsencrypt === '1',
        sslRedirect: domain.ssl_redirect === '1',
      })),
    };
  } catch (error) {
    console.error("Error fetching customer domains:", error);
    return { success: false, error: "Fehler beim Abrufen der Domains" };
  }
}

/**
 * Erstellt eine neue Domain für einen Kunden auf dem Froxlor-Server
 */
export async function createCustomerDomain(
  serverId: string,
  customerId: number,
  domainData: {
    domain: string;
    isEmailDomain?: boolean;
    letsencrypt?: boolean;
    sslRedirect?: boolean;
  }
): Promise<{
  success: boolean;
  error?: string;
  domain?: {
    id: string;
    domain: string;
  };
}> {
  const session = await getAuthSession();

  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AGENT")) {
    return { success: false, error: "Nicht autorisiert" };
  }

  try {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return { success: false, error: "Server nicht gefunden" };
    }

    const froxlor = createFroxlorClientFromServer(server);
    if (!froxlor) {
      return { success: false, error: "Froxlor-Client konnte nicht erstellt werden" };
    }

    const result = await froxlor.addDomain({
      domain: domainData.domain,
      customerid: customerId,
      isemaildomain: domainData.isEmailDomain !== false ? 1 : 0,
      letsencrypt: domainData.letsencrypt !== false ? 1 : 0,
      ssl_redirect: domainData.sslRedirect !== false ? 1 : 0,
    });

    if (!result.success || !result.domain) {
      return { success: false, error: result.message || "Fehler beim Anlegen der Domain" };
    }

    return {
      success: true,
      domain: {
        id: result.domain.id,
        domain: result.domain.domain,
      },
    };
  } catch (error) {
    console.error("Error creating domain:", error);
    return { success: false, error: "Fehler beim Anlegen der Domain" };
  }
}

/**
 * Löscht eine Domain vom Froxlor-Server
 */
export async function deleteCustomerDomain(
  serverId: string,
  domainId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getAuthSession();

  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AGENT")) {
    return { success: false, error: "Nicht autorisiert" };
  }

  try {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return { success: false, error: "Server nicht gefunden" };
    }

    const froxlor = createFroxlorClientFromServer(server);
    if (!froxlor) {
      return { success: false, error: "Froxlor-Client konnte nicht erstellt werden" };
    }

    const result = await froxlor.deleteDomain(parseInt(domainId));

    if (!result.success) {
      return { success: false, error: result.message || "Fehler beim Löschen der Domain" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting domain:", error);
    return { success: false, error: "Fehler beim Löschen der Domain" };
  }
}

// ============================================
// Email Address Management Actions
// ============================================

/**
 * Erstellt eine neue E-Mail-Adresse auf dem Froxlor-Server
 * Kann optional auch gleich ein Postfach (Mailbox) anlegen
 */
export async function createEmailAddress(
  serverId: string,
  customerId: number,
  emailData: {
    localPart: string;  // Der Teil vor dem @
    domain: string;     // Domain-Name
    createMailbox?: boolean;
    password?: string;
    quotaMB?: number;
    isCatchall?: boolean;
  }
): Promise<{
  success: boolean;
  error?: string;
  email?: {
    id: number;
    email_full: string;
  };
}> {
  const session = await getAuthSession();

  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AGENT")) {
    return { success: false, error: "Nicht autorisiert" };
  }

  try {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return { success: false, error: "Server nicht gefunden" };
    }

    const froxlor = createFroxlorClientFromServer(server);
    if (!froxlor) {
      return { success: false, error: "Froxlor-Client konnte nicht erstellt werden" };
    }

    // 1. E-Mail-Adresse anlegen
    const emailResult = await froxlor.createEmailAddress({
      email_part: emailData.localPart,
      domain: emailData.domain,
      customerid: customerId,
      iscatchall: emailData.isCatchall ? 1 : 0,
    });

    if (!emailResult.success || !emailResult.email) {
      return { success: false, error: emailResult.message || "Fehler beim Anlegen der E-Mail-Adresse" };
    }

    const fullEmail = `${emailData.localPart}@${emailData.domain}`;

    // 2. Optional: Postfach (Mailbox) anlegen
    if (emailData.createMailbox && emailData.password) {
      // Vor dem Anlegen des Postfachs: Prüfen ob IMAP/POP3 aktiviert ist
      // Falls nicht, automatisch aktivieren
      // Froxlor API gibt "imap" und "pop3" zurück (nicht "email_imap")
      const customer = await froxlor.getCustomer(customerId);
      const imapEnabled = customer?.imap === 1 || customer?.imap === "1";
      const pop3Enabled = customer?.pop3 === 1 || customer?.pop3 === "1";

      if (customer && (!imapEnabled || !pop3Enabled)) {
        const updateResult = await froxlor.updateCustomer(customerId, {
          email_imap: 1,
          email_pop3: 1,
        });
        if (!updateResult.success) {
          console.warn("Could not enable IMAP/POP3 for customer:", updateResult.message);
        }
      }

      const accountResult = await froxlor.createEmailAccount({
        emailaddr: fullEmail,
        email_password: emailData.password,
        customerid: customerId,
        email_quota: emailData.quotaMB || 0,
      });

      if (!accountResult.success) {
        // E-Mail-Adresse wurde angelegt, aber Postfach nicht - Fehler zurückgeben
        return {
          success: false,
          email: {
            id: emailResult.email.id,
            email_full: fullEmail,
          },
          error: `Postfach konnte nicht erstellt werden: ${accountResult.message}`,
        };
      }
    }

    return {
      success: true,
      email: {
        id: emailResult.email.id,
        email_full: fullEmail,
      },
    };
  } catch (error) {
    console.error("Error creating email address:", error);
    return { success: false, error: "Fehler beim Anlegen der E-Mail-Adresse" };
  }
}

/**
 * Aktualisiert ein E-Mail-Konto (Passwort, Quota)
 */
export async function updateEmailAccount(
  serverId: string,
  customerId: number,
  emailAddress: string,
  data: {
    password?: string;
    quotaMB?: number;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getAuthSession();

  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AGENT")) {
    return { success: false, error: "Nicht autorisiert" };
  }

  try {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return { success: false, error: "Server nicht gefunden" };
    }

    const froxlor = createFroxlorClientFromServer(server);
    if (!froxlor) {
      return { success: false, error: "Froxlor-Client konnte nicht erstellt werden" };
    }

    const updateData: { email_password?: string; email_quota?: number } = {};
    if (data.password) {
      updateData.email_password = data.password;
    }
    if (data.quotaMB !== undefined) {
      updateData.email_quota = data.quotaMB;
    }

    const result = await froxlor.updateEmailAccount(emailAddress, customerId, updateData);

    if (!result.success) {
      return { success: false, error: result.message || "Fehler beim Aktualisieren des E-Mail-Kontos" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating email account:", error);
    return { success: false, error: "Fehler beim Aktualisieren des E-Mail-Kontos" };
  }
}

/**
 * Löscht eine E-Mail-Adresse vom Froxlor-Server
 */
export async function deleteEmailAddress(
  serverId: string,
  customerId: number,
  emailIdOrAddress: number | string,
  deleteData: boolean = false
): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getAuthSession();

  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AGENT")) {
    return { success: false, error: "Nicht autorisiert" };
  }

  try {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return { success: false, error: "Server nicht gefunden" };
    }

    const froxlor = createFroxlorClientFromServer(server);
    if (!froxlor) {
      return { success: false, error: "Froxlor-Client konnte nicht erstellt werden" };
    }

    const result = await froxlor.deleteEmailAddress(emailIdOrAddress, customerId, deleteData);

    if (!result.success) {
      return { success: false, error: result.message || "Fehler beim Löschen der E-Mail-Adresse" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting email address:", error);
    return { success: false, error: "Fehler beim Löschen der E-Mail-Adresse" };
  }
}

/**
 * Fügt eine Weiterleitung zu einer E-Mail-Adresse hinzu
 */
export async function addEmailForwarder(
  serverId: string,
  customerId: number,
  emailAddress: string,
  destination: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getAuthSession();

  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AGENT")) {
    return { success: false, error: "Nicht autorisiert" };
  }

  try {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return { success: false, error: "Server nicht gefunden" };
    }

    const froxlor = createFroxlorClientFromServer(server);
    if (!froxlor) {
      return { success: false, error: "Froxlor-Client konnte nicht erstellt werden" };
    }

    const result = await froxlor.createEmailForwarder({
      emailaddr: emailAddress,
      destination: destination,
      customerid: customerId,
    });

    if (!result.success) {
      return { success: false, error: result.message || "Fehler beim Anlegen der Weiterleitung" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error adding email forwarder:", error);
    return { success: false, error: "Fehler beim Anlegen der Weiterleitung" };
  }
}

/**
 * Löscht eine E-Mail-Weiterleitung
 */
export async function deleteEmailForwarder(
  serverId: string,
  customerId: number,
  forwarderId: number,
  emailAddress: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getAuthSession();

  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AGENT")) {
    return { success: false, error: "Nicht autorisiert" };
  }

  try {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return { success: false, error: "Server nicht gefunden" };
    }

    const froxlor = createFroxlorClientFromServer(server);
    if (!froxlor) {
      return { success: false, error: "Froxlor-Client konnte nicht erstellt werden" };
    }

    const result = await froxlor.deleteEmailForwarder(forwarderId, emailAddress, customerId);

    if (!result.success) {
      return { success: false, error: result.message || "Fehler beim Löschen der Weiterleitung" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting email forwarder:", error);
    return { success: false, error: "Fehler beim Löschen der Weiterleitung" };
  }
}
