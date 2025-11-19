"use client";

import { useState } from "react";
import { assignDomainToProject } from "./actions";

type OnlineProject = {
  id: string;
  title: string | null;
  domain: string | null;
};

type Props = {
  domain: string;
  onlineProjects: OnlineProject[];
};

export function DomainProjectAssignment({ domain, onlineProjects }: Props) {
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProjectId) {
      return;
    }

    setSaving(true);
    setResult(null);

    const formData = new FormData();
    formData.append("projectId", selectedProjectId);
    formData.append("domain", domain);

    // Get previous domain of selected project
    const selectedProject = onlineProjects.find(p => p.id === selectedProjectId);
    if (selectedProject?.domain) {
      formData.append("previousDomain", selectedProject.domain);
    }

    const response = await assignDomainToProject(formData);

    setSaving(false);
    setResult(response);

    if (response.success) {
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Projekt zuordnen
        </label>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          disabled={saving}
          className="w-full rounded border p-1.5 text-xs bg-white dark:bg-gray-800 text-foreground dark:text-white border-border dark:border-gray-600"
        >
          <option value="">-- Projekt auswählen --</option>
          {onlineProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
              {project.domain && project.domain !== domain ? ` (aktuell: ${project.domain})` : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedProjectId && (
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Zuordnen..." : "Zuordnen"}
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
