"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Installation = {
  id: string;
  folderName: string;
  installUrl: string;
};

type Props = {
  isOpen: boolean;
  projectId: string;
  clientId: string;
  availableInstallations: Installation[];
  defaultDomain: string;
  onClose: () => void;
};

export function InstallationAssignmentDialog({
  isOpen,
  projectId,
  clientId,
  availableInstallations,
  defaultDomain,
  onClose,
}: Props) {
  const router = useRouter();
  const [selectedInstallationId, setSelectedInstallationId] = useState<string | null>(
    availableInstallations.length > 0 ? availableInstallations[0].id : null
  );
  const [customPath, setCustomPath] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/projects/assign-installation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          installationId: selectedInstallationId,
          customPath: selectedInstallationId ? undefined : customPath,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fehler beim Zuweisen der Installation");
      }

      const result = await response.json();

      // Close this dialog first
      onClose();

      // If there are email queue IDs, trigger email confirmation dialog
      if (result.queueIds && result.queueIds.length > 0) {
        // Dispatch event to trigger email confirmation handler
        const event = new CustomEvent("emailConfirmationNeeded", {
          detail: { queueIds: result.queueIds },
        });
        window.dispatchEvent(event);
      } else {
        // No email triggers, just refresh the page
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-gray-800 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Demo-Link zuweisen
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Bitte wähle eine Installation aus oder gib einen benutzerdefinierten Demo-Link ein.
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {availableInstallations.length > 0 ? (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Verfügbare Installationen
              </h3>
              <div className="space-y-2">
                {availableInstallations.map((installation) => (
                  <label
                    key={installation.id}
                    className={`flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                      selectedInstallationId === installation.id
                        ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30"
                        : "border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="installation"
                      value={installation.id}
                      checked={selectedInstallationId === installation.id}
                      onChange={() => setSelectedInstallationId(installation.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {installation.folderName}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300 break-all">
                        {installation.installUrl}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Benutzerdefinierter Demo-Link
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Keine freien Installationen verfügbar. Bitte gib einen benutzerdefinierten Demo-Link ein.
              </p>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Demo-Link URL:
                </label>
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="https://demo.beispiel.de/ordner"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Gib die vollständige URL zum Demo-Link ein (z.B. https://demo.beispiel.de/ordner)
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-700 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              (availableInstallations.length === 0 && !customPath.trim())
            }
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Speichere..." : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
