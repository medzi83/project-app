"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPreviewVersion } from "@/app/film-projects/[id]/actions";

type AddPreviewVersionButtonProps = {
  projectId: string;
  nextVersion: number;
};

export function AddPreviewVersionButton({ projectId, nextVersion }: AddPreviewVersionButtonProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [sentDate, setSentDate] = useState("");
  const [link, setLink] = useState("");
  const router = useRouter();

  const handleSave = () => {
    if (!sentDate) {
      alert("Bitte ein Datum eingeben");
      return;
    }

    startTransition(async () => {
      try {
        await createPreviewVersion(projectId, {
          sentDate: new Date(sentDate),
          link: link,
        });
        router.refresh();
        setIsAdding(false);
        setSentDate("");
        setLink("");
      } catch (error) {
        alert("Fehler beim Erstellen: " + (error instanceof Error ? error.message : "Unbekannter Fehler"));
      }
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setSentDate("");
    setLink("");
  };

  if (isAdding) {
    return (
      <div className="flex flex-col gap-3 p-3 rounded-lg border border-green-400 bg-green-50">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
            v{nextVersion}
          </span>
          <input
            type="date"
            value={sentDate}
            onChange={(e) => setSentDate(e.target.value)}
            className="px-2 py-1 text-sm border rounded"
            disabled={isPending}
            placeholder="Datum"
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
            className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? "Erstellt..." : "Erstellen"}
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
    <button
      onClick={() => setIsAdding(true)}
      className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-600 hover:border-green-400 hover:bg-green-50 hover:text-green-700 transition-all"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      <span className="text-sm font-medium">Neue Vorabversion hinzufügen</span>
    </button>
  );
}
