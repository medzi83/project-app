"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Search, RefreshCw, Mail, Phone, MapPin, Building, AlertCircle, Loader2 } from 'lucide-react';
import type { OrgamaxCustomer } from '@/lib/orgamax-api';

export default function OrgamaxCustomersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mandant, setMandant] = useState<1 | 2 | 4>(1);
  const [customers, setCustomers] = useState<OrgamaxCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Load customers
  const loadCustomers = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orgamax/customers?mandant=${mandant}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Laden der Kunden');
      }

      if (data.success && data.customers) {
        setCustomers(data.customers);
      } else {
        throw new Error(data.error || 'Keine Daten erhalten');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Kunden');
    } finally {
      setLoading(false);
    }
  };

  // Load customers on mount and when mandant changes
  useEffect(() => {
    if (status === 'authenticated') {
      loadCustomers();
    }
  }, [mandant, status]);

  // Filter customers by search term
  const filteredCustomers = customers.filter((customer) => {
    if (!searchTerm) return true;

    const search = searchTerm.toLowerCase();
    return (
      customer.CUSTNO.toString().includes(search) ||
      customer.KUNDENNAME?.toLowerCase().includes(search) ||
      customer.VORNAME?.toLowerCase().includes(search) ||
      customer.NACHNAME?.toLowerCase().includes(search) ||
      customer.EMAIL?.toLowerCase().includes(search) ||
      customer.CITY?.toLowerCase().includes(search)
    );
  });

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Orgamax Kunden</h1>
            <p className="text-sm text-muted-foreground">
              {filteredCustomers.length} Kunden in Mandant {mandant}
            </p>
          </div>
        </div>
        <Button onClick={() => router.back()} variant="outline">
          Zurück
        </Button>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Filter & Suche</CardTitle>
          <CardDescription>
            Wählen Sie einen Mandanten und suchen Sie nach Kunden
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
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

            <div className="flex-[2]">
              <label className="mb-2 block text-sm font-medium">Suche</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Suche nach Name, Kundennummer, E-Mail..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button onClick={loadCustomers} disabled={loading} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Aktualisieren
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Kundenliste</CardTitle>
          <CardDescription>
            Alle Kunden aus der Orgamax Datenbank (Mandant {mandant})
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {searchTerm
                ? 'Keine Kunden gefunden, die Ihren Suchkriterien entsprechen.'
                : 'Keine Kunden vorhanden.'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Kd.-Nr.</TableHead>
                    <TableHead>Name / Firma</TableHead>
                    <TableHead>Adresse</TableHead>
                    <TableHead>Kontakt</TableHead>
                    <TableHead className="text-right">Typ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.ID}>
                      <TableCell className="font-medium">
                        <Badge variant="outline">{customer.CUSTNO}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {customer.KUNDENNAME || `${customer.VORNAME || ''} ${customer.NACHNAME || ''}`.trim() || 'Unbekannt'}
                          </div>
                          {customer.NAMENSZUSATZ && (
                            <div className="text-xs text-muted-foreground">{customer.NAMENSZUSATZ}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {customer.STREET || customer.CITY ? (
                          <div className="flex items-start gap-1 text-sm">
                            <MapPin className="mt-0.5 h-3 w-3 text-muted-foreground" />
                            <div>
                              {customer.STREET && <div>{customer.STREET}</div>}
                              {(customer.ZIPCODE || customer.CITY) && (
                                <div>
                                  {customer.ZIPCODE} {customer.CITY}
                                </div>
                              )}
                              {customer.COUNTRY && customer.COUNTRY !== 'D' && (
                                <div className="text-xs text-muted-foreground">{customer.COUNTRY}</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {customer.EMAIL && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <a
                                href={`mailto:${customer.EMAIL}`}
                                className="text-blue-600 hover:underline"
                              >
                                {customer.EMAIL}
                              </a>
                            </div>
                          )}
                          {customer.PHONE1 && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <a href={`tel:${customer.PHONE1}`} className="hover:underline">
                                {customer.PHONE1}
                              </a>
                            </div>
                          )}
                          {customer.MOBILE && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <a href={`tel:${customer.MOBILE}`} className="hover:underline">
                                {customer.MOBILE}
                              </a>
                            </div>
                          )}
                          {!customer.EMAIL && !customer.PHONE1 && !customer.MOBILE && (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="text-xs">
                          {customer.CONTACTTYPE === 0 ? 'Firma' : 'Person'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
