import { Suspense } from 'react';
import { getAuthSession } from '@/lib/authz';
import { redirect } from 'next/navigation';
import { Database, Server, Users, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { OrgamaxCustomersTable } from './customers-table';
import { ConnectionTestButton } from './connection-test-button';
import { OrgamaxNav } from '@/components/orgamax-nav';

async function checkOrgamaxConnection() {
  const apiUrl = process.env.ORGAMAX_API_URL;
  const apiKey = process.env.ORGAMAX_API_KEY;

  if (!apiUrl || !apiKey) {
    return {
      configured: false,
      connected: false,
      message: 'Orgamax API ist nicht konfiguriert. Bitte Umgebungsvariablen setzen.',
    };
  }

  try {
    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${apiUrl}/api/health`, {
      headers: {
        'x-api-key': apiKey,
      },
      signal: controller.signal,
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (response.ok && data.success) {
      return {
        configured: true,
        connected: true,
        message: 'Verbindung erfolgreich',
        apiUrl,
      };
    }

    return {
      configured: true,
      connected: false,
      message: data.error || 'Verbindung fehlgeschlagen',
      apiUrl,
    };
  } catch (error) {
    let errorMessage = 'Verbindungsfehler';

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Verbindungstimeout (5s) - Server nicht erreichbar';
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Verbindung verweigert - Service läuft nicht oder Port geschlossen';
      } else if (error.message.includes('ETIMEDOUT')) {
        errorMessage = 'Verbindungstimeout - Netzwerkproblem oder Firewall';
      } else if (error.message.includes('EHOSTUNREACH')) {
        errorMessage = 'Host nicht erreichbar - IP-Adresse nicht im Netzwerk';
      } else if (error.message.includes('fetch failed')) {
        errorMessage = 'Fetch fehlgeschlagen - Server möglicherweise nicht im Netzwerk erreichbar';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      configured: true,
      connected: false,
      message: errorMessage,
      apiUrl,
    };
  }
}

export default async function OrgamaxPage() {
  const session = await getAuthSession();
  if (!session) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/dashboard');

  const connectionStatus = await checkOrgamaxConnection();

  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Orgamax ERP Integration</h1>
            <p className="text-sm text-muted-foreground">
              Kundendaten aus dem Orgamax ERP System
            </p>
          </div>
        </div>

        {/* Navigation */}
        <OrgamaxNav />

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Verbindungsstatus</CardTitle>
              </div>
              <Badge variant={connectionStatus.connected ? 'default' : 'destructive'}>
                {connectionStatus.connected ? 'Verbunden' : 'Getrennt'}
              </Badge>
            </div>
            <CardDescription>
              Status der Verbindung zum Orgamax ODBC API Service
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!connectionStatus.configured ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{connectionStatus.message}</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">API URL:</span>
                    <code className="rounded bg-muted px-2 py-1 text-xs">
                      {connectionStatus.apiUrl}
                    </code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Status:</span>
                    <span>{connectionStatus.message}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Verfügbare Mandanten:</span>
                    <div className="flex gap-1">
                      <Badge variant="outline">1</Badge>
                      <Badge variant="outline">2</Badge>
                      <Badge variant="outline">4</Badge>
                    </div>
                  </div>
                </div>

                {!connectionStatus.connected && (
                  <>
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Die Verbindung zum Orgamax API Service konnte nicht hergestellt werden (Server-seitig).
                        Der Test erfolgte vom Next.js-Server aus. Versuchen Sie einen Client-seitigen Test:
                      </AlertDescription>
                    </Alert>
                    <ConnectionTestButton apiUrl={connectionStatus.apiUrl!} />
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        <strong>Hinweis:</strong> Der Server-seitige Test schlägt fehl, wenn der Next.js-Entwicklungsserver
                        die lokale Netzwerk-IP {connectionStatus.apiUrl} nicht erreichen kann (z.B. Firewall, VPN).
                        Der Client-seitige Test wird direkt aus Ihrem Browser durchgeführt und sollte funktionieren,
                        wenn Sie sich im gleichen Netzwerk befinden.
                      </AlertDescription>
                    </Alert>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Features */}
        {connectionStatus.connected && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">Kundenverwaltung</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Zugriff auf alle Kundendaten aus dem Orgamax System. Durchsuche und filtere Kunden nach Namen, Kundennummer, Stadt oder E-Mail.
                  </p>
                  <Button asChild className="w-full">
                    <Link href="/admin/orgamax/customers">Kunden anzeigen</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-indigo-600" />
                    <CardTitle className="text-lg">API Explorer</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Teste alle API-Endpoints, führe SQL-Abfragen aus und erkunde die Datenstruktur der Orgamax-Datenbank.
                  </p>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/admin/orgamax/api-explorer">API Explorer öffnen</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Recent Customers Preview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Aktuelle Kunden</CardTitle>
                    <CardDescription>
                      Übersicht der letzten Kunden aus Mandant 1
                    </CardDescription>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/admin/orgamax/customers">Alle anzeigen</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<div className="text-sm text-muted-foreground">Lade Kundendaten...</div>}>
                  <OrgamaxCustomersTable mandant={1} limit={10} />
                </Suspense>
              </CardContent>
            </Card>
          </>
        )}

        {/* Documentation */}
        <Card>
          <CardHeader>
            <CardTitle>Dokumentation</CardTitle>
            <CardDescription>
              Informationen zur Orgamax API Integration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <h3 className="font-semibold">Verfügbare Endpoints:</h3>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                <li>
                  <code className="text-xs">GET /api/health</code> - Status-Check
                </li>
                <li>
                  <code className="text-xs">GET /api/test-connection?mandant=X</code> - Verbindungstest
                </li>
                <li>
                  <code className="text-xs">GET /api/customers?mandant=X</code> - Alle Kunden
                </li>
                <li>
                  <code className="text-xs">GET /api/customers/:custno?mandant=X</code> - Einzelner Kunde
                </li>
                <li>
                  <code className="text-xs">POST /api/query</code> - Freie SQL-Abfragen
                </li>
              </ul>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Hinweis:</strong> Die lokale IP 192.168.1.138 funktioniert nur im lokalen Netzwerk.
                Für ein Vercel-Deployment wird eine öffentlich erreichbare IP oder VPN-Lösung benötigt.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
  );
}
