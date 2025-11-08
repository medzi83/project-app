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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Users, Search, RefreshCw, AlertCircle, Loader2, Building, User, Calendar, Euro, Globe, FileText, Database, Clock, Edit2, Save } from 'lucide-react';
import { OrgamaxNav } from '@/components/orgamax-nav';
import { fixDataEncoding } from '@/lib/orgamax-api';

type ExtendedCustomer = {
  ID: number;
  CUSTNO: number;
  NAME1: string | null;
  NAME2: string | null;
  NAME3: string | null;
  STREET: string | null;
  ZIPCODE: string | null;
  CITY: string | null;
  COUNTRY: string | null;
  PHONE1: string | null;
  PHONE2: string | null;
  FAX: string | null;
  MOBILE: string | null;
  EMAIL: string | null;
  WEBSITE: string | null;
  DEBITORNO: string | null;
  CUSTACCNO: string | null;
  BANKNAME: string | null;
  BANKCODE: string | null;
  IBAN: string | null;
  BIC: string | null;
  VATID: string | null;
  NOTES: string | null;
  BALANCE: number;
  AMOUNTCREDIT: number;
  CUSTCATEGORY: string | null;
  CONTACTPERSONFULLNAME: string | null;
  CUSTKIND: number;
  CUSTKINDTEXT: string | null;
  CUSTOMERSINCE: string | null;
  INDIVIDUAL1: string | null;
  INDIVIDUAL2: string | null;
  INDIVIDUAL3: string | null;
  INDIVIDUAL4: string | null;
  INDIVIDUAL5: string | null;
  INDIVIDUAL6: string | null;
  INDIVIDUAL7: string | null;
  INDIVIDUAL8: string | null;
  INDIVIDUAL9: string | null;
  INDIVIDUAL10: string | null;
  INDIVIDUAL11: string | null;
  INDIVIDUAL12: string | null;
  INDIVIDUAL13: string | null;
  INDIVIDUAL14: string | null;
  INDIVIDUAL15: string | null;
  INDIVIDUAL16: string | null;
  INDIVIDUAL17: string | null;
  INDIVIDUAL18: string | null;
  INDIVIDUAL19: string | null;
  INDIVIDUAL20: string | null;
};

