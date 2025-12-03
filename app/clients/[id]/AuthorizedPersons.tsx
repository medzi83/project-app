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
  createdByClient?: boolean;
  createdAt?: Date;
};

type Props = {
  clientId: string;
  authorizedPersons: AuthorizedPerson[];
  isAdmin: boolean;
  canEdit?: boolean; // Allow editing for Admins and Agents
};

export function AuthorizedPersons({ clientId, authorizedPersons, isAdmin, canEdit = isAdmin }: Props) {
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

  if (!canEdit) {
    // Users without edit permission can only view
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
          <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Berechtigte Personen
        </h2>
        {authorizedPersons.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine berechtigten Personen hinterlegt</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {authorizedPersons.map((person) => (
              <div
                key={person.id}
                className="border rounded-lg p-3 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50"
              >
                {/* Badge for client-created persons */}
                {person.createdByClient && (
                  <div className="mb-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-medium">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Vom Kunden hinzugefügt
                      {person.createdAt && (
                        <span className="text-amber-600 dark:text-amber-500">
                          ({new Date(person.createdAt).toLocaleDateString("de-DE")})
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {/* Header with Name */}
                <div className="mb-2">
                  <div className="font-semibold text-sm truncate">
                    {person.salutation ? `${person.salutation} ` : ""}
                    {person.firstname} {person.lastname}
                  </div>
                  {person.position && (
                    <div className="text-xs text-muted-foreground truncate">
                      {person.position}
                    </div>
                  )}
                </div>

                {/* Contact Info */}
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <a href={`mailto:${person.email}`} className="truncate hover:underline text-blue-600 dark:text-blue-400">
                      {person.email}
                    </a>
                  </div>
                  {person.phone && (
                    <div className="flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <a href={`tel:${person.phone}`} className="truncate hover:underline">
                        {person.phone}
                      </a>
                    </div>
                  )}
                </div>

                {/* Notes - only show if exists */}
                {person.notes && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {person.notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Berechtigte Personen
        </h2>
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
        <div className="grid gap-3 sm:grid-cols-2">
          {authorizedPersons.map((person) => (
            <div
              key={person.id}
              className="group relative border rounded-lg p-3 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50 hover:shadow-md transition-shadow"
            >
              {/* Badge for client-created persons */}
              {person.createdByClient && (
                <div className="mb-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-medium">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Vom Kunden hinzugefügt
                    {person.createdAt && (
                      <span className="text-amber-600 dark:text-amber-500">
                        ({new Date(person.createdAt).toLocaleDateString("de-DE")})
                      </span>
                    )}
                  </span>
                </div>
              )}
              {/* Header with Name and Actions */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {person.salutation ? `${person.salutation} ` : ""}
                    {person.firstname} {person.lastname}
                  </div>
                  {person.position && (
                    <div className="text-xs text-muted-foreground truncate">
                      {person.position}
                    </div>
                  )}
                </div>

                {!editingId && !isAdding && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(person)}
                      disabled={saving}
                      className="h-7 w-7 p-0"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(person.id)}
                      disabled={saving}
                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Contact Info */}
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href={`mailto:${person.email}`} className="truncate hover:underline text-blue-600 dark:text-blue-400">
                    {person.email}
                  </a>
                </div>
                {person.phone && (
                  <div className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <a href={`tel:${person.phone}`} className="truncate hover:underline">
                      {person.phone}
                    </a>
                  </div>
                )}
              </div>

              {/* Notes - only show if exists */}
              {person.notes && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {person.notes}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
