"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EmailConfirmationDialog } from "@/components/EmailConfirmationDialog";

type Option = { value: string; label: string };

const PRIORITIES = ["NONE", "PRIO_1", "PRIO_2", "PRIO_3"] as const;
const CMS = ["SHOPWARE", "JOOMLA", "LOGO", "PRINT", "OTHER"] as const;
const PRODUCTION = ["NONE", "BEENDET", "MMW", "VOLLST_A_K"] as const;
const SEO = ["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA", "JA"] as const;
const TEXTIT = ["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA", "JA"] as const;
const WEBTERMIN_TYPES: Option[] = [
  { value: "", label: "(nicht gesetzt)" },
  { value: "TELEFONISCH", label: "Telefonisch" },
  { value: "BEIM_KUNDEN", label: "Beim Kunden" },
  { value: "IN_DER_AGENTUR", label: "In der Agentur" },
];
const TRI: Option[] = [
  { value: "unknown", label: "(nicht gesetzt)" },
  { value: "yes", label: "Ja" },
  { value: "no", label: "Nein" },
];

import type { FilmPriority, FilmProjectStatus, FilmScope } from "@prisma/client";
import {
  labelForProductionStatus,
  labelForMaterialStatus,
  MATERIAL_STATUS_VALUES,
  labelForWebsitePriority,
  labelForSeoStatus,
  labelForTextitStatus,
} from "@/lib/project-status";
import Link from "next/link";

const MATERIAL_STATUS_OPTIONS: Option[] = MATERIAL_STATUS_VALUES.map((value) => ({
  value,
  label: labelForMaterialStatus(value),
}));

const PRIORITY_OPTIONS: Option[] = PRIORITIES.map((value) => ({
  value,
  label: labelForWebsitePriority(value),
}));
const CMS_OPTIONS: Option[] = CMS.map((value) => ({
  value,
  label: value === "SHOPWARE" ? "Shop" : value,
}));
const PRODUCTION_OPTIONS: Option[] = PRODUCTION.map((value) => ({
  value,
  label: labelForProductionStatus(value),
}));
const SEO_OPTIONS: Option[] = [
  { value: "", label: "(leer)" },
  ...SEO.map((value) => ({
    value,
    label: labelForSeoStatus(value),
  }))
];
const TEXTIT_OPTIONS: Option[] = [
  { value: "", label: "(leer)" },
  ...TEXTIT.map((value) => ({
    value,
    label: labelForTextitStatus(value),
  }))
];

const FILM_SCOPE_LABELS: Record<FilmScope, string> = {
  FILM: "Film",
  DROHNE: "Drohne",
  NACHDREH: "Nachdreh",
  FILM_UND_DROHNE: "Film & Drohne",
  FOTO: "Foto",
  GRAD_360: "360°",
  K_A: "k.A.",
};
const FILM_PRIORITY_LABELS: Record<FilmPriority, string> = {
  NONE: "-",
  FILM_SOLO: "Film solo",
  PRIO_1: "Prio 1",
  PRIO_2: "Prio 2",
};
const FILM_STATUS_LABELS: Record<FilmProjectStatus, string> = {
  AKTIV: "aktiv",
  BEENDET: "beendet",
  WARTEN: "warten",
  VERZICHT: "verzicht",
  MMW: "MMW",
};

const FILM_SCOPE_OPTIONS: Option[] = (Object.keys(FILM_SCOPE_LABELS) as FilmScope[])
  .filter((value) => value !== "K_A")
  .map((value) => ({
    value,
    label: FILM_SCOPE_LABELS[value],
  }));
const FILM_PRIORITY_OPTIONS: Option[] = (Object.keys(FILM_PRIORITY_LABELS) as FilmPriority[]).map((value) => ({
  value,
  label: FILM_PRIORITY_LABELS[value],
}));
const FILM_STATUS_OPTIONS: Option[] = (Object.keys(FILM_STATUS_LABELS) as FilmProjectStatus[]).map((value) => ({
  value,
  label: FILM_STATUS_LABELS[value],
}));

