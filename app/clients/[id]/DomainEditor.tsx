"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updateDomainSettings } from "./actions";

type Props = {
  domain: {
    id: string;
    domain: string;
    letsencrypt: string;
    phpsettingid: string;
    ssl_redirect: string;
  };
  serverId: string;
  clientId: string;
  phpConfigs: Record<string, string>;
  isAdmin: boolean;
};

export function DomainEditor({ domain, serverId, clientId, phpConfigs, isAdmin }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [letsencrypt, setLetsencrypt] = useState(domain.letsencrypt === "1");
  const [phpsettingid, setPhpsettingid] = useState(domain.phpsettingid);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setResult(null);

    const formData = new FormData();
    formData.append("serverId", serverId);
    formData.append("domainId", domain.id);
    formData.append("clientId", clientId);
    formData.append("letsencrypt", letsencrypt ? "1" : "0");
    formData.append("phpsettingid", phpsettingid);

    const response = await updateDomainSettings(formData);

    setSaving(false);
    setResult(response);

    if (response.success) {
      setTimeout(() => {
        setIsEditing(false);
        setResult(null);
        // Reload page to show updated data
        window.location.reload();
      }, 1500);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setLetsencrypt(domain.letsencrypt === "1");
    setPhpsettingid(domain.phpsettingid);
    setResult(null);
  };

  if (!isAdmin) {
    return null;
  }

  if (!isEditing) {
    return (
      <Button
        type="button"
        onClick={() => setIsEditing(true)}
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
      >
        <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Bearbeiten
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 pt-2 border-t border-dashed space-y-3">
      <div className="text-xs font-medium text-muted-foreground mb-2">Domain bearbeiten</div>

      {/* Let's Encrypt Toggle */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={letsencrypt}
            onChange={(e) => setLetsencrypt(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs text-foreground">Let&apos;s Encrypt aktivieren</span>
        </label>
      </div>

      {/* PHP Version Select */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">PHP-Version</label>
        <select
          value={phpsettingid}
          onChange={(e) => setPhpsettingid(e.target.value)}
          className="w-full rounded border p-1.5 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
        >
          {Object.entries(phpConfigs).map(([id, description]) => (
            <option key={id} value={id}>
              {description}
            </option>
          ))}
        </select>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={saving}
          size="sm"
          className="h-7 text-xs"
        >
          {saving ? "Speichere..." : "Speichern"}
        </Button>
        <Button
          type="button"
          onClick={handleCancel}
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={saving}
        >
          Abbrechen
        </Button>
      </div>

      {/* Result Message */}
      {result && (
        <div className={`text-xs ${result.success ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {result.message}
        </div>
      )}
    </form>
  );
}
