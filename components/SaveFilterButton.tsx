"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { saveFilmProjectsFilter } from "@/app/actions/user-preferences";

type Props = {
  currentAgent?: string[];
  currentStatus?: string[];
  currentPStatus?: string[];
  currentScope?: string[];
};

export function SaveFilterButton({ currentAgent, currentStatus, currentPStatus, currentScope }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveFilmProjectsFilter(currentAgent, currentStatus, currentPStatus, currentScope);
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
