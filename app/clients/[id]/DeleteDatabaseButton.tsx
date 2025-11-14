"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteDatabase } from "./database-actions";

type Props = {
  serverId: string;
  databaseName: string;
  clientId: string;
};

export function DeleteDatabaseButton({ serverId, databaseName, clientId }: Props) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Möchten Sie die Datenbank "${databaseName}" wirklich löschen?\n\nDieser Vorgang kann nicht rückgängig gemacht werden!`)) {
      return;
    }

    setDeleting(true);
    const result = await deleteDatabase(serverId, databaseName, clientId);
    setDeleting(false);

    if (!result.success) {
      alert(result.error || "Fehler beim Löschen");
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={deleting}
      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 h-7 px-2"
      title="Datenbank löschen"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
