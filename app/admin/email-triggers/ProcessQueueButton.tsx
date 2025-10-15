"use client";

import { useState } from "react";

export function ProcessQueueButton() {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  async function handleProcess() {
    setProcessing(true);
    setResult(null);

    try {
      const response = await fetch("/api/email/process-queue", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to process queue");
      }

      const data = await response.json();
      setResult(data.results);

      // Reload page to show updated queue count
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("Error processing queue:", error);
      alert("Fehler beim Verarbeiten der Warteschlange");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleProcess}
        disabled={processing}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-50"
      >
        {processing ? "Verarbeite..." : "E-Mail-Warteschlange jetzt verarbeiten"}
      </button>

      {result && (
        <div className="text-sm">
          <p className="text-green-700">
            ✓ {result.success} E-Mail(s) erfolgreich versendet
          </p>
          {result.failed > 0 && (
            <div className="text-red-700">
              <p>✗ {result.failed} E-Mail(s) fehlgeschlagen</p>
              {result.errors.length > 0 && (
                <ul className="ml-4 mt-1 list-disc text-xs">
                  {result.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
