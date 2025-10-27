"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DeleteInstallationButtonProps = {
  installationId: string;
  installationName: string;
};

export function DeleteInstallationButton({
  installationId,
  installationName,
}: DeleteInstallationButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteResult, setDeleteResult] = useState<{
    message: string;
    details: {
      filesDeleted: boolean;
      filesMessage: string;
      databaseDeleted: boolean;
      databaseMessage: string;
      recordDeleted: boolean;
    };
  } | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    setDeleteResult(null);

    try {
      const response = await fetch(
        `/api/admin/joomla-installations/${installationId}/delete`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (data.success) {
        setDeleteResult(data);
        // Refresh the page after a short delay to show the success message
        setTimeout(() => {
          router.refresh();
        }, 2000);
      } else {
        setError(data.message || "Fehler beim Löschen der Installation");
        setDeleteResult(data);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unbekannter Fehler beim Löschen der Installation"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Installation löschen?
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                Möchten Sie die Installation <strong>{installationName}</strong>{" "}
                wirklich löschen?
              </p>
              <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-800">
                <p className="font-semibold mb-1">Diese Aktion wird folgendes löschen:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Alle Dateien im Installationsverzeichnis</li>
                  <li>Die zugehörige Datenbank</li>
                  <li>Den Datensatz aus der Projektverwaltung</li>
                </ul>
                <p className="mt-2 font-semibold">
                  Diese Aktion kann nicht rückgängig gemacht werden!
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              <p className="font-medium mb-1">Fehler beim Löschen:</p>
              <p>{error}</p>
            </div>
          )}

          {deleteResult && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
              <p className="font-medium text-blue-900 mb-2">Lösch-Details:</p>
              <div className="space-y-2 text-blue-800">
                <div className="flex items-start gap-2">
                  <span className={deleteResult.details.filesDeleted ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                    {deleteResult.details.filesDeleted ? "✓" : "✗"}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium">Dateien:</div>
                    <div className="text-xs mt-0.5 break-words">{deleteResult.details.filesMessage}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className={deleteResult.details.databaseDeleted ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                    {deleteResult.details.databaseDeleted ? "✓" : "✗"}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium">Datenbank:</div>
                    <div className="text-xs mt-0.5 break-words">{deleteResult.details.databaseMessage}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className={deleteResult.details.recordDeleted ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                    {deleteResult.details.recordDeleted ? "✓" : "✗"}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium">Datensatz:</div>
                    <div className="text-xs mt-0.5">{deleteResult.details.recordDeleted ? "Erfolgreich gelöscht" : "Nicht gelöscht"}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => {
                setShowConfirm(false);
                setError(null);
                setDeleteResult(null);
              }}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Wird gelöscht...
                </>
              ) : (
                "Ja, jetzt löschen"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShowConfirm(true)}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition"
      title="Installation löschen"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
      Löschen
    </button>
  );
}
