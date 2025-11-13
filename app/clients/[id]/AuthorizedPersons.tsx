"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import {
  createAuthorizedPerson,
  updateAuthorizedPerson,
  deleteAuthorizedPerson,
} from "./authorized-persons-actions";

type AuthorizedPerson = {
  id: string;
  salutation: string | null;
  firstname: string;
  lastname: string;
  email: string;
  position: string | null;
  phone: string | null;
  notes: string | null;
};

type Props = {
  clientId: string;
  authorizedPersons: AuthorizedPerson[];
  isAdmin: boolean;
};

export function AuthorizedPersons({ clientId, authorizedPersons, isAdmin }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    salutation: "",
    firstname: "",
    lastname: "",
    email: "",
    position: "",
    phone: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({
      salutation: "",
      firstname: "",
      lastname: "",
      email: "",
      position: "",
      phone: "",
      notes: "",
    });
    setIsAdding(false);
    setEditingId(null);
    setError(null);
  };

  const handleAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleEdit = (person: AuthorizedPerson) => {
    setFormData({
      salutation: person.salutation || "",
      firstname: person.firstname,
      lastname: person.lastname,
      email: person.email,
      position: person.position || "",
      phone: person.phone || "",
      notes: person.notes || "",
    });
    setEditingId(person.id);
    setIsAdding(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const data = {
        salutation: formData.salutation || undefined,
        firstname: formData.firstname,
        lastname: formData.lastname,
        email: formData.email,
        position: formData.position || undefined,
        phone: formData.phone || undefined,
        notes: formData.notes || undefined,
      };

      let result;
      if (editingId) {
        result = await updateAuthorizedPerson(editingId, clientId, data);
      } else {
        result = await createAuthorizedPerson(clientId, data);
      }

      if (result.success) {
        resetForm();
      } else {
        setError(result.error || "Ein Fehler ist aufgetreten");
      }
    } catch (err) {
      setError("Ein unerwarteter Fehler ist aufgetreten");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Möchten Sie diese berechtigte Person wirklich löschen?")) {
      return;
    }

    setSaving(true);
    const result = await deleteAuthorizedPerson(id, clientId);
    setSaving(false);

    if (!result.success) {
      alert(result.error || "Fehler beim Löschen");
    }
  };

  if (!isAdmin) {
    // Non-admin users can only view
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Berechtigte Personen</h3>
        {authorizedPersons.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine berechtigten Personen hinterlegt</p>
        ) : (
          <div className="space-y-3">
            {authorizedPersons.map((person) => (
              <div
                key={person.id}
                className="border rounded-lg p-4 bg-white dark:bg-gray-800"
              >
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <span className="ml-2 font-medium">
                      {person.salutation ? `${person.salutation} ` : ""}
                      {person.firstname} {person.lastname}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">E-Mail:</span>
                    <span className="ml-2">{person.email}</span>
                  </div>
                  {person.position && (
                    <div>
                      <span className="text-muted-foreground">Position:</span>
                      <span className="ml-2">{person.position}</span>
                    </div>
                  )}
                  {person.phone && (
                    <div>
                      <span className="text-muted-foreground">Telefon:</span>
                      <span className="ml-2">{person.phone}</span>
                    </div>
                  )}
                  {person.notes && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Infos:</span>
                      <p className="mt-1 text-sm whitespace-pre-wrap">{person.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Berechtigte Personen</h3>
        {!isAdding && !editingId && (
          <Button onClick={handleAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Hinzufügen
          </Button>
        )}
      </div>

      {(isAdding || editingId) && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-4 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">
              {editingId ? "Berechtigte Person bearbeiten" : "Neue berechtigte Person"}
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetForm}
              disabled={saving}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Anrede
              </label>
              <select
                value={formData.salutation}
                onChange={(e) => setFormData({ ...formData, salutation: e.target.value })}
                className="w-full rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              >
                <option value="">Keine Angabe</option>
                <option value="Herr">Herr</option>
                <option value="Frau">Frau</option>
                <option value="Divers">Divers</option>
              </select>
            </div>
            <div />

            <div>
              <label className="block text-sm font-medium mb-1">
                Vorname <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.firstname}
                onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                className="w-full rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Nachname <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.lastname}
                onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                className="w-full rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                E-Mail <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Position
              </label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                placeholder="z.B. Geschäftsführer"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">
                Telefon
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">
                Infos
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                rows={3}
                placeholder="Zusätzliche Informationen..."
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Speichere..." : editingId ? "Speichern" : "Hinzufügen"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={saving}
            >
              Abbrechen
            </Button>
          </div>
        </form>
      )}

      {authorizedPersons.length === 0 && !isAdding ? (
        <p className="text-sm text-muted-foreground">Keine berechtigten Personen hinterlegt</p>
      ) : (
        <div className="space-y-3">
          {authorizedPersons.map((person) => (
            <div
              key={person.id}
              className="border rounded-lg p-4 bg-white dark:bg-gray-800"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <span className="ml-2 font-medium">
                      {person.salutation ? `${person.salutation} ` : ""}
                      {person.firstname} {person.lastname}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">E-Mail:</span>
                    <span className="ml-2">{person.email}</span>
                  </div>
                  {person.position && (
                    <div>
                      <span className="text-muted-foreground">Position:</span>
                      <span className="ml-2">{person.position}</span>
                    </div>
                  )}
                  {person.phone && (
                    <div>
                      <span className="text-muted-foreground">Telefon:</span>
                      <span className="ml-2">{person.phone}</span>
                    </div>
                  )}
                  {person.notes && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Infos:</span>
                      <p className="mt-1 text-sm whitespace-pre-wrap">{person.notes}</p>
                    </div>
                  )}
                </div>

                {!editingId && !isAdding && (
                  <div className="flex gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(person)}
                      disabled={saving}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(person.id)}
                      disabled={saving}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
