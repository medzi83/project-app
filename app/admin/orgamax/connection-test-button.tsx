"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, TestTube } from 'lucide-react';

type ConnectionTestButtonProps = {
  apiUrl: string;
};

export function ConnectionTestButton({ apiUrl }: ConnectionTestButtonProps) {
  const [testing, setTesting] = useState(false);
  const [testingDirect, setTestingDirect] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [directResult, setDirectResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const testConnection = async () => {
    setTesting(true);
    setResult(null);

    try {
      // Use our secure API route that will test the connection server-side
      // This avoids exposing the API key to the client
      const response = await fetch('/api/orgamax/test-connection');

      if (!response.ok) {
        const errorText = await response.text();
        setResult({
          success: false,
          message: `HTTP ${response.status}: ${errorText || response.statusText}`,
        });
        return;
      }

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: data.message || 'Verbindung erfolgreich',
        });
      } else {
        setResult({
          success: false,
          message: data.error || 'Verbindung fehlgeschlagen',
        });
      }
    } catch (error) {
      console.error('Connection test error:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unbekannter Fehler beim Verbindungstest',
      });
    } finally {
      setTesting(false);
    }
  };

  const testDirectConnection = async () => {
    setTestingDirect(true);
    setDirectResult(null);

    try {
      // Test direct connection to Orgamax API (without API key, just to check connectivity)
      const response = await fetch(`${apiUrl}/api/health`, {
        method: 'GET',
        mode: 'cors',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setDirectResult({
          success: true,
          message: 'Direkte Verbindung erfolgreich! API ist erreichbar.',
        });
      } else {
        setDirectResult({
          success: false,
          message: data.error || `HTTP ${response.status}: ${response.statusText}`,
        });
      }
    } catch (error) {
      console.error('Direct connection test error:', error);
      setDirectResult({
        success: false,
        message: error instanceof Error ? error.message : 'Direkte Verbindung fehlgeschlagen',
      });
    } finally {
      setTestingDirect(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          onClick={testConnection}
          disabled={testing}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          {testing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Via API-Route testen
        </Button>

        <Button
          onClick={testDirectConnection}
          disabled={testingDirect}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          {testingDirect ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <TestTube className="h-4 w-4" />
          )}
          Direkt vom Browser
        </Button>
      </div>

      {result && (
        <div className="rounded-md border border-border bg-muted/50 p-3">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={result.success ? 'default' : 'destructive'}>
              {result.success ? 'Erfolgreich' : 'Fehler'}
            </Badge>
            <span className="font-medium">Via API-Route:</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{result.message}</p>
        </div>
      )}

      {directResult && (
        <div className="rounded-md border border-border bg-muted/50 p-3">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={directResult.success ? 'default' : 'destructive'}>
              {directResult.success ? 'Erfolgreich' : 'Fehler'}
            </Badge>
            <span className="font-medium">Direkt vom Browser:</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{directResult.message}</p>
        </div>
      )}
    </div>
  );
}
