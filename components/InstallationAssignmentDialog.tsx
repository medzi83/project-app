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
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h2 className="text-xl font-bold text-gray-900">
            Demo-Installation zuweisen
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Bitte wähle eine Installation aus oder gib einen benutzerdefinierten Pfad ein.
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
              <h3 className="font-semibold text-gray-900">
                Verfügbare Installationen
              </h3>
              <div className="space-y-2">
                {availableInstallations.map((installation) => (
                  <label
                    key={installation.id}
                    className={`flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                      selectedInstallationId === installation.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
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
                      <div className="font-medium text-gray-900">
                        {installation.folderName}
                      </div>
                      <div className="text-sm text-gray-600 break-all">
                        {installation.installUrl}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">
                Benutzerdefinierte Installation
              </h3>
              <p className="text-sm text-gray-600">
                Keine freien Installationen verfügbar. Bitte gib einen benutzerdefinierten Pfad ein.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-gray-700 font-mono text-sm bg-gray-100 px-3 py-2 rounded border border-gray-300">
                  {defaultDomain}
                </span>
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="/beispiel-ordner"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
              <div className="text-xs text-gray-500">
                Vollständige URL: {defaultDomain}{customPath}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
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
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Speichere..." : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
