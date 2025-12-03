"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateWebDocumentationStep1,
  updateWebDocumentationStep2,
  updateWebDocumentationStep4,
  updateWebDocumentationStep6,
  updateWebDocumentationStep7,
  updateAllMenuItemsMaterial,
  addWebDocuContact,
  removeWebDocuContact,
  createAuthorizedPersonAndLink,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  reorderMenuItems,
  createDefaultMenuItems,
  updateNoFormsRequired,
  createForm,
  updateForm,
  deleteForm,
  updateFormFields,
  releaseWebDocumentationForCustomer,
  revokeWebDocumentationRelease,
} from "./actions";
// Typ für Formularfelder (wird nach Migration aus @prisma/client importiert)
type WebDocuFormFieldType =
  | "ANREDE" | "VORNAME" | "NACHNAME" | "EMAIL" | "TELEFON"
  | "STRASSE" | "PLZ" | "ORT" | "NACHRICHT" | "DATENSCHUTZ"
  | "CUSTOM_TEXT" | "CUSTOM_TEXTAREA" | "CUSTOM_CHECKBOX" | "CUSTOM_SELECT";

// Typen
type AuthorizedPerson = {
  id: string;
  salutation: string | null;
  firstname: string;
  lastname: string;
  email: string;
  position: string | null;
  phone: string | null;
};

type WebDocuContact = {
  id: string;
  isPrimary: boolean;
  authorizedPerson: AuthorizedPerson;
};

type MenuItem = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  isFooterMenu: boolean;
  notes: string | null;
  // Schritt 7: Material
  needsImages: boolean;
  needsTexts: boolean;
  materialNotes: string | null;
};

type FormField = {
  id: string;
  fieldType: string;
  label: string | null;
  isRequired: boolean;
  sortOrder: number;
};

type WebDocuForm = {
  id: string;
  name: string;
  recipientEmail: string | null;
  sortOrder: number;
  fields: FormField[];
};

type WebDocumentation = {
  projectId: string;
  contactEmail: string | null;
  urgentNotes: string | null;
  websiteDomain: string | null;
  domainStatus: string | null;
  companyName: string | null;
  companyFocus: string | null;
  contacts: WebDocuContact[];
  menuItems: MenuItem[];
  // Schritt 4: Design & Vorgaben
  hasLogo: boolean | null;
  hasCIDefined: boolean | null;
  ciColorCode: string | null;
  ciFontFamily: string | null;
  colorOrientation: string | null;
  colorCodes: string | null;
  topWebsite: string | null;
  flopWebsite: string | null;
  websiteType: string | null;
  styleTypes: string[];
  styleCustom: string | null;
  startArea: string | null;
  slogan: string | null;
  teaserSpecs: string | null;
  disruptorSpecs: string | null;
  otherSpecs: string | null;
  mapIntegration: string | null;
  // Schritt 5: Formulare
  noFormsRequired: boolean;
  forms: WebDocuForm[];
  // Schritt 6: Impressum & Datenschutz
  imprintFromWebsite: boolean | null;
  imprintAddress: string | null;
  imprintLegalForm: string | null;
  imprintOwner: string | null;
  imprintCeo: string | null;
  imprintPhone: string | null;
  imprintFax: string | null;
  imprintEmail: string | null;
  imprintRegisterType: string | null;
  imprintRegisterCustom: string | null;
  imprintRegisterLocation: string | null;
  imprintRegisterNumber: string | null;
  imprintChamber: string | null;
  imprintProfession: string | null;
  imprintCountry: string | null;
  imprintVatId: string | null;
  imprintTermsStatus: string | null;
  imprintPrivacyOfficer: string | null;
  imprintHasPrivacyOfficer: boolean | null;
  // Schritt 7: Material
  materialLogoNeeded: boolean | null;
  materialAuthcodeNeeded: boolean | null;
  materialNotes: string | null;
  materialNotesNeedsImages: boolean | null;
  materialNotesNeedsTexts: boolean | null;
  materialDeadline: string | null; // ISO-String
  // Kundenfreigabe
  releasedAt: string | null; // ISO-String
  releasedByName: string | null;
  // Kundenbestätigung
  confirmedAt: string | null; // ISO-String
  confirmedByName: string | null;
  confirmedByIp: string | null;
  // Kundenablehnung
  rejectedAt: string | null; // ISO-String
  rejectedByName: string | null;
  rejectedByIp: string | null;
  rejectedSteps: number[];
  // Interner Vermerk
  internalNote: string | null;
};

type Client = {
  id: string;
  name: string;
  customerNo: string | null;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  agency: string | null;
  authorizedPersons: AuthorizedPerson[];
};

type Props = {
  projectId: string;
  webDoc: WebDocumentation;
  client: Client;
  projectDomain: string | null;
  hasTextit: boolean; // true = Textit-Leistung vorhanden, zeigt "Stichpunkte" statt "Texte"
  isAdmin: boolean; // true = User ist Admin (kann Freigabe zurückziehen)
};

// Prüft ob ein Schritt als "gespeichert" gilt
// Hinweis: contactEmail und websiteDomain werden beim Erstellen vorausgefüllt,
// daher zählen diese nicht als "vom User gespeichert"
function isStepSaved(step: number, webDoc: WebDocumentation): boolean {
  switch (step) {
    case 1:
      // domainStatus ist ein Pflichtfeld, das nur vom User gesetzt wird
      return !!(webDoc.domainStatus || webDoc.urgentNotes || webDoc.contacts.length > 0);
    case 2:
      return !!(webDoc.companyName || webDoc.companyFocus);
    case 3:
      return webDoc.menuItems.length > 0;
    case 4:
      return !!(
        webDoc.hasLogo !== null ||
        webDoc.hasCIDefined !== null ||
        webDoc.colorOrientation ||
        webDoc.colorCodes ||
        webDoc.topWebsite ||
        webDoc.flopWebsite ||
        webDoc.websiteType ||
        webDoc.styleTypes.length > 0 ||
        webDoc.startArea ||
        webDoc.slogan ||
        webDoc.teaserSpecs ||
        webDoc.disruptorSpecs ||
        webDoc.otherSpecs ||
        webDoc.mapIntegration
      );
    case 5:
      return webDoc.noFormsRequired || webDoc.forms.length > 0;
    case 6:
      return !!(
        webDoc.imprintFromWebsite !== null ||
        webDoc.imprintAddress ||
        webDoc.imprintLegalForm ||
        webDoc.imprintOwner ||
        webDoc.imprintCeo ||
        webDoc.imprintPhone ||
        webDoc.imprintFax ||
        webDoc.imprintEmail ||
        webDoc.imprintRegisterType ||
        webDoc.imprintRegisterLocation ||
        webDoc.imprintRegisterNumber ||
        webDoc.imprintChamber ||
        webDoc.imprintProfession ||
        webDoc.imprintCountry ||
        webDoc.imprintVatId ||
        webDoc.imprintTermsStatus ||
        webDoc.imprintPrivacyOfficer ||
        webDoc.imprintHasPrivacyOfficer !== null
      );
    case 7:
      return !!(
        webDoc.materialLogoNeeded !== null ||
        webDoc.materialAuthcodeNeeded !== null ||
        webDoc.materialNotes ||
        webDoc.materialDeadline ||
        webDoc.menuItems.some((m) => m.needsImages || m.needsTexts)
      );
    // Weitere Schritte werden später ergänzt
    default:
      return false;
  }
}

const STEPS = [
  { number: 1, title: "Allgemeines", shortTitle: "Allg." },
  { number: 2, title: "Unternehmensschwerpunkte", shortTitle: "Schwerpunkte" },
  { number: 3, title: "Websiteaufbau", shortTitle: "Aufbau" },
  { number: 4, title: "Design & Vorgaben", shortTitle: "Design" },
  { number: 5, title: "Formulare", shortTitle: "Formulare" },
  { number: 6, title: "Impressum & Datenschutz", shortTitle: "Rechtliches" },
  { number: 7, title: "Material", shortTitle: "Material" },
];

// Häufig verwendete Menüpunkt-Vorlagen für Schritt 3
const MENU_ITEM_TEMPLATES = [
  "Start",
  "Über uns",
  "Team",
  "Leistungen",
  "Produkte",
  "Referenzen",
  "Kontakt",
];

// Domain-Status-Optionen werden dynamisch basierend auf der Agentur generiert
function getDomainStatusOptions(agency: string | null) {
  const agencyName = agency === "VW" ? "VW" : "EM";
  return [
    { value: "NEW", label: "Neue Domain (muss registriert werden)" },
    { value: "EXISTS_STAYS", label: "Vorhanden (Domain bleibt bei Kunden)" },
    { value: "EXISTS_TRANSFER", label: `Vorhanden (Domain wird zu ${agencyName} transferiert)` },
    { value: "AT_AGENCY", label: `Schon bei ${agencyName}` },
  ];
}