export default function ExtendedCustomersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mandant, setMandant] = useState<1 | 2 | 4>(4);
  const [customers, setCustomers] = useState<ExtendedCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<ExtendedCustomer | null>(null);
  const [fieldLabels, setFieldLabels] = useState<Record<number, string>>({});
  const [customerActivities, setCustomerActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [editingActivity, setEditingActivity] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editText, setEditText] = useState('');
  const [editEmployee, setEditEmployee] = useState<number>(0);
  const [editDate, setEditDate] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [creatingActivity, setCreatingActivity] = useState(false);

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Load field definitions
  const loadFieldDefinitions = async () => {
    try {
      const response = await fetch('/api/orgamax/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: 'SELECT FIELDNO, NAME FROM SYS_INDIVIDUAL_FIELDS WHERE LOCATION = 1000 AND USED = 1',
          mandant,
        }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        const labels = data.data.reduce((acc: Record<number, string>, field: any) => {
          const fieldName = field.NAME;
          const fieldNo = field.FIELDNO;

          // Prefer non-generic names (don't start with "Feld ")
          // Only overwrite if current is generic and new is not generic
          const currentIsGeneric = acc[fieldNo]?.startsWith('Feld ') || acc[fieldNo]?.startsWith('freies Feld');
          const newIsGeneric = fieldName?.startsWith('Feld ') || fieldName?.startsWith('freies Feld');

          if (!acc[fieldNo] || (currentIsGeneric && !newIsGeneric)) {
            acc[fieldNo] = fieldName;
          }

          return acc;
        }, {});
        setFieldLabels(labels);
      }
    } catch (err) {
      console.error('Failed to load field definitions:', err);
    }
  };

  // Load customers
  const loadCustomers = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/orgamax/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: 'SELECT * FROM V_MAIN_CUSTOMERS ORDER BY CUSTNO',
          mandant,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Laden der Kunden');
      }

      if (data.success && data.data) {
        // Fix encoding for all string fields and normalize phone numbers
        const fixedCustomers = data.data.map((customer: ExtendedCustomer) =>
          fixDataEncoding(customer)
        );
        setCustomers(fixedCustomers);
      } else {
        throw new Error(data.error || 'Keine Daten erhalten');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Kunden');
    } finally {
      setLoading(false);
    }
  };

  // Load activities for selected customer
  const loadCustomerActivities = async (custno: number) => {
    setLoadingActivities(true);
    try {
      const response = await fetch('/api/orgamax/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: `SELECT * FROM V_MAIN_ACTIVITIES WHERE CUSTNO = ${custno} ORDER BY STARTINGDATE DESC`,
          mandant,
        }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        const fixedActivities = data.data.map((activity: any) => fixDataEncoding(activity));
        setCustomerActivities(fixedActivities);
      } else {
        setCustomerActivities([]);
      }
    } catch (err) {
      console.error('Failed to load activities:', err);
      setCustomerActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  // Load employee list
  const loadEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const response = await fetch('/api/orgamax/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: 'SELECT ID, NAME1, NAME2 FROM V_DERP_EMPLOYEES WHERE ISACTIVE = 1 AND ID NOT IN (-100, -101) ORDER BY NAME1',
          mandant,
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('Employees loaded:', data.data);
        setEmployees(data.data || []);
      } else {
        console.error('Failed to load employees:', data.error);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Open edit dialog
  const handleEditActivity = async (activity: any) => {
    console.log('=== EDIT ACTIVITY DEBUG ===');
    console.log('Full activity object:', activity);
    console.log('EMPLID:', activity.EMPLID);
    console.log('EMPLID_WORKER:', activity.EMPLID_WORKER);
    console.log('TIMINGSECONDS:', activity.TIMINGSECONDS);
    console.log('DURATION:', activity.DURATION);
    console.log('STARTINGDATE:', activity.STARTINGDATE);

    setEditingActivity(activity);
    setEditTitle(activity.ACTIVITYTITLE || '');
    setEditText(activity.ACTIVITYTEXT || '');
    // V_MAIN_ACTIVITIES uses EMPLID_WORKER instead of EMPLID
    setEditEmployee(activity.EMPLID_WORKER || activity.EMPLID || 0);

    // Format date from STARTINGDATE (format: YYYY-MM-DD for input type="date")
    if (activity.STARTINGDATE) {
      try {
        // Parse the date and format as YYYY-MM-DD
        const date = new Date(activity.STARTINGDATE);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        setEditDate(`${year}-${month}-${day}`);
      } catch (e) {
        console.error('Error parsing date:', e);
        setEditDate('');
      }
    } else {
      setEditDate('');
    }

    // Convert TIMINGSECONDS to HH:MM:SS for display
    // V_MAIN_ACTIVITIES has DURATION field with timestamp format "1899-12-30 HH:MM:SS"
    if (activity.DURATION && typeof activity.DURATION === 'string') {
      // Extract time part from timestamp (format: "1899-12-30 HH:MM:SS")
      const timePart = activity.DURATION.split(' ')[1];
      if (timePart) {
        setEditDuration(timePart);
        console.log(`Using DURATION field: ${timePart}`);
      } else {
        setEditDuration('00:00:00');
      }
    } else if (activity.TIMINGSECONDS !== null && activity.TIMINGSECONDS !== undefined) {
      const totalSeconds = activity.TIMINGSECONDS;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = Math.floor(totalSeconds % 60);
      const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      console.log(`Converting ${totalSeconds} seconds to ${timeString}`);
      setEditDuration(timeString);
    } else {
      setEditDuration('00:00:00');
    }

    setSaveSuccess(false);

    // Load employees if not already loaded
    if (employees.length === 0) {
      await loadEmployees();
    }
  };

  // Create new activity
  const handleCreateActivity = async () => {
    if (!selectedCustomer) return;

    setCreatingActivity(true);
    try {
      // Set default values for new activity
      const today = new Date();
      const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      setEditingActivity({
        ID: null, // null indicates this is a new activity
        CUSTID: selectedCustomer.ID
      });
      setEditTitle('');
      setEditText('');
      setEditEmployee(session?.user && 'id' in session.user ? parseInt(session.user.id as string) : -102); // Default to current user or Michael Medzech
      setEditDate(dateString);
      setEditDuration('00:00:00');
      setSaveSuccess(false);

      // Load employees if not already loaded
      if (employees.length === 0) {
        await loadEmployees();
      }
    } catch (err) {
      console.error('Failed to prepare new activity:', err);
      alert('Fehler beim Vorbereiten des neuen Aufwands');
    } finally {
      setCreatingActivity(false);
    }
  };

  // Save activity changes
  const handleSaveActivity = async () => {
    if (!editingActivity || !selectedCustomer) return;

    setSavingActivity(true);
    try {
      // Escape single quotes for SQL and handle special characters
      const escapedTitle = editTitle.replace(/'/g, "''").replace(/\\/g, '\\\\');
      const escapedText = editText.replace(/'/g, "''").replace(/\\/g, '\\\\');

      // Convert duration HH:MM:SS back to seconds for TIMINGSECONDS field
      let durationInSeconds = 0;
      let durationTimestamp = '1899-12-30 00:00:00';
      if (editDuration) {
        const timeParts = editDuration.split(':');
        if (timeParts.length === 3) {
          const hours = parseInt(timeParts[0], 10) || 0;
          const minutes = parseInt(timeParts[1], 10) || 0;
          const seconds = parseInt(timeParts[2], 10) || 0;
          durationInSeconds = hours * 3600 + minutes * 60 + seconds;
          // Create timestamp for DURATION field (format: "1899-12-30 HH:MM:SS")
          durationTimestamp = `1899-12-30 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
      }

      // Build SQL based on whether this is a new activity or an update
      let sql: string;

      if (editingActivity.ID === null) {
        // INSERT new activity
        // Note: ID is auto-generated by Orgamax
        // LOCATION is always 1000
        // INSERTUSER and EDITUSER are set to the employee
        // INSERTDATE and EDITDATE are set to current timestamp
        const now = new Date().toISOString().replace('T', ' ').substring(0, 23);

        sql = `INSERT INTO MOV_ACTIVITIES (
          LOCATION, INSERTUSER, INSERTDATE, EDITUSER, EDITDATE,
          CUSTID, PROJECTID, ARTID, TIMINGSECONDS, PRICEPERUNIT,
          UNITONSTART, EMPLID, EMPLID_WORKER, STARTINGDATE, DURATION,
          UNITS, PRICEPOSITION, ACTIVITYTITLE, ACTIVITYTEXT,
          FAKTURA, CREDITBOOKING, GRIDCATEGORY, ARCHIV
        ) VALUES (
          1000, ${editEmployee || -102}, '${now}', ${editEmployee || -102}, '${now}',
          ${selectedCustomer.ID}, 0, 1, ${durationInSeconds}, 0,
          1, ${editEmployee || 0}, ${editEmployee || 0}, ${editDate ? `'${editDate}'` : 'NULL'}, '${durationTimestamp}',
          1, 0, '${escapedTitle}', '${escapedText}',
          0, 0, 0, 0
        )`;
      } else {
        // UPDATE existing activity
        // Note: MOV_ACTIVITIES has both EMPLID and EMPLID_WORKER
        // EMPLID_WORKER is used by V_MAIN_ACTIVITIES view, so we update that
        // DURATION is a timestamp field that needs to be set alongside TIMINGSECONDS
        const now = new Date().toISOString().replace('T', ' ').substring(0, 23);

        sql = `UPDATE MOV_ACTIVITIES SET
          ACTIVITYTITLE = '${escapedTitle}',
          ACTIVITYTEXT = '${escapedText}',
          EMPLID_WORKER = ${editEmployee || 0},
          EMPLID = ${editEmployee || 0},
          EDITUSER = ${editEmployee || -102},
          EDITDATE = '${now}',
          STARTINGDATE = ${editDate ? `'${editDate}'` : 'NULL'},
          TIMINGSECONDS = ${durationInSeconds},
          DURATION = '${durationTimestamp}'
          WHERE ID = ${editingActivity.ID}`;
      }

      console.log('Executing SQL:', sql);

      const response = await fetch('/api/orgamax/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql,
          mandant,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSaveSuccess(true);
        // Reload activities
        if (selectedCustomer) {
          await loadCustomerActivities(selectedCustomer.CUSTNO);
        }
        // Close dialog after short delay
        setTimeout(() => {
          setEditingActivity(null);
          setSaveSuccess(false);
        }, 1500);
      } else {
        throw new Error(data.error || 'Fehler beim Speichern');
      }
    } catch (err) {
      console.error('Failed to save activity:', err);
      alert(err instanceof Error ? err.message : 'Fehler beim Speichern des Aufwands');
    } finally {
      setSavingActivity(false);
    }
  };

  // Load field definitions and customers on mount and when mandant changes
  useEffect(() => {
    if (status === 'authenticated') {
      loadFieldDefinitions();
      loadCustomers();
    }
  }, [mandant, status]);

  // Load activities when customer is selected
  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerActivities(selectedCustomer.CUSTNO);
    } else {
      setCustomerActivities([]);
    }
  }, [selectedCustomer, mandant]);

  // Filter customers by search term
  const filteredCustomers = customers.filter((customer) => {
    if (!searchTerm) return true;

    const search = searchTerm.toLowerCase();
    return (
      customer.CUSTNO.toString().includes(search) ||
      customer.NAME1?.toLowerCase().includes(search) ||
      customer.EMAIL?.toLowerCase().includes(search) ||
      customer.CITY?.toLowerCase().includes(search) ||
      customer.CONTACTPERSONFULLNAME?.toLowerCase().includes(search)
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
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg">
          <Database className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Erweiterte Kundendaten</h1>
          <p className="text-sm text-muted-foreground">
            {filteredCustomers.length} Kunden aus V_MAIN_CUSTOMERS (Mandant {mandant})
          </p>
        </div>
      </div>

      {/* Navigation */}
      <OrgamaxNav />

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Filter & Suche</CardTitle>
          <CardDescription>
            Vollständige Kundendaten inkl. Bankverbindung, individueller Felder und Kontostatus
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

      {/* Customers List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            {searchTerm
              ? 'Keine Kunden gefunden, die Ihren Suchkriterien entsprechen.'
              : 'Keine Kunden vorhanden.'}
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <Card
              key={customer.ID}
              className="cursor-pointer transition-shadow hover:shadow-lg"
              onClick={() => setSelectedCustomer(customer)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {customer.CUSTKIND === 0 ? (
                      <Building className="h-5 w-5 text-blue-600" />
                    ) : (
                      <User className="h-5 w-5 text-green-600" />
                    )}
                    <div>
                      <CardTitle className="text-lg">{customer.NAME1}</CardTitle>
                      <CardDescription>Kd.-Nr. {customer.CUSTNO}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={customer.BALANCE > 0 ? 'default' : 'secondary'}>
                    {customer.BALANCE.toFixed(2)} €
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {customer.CONTACTPERSONFULLNAME && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3 w-3" />
                    {customer.CONTACTPERSONFULLNAME}
                  </div>
                )}
                {customer.EMAIL && (
                  <div className="text-blue-600">{customer.EMAIL}</div>
                )}
                {customer.CITY && (
                  <div className="text-muted-foreground">{customer.CITY}</div>
                )}
                {customer.CUSTCATEGORY && (
                  <Badge variant="outline" className="text-xs">
                    {customer.CUSTCATEGORY}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Customer Detail Dialog */}
      {selectedCustomer && (
        <Card className="fixed inset-4 z-50 overflow-auto bg-background shadow-2xl md:inset-10">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{selectedCustomer.NAME1}</CardTitle>
                <CardDescription>Kundennummer: {selectedCustomer.CUSTNO}</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCustomer(null)}
              >
                Schließen
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="base" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="base">Stammdaten</TabsTrigger>
                <TabsTrigger value="bank">Bank</TabsTrigger>
                <TabsTrigger value="individual">Individuelle Felder</TabsTrigger>
                <TabsTrigger value="activities">
                  <Clock className="mr-2 h-4 w-4" />
                  Aufwände ({customerActivities.length})
                </TabsTrigger>
                <TabsTrigger value="notes">Notizen</TabsTrigger>
              </TabsList>

              <TabsContent value="base" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="mb-2 font-semibold">Kontaktdaten</h3>
                    <dl className="space-y-1 text-sm">
                      <div>
                        <dt className="font-medium">Anschrift:</dt>
                        <dd className="text-muted-foreground">
                          {selectedCustomer.STREET}<br />
                          {selectedCustomer.ZIPCODE} {selectedCustomer.CITY}<br />
                          {selectedCustomer.COUNTRY}
                        </dd>
                      </div>
                      {selectedCustomer.PHONE1 && (
                        <div>
                          <dt className="font-medium">Telefon:</dt>
                          <dd className="text-muted-foreground">{selectedCustomer.PHONE1}</dd>
                        </div>
                      )}
                      {selectedCustomer.EMAIL && (
                        <div>
                          <dt className="font-medium">E-Mail:</dt>
                          <dd className="text-blue-600">{selectedCustomer.EMAIL}</dd>
                        </div>
                      )}
                      {selectedCustomer.WEBSITE && (
                        <div>
                          <dt className="font-medium">Website:</dt>
                          <dd className="text-blue-600">{selectedCustomer.WEBSITE}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div>
                    <h3 className="mb-2 font-semibold">Finanzen</h3>
                    <dl className="space-y-1 text-sm">
                      <div>
                        <dt className="font-medium">Saldo:</dt>
                        <dd className={selectedCustomer.BALANCE > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                          {selectedCustomer.BALANCE.toFixed(2)} €
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium">Kreditlimit:</dt>
                        <dd className="text-muted-foreground">{selectedCustomer.AMOUNTCREDIT.toFixed(2)} €</dd>
                      </div>
                      {selectedCustomer.DEBITORNO && (
                        <div>
                          <dt className="font-medium">Debitorennummer:</dt>
                          <dd className="text-muted-foreground">{selectedCustomer.DEBITORNO}</dd>
                        </div>
                      )}
                      {selectedCustomer.CUSTCATEGORY && (
                        <div>
                          <dt className="font-medium">Kategorie:</dt>
                          <dd><Badge variant="outline">{selectedCustomer.CUSTCATEGORY}</Badge></dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="bank" className="space-y-4">
                <dl className="space-y-2 text-sm">
                  {selectedCustomer.BANKNAME && (
                    <div>
                      <dt className="font-medium">Bankname:</dt>
                      <dd className="text-muted-foreground">{selectedCustomer.BANKNAME}</dd>
                    </div>
                  )}
                  {selectedCustomer.IBAN && (
                    <div>
                      <dt className="font-medium">IBAN:</dt>
                      <dd className="font-mono text-muted-foreground">{selectedCustomer.IBAN}</dd>
                    </div>
                  )}
                  {selectedCustomer.BIC && (
                    <div>
                      <dt className="font-medium">BIC:</dt>
                      <dd className="font-mono text-muted-foreground">{selectedCustomer.BIC}</dd>
                    </div>
                  )}
                  {selectedCustomer.CUSTACCNO && (
                    <div>
                      <dt className="font-medium">Kontonummer:</dt>
                      <dd className="font-mono text-muted-foreground">{selectedCustomer.CUSTACCNO}</dd>
                    </div>
                  )}
                  {selectedCustomer.BANKCODE && (
                    <div>
                      <dt className="font-medium">Bankleitzahl:</dt>
                      <dd className="font-mono text-muted-foreground">{selectedCustomer.BANKCODE}</dd>
                    </div>
                  )}
                  {selectedCustomer.VATID && (
                    <div>
                      <dt className="font-medium">USt-ID:</dt>
                      <dd className="font-mono text-muted-foreground">{selectedCustomer.VATID}</dd>
                    </div>
                  )}
                </dl>
              </TabsContent>

              <TabsContent value="individual" className="space-y-2">
                <div className="grid gap-2 text-sm">
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => {
                    const key = `INDIVIDUAL${num}` as keyof ExtendedCustomer;
                    const value = selectedCustomer[key];
                    if (!value) return null;
                    return (
                      <div key={num} className="flex gap-2">
                        <span className="font-medium">{fieldLabels[num] || `Feld ${num}`}:</span>
                        <span className="text-muted-foreground">{String(value)}</span>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="activities" className="space-y-3">
                <div className="flex justify-end mb-3">
                  <Button
                    onClick={handleCreateActivity}
                    disabled={creatingActivity || loadingActivities}
                    className="gap-2"
                  >
                    <Clock className="h-4 w-4" />
                    Neuer Aufwand
                  </Button>
                </div>

                {loadingActivities ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : customerActivities.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Keine Aufwände für diesen Kunden vorhanden
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customerActivities.map((activity: any) => (
                      <Card key={activity.ID} className="overflow-hidden">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-base">{activity.ACTIVITYTITLE || 'Ohne Titel'}</CardTitle>
                                <Badge variant="outline" className="text-xs">
                                  Aufwands-Nr. {activity.ID}
                                </Badge>
                              </div>
                              <CardDescription className="mt-1">
                                {new Date(activity.STARTINGDATE).toLocaleDateString('de-DE')} | {activity.DURATIONSTRING || '-'}
                              </CardDescription>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditActivity(activity)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              {activity.STATUS === 10 && <Badge>Offen</Badge>}
                              {activity.STATUS === 20 && <Badge variant="secondary">Abgeschlossen</Badge>}
                              {activity.FAKTURA === 1 && <Badge variant="outline">Fakturiert</Badge>}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pb-3 pt-0">
                          <div className="grid gap-2 text-sm">
                            {activity.PROJECTNAME && activity.PROJECTNAME !== '(keine Angabe)' && (
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Projekt:</span>
                                <span className="font-medium">{activity.PROJECTNAME}</span>
                              </div>
                            )}
                            {activity.EMPLNAME && (
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Mitarbeiter:</span>
                                <span className="font-medium">{activity.EMPLNAME}</span>
                              </div>
                            )}
                            {activity.PRICEPERUNIT > 0 && (
                              <div className="flex items-center gap-2">
                                <Euro className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Preis/Einheit:</span>
                                <span className="font-medium">
                                  {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(activity.PRICEPERUNIT)}
                                </span>
                              </div>
                            )}
                            {activity.OFFEN > 0 && (
                              <div className="flex items-center gap-2">
                                <Euro className="h-4 w-4 text-orange-500" />
                                <span className="text-muted-foreground">Offen:</span>
                                <span className="font-medium text-orange-600">
                                  {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(activity.OFFEN)}
                                </span>
                              </div>
                            )}
                          </div>
                          {activity.ACTIVITYTEXT && (
                            <Accordion type="single" collapsible className="mt-3">
                              <AccordionItem value="activity-text" className="border-none">
                                <AccordionTrigger className="rounded-md bg-muted/50 px-3 py-2 text-sm hover:no-underline">
                                  Tätigkeit anzeigen
                                </AccordionTrigger>
                                <AccordionContent className="rounded-md bg-muted/50 px-3 pb-3 pt-1">
                                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                    {activity.ACTIVITYTEXT}
                                  </p>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notes">
                {selectedCustomer.NOTES ? (
                  <div className="whitespace-pre-wrap rounded-lg border bg-muted/50 p-4 text-sm">
                    {selectedCustomer.NOTES}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Keine Notizen vorhanden.</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Edit Activity Dialog */}
      <Dialog open={!!editingActivity} onOpenChange={(open) => !open && setEditingActivity(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingActivity?.ID === null ? 'Neuer Aufwand' : 'Aufwand bearbeiten'}
            </DialogTitle>
            <DialogDescription>
              {editingActivity?.ID === null
                ? 'Erfassen Sie einen neuen Aufwand für diesen Kunden'
                : 'Bearbeiten Sie alle Details des Aufwands'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Mitarbeiter</label>
                <Select
                  value={editEmployee.toString()}
                  onValueChange={(value) => setEditEmployee(Number(value))}
                  disabled={loadingEmployees}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Mitarbeiter auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Kein Mitarbeiter</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.ID} value={emp.ID.toString()}>
                        {emp.NAME1}, {emp.NAME2}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Datum</label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Dauer (HH:MM:SS)</label>
              <Input
                type="text"
                value={editDuration}
                onChange={(e) => setEditDuration(e.target.value)}
                placeholder="z.B. 02:30:00"
                pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Thema</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Thema des Aufwands"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Tätigkeit</label>
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="Beschreibung der Tätigkeit"
                rows={8}
                className="mt-1"
              />
            </div>

            {saveSuccess && (
              <Alert className="bg-green-50 border-green-200">
                <AlertDescription className="text-green-800">
                  Aufwand wurde erfolgreich gespeichert!
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingActivity(null)}
              disabled={savingActivity}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSaveActivity}
              disabled={savingActivity}
            >
              {savingActivity ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Speichern...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Speichern
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
