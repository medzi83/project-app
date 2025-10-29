"use client";

import { useState } from "react";

type TestConnectionButtonProps = {
  froxlorUrl: string | null;
  froxlorApiKey: string | null;
  froxlorApiSecret: string | null;
  froxlorVersion: string | null;
};

export function TestConnectionButton({
  froxlorUrl,
  froxlorApiKey,
  froxlorApiSecret,
  froxlorVersion,
}: TestConnectionButtonProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);

    try {
      const response = await fetch("/api/test-server-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          froxlorUrl,
          froxlorApiKey,
          froxlorApiSecret,
          froxlorVersion: froxlorVersion || "2.0+",
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({ success: true, message: data.message });
      } else {
        setResult({ success: false, message: data.error || "Test fehlgeschlagen" });
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Netzwerkfehler beim Test",
      });
    } finally {
      setTesting(false);
    }
  };

  const hasCredentials = froxlorUrl && froxlorApiKey && froxlorApiSecret;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleTest}
        disabled={!hasCredentials || testing}
        className="rounded border px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        title={!hasCredentials ? "Bitte alle Zugangsdaten eingeben" : "Verbindung testen"}
      >
        {testing ? "Teste..." : "Verbindung testen"}
      </button>
      {result && (
        <div
          className={`text-xs p-2 rounded ${
            result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}
