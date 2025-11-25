"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { enablePortalAccess, disablePortalAccess, resetPortalPassword } from "./portal-actions";

type Props = {
  clientId: string;
  clientEmail: string | null;
  portalEnabled: boolean;
  portalLastLogin: Date | null;
  portalInvitedAt: Date | null;
  isAdmin: boolean;
};

const formatDateTime = (value?: Date | string | null) => {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "-";
  }
};

export function ClientPortalCard({
  clientId,
  clientEmail,
  portalEnabled,
  portalLastLogin,
  portalInvitedAt,
  isAdmin,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localPortalEnabled, setLocalPortalEnabled] = useState(portalEnabled);
  const [localInvitedAt, setLocalInvitedAt] = useState(portalInvitedAt);

  const handleEnable = async () => {
    setLoading(true);
    setError(null);
    setGeneratedPassword(null);

    const result = await enablePortalAccess(clientId);

    if (result.success && result.password) {
      setGeneratedPassword(result.password);
      setLocalPortalEnabled(true);
      setLocalInvitedAt(new Date());
    } else {
      setError(result.error || "Ein Fehler ist aufgetreten");
    }

    setLoading(false);
  };

  const handleDisable = async () => {
    if (!confirm("Möchten Sie den Portal-Zugang wirklich deaktivieren?")) return;

    setLoading(true);
    setError(null);
    setGeneratedPassword(null);

    const result = await disablePortalAccess(clientId);

    if (result.success) {
      setLocalPortalEnabled(false);
    } else {
      setError(result.error || "Ein Fehler ist aufgetreten");
    }

    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!confirm("Möchten Sie ein neues Passwort generieren?")) return;

    setLoading(true);
    setError(null);
    setGeneratedPassword(null);

    const result = await resetPortalPassword(clientId);

    if (result.success && result.password) {
      setGeneratedPassword(result.password);
    } else {
      setError(result.error || "Ein Fehler ist aufgetreten");
    }

    setLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium text-foreground flex items-center gap-2">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Kundenportal
        </h2>
        {localPortalEnabled ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Aktiviert
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
            Deaktiviert
          </span>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Generated Password Display */}
      {generatedPassword && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">
            Generiertes Passwort (nur einmal sichtbar!)
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 rounded border border-blue-300 dark:border-blue-700 font-mono text-sm text-blue-900 dark:text-blue-100">
              {generatedPassword}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(generatedPassword)}
              className="shrink-0"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </Button>
          </div>
          <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
            Bitte senden Sie dieses Passwort sicher an den Kunden.
          </p>
        </div>
      )}

      {/* Portal Info */}
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-muted-foreground text-xs">E-Mail (Login)</span>
            <div className="font-medium truncate">
              {clientEmail || (
                <span className="text-orange-600 dark:text-orange-400">Nicht hinterlegt</span>
              )}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Letzter Login</span>
            <div className="font-medium">
              {portalLastLogin ? formatDateTime(portalLastLogin) : (
                <span className="text-muted-foreground">Noch nie</span>
              )}
            </div>
          </div>
        </div>

        {localInvitedAt && (
          <div>
            <span className="text-muted-foreground text-xs">Eingeladen am</span>
            <div className="font-medium">{formatDateTime(localInvitedAt)}</div>
          </div>
        )}
      </div>

      {/* Actions */}
      {isAdmin && (
        <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
          {!localPortalEnabled ? (
            <Button
              onClick={handleEnable}
              disabled={loading || !clientEmail}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Aktiviere..." : "Portal aktivieren"}
            </Button>
          ) : (
            <>
              <Button
                onClick={handleResetPassword}
                disabled={loading}
                variant="outline"
                size="sm"
              >
                {loading ? "..." : "Neues Passwort"}
              </Button>
              <Button
                onClick={handleDisable}
                disabled={loading}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Deaktivieren
              </Button>
            </>
          )}
          {!clientEmail && (
            <span className="text-xs text-orange-600 dark:text-orange-400 self-center">
              E-Mail erforderlich
            </span>
          )}
        </div>
      )}
    </section>
  );
}
