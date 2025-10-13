"use client";

import { useState } from "react";
import { Button } from "./ui/button";

export default function ShopwareApiTester() {
  const [url, setUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [status, setStatus] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });

  const testConnection = async () => {
    setStatus({ type: "loading", message: "Verbindung wird getestet..." });

    try {
      // Shopware 6 OAuth Token Request
      const tokenResponse = await fetch(`${url}/api/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        throw new Error(
          errorData.errors?.[0]?.detail ||
            `HTTP ${tokenResponse.status}: ${tokenResponse.statusText}`
        );
      }

      const tokenData = await tokenResponse.json();

      // Test API access with the token
      const testResponse = await fetch(`${url}/api/_info/version`, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (!testResponse.ok) {
        throw new Error(`API Test fehlgeschlagen: ${testResponse.statusText}`);
      }

      const versionData = await testResponse.json();

      setStatus({
        type: "success",
        message: `✓ Verbindung erfolgreich! Shopware Version: ${versionData.version}`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: `✗ Verbindung fehlgeschlagen: ${
          error instanceof Error ? error.message : "Unbekannter Fehler"
        }`,
      });
    }
  };

  return (
    <div className="border rounded-lg p-6 space-y-4 max-w-2xl">
      <div className="space-y-2">
        <label className="block text-sm font-medium">Shop URL</label>
        <input
          type="text"
          placeholder="https://ihr-shop.de"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Client ID</label>
        <input
          type="text"
          placeholder="SWIACXXXXXXXXXXX"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Client Secret</label>
        <input
          type="password"
          placeholder="••••••••••••••••"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <Button
        onClick={testConnection}
        disabled={!url || !clientId || !clientSecret || status.type === "loading"}
        className="w-full"
      >
        {status.type === "loading" ? "Teste..." : "Testen"}
      </Button>

      {status.message && (
        <div
          className={`p-4 rounded-md ${
            status.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : status.type === "error"
              ? "bg-red-50 text-red-800 border border-red-200"
              : "bg-blue-50 text-blue-800 border border-blue-200"
          }`}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
