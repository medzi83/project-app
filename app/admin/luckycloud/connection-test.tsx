'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

type ConnectionStatus = {
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
  details?: {
    ping?: boolean;
    authPing?: boolean;
    repos?: number;
    tokenPreview?: string;
  };
};

export function LuckyCloudConnectionTest({ agency }: { agency: 'eventomaxx' | 'vendoweb' }) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ status: 'idle' });

  const testConnection = async () => {
    setConnectionStatus({ status: 'loading' });

    try {
      const response = await fetch(`/api/admin/luckycloud/test-connection?agency=${agency}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setConnectionStatus({
          status: 'success',
          message: 'Verbindung erfolgreich!',
          details: data.details,
        });
      } else {
        setConnectionStatus({
          status: 'error',
          message: data.error || 'Verbindung fehlgeschlagen',
          details: data.details,
        });
      }
    } catch (error) {
      setConnectionStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          onClick={testConnection}
          disabled={connectionStatus.status === 'loading'}
          className="gap-2"
        >
          {connectionStatus.status === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Verbindung testen
        </Button>

        {connectionStatus.status !== 'idle' && connectionStatus.status !== 'loading' && (
          <Badge variant={connectionStatus.status === 'success' ? 'default' : 'destructive'}>
            {connectionStatus.status === 'success' ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Verbunden
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Fehler
              </span>
            )}
          </Badge>
        )}
      </div>

      {connectionStatus.status === 'success' && connectionStatus.details && (
        <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 p-4 space-y-2">
          <h4 className="font-medium text-green-800 dark:text-green-200">Testergebnisse:</h4>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Ping (ohne Auth):</span>
              <Badge variant={connectionStatus.details.ping ? 'default' : 'secondary'}>
                {connectionStatus.details.ping ? 'OK' : 'Fehler'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Auth Ping:</span>
              <Badge variant={connectionStatus.details.authPing ? 'default' : 'secondary'}>
                {connectionStatus.details.authPing ? 'OK' : 'Fehler'}
              </Badge>
            </div>
            {connectionStatus.details.repos !== undefined && (
              <div className="flex items-center justify-between">
                <span>Gefundene Bibliotheken:</span>
                <Badge variant="outline">{connectionStatus.details.repos}</Badge>
              </div>
            )}
            {connectionStatus.details.tokenPreview && (
              <div className="flex items-center justify-between">
                <span>Token:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {connectionStatus.details.tokenPreview}...
                </code>
              </div>
            )}
          </div>
        </div>
      )}

      {connectionStatus.status === 'error' && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{connectionStatus.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
