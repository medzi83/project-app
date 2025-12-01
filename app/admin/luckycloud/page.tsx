import { getAuthSession } from '@/lib/authz';
import { redirect } from 'next/navigation';
import { Cloud, Server, AlertCircle, FolderOpen } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LuckyCloudConnectionTest } from './connection-test';
import { LuckyCloudFileExplorer } from './file-explorer';

async function checkLuckyCloudConfig() {
  const eventomaxxUrl = process.env.LUCKYCLOUD_EVENTOMAXX_URL;
  const eventomaxxUsername = process.env.LUCKYCLOUD_EVENTOMAXX_USERNAME;
  const eventomaxxPassword = process.env.LUCKYCLOUD_EVENTOMAXX_PASSWORD;

  return {
    eventomaxx: {
      configured: !!(eventomaxxUrl && eventomaxxUsername && eventomaxxPassword),
      url: eventomaxxUrl || 'Nicht konfiguriert',
      username: eventomaxxUsername || 'Nicht konfiguriert',
    },
    vendoweb: {
      configured: false,
      url: 'Wird später eingerichtet',
      username: 'Wird später eingerichtet',
    },
  };
}

export default async function LuckyCloudPage() {
  const session = await getAuthSession();
  if (!session) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/dashboard');

  const config = await checkLuckyCloudConfig();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg">
          <Cloud className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Luckycloud Integration</h1>
          <p className="text-sm text-muted-foreground">
            Cloud-Speicher für Kundenmaterialien (Bilder & Dateien)
          </p>
        </div>
      </div>

      {/* Configuration Status */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Eventomaxx Config */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Eventomaxx</CardTitle>
              </div>
              <Badge variant={config.eventomaxx.configured ? 'default' : 'secondary'}>
                {config.eventomaxx.configured ? 'Konfiguriert' : 'Nicht konfiguriert'}
              </Badge>
            </div>
            <CardDescription>
              Luckycloud-Zugang für die Agentur Eventomaxx
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">API URL:</span>
                <code className="rounded bg-muted px-2 py-1 text-xs truncate max-w-[200px]">
                  {config.eventomaxx.url}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Benutzer:</span>
                <code className="rounded bg-muted px-2 py-1 text-xs">
                  {config.eventomaxx.username}
                </code>
              </div>
            </div>

            {!config.eventomaxx.configured && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Bitte folgende Umgebungsvariablen setzen:
                  <br />
                  <code>LUCKYCLOUD_EVENTOMAXX_URL</code>
                  <br />
                  <code>LUCKYCLOUD_EVENTOMAXX_USERNAME</code>
                  <br />
                  <code>LUCKYCLOUD_EVENTOMAXX_PASSWORD</code>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Vendoweb Config (Placeholder) */}
        <Card className="opacity-60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Vendoweb</CardTitle>
              </div>
              <Badge variant="outline">
                Später
              </Badge>
            </div>
            <CardDescription>
              Luckycloud-Zugang für die Agentur Vendoweb
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Wird in einem späteren Schritt eingerichtet.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Connection Test */}
      {config.eventomaxx.configured && (
        <Card>
          <CardHeader>
            <CardTitle>Verbindungstest</CardTitle>
            <CardDescription>
              Teste die Verbindung zur Luckycloud API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LuckyCloudConnectionTest agency="eventomaxx" />
          </CardContent>
        </Card>
      )}

      {/* File Explorer */}
      {config.eventomaxx.configured && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Datei-Explorer
            </CardTitle>
            <CardDescription>
              Durchsuche die Luckycloud-Bibliotheken und verwalte Dateien
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LuckyCloudFileExplorer agency="eventomaxx" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