export default function WebDokuClient({ projectId, webDoc, client, projectDomain, hasTextit, isAdmin }: Props) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isReleasing, setIsReleasing] = useState(false);
  const [releaseData, setReleaseData] = useState<{ releasedAt: string | null; releasedByName: string | null }>({
    releasedAt: webDoc.releasedAt,
    releasedByName: webDoc.releasedByName,
  });

  // Webdoku ist gesperrt, wenn sie bereits an den Kunden freigegeben wurde
  const isLocked = !!releaseData.releasedAt;

  // Track welche Schritte bereits gespeichert wurden (initial aus webDoc berechnet)
  const [savedSteps, setSavedSteps] = useState<Set<number>>(() => {
    const saved = new Set<number>();
    for (let i = 1; i <= 7; i++) {
      if (isStepSaved(i, webDoc)) {
        saved.add(i);
      }
    }
    return saved;
  });

  // Update savedSteps und menuItems wenn webDoc sich ändert (z.B. nach Server-Revalidierung)
  useEffect(() => {
    const saved = new Set<number>();
    for (let i = 1; i <= 7; i++) {
      if (isStepSaved(i, webDoc)) {
        saved.add(i);
      }
    }
    setSavedSteps(saved);
    setMenuItems(webDoc.menuItems);
  }, [webDoc]);

  // Ansprechpartner, die noch nicht verknüpft sind
  const availableContacts = client.authorizedPersons.filter(
    (ap) => !webDoc.contacts.some((c) => c.authorizedPerson.id === ap.id)
  );

  // Hauptansprechpartner ermitteln
  const primaryContact = webDoc.contacts.find((c) => c.isPrimary)?.authorizedPerson;

  // Client-Kontaktperson (falls vorhanden)
  const clientContact = client.firstname && client.lastname ? {
    name: `${client.firstname} ${client.lastname}`,
    email: client.email,
  } : null;

  // State für Schritt 2 Rich-Text-Editor
  const [companyFocusContent, setCompanyFocusContent] = useState(webDoc.companyFocus || "");

  // State für Schritt 3: Menüpunkte
  const [menuItems, setMenuItems] = useState<MenuItem[]>(webDoc.menuItems);
  const [newMenuItemName, setNewMenuItemName] = useState("");
  const [newSubMenuItemName, setNewSubMenuItemName] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [isAddingMenuItem, setIsAddingMenuItem] = useState(false);
  const [editingNotesItemId, setEditingNotesItemId] = useState<string | null>(null);
  const [editingNotesText, setEditingNotesText] = useState("");

  // State für Schritt 4: Design & Vorgaben
  const [step4Data, setStep4Data] = useState({
    hasLogo: webDoc.hasLogo,
    hasCIDefined: webDoc.hasCIDefined,
    ciColorCode: webDoc.ciColorCode || "",
    ciFontFamily: webDoc.ciFontFamily || "",
    colorOrientation: webDoc.colorOrientation,
    colorCodes: webDoc.colorCodes || "",
    topWebsite: webDoc.topWebsite || "",
    flopWebsite: webDoc.flopWebsite || "",
    websiteType: webDoc.websiteType,
    styleTypes: webDoc.styleTypes,
    styleCustom: webDoc.styleCustom || "",
    startArea: webDoc.startArea,
    slogan: webDoc.slogan || "",
    teaserSpecs: webDoc.teaserSpecs || "",
    disruptorSpecs: webDoc.disruptorSpecs || "",
    otherSpecs: webDoc.otherSpecs || "",
    mapIntegration: webDoc.mapIntegration,
  });

  // State für neuen Ansprechpartner anlegen
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  const [newContactData, setNewContactData] = useState({
    salutation: "",
    firstname: "",
    lastname: "",
    email: "",
    position: "",
    phone: "",
  });
  const [isCreatingContact, setIsCreatingContact] = useState(false);

  // State für Schritt 5: Formulare
  const [noFormsRequired, setNoFormsRequired] = useState(webDoc.noFormsRequired);
  const [forms, setForms] = useState<WebDocuForm[]>(webDoc.forms);
  const [newFormName, setNewFormName] = useState("");
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [editingFormData, setEditingFormData] = useState<{ name: string; recipientEmail: string }>({ name: "", recipientEmail: "" });
  const [isAddingForm, setIsAddingForm] = useState(false);
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);

  // Standard-Formularfelder
  const STANDARD_FIELDS: { type: WebDocuFormFieldType; label: string }[] = [
    { type: "ANREDE", label: "Anrede" },
    { type: "VORNAME", label: "Vorname" },
    { type: "NACHNAME", label: "Nachname" },
    { type: "EMAIL", label: "E-Mail" },
    { type: "TELEFON", label: "Telefon" },
    { type: "STRASSE", label: "Straße" },
    { type: "PLZ", label: "PLZ" },
    { type: "ORT", label: "Ort" },
    { type: "NACHRICHT", label: "Nachricht" },
    { type: "DATENSCHUTZ", label: "Datenschutz-Checkbox" },
  ];

  // State für Schritt 6: Impressum & Datenschutz
  const [step6Data, setStep6Data] = useState({
    imprintFromWebsite: webDoc.imprintFromWebsite,
    imprintAddress: webDoc.imprintAddress || "",
    imprintLegalForm: webDoc.imprintLegalForm || "",
    imprintOwner: webDoc.imprintOwner || "",
    imprintCeo: webDoc.imprintCeo || "",
    imprintPhone: webDoc.imprintPhone || "",
    imprintFax: webDoc.imprintFax || "",
    imprintEmail: webDoc.imprintEmail || "",
    imprintRegisterType: webDoc.imprintRegisterType,
    imprintRegisterCustom: webDoc.imprintRegisterCustom || "",
    imprintRegisterLocation: webDoc.imprintRegisterLocation || "",
    imprintRegisterNumber: webDoc.imprintRegisterNumber || "",
    imprintChamber: webDoc.imprintChamber || "",
    imprintProfession: webDoc.imprintProfession || "",
    imprintCountry: webDoc.imprintCountry || "",
    imprintVatId: webDoc.imprintVatId || "",
    imprintTermsStatus: webDoc.imprintTermsStatus,
    imprintPrivacyOfficer: webDoc.imprintPrivacyOfficer || "",
    imprintHasPrivacyOfficer: webDoc.imprintHasPrivacyOfficer,
  });

  // State für Schritt 7: Material
  // Default-Deadline: heute + 4 Wochen
  const getDefaultDeadline = () => {
    const date = new Date();
    date.setDate(date.getDate() + 28); // 4 Wochen
    return date.toISOString().split("T")[0]; // YYYY-MM-DD Format
  };

  const [step7Data, setStep7Data] = useState({
    materialLogoNeeded: webDoc.materialLogoNeeded,
    materialAuthcodeNeeded: webDoc.materialAuthcodeNeeded,
    materialNotes: webDoc.materialNotes || "",
    materialNotesNeedsImages: webDoc.materialNotesNeedsImages || false,
    materialNotesNeedsTexts: webDoc.materialNotesNeedsTexts || false,
    materialDeadline: webDoc.materialDeadline || getDefaultDeadline(),
  });

  // State für Material-Checkboxen und Notizen der Menüpunkte (lokale Kopie zum Bearbeiten)
  const [menuItemMaterials, setMenuItemMaterials] = useState<Record<string, { needsImages: boolean; needsTexts: boolean; materialNotes: string }>>(() => {
    const map: Record<string, { needsImages: boolean; needsTexts: boolean; materialNotes: string }> = {};
    webDoc.menuItems.forEach((m) => {
      map[m.id] = { needsImages: m.needsImages, needsTexts: m.needsTexts, materialNotes: m.materialNotes || "" };
    });
    return map;
  });

  // Update forms wenn webDoc sich ändert
  useEffect(() => {
    setForms(webDoc.forms);
  }, [webDoc.forms]);

  // Update menuItemMaterials wenn menuItems sich ändern
  useEffect(() => {
    const map: Record<string, { needsImages: boolean; needsTexts: boolean; materialNotes: string }> = {};
    menuItems.forEach((m) => {
      map[m.id] = { needsImages: m.needsImages, needsTexts: m.needsTexts, materialNotes: m.materialNotes || "" };
    });
    setMenuItemMaterials(map);
  }, [menuItems]);

  // Speichern-Handler für Schritt 1
  const handleSaveStep1 = async (formData: FormData) => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const result = await updateWebDocumentationStep1(formData);
      if (result.success) {
        setSaveMessage({ type: "success", text: "Gespeichert!" });
        // Schritt als gespeichert markieren
        setSavedSteps((prev) => new Set(prev).add(1));
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: "error", text: result.error || "Fehler beim Speichern" });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Ein unerwarteter Fehler ist aufgetreten" });
    } finally {
      setIsSaving(false);
    }
  };

  // Ansprechpartner hinzufügen
  const handleAddContact = async (authorizedPersonId: string, isPrimary: boolean) => {
    try {
      await addWebDocuContact(projectId, authorizedPersonId, isPrimary);
    } catch (error) {
      console.error("Fehler beim Hinzufügen des Ansprechpartners:", error);
    }
  };

  // Ansprechpartner entfernen
  const handleRemoveContact = async (contactId: string) => {
    try {
      await removeWebDocuContact(contactId);
    } catch (error) {
      console.error("Fehler beim Entfernen des Ansprechpartners:", error);
    }
  };

  // Speichern-Handler für Schritt 2
  const handleSaveStep2 = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("companyFocus", companyFocusContent);

      const result = await updateWebDocumentationStep2(formData);
      if (result.success) {
        setSaveMessage({ type: "success", text: "Gespeichert!" });
        setSavedSteps((prev) => new Set(prev).add(2));
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: "error", text: result.error || "Fehler beim Speichern" });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Ein unerwarteter Fehler ist aufgetreten" });
    } finally {
      setIsSaving(false);
    }
  };

  // Speichern-Handler für Schritt 4
  const handleSaveStep4 = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const result = await updateWebDocumentationStep4({
        projectId,
        hasLogo: step4Data.hasLogo,
        hasCIDefined: step4Data.hasCIDefined,
        ciColorCode: step4Data.ciColorCode || null,
        ciFontFamily: step4Data.ciFontFamily || null,
        colorOrientation: step4Data.colorOrientation as "LOGO" | "PRINT" | "CI_SHEET" | "WEBSITE" | null,
        colorCodes: step4Data.colorCodes || null,
        topWebsite: step4Data.topWebsite || null,
        flopWebsite: step4Data.flopWebsite || null,
        websiteType: step4Data.websiteType as "STANDARD" | "ONEPAGE" | null,
        styleTypes: step4Data.styleTypes,
        styleCustom: step4Data.styleCustom || null,
        startArea: step4Data.startArea as "HEADER_VIDEO" | "SLIDER" | "HEADER_IMAGE" | null,
        slogan: step4Data.slogan || null,
        teaserSpecs: step4Data.teaserSpecs || null,
        disruptorSpecs: step4Data.disruptorSpecs || null,
        otherSpecs: step4Data.otherSpecs || null,
        mapIntegration: step4Data.mapIntegration as "YES" | "MULTIPLE" | "NO" | null,
      });
      if (result.success) {
        setSaveMessage({ type: "success", text: "Gespeichert!" });
        setSavedSteps((prev) => new Set(prev).add(4));
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: "error", text: result.error || "Fehler beim Speichern" });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Ein unerwarteter Fehler ist aufgetreten" });
    } finally {
      setIsSaving(false);
    }
  };

  // Speichern-Handler für Schritt 6 ("Kunde wurde informiert")
  const handleSaveStep6 = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      // imprintFromWebsite wird auf false gesetzt als Marker, dass der Kunde informiert wurde
      const result = await updateWebDocumentationStep6({
        projectId,
        imprintFromWebsite: false,
        imprintAddress: step6Data.imprintAddress || null,
        imprintLegalForm: step6Data.imprintLegalForm || null,
        imprintOwner: step6Data.imprintOwner || null,
        imprintCeo: step6Data.imprintCeo || null,
        imprintPhone: step6Data.imprintPhone || null,
        imprintFax: step6Data.imprintFax || null,
        imprintEmail: step6Data.imprintEmail || null,
        imprintRegisterType: step6Data.imprintRegisterType as "HANDELSREGISTER" | "CUSTOM" | null,
        imprintRegisterCustom: step6Data.imprintRegisterCustom || null,
        imprintRegisterLocation: step6Data.imprintRegisterLocation || null,
        imprintRegisterNumber: step6Data.imprintRegisterNumber || null,
        imprintChamber: step6Data.imprintChamber || null,
        imprintProfession: step6Data.imprintProfession || null,
        imprintCountry: step6Data.imprintCountry || null,
        imprintVatId: step6Data.imprintVatId || null,
        imprintTermsStatus: step6Data.imprintTermsStatus as "AVAILABLE" | "NOT_AVAILABLE" | "NOT_NECESSARY" | null,
        imprintPrivacyOfficer: step6Data.imprintPrivacyOfficer || null,
        imprintHasPrivacyOfficer: step6Data.imprintHasPrivacyOfficer,
      });
      if (result.success) {
        // Lokalen State aktualisieren damit isStepSaved(6) true liefert
        setStep6Data((prev) => ({ ...prev, imprintFromWebsite: false }));
        setSaveMessage({ type: "success", text: "Bestätigt!" });
        setSavedSteps((prev) => new Set(prev).add(6));
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: "error", text: result.error || "Fehler beim Speichern" });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Ein unerwarteter Fehler ist aufgetreten" });
    } finally {
      setIsSaving(false);
    }
  };

  // Speichern-Handler für Schritt 7
  const handleSaveStep7 = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      // Erst die Hauptfelder speichern
      const result = await updateWebDocumentationStep7({
        projectId,
        materialLogoNeeded: step7Data.materialLogoNeeded,
        materialAuthcodeNeeded: step7Data.materialAuthcodeNeeded,
        materialNotes: step7Data.materialNotes || null,
        materialNotesNeedsImages: step7Data.materialNotesNeedsImages,
        materialNotesNeedsTexts: step7Data.materialNotesNeedsTexts,
        materialDeadline: step7Data.materialDeadline || null,
      });

      if (!result.success) {
        setSaveMessage({ type: "error", text: result.error || "Fehler beim Speichern" });
        return;
      }

      // Dann die Menüpunkt-Material-Checkboxen und Notizen speichern
      const items = Object.entries(menuItemMaterials).map(([id, data]) => ({
        id,
        needsImages: data.needsImages,
        needsTexts: data.needsTexts,
        materialNotes: data.materialNotes || null,
      }));

      if (items.length > 0) {
        const matResult = await updateAllMenuItemsMaterial({ projectId, items });
        if (!matResult.success) {
          setSaveMessage({ type: "error", text: matResult.error || "Fehler beim Speichern der Menüpunkt-Materialien" });
          return;
        }
      }

      setSaveMessage({ type: "success", text: "Gespeichert!" });
      setSavedSteps((prev) => new Set(prev).add(7));
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setSaveMessage({ type: "error", text: "Ein unerwarteter Fehler ist aufgetreten" });
    } finally {
      setIsSaving(false);
    }
  };

  // ===== Validierung Schritt 5: Formulare =====
  // Schritt 5 ist vollständig wenn:
  // - "Kein Formular gewünscht" aktiviert ist ODER
  // - Formularfelder gespeichert wurden (savedSteps enthält 5) UND alle Formulare eine Empfänger-E-Mail haben
  const allFormsHaveEmail = forms.length === 0 || forms.every((f) => f.recipientEmail && f.recipientEmail.trim() !== "");
  const isStep5Complete = noFormsRequired || (savedSteps.has(5) && allFormsHaveEmail);

  // ===== Handler für Schritt 3: Menüpunkte =====

  // Menüpunkte nach Hierarchie sortieren
  const mainMenuItems = menuItems.filter((item) => !item.parentId && !item.isFooterMenu);
  const footerMenuItems = menuItems.filter((item) => !item.parentId && item.isFooterMenu);

  const getSubMenuItems = (parentId: string) =>
    menuItems.filter((item) => item.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  // Standard-Menüpunkte erstellen
  const handleCreateDefaultMenuItems = async () => {
    setIsAddingMenuItem(true);
    try {
      const result = await createDefaultMenuItems(projectId);
      if (result.success) {
        setSavedSteps((prev) => new Set(prev).add(3));
      }
    } catch (error) {
      console.error("Fehler beim Erstellen der Standard-Menüpunkte:", error);
    } finally {
      setIsAddingMenuItem(false);
    }
  };

  // Hauptmenüpunkt hinzufügen
  const handleAddMainMenuItem = async () => {
    if (!newMenuItemName.trim()) return;

    setIsAddingMenuItem(true);
    try {
      const result = await addMenuItem(projectId, newMenuItemName.trim(), null, false);
      if (result.success) {
        setNewMenuItemName("");
        setSavedSteps((prev) => new Set(prev).add(3));
      }
    } catch (error) {
      console.error("Fehler beim Hinzufügen des Menüpunkts:", error);
    } finally {
      setIsAddingMenuItem(false);
    }
  };

  // Hauptmenüpunkt mit vorgegebenem Namen hinzufügen (für Schnellauswahl)
  const handleAddMainMenuItemWithName = async (name: string) => {
    if (!name.trim()) return;

    setIsAddingMenuItem(true);
    try {
      const result = await addMenuItem(projectId, name.trim(), null, false);
      if (result.success) {
        setNewMenuItemName("");
        setSavedSteps((prev) => new Set(prev).add(3));
      }
    } catch (error) {
      console.error("Fehler beim Hinzufügen des Menüpunkts:", error);
    } finally {
      setIsAddingMenuItem(false);
    }
  };

  // Untermenüpunkt hinzufügen
  const handleAddSubMenuItem = async (parentId: string) => {
    if (!newSubMenuItemName.trim()) return;

    setIsAddingMenuItem(true);
    try {
      const result = await addMenuItem(projectId, newSubMenuItemName.trim(), parentId, false);
      if (result.success) {
        setNewSubMenuItemName("");
        setSelectedParentId(null);
      }
    } catch (error) {
      console.error("Fehler beim Hinzufügen des Untermenüpunkts:", error);
    } finally {
      setIsAddingMenuItem(false);
    }
  };

  // Menüpunkt umbenennen
  const handleRenameMenuItem = async (itemId: string) => {
    if (!editingItemName.trim()) return;

    try {
      await updateMenuItem(itemId, { name: editingItemName.trim() });
      setEditingItemId(null);
      setEditingItemName("");
    } catch (error) {
      console.error("Fehler beim Umbenennen:", error);
    }
  };

  // Menüpunkt löschen
  const handleDeleteMenuItem = async (itemId: string) => {
    try {
      await deleteMenuItem(itemId);
    } catch (error) {
      console.error("Fehler beim Löschen:", error);
    }
  };

  // Notizen für Menüpunkt speichern
  const handleSaveNotes = async (itemId: string) => {
    try {
      await updateMenuItem(itemId, { notes: editingNotesText.trim() || null });
      setEditingNotesItemId(null);
      setEditingNotesText("");
    } catch (error) {
      console.error("Fehler beim Speichern der Notizen:", error);
    }
  };

  // Notizen für Menüpunkt löschen
  const handleDeleteNotes = async (itemId: string) => {
    try {
      await updateMenuItem(itemId, { notes: null });
    } catch (error) {
      console.error("Fehler beim Löschen der Notizen:", error);
    }
  };

  // Menüpunkt nach oben verschieben
  const handleMoveUp = async (item: MenuItem) => {
    // Sortierte Geschwister-Liste holen
    const siblings = item.parentId
      ? getSubMenuItems(item.parentId)
      : item.isFooterMenu
      ? [...footerMenuItems].sort((a, b) => a.sortOrder - b.sortOrder)
      : [...mainMenuItems].sort((a, b) => a.sortOrder - b.sortOrder);

    const currentIndex = siblings.findIndex((s) => s.id === item.id);
    if (currentIndex <= 0) return;

    // Tausche sortOrder zwischen aktuellem und vorherigem Element
    const currentItem = siblings[currentIndex];
    const previousItem = siblings[currentIndex - 1];

    try {
      await reorderMenuItems(projectId, [
        { id: currentItem.id, parentId: currentItem.parentId, sortOrder: previousItem.sortOrder },
        { id: previousItem.id, parentId: previousItem.parentId, sortOrder: currentItem.sortOrder },
      ]);
    } catch (error) {
      console.error("Fehler beim Verschieben:", error);
    }
  };

  // Menüpunkt nach unten verschieben
  const handleMoveDown = async (item: MenuItem) => {
    // Sortierte Geschwister-Liste holen
    const siblings = item.parentId
      ? getSubMenuItems(item.parentId)
      : item.isFooterMenu
      ? [...footerMenuItems].sort((a, b) => a.sortOrder - b.sortOrder)
      : [...mainMenuItems].sort((a, b) => a.sortOrder - b.sortOrder);

    const currentIndex = siblings.findIndex((s) => s.id === item.id);
    if (currentIndex >= siblings.length - 1) return;

    // Tausche sortOrder zwischen aktuellem und nächstem Element
    const currentItem = siblings[currentIndex];
    const nextItem = siblings[currentIndex + 1];

    try {
      await reorderMenuItems(projectId, [
        { id: currentItem.id, parentId: currentItem.parentId, sortOrder: nextItem.sortOrder },
        { id: nextItem.id, parentId: nextItem.parentId, sortOrder: currentItem.sortOrder },
      ]);
    } catch (error) {
      console.error("Fehler beim Verschieben:", error);
    }
  };

  // Neuen Ansprechpartner erstellen und verknüpfen
  const handleCreateNewContact = async () => {
    if (!newContactData.firstname || !newContactData.lastname || !newContactData.email) {
      return;
    }

    setIsCreatingContact(true);
    try {
      await createAuthorizedPersonAndLink(projectId, client.id, {
        salutation: newContactData.salutation || null,
        firstname: newContactData.firstname,
        lastname: newContactData.lastname,
        email: newContactData.email,
        position: newContactData.position || null,
        phone: newContactData.phone || null,
      }, webDoc.contacts.length === 0); // isPrimary wenn erster Kontakt

      // Form zurücksetzen
      setNewContactData({
        salutation: "",
        firstname: "",
        lastname: "",
        email: "",
        position: "",
        phone: "",
      });
      setShowNewContactForm(false);
    } catch (error) {
      console.error("Fehler beim Erstellen des Ansprechpartners:", error);
    } finally {
      setIsCreatingContact(false);
    }
  };

  // ===== Handler für Schritt 5: Formulare =====

  // Neues Formular erstellen
  const handleAddForm = async () => {
    if (!newFormName.trim()) return;

    setIsAddingForm(true);
    try {
      const result = await createForm(projectId, newFormName.trim());
      if (result.success && result.form) {
        // Lokalen State aktualisieren
        setForms((prev) => [...prev, {
          id: result.form.id,
          name: result.form.name,
          recipientEmail: result.form.recipientEmail,
          sortOrder: result.form.sortOrder,
          fields: [],
        }]);
        setNewFormName("");
        setSavedSteps((prev) => new Set(prev).add(5));
        // Neues Formular expandieren
        setExpandedFormId(result.form.id);
      }
    } catch (error) {
      console.error("Fehler beim Erstellen des Formulars:", error);
    } finally {
      setIsAddingForm(false);
    }
  };

  // Formular bearbeiten starten
  const handleStartEditForm = (form: WebDocuForm) => {
    setEditingFormId(form.id);
    setEditingFormData({
      name: form.name,
      recipientEmail: form.recipientEmail || "",
    });
  };

  // Formular speichern
  const handleSaveForm = async (formId: string) => {
    if (!editingFormData.name.trim()) return;

    try {
      await updateForm(formId, {
        name: editingFormData.name.trim(),
        recipientEmail: editingFormData.recipientEmail.trim() || null,
      });
      setEditingFormId(null);
    } catch (error) {
      console.error("Fehler beim Speichern des Formulars:", error);
    }
  };

  // Formular löschen
  const handleDeleteForm = async (formId: string) => {
    if (!confirm("Möchten Sie dieses Formular wirklich löschen?")) return;

    try {
      await deleteForm(formId);
      if (expandedFormId === formId) {
        setExpandedFormId(null);
      }
    } catch (error) {
      console.error("Fehler beim Löschen des Formulars:", error);
    }
  };

  // Formularfelder speichern
  const handleSaveFormFields = async (
    formId: string,
    selectedFields: { type: WebDocuFormFieldType; isRequired: boolean }[],
    customFields: { type: WebDocuFormFieldType; label: string; isRequired: boolean }[]
  ) => {
    // Prüfen ob das Formular eine Empfänger-E-Mail hat
    const form = forms.find((f) => f.id === formId);
    if (!form?.recipientEmail || form.recipientEmail.trim() === "") {
      setSaveMessage({ type: "error", text: "Bitte zuerst eine Empfänger-E-Mail eingeben!" });
      setTimeout(() => setSaveMessage(null), 5000);
      return;
    }

    setIsSaving(true);
    try {
      const fields = [
        ...selectedFields.map((f) => ({
          fieldType: f.type,
          label: null,
          isRequired: f.isRequired,
          enabled: true,
        })),
        ...customFields.map((f) => ({
          fieldType: f.type,
          label: f.label,
          isRequired: f.isRequired,
          enabled: true,
        })),
      ];

      await updateFormFields(formId, fields);
      setSaveMessage({ type: "success", text: "Formularfelder gespeichert!" });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error("Fehler beim Speichern der Formularfelder:", error);
      setSaveMessage({ type: "error", text: "Fehler beim Speichern" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-2 md:p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header mit Kundennummer */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href={`/projects/${projectId}`}
              className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Zurück zum Projekt
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                  Webdokumentation
                  {client.customerNo && (
                    <span className="ml-3 text-base font-normal text-gray-500 dark:text-gray-400">
                      Kd-Nr. {client.customerNo}
                    </span>
                  )}
                </h1>
                {/* Status-Badge */}
                {webDoc.confirmedAt ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Vom Kunden bestätigt
                  </span>
                ) : webDoc.rejectedAt ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Vom Kunden abgelehnt
                  </span>
                ) : releaseData.releasedAt ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Übermittelt
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    In Bearbeitung
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {client.name}
              </p>
            </div>
          </div>
        </div>

        {/* Ablehnung Banner - wenn vom Kunden abgelehnt */}
        {webDoc.rejectedAt && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-red-800 dark:text-red-200">
                  Vom Kunden abgelehnt
                </h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  Der Kunde hat Änderungswünsche und bittet um Rückmeldung.
                  {webDoc.rejectedByName && (
                    <span className="ml-1">
                      Abgelehnt von {webDoc.rejectedByName} am {new Date(webDoc.rejectedAt).toLocaleDateString("de-DE")} um {new Date(webDoc.rejectedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr.
                    </span>
                  )}
                </p>
                {webDoc.rejectedSteps.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Bereiche mit Änderungswunsch:</p>
                    <div className="flex flex-wrap gap-2">
                      {webDoc.rejectedSteps.sort((a, b) => a - b).map(stepNum => {
                        const stepInfo = STEPS.find(s => s.number === stepNum);
                        return (
                          <button
                            key={stepNum}
                            type="button"
                            onClick={() => setCurrentStep(stepNum)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors cursor-pointer"
                          >
                            <span className="font-semibold">{stepNum}.</span>
                            <span>{stepInfo?.title || `Schritt ${stepNum}`}</span>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Locked Banner - wenn Webdoku bereits an Kunden übermittelt */}
        {isLocked && !webDoc.rejectedAt && (
          <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-amber-800 dark:text-amber-200">
                  Bearbeitung gesperrt
                </h3>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  Diese Webdokumentation wurde bereits an den Kunden übermittelt und kann daher nicht mehr bearbeitet werden.
                  {isAdmin && " Als Admin können Sie die Freigabe unten zurückziehen, um die Bearbeitung wieder zu ermöglichen."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step Progress Indicator */}
        <div className="mb-8 overflow-x-auto py-2">
          <div className="flex items-center min-w-max px-1">
            {STEPS.map((step, index) => {
              // Ein Step ist disabled, wenn der vorherige Step nicht gespeichert wurde
              // Step 1 ist immer verfügbar
              const isDisabled = step.number > 1 && !savedSteps.has(step.number - 1);
              return (
              <div key={step.number} className="flex items-center">
                <StepIndicator
                  number={step.number}
                  title={step.title}
                  shortTitle={step.shortTitle}
                  active={currentStep === step.number}
                  saved={savedSteps.has(step.number)}
                  disabled={isDisabled}
                  onClick={() => setCurrentStep(step.number)}
                />
                {index < STEPS.length - 1 && (
                  <div
                    className={`h-1 w-6 md:w-12 mx-1 ${
                      savedSteps.has(step.number)
                        ? "bg-green-500"
                        : "bg-gray-300 dark:bg-gray-700"
                    }`}
                  />
                )}
              </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700">
          {currentStep === 1 && (
            <StepContent title="Schritt 1: Allgemeines">
              <form action={handleSaveStep1} className="space-y-6">
                <input type="hidden" name="projectId" value={projectId} />

                {/* Ansprechpartner */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ansprechpartner
                    </label>

                    <div className="space-y-2 mb-4">
                      {/* Client-Kontaktperson als fixer Hauptansprechpartner */}
                      {clientContact && (
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-cyan-50 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-700">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center text-white font-medium">
                              {client.firstname?.[0] || ""}
                              {client.lastname?.[0] || ""}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {clientContact.name}
                                <span className="ml-2 text-xs bg-cyan-600 text-white px-2 py-0.5 rounded-full">
                                  Hauptansprechpartner
                                </span>
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {clientContact.email || "Keine E-Mail hinterlegt"}
                                <span className="ml-1 text-xs text-cyan-600 dark:text-cyan-400">(Kontaktperson)</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Weitere verknüpfte Ansprechpartner (berechtigte Personen) */}
                      {webDoc.contacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white font-medium">
                              {contact.authorizedPerson.firstname[0]}
                              {contact.authorizedPerson.lastname[0]}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {contact.authorizedPerson.firstname} {contact.authorizedPerson.lastname}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {contact.authorizedPerson.email}
                                {contact.authorizedPerson.position && ` • ${contact.authorizedPerson.position}`}
                              </p>
                            </div>
                          </div>
                          {!isLocked && (
                            <button
                              type="button"
                              onClick={() => handleRemoveContact(contact.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1"
                              title="Entfernen"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Falls keine Kontaktperson und keine Ansprechpartner */}
                      {!clientContact && webDoc.contacts.length === 0 && (
                        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600 text-center">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Keine Kontaktperson beim Kunden hinterlegt
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Weitere Ansprechpartner hinzufügen */}
                    {availableContacts.length > 0 && !isLocked && (
                      <div className="flex items-center gap-2">
                        <Select
                          onValueChange={(value) => {
                            handleAddContact(value, false);
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Weiteren Ansprechpartner hinzufügen..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableContacts.map((person) => (
                              <SelectItem key={person.id} value={person.id}>
                                {person.firstname} {person.lastname} ({person.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Button zum Anlegen eines neuen Ansprechpartners */}
                    {!showNewContactForm && !isLocked && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => setShowNewContactForm(true)}
                          className="inline-flex items-center gap-2 text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Neuen Ansprechpartner anlegen
                        </button>
                      </div>
                    )}

                    {/* Formular für neuen Ansprechpartner */}
                    {showNewContactForm && (
                      <div className="mt-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium text-gray-900 dark:text-white">Neuen Ansprechpartner anlegen</h4>
                          <button
                            type="button"
                            onClick={() => {
                              setShowNewContactForm(false);
                              setNewContactData({
                                salutation: "",
                                firstname: "",
                                lastname: "",
                                email: "",
                                position: "",
                                phone: "",
                              });
                            }}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Anrede
                            </label>
                            <Select
                              value={newContactData.salutation}
                              onValueChange={(value) => setNewContactData({ ...newContactData, salutation: value })}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Auswählen..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Herr">Herr</SelectItem>
                                <SelectItem value="Frau">Frau</SelectItem>
                                <SelectItem value="Divers">Divers</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Position
                            </label>
                            <Input
                              value={newContactData.position}
                              onChange={(e) => setNewContactData({ ...newContactData, position: e.target.value })}
                              placeholder="z.B. Geschäftsführer"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Vorname <span className="text-red-500">*</span>
                            </label>
                            <Input
                              value={newContactData.firstname}
                              onChange={(e) => setNewContactData({ ...newContactData, firstname: e.target.value })}
                              placeholder="Vorname"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Nachname <span className="text-red-500">*</span>
                            </label>
                            <Input
                              value={newContactData.lastname}
                              onChange={(e) => setNewContactData({ ...newContactData, lastname: e.target.value })}
                              placeholder="Nachname"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              E-Mail <span className="text-red-500">*</span>
                            </label>
                            <Input
                              type="email"
                              value={newContactData.email}
                              onChange={(e) => setNewContactData({ ...newContactData, email: e.target.value })}
                              placeholder="E-Mail-Adresse"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Telefon
                            </label>
                            <Input
                              value={newContactData.phone}
                              onChange={(e) => setNewContactData({ ...newContactData, phone: e.target.value })}
                              placeholder="Telefonnummer"
                            />
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowNewContactForm(false);
                              setNewContactData({
                                salutation: "",
                                firstname: "",
                                lastname: "",
                                email: "",
                                position: "",
                                phone: "",
                              });
                            }}
                          >
                            Abbrechen
                          </Button>
                          <Button
                            type="button"
                            onClick={handleCreateNewContact}
                            disabled={isCreatingContact || !newContactData.firstname || !newContactData.lastname || !newContactData.email}
                            className="bg-cyan-600 hover:bg-cyan-700"
                          >
                            {isCreatingContact ? (
                              <>
                                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Wird angelegt...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Anlegen & verknüpfen
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* E-Mail */}
                <div className="space-y-2">
                  <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    E-Mail <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    required
                    disabled={isLocked}
                    defaultValue={webDoc.contactEmail || primaryContact?.email || client.email || ""}
                    placeholder="E-Mail-Adresse des Ansprechpartners"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Primäre Kontakt-E-Mail für dieses Projekt
                  </p>
                </div>

                {/* Domain */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="websiteDomain" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Domain <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="websiteDomain"
                      name="websiteDomain"
                      required
                      disabled={isLocked}
                      defaultValue={webDoc.websiteDomain || projectDomain || ""}
                      placeholder="z.B. www.example.de"
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="domainStatus" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Domain-Status <span className="text-red-500">*</span>
                    </label>
                    <Select name="domainStatus" required defaultValue={webDoc.domainStatus || ""} disabled={isLocked}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Status auswählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {getDomainStatusOptions(client.agency).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dringend zu beachten */}
                <div className="space-y-2">
                  <label htmlFor="urgentNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Dringend zu beachten
                  </label>
                  <Textarea
                    id="urgentNotes"
                    name="urgentNotes"
                    disabled={isLocked}
                    defaultValue={webDoc.urgentNotes || ""}
                    placeholder="Wichtige Hinweise, die unbedingt beachtet werden müssen..."
                    rows={4}
                    className="w-full resize-y"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Diese Hinweise werden besonders hervorgehoben
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    {saveMessage && (
                      <span
                        className={`text-sm ${
                          saveMessage.type === "success" ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {saveMessage.text}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={isSaving || isLocked} className={savedSteps.has(1) ? "bg-green-600 hover:bg-green-700" : "bg-cyan-600 hover:bg-cyan-700"}>
                      {isSaving ? (
                        <>
                          <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Speichern...
                        </>
                      ) : savedSteps.has(1) ? (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Gespeichert
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                          </svg>
                          Speichern
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(2)}
                      disabled={!savedSteps.has(1)}
                      className="gap-2"
                      title={!savedSteps.has(1) ? "Bitte zuerst speichern" : "Weiter zu Schritt 2"}
                    >
                      Weiter
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </form>
            </StepContent>
          )}

          {currentStep === 2 && (
            <StepContent title="Schritt 2: Unternehmensschwerpunkte">
              <div className="space-y-6">
                {/* Tipps Box */}
                <div className="rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-medium text-cyan-900 dark:text-cyan-100 mb-2">
                        Tipps für diesen Abschnitt
                      </h4>
                      <ul className="text-sm text-cyan-800 dark:text-cyan-200 space-y-1.5 list-disc list-inside">
                        <li>Was sind die hervorzuhebenden Produkte / (Dienst-)Leistungen des Unternehmens?</li>
                        <li>Was zeichnet das Unternehmen aus?</li>
                        <li>Was sind besondere (Alleinstellungs-) Merkmale?</li>
                        <li>Für Online-Shops: Zahlarten, Versandbedingungen und Bestellkriterien</li>
                        <li>Wer ist die Zielgruppe?</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Rich-Text-Editor für Notizen */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Notizen zu Unternehmensschwerpunkten
                  </label>
                  <RichTextEditor
                    content={companyFocusContent}
                    onChange={setCompanyFocusContent}
                    placeholder="Beschreiben Sie hier die Schwerpunkte des Unternehmens, Produkte, Dienstleistungen, Alleinstellungsmerkmale, Zielgruppe etc..."
                    disabled={isLocked}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Nutzen Sie die Toolbar zum Formatieren: Fett, Kursiv, Unterstrichen, Listen etc.
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-4">
                    <Button type="button" variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                      </svg>
                      Zurück
                    </Button>
                    {saveMessage && (
                      <span
                        className={`text-sm ${
                          saveMessage.type === "success" ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {saveMessage.text}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="button" onClick={handleSaveStep2} disabled={isSaving || isLocked} className={savedSteps.has(2) ? "bg-green-600 hover:bg-green-700" : "bg-cyan-600 hover:bg-cyan-700"}>
                      {isSaving ? (
                        <>
                          <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Speichern...
                        </>
                      ) : savedSteps.has(2) ? (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Gespeichert
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                          </svg>
                          Speichern
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(3)}
                      disabled={!savedSteps.has(2)}
                      className="gap-2"
                      title={!savedSteps.has(2) ? "Bitte zuerst speichern" : "Weiter zu Schritt 3"}
                    >
                      Weiter
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            </StepContent>
          )}

          {currentStep === 3 && (
            <StepContent title="Schritt 3: Websiteaufbau">
              <div className="space-y-6">
                {/* Info Box */}
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                        Menüstruktur festlegen
                      </h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Legen Sie hier die Menüpunkte der Website fest. Sie können Hauptmenüpunkte und Untermenüpunkte erstellen.
                        Impressum und Datenschutz sind bereits als Footer-Menüpunkte vorbereitet.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Schnellauswahl für häufige Menüpunkte */}
                {!isLocked && MENU_ITEM_TEMPLATES.filter(
                  (template) => !menuItems.some((item) => item.name.toLowerCase() === template.toLowerCase())
                ).length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Schnellauswahl:</p>
                    <div className="flex flex-wrap gap-2">
                      {MENU_ITEM_TEMPLATES.filter(
                        (template) => !menuItems.some((item) => item.name.toLowerCase() === template.toLowerCase())
                      ).map((template) => (
                        <button
                          key={template}
                          type="button"
                          onClick={() => {
                            handleAddMainMenuItemWithName(template);
                          }}
                          disabled={isAddingMenuItem}
                          className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 text-gray-700 dark:text-gray-300 hover:text-cyan-700 dark:hover:text-cyan-400 rounded-full border border-gray-200 dark:border-gray-600 hover:border-cyan-300 dark:hover:border-cyan-700 transition-colors disabled:opacity-50"
                        >
                          + {template}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Neuen Hauptmenüpunkt hinzufügen */}
                {!isLocked && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newMenuItemName}
                      onChange={(e) => setNewMenuItemName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddMainMenuItem();
                      }}
                      placeholder="Neuen Hauptmenüpunkt hinzufügen..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={handleAddMainMenuItem}
                      disabled={isAddingMenuItem || !newMenuItemName.trim()}
                      className="bg-cyan-600 hover:bg-cyan-700"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Hinzufügen
                    </Button>
                  </div>
                )}

                {/* Wenn noch keine Menüpunkte existieren */}
                {menuItems.length === 0 && (
                  <div className="text-center py-8">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">Noch keine Menüpunkte angelegt</p>
                    {!isLocked && (
                      <>
                        <Button
                          type="button"
                          onClick={handleCreateDefaultMenuItems}
                          disabled={isAddingMenuItem}
                          className="bg-cyan-600 hover:bg-cyan-700"
                        >
                          {isAddingMenuItem ? "Wird erstellt..." : "Standard-Menüpunkte erstellen"}
                        </Button>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                          Erstellt &quot;Impressum&quot; und &quot;Datenschutz&quot; als Footer-Menüpunkte
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Hauptmenü */}
                {menuItems.length > 0 && (
                  <>
                    <div className="space-y-4">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                        Hauptmenü
                      </h3>

                      {/* Hauptmenüpunkte */}
                      <div className="space-y-2">
                        {mainMenuItems.sort((a, b) => a.sortOrder - b.sortOrder).map((item, index) => (
                          <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                            {/* Hauptmenüpunkt */}
                            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800">
                              {/* Sortier-Buttons */}
                              {!isLocked && (
                                <div className="flex flex-col">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveUp(item)}
                                    disabled={index === 0}
                                    className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                                    title="Nach oben"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveDown(item)}
                                    disabled={index === mainMenuItems.length - 1}
                                    className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                                    title="Nach unten"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                </div>
                              )}

                              {/* Name (editierbar) */}
                              {editingItemId === item.id ? (
                                <div className="flex-1 flex items-center gap-2">
                                  <Input
                                    value={editingItemName}
                                    onChange={(e) => setEditingItemName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleRenameMenuItem(item.id);
                                      if (e.key === "Escape") {
                                        setEditingItemId(null);
                                        setEditingItemName("");
                                      }
                                    }}
                                    className="flex-1"
                                    autoFocus
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleRenameMenuItem(item.id)}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingItemId(null);
                                      setEditingItemName("");
                                    }}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </Button>
                                </div>
                              ) : (
                                <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">
                                  {item.name}
                                </span>
                              )}

                              {/* Aktionen */}
                              {editingItemId !== item.id && !isLocked && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedParentId(selectedParentId === item.id ? null : item.id);
                                      setNewSubMenuItemName("");
                                    }}
                                    className="px-2 py-1 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 rounded text-sm flex items-center gap-1"
                                    title="Untermenüpunkt hinzufügen"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    <span>Unterpunkt</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingItemId(item.id);
                                      setEditingItemName(item.name);
                                    }}
                                    className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                                    title="Umbenennen"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMenuItem(item.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                    title="Löschen"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Untermenüpunkte */}
                            {getSubMenuItems(item.id).length > 0 && (
                              <div className="border-t border-gray-200 dark:border-gray-700">
                                {getSubMenuItems(item.id).map((subItem, subIndex) => (
                                  <div
                                    key={subItem.id}
                                    className="flex items-center gap-2 p-2 pl-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                                  >
                                    {/* Sortier-Buttons */}
                                    {!isLocked && (
                                      <div className="flex flex-col">
                                        <button
                                          type="button"
                                          onClick={() => handleMoveUp(subItem)}
                                          disabled={subIndex === 0}
                                          className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                                          title="Nach oben"
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                          </svg>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleMoveDown(subItem)}
                                          disabled={subIndex === getSubMenuItems(item.id).length - 1}
                                          className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                                          title="Nach unten"
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </button>
                                      </div>
                                    )}

                                    {/* Pfeil-Icon */}
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>

                                    {/* Name (editierbar) */}
                                    {editingItemId === subItem.id ? (
                                      <div className="flex-1 flex items-center gap-2">
                                        <Input
                                          value={editingItemName}
                                          onChange={(e) => setEditingItemName(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") handleRenameMenuItem(subItem.id);
                                            if (e.key === "Escape") {
                                              setEditingItemId(null);
                                              setEditingItemName("");
                                            }
                                          }}
                                          className="flex-1 h-8"
                                          autoFocus
                                        />
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={() => handleRenameMenuItem(subItem.id)}
                                          className="bg-green-600 hover:bg-green-700 h-8"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                        </Button>
                                      </div>
                                    ) : (
                                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                                        {subItem.name}
                                      </span>
                                    )}

                                    {/* Aktionen */}
                                    {editingItemId !== subItem.id && !isLocked && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingItemId(subItem.id);
                                            setEditingItemName(subItem.name);
                                          }}
                                          className="p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                                          title="Umbenennen"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                          </svg>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteMenuItem(subItem.id)}
                                          className="p-1 text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                          title="Löschen"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Neuen Untermenüpunkt hinzufügen */}
                            {selectedParentId === item.id && (
                              <div className="flex items-center gap-2 p-2 pl-10 bg-cyan-50 dark:bg-cyan-900/20 border-t border-cyan-200 dark:border-cyan-800">
                                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <Input
                                  value={newSubMenuItemName}
                                  onChange={(e) => setNewSubMenuItemName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleAddSubMenuItem(item.id);
                                    if (e.key === "Escape") {
                                      setSelectedParentId(null);
                                      setNewSubMenuItemName("");
                                    }
                                  }}
                                  placeholder="Name des Untermenüpunkts..."
                                  className="flex-1 h-8"
                                  autoFocus
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleAddSubMenuItem(item.id)}
                                  disabled={isAddingMenuItem || !newSubMenuItemName.trim()}
                                  className="bg-cyan-600 hover:bg-cyan-700 h-8"
                                >
                                  Hinzufügen
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedParentId(null);
                                    setNewSubMenuItemName("");
                                  }}
                                  className="h-8"
                                >
                                  Abbrechen
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                    </div>

                    {/* Footer-Menü */}
                    {footerMenuItems.length > 0 && (
                      <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          Footer-Menü
                          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(erscheint im Footer der Website)</span>
                        </h3>

                        <div className="space-y-2">
                          {footerMenuItems.sort((a, b) => a.sortOrder - b.sortOrder).map((item, index) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                            >
                              {/* Sortier-Buttons */}
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  onClick={() => handleMoveUp(item)}
                                  disabled={index === 0}
                                  className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                                  title="Nach oben"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveDown(item)}
                                  disabled={index === footerMenuItems.length - 1}
                                  className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                                  title="Nach unten"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>

                              {/* Badge */}
                              <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                                Footermenü
                              </span>

                              {/* Name (editierbar) */}
                              {editingItemId === item.id ? (
                                <div className="flex-1 flex items-center gap-2">
                                  <Input
                                    value={editingItemName}
                                    onChange={(e) => setEditingItemName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleRenameMenuItem(item.id);
                                      if (e.key === "Escape") {
                                        setEditingItemId(null);
                                        setEditingItemName("");
                                      }
                                    }}
                                    className="flex-1"
                                    autoFocus
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleRenameMenuItem(item.id)}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </Button>
                                </div>
                              ) : (
                                <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">
                                  {item.name}
                                </span>
                              )}

                              {/* Aktionen */}
                              {editingItemId !== item.id && !isLocked && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingItemId(item.id);
                                      setEditingItemName(item.name);
                                    }}
                                    className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                                    title="Umbenennen"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMenuItem(item.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                    title="Löschen"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Hinweise zu Menüpunkten */}
                    <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                          </svg>
                          Hinweise zu Menüpunkten
                          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(optional)</span>
                        </h3>
                        {/* Dropdown um Hinweis hinzuzufügen */}
                        {!editingNotesItemId && !isLocked && (
                          <Select
                            value=""
                            onValueChange={(value) => {
                              const item = menuItems.find((m) => m.id === value);
                              if (item) {
                                setEditingNotesItemId(item.id);
                                setEditingNotesText(item.notes || "");
                              }
                            }}
                          >
                            <SelectTrigger className="w-[220px]">
                              <SelectValue placeholder="Hinweis hinzufügen für..." />
                            </SelectTrigger>
                            <SelectContent>
                              {/* Hauptmenüpunkte */}
                              {mainMenuItems.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name}
                                </SelectItem>
                              ))}
                              {/* Untermenüpunkte */}
                              {mainMenuItems.sort((a, b) => a.sortOrder - b.sortOrder).flatMap((parent) =>
                                getSubMenuItems(parent.id).map((sub) => (
                                  <SelectItem key={sub.id} value={sub.id}>
                                    &nbsp;&nbsp;↳ {sub.name}
                                  </SelectItem>
                                ))
                              )}
                              {/* Footer-Menüpunkte */}
                              {footerMenuItems.length > 0 && (
                                <>
                                  {footerMenuItems.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                      {item.name} (Footer)
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Formular zum Bearbeiten */}
                      {editingNotesItemId && (
                        <div className="border border-cyan-200 dark:border-cyan-800 rounded-lg overflow-hidden bg-cyan-50 dark:bg-cyan-900/20">
                          <div className="flex items-center gap-2 p-3 border-b border-cyan-200 dark:border-cyan-800">
                            <span className="font-medium text-cyan-900 dark:text-cyan-100">
                              {menuItems.find((m) => m.id === editingNotesItemId)?.name}
                            </span>
                          </div>
                          <div className="p-3 space-y-2">
                            <Textarea
                              value={editingNotesText}
                              onChange={(e) => setEditingNotesText(e.target.value)}
                              placeholder="Hinweise zum Menüpunkt eingeben..."
                              className="min-h-[80px] bg-white dark:bg-gray-900"
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingNotesItemId(null);
                                  setEditingNotesText("");
                                }}
                              >
                                Abbrechen
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSaveNotes(editingNotesItemId)}
                                className="bg-cyan-600 hover:bg-cyan-700"
                              >
                                Speichern
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Liste der vorhandenen Hinweise */}
                      {menuItems.filter((m) => m.notes).length > 0 && !editingNotesItemId && (
                        <div className="space-y-2">
                          {menuItems
                            .filter((m) => m.notes)
                            .map((item) => {
                              const parent = item.parentId ? menuItems.find((m) => m.id === item.parentId) : null;
                              return (
                                <div
                                  key={item.id}
                                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                                >
                                  <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800">
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 flex-1">
                                      {parent && (
                                        <span className="text-gray-500 dark:text-gray-400">
                                          {parent.name} →
                                        </span>
                                      )}
                                      {item.name}
                                      {item.isFooterMenu && (
                                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                                          Footer
                                        </span>
                                      )}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingNotesItemId(item.id);
                                        setEditingNotesText(item.notes || "");
                                      }}
                                      className="p-1 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                                      title="Bearbeiten"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteNotes(item.id)}
                                      className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                      title="Hinweis löschen"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                  <div className="p-2 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                    {item.notes}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}

                      {/* Hinweis wenn keine Notizen vorhanden */}
                      {menuItems.filter((m) => m.notes).length === 0 && !editingNotesItemId && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                          Noch keine Hinweise vorhanden. Wählen Sie einen Menüpunkt aus dem Dropdown, um einen Hinweis hinzuzufügen.
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* Buttons */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                  <Button type="button" variant="outline" onClick={() => setCurrentStep(2)} className="gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                    </svg>
                    Zurück
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(4)}
                    disabled={!savedSteps.has(3)}
                    className="gap-2"
                    title={!savedSteps.has(3) ? "Bitte zuerst speichern" : "Weiter zu Schritt 4"}
                  >
                    Weiter
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Button>
                </div>
              </div>
            </StepContent>
          )}

          {currentStep === 4 && (
            <StepContent title="Schritt 4: Design & Vorgaben">
              <div className="space-y-8">
                {/* Bereich Design */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    Design
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Logo vorhanden */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Logo vorhanden?
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="hasLogo"
                            checked={step4Data.hasLogo === true}
                            onChange={() => setStep4Data({ ...step4Data, hasLogo: true })}
                            className="w-4 h-4 text-cyan-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Ja</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="hasLogo"
                            checked={step4Data.hasLogo === false}
                            onChange={() => setStep4Data({ ...step4Data, hasLogo: false })}
                            className="w-4 h-4 text-cyan-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Nein</span>
                        </label>
                        {step4Data.hasLogo !== null && (
                          <button
                            type="button"
                            onClick={() => setStep4Data({ ...step4Data, hasLogo: null })}
                            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                          >
                            Zurücksetzen
                          </button>
                        )}
                      </div>
                    </div>

                    {/* CI definiert */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        CI definiert?
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="hasCIDefined"
                            checked={step4Data.hasCIDefined === true}
                            onChange={() => setStep4Data({ ...step4Data, hasCIDefined: true })}
                            className="w-4 h-4 text-cyan-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Ja</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="hasCIDefined"
                            checked={step4Data.hasCIDefined === false}
                            onChange={() => setStep4Data({ ...step4Data, hasCIDefined: false })}
                            className="w-4 h-4 text-cyan-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Nein</span>
                        </label>
                        {step4Data.hasCIDefined !== null && (
                          <button
                            type="button"
                            onClick={() => setStep4Data({ ...step4Data, hasCIDefined: null })}
                            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                          >
                            Zurücksetzen
                          </button>
                        )}
                      </div>
                    </div>

                    {/* CI-Details (nur wenn CI definiert = Ja) */}
                    {step4Data.hasCIDefined === true && (
                      <>
                        {/* CI-Farbcode */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            CI-Farbcode
                          </label>
                          <Input
                            value={step4Data.ciColorCode}
                            onChange={(e) => setStep4Data({ ...step4Data, ciColorCode: e.target.value })}
                            placeholder="z.B. #FF5733, RGB(255, 87, 51)"
                          />
                        </div>

                        {/* CI-Schriftart */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            CI-Schriftart
                          </label>
                          <Input
                            value={step4Data.ciFontFamily}
                            onChange={(e) => setStep4Data({ ...step4Data, ciFontFamily: e.target.value })}
                            placeholder="z.B. Open Sans, Roboto, Montserrat"
                          />
                        </div>
                      </>
                    )}

                    {/* Farborientierung */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Farborientierung
                      </label>
                      <Select
                        value={step4Data.colorOrientation || ""}
                        onValueChange={(value) => setStep4Data({ ...step4Data, colorOrientation: value || null })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Bitte wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOGO">Am Logo</SelectItem>
                          <SelectItem value="PRINT">Am Printprodukt</SelectItem>
                          <SelectItem value="CI_SHEET">Am CI-Bogen</SelectItem>
                          <SelectItem value="WEBSITE">An bestehender Webseite</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Farben/Farbcodes */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Farben / Farbcodes
                      </label>
                      <Input
                        value={step4Data.colorCodes}
                        onChange={(e) => setStep4Data({ ...step4Data, colorCodes: e.target.value })}
                        placeholder="z.B. #FF5733, #3498DB, RGB(52, 152, 219)"
                      />
                    </div>
                  </div>
                </div>

                {/* Bereich Umsetzungsvorgaben */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Umsetzungsvorgaben
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Top Webseite */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Top-Webseite (Referenz)
                      </label>
                      <Input
                        value={step4Data.topWebsite}
                        onChange={(e) => setStep4Data({ ...step4Data, topWebsite: e.target.value })}
                        placeholder="z.B. www.beispiel.de"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">Was gefällt dem Kunden gut?</p>
                    </div>

                    {/* Flop Webseite */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Flop-Webseite (Referenz)
                      </label>
                      <Input
                        value={step4Data.flopWebsite}
                        onChange={(e) => setStep4Data({ ...step4Data, flopWebsite: e.target.value })}
                        placeholder="z.B. www.beispiel.de"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">Was gefällt dem Kunden nicht?</p>
                    </div>

                    {/* Art der Webseite */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Art der Webseite
                      </label>
                      <Select
                        value={step4Data.websiteType || ""}
                        onValueChange={(value) => setStep4Data({ ...step4Data, websiteType: value || null })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Bitte wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STANDARD">Standard (mehrere Seiten)</SelectItem>
                          <SelectItem value="ONEPAGE">Onepage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Startbereich */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Startbereich
                      </label>
                      <Select
                        value={step4Data.startArea || ""}
                        onValueChange={(value) => setStep4Data({ ...step4Data, startArea: value || null })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Bitte wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HEADER_VIDEO">Header-Video</SelectItem>
                          <SelectItem value="SLIDER">Slider</SelectItem>
                          <SelectItem value="HEADER_IMAGE">Header-Bild</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Stil */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Stil der Webseite <span className="text-xs font-normal text-gray-500">(Mehrfachauswahl möglich)</span>
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {[
                          { value: "CLEAN", label: "Clean" },
                          { value: "NOBLE", label: "Edel" },
                          { value: "ELEGANT", label: "Elegant" },
                          { value: "PLAYFUL", label: "Verspielt" },
                          { value: "SIMPLE", label: "Schlicht" },
                          { value: "BOLD", label: "Plakativ" },
                          { value: "NOSTALGIC", label: "Nostalgisch" },
                          { value: "TECHNICAL", label: "Technisch" },
                          { value: "NO_PREFERENCE", label: "Keine Vorgabe" },
                          { value: "EFFECTFUL", label: "Effektvoll" },
                          { value: "CUSTOM", label: "Individuell" },
                        ].map((style) => {
                          const isSelected = step4Data.styleTypes.includes(style.value);
                          return (
                            <label
                              key={style.value}
                              className={`flex items-center justify-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors ${
                                isSelected
                                  ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300"
                                  : "border-gray-200 dark:border-gray-700 hover:border-cyan-300 dark:hover:border-cyan-700"
                              }`}
                            >
                              <input
                                type="checkbox"
                                value={style.value}
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setStep4Data({ ...step4Data, styleTypes: [...step4Data.styleTypes, style.value] });
                                  } else {
                                    setStep4Data({ ...step4Data, styleTypes: step4Data.styleTypes.filter(s => s !== style.value) });
                                  }
                                }}
                                className="sr-only"
                              />
                              <span className="text-sm">{style.label}</span>
                              {isSelected && (
                                <svg className="w-4 h-4 text-cyan-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </label>
                          );
                        })}
                      </div>
                      {step4Data.styleTypes.includes("CUSTOM") && (
                        <Input
                          value={step4Data.styleCustom}
                          onChange={(e) => setStep4Data({ ...step4Data, styleCustom: e.target.value })}
                          placeholder="Individuellen Stil beschreiben..."
                          className="mt-2"
                        />
                      )}
                    </div>

                    {/* Slogan */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Slogan
                      </label>
                      <Input
                        value={step4Data.slogan}
                        onChange={(e) => setStep4Data({ ...step4Data, slogan: e.target.value })}
                        placeholder="z.B. Ihr Partner für..."
                      />
                    </div>

                    {/* Teaservorgaben */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Teaservorgaben
                      </label>
                      <Textarea
                        value={step4Data.teaserSpecs}
                        onChange={(e) => setStep4Data({ ...step4Data, teaserSpecs: e.target.value })}
                        placeholder="Vorgaben für Teaser-Elemente..."
                        className="min-h-[80px]"
                      />
                    </div>

                    {/* Störervorgaben */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Störervorgaben
                      </label>
                      <Textarea
                        value={step4Data.disruptorSpecs}
                        onChange={(e) => setStep4Data({ ...step4Data, disruptorSpecs: e.target.value })}
                        placeholder="Vorgaben für Störer-Elemente..."
                        className="min-h-[80px]"
                      />
                    </div>

                    {/* Map-Einbindung */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Map-Einbindung
                      </label>
                      <div className="flex gap-4">
                        {[
                          { value: "YES", label: "Ja" },
                          { value: "MULTIPLE", label: "Ja, mehrere Standorte" },
                          { value: "NO", label: "Nein" },
                        ].map((option) => (
                          <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="mapIntegration"
                              checked={step4Data.mapIntegration === option.value}
                              onChange={() => setStep4Data({ ...step4Data, mapIntegration: option.value })}
                              className="w-4 h-4 text-cyan-600"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Sonstige Vorgaben */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Sonstige Vorgaben zur Umsetzung
                      </label>
                      <RichTextEditor
                        content={step4Data.otherSpecs}
                        onChange={(value) => setStep4Data({ ...step4Data, otherSpecs: value })}
                        placeholder="Weitere Vorgaben, Wünsche oder Anmerkungen..."
                      />
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-4">
                    <Button type="button" variant="outline" onClick={() => setCurrentStep(3)} className="gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                      </svg>
                      Zurück
                    </Button>
                    {saveMessage && (
                      <span
                        className={`text-sm ${
                          saveMessage.type === "success" ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {saveMessage.text}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="button" onClick={handleSaveStep4} disabled={isSaving || isLocked} className={savedSteps.has(4) ? "bg-green-600 hover:bg-green-700" : "bg-cyan-600 hover:bg-cyan-700"}>
                      {isSaving ? (
                        <>
                          <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Speichern...
                        </>
                      ) : savedSteps.has(4) ? (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Gespeichert
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                          </svg>
                          Speichern
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(5)}
                      disabled={!savedSteps.has(4)}
                      className="gap-2"
                      title={!savedSteps.has(4) ? "Bitte zuerst speichern" : "Weiter zu Schritt 5"}
                    >
                      Weiter
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            </StepContent>
          )}

          {currentStep === 5 && (
            <StepContent title="Schritt 5: Formulare">
              <div className="space-y-6">
                {/* Info-Box */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      <p className="font-medium">Formulare definieren</p>
                      <p className="mt-1">Hier können Sie Formulare für die Website definieren (z.B. Kontaktformular, Bewerbungsformular). Wählen Sie die gewünschten Felder aus und geben Sie die Empfänger-E-Mail-Adresse an.</p>
                    </div>
                  </div>
                </div>

                {/* Checkbox: Kein Formular gewünscht */}
                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <input
                    type="checkbox"
                    id="noFormsRequired"
                    checked={noFormsRequired}
                    disabled={isLocked}
                    onChange={async (e) => {
                      const newValue = e.target.checked;
                      setNoFormsRequired(newValue);
                      setIsSaving(true);
                      try {
                        await updateNoFormsRequired(projectId, newValue);
                        setSavedSteps((prev) => new Set([...prev, 5]));
                        setSaveMessage({ type: "success", text: "Gespeichert!" });
                      } catch (error) {
                        console.error("Fehler beim Speichern:", error);
                        setSaveMessage({ type: "error", text: "Fehler beim Speichern" });
                        setNoFormsRequired(!newValue); // Rollback
                      } finally {
                        setIsSaving(false);
                        setTimeout(() => setSaveMessage(null), 3000);
                      }
                    }}
                    className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 disabled:opacity-50"
                  />
                  <label htmlFor="noFormsRequired" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    Kein Formular gewünscht
                  </label>
                </div>

                {/* Formular-Bereich (nur anzeigen wenn nicht "Kein Formular gewünscht") */}
                {!noFormsRequired && (
                  <>
                    {/* Neues Formular hinzufügen */}
                    {!isLocked && (
                      <div className="flex gap-3">
                        <Input
                          value={newFormName}
                          onChange={(e) => setNewFormName(e.target.value)}
                          placeholder="Formularname (z.B. Kontaktformular)"
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddForm();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={handleAddForm}
                          disabled={isAddingForm || !newFormName.trim()}
                          className="bg-cyan-600 hover:bg-cyan-700"
                        >
                          {isAddingForm ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Formular hinzufügen
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                {/* Formularliste */}
                {forms.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>Noch keine Formulare definiert</p>
                    <p className="text-sm mt-1">Fügen Sie oben ein Formular hinzu</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {forms.sort((a, b) => a.sortOrder - b.sortOrder).map((form) => {
                      // Bekannte E-Mail-Adressen sammeln
                      const knownEmails: { email: string; label: string }[] = [];
                      // WebDoc-E-Mail
                      if (webDoc.contactEmail) {
                        knownEmails.push({ email: webDoc.contactEmail, label: `WebDoku: ${webDoc.contactEmail}` });
                      }
                      // Client-E-Mail
                      if (client.email && !knownEmails.some(e => e.email === client.email)) {
                        knownEmails.push({ email: client.email, label: `Kunde: ${client.email}` });
                      }
                      // Ansprechpartner-E-Mails
                      webDoc.contacts.forEach(c => {
                        if (c.authorizedPerson.email && !knownEmails.some(e => e.email === c.authorizedPerson.email)) {
                          const name = `${c.authorizedPerson.firstname} ${c.authorizedPerson.lastname}`;
                          knownEmails.push({
                            email: c.authorizedPerson.email,
                            label: `${name}: ${c.authorizedPerson.email}`
                          });
                        }
                      });
                      // Alle Ansprechpartner vom Client
                      client.authorizedPersons.forEach(ap => {
                        if (ap.email && !knownEmails.some(e => e.email === ap.email)) {
                          const name = `${ap.firstname} ${ap.lastname}`;
                          knownEmails.push({
                            email: ap.email,
                            label: `${name}: ${ap.email}`
                          });
                        }
                      });

                      return (
                        <FormCard
                          key={form.id}
                          form={form}
                          isExpanded={expandedFormId === form.id}
                          isEditing={editingFormId === form.id}
                          editingData={editingFormData}
                          standardFields={STANDARD_FIELDS}
                          knownEmails={knownEmails}
                          isSaving={isSaving}
                          isLocked={isLocked}
                          onToggleExpand={() => setExpandedFormId(expandedFormId === form.id ? null : form.id)}
                          onStartEdit={() => handleStartEditForm(form)}
                          onSaveEdit={() => handleSaveForm(form.id)}
                          onCancelEdit={() => setEditingFormId(null)}
                          onDelete={() => handleDeleteForm(form.id)}
                          onEditingDataChange={setEditingFormData}
                          onSaveFields={(selectedFields, customFields) => handleSaveFormFields(form.id, selectedFields, customFields)}
                          onSaveEmail={async (email) => {
                            await updateForm(form.id, { recipientEmail: email || null });
                            // Lokalen State aktualisieren für Weiter-Button Validierung
                            setForms((prev) => prev.map((f) => f.id === form.id ? { ...f, recipientEmail: email || null } : f));
                          }}
                        />
                      );
                    })}
                    </div>
                  )}
                  </>
                )}

                {/* Buttons */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-4">
                    <Button type="button" variant="outline" onClick={() => setCurrentStep(4)} className="gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                      </svg>
                      Zurück
                    </Button>
                    {saveMessage && (
                      <span className={`text-sm ${saveMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                        {saveMessage.text}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(6)}
                    disabled={!isStep5Complete}
                    className="gap-2"
                    title={
                      !isStep5Complete
                        ? !allFormsHaveEmail
                          ? "Bitte bei allen Formularen eine Empfänger-E-Mail eingeben"
                          : "Bitte Formularfelder speichern oder 'Kein Formular' wählen"
                        : "Weiter zu Schritt 6"
                    }
                  >
                    Weiter
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Button>
                </div>
              </div>
            </StepContent>
          )}

          {currentStep === 6 && (
            <StepContent title="Schritt 6: Impressum & Datenschutz">
              <div className="space-y-8">
                {/* Hinweis für den Kunden */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <span className="font-medium text-amber-900 dark:text-amber-100">Hinweis</span>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Die folgenden Angaben zu Impressum und Datenschutz müssen vom Kunden selbst ausgefüllt werden.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Formularfelder */}
                <div className="space-y-6">
                    {/* Anschrift */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Anschrift
                      </label>
                      <Textarea
                        value={step6Data.imprintAddress}
                        onChange={(e) => setStep6Data({ ...step6Data, imprintAddress: e.target.value })}
                        placeholder="Straße, Hausnummer&#10;PLZ Ort"
                        className="min-h-[80px]"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Geschäftsform */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Geschäftsform
                        </label>
                        <Input
                          value={step6Data.imprintLegalForm}
                          onChange={(e) => setStep6Data({ ...step6Data, imprintLegalForm: e.target.value })}
                          placeholder="z.B. GmbH, AG, Einzelunternehmen"
                        />
                      </div>

                      {/* Inhaber */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Inhaber
                        </label>
                        <Input
                          value={step6Data.imprintOwner}
                          onChange={(e) => setStep6Data({ ...step6Data, imprintOwner: e.target.value })}
                          placeholder="Name des Inhabers"
                        />
                      </div>

                      {/* Geschäftsführer */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Geschäftsführer
                        </label>
                        <Input
                          value={step6Data.imprintCeo}
                          onChange={(e) => setStep6Data({ ...step6Data, imprintCeo: e.target.value })}
                          placeholder="Name des Geschäftsführers"
                        />
                      </div>

                      {/* Telefonnummer */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Telefonnummer
                        </label>
                        <Input
                          value={step6Data.imprintPhone}
                          onChange={(e) => setStep6Data({ ...step6Data, imprintPhone: e.target.value })}
                          placeholder="z.B. +49 123 456789"
                        />
                      </div>

                      {/* Faxnummer */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Faxnummer
                        </label>
                        <Input
                          value={step6Data.imprintFax}
                          onChange={(e) => setStep6Data({ ...step6Data, imprintFax: e.target.value })}
                          placeholder="z.B. +49 123 456780"
                        />
                      </div>

                      {/* E-Mail-Adresse */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          E-Mail-Adresse
                        </label>
                        <Input
                          type="email"
                          value={step6Data.imprintEmail}
                          onChange={(e) => setStep6Data({ ...step6Data, imprintEmail: e.target.value })}
                          placeholder="kontakt@beispiel.de"
                        />
                      </div>
                    </div>

                    {/* Registerangaben */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Registerangaben
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Registerart */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Registerart
                          </label>
                          <Select
                            value={step6Data.imprintRegisterType || ""}
                            onValueChange={(value) => setStep6Data({ ...step6Data, imprintRegisterType: value || null })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Bitte wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="HANDELSREGISTER">Handelsregister</SelectItem>
                              <SelectItem value="CUSTOM">Anderes Register</SelectItem>
                            </SelectContent>
                          </Select>
                          {step6Data.imprintRegisterType === "CUSTOM" && (
                            <Input
                              value={step6Data.imprintRegisterCustom}
                              onChange={(e) => setStep6Data({ ...step6Data, imprintRegisterCustom: e.target.value })}
                              placeholder="Name des Registers"
                              className="mt-2"
                            />
                          )}
                        </div>

                        {/* Registerort */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Registerort
                          </label>
                          <Input
                            value={step6Data.imprintRegisterLocation}
                            onChange={(e) => setStep6Data({ ...step6Data, imprintRegisterLocation: e.target.value })}
                            placeholder="z.B. Amtsgericht München"
                          />
                        </div>

                        {/* Registernummer */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Registernummer
                          </label>
                          <Input
                            value={step6Data.imprintRegisterNumber}
                            onChange={(e) => setStep6Data({ ...step6Data, imprintRegisterNumber: e.target.value })}
                            placeholder="z.B. HRB 12345"
                          />
                        </div>

                        {/* Kammer */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Kammer
                          </label>
                          <Input
                            value={step6Data.imprintChamber}
                            onChange={(e) => setStep6Data({ ...step6Data, imprintChamber: e.target.value })}
                            placeholder="z.B. IHK München"
                          />
                        </div>

                        {/* Berufsbezeichnung */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Berufsbezeichnung
                          </label>
                          <Input
                            value={step6Data.imprintProfession}
                            onChange={(e) => setStep6Data({ ...step6Data, imprintProfession: e.target.value })}
                            placeholder="z.B. Rechtsanwalt, Steuerberater"
                          />
                        </div>

                        {/* Staat */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Staat
                          </label>
                          <Input
                            value={step6Data.imprintCountry}
                            onChange={(e) => setStep6Data({ ...step6Data, imprintCountry: e.target.value })}
                            placeholder="z.B. Deutschland"
                          />
                        </div>

                        {/* Umsatzsteuer-ID */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Umsatzsteuer-ID
                          </label>
                          <div className="flex">
                            <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-r-0 border-gray-300 rounded-l-md dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">
                              DE
                            </span>
                            <Input
                              value={step6Data.imprintVatId}
                              onChange={(e) => setStep6Data({ ...step6Data, imprintVatId: e.target.value })}
                              placeholder="123456789"
                              className="rounded-l-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AGB & Datenschutz */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        AGB & Datenschutz
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* AGB Status */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            AGB
                          </label>
                          <div className="flex flex-wrap gap-4">
                            {[
                              { value: "AVAILABLE", label: "Vorhanden" },
                              { value: "NOT_AVAILABLE", label: "Nicht vorhanden" },
                              { value: "NOT_NECESSARY", label: "Nicht notwendig" },
                            ].map((option) => (
                              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="imprintTermsStatus"
                                  checked={step6Data.imprintTermsStatus === option.value}
                                  onChange={() => setStep6Data({ ...step6Data, imprintTermsStatus: option.value })}
                                  className="w-4 h-4 text-cyan-600"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Datenschutzbeauftragter benannt? */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Haben Sie einen Datenschutzbeauftragten für Ihr Unternehmen benannt?
                          </label>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="imprintHasPrivacyOfficer"
                                checked={step6Data.imprintHasPrivacyOfficer === true}
                                onChange={() => setStep6Data({ ...step6Data, imprintHasPrivacyOfficer: true })}
                                className="w-4 h-4 text-cyan-600"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Ja</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="imprintHasPrivacyOfficer"
                                checked={step6Data.imprintHasPrivacyOfficer === false}
                                onChange={() => setStep6Data({ ...step6Data, imprintHasPrivacyOfficer: false })}
                                className="w-4 h-4 text-cyan-600"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Nein</span>
                            </label>
                            {step6Data.imprintHasPrivacyOfficer !== null && (
                              <button
                                type="button"
                                onClick={() => setStep6Data({ ...step6Data, imprintHasPrivacyOfficer: null })}
                                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                              >
                                Zurücksetzen
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Datenschutzbeauftragter Name (nur wenn ja ausgewählt) */}
                        {step6Data.imprintHasPrivacyOfficer === true && (
                          <div className="space-y-2 md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Datenschutzbeauftragter
                            </label>
                            <Input
                              value={step6Data.imprintPrivacyOfficer}
                              onChange={(e) => setStep6Data({ ...step6Data, imprintPrivacyOfficer: e.target.value })}
                              placeholder="Name des Datenschutzbeauftragten"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                {/* Buttons */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-4">
                    <Button type="button" variant="outline" onClick={() => setCurrentStep(5)} className="gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                      </svg>
                      Zurück
                    </Button>
                    {saveMessage && (
                      <span className={`text-sm ${saveMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                        {saveMessage.text}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="button" onClick={handleSaveStep6} disabled={isSaving || isLocked} className={savedSteps.has(6) ? "bg-green-600 hover:bg-green-700" : "bg-cyan-600 hover:bg-cyan-700"}>
                      {isSaving ? (
                        <>
                          <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Wird gespeichert...
                        </>
                      ) : savedSteps.has(6) ? (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Kunde wurde informiert
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Kunde wurde informiert
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(7)}
                      disabled={!savedSteps.has(6)}
                      className="gap-2"
                      title={!savedSteps.has(6) ? "Bitte zuerst bestätigen, dass der Kunde informiert wurde" : "Weiter zu Schritt 7"}
                    >
                      Weiter
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            </StepContent>
          )}

          {currentStep === 7 && (
            <StepContent title="Schritt 7: Material">
              <div className="space-y-8">
                {/* Info-Box */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      <p className="font-medium">Nachzureichendes Material</p>
                      <p className="mt-1">Hier wird erfasst, welches Material der Kunde noch nachreichen muss.</p>
                    </div>
                  </div>
                </div>

                {/* Allgemeine Checkboxen */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Allgemeines Material
                  </h3>

                  <div className="space-y-3">
                    {/* Logo (nur wenn in Step 4 hasLogo=true) */}
                    {webDoc.hasLogo === true && (
                      <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={step7Data.materialLogoNeeded === true}
                          onChange={(e) => setStep7Data({ ...step7Data, materialLogoNeeded: e.target.checked })}
                          className="w-5 h-5 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                        />
                        <div>
                          <span className="font-medium text-gray-900 dark:text-gray-100">Logo</span>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Logo-Dateien müssen noch nachgereicht werden</p>
                        </div>
                      </label>
                    )}

                    {/* Authcode (nur wenn domainStatus=EXISTS_TRANSFER) */}
                    {webDoc.domainStatus === "EXISTS_TRANSFER" && (
                      <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={step7Data.materialAuthcodeNeeded === true}
                          onChange={(e) => setStep7Data({ ...step7Data, materialAuthcodeNeeded: e.target.checked })}
                          className="w-5 h-5 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                        />
                        <div>
                          <span className="font-medium text-gray-900 dark:text-gray-100">Authcode</span>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Authcode für Domain-Transfer wird benötigt</p>
                        </div>
                      </label>
                    )}

                    {/* Hinweis wenn keine allgemeinen Optionen verfügbar */}
                    {webDoc.hasLogo !== true && webDoc.domainStatus !== "EXISTS_TRANSFER" && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic p-3">
                        Keine allgemeinen Material-Optionen verfügbar. (Logo nicht vorhanden, kein Domain-Transfer geplant)
                      </p>
                    )}
                  </div>
                </div>

                {/* Material pro Menüpunkt */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    Material pro Menüpunkt
                  </h3>

                  {menuItems.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic p-3">
                      Keine Menüpunkte vorhanden. Bitte zuerst in Schritt 3 die Menüstruktur anlegen.
                    </p>
                  ) : (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      {/* Tabellen-Header */}
                      <div className="grid grid-cols-[1fr_80px_80px_1fr] gap-2 p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 font-medium text-sm text-gray-700 dark:text-gray-300">
                        <div>Menüpunkt</div>
                        <div className="text-center">Bilder</div>
                        <div className="text-center">{hasTextit ? "Stichpunkte" : "Texte"}</div>
                        <div>Hinweis (z.B. welche Bilder/Texte benötigt werden)</div>
                      </div>

                      {/* Menüpunkte als Liste */}
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {/* Hauptmenü */}
                        {mainMenuItems.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => (
                          <div key={item.id}>
                            {/* Hauptmenüpunkt */}
                            <div className="grid grid-cols-[1fr_80px_80px_1fr] gap-2 p-3 items-center hover:bg-gray-50 dark:hover:bg-gray-800">
                              <div className="font-medium text-gray-900 dark:text-gray-100">{item.name}</div>
                              <div className="flex justify-center">
                                <input
                                  type="checkbox"
                                  checked={menuItemMaterials[item.id]?.needsImages ?? false}
                                  onChange={(e) => setMenuItemMaterials((prev) => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], needsImages: e.target.checked },
                                  }))}
                                  className="w-5 h-5 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                                />
                              </div>
                              <div className="flex justify-center">
                                <input
                                  type="checkbox"
                                  checked={menuItemMaterials[item.id]?.needsTexts ?? false}
                                  onChange={(e) => setMenuItemMaterials((prev) => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], needsTexts: e.target.checked },
                                  }))}
                                  className="w-5 h-5 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                                />
                              </div>
                              <div>
                                <input
                                  type="text"
                                  value={menuItemMaterials[item.id]?.materialNotes ?? ""}
                                  onChange={(e) => setMenuItemMaterials((prev) => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], materialNotes: e.target.value },
                                  }))}
                                  placeholder="z.B. Teamfotos, Produktbeschreibungen..."
                                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-cyan-500 focus:border-cyan-500"
                                />
                              </div>
                            </div>
                            {/* Untermenüpunkte */}
                            {getSubMenuItems(item.id).map((subItem) => (
                              <div key={subItem.id} className="grid grid-cols-[1fr_80px_80px_1fr] gap-2 p-3 pl-8 items-center hover:bg-gray-50 dark:hover:bg-gray-800 bg-gray-25 dark:bg-gray-850">
                                <div className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                  <span className="text-gray-400">└</span>
                                  {subItem.name}
                                </div>
                                <div className="flex justify-center">
                                  <input
                                    type="checkbox"
                                    checked={menuItemMaterials[subItem.id]?.needsImages ?? false}
                                    onChange={(e) => setMenuItemMaterials((prev) => ({
                                      ...prev,
                                      [subItem.id]: { ...prev[subItem.id], needsImages: e.target.checked },
                                    }))}
                                    className="w-5 h-5 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                                  />
                                </div>
                                <div className="flex justify-center">
                                  <input
                                    type="checkbox"
                                    checked={menuItemMaterials[subItem.id]?.needsTexts ?? false}
                                    onChange={(e) => setMenuItemMaterials((prev) => ({
                                      ...prev,
                                      [subItem.id]: { ...prev[subItem.id], needsTexts: e.target.checked },
                                    }))}
                                    className="w-5 h-5 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                                  />
                                </div>
                                <div>
                                  <input
                                    type="text"
                                    value={menuItemMaterials[subItem.id]?.materialNotes ?? ""}
                                    onChange={(e) => setMenuItemMaterials((prev) => ({
                                      ...prev,
                                      [subItem.id]: { ...prev[subItem.id], materialNotes: e.target.value },
                                    }))}
                                    placeholder="z.B. Teamfotos, Produktbeschreibungen..."
                                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-cyan-500 focus:border-cyan-500"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}

                        {/* Footer-Menü */}
                        {footerMenuItems.length > 0 && (
                          <>
                            <div className="p-2 bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Footer-Menü
                            </div>
                            {footerMenuItems.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => (
                              <div key={item.id} className="grid grid-cols-[1fr_80px_80px_1fr] gap-2 p-3 items-center hover:bg-gray-50 dark:hover:bg-gray-800">
                                <div className="font-medium text-gray-900 dark:text-gray-100">{item.name}</div>
                                <div className="flex justify-center">
                                  <input
                                    type="checkbox"
                                    checked={menuItemMaterials[item.id]?.needsImages ?? false}
                                    onChange={(e) => setMenuItemMaterials((prev) => ({
                                      ...prev,
                                      [item.id]: { ...prev[item.id], needsImages: e.target.checked },
                                    }))}
                                    className="w-5 h-5 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                                  />
                                </div>
                                <div className="flex justify-center">
                                  <input
                                    type="checkbox"
                                    checked={menuItemMaterials[item.id]?.needsTexts ?? false}
                                    onChange={(e) => setMenuItemMaterials((prev) => ({
                                      ...prev,
                                      [item.id]: { ...prev[item.id], needsTexts: e.target.checked },
                                    }))}
                                    className="w-5 h-5 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                                  />
                                </div>
                                <div>
                                  <input
                                    type="text"
                                    value={menuItemMaterials[item.id]?.materialNotes ?? ""}
                                    onChange={(e) => setMenuItemMaterials((prev) => ({
                                      ...prev,
                                      [item.id]: { ...prev[item.id], materialNotes: e.target.value },
                                    }))}
                                    placeholder="z.B. Teamfotos, Produktbeschreibungen..."
                                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-cyan-500 focus:border-cyan-500"
                                  />
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Weitere Infos / Anmerkungen */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Weitere Hinweise / Anmerkungen
                  </h3>

                  <Textarea
                    value={step7Data.materialNotes}
                    onChange={(e) => setStep7Data({ ...step7Data, materialNotes: e.target.value })}
                    placeholder="Weitere Infos zum nachzureichenden Material, die keiner spezifischen Unterseite zugeordnet werden..."
                    className="min-h-[100px]"
                  />

                  {/* Checkboxen für allgemeines Material */}
                  <div className="flex flex-wrap gap-6 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={step7Data.materialNotesNeedsImages}
                        onChange={(e) => setStep7Data({ ...step7Data, materialNotesNeedsImages: e.target.checked })}
                        disabled={isLocked}
                        className="w-5 h-5 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Bilder benötigt</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={step7Data.materialNotesNeedsTexts}
                        onChange={(e) => setStep7Data({ ...step7Data, materialNotesNeedsTexts: e.target.checked })}
                        disabled={isLocked}
                        className="w-5 h-5 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{hasTextit ? "Stichpunkte" : "Texte"} benötigt</span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Für allgemeines Material, das nicht einer bestimmten Seite zugeordnet wird. Der Kunde kann über das Kundenportal entsprechende Texte einreichen.
                  </p>
                </div>

                {/* Frist */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Frist für Materialeinsendung
                  </h3>

                  <div className="max-w-xs">
                    <Input
                      type="date"
                      value={step7Data.materialDeadline}
                      onChange={(e) => setStep7Data({ ...step7Data, materialDeadline: e.target.value })}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Bis zu diesem Datum sollte das Material eingereicht werden.
                    </p>
                  </div>

                  {/* Hinweis-Box */}
                  <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="text-sm text-amber-700 dark:text-amber-300">
                        <p className="font-medium">Wichtiger Hinweis</p>
                        <p className="mt-1">Nur bei vollständigem Vorliegen aller Inhalte (siehe oben) kann mit der Bearbeitung des Projektes begonnen werden.</p>
                        <p className="mt-1">Bilder im Querformat, Auflösung mindestens 2560 x 1440 px.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-4">
                    <Button type="button" variant="outline" onClick={() => setCurrentStep(6)} className="gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                      </svg>
                      Zurück
                    </Button>
                    {saveMessage && (
                      <span className={`text-sm ${saveMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                        {saveMessage.text}
                      </span>
                    )}
                  </div>
                  <Button type="button" onClick={handleSaveStep7} disabled={isSaving || isLocked} className={savedSteps.has(7) ? "bg-green-600 hover:bg-green-700" : "bg-cyan-600 hover:bg-cyan-700"}>
                    {isSaving ? (
                      <>
                        <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Speichern...
                      </>
                    ) : savedSteps.has(7) ? (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Gespeichert
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Speichern
                      </>
                    )}
                  </Button>
                </div>

                {/* Übermittlung an Kunden - ganz am Ende */}
                <div className="mt-8 pt-6 border-t-2 border-gray-300 dark:border-gray-600">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 pb-4">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Übermittlung an Kunden
                  </h3>

                  {releaseData.releasedAt ? (
                    // Bereits übermittelt - Anzeige des Status
                    <div className="space-y-4">
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex gap-3">
                          <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="text-sm text-green-700 dark:text-green-300">
                            <p className="font-medium">An Kunden übermittelt</p>
                            <p className="mt-1">
                              am: {new Date(releaseData.releasedAt).toLocaleDateString("de-DE")} um: {new Date(releaseData.releasedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
                            </p>
                            <p>von: {releaseData.releasedByName}</p>
                          </div>
                        </div>
                      </div>
                      {/* Kundenbestätigung anzeigen */}
                      {webDoc.confirmedAt ? (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <div className="flex gap-3">
                            <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <div className="text-sm text-blue-700 dark:text-blue-300">
                              <p className="font-medium">Vom Kunden bestätigt</p>
                              <p className="mt-1">
                                am: {new Date(webDoc.confirmedAt).toLocaleDateString("de-DE")} um: {new Date(webDoc.confirmedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
                              </p>
                              <p>von: {webDoc.confirmedByName}</p>
                              {webDoc.confirmedByIp && (
                                <p className="text-blue-600 dark:text-blue-400">IP: {webDoc.confirmedByIp}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                          <div className="flex gap-3">
                            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="text-sm text-amber-700 dark:text-amber-300">
                              <p className="font-medium">Warte auf Kundenbestätigung</p>
                              <p className="mt-1">Der Kunde hat die Webdokumentation noch nicht bestätigt.</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {isAdmin && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            setIsReleasing(true);
                            try {
                              const result = await revokeWebDocumentationRelease(projectId);
                              if (result.success) {
                                setReleaseData({ releasedAt: null, releasedByName: null });
                              }
                            } finally {
                              setIsReleasing(false);
                            }
                          }}
                          disabled={isReleasing}
                          className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
                        >
                          {isReleasing ? "Wird zurückgezogen..." : "Übermittlung zurückziehen"}
                        </Button>
                      )}
                    </div>
                  ) : (
                    // Noch nicht übermittelt
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Die Webdokumentation wurde noch nicht an den Kunden übermittelt. Nach der Übermittlung wird sie im Kundenportal sichtbar.
                      </p>
                      <Button
                        type="button"
                        onClick={async () => {
                          setIsReleasing(true);
                          try {
                            const result = await releaseWebDocumentationForCustomer(projectId);
                            if (result.success && result.releasedAt && result.releasedByName) {
                              setReleaseData({
                                releasedAt: result.releasedAt,
                                releasedByName: result.releasedByName,
                              });
                            }
                          } finally {
                            setIsReleasing(false);
                          }
                        }}
                        disabled={isReleasing || !savedSteps.has(7)}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                      >
                        {isReleasing ? (
                          <>
                            <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Wird übermittelt...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            An Kunden übermitteln
                          </>
                        )}
                      </Button>
                      {!savedSteps.has(7) && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Bitte speichern Sie zuerst Schritt 7, bevor Sie die Webdokumentation übermitteln können.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </StepContent>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({
  number,
  title,
  shortTitle,
  active,
  saved,
  disabled,
  onClick,
}: {
  number: number;
  title: string;
  shortTitle: string;
  active: boolean;
  saved: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className={`flex flex-col items-center gap-1 md:gap-2 group relative ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
      title={disabled ? `Bitte zuerst Schritt ${number - 1} speichern` : title}
      disabled={disabled}
    >
      <div
        className={`flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full font-semibold transition ${
          saved
            ? "bg-green-500 dark:bg-green-600 text-white"
            : active
            ? "bg-cyan-100 dark:bg-cyan-900 text-cyan-600 dark:text-cyan-300 ring-2 ring-cyan-600 dark:ring-cyan-500"
            : disabled
            ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
            : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-gray-300 dark:group-hover:bg-gray-600"
        }`}
      >
        {saved ? (
          <svg className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : disabled ? (
          <svg className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        ) : (
          number
        )}
      </div>
      <span
        className={`text-[10px] md:text-xs font-medium text-center max-w-[60px] md:max-w-none ${
          saved
            ? "text-green-600 dark:text-green-400"
            : active
            ? "text-gray-900 dark:text-gray-100"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        <span className="hidden md:inline">{title}</span>
        <span className="md:hidden">{shortTitle}</span>
      </span>
    </button>
  );
}

function StepContent({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 md:p-6">
      <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">{title}</h2>
      {children}
    </div>
  );
}

// FormCard-Komponente für Schritt 5
function FormCard({
  form,
  isExpanded,
  isEditing,
  editingData,
  standardFields,
  isSaving,
  isLocked,
  onToggleExpand,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onEditingDataChange,
  onSaveFields,
  onSaveEmail,
  knownEmails,
}: {
  form: WebDocuForm;
  isExpanded: boolean;
  isEditing: boolean;
  editingData: { name: string; recipientEmail: string };
  standardFields: { type: WebDocuFormFieldType; label: string }[];
  knownEmails: { email: string; label: string }[];
  isSaving: boolean;
  isLocked: boolean;
  onToggleExpand: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onEditingDataChange: (data: { name: string; recipientEmail: string }) => void;
  onSaveFields: (
    selectedFields: { type: WebDocuFormFieldType; isRequired: boolean }[],
    customFields: { type: WebDocuFormFieldType; label: string; isRequired: boolean }[]
  ) => void;
  onSaveEmail: (email: string) => Promise<void>;
}) {
  // Lokaler State für Feldauswahl
  const [selectedFields, setSelectedFields] = useState<Map<WebDocuFormFieldType, { enabled: boolean; isRequired: boolean }>>(() => {
    const map = new Map<WebDocuFormFieldType, { enabled: boolean; isRequired: boolean }>();
    // Standard-Felder initialisieren
    standardFields.forEach((f) => {
      const existing = form.fields.find((ff) => ff.fieldType === f.type);
      map.set(f.type, {
        enabled: !!existing,
        isRequired: existing?.isRequired ?? false,
      });
    });
    return map;
  });

  const [customFields, setCustomFields] = useState<{ type: WebDocuFormFieldType; label: string; isRequired: boolean }[]>(() => {
    // Custom-Felder aus bestehenden Feldern extrahieren
    return form.fields
      .filter((f) => f.fieldType.startsWith("CUSTOM_"))
      .map((f) => ({
        type: f.fieldType as WebDocuFormFieldType,
        label: f.label || "",
        isRequired: f.isRequired,
      }));
  });

  const [newCustomFieldLabel, setNewCustomFieldLabel] = useState("");
  const [newCustomFieldType, setNewCustomFieldType] = useState<"CUSTOM_TEXT" | "CUSTOM_TEXTAREA" | "CUSTOM_CHECKBOX" | "CUSTOM_SELECT">("CUSTOM_TEXT");

  // Lokaler State für E-Mail-Adresse
  const [localEmail, setLocalEmail] = useState(form.recipientEmail || "");
  const [emailChanged, setEmailChanged] = useState(false);

  // E-Mail bei Form-Update aktualisieren
  useEffect(() => {
    setLocalEmail(form.recipientEmail || "");
    setEmailChanged(false);
  }, [form.recipientEmail]);

  // Felder bei Form-Update aktualisieren
  useEffect(() => {
    const map = new Map<WebDocuFormFieldType, { enabled: boolean; isRequired: boolean }>();
    standardFields.forEach((f) => {
      const existing = form.fields.find((ff) => ff.fieldType === f.type);
      map.set(f.type, {
        enabled: !!existing,
        isRequired: existing?.isRequired ?? false,
      });
    });
    setSelectedFields(map);

    setCustomFields(
      form.fields
        .filter((f) => f.fieldType.startsWith("CUSTOM_"))
        .map((f) => ({
          type: f.fieldType as WebDocuFormFieldType,
          label: f.label || "",
          isRequired: f.isRequired,
        }))
    );
  }, [form.fields, standardFields]);

  const handleToggleField = (type: WebDocuFormFieldType) => {
    const current = selectedFields.get(type) || { enabled: false, isRequired: false };
    setSelectedFields(new Map(selectedFields.set(type, { ...current, enabled: !current.enabled })));
  };

  const handleToggleRequired = (type: WebDocuFormFieldType) => {
    const current = selectedFields.get(type) || { enabled: false, isRequired: false };
    setSelectedFields(new Map(selectedFields.set(type, { ...current, isRequired: !current.isRequired })));
  };

  const handleAddCustomField = () => {
    if (!newCustomFieldLabel.trim()) return;
    setCustomFields([...customFields, { type: newCustomFieldType, label: newCustomFieldLabel.trim(), isRequired: false }]);
    setNewCustomFieldLabel("");
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleSaveEmail = async () => {
    await onSaveEmail(localEmail);
    setEmailChanged(false);
  };

  const handleSave = () => {
    const enabledStandardFields = Array.from(selectedFields.entries())
      .filter(([, value]) => value.enabled)
      .map(([type, value]) => ({ type, isRequired: value.isRequired }));
    onSaveFields(enabledStandardFields, customFields);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
          isExpanded ? "bg-gray-50 dark:bg-gray-700/50" : ""
        }`}
        onClick={() => !isEditing && onToggleExpand()}
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {isEditing ? (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Input
                value={editingData.name}
                onChange={(e) => onEditingDataChange({ ...editingData, name: e.target.value })}
                className="w-48"
                autoFocus
              />
              <Button size="sm" onClick={onSaveEdit}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
          ) : (
            <>
              <span className="font-medium text-gray-900 dark:text-white">{form.name}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                ({form.fields.length} {form.fields.length === 1 ? "Feld" : "Felder"})
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {!isEditing && !isLocked && (
            <>
              <button
                onClick={onStartEdit}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                title="Bearbeiten"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                title="Löschen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
          {/* Empfänger-E-Mail */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Empfänger-E-Mail-Adresse <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="flex-1 flex gap-2">
                <Input
                  value={localEmail}
                  disabled={isLocked}
                  onChange={(e) => {
                    setLocalEmail(e.target.value);
                    setEmailChanged(e.target.value !== (form.recipientEmail || ""));
                  }}
                  onBlur={() => {
                    // Automatisch speichern wenn Fokus verloren und geändert
                    if (emailChanged) {
                      handleSaveEmail();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && emailChanged) {
                      e.preventDefault();
                      handleSaveEmail();
                    }
                  }}
                  placeholder="empfaenger@firma.de"
                  className="flex-1"
                />
                {knownEmails.length > 0 && !isLocked && (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        setLocalEmail(e.target.value);
                        setEmailChanged(e.target.value !== (form.recipientEmail || ""));
                      }
                    }}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm min-w-[180px]"
                    title="Bekannte E-Mail-Adresse auswählen"
                  >
                    <option value="">Auswählen...</option>
                    {knownEmails.map((item, idx) => (
                      <option key={idx} value={item.email}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {emailChanged && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveEmail}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              An diese E-Mail-Adresse werden die Formulardaten gesendet
            </p>
          </div>

          {/* Standard-Felder */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Standard-Formularfelder
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {standardFields.map((field) => {
                const state = selectedFields.get(field.type) || { enabled: false, isRequired: false };
                return (
                  <div
                    key={field.type}
                    className={`flex items-center gap-2 p-2 border rounded-lg ${
                      state.enabled
                        ? "border-cyan-300 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-900/20"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={state.enabled}
                      disabled={isLocked}
                      onChange={() => handleToggleField(field.type)}
                      className="w-4 h-4 text-cyan-600 rounded disabled:opacity-50"
                    />
                    <span className="text-sm flex-1">{field.label}</span>
                    {state.enabled && !isLocked && (
                      <button
                        onClick={() => handleToggleRequired(field.type)}
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          state.isRequired
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                        title={state.isRequired ? "Pflichtfeld (klicken zum Ändern)" : "Optional (klicken zum Ändern)"}
                      >
                        {state.isRequired ? "*" : "opt"}
                      </button>
                    )}
                    {state.enabled && isLocked && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        state.isRequired
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                      }`}>
                        {state.isRequired ? "*" : "opt"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Individuelle Felder */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Individuelle Felder
            </label>
            {customFields.length > 0 && (
              <div className="space-y-2 mb-3">
                {customFields.map((field, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                      {field.type === "CUSTOM_TEXT" && "Text"}
                      {field.type === "CUSTOM_TEXTAREA" && "Textarea"}
                      {field.type === "CUSTOM_CHECKBOX" && "Checkbox"}
                      {field.type === "CUSTOM_SELECT" && "Dropdown"}
                    </span>
                    <span className="text-sm flex-1">{field.label}</span>
                    {!isLocked ? (
                      <>
                        <button
                          onClick={() => {
                            const updated = [...customFields];
                            updated[index] = { ...updated[index], isRequired: !updated[index].isRequired };
                            setCustomFields(updated);
                          }}
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            field.isRequired
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                              : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                          }`}
                        >
                          {field.isRequired ? "*" : "opt"}
                        </button>
                        <button
                          onClick={() => handleRemoveCustomField(index)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        field.isRequired
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                      }`}>
                        {field.isRequired ? "*" : "opt"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!isLocked && (
              <div className="flex gap-2">
                <select
                  value={newCustomFieldType}
                  onChange={(e) => setNewCustomFieldType(e.target.value as typeof newCustomFieldType)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
                >
                  <option value="CUSTOM_TEXT">Textfeld</option>
                  <option value="CUSTOM_TEXTAREA">Textarea</option>
                  <option value="CUSTOM_CHECKBOX">Checkbox</option>
                  <option value="CUSTOM_SELECT">Dropdown</option>
                </select>
                <Input
                  value={newCustomFieldLabel}
                  onChange={(e) => setNewCustomFieldLabel(e.target.value)}
                  placeholder="Feldbezeichnung"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomField();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddCustomField}
                  disabled={!newCustomFieldLabel.trim()}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </Button>
              </div>
            )}
          </div>

          {/* Speichern-Button */}
          <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={handleSave}
              disabled={isSaving || isLocked}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Speichern...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Felder speichern
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
