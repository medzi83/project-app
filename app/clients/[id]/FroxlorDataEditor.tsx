"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FroxlorCustomer } from "@/lib/froxlor";
import { updateFroxlorCustomerData } from "./actions";

type Props = {
  customer: FroxlorCustomer;
  serverId: string;
  isAdmin: boolean;
};

export function FroxlorDataEditor({ customer, serverId, isAdmin }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const [formData, setFormData] = useState({
    firstname: customer.firstname || "",
    name: customer.name || "",
    company: customer.company || "",
    email: customer.email || "",
    diskspace_gb: customer.diskspace ? Math.round(parseInt(customer.diskspace) / 1024 / 1024).toString() : "2",
    mysqls: customer.mysqls?.toString() || "1",
    ftps: customer.ftps?.toString() || "1",
    deactivated: customer.deactivated === 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setResult(null);

    const data = new FormData();
    data.append("serverId", serverId);
    data.append("customerId", customer.customerid.toString());
    data.append("firstname", formData.firstname);
    data.append("name", formData.name);
    data.append("company", formData.company);
    data.append("email", formData.email);
    data.append("diskspace_gb", formData.diskspace_gb);
    data.append("mysqls", formData.mysqls);
    data.append("ftps", formData.ftps);
    if (formData.deactivated) data.append("deactivated", "on");

    const response = await updateFroxlorCustomerData(data);

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
      firstname: customer.firstname || "",
      name: customer.name || "",
      company: customer.company || "",
      email: customer.email || "",
      diskspace_gb: customer.diskspace ? Math.round(parseInt(customer.diskspace) / 1024 / 1024).toString() : "2",
      mysqls: customer.mysqls?.toString() || "1",
      ftps: customer.ftps?.toString() || "1",
      deactivated: customer.deactivated === 1,
    });
    setIsEditing(false);
    setResult(null);
  };

  if (!isEditing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium">Froxlor Kundendaten</h2>
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
          <div>
            <div className="text-xs text-gray-500">Login</div>
            <div className="font-mono text-xs">{customer.loginname}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Name</div>
            <div>{customer.firstname} {customer.name}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Firma</div>
            <div>{customer.company || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Status</div>
            <div>
              {customer.deactivated === 1 ? (
                <Badge variant="destructive" className="text-xs">Deaktiviert</Badge>
              ) : (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-200 text-xs">Aktiv</Badge>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-500">Speicher</div>
              <div>
                {customer.diskspace
                  ? `${Math.round(parseInt(customer.diskspace) / 1024 / 1024)} GB`
                  : "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">MySQL DB</div>
              <div>{customer.mysqls || 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">FTP</div>
              <div>{customer.ftps || 0}</div>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">E-Mail</div>
            <div className="text-xs">{customer.email}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Document Root</div>
            <div className="font-mono text-xs break-all">{customer.documentroot || "-"}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-medium">Froxlor Kundendaten bearbeiten</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Vorname</label>
            <input
              type="text"
              value={formData.firstname}
              onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
              className="w-full rounded border p-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Nachname</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded border p-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Firma</label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="w-full rounded border p-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">E-Mail</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded border p-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Speicherplatz (GB)</label>
            <input
              type="number"
              value={formData.diskspace_gb}
              onChange={(e) => setFormData({ ...formData, diskspace_gb: e.target.value })}
              className="w-full rounded border p-2 text-sm"
              required
              min="1"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">MySQL Datenbanken</label>
            <input
              type="number"
              value={formData.mysqls}
              onChange={(e) => setFormData({ ...formData, mysqls: e.target.value })}
              className="w-full rounded border p-2 text-sm"
              required
              min="0"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">FTP Konten</label>
            <input
              type="number"
              value={formData.ftps}
              onChange={(e) => setFormData({ ...formData, ftps: e.target.value })}
              className="w-full rounded border p-2 text-sm"
              required
              min="0"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.deactivated}
                onChange={(e) => setFormData({ ...formData, deactivated: e.target.checked })}
                className="rounded border"
              />
              <span>Kunde deaktiviert</span>
            </label>
          </div>
        </div>

        <div className="rounded bg-gray-50 p-3 text-xs text-gray-600">
          <strong>Hinweis:</strong> Login-Name und Document Root können hier nicht geändert werden.
          Diese Einstellungen müssen direkt in Froxlor angepasst werden.
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
