"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { updateClientBasicData } from "./actions";

type Server = {
  id: string;
  name: string;
  hostname: string | null;
};

type Agency = {
  id: string;
  name: string;
};

type ClientServer = {
  server: Server;
  customerNo: string | null;
};

type ClientData = {
  id: string;
  name: string;
  salutation: string | null;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  uploadLinks: string[] | null;
  customerNo: string | null;
  serverId: string | null;
  agencyId: string | null;
  workStopped: boolean;
  finished: boolean;
  createdAt: Date;
  server: Server | null;
  clientServers: ClientServer[];
};

type Props = {
  client: ClientData;
  servers: Server[];
  agencies: Agency[];
  isAdmin: boolean;
};

export function ClientDataEditor({ client, servers, agencies, isAdmin }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const [formData, setFormData] = useState({
    name: client.name || "",
    customerNo: client.customerNo || "",
    salutation: client.salutation || "",
    firstname: client.firstname || "",
    lastname: client.lastname || "",
    email: client.email || "",
    phone: client.phone || "",
    serverId: client.serverId || "",
    agencyId: client.agencyId || "",
    notes: client.notes || "",
    workStopped: client.workStopped,
    finished: client.finished,
  });

  const [uploadLinks, setUploadLinks] = useState<string[]>(
    client.uploadLinks || [""]
  );

  const formatDate = (value?: Date | string | null) => {
    if (!value) return "-";
    try {
      return new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value));
    } catch {
      return "-";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setResult(null);

    const data = new FormData();
    data.append("clientId", client.id);
    data.append("name", formData.name);
    data.append("customerNo", formData.customerNo);
    data.append("salutation", formData.salutation);
    data.append("firstname", formData.firstname);
    data.append("lastname", formData.lastname);
    data.append("email", formData.email);
    data.append("phone", formData.phone);
    data.append("serverId", formData.serverId);
    data.append("agencyId", formData.agencyId);
    data.append("notes", formData.notes);

    // Filter out empty upload links and send as JSON
    const filteredUploadLinks = uploadLinks.filter(link => link.trim() !== "");
    data.append("uploadLinks", JSON.stringify(filteredUploadLinks));

    if (formData.workStopped) data.append("workStopped", "on");
    if (formData.finished) data.append("finished", "on");

    const response = await updateClientBasicData(data);

    setSaving(false);
    setResult(response);

    if (response.success) {
      setTimeout(() => {
        setIsEditing(false);
        setResult(null);
        // Reload page to show updated data
        window.location.reload();
      }, 2000);
    }
  };

  const handleCancel = () => {
    // Reset form data
    setFormData({
      name: client.name || "",
      customerNo: client.customerNo || "",
      salutation: client.salutation || "",
      firstname: client.firstname || "",
      lastname: client.lastname || "",
      email: client.email || "",
      phone: client.phone || "",
      serverId: client.serverId || "",
      agencyId: client.agencyId || "",
      notes: client.notes || "",
      workStopped: client.workStopped,
      finished: client.finished,
    });
    setUploadLinks(client.uploadLinks || [""]);
    setIsEditing(false);
    setResult(null);
  };

  const addUploadLink = () => {
    setUploadLinks([...uploadLinks, ""]);
  };

  const removeUploadLink = (index: number) => {
    if (uploadLinks.length > 1) {
      const newLinks = uploadLinks.filter((_, i) => i !== index);
      setUploadLinks(newLinks);
    } else {
      // Keep at least one empty input
      setUploadLinks([""]);
    }
  };

  const updateUploadLink = (index: number, value: string) => {
    const newLinks = [...uploadLinks];
    newLinks[index] = value;
    setUploadLinks(newLinks);
  };

  if (!isEditing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium">Basisdaten</h2>
          {isAdmin && (
            <Button
              type="button"
              onClick={() => setIsEditing(true)}
              variant="outline"
              size="sm"
            >
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Bearbeiten
            </Button>
          )}
        </div>
        <div className="grid gap-3 text-sm">
          {(client.salutation || client.firstname || client.lastname) && (
            <div>
              <div className="text-xs text-gray-500">Kontaktperson</div>
              <div>
                {client.salutation && `${client.salutation} `}
                {client.firstname && `${client.firstname} `}
                {client.lastname && client.lastname}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs text-gray-500">E-Mail</div>
            <div>
              {client.email ? (
                <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline">
                  {client.email}
                </a>
              ) : "-"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Telefon</div>
            <div>
              {client.phone ? (
                <a href={`tel:${client.phone.replace(/[^+0-9]/g, "")}`} className="text-blue-600 hover:underline">
                  {client.phone}
                </a>
              ) : "-"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Server</div>
            <div>
              {client.clientServers && client.clientServers.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {client.clientServers.map((cs) => (
                    <Badge
                      key={cs.server.id}
                      variant="outline"
                      className="font-mono text-xs"
                    >
                      {cs.server.hostname || cs.server.name}
                    </Badge>
                  ))}
                </div>
              ) : "-"}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-500">Angelegt</div>
              <div className="text-xs">{formatDate(client.createdAt)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Arbeitsstopp</div>
              <div>
                {client.workStopped ? (
                  <Badge variant="destructive" className="text-xs">Ja</Badge>
                ) : (
                  <span className="text-gray-600">Nein</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Beendet</div>
              <div>
                {client.finished ? (
                  <Badge className="bg-black hover:bg-gray-900 text-white text-xs">Ja</Badge>
                ) : (
                  <span className="text-gray-600">Nein</span>
                )}
              </div>
            </div>
          </div>
          {client.notes && (
            <div>
              <div className="text-xs text-gray-500">Notizen</div>
              <div className="text-sm whitespace-pre-wrap">{client.notes}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-gray-500">Uploadlinks</div>
            {client.uploadLinks && client.uploadLinks.length > 0 ? (
              <div className="space-y-1">
                {client.uploadLinks.map((link, index) => (
                  <div key={index}>
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm break-all"
                    >
                      {link}
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-600">-</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-medium">Basisdaten bearbeiten</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Kundenname *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded border p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Kundennummer</label>
            <input
              type="text"
              value={formData.customerNo}
              onChange={(e) => setFormData({ ...formData, customerNo: e.target.value })}
              className="w-full rounded border p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              placeholder="z.B. 10437 oder EM10437"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Anrede</label>
            <select
              value={formData.salutation}
              onChange={(e) => setFormData({ ...formData, salutation: e.target.value })}
              className="w-full rounded border p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
            >
              <option value="">-- Bitte wählen --</option>
              <option value="Herr">Herr</option>
              <option value="Frau">Frau</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Vorname</label>
            <input
              type="text"
              value={formData.firstname}
              onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
              className="w-full rounded border p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              placeholder="Max"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nachname</label>
            <input
              type="text"
              value={formData.lastname}
              onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
              className="w-full rounded border p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              placeholder="Mustermann"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">E-Mail</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded border p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              placeholder="kunde@example.com"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Telefon</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full rounded border p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Server</label>
            <select
              value={formData.serverId}
              onChange={(e) => setFormData({ ...formData, serverId: e.target.value })}
              className="w-full rounded border p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
            >
              <option value="">Kein Server zugeordnet</option>
              {servers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.hostname || server.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Agentur</label>
            <select
              value={formData.agencyId}
              onChange={(e) => setFormData({ ...formData, agencyId: e.target.value })}
              className="w-full rounded border p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
            >
              <option value="">Keine Agentur zugeordnet</option>
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Notizen</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={4}
            className="w-full rounded border p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs text-gray-500 dark:text-gray-400">Uploadlinks</label>
            <Button
              type="button"
              onClick={addUploadLink}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Link hinzufügen
            </Button>
          </div>
          <div className="space-y-2">
            {uploadLinks.map((link, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="url"
                  value={link}
                  onChange={(e) => updateUploadLink(index, e.target.value)}
                  placeholder="https://example.com/upload"
                  className="flex-1 rounded border p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                />
                {uploadLinks.length > 1 && (
                  <Button
                    type="button"
                    onClick={() => removeUploadLink(index)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.workStopped}
                onChange={(e) => setFormData({ ...formData, workStopped: e.target.checked })}
                className="rounded border"
              />
              <span>Arbeitsstopp</span>
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.finished}
                onChange={(e) => setFormData({ ...formData, finished: e.target.checked })}
                className="rounded border"
              />
              <span>Beendet</span>
            </label>
          </div>
        </div>

        {result && (
          <div
            className={`rounded p-3 text-sm ${
              result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
            }`}
          >
            {result.message}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Speichere..." : "Speichern"}
          </Button>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
            Abbrechen
          </Button>
        </div>
      </form>
    </div>
  );
}
