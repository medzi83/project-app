"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { saveProjectsFilter, saveFilmProjectsFilter } from "@/app/actions/user-preferences";

type ProjectsProps = {
  type: "projects";
  currentStatus?: string[];
  currentPriority?: string[];
  currentCms?: string[];
  currentAgent?: string[];
};

type FilmProjectsProps = {
  type: "film-projects";
  currentAgent?: string[];
  currentStatus?: string[];
  currentPStatus?: string[];
  currentScope?: string[];
};

type Props = ProjectsProps | FilmProjectsProps;

export function SaveFilterButton(props: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (props.type === "projects") {
        await saveProjectsFilter(
          props.currentStatus,
          props.currentPriority,
          props.currentCms,
          props.currentAgent
        );
      } else {
        await saveFilmProjectsFilter(
          props.currentAgent,
          props.currentStatus,
          props.currentPStatus,
          props.currentScope
        );
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save filter preference:", error);
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
      {saved ? "✓ Gespeichert" : saving ? "Speichere..." : "Filter speichern"}
    </Button>
  );
}
