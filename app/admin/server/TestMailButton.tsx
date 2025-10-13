"use client";

import { useState } from "react";

type TestMailButtonProps = {
  mailServerId: string;
  host: string;
  port: number;
  fromEmail: string;
  fromName: string | null;
  username: string | null;
  useTls: boolean;
};

export function TestMailButton({
  mailServerId,
  host,
  port,
  fromEmail,
  fromName,
  username,
  useTls,
}: TestMailButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    if (!testEmail.trim()) {
      setResult({ success: false, message: "Bitte geben Sie eine Ziel-E-Mail-Adresse ein" });
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      const response = await fetch("/api/test-mail-server", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mailServerId,
          testEmail: testEmail.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({ success: true, message: data.message || "Test-E-Mail erfolgreich versendet!" });
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

  const hasBasicConfig = host && port && fromEmail;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={!hasBasicConfig}
        className="rounded border px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        title={!hasBasicConfig ? "Bitte Host, Port und Absender-E-Mail eingeben" : "Verbindung testen"}
      >
        Test
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-[320px] space-y-3 rounded-lg border bg-white p-4 shadow-xl">
            <div>
              <h3 className="text-sm font-semibold mb-1">Mailserver testen</h3>
              <p className="text-xs text-gray-600 mb-3">
                Senden Sie eine Test-E-Mail, um die Verbindung zu überprüfen.
              </p>
              <div className="space-y-2 mb-3">
                <div className="text-xs text-gray-500">
                  <div><strong>Host:</strong> {host}:{port}</div>
                  <div><strong>Von:</strong> {fromName ? `${fromName} <${fromEmail}>` : fromEmail}</div>
                  {username && <div><strong>Benutzer:</strong> {username}</div>}
                  <div><strong>Verschlüsselung:</strong> {useTls ? "TLS / STARTTLS" : "Keine"}</div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Ziel-E-Mail-Adresse *
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.de"
                className="w-full rounded border p-2 text-sm"
                disabled={testing}
              />
            </div>

            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !testEmail.trim()}
              className="w-full rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/90"
            >
              {testing ? "Sende Test-E-Mail..." : "Test-E-Mail senden"}
            </button>

            {result && (
              <div
                className={`text-xs p-3 rounded ${
                  result.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {result.message}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full text-xs text-gray-500 hover:text-gray-700"
            >
              Schließen
            </button>
          </div>
        </>
      )}
    </div>
  );
}
