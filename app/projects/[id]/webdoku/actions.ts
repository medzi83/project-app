"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { moveUnsuitableImagesToSubfolder } from "@/lib/luckycloud-material-folders";
import type {
  WebDocuDomainStatus,
  WebDocuColorOrientation,
  WebDocuWebsiteType,
  WebDocuStartArea,
  WebDocuMapIntegration,
  WebDocuRegisterType,
  WebDocuTermsStatus,
} from "@prisma/client";

// Typ für Formularfelder (wird nach Migration aus @prisma/client importiert)
type WebDocuFormFieldType =
  | "ANREDE" | "VORNAME" | "NACHNAME" | "EMAIL" | "TELEFON"
  | "STRASSE" | "PLZ" | "ORT" | "NACHRICHT" | "DATENSCHUTZ"
  | "CUSTOM_TEXT" | "CUSTOM_TEXTAREA" | "CUSTOM_CHECKBOX" | "CUSTOM_SELECT";

/**
 * Erstellt eine neue Webdokumentation für ein Projekt
 */
export async function createWebDocumentation(projectId: string) {
  await requireRole(["ADMIN", "AGENT"]);

  // Prüfen ob das Projekt existiert und eine Website hat
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      website: { include: { webDocumentation: true } },
      client: true,
    },
  });

  if (!project) {
    throw new Error("Projekt nicht gefunden");
  }

  if (!project.website) {
    throw new Error("Projekt hat keine Website-Daten");
  }

  if (project.website.webDocumentation) {
    throw new Error("Webdokumentation existiert bereits");
  }

  // Webdokumentation erstellen mit Vorausfüllung
  await prisma.webDocumentation.create({
    data: {
      projectId: project.id,
      // Vorausfüllen aus Client-/Website-Daten
      contactEmail: project.client.email || null,
      websiteDomain: project.website.domain || null,
    },
  });

  // Standard-Footer-Menüpunkte (Impressum, Datenschutz, ggf. Barrierefreiheit) automatisch erstellen
  const footerMenuItems = [
    {
      webDocumentationId: project.id,
      name: "Impressum",
      parentId: null,
      sortOrder: 0,
      isFooterMenu: true,
    },
    {
      webDocumentationId: project.id,
      name: "Datenschutz",
      parentId: null,
      sortOrder: 1,
      isFooterMenu: true,
    },
  ];

  // Bei barrierefreien Projekten auch "Barrierefreiheit" hinzufügen
  if (project.website.accessible === true) {
    footerMenuItems.push({
      webDocumentationId: project.id,
      name: "Barrierefreiheit",
      parentId: null,
      sortOrder: 2,
      isFooterMenu: true,
    });
  }

  await prisma.webDocuMenuItem.createMany({
    data: footerMenuItems,
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/webdoku`);

  return { success: true };
}

/**
 * Aktualisiert Schritt 1: Allgemeines
 */
export async function updateWebDocumentationStep1(formData: FormData) {
  await requireRole(["ADMIN", "AGENT"]);

  const projectId = formData.get("projectId") as string;
  const contactEmail = formData.get("contactEmail") as string | null;
  const urgentNotes = formData.get("urgentNotes") as string | null;
  const websiteDomain = formData.get("websiteDomain") as string | null;
  const domainStatus = formData.get("domainStatus") as WebDocuDomainStatus | null;

  if (!projectId) {
    return { success: false, error: "Projekt-ID fehlt" };
  }

  // Pflichtfelder validieren
  if (!contactEmail) {
    return { success: false, error: "E-Mail ist ein Pflichtfeld" };
  }
  if (!websiteDomain) {
    return { success: false, error: "Domain ist ein Pflichtfeld" };
  }
  if (!domainStatus) {
    return { success: false, error: "Domain-Status ist ein Pflichtfeld" };
  }

  // Prüfen ob Webdokumentation existiert
  const webDoc = await prisma.webDocumentation.findUnique({
    where: { projectId },
  });

  if (!webDoc) {
    return { success: false, error: "Webdokumentation nicht gefunden" };
  }

  // Aktualisieren
  await prisma.webDocumentation.update({
    where: { projectId },
    data: {
      contactEmail,
      urgentNotes: urgentNotes || null,
      websiteDomain,
      domainStatus,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/webdoku`);

  return { success: true };
}

