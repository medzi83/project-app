"use client";

import { useState } from "react";
import { assignDomainToProject } from "./actions";

type FroxlorDomain = {
  id: string;
  domain: string;
  deactivated?: string;
};

type ProjectWithDomain = {
  id: string;
  title: string | null;
  domain: string | null;
};

type Props = {
  projectId: string;
  currentDomain: string | null;
  availableDomains: FroxlorDomain[];
  standardSubdomain: string | null;
  allProjects: ProjectWithDomain[];
};

export function ProjectDomainAssignment({
  projectId,
  currentDomain,
  availableDomains,
  standardSubdomain,
  allProjects,
}: Props) {
  const [selectedDomain, setSelectedDomain] = useState(currentDomain || "");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Filter out standard subdomain from available domains
  const selectableDomains = availableDomains.filter(
    (d) => standardSubdomain && d.domain !== standardSubdomain
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setResult(null);

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("domain", selectedDomain);
    if (currentDomain) formData.append("previousDomain", currentDomain);

    const response = await assignDomainToProject(formData);

    setSaving(false);
    setResult(response);

    if (response.success) {
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };

  // Check if selected domain is assigned to another project
  const getDomainWarning = (domain: string) => {
    const assignedProject = allProjects.find(
      (p) => p.domain === domain && p.id !== projectId
    );
    if (assignedProject) {
      return `⚠️ Aktuell zugeordnet zu: ${assignedProject.title}`;
    }
    return null;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Domain zuordnen
        </label>
        <select
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
          disabled={saving}
          className="w-full rounded border p-2 text-sm"
        >
          <option value="">Keine Domain zugeordnet</option>
          {selectableDomains.map((domain) => (
            <option key={domain.id} value={domain.domain}>
              {domain.domain}
              {domain.deactivated === "1" ? " (deaktiviert)" : ""}
            </option>
          ))}
        </select>

        {selectedDomain && getDomainWarning(selectedDomain) && (
          <div className="mt-1 text-xs text-orange-600">
            {getDomainWarning(selectedDomain)}
          </div>
        )}
      </div>

      {selectedDomain !== (currentDomain || "") && (
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Speichere..." : "Domain zuordnen"}
        </button>
      )}

      {result && (
        <div
          className={`rounded p-2 text-xs ${
            result.success
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          {result.message}
        </div>
      )}
    </form>
  );
}
