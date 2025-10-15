"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { deletePreviewVersion } from "@/app/film-projects/[id]/actions";

type PreviewVersionItemProps = {
  version: {
    id: string;
    version: number;
    sentDate: Date;
    link: string;
    createdAt: Date;
  };
  isAdmin: boolean;
};

const formatDate = (value: Date | string | null | undefined): string => {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "-";
  }
};

export function PreviewVersionItem({ version, isAdmin }: PreviewVersionItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Möchten Sie Version v${version.version} wirklich löschen?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await deletePreviewVersion(version.id);
    } catch (error) {
      alert("Fehler beim Löschen: " + (error instanceof Error ? error.message : "Unbekannter Fehler"));
      setIsDeleting(false);
    }
  };

  if (isDeleting) {
    return (
      <div className="flex items-center gap-3 p-2 rounded border bg-gray-50 opacity-50">
        <Badge variant="outline" className="font-mono">v{version.version}</Badge>
        <span className="text-sm text-gray-500">Wird gelöscht...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-2 rounded border">
      <Badge variant="outline" className="font-mono">v{version.version}</Badge>
      <span className="text-sm">{formatDate(version.sentDate)}</span>
      {version.link && (
        <a
          href={version.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline"
        >
          Link öffnen →
        </a>
      )}
      <span className="text-xs text-gray-500 ml-auto">
        (Erfasst: {formatDate(version.createdAt)})
      </span>
      {isAdmin && (
        <button
          onClick={handleDelete}
          className="ml-2 rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
        >
          Löschen
        </button>
      )}
    </div>
  );
}
