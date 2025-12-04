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

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks (safe for Next.js body limit)

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
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  // Chunk-basierter Upload für große Dateien
  const uploadFileChunked = async (file: File, type: string) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Für kleine Dateien (< CHUNK_SIZE) direkt hochladen
    if (totalChunks === 1) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      const res = await fetch("/api/admin/joomla-backup/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errorMessage = "Upload fehlgeschlagen";
        try {
          const data = await res.json();
          errorMessage = data.error || errorMessage;
        } catch {
          errorMessage = `Upload fehlgeschlagen: ${res.status} ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }

      setUploadProgress(100);
      return await res.json();
    }

    // Chunk-basierter Upload für große Dateien
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append("chunk", chunk);
      formData.append("chunkIndex", chunkIndex.toString());
      formData.append("totalChunks", totalChunks.toString());
      formData.append("uploadId", uploadId);
      formData.append("fileName", file.name);
      formData.append("type", type);

      const res = await fetch("/api/admin/joomla-backup/upload-chunk", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        // Versuche JSON zu parsen, falls nicht möglich, nutze Statustext
        let errorMessage = `Chunk ${chunkIndex + 1} fehlgeschlagen`;
        try {
          const data = await res.json();
          errorMessage = data.error || errorMessage;
        } catch {
          errorMessage = `Chunk ${chunkIndex + 1} fehlgeschlagen: ${res.status} ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
      setUploadProgress(progress);
    }

    return { success: true, fileName: file.name };
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
    setUploadProgress(0);

    try {
      await uploadFileChunked(file, "kickstart");
      setSuccess("kickstart.php erfolgreich hochgeladen zu Vautron 6");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploadingKickstart(false);
      setUploadProgress(0);
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
    setUploadProgress(0);

    try {
      await uploadFileChunked(file, "backup");
      setSuccess(`Backup ${file.name} erfolgreich hochgeladen zu Vautron 6`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploadingBackup(false);
      setUploadProgress(0);
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
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                Wird hochgeladen... {uploadProgress}%
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
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
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                Wird hochgeladen... {uploadProgress}%
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="rounded-lg border bg-blue-50 p-4">
        <h3 className="mb-2 font-medium text-blue-900">Hinweise</h3>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Die Dateien werden für alle Joomla-Installationen verwendet</li>
          <li>• Beim Upload wird die alte Datei automatisch überschrieben</li>
          <li>• Große Dateien werden automatisch in kleineren Teilen hochgeladen</li>
          <li>• Stelle sicher, dass die kickstart.php mit dem Backup kompatibel ist</li>
          <li>
            • Nach dem Upload können die Dateien in der Basisinstallation verwendet werden
          </li>
        </ul>
      </div>
    </div>
  );
}
