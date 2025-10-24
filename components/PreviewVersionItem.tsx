"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { deletePreviewVersion, updatePreviewVersion } from "@/app/film-projects/[id]/actions";
import { useRouter } from "next/navigation";

type PreviewVersionItemProps = {
  version: {
    id: string;
    version: number;
    sentDate: Date;
    link: string;
    createdAt: Date;
  };
  isAdmin: boolean;
  canEdit: boolean;
};

const formatDate = (value: Date | string | null | undefined): string => {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "-";
  }
};

export function PreviewVersionItem({ version, isAdmin, canEdit }: PreviewVersionItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [sentDate, setSentDate] = useState(version.sentDate);
  const [link, setLink] = useState(version.link);
  const router = useRouter();

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

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updatePreviewVersion(version.id, {
          sentDate: new Date(sentDate),
          link: link,
        });
        router.refresh();
        setIsEditing(false);
      } catch (error) {
        alert("Fehler beim Speichern: " + (error instanceof Error ? error.message : "Unbekannter Fehler"));
      }
    });
  };

  const handleCancel = () => {
    setSentDate(version.sentDate);
    setLink(version.link);
    setIsEditing(false);
  };

  const toDateInputValue = (date: Date): string => {
    try {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return "";
    }
  };

  if (isDeleting) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-gray-50 opacity-50">
        <Badge variant="outline" className="font-mono bg-gray-100">v{version.version}</Badge>
        <span className="text-sm text-gray-500">Wird gelöscht...</span>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-3 p-3 rounded-lg border border-blue-400 bg-blue-50">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono bg-white">v{version.version}</Badge>
          <input
            type="date"
            value={toDateInputValue(sentDate)}
            onChange={(e) => setSentDate(new Date(e.target.value))}
            className="px-2 py-1 text-sm border rounded"
            disabled={isPending}
          />
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
            className="flex-1 px-2 py-1 text-sm border rounded"
            disabled={isPending}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded bg-black px-3 py-1 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {isPending ? "Speichert..." : "Speichern"}
          </button>
          <button
            onClick={handleCancel}
            disabled={isPending}
            className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border transition-all hover:border-gray-300 hover:shadow-sm">
      <Badge variant="outline" className="font-mono bg-gray-100">v{version.version}</Badge>
      <span className="text-sm font-medium">{formatDate(version.sentDate)}</span>
      {version.link && (
        <a
          href={version.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          Link öffnen
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
      <span className="text-xs text-gray-500 ml-auto">
        (Erfasst: {formatDate(version.createdAt)})
      </span>
      {canEdit && (
        <button
          onClick={() => setIsEditing(true)}
          className="ml-2 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          Bearbeiten
        </button>
      )}
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