export function UnifiedProjectForm({
  clientOptions,
  websiteAgentOptions,
  filmAgentOptions,
  personOptions,
  clientIdFromQuery,
}: {
  clientOptions: Option[];
  websiteAgentOptions: Option[];
  filmAgentOptions: Option[];
  personOptions: Option[];
  clientIdFromQuery?: string;
}) {
  const router = useRouter();
  const [selectedClient, setSelectedClient] = useState<string>(clientIdFromQuery || "");
  const [projectTypes, setProjectTypes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [emailQueueIds, setEmailQueueIds] = useState<string[]>([]);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);

  // Handler for checkbox changes
  const handleProjectTypeChange = (type: string, checked: boolean) => {
    setProjectTypes(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(type);
      } else {
        newSet.delete(type);
      }
      return newSet;
    });
  };

  // Filter clients based on search query
  const filteredClients = searchQuery.trim()
    ? clientOptions.filter((client) =>
        client.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : clientOptions;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.client-search-container')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const form = document.getElementById("project-form");
    if (!form) return;

    const radios = form.querySelectorAll('input[name="projectType"]');
    const websiteFields = form.querySelector(".website-fields") as Element | null;
    const filmFields = form.querySelector(".film-fields") as Element | null;
    const websiteAgentSelect = form.querySelector(".website-agent-select") as Element | null;
    const filmAgentSelect = form.querySelector(".film-agent-select") as Element | null;

    if (!websiteFields || !filmFields || !websiteAgentSelect || !filmAgentSelect) return;

    // Store as non-null for closure
    const wf = websiteFields;
    const ff = filmFields;
    const was = websiteAgentSelect;
    const fas = filmAgentSelect;

    function updateVisibility() {
      if (!form) return;
      const selected = form.querySelector('input[name="projectType"]:checked') as HTMLInputElement | null;
      if (!selected) {
        wf.classList.add("hidden");
        ff.classList.add("hidden");
        was.classList.add("hidden");
        fas.classList.add("hidden");
        return;
      }

      const value = selected.value;
      if (value === "WEBSITE") {
        wf.classList.remove("hidden");
        ff.classList.add("hidden");
        was.classList.remove("hidden");
        fas.classList.add("hidden");
      } else if (value === "FILM") {
        wf.classList.add("hidden");
        ff.classList.remove("hidden");
        was.classList.add("hidden");
        fas.classList.remove("hidden");
      } else if (value === "BOTH") {
        wf.classList.remove("hidden");
        ff.classList.remove("hidden");
        was.classList.remove("hidden");
        fas.classList.add("hidden");
      }
    }

    radios.forEach((radio) => {
      radio.addEventListener("change", updateVisibility);
    });

    updateVisibility();

    return () => {
      radios.forEach((radio) => {
        radio.removeEventListener("change", updateVisibility);
      });
    };
  }, []);

  // Get selected client label for display
  const selectedClientLabel = selectedClient
    ? clientOptions.find(c => c.value === selectedClient)?.label || ""
    : "";

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const data: Record<string, string | File> = {};

      // Collect all form data
      formData.forEach((value, key) => {
        data[key] = value;
      });

      // Add selected project types
      data.selectedProjectTypes = JSON.stringify(Array.from(projectTypes));

      // Call API
      const response = await fetch("/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Fehler: ${error.error || "Projekt konnte nicht angelegt werden"}`);
        setIsSubmitting(false);
        return;
      }

      const result = await response.json();
      setCreatedClientId(result.clientId);

      // If there are email queue IDs, show the email dialog
      if (result.queueIds && result.queueIds.length > 0) {
        setEmailQueueIds(result.queueIds);
      } else {
        // No emails to send, redirect directly
        router.push(`/clients/${result.clientId}`);
      }
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
      setIsSubmitting(false);
    }
  };

  // Handle email dialog completion
  const handleEmailComplete = () => {
    if (createdClientId) {
      router.push(`/clients/${createdClientId}`);
    }
  };

  return (
    <>
      {/* Email Confirmation Dialog */}
      {emailQueueIds.length > 0 && (
        <EmailConfirmationDialog
          queueIds={emailQueueIds}
          onComplete={handleEmailComplete}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-8" id="project-form">
        {/* Hidden field for selected project types */}
        <input type="hidden" name="selectedProjectTypes" value={JSON.stringify(Array.from(projectTypes))} />

      {/* Schritt 1: Kundenauswahl mit Live-Suche */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black dark:bg-blue-600 text-white font-semibold">
            1
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Kunde suchen und auswählen</h3>
        </div>

        <div className="ml-11 space-y-4">
          <div className="relative client-search-container">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                Kunde suchen (nach Name oder Kundennummer) *
              </span>
              <input
                type="text"
                value={selectedClient ? selectedClientLabel : searchQuery}
                onChange={(e) => {
                  if (selectedClient) {
                    // Clear selection when user starts typing again
                    setSelectedClient("");
                  }
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Tippe, um zu suchen..."
                className="rounded border p-2 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                autoComplete="off"
              />
            </label>

            {/* Hidden input for form submission */}
            <input type="hidden" name="clientId" value={selectedClient} required />

            {/* Dropdown with filtered results */}
            {showDropdown && !selectedClient && searchQuery && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg max-h-60 overflow-auto">
                {filteredClients.length > 0 ? (
                  <ul className="py-1">
                    {filteredClients.slice(0, 20).map((option) => (
                      <li
                        key={option.value}
                        onClick={() => {
                          setSelectedClient(option.value);
                          setSearchQuery("");
                          setShowDropdown(false);
                        }}
                        className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-900 dark:text-white"
                      >
                        {option.label}
                      </li>
                    ))}
                    {filteredClients.length > 20 && (
                      <li className="px-4 py-2 text-sm text-muted-foreground dark:text-gray-400 italic">
                        ... und {filteredClients.length - 20} weitere. Verfeinere deine Suche.
                      </li>
                    )}
                  </ul>
                ) : (
                  <div className="px-4 py-3 text-sm text-muted-foreground dark:text-gray-400">
                    Keine Kunden gefunden. Versuche einen anderen Suchbegriff.
                  </div>
                )}
              </div>
            )}

            {/* Show all clients when focused but no search query */}
            {showDropdown && !selectedClient && !searchQuery && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg max-h-60 overflow-auto">
                <ul className="py-1">
                  {clientOptions.slice(0, 20).map((option) => (
                    <li
                      key={option.value}
                      onClick={() => {
                        setSelectedClient(option.value);
                        setShowDropdown(false);
                      }}
                      className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-900 dark:text-white"
                    >
                      {option.label}
                    </li>
                  ))}
                  {clientOptions.length > 20 && (
                    <li className="px-4 py-2 text-sm text-muted-foreground dark:text-gray-400 italic">
                      ... und {clientOptions.length - 20} weitere. Nutze die Suche.
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Selected client display */}
          {selectedClient && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded">
              <span className="text-sm font-medium text-green-900 dark:text-green-200">
                ✓ Ausgewählt: {selectedClientLabel}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedClient("");
                  setSearchQuery("");
                }}
                className="ml-auto text-sm text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100 underline"
              >
                Ändern
              </button>
            </div>
          )}

          {!selectedClient && (
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              💡 Kunde nicht in der Liste? Lege zuerst oben einen neuen Kunden an.
            </p>
          )}
        </div>
      </div>

      {/* Schritt 2: Projekttyp (nur sichtbar wenn Kunde ausgewählt) */}
      {selectedClient && (
        <>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black dark:bg-blue-600 text-white font-semibold">
                2
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Projekttyp auswählen</h3>
            </div>

            <div className="ml-11">
              <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
                <fieldset className="flex flex-wrap gap-4">
                  <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                    Welche Art(en) von Projekt? (Mehrfachauswahl möglich) *
                  </legend>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="projectTypes"
                      value="WEBSITE"
                      className="h-4 w-4"
                      checked={projectTypes.has("WEBSITE")}
                      onChange={(e) => handleProjectTypeChange("WEBSITE", e.target.checked)}
                    />
                    <span className="font-medium text-gray-900 dark:text-white">Website</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="projectTypes"
                      value="FILM"
                      className="h-4 w-4"
                      checked={projectTypes.has("FILM")}
                      onChange={(e) => handleProjectTypeChange("FILM", e.target.checked)}
                    />
                    <span className="font-medium text-gray-900 dark:text-white">Film</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="projectTypes"
                      value="SOCIAL_MEDIA"
                      className="h-4 w-4"
                      checked={projectTypes.has("SOCIAL_MEDIA")}
                      onChange={(e) => handleProjectTypeChange("SOCIAL_MEDIA", e.target.checked)}
                    />
                    <span className="font-medium text-gray-900 dark:text-white">Social Media</span>
                  </label>
                </fieldset>
                {projectTypes.size === 0 && (
                  <p className="mt-3 text-sm text-muted-foreground dark:text-gray-400">
                    Wähle mindestens einen Projekttyp aus.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Schritt 3: Projektdetails (nur sichtbar wenn mindestens ein Projekttyp ausgewählt) */}
          {projectTypes.size > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black dark:bg-blue-600 text-white font-semibold">
                  3
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Projektdetails</h3>
              </div>

              <div className="ml-11 space-y-6">
                {/* Gemeinsame Felder für alle Projekttypen */}
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Projekttitel</span>
                    <input name="title" className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" placeholder="z.B. Restaurant, Warteseite, 2. Demo" />
                    <p className="text-xs text-muted-foreground dark:text-gray-400 mt-1">
                      💡 Optionale Kurzbeschreibung des Projekts zur besseren Übersicht
                    </p>
                  </label>
                </div>

                {/* Website-spezifische Schnellfelder */}
                {projectTypes.has("WEBSITE") && (
                  <div className="rounded-lg border bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200">Wichtige Website-Infos</h4>
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
                      <SelectField name="websiteAgentId" label="Agent" options={websiteAgentOptions} defaultValue="" />
                      <SelectField name="cms" label="CMS *" options={CMS_OPTIONS} defaultValue="JOOMLA" />
                      <SelectField name="seo" label="SEO *" options={SEO_OPTIONS} defaultValue="" />
                      <SelectField name="textit" label="Texte vorhanden?" options={TEXTIT_OPTIONS} defaultValue="" />
                      <div className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Webtermin (Datum + Zeit)</span>
                        <input type="datetime-local" name="webDate" className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" />
                      </div>
                      <SelectField name="webterminType" label="Art des Termins" options={WEBTERMIN_TYPES} defaultValue="" />
                    </div>
                    <div className="pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" name="isRelaunch" className="h-4 w-4 rounded border-gray-300 dark:border-gray-600" />
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-200">Als Relaunch kennzeichnen</span>
                      </label>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 ml-6">Relaunch-Projekte werden in der Tabelle mit einem &quot;RL&quot;-Badge markiert</p>
                    </div>
                  </div>
                )}

                {/* Film-spezifische Schnellfelder */}
                {projectTypes.has("FILM") && (
                  <div className="rounded-lg border bg-purple-50 dark:bg-purple-900/20 dark:border-purple-700 p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-200">Wichtige Film-Infos</h4>
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                      <SelectField name="filmAgentId" label="Agent" options={filmAgentOptions} defaultValue="" />
                      <SelectField name="scope" label="Umfang *" options={FILM_SCOPE_OPTIONS} defaultValue="FILM" />
                      <div className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Scouting (Datum + Zeit)</span>
                        <input type="datetime-local" name="scouting" className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Social-Media-spezifische Schnellfelder */}
                {projectTypes.has("SOCIAL_MEDIA") && (
                  <div className="rounded-lg border bg-green-50 dark:bg-green-900/20 dark:border-green-700 p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-green-900 dark:text-green-200">Wichtige Social-Media-Infos</h4>
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                      <SelectField name="socialAgentId" label="Agent" options={websiteAgentOptions} defaultValue="" />
                      <label className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Plattformen</span>
                        <input name="socialPlatforms" className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" placeholder="z.B. Instagram, Facebook" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Posting-Frequenz</span>
                        <input name="socialFrequency" className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" placeholder="z.B. täglich, wöchentlich" />
                      </label>
                    </div>
                  </div>
                )}

                {/* Hinweis auf weitere Felder */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
                  <p className="text-sm text-muted-foreground dark:text-gray-400">
                    💡 Weitere Details kannst du nach dem Anlegen auf der Projektseite ergänzen.
                  </p>
                </div>

                {/* Versteckte zusätzliche Felder - werden vom useEffect-Handler ein/ausgeblendet */}
                <div className="website-fields space-y-6 hidden">
                  <h3 className="text-base font-semibold border-b border-gray-200 dark:border-gray-700 pb-2 text-gray-900 dark:text-white">Weitere Website-Details (optional)</h3>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Domain</span>
                      <input name="domain" className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" placeholder="optional" />
                    </label>
                    <SelectField name="priority" label="Priorität" options={PRIORITY_OPTIONS} defaultValue="NONE" />
                    <label className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">CMS (frei)</span>
                      <input name="cmsOther" className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" placeholder="optional" />
                    </label>
                    <SelectField name="pStatus" label="P-Status" options={PRODUCTION_OPTIONS} defaultValue="NONE" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <SelectField name="webterminType" label="Art des Webtermins" options={WEBTERMIN_TYPES} defaultValue="" />
                    <DateField name="demoDate" label="Demo an Kunden" />
                    <DateField name="onlineDate" label="Online" />
                    <DateField name="lastMaterialAt" label="Letzter Materialeingang" />
                    <NumberField name="effortBuildMin" label="Aufwand Umsetzung (Stunden)" />
                    <NumberField name="effortDemoMin" label="Aufwand Demo (Stunden)" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <SelectField
                      name="materialStatus"
                      label="Material"
                      options={MATERIAL_STATUS_OPTIONS}
                      defaultValue="ANGEFORDERT"
                    />
                    <SelectField name="seo" label="SEO" options={SEO_OPTIONS} defaultValue="" />
                    <SelectField name="accessible" label="Barrierefrei" options={TRI} defaultValue="unknown" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Demolink</span>
                      <input name="demoLink" className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" placeholder="https://..." />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Hinweise (Website)</span>
                      <textarea name="websiteNote" rows={3} className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" placeholder="optional" />
                    </label>
                  </div>
                </div>

                <div className="film-fields space-y-6 hidden">
                  <h3 className="text-base font-semibold border-b border-gray-200 dark:border-gray-700 pb-2 text-gray-900 dark:text-white">Weitere Film-Details (optional)</h3>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <SelectField name="filmPriority" label="Prio / Nur Film" options={FILM_PRIORITY_OPTIONS} defaultValue="NONE" />
                    <SelectField name="status" label="Status" options={FILM_STATUS_OPTIONS} defaultValue="AKTIV" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <SelectField name="filmerId" label="Verantwortl. Filmer" options={personOptions} defaultValue="" />
                    <SelectField name="cutterId" label="Cutter" options={personOptions} defaultValue="" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <DateField name="contractStart" label="Vertragsbeginn" />
                    <DateField name="scriptToClient" label="Skript an Kunden" />
                    <DateField name="scriptApproved" label="Skriptfreigabe" />
                    <DateField name="shootDate" label="Dreh- / Fototermin" />
                    <DateField name="firstCutToClient" label="Vorabversion an Kunden" />
                    <DateField name="finalToClient" label="Finalversion an Kunden" />
                    <DateField name="filmOnlineDate" label="Online" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Finalversion-Link</span>
                      <input type="url" name="finalLink" className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" placeholder="https://domain.tld/film" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Hauptlink (Online)</span>
                      <input type="url" name="onlineLink" className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" placeholder="https://domain.tld/live" />
                    </label>
                  </div>

                  <div className="grid gap-4">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Hinweis (Film)</span>
                      <textarea name="filmNote" rows={3} className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" placeholder="optional" />
                    </label>
                  </div>

                  {/* Versteckte Felder für Backend (werden nicht im UI angezeigt) */}
                  <input type="hidden" name="lastContact" value="" />
                  <input type="hidden" name="reminderAt" value="" />
                </div>

                <FormActions saveLabel="Projekt speichern" isSubmitting={isSubmitting} />
              </div>
            </div>
          )}
        </>
      )}
      </form>
    </>
  );
}

function DateField({ name, label }: { name: string; label: string }) {
  return label ? (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">{label}</span>
      <input type="date" name={name} className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" />
    </label>
  ) : (
    <input type="date" name={name} className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" />
  );
}

function NumberField({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">{label}</span>
      <input type="number" name={name} className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" min={0} step={0.5} inputMode="decimal" />
    </label>
  );
}

function SelectField({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: Option[];
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">{label}</span>
      <select name={name} defaultValue={defaultValue} className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormActions({ saveLabel, isSubmitting }: { saveLabel: string; isSubmitting?: boolean }) {
  return (
    <div className="flex items-center justify-end gap-3">
      <Link href="/projects" className="rounded border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
        Abbrechen
      </Link>
      <button
        type="submit"
        className="rounded bg-black dark:bg-blue-600 px-4 py-2 text-white hover:bg-gray-800 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Wird gespeichert..." : saveLabel}
      </button>
    </div>
  );
}
