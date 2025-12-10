"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createTemplateItem,
  updateTemplateItem,
  deleteTemplateItem,
  moveTemplateItem,
} from "./actions";

type TemplateItem = {
  id: string;
  label: string;
  description: string | null;
  sortOrder: number;
};

type Props = {
  items: TemplateItem[];
};

export default function TemplateClient({ items }: Props) {
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Neues Item
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  const handleCreate = () => {
    if (!newLabel.trim()) return;
    startTransition(async () => {
      await createTemplateItem({
        label: newLabel.trim(),
        description: newDescription.trim() || undefined,
      });
      setNewLabel("");
      setNewDescription("");
      setShowNewForm(false);
    });
  };

  const handleEdit = (item: TemplateItem) => {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditDescription(item.description || "");
  };

  const handleUpdate = () => {
    if (!editingId || !editLabel.trim()) return;
    startTransition(async () => {
      await updateTemplateItem(editingId, {
        label: editLabel.trim(),
        description: editDescription.trim() || null,
      });
      setEditingId(null);
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Dieses Item wirklich löschen?")) return;
    startTransition(async () => {
      await deleteTemplateItem(id);
    });
  };

  const handleMove = (id: string, direction: "up" | "down") => {
    startTransition(async () => {
      await moveTemplateItem(id, direction);
    });
  };

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Diese Template-Items werden beim Erstellen eines QM-Checks für ein Projekt kopiert.
          Änderungen hier wirken sich nur auf neue Checklisten aus, nicht auf bereits existierende.
        </p>
      </div>

      {/* Liste der Items - kompakt */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Noch keine Check-Items definiert
          </div>
        ) : (
          items.map((item, index) => (
            <div key={item.id} className="px-3 py-2">
              {editingId === item.id ? (
                // Edit Mode
                <div className="space-y-2 py-1">
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="Bezeichnung"
                    className="h-8 text-sm"
                  />
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Beschreibung (optional)"
                    rows={2}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleUpdate} disabled={isPending} className="h-7 text-xs">
                      Speichern
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="h-7 text-xs">
                      Abbrechen
                    </Button>
                  </div>
                </div>
              ) : (
                // View Mode - kompakt einzeilig
                <div className="flex items-center gap-2">
                  {/* Sort Buttons */}
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => handleMove(item.id, "up")}
                      disabled={isPending || index === 0}
                      className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Nach oben"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleMove(item.id, "down")}
                      disabled={isPending || index === items.length - 1}
                      className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Nach unten"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Nummer */}
                  <span className="text-xs font-mono text-gray-400 dark:text-gray-500 w-6">
                    {index + 1}.
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-900 dark:text-white">
                      {item.label}
                    </span>
                    {item.description && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                        — {item.description.length > 50 ? item.description.substring(0, 50) + "..." : item.description}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title="Bearbeiten"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={isPending}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      title="Löschen"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Neues Item hinzufügen */}
      {showNewForm ? (
        <div className="bg-white dark:bg-gray-800 border-2 border-dashed border-emerald-300 dark:border-emerald-600 rounded-lg p-3 space-y-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Bezeichnung *"
            autoFocus
            className="h-8 text-sm"
          />
          <Textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Beschreibung (optional)"
            rows={2}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={isPending || !newLabel.trim()} size="sm" className="h-7 text-xs">
              Hinzufügen
            </Button>
            <Button variant="outline" onClick={() => setShowNewForm(false)} size="sm" className="h-7 text-xs">
              Abbrechen
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => setShowNewForm(true)}
          variant="outline"
          size="sm"
          className="w-full border-dashed"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neues Check-Item hinzufügen
        </Button>
      )}
    </div>
  );
}
