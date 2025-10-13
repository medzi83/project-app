"use client";

import { useState } from "react";
import { addPreviewVersion } from "@/app/film-projects/inline-actions";

type Props = {
  projectId: string;
  display: string;
  currentVersion: number | null;
  currentLink: string | null;
  canEdit: boolean;
};

export default function FilmPreviewCell({ projectId, display, currentVersion, currentLink, canEdit }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [version, setVersion] = useState((currentVersion ?? 0) + 1);
  const [sentDate, setSentDate] = useState(new Date().toISOString().slice(0, 10));
  const [link, setLink] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await addPreviewVersion(formData);
    setIsEditing(false);
    setVersion(version + 1);
    setLink("");
  };

  // Parse display to extract date and version, then render with link
  const renderDisplay = () => {
    // Match pattern: "date (vX)" where X is a number
    const versionMatch = display.match(/^(.+?)\s+\(v(\d+)\)$/);

    if (versionMatch && currentLink && currentLink.trim() !== "") {
      const dateText = versionMatch[1];
      const versionNumber = versionMatch[2];
      return (
        <>
          {dateText}{" "}
          <a
            href={currentLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            (v{versionNumber})
          </a>
        </>
      );
    }

    return <>{display}</>;
  };

  if (!canEdit) {
    return <span>{renderDisplay()}</span>;
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        onDoubleClick={() => setIsEditing(true)}
        title="Zum Bearbeiten klicken"
        className="inline-flex w-full items-start justify-start gap-2 rounded px-1 py-0.5 text-left cursor-text bg-transparent transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
      >
        {renderDisplay()}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 min-w-[250px]">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="flex gap-2 items-center">
        <label className="text-xs w-16">Version:</label>
        <input
          type="number"
          name="version"
          value={version}
          onChange={(e) => setVersion(parseInt(e.target.value) || 1)}
          min="1"
          className="rounded border px-2 py-1 text-xs w-16"
          required
        />
      </div>
      <div className="flex gap-2 items-center">
        <label className="text-xs w-16">Datum:</label>
        <input
          type="date"
          name="sentDate"
          value={sentDate}
          onChange={(e) => setSentDate(e.target.value)}
          className="rounded border px-2 py-1 text-xs flex-1"
          required
        />
      </div>
      <div className="flex gap-2 items-center">
        <label className="text-xs w-16">Link:</label>
        <input
          type="url"
          name="link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://..."
          className="rounded border px-2 py-1 text-xs flex-1"
          required
        />
      </div>
      <div className="flex gap-1">
        <button
          type="submit"
          className="rounded bg-black px-2 py-1 text-xs text-white hover:bg-gray-800"
        >
          Speichern
        </button>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
