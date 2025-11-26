"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { getCustomerMysqlServers } from "./actions";
import type { FroxlorMysqlServer } from "@/lib/froxlor";

type Props = {
  serverId: string;
  customerNo: string;
  customerDocumentRoot: string;
  standardDomain: string;
  clientId: string;
  clientProjects: {
    id: string;
    title: string | null;
    status: string;
    updatedAt: Date;
  }[];
  isNewCustomer?: boolean; // Flag to indicate if customer was just created
};

type DirectoryStatus = {
  exists: boolean;
  customerExists: boolean;
  documentRoot: string | null;
  loginname?: string;
  message: string;
  checking: boolean;
  pollCount: number;
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
  isNewCustomer = false,
}: Props) {
  const [folderName, setFolderName] = useState("");
  const [dbPassword, setDbPassword] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [mysqlServers, setMysqlServers] = useState<FroxlorMysqlServer[]>([]);
  const [selectedMysqlServerId, setSelectedMysqlServerId] = useState<number | null>(null);
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

  // Directory status for new customers
  const [directoryStatus, setDirectoryStatus] = useState<DirectoryStatus>({
    exists: !isNewCustomer, // Assume exists if not a new customer
    customerExists: true,
    documentRoot: customerDocumentRoot,
    message: isNewCustomer ? "Prüfe Verzeichnis..." : "Verzeichnis bereit",
    checking: isNewCustomer,
    pollCount: 0,
  });
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_POLL_COUNT = 120; // Max 120 attempts = 10 minutes (5 seconds each)

  // Check if customer directory exists
  const checkDirectory = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/check-customer-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId, customerNo }),
      });

      const data = await response.json();

      setDirectoryStatus((prev) => ({
        exists: data.exists || false,
        customerExists: data.customerExists || false,
        documentRoot: data.documentRoot || prev.documentRoot,
        loginname: data.loginname,
        message: data.message || "Unbekannter Status",
        checking: !data.exists && prev.pollCount < MAX_POLL_COUNT,
        pollCount: prev.pollCount + 1,
      }));

      return data.exists;
    } catch (error) {
      console.error("Error checking directory:", error);
      setDirectoryStatus((prev) => ({
        ...prev,
        checking: prev.pollCount < MAX_POLL_COUNT,
        pollCount: prev.pollCount + 1,
        message: "Fehler bei der Verzeichnisprüfung",
      }));
      return false;
    }
  }, [serverId, customerNo]);

  // Start polling for directory when component mounts (for new customers)
  useEffect(() => {
    if (isNewCustomer) {
      // Initial check
      checkDirectory();

      // Start polling every 5 seconds
      pollIntervalRef.current = setInterval(async () => {
        const exists = await checkDirectory();
        if (exists && pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }, 5000);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };
    }
  }, [isNewCustomer, checkDirectory]);

  // Stop polling when max count reached or directory exists
  useEffect(() => {
    if (directoryStatus.exists || directoryStatus.pollCount >= MAX_POLL_COUNT) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setDirectoryStatus((prev) => ({ ...prev, checking: false }));
    }
  }, [directoryStatus.exists, directoryStatus.pollCount]);

  // Generate password and fetch MySQL servers on mount
  useEffect(() => {
    setDbPassword(generatePassword());

    // Fetch customer's allowed MySQL servers
    getCustomerMysqlServers(serverId, customerNo).then((response) => {
      if (response.success && response.servers) {
        setMysqlServers(response.servers);
        // Don't auto-select any server - user must choose explicitly
        // This prevents accidentally using the wrong database server
      }
    });
  }, [serverId, customerNo]);

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

    if (selectedMysqlServerId === null) {
      setResult({
        success: false,
        message: "Bitte MySQL-Server auswählen",
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
          mysqlServerId: selectedMysqlServerId,
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
          mysqlServerId: selectedMysqlServerId, // Pass selected MySQL server ID
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
      setDbPassword(generatePassword());
      setSelectedProjectId("");
      setSelectedMysqlServerId(null);
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
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Joomla installieren</h3>

      <div className="mb-4 rounded bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-3 text-sm">
        <div className="font-medium text-blue-900 dark:text-blue-200 mb-1">Kundeninformationen</div>
        <div className="space-y-1 text-blue-800 dark:text-blue-300">
          <div>Kundennummer: {customerNo}</div>
          <div>Document Root: {customerDocumentRoot}</div>
          <div>Standard-Domain: {standardDomain}</div>
        </div>
      </div>

      {/* Directory Status Check for new customers */}
      {isNewCustomer && (
        <div
          className={`mb-4 rounded border p-4 text-sm ${
            directoryStatus.exists
              ? "border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/30"
              : directoryStatus.checking
              ? "border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/30"
              : "border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30"
          }`}
        >
          <div className="flex items-center gap-3">
            {directoryStatus.checking ? (
              <div className="animate-spin h-5 w-5 border-2 border-yellow-600 dark:border-yellow-400 border-t-transparent rounded-full flex-shrink-0"></div>
            ) : directoryStatus.exists ? (
              <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
            <div className="flex-1">
              <div
                className={`font-medium ${
                  directoryStatus.exists
                    ? "text-green-900 dark:text-green-200"
                    : directoryStatus.checking
                    ? "text-yellow-900 dark:text-yellow-200"
                    : "text-red-900 dark:text-red-200"
                }`}
              >
                {directoryStatus.exists
                  ? "Kundenverzeichnis bereit"
                  : directoryStatus.checking
                  ? "Warte auf Froxlor-Cron..."
                  : "Verzeichnis nicht gefunden"}
              </div>
              <div
                className={`text-xs mt-1 ${
                  directoryStatus.exists
                    ? "text-green-700 dark:text-green-300"
                    : directoryStatus.checking
                    ? "text-yellow-700 dark:text-yellow-300"
                    : "text-red-700 dark:text-red-300"
                }`}
              >
                {directoryStatus.message}
                {directoryStatus.checking && (
                  <span className="ml-2">
                    (Prüfung {directoryStatus.pollCount}/{MAX_POLL_COUNT})
                  </span>
                )}
              </div>
              {!directoryStatus.exists && !directoryStatus.checking && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDirectoryStatus((prev) => ({ ...prev, checking: true, pollCount: 0 }));
                      checkDirectory();
                      pollIntervalRef.current = setInterval(async () => {
                        const exists = await checkDirectory();
                        if (exists && pollIntervalRef.current) {
                          clearInterval(pollIntervalRef.current);
                          pollIntervalRef.current = null;
                        }
                      }, 5000);
                    }}
                    className="text-xs px-3 py-1 rounded bg-yellow-600 dark:bg-yellow-500 text-white hover:bg-yellow-700 dark:hover:bg-yellow-600 transition-colors"
                  >
                    Erneut prüfen
                  </button>
                </div>
              )}
            </div>
          </div>
          {directoryStatus.checking && (
            <div className="mt-3 text-xs text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/50 rounded p-2">
              <strong>Info:</strong> Bei neuen Froxlor-Kunden muss der Froxlor-Cron-Job erst laufen,
              um das Kundenverzeichnis anzulegen. Dies kann bis zu 10 Minuten dauern.
              Die Installation wird automatisch freigeschaltet, sobald das Verzeichnis existiert.
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleInstall} className="space-y-4">
        {clientProjects.length > 0 && (
          <div>
            <label htmlFor="projectId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Projekt zuordnen (optional)
            </label>
            <select
              id="projectId"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full rounded border border-gray-300 dark:border-gray-600 p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              disabled={installing || extracting}
            >
              <option value="">Kein Projekt zuordnen</option>
              {clientProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title} ({project.status}) - {formatRelativeTime(project.updatedAt)} letzter Kontakt
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Wählen Sie ein Projekt aus, um die Installation automatisch zuzuordnen. Die Zeitangabe zeigt, wann das Projekt zuletzt aktualisiert wurde.
            </p>
          </div>
        )}
        <div>
          <label htmlFor="folderName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Ordnername für die Installation
          </label>
          <input
            type="text"
            id="folderName"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="z.B. website2024"
            className="w-full rounded border border-gray-300 dark:border-gray-600 p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            disabled={installing}
            required
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Nur Buchstaben, Zahlen, Bindestriche und Unterstriche erlaubt
          </p>
          {folderName && (
            <div className="mt-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-2 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Installations-URL:</span>{" "}
              <span className="font-mono text-blue-600 dark:text-blue-400">
                {standardDomain}/{folderName}
              </span>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="mysqlServer" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            MySQL-Server für die Datenbank {selectedMysqlServerId === null && <span className="text-red-500 dark:text-red-400">*</span>}
          </label>
          {mysqlServers.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Lade MySQL-Server...</div>
          ) : (
            <select
              id="mysqlServer"
              value={selectedMysqlServerId !== null ? selectedMysqlServerId : ""}
              onChange={(e) => setSelectedMysqlServerId(parseInt(e.target.value))}
              className="w-full rounded border border-gray-300 dark:border-gray-600 p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              disabled={installing || extracting}
              required
            >
              <option value="">Bitte auswählen...</option>
              {mysqlServers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.caption} ({server.host || server.dbserver}{(server.port || server.dbport) ? ` Port ${server.port || server.dbport}` : ''})
                </option>
              ))}
            </select>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Wählen Sie den MySQL-Server aus, auf dem die Joomla-Datenbank erstellt werden soll.
          </p>
        </div>

        <div>
          <label htmlFor="dbPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Datenbank-Passwort
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              id="dbPassword"
              value={dbPassword}
              onChange={(e) => setDbPassword(e.target.value)}
              placeholder="Sicheres Passwort für die MySQL-Datenbank"
              className="flex-1 rounded border border-gray-300 dark:border-gray-600 p-2 font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              disabled={installing}
              required
            />
            <button
              type="button"
              onClick={() => setDbPassword(generatePassword())}
              disabled={installing}
              className="px-4 py-2 rounded border border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              title="Neues Passwort generieren"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Automatisch generiert: 10 Zeichen mit Groß-/Kleinbuchstaben und Zahlen. Sie können es anpassen oder neu generieren.
          </p>
        </div>

        {(installing || extracting) && (
          <div className="rounded border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 p-4 text-sm">
            <div className="flex items-center gap-3">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full"></div>
              <div>
                <div className="font-medium text-blue-900 dark:text-blue-200">
                  {installing ? "Installation wird vorbereitet..." : "Backup wird extrahiert..."}
                </div>
                <div className="text-blue-700 dark:text-blue-300 text-xs mt-1">{currentStep}</div>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div
            className={`rounded border p-3 text-sm ${
              result.success
                ? "border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                : "border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300"
            }`}
          >
            <div className="font-medium mb-1">
              {result.success ? "✓ Erfolg" : "✗ Fehler"}
            </div>
            <div>{result.message}</div>
            {result.success && result.databaseName && (
              <div className="mt-3 space-y-2 pt-2 border-t border-green-200 dark:border-green-700">
                <div className="font-mono text-xs bg-white dark:bg-gray-800 border border-green-200 dark:border-green-700 rounded p-2 text-gray-900 dark:text-gray-100">
                  <div><strong>Datenbank:</strong> {result.databaseName}</div>
                  <div><strong>Benutzer:</strong> {result.databaseName}</div>
                  <div><strong>Passwort:</strong> {result.databasePassword}</div>
                  {result.filesExtracted && (
                    <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-700">
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
              <div className="mt-3 flex gap-3">
                <a
                  href={result.installUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded bg-green-700 dark:bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-800 dark:hover:bg-green-700 transition-colors"
                >
                  → Webseite öffnen
                </a>
                <a
                  href={`/clients/${clientId}`}
                  className="inline-block rounded bg-blue-600 dark:bg-blue-500 px-4 py-2 text-white font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                >
                  ← Zurück zum Kunden
                </a>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={
              installing ||
              extracting ||
              !folderName ||
              !dbPassword ||
              selectedMysqlServerId === null ||
              (isNewCustomer && !directoryStatus.exists)
            }
          >
            {installing || extracting
              ? "Installation läuft..."
              : isNewCustomer && !directoryStatus.exists
              ? "Warte auf Kundenverzeichnis..."
              : "Joomla automatisch installieren"}
          </Button>
        </div>
      </form>

      <div className="mt-6 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 text-xs text-gray-600 dark:text-gray-400">
        <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">Was passiert bei der automatischen Installation?</div>
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
