"use client";

import { useState } from "react";
import { deleteTexterstellung } from "./texterstellung/actions";

type Props = {
  texterstellungId: string;
  projectId: string;
};

export default function DeleteTexterstellungButton({ texterstellungId, projectId }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteTexterstellung(texterstellungId, projectId);
      setShowConfirm(false);
    } catch (err) {
      console.error("Fehler beim Löschen:", err);
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
      >
        Zurücksetzen
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setShowConfirm(false)}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Texterstellung zurücksetzen?
                  </h3>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Die gesamte Texterstellung wird gelöscht. Alle erstellten Texte gehen unwiderruflich verloren. Die Stichpunkte in der Webdokumentation bleiben erhalten und die Texterstellung kann neu gestartet werden.
              </p>
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {deleting ? "Wird gelöscht..." : "Ja, zurücksetzen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
