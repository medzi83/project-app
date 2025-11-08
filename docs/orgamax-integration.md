# Orgamax ERP Integration - Dokumentation

## Übersicht

Diese Dokumentation beschreibt die Integration der Projektverwaltung mit Orgamax ERP über einen ODBC API Service. Die Integration ermöglicht den Zugriff auf Kunden- und Aufwandsdaten aus der Orgamax-Datenbank.

---

## Inhaltsverzeichnis

1. [Architektur](#architektur)
2. [Setup und Konfiguration](#setup-und-konfiguration)
3. [API Client Library](#api-client-library)
4. [Verfügbare Endpoints](#verfügbare-endpoints)
5. [Frontend-Seiten](#frontend-seiten)
6. [Datenstruktur](#datenstruktur)
7. [Troubleshooting](#troubleshooting)

---

## Architektur

### Systemübersicht

```
┌─────────────────────────┐
│  Next.js Application    │
│  (Port 3000)            │
│                         │
│  - Frontend Pages       │
│  - API Routes           │
│  - orgamax-api.ts       │
└───────────┬─────────────┘
            │
            │ HTTP Requests
            │
┌───────────▼─────────────┐
│  ODBC API Service       │
│  (192.168.1.138:3001)   │
│                         │
│  - Express Server       │
│  - ODBC Connection      │
└───────────┬─────────────┘
            │
            │ ODBC
            │
┌───────────▼─────────────┐
│  Orgamax Firebird DB    │
│                         │
│  - Mandant 1            │
│  - Mandant 2            │
│  - Mandant 4            │
└─────────────────────────┘
```

### Komponenten

1. **ODBC API Service**: Externer Service auf Windows Server mit ODBC-Verbindung zur Firebird-Datenbank
2. **API Client Library** (`lib/orgamax-api.ts`): TypeScript-Client für HTTP-Anfragen an den ODBC Service
3. **Next.js API Routes**: Server-seitige Endpoints mit Authentication
4. **Frontend Pages**: React-Komponenten zur Darstellung der Daten

---

## Setup und Konfiguration

### Umgebungsvariablen

In `.env` folgende Variablen konfigurieren:

```env
# Orgamax ERP API Integration
ORGAMAX_API_URL="http://192.168.1.138:3001"
ORGAMAX_API_KEY="2wVAF7zFuuDH8ls8tOjMoq5i72SMTwbI"
ORGAMAX_DEFAULT_MANDANT="4"
```

- **ORGAMAX_API_URL**: URL des ODBC API Service
- **ORGAMAX_API_KEY**: API-Schlüssel für Authentifizierung
- **ORGAMAX_DEFAULT_MANDANT**: Standard-Mandant (1, 2 oder 4)

### ODBC-Einstellungen auf dem Server

Wichtig für korrekte Zeichendarstellung:

- **Character Set**: UTF-8 (nicht ISO8859_1)
- Alle Mandanten müssen auf UTF-8 konfiguriert sein
- Sonst erscheinen Umlaute (ä, ö, ü, ß) als "�"

---

## API Client Library

Die zentrale API-Bibliothek befindet sich in `lib/orgamax-api.ts`.

### Hauptfunktionen

#### createOrgamaxClient()

Erstellt einen API-Client mit den konfigurierten Credentials:

```typescript
const client = createOrgamaxClient();
if (!client) {
  throw new Error('Orgamax API is not configured');
}
```

#### client.testConnection()

Testet die Verbindung zum ODBC Service:

```typescript
const result = await client.testConnection();
// { success: true, message: "Connected to Orgamax API", version: "1.0.0" }
```

#### client.getCustomers(mandant)

Holt alle Kunden eines Mandanten:

```typescript
const result = await client.getCustomers(4);
// { success: true, customers: [...] }
```

#### client.query(sql, mandant)

Führt eine beliebige SQL-Query aus:

```typescript
const result = await client.query(
  'SELECT * FROM V_MAIN_ACTIVITIES ORDER BY STARTINGDATE DESC',
  4
);
// { success: true, data: [...] }
```

### Hilfsfunktionen

#### fixEncoding(text)

Korrigiert potenzielle Encoding-Probleme (fallback für alte Daten):

```typescript
const fixed = fixEncoding('MÃ¼ller'); // → "Müller"
```

#### normalizePhoneNumber(phone)

Normalisiert Telefonnummern (entfernt falsche Bindestriche):

```typescript
const normalized = normalizePhoneNumber('+49 38207  76 73 89');
// → "+49 38207 - 76 73 89"
```

#### fixCustomerEncoding(customer)

Wendet Encoding-Fixes auf alle relevanten Kundenfelder an:

```typescript
const fixed = fixCustomerEncoding(rawCustomer);
```

#### fixDataEncoding(data)

Generische Funktion für beliebige Datenobjekte:

```typescript
const fixed = fixDataEncoding(activity);
```

---

## Verfügbare Endpoints

Alle API-Endpoints befinden sich unter `app/api/orgamax/`.

### GET /api/orgamax/test-connection

**Beschreibung**: Testet die Verbindung zum ODBC Service

**Authentifizierung**: NextAuth Session erforderlich

**Response**:
```json
{
  "success": true,
  "message": "Connected to Orgamax API",
  "version": "1.0.0"
}
```

### GET /api/orgamax/customers

**Beschreibung**: Holt alle Kunden eines Mandanten

**Query Parameter**:
- `mandant` (required): 1, 2 oder 4

**Response**:
```json
{
  "success": true,
  "customers": [
    {
      "ID": 24,
      "CUSTNO": 50007,
      "KUNDENNAME": "Medzech",
      "VORNAME": "Michael",
      "NACHNAME": null,
      "EMAIL": "shop-test@54north.solutions",
      "PHONE1": "+49 123 456789",
      "STREET": "Kronsforder Allee 40d",
      "ZIPCODE": "23560",
      "CITY": "Lübeck",
      "COUNTRY": "D",
      "CONTACTTYPE": 0
    }
  ],
  "mandant": 4
}
```

### GET /api/orgamax/customers/:custno

**Beschreibung**: Holt einen einzelnen Kunden per Kundennummer

**URL Parameter**:
- `custno`: Kundennummer

**Query Parameter**:
- `mandant` (required): 1, 2 oder 4

**Response**:
```json
{
  "success": true,
  "customer": { ... },
  "mandant": 4
}
```

### POST /api/orgamax/query

**Beschreibung**: Führt eine beliebige SQL-Query aus

**Request Body**:
```json
{
  "sql": "SELECT * FROM V_MAIN_ACTIVITIES WHERE CUSTNO = 50007",
  "mandant": 4
}
```

**Response**:
```json
{
  "success": true,
  "data": [ ... ],
  "count": 10,
  "mandant": 4
}
```

---

## Frontend-Seiten

Alle Orgamax-Seiten befinden sich unter `app/admin/orgamax/`.

### Navigation Component

Die gemeinsame Navigation befindet sich in `components/orgamax-nav.tsx`:

```typescript
const orgamaxPages = [
  { href: '/admin/orgamax', label: 'Dashboard', icon: Database },
  { href: '/admin/orgamax/customers', label: 'Kunden', icon: Users },
  { href: '/admin/orgamax/customers-extended', label: 'Erweiterte Kunden', icon: Users },
  { href: '/admin/orgamax/activities', label: 'Aufwände', icon: Clock },
  { href: '/admin/orgamax/api-explorer', label: 'API Explorer', icon: Code },
  { href: '/admin/orgamax/structure', label: 'Datenstruktur', icon: Table },
];
```

### /admin/orgamax - Dashboard

**Beschreibung**: Übersichtsseite mit Connection-Test und Links zu allen Bereichen

**Features**:
- Verbindungstest zum ODBC Service
- Status-Anzeige
- Quick-Links zu allen Funktionen

### /admin/orgamax/customers - Kundenliste

**Beschreibung**: Tabellarische Übersicht aller Kunden

**Features**:
- Mandanten-Auswahl (1, 2, 4)
- Volltextsuche (Name, Kundennummer, E-Mail, Stadt)
- Tabellenansicht mit Kundendaten
- Kontaktinformationen (E-Mail, Telefon) als anklickbare Links
- Duplikate werden automatisch entfernt (nach CUSTNO)

**Verwendete Felder**:
- CUSTNO, KUNDENNAME, VORNAME, NACHNAME
- STREET, ZIPCODE, CITY, COUNTRY
- EMAIL, PHONE1, PHONE2, FAX, MOBILE
- CONTACTTYPE (0 = Firma, 1 = Person)

### /admin/orgamax/customers-extended - Erweiterte Kundendaten

**Beschreibung**: Vollständige Kundendaten mit individuellen Feldern und Aufwandsverwaltung

**Features**:
- Kartenansicht statt Tabelle
- Alle 60+ Felder aus V_MAIN_CUSTOMERS
- Detail-Modal mit Tabs:
  - **Stammdaten**: Name, Adresse, Kontakt
  - **Bank**: Bankverbindung, IBAN, BIC
  - **Individuelle Felder**: 20 benutzerdefinierte Felder mit Namen aus SYS_INDIVIDUAL_FIELDS
  - **Aufwände**: Kundenspezifische Aufwände mit vollständiger CRUD-Funktionalität
    - Anzeige aller Aufwände des Kunden
    - Aufwands-Nr. (ID) wird angezeigt
    - Neuen Aufwand erstellen
    - Aufwand bearbeiten (Mitarbeiter, Datum, Dauer, Thema, Tätigkeit)
    - Zeit-Eingabe in HH:MM:SS Format
    - Mitarbeiter-Dropdown (nur aktive Mitarbeiter)
    - Automatisches Speichern in MOV_ACTIVITIES
  - **Notizen**: Interne Notizen
- Dynamisches Laden der Feldbezeichnungen
- Bevorzugung nicht-generischer Feldnamen (z.B. "Projektstatus" statt "Feld Briefe 19")

**Queries**:
```sql
-- Kunden laden
SELECT * FROM V_MAIN_CUSTOMERS ORDER BY CUSTNO

-- Individuelle Felder
SELECT FIELDNO, NAME
FROM SYS_INDIVIDUAL_FIELDS
WHERE LOCATION = 1000 AND USED = 1

-- Kundenspezifische Aufwände
SELECT * FROM V_MAIN_ACTIVITIES
WHERE CUSTNO = {custno}
ORDER BY STARTINGDATE DESC

-- Mitarbeiter für Dropdown
SELECT ID, NAME1, NAME2
FROM V_DERP_EMPLOYEES
WHERE ISACTIVE = 1 AND ID NOT IN (-100, -101)
ORDER BY NAME1
```

**Aufwand erstellen/bearbeiten**:
- **Neuer Aufwand**: INSERT in MOV_ACTIVITIES
  - ID wird automatisch von Orgamax vergeben (kundenübergreifend fortlaufend)
  - LOCATION = 1000
  - INSERTUSER/EDITUSER = ausgewählter Mitarbeiter
  - INSERTDATE/EDITDATE = aktueller Timestamp
  - CUSTID = Kunden-ID (nicht CUSTNO!)
  - EMPLID und EMPLID_WORKER werden beide gesetzt
  - TIMINGSECONDS und DURATION (Timestamp) werden parallel gepflegt

- **Aufwand bearbeiten**: UPDATE in MOV_ACTIVITIES
  - EMPLID_WORKER wird aktualisiert (nicht EMPLID allein - dieser wird von der View verwendet!)
  - EDITDATE wird auf aktuellen Timestamp gesetzt
  - Beide Zeitfelder (TIMINGSECONDS und DURATION) werden synchron gehalten

### /admin/orgamax/activities - Aufwände

**Beschreibung**: Übersicht aller erfassten Aufwände/Aktivitäten

**Features**:
- Kartenansicht mit wichtigsten Infos
- Suchfunktion (Titel, Kunde, Projekt, Mitarbeiter)
- Status-Badges (Offen/Abgeschlossen, Fakturiert)
- Detail-Modal mit 4 Tabs:
  - **Allgemein**: Thema, Datum, Dauer, Tätigkeit, Notizen
  - **Kunde**: Vollständige Kundendaten
  - **Projekt**: Projektnummer, -name, -beschreibung
  - **Abrechnung**: Preise, Einheiten, offene Beträge
- Formatierungen:
  - Deutsche Datumsformatierung (TT.MM.JJJJ)
  - Zeitdauer (HH:MM:SS)
  - Währungsformatierung (EUR)
  - Farbliche Hervorhebung offener Beträge

**Query**:
```sql
SELECT * FROM V_MAIN_ACTIVITIES ORDER BY STARTINGDATE DESC
```

**Wichtige Felder**:
- ID, CUSTID, PROJECTID, ARTID
- ACTIVITYTITLE (Thema), ACTIVITYTEXT (Tätigkeit)
- STARTINGDATE, DURATION, DURATIONSTRING
- PRICEPERUNIT, UNITS, PRICEPOSITION, OFFEN
- STATUS (10 = Offen, 20 = Abgeschlossen)
- FAKTURA (0 = Nein, 1 = Ja)
- Alle Kundenfelder (CUSTNO, NAME1, EMAIL, ...)
- Projektfelder (PROJECTNO, PROJECTNAME)
- Mitarbeiter (EMPLNAME, EMPLWORKNAME1, EMPLWORKNAME2)

### /admin/orgamax/api-explorer - API Explorer

**Beschreibung**: Interaktives Tool zum Testen der API-Endpoints

**Features**:
- Test-Cards für verschiedene Endpoints:
  - Health Check
  - Alle Kunden abrufen
  - Einzelnen Kunden abrufen
  - SQL-Abfrage ausführen
- Live-Response-Anzeige mit JSON-Formatierung
- Status-Codes und Error-Handling

### /admin/orgamax/structure - Datenstruktur Explorer

**Beschreibung**: Erkundet die Orgamax-Datenbankstruktur

**Features**:
- Vordefinierte Queries für wichtige Tabellen:
  - MOV_ACTIVITIES (Basis-Aktivitätentabelle)
  - V_MAIN_ACTIVITIES (Aktivitäten-View mit JOINs)
  - V_MAIN_CUSTOMERS (Kunden-View)
  - BAS_CUSTOMERS (Basis-Kundentabelle)
  - V_MAIN_INVOICES (Rechnungen)
  - SYS_INDIVIDUAL_FIELDS (Individuelle Felder)
  - Liste aller MOV_* Tabellen
  - Liste aller A_DE_* Tabellen
  - Liste aller V_* Views
- Tabs für jeden Query-Typ
- JSON-Anzeige der Ergebnisse
- Beispiel-Datensätze aus jeder Tabelle

---

## Datenstruktur

### Wichtige Tabellen und Views

#### V_MAIN_CUSTOMERS (Kunden-View)

Vollständige Kundendaten mit allen Feldern:

**Basisdaten**:
- ID, CUSTNO (Kundennummer)
- NAME1, NAME2, NAME3, NAMENSZUSATZ
- TITLE, ADDRESS (Anrede)
- CONTACTTYPE (0 = Firma, 1 = Person)

**Adresse**:
- STREET, ZIPCODE, CITY, COUNTRY
- POBOXNO (Postfachnummer)

**Kontakt**:
- EMAIL, WEBSITE
- PHONE1, PHONE2, FAX, MOBILE

**Bank**:
- BANKACCOUNTNO, BANKCODE
- IBAN, BIC, BANKNAME

**Geschäftsdaten**:
- TAXNO (Steuernummer), VATID (USt-IdNr)
- DEBITORNO (Debitorennummer)
- CREDITLIMIT, SKONTODAYS

**Individuelle Felder**:
- INDIVIDUAL1 bis INDIVIDUAL20
- Feldnamen in SYS_INDIVIDUAL_FIELDS

**Notizen**:
- NOTES (interne Notizen)

#### V_MAIN_ACTIVITIES (Aktivitäten-View)

Vollständige Aufwandsdaten mit JOINs zu Kunden und Projekten:

**Basis**:
- ID (eindeutige ID, kundenübergreifend fortlaufend)
- CUSTID (Kunden-ID), PROJECTID, ARTID
- EMPLID_WORKER (Mitarbeiter-ID - wird für Display verwendet!)

**Titel & Beschreibung**:
- ACTIVITYTITLE (Thema)
- ACTIVITYTEXT (Tätigkeit)
- NOTES (Notizen)

**Zeiterfassung**:
- STARTINGDATE (Datum)
- DURATION (Zeit als Timestamp "1899-12-30 HH:MM:SS")
- DURATIONSTRING (formatierte Zeit HH:MM:SS)
- TIMINGSECONDS (Sekunden als Integer)

**Wichtig**: DURATION und TIMINGSECONDS müssen synchron gehalten werden!

**Abrechnung**:
- PRICEPERUNIT (Preis pro Einheit)
- UNITS (Anzahl Einheiten)
- PRICEPOSITION (Gesamtpreis)
- OFFEN (offener Betrag)
- FAKTURA (0 = nicht fakturiert, 1 = fakturiert)

**Status**:
- STATUS (10 = Offen, 20 = Abgeschlossen)
- ARCHIV (0 = aktiv, 1 = archiviert)

**Kunde** (aus JOIN):
- CUSTNO, NAME1, NAME2, NAME3
- STREET, ZIPCODE, CITY, COUNTRY
- EMAIL, PHONE1, PHONE2, FAX, MOBILE, WEBSITE
- CONTACTTYPE, DEBITORNO

**Projekt** (aus JOIN):
- PROJECTNO (Projektnummer)
- PROJECTNAME (Projektname)
- DESCRIPTION (Projektbeschreibung)

**Mitarbeiter** (aus JOIN):
- EMPLNAME (vollständiger Name)
- EMPLWORKNAME1 (Nachname)
- EMPLWORKNAME2 (Vorname)

#### MOV_ACTIVITIES (Basis-Aktivitätentabelle)

Reine Aktivitätsdaten ohne JOINs, mit zusätzlichen Metadaten:

**Metadaten** (zusätzlich zu V_MAIN_ACTIVITIES):
- LOCATION (Mandant, immer 1000)
- INSERTUSER, INSERTDATE (Ersteller und Datum)
- EDITUSER, EDITDATE (letzter Bearbeiter und Datum)
- EMPLID (Mitarbeiter-ID)
- EMPLID_WORKER (Mitarbeiter-ID für Worker)
- UNITONSTART (Einheiten beim Start)

**Wichtige Feldunterschiede**:
- MOV_ACTIVITIES hat **beide** Felder: EMPLID und EMPLID_WORKER
- V_MAIN_ACTIVITIES zeigt nur EMPLID_WORKER an
- **Beim UPDATE immer EMPLID_WORKER setzen** (wird von der View verwendet!)
- EMPLID sollte ebenfalls gesetzt werden (für Konsistenz)

**Hinweise**:
- Für die Anzeige ist V_MAIN_ACTIVITIES besser geeignet, da alle relevanten Daten bereits gejoint sind
- Für INSERT/UPDATE muss MOV_ACTIVITIES verwendet werden
- V_MAIN_ACTIVITIES ist eine View und kann nicht direkt bearbeitet werden

#### V_DERP_EMPLOYEES (Mitarbeiter-View)

Mitarbeiterdaten für die Zuordnung von Aufwänden:

**Felder**:
- ID (Mitarbeiter-ID, kann negativ sein!)
- NAME1 (Nachname)
- NAME2 (Vorname)
- ISACTIVE (0 = inaktiv, 1 = aktiv)

**Besondere Mitarbeiter-IDs**:
- **-100**: SYSTEM (ausgeschlossen)
- **-101**: SUPERADMIN (ausgeschlossen)
- **-102**: Michael Medzech (echter User, wird verwendet!)
- **1-8**: Reguläre Mitarbeiter

**Filter für Mitarbeiter-Dropdown**:
```sql
SELECT ID, NAME1, NAME2
FROM V_DERP_EMPLOYEES
WHERE ISACTIVE = 1 AND ID NOT IN (-100, -101)
ORDER BY NAME1
```

**Wichtig**:
- Negative IDs sind möglich und können echte Benutzer sein!
- Nur -100 (SYSTEM) und -101 (SUPERADMIN) ausschließen
- -102 (und andere negative IDs) können reale Mitarbeiter sein

#### SYS_INDIVIDUAL_FIELDS (Individuelle Felder)

Definiert die Namen der benutzerdefinierten Felder:

**Felder**:
- FIELDNO (1-20)
- NAME (Feldname)
- LOCATION (1000 = Kunden, andere Werte für Artikel, Briefe, etc.)
- USED (0 = nicht verwendet, 1 = verwendet)

**Wichtig**: Pro FIELDNO können mehrere Einträge existieren (für verschiedene Module). Daher wird der erste nicht-generische Name bevorzugt (ohne "Feld " oder "freies Feld" Präfix).

#### BAS_CUSTOMERS (Basis-Kundentabelle)

Kundenstammdaten ohne erweiterte Felder:

**Verwendung**: Für einfache Listen ausreichend, für Details V_MAIN_CUSTOMERS nutzen.

#### Weitere Tabellen

**MOV_* Tabellen**: Bewegungsdaten (Activities, Projects, Invoices, etc.)
**BAS_* Tabellen**: Stammdaten (Customers, Articles, etc.)
**V_* Views**: Views mit JOINs für einfachen Zugriff
**A_DE_* Tabellen**: Deutsche Anwendungstabellen
**SYS_* Tabellen**: Systemtabellen (Konfiguration, Felder, etc.)

---

## Troubleshooting

### Umlaute werden als "�" angezeigt

**Ursache**: ODBC Character Set ist nicht auf UTF-8 konfiguriert

**Lösung**:
1. ODBC-Datenquelle auf dem Server öffnen
2. Character Set auf "UTF-8" ändern (nicht ISO8859_1)
3. Für alle Mandanten durchführen
4. ODBC Service neu starten

### Telefonnummern haben falsche Bindestriche

**Ursache**: Windows-1252 Control Character (0x96) wird als UTF-8 interpretiert

**Lösung**: Wird automatisch durch `normalizePhoneNumber()` korrigiert
- En dash (–, U+2013) → `-`
- Em dash (—, U+2014) → `-`
- Windows-1252 (0x96) → `-`
- Mehrere Leerzeichen → ` - `

### "Error connecting to the database"

**Mögliche Ursachen**:
1. ODBC API Service ist nicht erreichbar
2. API-Key ist falsch
3. Netzwerkproblem zwischen Next.js Server und ODBC Service
4. Firewall blockiert Port 3001

**Debugging**:
```typescript
// Test Connection
const client = createOrgamaxClient();
const result = await client.testConnection();
console.log(result);
```

### Individuelle Felder zeigen generische Namen

**Ursache**: Mehrere Einträge in SYS_INDIVIDUAL_FIELDS für dieselbe FIELDNO

**Lösung**: Logik bevorzugt nicht-generische Namen:
```typescript
const currentIsGeneric = acc[fieldNo]?.startsWith('Feld ') ||
                        acc[fieldNo]?.startsWith('freies Feld');
const newIsGeneric = fieldName?.startsWith('Feld ') ||
                    fieldName?.startsWith('freies Feld');

if (!acc[fieldNo] || (currentIsGeneric && !newIsGeneric)) {
  acc[fieldNo] = fieldName;
}
```

### Duplikate in Kundenliste

**Ursache**: V_MAIN_CUSTOMERS kann durch JOINs Duplikate erzeugen

**Lösung**: Automatische Deduplizierung nach CUSTNO:
```typescript
const uniqueCustomers = data.customers.reduce((acc, customer) => {
  if (!acc.find(c => c.CUSTNO === customer.CUSTNO)) {
    acc.push(customer);
  }
  return acc;
}, []);
```

### API gibt 401 Unauthorized zurück

**Ursache**: Keine NextAuth Session vorhanden

**Lösung**: Benutzer muss eingeloggt sein. Alle Orgamax-Seiten prüfen automatisch:
```typescript
useEffect(() => {
  if (status === 'unauthenticated') {
    router.push('/login');
  }
}, [status, router]);
```

### Aufwand-Änderungen werden nicht gespeichert

**Problem 1: Mitarbeiter-Änderungen erscheinen nicht**

**Ursache**: EMPLID statt EMPLID_WORKER aktualisiert

**Lösung**: Beide Felder setzen, aber EMPLID_WORKER ist das wichtige:
```typescript
sql = `UPDATE MOV_ACTIVITIES SET
  EMPLID_WORKER = ${employeeId},
  EMPLID = ${employeeId},
  ...
  WHERE ID = ${activityId}`;
```

**Problem 2: Zeit-Änderungen werden nicht angezeigt**

**Ursache**: Nur TIMINGSECONDS aktualisiert, aber nicht DURATION

**Lösung**: Beide Felder synchron halten:
```typescript
const durationInSeconds = hours * 3600 + minutes * 60 + seconds;
const durationTimestamp = `1899-12-30 ${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;

sql = `UPDATE MOV_ACTIVITIES SET
  TIMINGSECONDS = ${durationInSeconds},
  DURATION = '${durationTimestamp}',
  ...
  WHERE ID = ${activityId}`;
```

### Mitarbeiter fehlt in Dropdown (negative ID)

**Ursache**: Filter `ID > 0` oder `ID >= 0` schließt negative IDs aus

**Lösung**: Spezifischen Ausschluss statt Bereichsfilter:
```sql
-- Falsch:
WHERE ISACTIVE = 1 AND ID > 0     -- schließt -102 aus!
WHERE ISACTIVE = 1 AND ID >= 0    -- schließt -102 aus!

-- Richtig:
WHERE ISACTIVE = 1 AND ID NOT IN (-100, -101)  -- -102 bleibt erhalten!
```

### ODBC Error bei SELECT * FROM V_DERP_EMPLOYEES

**Ursache**: ODBC-Treiber hat Probleme mit SELECT * auf dieser View

**Lösung**: Explizite Spaltenauswahl verwenden:
```sql
-- Falsch:
SELECT * FROM V_DERP_EMPLOYEES

-- Richtig:
SELECT ID, NAME1, NAME2 FROM V_DERP_EMPLOYEES
```

---

## Best Practices

### 1. Immer fixDataEncoding() verwenden

Bei allen Daten, die aus Orgamax kommen:

```typescript
const fixedActivities = data.data.map((activity) =>
  fixDataEncoding(activity)
);
```

### 2. Mandanten-Auswahl implementieren

Alle Seiten sollten eine Mandanten-Auswahl haben:

```typescript
const [mandant, setMandant] = useState<1 | 2 | 4>(4);
```

### 3. Error Handling

Immer try-catch und Error State:

```typescript
try {
  const response = await fetch('/api/orgamax/query', {...});
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Fehler beim Laden');
  }
} catch (err) {
  setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
}
```

### 4. Loading States

UX-Verbesserung durch Loading-Indikatoren:

```typescript
const [loading, setLoading] = useState(false);

// In der Komponente
{loading && <Loader2 className="animate-spin" />}
```

### 5. Authentifizierung prüfen

In allen API-Routes:

```typescript
const session = await getAuthSession();
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### 6. Aufwände korrekt erstellen/bearbeiten

**Bei INSERT (neuer Aufwand)**:
```typescript
const now = new Date().toISOString().replace('T', ' ').substring(0, 23);
const durationTimestamp = `1899-12-30 ${hours}:${minutes}:${seconds}`;

sql = `INSERT INTO MOV_ACTIVITIES (
  LOCATION, INSERTUSER, INSERTDATE, EDITUSER, EDITDATE,
  CUSTID, PROJECTID, ARTID, TIMINGSECONDS, PRICEPERUNIT,
  UNITONSTART, EMPLID, EMPLID_WORKER, STARTINGDATE, DURATION,
  UNITS, PRICEPOSITION, ACTIVITYTITLE, ACTIVITYTEXT,
  FAKTURA, CREDITBOOKING, GRIDCATEGORY, ARCHIV
) VALUES (
  1000, ${employeeId}, '${now}', ${employeeId}, '${now}',
  ${customerId}, 0, 1, ${durationInSeconds}, 0,
  1, ${employeeId}, ${employeeId}, '${date}', '${durationTimestamp}',
  1, 0, '${title}', '${text}',
  0, 0, 0, 0
)`;
```

**Wichtig**:
- ID **nicht** setzen - wird automatisch von Orgamax vergeben
- CUSTID verwenden (nicht CUSTNO!)
- EMPLID und EMPLID_WORKER beide setzen
- TIMINGSECONDS und DURATION synchron halten

**Bei UPDATE (Aufwand bearbeiten)**:
```typescript
const now = new Date().toISOString().replace('T', ' ').substring(0, 23);

sql = `UPDATE MOV_ACTIVITIES SET
  ACTIVITYTITLE = '${escapedTitle}',
  ACTIVITYTEXT = '${escapedText}',
  EMPLID_WORKER = ${employeeId},    -- Wichtig: wird von View verwendet!
  EMPLID = ${employeeId},             -- Für Konsistenz
  EDITUSER = ${employeeId},
  EDITDATE = '${now}',
  STARTINGDATE = '${date}',
  TIMINGSECONDS = ${durationInSeconds},
  DURATION = '${durationTimestamp}'
  WHERE ID = ${activityId}`;
```

**Wichtig**:
- EMPLID_WORKER aktualisieren (wird von V_MAIN_ACTIVITIES verwendet!)
- EDITDATE auf aktuellen Timestamp setzen
- Beide Zeitfelder (TIMINGSECONDS und DURATION) aktualisieren

### 7. Zeit-Konvertierung korrekt implementieren

**Von HH:MM:SS zu Sekunden**:
```typescript
const timeParts = editDuration.split(':');
const hours = parseInt(timeParts[0], 10) || 0;
const minutes = parseInt(timeParts[1], 10) || 0;
const seconds = parseInt(timeParts[2], 10) || 0;
const durationInSeconds = hours * 3600 + minutes * 60 + seconds;
```

**Von Sekunden zu HH:MM:SS**:
```typescript
const hours = Math.floor(totalSeconds / 3600);
const minutes = Math.floor((totalSeconds % 3600) / 60);
const seconds = Math.floor(totalSeconds % 60);
const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
```

**DURATION Timestamp erstellen**:
```typescript
const durationTimestamp = `1899-12-30 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
```

---

## Weitere Entwicklung

### Geplante Features

1. **Rechnungen**: Integration von V_MAIN_INVOICES
2. **Angebote**: Integration von Angebotsdaten
3. **Artikel**: Produktverwaltung
4. **Projekte**: Erweiterte Projektansicht
5. **Dashboard**: Statistiken und Auswertungen
6. **Export**: CSV/Excel-Export von Daten
7. **Synchronisation**: Automatischer Datenabgleich
8. **Aufwand löschen**: DELETE-Funktion für Aufwände
9. **Bulk-Operationen**: Mehrere Aufwände gleichzeitig bearbeiten

### Erweiterungsmöglichkeiten

1. **Caching**: Redis-Cache für häufig abgerufene Daten
2. **Webhooks**: Benachrichtigungen bei Änderungen
3. **Schreibzugriff**: Aktuell nur Lesezugriff implementiert
4. **Batch-Operationen**: Mehrere Abfragen gleichzeitig
5. **GraphQL**: Alternative API mit GraphQL

---

## Kontakt & Support

Bei Fragen zur Orgamax-Integration:

- **Entwickler**: Michael Medzech
- **E-Mail**: michael@54north.solutions
- **Repository**: d:\Visual Studio Projekte\Projektverwaltung\projektverwaltung

---

## Changelog

### Version 1.1 (08.11.2025)
- **Aufwandsverwaltung**: Vollständige CRUD-Funktionalität für Aufwände
  - Neuen Aufwand erstellen (INSERT in MOV_ACTIVITIES)
  - Aufwand bearbeiten (UPDATE in MOV_ACTIVITIES)
  - Mitarbeiter-Dropdown mit V_DERP_EMPLOYEES
  - Zeit-Eingabe in HH:MM:SS Format
  - Synchronisation von TIMINGSECONDS und DURATION
  - Korrekte Verwendung von EMPLID_WORKER statt EMPLID
- **Kundendetails**: Aufwände-Tab in erweiterten Kundendaten
- **Dokumentation**: Umfassende Troubleshooting-Sektion hinzugefügt

### Version 1.0 (07.11.2025)
- Initiale Version mit Basis-Funktionalität
- Kunden-Verwaltung (Anzeige)
- Aktivitäten-Anzeige
- API Explorer
- Datenstruktur-Explorer

---

**Letzte Aktualisierung**: 08.11.2025
**Version**: 1.1