/**
 * Fügt einen Ansprechpartner zur Webdokumentation hinzu
 */
export async function addWebDocuContact(
  projectId: string,
  authorizedPersonId: string,
  isPrimary: boolean = false
) {
  await requireRole(["ADMIN", "AGENT"]);

  // Falls isPrimary, erst alle anderen auf false setzen
  if (isPrimary) {
    await prisma.webDocumentationContact.updateMany({
      where: { webDocumentationId: projectId },
      data: { isPrimary: false },
    });
  }

  await prisma.webDocumentationContact.create({
    data: {
      webDocumentationId: projectId,
      authorizedPersonId,
      isPrimary,
    },
  });

  revalidatePath(`/projects/${projectId}/webdoku`);
  return { success: true };
}

/**
 * Entfernt einen Ansprechpartner aus der Webdokumentation
 */
export async function removeWebDocuContact(contactId: string) {
  await requireRole(["ADMIN", "AGENT"]);

  const contact = await prisma.webDocumentationContact.findUnique({
    where: { id: contactId },
  });

  if (!contact) {
    return { success: false, error: "Kontakt nicht gefunden" };
  }

  await prisma.webDocumentationContact.delete({
    where: { id: contactId },
  });

  revalidatePath(`/projects/${contact.webDocumentationId}/webdoku`);
  return { success: true };
}

/**
 * Aktualisiert Schritt 2: Unternehmensschwerpunkte
 */
