"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { FroxlorFtpAccount } from "@/lib/froxlor";
import { updateFtpAccountPassword } from "./actions";
import { Eye, EyeOff } from "lucide-react";

type Props = {
  ftpAccount: FroxlorFtpAccount;
  serverId: string;
  clientId: string;
  storedPassword?: string; // Password stored in our database
  isAdmin: boolean;
};

export function FtpPasswordEditor({ ftpAccount, serverId, clientId, storedPassword, isAdmin }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Use stored password if available, otherwise show hash
  const displayPassword = storedPassword || ftpAccount.password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setResult(null);

    const formData = new FormData();
    formData.append("serverId", serverId);
    formData.append("ftpId", ftpAccount.id.toString());
    formData.append("customerId", ftpAccount.customerid.toString());
    formData.append("clientId", clientId);
    formData.append("newPassword", newPassword);

    const response = await updateFtpAccountPassword(formData);

    setSaving(false);
    setResult(response);

    if (response.success) {
      setTimeout(() => {
        setIsEditing(false);
        setNewPassword("");
        setResult(null);
        // Reload page to show updated data
        window.location.reload();
      }, 2000);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setNewPassword("");
    setResult(null);
  };

  if (!isAdmin) {
    return (
      <div className="grid grid-cols-[auto,1fr] gap-2">
        <span className="text-muted-foreground">Passwort:</span>
        <span className="font-mono text-foreground">••••••••</span>
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 grid grid-cols-[auto,1fr] gap-2">
          <span className="text-muted-foreground">Passwort:</span>
          <span className="font-mono text-foreground break-all">{displayPassword}</span>
        </div>
        <Button
          type="button"
          onClick={() => setIsEditing(true)}
          variant="ghost"
          size="sm"
          className="h-7 px-2 flex-shrink-0"
        >
          <svg className="h-3 w-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-xs">Bearbeiten</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[auto,1fr] gap-2">
        <span className="text-muted-foreground">Passwort:</span>
        <span className="text-foreground text-sm">Bearbeitung aktiv</span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded border p-2 pr-10 font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
            placeholder="Neues FTP-Passwort eingeben"
            required
            minLength={8}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={saving || newPassword.length < 8}
            size="sm"
          >
            {saving ? "Speichere..." : "Speichern"}
          </Button>
          <Button
            type="button"
            onClick={handleCancel}
            variant="outline"
            size="sm"
            disabled={saving}
          >
            Abbrechen
          </Button>
        </div>
        {result && (
          <div className={`text-sm ${result.success ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {result.message}
          </div>
        )}
      </form>
    </div>
  );
}
