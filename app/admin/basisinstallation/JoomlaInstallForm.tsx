"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  serverId: string;
  customerNo: string;
  customerDocumentRoot: string;
  standardDomain: string;
};

export default function JoomlaInstallForm({
  serverId,
  customerNo,
  customerDocumentRoot,
  standardDomain,
}: Props) {
  const [folderName, setFolderName] = useState("");
  const [dbPassword, setDbPassword] = useState("");
  const [installing, setInstalling] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    installUrl?: string;
    databaseName?: string;
    databasePassword?: string;
  } | null>(null);

  const handleInstall = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!folderName.trim()) {
      setResult({
        success: false,
        message: "Bitte Ordnernamen eingeben",
      });
      return;
    }

    if (!dbPassword.trim()) {
      setResult({
        success: false,
        message: "Bitte Datenbank-Passwort eingeben",
      });
      return;
    }

    // Validate folder name (alphanumeric, dash, underscore only)
    if (!/^[a-zA-Z0-9_-]+$/.test(folderName)) {
      setResult({
        success: false,
        message: "Ordnername darf nur Buchstaben, Zahlen, _ und - enthalten",
      });
      return;
    }

    setInstalling(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/joomla-install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId,
          customerNo,
          folderName,
          dbPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Installation fehlgeschlagen");
      }

      setResult({
        success: true,
        message: data.message || "Installation erfolgreich vorbereitet",
        installUrl: data.installUrl,
        databaseName: data.databaseName,
        databasePassword: dbPassword,
      });

      // Reset form on success
      setFolderName("");
      setDbPassword("");
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Installation fehlgeschlagen",
      });
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold">Joomla installieren</h3>

      <div className="mb-4 rounded bg-blue-50 p-3 text-sm">
        <div className="font-medium text-blue-900 mb-1">Kundeninformationen</div>
        <div className="space-y-1 text-blue-800">
          <div>Kundennummer: {customerNo}</div>
          <div>Document Root: {customerDocumentRoot}</div>
          <div>Standard-Domain: {standardDomain}</div>
        </div>
      </div>

      <form onSubmit={handleInstall} className="space-y-4">
        <div>
          <label htmlFor="folderName" className="block text-sm font-medium mb-2">
            Ordnername für die Installation
          </label>
          <input
            type="text"
            id="folderName"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="z.B. website2024"
            className="w-full rounded border p-2"
            disabled={installing}
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Nur Buchstaben, Zahlen, Bindestriche und Unterstriche erlaubt
          </p>
          {folderName && (
            <div className="mt-2 rounded bg-gray-50 p-2 text-sm">
              <span className="text-gray-600">Installations-URL:</span>{" "}
              <span className="font-mono text-blue-600">
                {standardDomain}/{folderName}
              </span>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="dbPassword" className="block text-sm font-medium mb-2">
            Datenbank-Passwort
          </label>
          <input
            type="password"
            id="dbPassword"
            value={dbPassword}
            onChange={(e) => setDbPassword(e.target.value)}
            placeholder="Sicheres Passwort für die MySQL-Datenbank"
            className="w-full rounded border p-2"
            disabled={installing}
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Froxlor erstellt automatisch eine Datenbank (z.B. E25065sql1)
          </p>
        </div>

        {result && (
          <div
            className={`rounded border p-3 text-sm ${
              result.success
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <div className="font-medium mb-1">
              {result.success ? "✓ Erfolg" : "✗ Fehler"}
            </div>
            <div>{result.message}</div>
            {result.success && result.databaseName && (
              <div className="mt-3 space-y-2 pt-2 border-t border-green-200">
                <div className="font-mono text-xs bg-white rounded p-2">
                  <div><strong>Datenbank:</strong> {result.databaseName}</div>
                  <div><strong>Passwort:</strong> {result.databasePassword}</div>
                </div>
              </div>
            )}
            {result.installUrl && (
              <div className="mt-3">
                <a
                  href={result.installUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded bg-green-700 px-4 py-2 text-white font-medium hover:bg-green-800"
                >
                  → Installation starten
                </a>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={installing || !folderName || !dbPassword}>
            {installing ? "Installation läuft..." : "Joomla-Installation vorbereiten"}
          </Button>
        </div>
      </form>

      <div className="mt-6 rounded bg-gray-50 p-4 text-xs text-gray-600">
        <div className="font-medium mb-2">Was passiert bei der Installation?</div>
        <ol className="list-decimal list-inside space-y-1">
          <li>Eine MySQL-Datenbank wird in Froxlor angelegt (z.B. E25065sql1)</li>
          <li>Ein Ordner wird im Document Root des Kunden angelegt</li>
          <li>kickstart.php und die Backup-Datei werden per SFTP hochgeladen</li>
          <li>Dateien erhalten die korrekten Berechtigungen (Owner: Kunde)</li>
          <li>Du erhältst Datenbank-Zugangsdaten und die Installations-URL</li>
          <li>Klicke "Installation starten" um kickstart.php zu öffnen</li>
        </ol>
      </div>
    </div>
  );
}
