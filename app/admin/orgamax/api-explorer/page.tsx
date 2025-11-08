"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Code, Database, PlayCircle, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { OrgamaxNav } from '@/components/orgamax-nav';

export default function OrgamaxApiExplorerPage() {
  const [mandant, setMandant] = useState<1 | 2 | 4>(4);
  const [custno, setCustno] = useState('');
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM V_SUCHE_ADRESSFELDER WHERE ROWNUM <= 5');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testEndpoint = async (endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(endpoint, options);
      const data = await response.json();

      setResult({
        status: response.status,
        statusText: response.statusText,
        data,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim API-Aufruf');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg">
          <Database className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orgamax API Explorer</h1>
          <p className="text-sm text-muted-foreground">
            Teste alle verfügbaren Endpoints und erkunde die API
          </p>
        </div>
      </div>

      {/* Navigation */}
      <OrgamaxNav />

      {/* Mandant Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Mandant auswählen</CardTitle>
          <CardDescription>Wähle den Mandanten für die API-Aufrufe</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={mandant.toString()}
            onValueChange={(value) => setMandant(Number(value) as 1 | 2 | 4)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Mandant 1</SelectItem>
              <SelectItem value="2">Mandant 2</SelectItem>
              <SelectItem value="4">Mandant 4</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Test Endpoints */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Health Check */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">GET</Badge>
              Health Check
            </CardTitle>
            <CardDescription>/api/orgamax/test-connection</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => testEndpoint('/api/orgamax/test-connection')}
              disabled={loading}
              className="w-full gap-2"
            >
              <PlayCircle className="h-4 w-4" />
              Test ausführen
            </Button>
          </CardContent>
        </Card>

        {/* Get All Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">GET</Badge>
              Alle Kunden
            </CardTitle>
            <CardDescription>/api/orgamax/customers?mandant={mandant}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => testEndpoint(`/api/orgamax/customers?mandant=${mandant}`)}
              disabled={loading}
              className="w-full gap-2"
            >
              <PlayCircle className="h-4 w-4" />
              Test ausführen
            </Button>
          </CardContent>
        </Card>

        {/* Get Single Customer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">GET</Badge>
              Einzelner Kunde
            </CardTitle>
            <CardDescription>/api/orgamax/customers/:custno?mandant={mandant}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="number"
              placeholder="Kundennummer eingeben..."
              value={custno}
              onChange={(e) => setCustno(e.target.value)}
            />
            <Button
              onClick={() => testEndpoint(`/api/orgamax/customers/${custno}?mandant=${mandant}`)}
              disabled={loading || !custno}
              className="w-full gap-2"
            >
              <PlayCircle className="h-4 w-4" />
              Test ausführen
            </Button>
          </CardContent>
        </Card>

        {/* SQL Query */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">POST</Badge>
              SQL-Abfrage
            </CardTitle>
            <CardDescription>/api/orgamax/query</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="SELECT * FROM ..."
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              rows={4}
              className="font-mono text-sm"
            />
            <Button
              onClick={() =>
                testEndpoint('/api/orgamax/query', 'POST', {
                  sql: sqlQuery,
                  mandant,
                })
              }
              disabled={loading || !sqlQuery}
              className="w-full gap-2"
            >
              <PlayCircle className="h-4 w-4" />
              Abfrage ausführen
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Result Display */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                API Response
              </CardTitle>
              <Badge
                variant={result.status === 200 ? 'default' : 'destructive'}
                className="gap-1"
              >
                {result.status === 200 ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <AlertCircle className="h-3 w-3" />
                )}
                {result.status} {result.statusText}
              </Badge>
            </div>
            <CardDescription>
              {result.data?.count && `${result.data.count} Einträge gefunden`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-slate-950 p-4">
              <pre className="overflow-auto text-xs text-slate-50">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
