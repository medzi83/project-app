"use client";

import { useState } from "react";

type Template = {
  id: string;
  title: string;
};

type TriggerFormProps = {
  action: (formData: FormData) => void;
  templates: Template[];
  trigger?: {
    id: string;
    name: string;
    description: string | null;
    active: boolean;
    triggerType: string;
    projectType: string | null;
    templateId: string;
    delayDays: number | null;
    delayType: string | null;
    conditions: unknown;
    recipientConfig: unknown;
  };
};

export function TriggerForm({ action, templates, trigger }: TriggerFormProps) {
  const conditions = trigger?.conditions as Record<string, unknown> | undefined;
  const recipientConfig = trigger?.recipientConfig as Record<string, unknown> | undefined;
  const ccList = (recipientConfig?.cc as string[]) || [];

  const [triggerType, setTriggerType] = useState(trigger?.triggerType || "DATE_FIELD_SET");
  const [projectType, setProjectType] = useState(trigger?.projectType || "");

  return (
    <form action={action} className="space-y-4">
      {trigger && <input type="hidden" name="id" value={trigger.id} />}

      {/* Basis-Informationen */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input
            name="name"
            required
            defaultValue={trigger?.name}
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="z.B. Demo-Termin gesetzt"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Beschreibung</label>
          <textarea
            name="description"
            defaultValue={trigger?.description || ""}
            rows={2}
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="Optionale Beschreibung"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              name="active"
              defaultValue={trigger?.active ? "yes" : "no"}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="yes">Aktiv</option>
              <option value="no">Inaktiv</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Trigger-Typ *</label>
            <select
              name="triggerType"
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value)}
              required
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="DATE_FIELD_SET">Datumsfeld gesetzt</option>
              <option value="DATE_REACHED">Datum erreicht</option>
              <option value="CONDITION_MET">Bedingung erfüllt</option>
              <option value="MANUAL">Manuell</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Projekttyp (optional)</label>
          <select
            name="projectType"
            value={projectType}
            onChange={(e) => setProjectType(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          >
            <option value="">Alle Projekttypen</option>
            <option value="WEBSITE">Website</option>
            <option value="FILM">Film</option>
            <option value="SOCIAL">Social Media</option>
          </select>
        </div>
      </div>

      {/* Bedingungen */}
      <div className="border-t pt-4">
        <h4 className="font-medium mb-3">Bedingungen</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Feld</label>
            <select
              name="conditionField"
              defaultValue={(conditions?.field as string) || ""}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">Bitte wählen</option>
              {projectType === "WEBSITE" && (
                <>
                  <option value="demoDate">Demo-Datum</option>
                  <option value="webDate">Web-Termin</option>
                  <option value="onlineDate">Online-Datum</option>
                </>
              )}
              {projectType === "FILM" && (
                <>
                  <option value="scriptToClient">Skript an Kunde</option>
                  <option value="scriptApproved">Skript freigegeben</option>
                  <option value="shootDate">Dreh-Datum</option>
                  <option value="firstCutToClient">Erster Schnitt an Kunde</option>
                  <option value="finalToClient">Final an Kunde</option>
                </>
              )}
              {!projectType && (
                <>
                  <option value="demoDate">Demo-Datum (Website)</option>
                  <option value="webDate">Web-Termin (Website)</option>
                  <option value="scriptToClient">Skript an Kunde (Film)</option>
                  <option value="shootDate">Dreh-Datum (Film)</option>
                </>
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Operator</label>
              <select
                name="conditionOperator"
                defaultValue={(conditions?.operator as string) || "SET"}
                className="w-full rounded border px-3 py-2 text-sm"
              >
                <option value="SET">Wurde gesetzt</option>
                <option value="REACHED">Datum erreicht</option>
                <option value="NOT_SET_AFTER_DAYS">Nicht gesetzt nach X Tagen</option>
                <option value="EQUALS">Ist gleich</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Prüffeld (optional)</label>
              <select
                name="conditionCheckField"
                defaultValue={(conditions?.checkField as string) || ""}
                className="w-full rounded border px-3 py-2 text-sm"
              >
                <option value="">Keins</option>
                {projectType === "FILM" && (
                  <>
                    <option value="scriptApproved">Skript freigegeben</option>
                    <option value="firstCutToClient">Erster Schnitt an Kunde</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tage für Bedingung</label>
            <input
              name="conditionDays"
              type="number"
              defaultValue={(conditions?.days as number) || ""}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="z.B. 7"
            />
          </div>
        </div>
      </div>

      {/* Zeitverzögerung */}
      <div className="border-t pt-4">
        <h4 className="font-medium mb-3">Zeitverzögerung</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Tage</label>
            <input
              name="delayDays"
              type="number"
              defaultValue={trigger?.delayDays || ""}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Typ</label>
            <select
              name="delayType"
              defaultValue={trigger?.delayType || "EXACT"}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="EXACT">Genau am Tag</option>
              <option value="AFTER">Nach dem Tag</option>
              <option value="BEFORE">Vor dem Tag</option>
            </select>
          </div>
        </div>
      </div>

      {/* Template-Auswahl */}
      <div className="border-t pt-4">
        <h4 className="font-medium mb-3">E-Mail Template *</h4>
        <select
          name="templateId"
          required
          defaultValue={trigger?.templateId}
          className="w-full rounded border px-3 py-2 text-sm"
        >
          <option value="">Bitte wählen</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.title}
            </option>
          ))}
        </select>
      </div>

      {/* Empfänger-Konfiguration */}
      <div className="border-t pt-4">
        <h4 className="font-medium mb-3">Empfänger *</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">An</label>
            <select
              name="recipientTo"
              required
              defaultValue={(recipientConfig?.to as string) || "CLIENT"}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="CLIENT">Kunde (Kontakt-E-Mail)</option>
              <option value="AGENT">Agent</option>
              <option value="FILMER">Filmer</option>
              <option value="CUTTER">Cutter</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">CC (Kopie an)</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="recipientCcAgent"
                  value="yes"
                  defaultChecked={ccList.includes("AGENT")}
                  className="rounded"
                />
                <span className="text-sm">Agent</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="recipientCcFilmer"
                  value="yes"
                  defaultChecked={ccList.includes("FILMER")}
                  className="rounded"
                />
                <span className="text-sm">Filmer</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="recipientCcCutter"
                  value="yes"
                  defaultChecked={ccList.includes("CUTTER")}
                  className="rounded"
                />
                <span className="text-sm">Cutter</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="w-full rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90"
      >
        {trigger ? "Trigger aktualisieren" : "Trigger erstellen"}
      </button>
    </form>
  );
}
