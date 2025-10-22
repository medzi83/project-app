"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  serverId: string;
  customerNo: string;
  customerDocumentRoot: string;
  standardDomain: string;
  clientId: string;
  clientProjects: {
    id: string;
    title: string;
    status: string;
    updatedAt: Date;
  }[];
};

// Generate a random password with 10 characters (uppercase, lowercase, numbers)
function generatePassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const allChars = uppercase + lowercase + numbers;

  let password = '';

  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];

  // Fill remaining 7 characters randomly
  for (let i = 0; i < 7; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Format date to relative time (e.g., "vor 3 Tagen", "vor 2 Monaten")
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "heute";
  if (diffDays === 1) return "gestern";
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `vor ${weeks} Woche${weeks > 1 ? 'n' : ''}`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `vor ${months} Monat${months > 1 ? 'en' : ''}`;
  }
  const years = Math.floor(diffDays / 365);
  return `vor ${years} Jahr${years > 1 ? 'en' : ''}`;
}

export default function JoomlaInstallForm({
  serverId,
  customerNo,
  customerDocumentRoot,
  standardDomain,
  clientId,
  clientProjects,
}: Props) {
  const [folderName, setFolderName] = useState("");
  const [dbPassword, setDbPassword] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [installing, setInstalling] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    installUrl?: string;
    databaseName?: string;
    databasePassword?: string;
    filesExtracted?: number;
    bytesProcessed?: number;
  } | null>(null);

  // Generate password on mount
  useEffect(() => {
    setDbPassword(generatePassword());
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

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
    setExtracting(false);
    setResult(null);
    setCurrentStep("Vorbereitung...");

    try {
      // Step 1: Upload files and create database
      setCurrentStep("Lade Dateien hoch und erstelle Datenbank...");
      const uploadRes = await fetch("/api/admin/joomla-install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId,
          customerNo,
          folderName,
          dbPassword,
        }),
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(uploadData.error || "Upload fehlgeschlagen");
      }

      const installUrl = uploadData.installUrl;
      const databaseName = uploadData.databaseName;

      // Step 2: Extract archive automatically
      setCurrentStep("Extrahiere Joomla-Backup und konfiguriere Datenbank...");
      setInstalling(false);
      setExtracting(true);

      const extractRes = await fetch("/api/admin/joomla-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId,
          customerNo,
          folderName,
          installUrl,
          databaseName,
          databasePassword: dbPassword,
          clientId,
          projectId: selectedProjectId || null,
        }),
      });

      const extractData = await extractRes.json();

      if (!extractRes.ok) {
        throw new Error(extractData.message || "Extraktion fehlgeschlagen");
      }

      setCurrentStep("Installation abgeschlossen!");
      setResult({
        success: true,
        message: "Joomla wurde erfolgreich installiert und extrahiert!",
        installUrl: installUrl.replace("/kickstart.php", ""),
        databaseName: databaseName,
        databasePassword: dbPassword,
        filesExtracted: extractData.filesExtracted,
        bytesProcessed: extractData.bytesProcessed,
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
      setExtracting(false);
      setCurrentStep("");
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
        {clientProjects.length > 0 && (
          <div>
            <label htmlFor="projectId" className="block text-sm font-medium mb-2">
              Projekt zuordnen (optional)
            </label>
            <select
              id="projectId"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full rounded border p-2"
              disabled={installing || extracting}
            >
              <option value="">Kein Projekt zuordnen</option>
              {clientProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title} ({project.status}) - {formatRelativeTime(project.updatedAt)} letzter Kontakt
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Wählen Sie ein Projekt aus, um die Installation automatisch zuzuordnen. Die Zeitangabe zeigt, wann das Projekt zuletzt aktualisiert wurde.
            </p>
          </div>
        )}
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
          <div className="flex gap-2">
            <input
              type="text"
              id="dbPassword"
              value={dbPassword}
              onChange={(e) => setDbPassword(e.target.value)}
              placeholder="Sicheres Passwort für die MySQL-Datenbank"
              className="flex-1 rounded border p-2 font-mono"
              disabled={installing}
              required
            />
            <button
              type="button"
              onClick={() => setDbPassword(generatePassword())}
              disabled={installing}
              className="px-4 py-2 rounded border border-blue-600 bg-blue-50 text-blue-700 hover:bg-blue-100 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              title="Neues Passwort generieren"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Automatisch generiert: 10 Zeichen mit Groß-/Kleinbuchstaben und Zahlen. Sie können es anpassen oder neu generieren.
          </p>
        </div>

        {(installing || extracting) && (
          <div className="rounded border border-blue-200 bg-blue-50 p-4 text-sm">
            <div className="flex items-center gap-3">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <div>
                <div className="font-medium text-blue-900">
                  {installing ? "Installation wird vorbereitet..." : "Backup wird extrahiert..."}
                </div>
                <div className="text-blue-700 text-xs mt-1">{currentStep}</div>
              </div>
            </div>
          </div>
        )}

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
                  <div><strong>Benutzer:</strong> {result.databaseName}</div>
                  <div><strong>Passwort:</strong> {result.databasePassword}</div>
                  {result.filesExtracted && (
                    <div className="mt-2 pt-2 border-t border-green-200">
                      <div><strong>Extrahierte Dateien:</strong> {result.filesExtracted}</div>
                      {result.bytesProcessed && (
                        <div><strong>Verarbeitete Daten:</strong> {formatBytes(result.bytesProcessed)}</div>
                      )}
                    </div>
                  )}
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
                  → Webseite öffnen
                </a>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={installing || extracting || !folderName || !dbPassword}>
            {installing || extracting ? "Installation läuft..." : "Joomla automatisch installieren"}
          </Button>
        </div>
      </form>

      <div className="mt-6 rounded bg-gray-50 p-4 text-xs text-gray-600">
        <div className="font-medium mb-2">Was passiert bei der automatischen Installation?</div>
        <ol className="list-decimal list-inside space-y-1">
          <li>Eine MySQL-Datenbank wird in Froxlor automatisch angelegt</li>
          <li>Ein Ordner wird im Document Root des Kunden erstellt</li>
          <li>kickstart.php und die Backup-Datei werden per SFTP hochgeladen</li>
          <li>Dateien erhalten die korrekten Berechtigungen (Owner: Kunde)</li>
          <li>Das Backup wird automatisch extrahiert (via Kickstart API)</li>
          <li>Die Joomla-Installation ist sofort einsatzbereit!</li>
          <li>Du erhältst Datenbank-Zugangsdaten und kannst die Seite öffnen</li>
        </ol>
      </div>
    </div>
  );
}
