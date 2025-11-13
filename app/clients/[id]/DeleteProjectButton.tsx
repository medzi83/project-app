"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteProject } from "./actions";

type Props = {
  projectId: string;
  projectTitle: string;
  clientId: string;
};

export function DeleteProjectButton({ projectId, projectTitle, clientId }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setResult(null);

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("clientId", clientId);

    const response = await deleteProject(formData);
    setResult(response);
    setIsDeleting(false);

    if (response.success) {
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  if (!showConfirm) {
    return (
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setShowConfirm(true)}
        className="h-7"
      >
        <Trash2 className="h-3 w-3 mr-1" />
        Löschen
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-muted-foreground">
        Projekt "{projectTitle}" wirklich löschen?
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          className="h-7"
        >
          {isDeleting ? "Lösche..." : "Ja, löschen"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setShowConfirm(false);
            setResult(null);
          }}
          disabled={isDeleting}
          className="h-7"
        >
          Abbrechen
        </Button>
      </div>
      {result && (
        <div
          className={`text-xs ${
            result.success
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}
