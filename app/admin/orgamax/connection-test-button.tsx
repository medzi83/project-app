"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw } from 'lucide-react';

type ConnectionTestButtonProps = {
  apiUrl: string;
};

export function ConnectionTestButton({ apiUrl }: ConnectionTestButtonProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{
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

      const data = await response.json();

      if (response.ok && data.success) {
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
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Verbindungsfehler',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-2">
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
        Client-seitig testen
      </Button>

      {result && (
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={result.success ? 'default' : 'destructive'}>
            {result.success ? 'Erfolgreich' : 'Fehler'}
          </Badge>
          <span className="text-muted-foreground">{result.message}</span>
        </div>
      )}
    </div>
  );
}
