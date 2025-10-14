"use client";

import { useEffect } from "react";
import { createProject } from "./actions";

type Option = { value: string; label: string };

const PRIORITIES = ["NONE", "PRIO_1", "PRIO_2", "PRIO_3"] as const;
const CMS = ["SHOPWARE", "JOOMLA", "LOGO", "PRINT", "OTHER"] as const;
const PRODUCTION = ["NONE", "BEENDET", "MMW", "VOLLST_A_K"] as const;
const SEO = ["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA"] as const;
const TEXTIT = ["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA"] as const;
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
const SEO_OPTIONS: Option[] = SEO.map((value) => ({
  value,
  label: labelForSeoStatus(value),
}));
const TEXTIT_OPTIONS: Option[] = TEXTIT.map((value) => ({
  value,
  label: labelForTextitStatus(value),
}));

const FILM_SCOPE_LABELS: Record<FilmScope, string> = {
  FILM: "Film",
  DROHNE: "Drohne",
  NACHDREH: "Nachdreh",
  FILM_UND_DROHNE: "Film & Drohne",
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

const FILM_SCOPE_OPTIONS: Option[] = (Object.keys(FILM_SCOPE_LABELS) as FilmScope[]).map((value) => ({
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

  return (
    <form action={createProject} className="space-y-6" id="project-form">
      <div className="rounded border bg-gray-50 p-4">
        <fieldset className="flex flex-wrap gap-4">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Projekttyp auswählen *
          </legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="projectType" value="WEBSITE" className="h-4 w-4" required />
            <span>Nur Website</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="projectType" value="FILM" className="h-4 w-4" required />
            <span>Nur Film</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="projectType" value="BOTH" className="h-4 w-4" required />
            <span>Website + Film</span>
          </label>
        </fieldset>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 md:col-span-2 lg:col-span-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Kunde *</span>
          <select name="clientId" required defaultValue={clientIdFromQuery ?? ""} className="rounded border p-2">
            <option value="" disabled>
              Kunde wählen
            </option>
            {clientOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Projekttitel</span>
          <input name="title" className="rounded border p-2" placeholder="optional" />
        </label>
        <label className="website-agent-select flex flex-col gap-1 hidden">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Agent (Webseite)</span>
          <select name="agentId" defaultValue="" className="rounded border p-2">
            {websiteAgentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="film-agent-select flex flex-col gap-1 hidden">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Agent (Film)</span>
          <select name="agentId" defaultValue="" className="rounded border p-2">
            {filmAgentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="website-fields space-y-6 hidden">
        <h3 className="text-base font-semibold border-b pb-2">Website-Daten</h3>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Domain</span>
            <input name="domain" className="rounded border p-2" placeholder="optional" />
          </label>
          <SelectField name="priority" label="Priorität" options={PRIORITY_OPTIONS} defaultValue="NONE" />
          <SelectField name="cms" label="CMS" options={CMS_OPTIONS} defaultValue="JOOMLA" />
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">CMS (frei)</span>
            <input name="cmsOther" className="rounded border p-2" placeholder="optional" />
          </label>
          <SelectField name="pStatus" label="P-Status" options={PRODUCTION_OPTIONS} defaultValue="NONE" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DateField name="webDate" label="Webtermin" />
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
          <SelectField name="seo" label="SEO" options={SEO_OPTIONS} defaultValue="NEIN" />
          <SelectField name="textit" label="Textit" options={TEXTIT_OPTIONS} defaultValue="NEIN" />
          <SelectField name="accessible" label="Barrierefrei" options={TRI} defaultValue="unknown" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Demolink</span>
            <input name="demoLink" className="rounded border p-2" placeholder="https://..." />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Hinweise (Website)</span>
            <textarea name="websiteNote" rows={3} className="rounded border p-2" placeholder="optional" />
          </label>
        </div>
      </div>

      <div className="film-fields space-y-6 hidden">
        <h3 className="text-base font-semibold border-b pb-2">Film-Daten</h3>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SelectField name="scope" label="Umfang" options={FILM_SCOPE_OPTIONS} defaultValue="FILM" />
          <SelectField name="filmPriority" label="Prio / Nur Film" options={FILM_PRIORITY_OPTIONS} defaultValue="NONE" />
          <SelectField name="status" label="Status" options={FILM_STATUS_OPTIONS} defaultValue="AKTIV" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SelectField name="filmerId" label="Verantwortl. Filmer" options={personOptions} defaultValue="" />
          <SelectField name="cutterId" label="Cutter" options={personOptions} defaultValue="" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DateField name="contractStart" label="Vertragsbeginn" />
          <DateField name="scouting" label="Scouting" />
          <DateField name="scriptToClient" label="Skript an Kunden" />
          <DateField name="scriptApproved" label="Skriptfreigabe" />
          <DateField name="shootDate" label="Dreh- / Fototermin" />
          <DateField name="firstCutToClient" label="Vorabversion an Kunden" />
          <DateField name="finalToClient" label="Finalversion an Kunden" />
          <DateField name="filmOnlineDate" label="Online" />
          <DateField name="lastContact" label="Letzter Kontakt" />
          <DateField name="reminderAt" label="Wiedervorlage am" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Finalversion-Link</span>
            <input type="url" name="finalLink" className="rounded border p-2" placeholder="https://domain.tld/film" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Hauptlink (Online)</span>
            <input type="url" name="onlineLink" className="rounded border p-2" placeholder="https://domain.tld/live" />
          </label>
        </div>

        <div className="grid gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Hinweis (Film)</span>
            <textarea name="filmNote" rows={3} className="rounded border p-2" placeholder="optional" />
          </label>
        </div>
      </div>

      <FormActions saveLabel="Projekt speichern" />
    </form>
  );
}

function DateField({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <input type="date" name={name} className="rounded border p-2" />
    </label>
  );
}

function NumberField({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <input type="number" name={name} className="rounded border p-2" min={0} step={0.5} inputMode="decimal" />
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
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <select name={name} defaultValue={defaultValue} className="rounded border p-2">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormActions({ saveLabel }: { saveLabel: string }) {
  return (
    <div className="flex items-center justify-end gap-3">
      <Link href="/projects" className="rounded border px-4 py-2">
        Abbrechen
      </Link>
      <button type="submit" className="rounded bg-black px-4 py-2 text-white">
        {saveLabel}
      </button>
    </div>
  );
}
