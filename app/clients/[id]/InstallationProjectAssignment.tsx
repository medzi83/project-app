"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectStatus, ProductionStatus, MaterialStatus } from "@prisma/client";

type Project = {
  id: string;
  title: string | null;
  type: string;
  status: ProjectStatus;
  website?: {
    pStatus: ProductionStatus;
    webDate?: Date | string | null;
    demoDate?: Date | string | null;
    onlineDate?: Date | string | null;
    materialStatus: MaterialStatus;
  } | null;
};

type Props = {
  installationId: string;
  clientProjects: Project[];
  currentProjectId?: string | null;
};

// Helper functions from the main page
const deriveProjectStatus = (website?: {
  pStatus: ProductionStatus;
  webDate?: Date | string | null;
  demoDate?: Date | string | null;
  onlineDate?: Date | string | null;
  materialStatus: MaterialStatus;
} | null): ProjectStatus => {
  if (!website) return "WEBTERMIN" as ProjectStatus;

  if (website.pStatus === "BEENDET") return "ONLINE";
  if (website.onlineDate) return "ONLINE";
  if (website.demoDate) return "DEMO";
  if (website.materialStatus === "VOLLSTAENDIG") return "UMSETZUNG";
  if (website.materialStatus === "TEILWEISE") return "MATERIAL";
  if (website.webDate) return "MATERIAL";

  return "WEBTERMIN" as ProjectStatus;
};

const labelForProjectStatus = (
  status: ProjectStatus,
  website?: { pStatus: ProductionStatus } | null
): string => {
  if (status === "ONLINE") {
    if (website?.pStatus === "BEENDET") return "Beendet";
    if (website?.pStatus === "MMW") return "Online (MMW)";
    if (website?.pStatus === "VOLLST_A_K") return "Online (vollst. a.K.)";
    return "Online";
  }

  const labels: Record<ProjectStatus, string> = {
    WEBTERMIN: "Webtermin",
    MATERIAL: "Material",
    UMSETZUNG: "Umsetzung",
    DEMO: "Demo",
    ONLINE: "Online",
  };

  return labels[status] || status;
};

const toDate = (value?: Date | string | null) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getWebsiteStatusDate = (
  status: ProjectStatus,
  website?: {
    webDate?: Date | string | null;
    demoDate?: Date | string | null;
    onlineDate?: Date | string | null;
  } | null
) => {
  if (!website) return null;
  switch (status) {
    case "WEBTERMIN":
      return toDate(website.webDate);
    case "MATERIAL":
    case "UMSETZUNG":
      return toDate(website.webDate);
    case "DEMO":
      return toDate(website.demoDate) ?? toDate(website.webDate);
    case "ONLINE":
      return toDate(website.onlineDate);
    default:
      return null;
  }
};

const formatDateOnly = (value?: Date | string | null) => {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium"
    }).format(new Date(value));
  } catch {
    return null;
  }
};

export function InstallationProjectAssignment({
  installationId,
  clientProjects,
  currentProjectId,
}: Props) {
  const router = useRouter();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    currentProjectId || ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAssign = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/joomla-installations/${installationId}/assign-project`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: selectedProjectId || null,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Zuordnen");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Zuordnen");
    } finally {
      setSaving(false);
    }
  };

  const hasChanged = selectedProjectId !== (currentProjectId || "");
  const [showDropdown, setShowDropdown] = useState(false);

  const handleRemove = async () => {
    if (!confirm("Möchten Sie die Projektzuordnung wirklich entfernen?")) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/joomla-installations/${installationId}/assign-project`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: null,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Entfernen");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Entfernen");
    } finally {
      setSaving(false);
    }
  };

  // If project is assigned, show remove button
  if (currentProjectId && !showDropdown) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleRemove}
          disabled={saving}
          className="text-xs px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 rounded hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 whitespace-nowrap font-medium"
        >
          {saving ? "Entfernen..." : "Projektzuordnung entfernen"}
        </button>
        <button
          onClick={() => setShowDropdown(true)}
          disabled={saving}
          className="text-xs px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
        >
          Ändern
        </button>
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>
    );
  }

  // Show dropdown for assigning/changing project
  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedProjectId}
        onChange={(e) => setSelectedProjectId(e.target.value)}
        className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 flex-1 min-w-0"
        disabled={saving}
      >
        <option value="">Kein Projekt zugeordnet</option>
        {clientProjects.map((project) => {
          const derivedStatus = project.website
            ? deriveProjectStatus(project.website)
            : project.status;
          const statusLabel = labelForProjectStatus(derivedStatus, project.website);
          const statusDate = getWebsiteStatusDate(derivedStatus, project.website);
          const formattedDate = statusDate ? formatDateOnly(statusDate) : null;

          return (
            <option key={project.id} value={project.id}>
              {project.title} - {statusLabel}{formattedDate ? ` (seit ${formattedDate})` : ''}
            </option>
          );
        })}
      </select>
      {hasChanged && (
        <button
          onClick={handleAssign}
          disabled={saving}
          className="text-xs px-2 py-1 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 whitespace-nowrap"
        >
          {saving ? "Speichern..." : "Speichern"}
        </button>
      )}
      {currentProjectId && (
        <button
          onClick={() => setShowDropdown(false)}
          disabled={saving}
          className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
        >
          Abbrechen
        </button>
      )}
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