export async function updateWebDocumentationStep2(formData: FormData) {
  await requireRole(["ADMIN", "AGENT"]);

  const projectId = formData.get("projectId") as string;
  const companyFocus = formData.get("companyFocus") as string | null;

  if (!projectId) {
    return { success: false, error: "Projekt-ID fehlt" };
  }

  // Prüfen ob Webdokumentation existiert
  const webDoc = await prisma.webDocumentation.findUnique({
    where: { projectId },
  });

  if (!webDoc) {
    return { success: false, error: "Webdokumentation nicht gefunden" };
  }

  // Aktualisieren
  await prisma.webDocumentation.update({
    where: { projectId },
    data: {
      companyFocus: companyFocus || null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/webdoku`);

  return { success: true };
}

// ===== Schritt 3: Websiteaufbau - Menüpunkte =====

/**
 * Fügt einen neuen Menüpunkt hinzu
 */
export async function addMenuItem(
  projectId: string,
  name: string,
  parentId: string | null = null,
  isFooterMenu: boolean = false
) {
  await requireRole(["ADMIN", "AGENT"]);

  // Höchste sortOrder in der Ebene ermitteln
  const maxSortOrder = await prisma.webDocuMenuItem.findFirst({
    where: {
      webDocumentationId: projectId,
      parentId: parentId,
    },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const newItem = await prisma.webDocuMenuItem.create({
    data: {
      webDocumentationId: projectId,
      name,
      parentId,
      sortOrder: (maxSortOrder?.sortOrder ?? -1) + 1,
      isFooterMenu,
    },
  });

  revalidatePath(`/projects/${projectId}/webdoku`);
  return { success: true, item: newItem };
}

/**
 * Aktualisiert einen Menüpunkt (Name, Footer-Status, Notizen)
 */
export async function updateMenuItem(
  itemId: string,
  data: { name?: string; isFooterMenu?: boolean; notes?: string | null }
) {
  await requireRole(["ADMIN", "AGENT"]);

  const item = await prisma.webDocuMenuItem.findUnique({
    where: { id: itemId },
  });

  if (!item) {
    return { success: false, error: "Menüpunkt nicht gefunden" };
  }

  await prisma.webDocuMenuItem.update({
    where: { id: itemId },
    data,
  });

  revalidatePath(`/projects/${item.webDocumentationId}/webdoku`);
  return { success: true };
}

/**
 * Löscht einen Menüpunkt (und alle Unterpunkte durch CASCADE)
 */
export async function deleteMenuItem(itemId: string) {
  await requireRole(["ADMIN", "AGENT"]);

  const item = await prisma.webDocuMenuItem.findUnique({
    where: { id: itemId },
  });

  if (!item) {
    return { success: false, error: "Menüpunkt nicht gefunden" };
  }

  await prisma.webDocuMenuItem.delete({
    where: { id: itemId },
  });

  revalidatePath(`/projects/${item.webDocumentationId}/webdoku`);
  return { success: true };
}

/**
 * Aktualisiert die Sortierung aller Menüpunkte
 */
export async function reorderMenuItems(
  projectId: string,
  items: { id: string; parentId: string | null; sortOrder: number }[]
) {
  await requireRole(["ADMIN", "AGENT"]);

  // Alle Updates in einer Transaktion
  await prisma.$transaction(
    items.map((item) =>
      prisma.webDocuMenuItem.update({
        where: { id: item.id },
        data: {
          parentId: item.parentId,
          sortOrder: item.sortOrder,
        },
      })
    )
  );

  revalidatePath(`/projects/${projectId}/webdoku`);
  return { success: true };
}

/**
 * Erstellt die Standard-Footer-Menüpunkte (Impressum, Datenschutz, ggf. Barrierefreiheit)
 */
export async function createDefaultMenuItems(projectId: string) {
  await requireRole(["ADMIN", "AGENT"]);

  // Prüfen ob bereits Menüpunkte existieren
  const existingItems = await prisma.webDocuMenuItem.count({
    where: { webDocumentationId: projectId },
  });

  if (existingItems > 0) {
    return { success: false, error: "Es existieren bereits Menüpunkte" };
  }

  // Projekt laden um barrierefrei-Status zu prüfen
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { website: true },
  });

  // Standard-Footer-Menüpunkte erstellen
  const footerMenuItems = [
    {
      webDocumentationId: projectId,
      name: "Impressum",
      parentId: null,
      sortOrder: 0,
      isFooterMenu: true,
    },
    {
      webDocumentationId: projectId,
      name: "Datenschutz",
      parentId: null,
      sortOrder: 1,
      isFooterMenu: true,
    },
  ];

  // Bei barrierefreien Projekten auch "Barrierefreiheit" hinzufügen
  if (project?.website?.accessible === true) {
    footerMenuItems.push({
      webDocumentationId: projectId,
      name: "Barrierefreiheit",
      parentId: null,
      sortOrder: 2,
      isFooterMenu: true,
    });
  }

  await prisma.webDocuMenuItem.createMany({
    data: footerMenuItems,
  });

  revalidatePath(`/projects/${projectId}/webdoku`);
  return { success: true };
}

/**
 * Löscht die Webdokumentation
 */
export async function deleteWebDocumentation(projectId: string) {
  await requireRole(["ADMIN"]);

  await prisma.webDocumentation.delete({
    where: { projectId },
  });

  revalidatePath(`/projects/${projectId}`);

  return { success: true };
}

/**
 * Erstellt eine neue berechtigte Person und verknüpft sie mit der Webdokumentation
 */
export async function createAuthorizedPersonAndLink(
  projectId: string,
  clientId: string,
  personData: {
    salutation: string | null;
    firstname: string;
    lastname: string;
    email: string;
    position: string | null;
    phone: string | null;
  },
  isPrimary: boolean = false
) {
  await requireRole(["ADMIN", "AGENT"]);

  // Prüfen ob Webdokumentation existiert
  const webDoc = await prisma.webDocumentation.findUnique({
    where: { projectId },
  });

  if (!webDoc) {
    return { success: false, error: "Webdokumentation nicht gefunden" };
  }

  // Berechtigte Person beim Client erstellen
  const newPerson = await prisma.authorizedPerson.create({
    data: {
      clientId,
      salutation: personData.salutation,
      firstname: personData.firstname,
      lastname: personData.lastname,
      email: personData.email,
      position: personData.position,
      phone: personData.phone,
    },
  });

  // Falls isPrimary, erst alle anderen auf false setzen
  if (isPrimary) {
    await prisma.webDocumentationContact.updateMany({
      where: { webDocumentationId: projectId },
      data: { isPrimary: false },
    });
  }

  // Mit Webdokumentation verknüpfen
  await prisma.webDocumentationContact.create({
    data: {
      webDocumentationId: projectId,
      authorizedPersonId: newPerson.id,
      isPrimary,
    },
  });

  revalidatePath(`/projects/${projectId}/webdoku`);
  revalidatePath(`/clients/${clientId}`);

  return { success: true, personId: newPerson.id };
}

// ===== Schritt 4: Design & Vorgaben =====

/**
 * Aktualisiert Schritt 4: Design & Vorgaben
 */
export async function updateWebDocumentationStep4(data: {
  projectId: string;
  // Design
  hasLogo: boolean | null;
  hasCIDefined: boolean | null;
  ciColorCode: string | null;
  ciFontFamily: string | null;
  colorOrientation: WebDocuColorOrientation | null;
  colorCodes: string | null;
  // Umsetzungsvorgaben
  topWebsite: string | null;
  flopWebsite: string | null;
  websiteType: WebDocuWebsiteType | null;
  styleTypes: string[];
  styleCustom: string | null;
  startArea: WebDocuStartArea | null;
  slogan: string | null;
  teaserSpecs: string | null;
  disruptorSpecs: string | null;
  otherSpecs: string | null;
  mapIntegration: WebDocuMapIntegration | null;
}) {
  await requireRole(["ADMIN", "AGENT"]);

  const { projectId, ...updateData } = data;

  if (!projectId) {
    return { success: false, error: "Projekt-ID fehlt" };
  }

  // Prüfen ob Webdokumentation existiert
  const webDoc = await prisma.webDocumentation.findUnique({
    where: { projectId },
  });

  if (!webDoc) {
    return { success: false, error: "Webdokumentation nicht gefunden" };
  }

  // Aktualisieren
  await prisma.webDocumentation.update({
    where: { projectId },
    data: updateData,
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/webdoku`);

  return { success: true };
}

// ===== Schritt 5: Formulare =====

/**
 * Setzt das Flag "Kein Formular gewünscht"
 */
export async function updateNoFormsRequired(
  projectId: string,
  noFormsRequired: boolean
) {
  await requireRole(["ADMIN", "AGENT"]);

  await prisma.webDocumentation.update({
    where: { projectId },
    data: { noFormsRequired },
  });

  revalidatePath(`/projects/${projectId}/webdoku`);
  return { success: true };
}

/**
 * Erstellt ein neues Formular
 */
export async function createForm(
  projectId: string,
  name: string,
  recipientEmail: string | null = null
) {
  await requireRole(["ADMIN", "AGENT"]);

  // Höchste sortOrder ermitteln
  const maxSortOrder = await prisma.webDocuForm.findFirst({
    where: { webDocumentationId: projectId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const newForm = await prisma.webDocuForm.create({
    data: {
      webDocumentationId: projectId,
      name,
      recipientEmail,
      sortOrder: (maxSortOrder?.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath(`/projects/${projectId}/webdoku`);
  return { success: true, form: newForm };
}

/**
 * Aktualisiert ein Formular (Name, E-Mail)
 */
export async function updateForm(
  formId: string,
  data: { name?: string; recipientEmail?: string | null }
) {
  await requireRole(["ADMIN", "AGENT"]);

  const form = await prisma.webDocuForm.findUnique({
    where: { id: formId },
  });

  if (!form) {
    return { success: false, error: "Formular nicht gefunden" };
  }

  await prisma.webDocuForm.update({
    where: { id: formId },
    data,
  });

  revalidatePath(`/projects/${form.webDocumentationId}/webdoku`);
  return { success: true };
}

/**
 * Löscht ein Formular (und alle Felder durch CASCADE)
 */
export async function deleteForm(formId: string) {
  await requireRole(["ADMIN", "AGENT"]);

  const form = await prisma.webDocuForm.findUnique({
    where: { id: formId },
  });

  if (!form) {
    return { success: false, error: "Formular nicht gefunden" };
  }

  await prisma.webDocuForm.delete({
    where: { id: formId },
  });

  revalidatePath(`/projects/${form.webDocumentationId}/webdoku`);
  return { success: true };
}

/**
 * Fügt ein Feld zu einem Formular hinzu
 */
export async function addFormField(
  formId: string,
  fieldType: WebDocuFormFieldType,
  label: string | null = null,
  isRequired: boolean = false
) {
  await requireRole(["ADMIN", "AGENT"]);

  const form = await prisma.webDocuForm.findUnique({
    where: { id: formId },
  });

  if (!form) {
    return { success: false, error: "Formular nicht gefunden" };
  }

  // Höchste sortOrder ermitteln
  const maxSortOrder = await prisma.webDocuFormField.findFirst({
    where: { formId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const newField = await prisma.webDocuFormField.create({
    data: {
      formId,
      fieldType,
      label,
      isRequired,
      sortOrder: (maxSortOrder?.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath(`/projects/${form.webDocumentationId}/webdoku`);
  return { success: true, field: newField };
}

/**
 * Aktualisiert ein Formularfeld
 */
export async function updateFormField(
  fieldId: string,
  data: { label?: string | null; isRequired?: boolean }
) {
  await requireRole(["ADMIN", "AGENT"]);

  const field = await prisma.webDocuFormField.findUnique({
    where: { id: fieldId },
    include: { form: true },
  });

  if (!field) {
    return { success: false, error: "Feld nicht gefunden" };
  }

  await prisma.webDocuFormField.update({
    where: { id: fieldId },
    data,
  });

  revalidatePath(`/projects/${field.form.webDocumentationId}/webdoku`);
  return { success: true };
}

/**
 * Löscht ein Formularfeld
 */
export async function deleteFormField(fieldId: string) {
  await requireRole(["ADMIN", "AGENT"]);

  const field = await prisma.webDocuFormField.findUnique({
    where: { id: fieldId },
    include: { form: true },
  });

  if (!field) {
    return { success: false, error: "Feld nicht gefunden" };
  }

  await prisma.webDocuFormField.delete({
    where: { id: fieldId },
  });

  revalidatePath(`/projects/${field.form.webDocumentationId}/webdoku`);
  return { success: true };
}

/**
 * Aktualisiert die Felder eines Formulars (Batch-Update für Checkboxen)
 */
export async function updateFormFields(
  formId: string,
  fields: {
    fieldType: WebDocuFormFieldType;
    label: string | null;
    isRequired: boolean;
    enabled: boolean;
  }[]
) {
  await requireRole(["ADMIN", "AGENT"]);

  const form = await prisma.webDocuForm.findUnique({
    where: { id: formId },
    include: { fields: true },
  });

  if (!form) {
    return { success: false, error: "Formular nicht gefunden" };
  }

  // Bestehende Felder nach Typ gruppieren
  const existingByType = new Map(
    form.fields.map((f) => [f.fieldType, f])
  );

  // In einer Transaktion: Felder hinzufügen, aktualisieren oder löschen
  await prisma.$transaction(async (tx) => {
    let sortOrder = 0;
    for (const field of fields) {
      const existing = existingByType.get(field.fieldType);

      if (field.enabled) {
        if (existing) {
          // Aktualisieren
          await tx.webDocuFormField.update({
            where: { id: existing.id },
            data: {
              label: field.label,
              isRequired: field.isRequired,
              sortOrder,
            },
          });
        } else {
          // Neu erstellen
          await tx.webDocuFormField.create({
            data: {
              formId,
              fieldType: field.fieldType,
              label: field.label,
              isRequired: field.isRequired,
              sortOrder,
            },
          });
        }
        sortOrder++;
      } else if (existing) {
        // Löschen wenn deaktiviert
        await tx.webDocuFormField.delete({
          where: { id: existing.id },
        });
      }
    }
  });

  revalidatePath(`/projects/${form.webDocumentationId}/webdoku`);
  return { success: true };
}

// ===== Schritt 6: Impressum & Datenschutz =====

/**
 * Aktualisiert Schritt 6: Impressum & Datenschutz
 */
export async function updateWebDocumentationStep6(data: {
  projectId: string;
  imprintFromWebsite: boolean | null;
  imprintAddress: string | null;
  imprintLegalForm: string | null;
  imprintOwner: string | null;
  imprintCeo: string | null;
  imprintPhone: string | null;
  imprintFax: string | null;
  imprintEmail: string | null;
  imprintRegisterType: WebDocuRegisterType | null;
  imprintRegisterCustom: string | null;
  imprintRegisterLocation: string | null;
  imprintRegisterNumber: string | null;
  imprintChamber: string | null;
  imprintProfession: string | null;
  imprintCountry: string | null;
  imprintVatId: string | null;
  imprintTermsStatus: WebDocuTermsStatus | null;
  imprintPrivacyOfficer: string | null;
  imprintHasPrivacyOfficer: boolean | null;
}) {
  await requireRole(["ADMIN", "AGENT"]);

  const { projectId, ...updateData } = data;

  if (!projectId) {
    return { success: false, error: "Projekt-ID fehlt" };
  }

  // Prüfen ob Webdokumentation existiert
  const webDoc = await prisma.webDocumentation.findUnique({
    where: { projectId },
  });

  if (!webDoc) {
    return { success: false, error: "Webdokumentation nicht gefunden" };
  }

  // Aktualisieren
  await prisma.webDocumentation.update({
    where: { projectId },
    data: updateData,
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/webdoku`);

  return { success: true };
}

// ===== Schritt 7: Material =====

/**
 * Aktualisiert Schritt 7: Material (Hauptfelder)
 */
export async function updateWebDocumentationStep7(data: {
  projectId: string;
  materialLogoNeeded: boolean | null;
  materialAuthcodeNeeded: boolean | null;
  materialNotes: string | null;
  materialNotesNeedsImages: boolean | null;
  materialNotesNeedsTexts: boolean | null;
  materialDeadline: string | null; // ISO-String für Datum
}) {
  await requireRole(["ADMIN", "AGENT"]);

  const { projectId, materialDeadline, ...rest } = data;

  if (!projectId) {
    return { success: false, error: "Projekt-ID fehlt" };
  }

  const webDoc = await prisma.webDocumentation.findUnique({
    where: { projectId },
  });

  if (!webDoc) {
    return { success: false, error: "Webdokumentation nicht gefunden" };
  }

  await prisma.webDocumentation.update({
    where: { projectId },
    data: {
      ...rest,
      materialDeadline: materialDeadline ? new Date(materialDeadline) : null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/webdoku`);

  return { success: true };
}

/**
 * Batch-Update für alle Material-Checkboxen und Notizen der Menüpunkte (Schritt 7)
 */
export async function updateAllMenuItemsMaterial(data: {
  projectId: string;
  items: { id: string; needsImages: boolean; needsTexts: boolean; materialNotes: string | null }[];
}) {
  await requireRole(["ADMIN", "AGENT"]);

  const { projectId, items } = data;

  if (!projectId) {
    return { success: false, error: "Projekt-ID fehlt" };
  }

  await prisma.$transaction(
    items.map((item) =>
      prisma.webDocuMenuItem.update({
        where: { id: item.id },
        data: { needsImages: item.needsImages, needsTexts: item.needsTexts, materialNotes: item.materialNotes },
      })
    )
  );

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/webdoku`);

  return { success: true };
}

/**
 * Gibt die Webdokumentation für den Kunden frei
 */
export async function releaseWebDocumentationForCustomer(projectId: string) {
  const session = await requireRole(["ADMIN", "AGENT"]);

  if (!projectId) {
    return { success: false, error: "Projekt-ID fehlt" };
  }

  const webDoc = await prisma.webDocumentation.findUnique({
    where: { projectId },
  });

  if (!webDoc) {
    return { success: false, error: "Webdokumentation nicht gefunden" };
  }

  // Vollständigen Namen aus der DB laden (fullName hat Vor- und Zuname)
  const user = session.user.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { fullName: true, name: true },
      })
    : null;

  const releasedAt = new Date();
  const releasedByName = user?.fullName || user?.name || session.user.name || session.user.email || "Unbekannt";

  // Freigabe setzen und ggf. vorherige Ablehnung zurücksetzen
  // (Bei erneuter Übermittlung hat der Kunde wieder die Möglichkeit, neu zu entscheiden)
  await prisma.webDocumentation.update({
    where: { projectId },
    data: {
      releasedAt,
      releasedByUserId: session.user.id,
      releasedByName,
      // Vorherige Ablehnung zurücksetzen
      rejectedAt: null,
      rejectedByName: null,
      rejectedByIp: null,
      rejectedSteps: [],
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/webdoku`);

  return { success: true, releasedAt: releasedAt.toISOString(), releasedByName };
}

/**
 * Zieht die Kundenfreigabe der Webdokumentation zurück (nur Admin)
 */
export async function revokeWebDocumentationRelease(projectId: string) {
  await requireRole(["ADMIN"]);

  if (!projectId) {
    return { success: false, error: "Projekt-ID fehlt" };
  }

  const webDoc = await prisma.webDocumentation.findUnique({
    where: { projectId },
  });

  if (!webDoc) {
    return { success: false, error: "Webdokumentation nicht gefunden" };
  }

  // Freigabe zurückziehen - auch Kundenbestätigung zurücksetzen
  // WICHTIG: Ablehnung wird NICHT zurückgesetzt, damit der Agent sehen kann, welche Bereiche angepasst werden müssen
  await prisma.webDocumentation.update({
    where: { projectId },
    data: {
      releasedAt: null,
      releasedByUserId: null,
      releasedByName: null,
      // Kundenbestätigung zurücksetzen
      confirmedAt: null,
      confirmedByName: null,
      confirmedByIp: null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/webdoku`);

  return { success: true };
}

// ===== Interner Vermerk =====

/**
 * Aktualisiert den internen Vermerk der Webdokumentation
 */
export async function updateInternalNote(projectId: string, internalNote: string | null) {
  await requireRole(["ADMIN", "AGENT"]);

  await prisma.webDocumentation.update({
    where: { projectId },
    data: { internalNote: internalNote?.trim() || null },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/webdoku`);

  return { success: true };
}

/**
 * Setzt den Material-Status eines Projekts auf "VOLLSTAENDIG"
 */
export async function setMaterialStatusComplete(projectId: string) {
  await requireRole(["ADMIN", "AGENT"]);

  if (!projectId) {
    return { success: false, error: "Projekt-ID fehlt" };
  }

  // Prüfen ob das Projekt existiert
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      website: {
        select: {
          materialStatus: true,
        },
      },
    },
  });

  if (!project) {
    return { success: false, error: "Projekt nicht gefunden" };
  }

  if (!project.website) {
    return { success: false, error: "Kein Website-Projekt" };
  }

  // Material-Status auf VOLLSTAENDIG setzen
  await prisma.projectWebsite.update({
    where: { projectId },
    data: { materialStatus: "VOLLSTAENDIG" },
  });

  // Ungeeignete Bilder in "ungeeignet" Unterordner verschieben (asynchron, Fehler werden geloggt)
  try {
    const moveResult = await moveUnsuitableImagesToSubfolder(projectId);
    if (!moveResult.success) {
      console.warn(`[setMaterialStatusComplete] Fehler beim Verschieben ungeeigneter Bilder für Projekt ${projectId}:`, moveResult.errors);
    } else if (moveResult.movedFiles.length > 0) {
      console.log(`[setMaterialStatusComplete] ${moveResult.movedFiles.length} ungeeignete Bilder verschoben für Projekt ${projectId}`);
    }
  } catch (error) {
    // Fehler nur loggen, Material-Status trotzdem als vollständig markieren
    console.error(`[setMaterialStatusComplete] Fehler beim Verschieben ungeeigneter Bilder für Projekt ${projectId}:`, error);
  }

  revalidatePath(`/projects/${projectId}`);

  return { success: true };
}

/**
 * Markiert die Domain als registriert (nur relevant wenn domainStatus = NEW)
 */
export async function markDomainAsRegistered(projectId: string) {
  const session = await requireRole(["ADMIN", "AGENT"]);

  if (!projectId) {
    return { success: false, error: "Projekt-ID fehlt" };
  }

  const webDoc = await prisma.webDocumentation.findUnique({
    where: { projectId },
    select: {
      domainStatus: true,
      websiteDomain: true,
      domainRegisteredAt: true,
    },
  });

  if (!webDoc) {
    return { success: false, error: "Webdokumentation nicht gefunden" };
  }

  if (webDoc.domainStatus !== "NEW") {
    return { success: false, error: "Domain-Status ist nicht 'Neu'" };
  }

  if (webDoc.domainRegisteredAt) {
    return { success: false, error: "Domain wurde bereits als registriert markiert" };
  }

  // Vollständigen Namen aus der DB laden
  const user = session.user.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { fullName: true, name: true },
      })
    : null;

  const now = new Date();
  const registeredByName = user?.fullName || user?.name || session.user.name || session.user.email || "Unbekannt";

  await prisma.webDocumentation.update({
    where: { projectId },
    data: {
      domainRegisteredAt: now,
      domainRegisteredById: session.user.id,
      domainRegisteredByName: registeredByName,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/webdoku`);

  return {
    success: true,
    domainRegisteredAt: now,
    domainRegisteredByName: registeredByName,
  };
}

/**
 * Aktualisiert nur den Domain-Status (auch nach Freigabe bearbeitbar)
 *
 * ==================== TEMPORÄRE TEST-FUNKTION ====================
 * Diese Funktion wurde hinzugefügt, um den Domain-Status auch nach
 * Freigabe der WebDoku ändern zu können (für Testzwecke).
 *
 * RÜCKBAU: Diese gesamte Funktion kann gelöscht werden, wenn die
 * Test-Funktionalität nicht mehr benötigt wird. Zusätzlich müssen
 * folgende Änderungen in WebDokuClient.tsx rückgängig gemacht werden:
 * - Import von `updateDomainStatus` entfernen
 * - State `currentDomainStatus`, `isSavingDomainStatus`, `domainStatusChanged` entfernen
 * - Handler `handleSaveDomainStatus` entfernen
 * - Im Domain-Status Select: `value` und `onValueChange` entfernen,
 *   zurück zu `defaultValue={webDoc.domainStatus || ""}` und `disabled={isDisabled}`
 * - Hinweis "(auch nach Freigabe änderbar)" entfernen
 * - Separaten Speichern-Button für Domain-Status entfernen
 * =================================================================
 */
export async function updateDomainStatus(projectId: string, domainStatus: WebDocuDomainStatus) {
  await requireRole(["ADMIN", "AGENT"]);

  if (!projectId) {
    return { success: false, error: "Projekt-ID fehlt" };
  }

  if (!domainStatus) {
    return { success: false, error: "Domain-Status fehlt" };
  }

  const webDoc = await prisma.webDocumentation.findUnique({
    where: { projectId },
  });

  if (!webDoc) {
    return { success: false, error: "Webdokumentation nicht gefunden" };
  }

  await prisma.webDocumentation.update({
    where: { projectId },
    data: {
      domainStatus,
      // Reset der Domain-Registrierung wenn Status geändert wird
      domainRegisteredAt: null,
      domainRegisteredById: null,
      domainRegisteredByName: null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/webdoku`);

  return { success: true, domainStatus };
}
