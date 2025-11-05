"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
// import { saveProjectsSort, saveFilmProjectsSort } from "@/app/actions/user-preferences";

type Props = {
  type: "projects" | "film-projects";
  currentSort: string;
  currentDir: "asc" | "desc";
};

export function SaveSortButton({ type, currentSort, currentDir }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: Implement save sort functions
      // if (type === "projects") {
      //   await saveProjectsSort(currentSort, currentDir);
      // } else {
      //   await saveFilmProjectsSort(currentSort, currentDir);
      // }
      console.log("Save sort:", type, currentSort, currentDir);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save sort preference:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button
      onClick={handleSave}
      disabled={saving}
      variant="outline"
      size="sm"
      className="text-xs"
    >
      {saved ? "✓ Gespeichert" : saving ? "Speichere..." : "Sortierung speichern"}
    </Button>
  );
}
