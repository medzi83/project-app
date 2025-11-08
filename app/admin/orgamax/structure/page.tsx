"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, Loader2, AlertCircle, CheckCircle, Table as TableIcon } from 'lucide-react';
import { OrgamaxNav } from '@/components/orgamax-nav';

type ExploreResult = {
  name: string;
  data: any;
  error?: string;
};

export default function OrgamaxStructurePage() {
  const [mandant, setMandant] = useState<1 | 2 | 4>(4);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ExploreResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const exploreStructure = async () => {
    setLoading(true);
    setError(null);
    setResults([]);

    const queries = [
      {
        name: 'V_DERP_EMPLOYEES',
        description: 'Mitarbeiter-View - Alle Felder',
        sql: 'SELECT * FROM V_DERP_EMPLOYEES',
      },
      {
        name: 'MOV_ACTIVITIES',
        description: 'Aufwände/Aktivitäten - Letzte 10',
        sql: 'SELECT FIRST 10 * FROM MOV_ACTIVITIES ORDER BY ID DESC',
      },
      {
        name: 'MOV_ACTIVITIES_SEARCH',
        description: 'Suche nach Testaufwand',
        sql: "SELECT * FROM MOV_ACTIVITIES WHERE DESCRIPTION LIKE '%Testaufwand%' OR DESCRIPTION LIKE '%PSN%'",
      },
      {
        name: 'V_MAIN_ACTIVITIES',
        description: 'Aktivitäten View - Letzte 10',
        sql: 'SELECT FIRST 10 * FROM V_MAIN_ACTIVITIES ORDER BY ID DESC',
      },
      {
        name: 'V_MAIN_ACTIVITIES_SEARCH',
        description: 'View Suche nach Testaufwand',
        sql: "SELECT * FROM V_MAIN_ACTIVITIES WHERE DESCRIPTION LIKE '%Testaufwand%' OR DESCRIPTION LIKE '%PSN%'",
      },
      {
        name: 'V_MAIN_CUSTOMERS',
        description: 'Hauptkunden-View',
        sql: 'SELECT FIRST 1 * FROM V_MAIN_CUSTOMERS',
      },
      {
        name: 'BAS_CUSTOMERS',
        description: 'Basis-Kundentabelle',
        sql: 'SELECT FIRST 1 * FROM BAS_CUSTOMERS WHERE CONTACTTYPE = 0',
      },
      {
        name: 'V_MAIN_INVOICES',
        description: 'Rechnungen',
        sql: 'SELECT FIRST 1 * FROM V_MAIN_INVOICES',
      },
      {
        name: 'SYS_INDIVIDUAL_FIELDS',
        description: 'Individuelle Felder',
        sql: 'SELECT FIRST 1 * FROM SYS_INDIVIDUAL_FIELDS',
      },
      {
        name: 'MOV_TABLES',
        description: 'Bewegungsdaten-Tabellen (MOV_*)',
        sql: "SELECT RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 AND RDB$RELATION_NAME LIKE 'MOV_%' ORDER BY RDB$RELATION_NAME",
      },
      {
        name: 'A_DE_TABLES',
        description: 'Deutsche Anwendungstabellen (A_DE_*)',
        sql: "SELECT RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 AND RDB$RELATION_NAME LIKE 'A_DE_%' ORDER BY RDB$RELATION_NAME",
      },
      {
        name: 'ALL_VIEWS',
        description: 'Alle Views (V_*)',
        sql: "SELECT RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 AND RDB$RELATION_NAME LIKE 'V_%' ORDER BY RDB$RELATION_NAME",
      },
    ];

    const newResults: ExploreResult[] = [];

    for (const query of queries) {
      try {
        const response = await fetch('/api/orgamax/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sql: query.sql,
            mandant,
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          newResults.push({
            name: `${query.name} - ${query.description}`,
            data: result.data,
          });
        } else {
          newResults.push({
            name: `${query.name} - ${query.description}`,
            data: null,
            error: result.error || 'Fehler beim Abrufen',
          });
        }
      } catch (err) {
        newResults.push({
          name: `${query.name} - ${query.description}`,
          data: null,
          error: err instanceof Error ? err.message : 'Unbekannter Fehler',
        });
      }
    }

    setResults(newResults);
    setLoading(false);
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg">
          <Database className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Datenstruktur Explorer</h1>
          <p className="text-sm text-muted-foreground">
            Erkunde die Orgamax-Datenbankstruktur und verfügbare Tabellen
          </p>
        </div>
      </div>

      {/* Navigation */}
      <OrgamaxNav />

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Datenstruktur analysieren</CardTitle>
          <CardDescription>
            Wähle einen Mandanten und starte die Analyse der Orgamax-Datenbank
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium">Mandant</label>
              <Select
                value={mandant.toString()}
                onValueChange={(value) => setMandant(Number(value) as 1 | 2 | 4)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Mandant 1</SelectItem>
                  <SelectItem value="2">Mandant 2</SelectItem>
                  <SelectItem value="4">Mandant 4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={exploreStructure} disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              Struktur analysieren
            </Button>
          </div>

          <Alert>
            <TableIcon className="h-4 w-4" />
            <AlertDescription>
              Diese Analyse lädt jeweils ein Beispiel-Datensatz aus verschiedenen Tabellen
              und listet alle verfügbaren Tabellen auf. Dies hilft dabei, die Datenstruktur
              zu verstehen und weitere Integrationen zu planen.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Tabs defaultValue="0" className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-6 gap-1">
            {results.map((_, index) => (
              <TabsTrigger key={index} value={index.toString()} className="text-xs">
                {results[index].name.split(' - ')[0]}
              </TabsTrigger>
            ))}
          </TabsList>

          {results.map((result, index) => (
            <TabsContent key={index} value={index.toString()}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{result.name}</CardTitle>
                    {result.error ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Fehler
                      </Badge>
                    ) : (
                      <Badge className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {Array.isArray(result.data) ? `${result.data.length} Einträge` : 'Erfolg'}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {result.error ? (
                      <span className="text-red-600">{result.error}</span>
                    ) : (
                      `Mandant ${mandant}`
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {result.error ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{result.error}</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="rounded-lg bg-slate-950 p-4">
                      <pre className="overflow-auto text-xs text-slate-50">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Loading Indicator */}
      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                Analysiere Datenstruktur...
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
