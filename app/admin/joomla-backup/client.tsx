"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  kickstartExists: boolean;
  backupExists: boolean;
  backupFileName: string;
  kickstartSize: number;
  backupSize: number;
};

export default function JoomlaBackupClient({
  kickstartExists,
  backupExists,
  backupFileName,
  kickstartSize,
  backupSize,
}: Props) {
  const router = useRouter();
  const [uploadingKickstart, setUploadingKickstart] = useState(false);
  const [uploadingBackup, setUploadingBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const handleKickstartUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name !== "kickstart.php") {
      setError("Die Datei muss 'kickstart.php' heißen");
      return;
    }

    setUploadingKickstart(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "kickstart");

    try {
      const res = await fetch("/api/admin/joomla-backup/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload fehlgeschlagen");
      }

      setSuccess("kickstart.php erfolgreich hochgeladen");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploadingKickstart(false);
    }
  };

  const handleBackupUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".jpa") && !file.name.endsWith(".zip")) {
      setError("Die Datei muss eine .jpa oder .zip Datei sein");
      return;
    }

    setUploadingBackup(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "backup");

    try {
      const res = await fetch("/api/admin/joomla-backup/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload fehlgeschlagen");
      }

      setSuccess(`Backup ${file.name} erfolgreich hochgeladen`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploadingBackup(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Joomla Backup-Verwaltung</h1>
        <p className="text-sm text-gray-500">
          Verwalte die kickstart.php und Backup-Datei für Joomla-Installationen
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {success}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Kickstart.php Upload */}
        <section className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">kickstart.php</h2>

          {kickstartExists ? (
            <div className="mb-4 rounded bg-green-50 p-4">
              <div className="flex items-center gap-2 text-green-800">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-medium">Datei vorhanden</span>
              </div>
              <div className="mt-2 text-sm text-gray-700">
                Größe: {formatFileSize(kickstartSize)}
              </div>
            </div>
          ) : (
            <div className="mb-4 rounded bg-yellow-50 p-4 text-sm text-yellow-800">
              Noch keine kickstart.php hochgeladen
            </div>
          )}

          <div>
            <label className="block">
              <span className="sr-only">kickstart.php hochladen</span>
              <input
                type="file"
                accept=".php"
                onChange={handleKickstartUpload}
                disabled={uploadingKickstart}
                className="block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
            </label>
            <p className="mt-2 text-xs text-gray-500">
              Die Datei muss exakt &quot;kickstart.php&quot; heißen. Die alte Datei wird
              überschrieben.
            </p>
          </div>

          {uploadingKickstart && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
              Wird hochgeladen...
            </div>
          )}
        </section>

        {/* Backup Upload */}
        <section className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Joomla Backup</h2>

          {backupExists ? (
            <div className="mb-4 rounded bg-green-50 p-4">
              <div className="flex items-center gap-2 text-green-800">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-medium">Backup vorhanden</span>
              </div>
              <div className="mt-2 space-y-1 text-sm text-gray-700">
                <div>Dateiname: {backupFileName}</div>
                <div>Größe: {formatFileSize(backupSize)}</div>
              </div>
            </div>
          ) : (
            <div className="mb-4 rounded bg-yellow-50 p-4 text-sm text-yellow-800">
              Noch kein Backup hochgeladen
            </div>
          )}

          <div>
            <label className="block">
              <span className="sr-only">Backup hochladen</span>
              <input
                type="file"
                accept=".jpa,.zip"
                onChange={handleBackupUpload}
                disabled={uploadingBackup}
                className="block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
            </label>
            <p className="mt-2 text-xs text-gray-500">
              Erlaubte Formate: .jpa, .zip. Die alte Backup-Datei wird überschrieben.
            </p>
          </div>

          {uploadingBackup && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
              Wird hochgeladen...
            </div>
          )}
        </section>
      </div>

      <div className="rounded-lg border bg-blue-50 p-4">
        <h3 className="mb-2 font-medium text-blue-900">Hinweise</h3>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Die Dateien werden für alle Joomla-Installationen verwendet</li>
          <li>• Beim Upload wird die alte Datei automatisch überschrieben</li>
          <li>• Stelle sicher, dass die kickstart.php mit dem Backup kompatibel ist</li>
          <li>
            • Nach dem Upload können die Dateien in der Basisinstallation verwendet werden
          </li>
        </ul>
      </div>
    </div>
  );
}
