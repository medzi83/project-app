# Session Timeout - 12 Stunden

## Übersicht

Die Anwendung verwendet ein automatisches Session-Timeout von **12 Stunden**. Nach Ablauf dieser Zeit wird der Benutzer automatisch abgemeldet und zur Login-Seite weitergeleitet.

**Implementiert:** Januar 2025
**Timeout-Dauer:** 12 Stunden
**Technologie:** NextAuth.js mit JWT-Strategie

---

## Funktionsweise

### Server-seitig (NextAuth)

Die Session-Verwaltung erfolgt über JWT-Tokens mit folgenden Einstellungen:

```typescript
session: {
  strategy: "jwt",
  maxAge: 12 * 60 * 60, // 12 hours in seconds
}
```

**Datei:** `app/api/auth/[...nextauth]/route.ts`

### JWT-Callback-Logik

Bei jedem Request wird überprüft, ob die Session noch gültig ist:

```typescript
async jwt({ token, user }) {
  // Bei Login: Speichere initiale Anmeldezeit
  if (user) {
    token.iat = Math.floor(Date.now() / 1000);
    // ... weitere User-Daten
  }

  // Prüfe Ablauf der Session
  const iat = token.iat || Math.floor(Date.now() / 1000);
  const maxAge = 12 * 60 * 60; // 12 Stunden
  const currentTime = Math.floor(Date.now() / 1000);

  if (currentTime - iat > maxAge) {
    // Session abgelaufen -> leeres Token zurückgeben
    return {};
  }

  return token;
}
```

### Client-seitig (SessionTimeout Komponente)

**Datei:** `components/SessionTimeout.tsx`

Die Komponente überwacht den Session-Status:

```typescript
const { data: session, status } = useSession();

useEffect(() => {
  if (status === "unauthenticated") {
    // Weiterleitung zur Login-Seite
    router.push("/login?expired=true");
  }
}, [status]);
```

**Features:**
- Automatische Weiterleitung zur Login-Seite
- URL-Parameter `?expired=true` für Timeout-Nachricht
- Session-Check alle 5 Minuten
- Speichert versuchte URL für Redirect nach Login

---

## Benutzer-Erfahrung

### Ablauf bei Session-Timeout

1. **Benutzer ist inaktiv für 12 Stunden**
2. Session läuft serverseitig ab
3. Nächster Request erkennt abgelaufene Session
4. Client-Komponente erkennt `unauthenticated` Status
5. Automatische Weiterleitung zu `/login?expired=true`
6. Login-Seite zeigt Timeout-Nachricht an

### Nachricht auf Login-Seite

Wenn `?expired=true` in der URL:

```
⏰ Session abgelaufen
Ihre Session ist nach 12 Stunden abgelaufen.
Bitte melden Sie sich erneut an.
```

**Styling:** Amber-farbene Infobox mit Uhr-Icon

---

## Technische Details

### Session-Speicherung

- **Strategie:** JWT (JSON Web Tokens)
- **Speicherort:** HTTP-Only Cookie
- **Token-Name:** `next-auth.session-token`
- **Max-Age:** 12 Stunden (43200 Sekunden)

### Token-Struktur

```typescript
{
  id: string;           // User ID
  email: string;        // User Email
  role: UserRole;       // ADMIN | AGENT | CUSTOMER
  clientId: string | null;
  iat: number;          // Initial Authentication Time (Unix Timestamp)
  exp: number;          // Expiration Time (Unix Timestamp)
}
```

### Sicherheitsaspekte

✅ **HTTP-Only Cookies** - Token ist nicht per JavaScript zugänglich
✅ **Server-side Validation** - Token-Prüfung bei jedem Request
✅ **Automatisches Logout** - Keine manuellen Aktionen nötig
✅ **CSRF-Schutz** - NextAuth integriert CSRF-Protection
✅ **Sichere Übertragung** - Nur über HTTPS in Production

---

## Konfiguration

### Timeout-Dauer ändern

In `app/api/auth/[...nextauth]/route.ts`:

```typescript
session: {
  strategy: "jwt" as const,
  maxAge: 24 * 60 * 60, // z.B. 24 Stunden
}
```

**Wichtig:** Wert in Sekunden angeben!

Beispiele:
- 1 Stunde: `1 * 60 * 60` = 3600
- 8 Stunden: `8 * 60 * 60` = 28800
- 12 Stunden: `12 * 60 * 60` = 43200
- 24 Stunden: `24 * 60 * 60` = 86400
- 7 Tage: `7 * 24 * 60 * 60` = 604800

### Session-Check-Intervall

In `components/SessionTimeout.tsx`:

```typescript
const interval = setInterval(() => {
  // Session-Check
}, 5 * 60 * 1000); // 5 Minuten
```

Empfohlen: 5-10 Minuten für gute Balance zwischen Responsiveness und Performance

---

## Integration

### Layout-Integration

**Datei:** `app/layout.tsx`

```typescript
<AuthSessionProvider session={session}>
  <SessionTimeout />  {/* Session-Überwachung */}
  {/* Restlicher Content */}
</AuthSessionProvider>
```

Die `SessionTimeout`-Komponente:
- Wird global in jedem Layout gerendert
- Rendert selbst nichts (null)
- Läuft im Hintergrund
- Reagiert nur auf Session-Status-Änderungen

---

## Vorteile

✅ **Automatisch** - Keine manuelle Logout-Funktion nötig
✅ **Sicher** - Verhindert unbefugten Zugriff bei langer Inaktivität
✅ **Benutzerfreundlich** - Klare Nachricht bei Timeout
✅ **Flexibel** - Einfach konfigurierbar
✅ **Performance** - Minimaler Overhead durch JWT

---

## Bekannte Limitierungen

### Keine Sliding-Session

Aktuell: **Fixed Session** - 12 Stunden ab Login
- Timeout läuft auch bei Aktivität ab
- Session wird NICHT bei Aktivität verlängert

**Mögliche Verbesserung:**
Sliding Session implementieren, die bei jeder Aktivität verlängert wird.

```typescript
// Beispiel für Sliding Session
async jwt({ token, user, trigger }) {
  if (trigger === "update") {
    // Verlängere Session bei Aktivität
    token.iat = Math.floor(Date.now() / 1000);
  }
  // ...
}
```

### Browser-Tabs

- Jeder Tab teilt die gleiche Session
- Logout in einem Tab = Logout in allen Tabs
- Session-Timeout betrifft alle offenen Tabs gleichzeitig

---

## Testing

### Manueller Test

1. Login mit gültigen Credentials
2. Warte 12 Stunden (oder ändere `maxAge` temporär auf 60 Sekunden)
3. Führe beliebige Aktion aus (z.B. Seite neu laden)
4. Erwartung: Automatische Weiterleitung zu `/login?expired=true`
5. Login-Seite zeigt Timeout-Nachricht

### Schneller Test (für Entwicklung)

Temporär in `route.ts` ändern:

```typescript
session: {
  strategy: "jwt" as const,
  maxAge: 60, // 60 Sekunden für Testing
}
```

**WICHTIG:** Nach Test wieder auf 12 Stunden zurücksetzen!

---

## Fehlerbehebung

### Session läuft nicht ab

**Mögliche Ursachen:**
1. Browser-Cache - Lösung: Hard Refresh (Ctrl+Shift+R)
2. `maxAge` nicht gesetzt - Lösung: Wert in `authOptions` prüfen
3. NextAuth-Version - Lösung: `next-auth@latest` verwenden

### Benutzer wird nicht weitergeleitet

**Mögliche Ursachen:**
1. `SessionTimeout` nicht im Layout - Lösung: Import prüfen
2. JavaScript-Fehler - Lösung: Browser-Konsole prüfen
3. `useSession()` Hook nicht verfügbar - Lösung: `AuthSessionProvider` prüfen

### Nachricht wird nicht angezeigt

**Mögliche Ursachen:**
1. URL-Parameter fehlt - Lösung: `?expired=true` in `SessionTimeout.tsx` prüfen
2. State nicht gesetzt - Lösung: `useState` und `useEffect` in `login/page.tsx` prüfen

---

## Weitere Verbesserungsmöglichkeiten

1. **Sliding Session** - Session bei Aktivität verlängern
2. **Countdown-Anzeige** - Zeige verbleibende Zeit vor Logout
3. **Warnung vor Ablauf** - Popup 5 Minuten vor Timeout
4. **Keep-Alive** - Optional: Session durch Hintergrund-Requests aktiv halten
5. **Remember Me** - Option für längere Session-Dauer
6. **Audit-Log** - Protokolliere Login/Logout-Events

---

## Code-Referenzen

### Hauptdateien

- **NextAuth-Konfiguration:** `app/api/auth/[...nextauth]/route.ts`
- **SessionTimeout-Komponente:** `components/SessionTimeout.tsx`
- **Layout-Integration:** `app/layout.tsx`
- **Login-Seite:** `app/login/page.tsx`

---

## Changelog

### Version 1.0 (Januar 2025)

- ✅ Initiale Implementierung
- ✅ 12-Stunden Timeout
- ✅ Automatische Weiterleitung
- ✅ Timeout-Nachricht auf Login-Seite
- ✅ Client-seitige Session-Überwachung
- ✅ URL-Parameter für Timeout-Erkennung

---

## Verwandte Dokumentation

- NextAuth.js Docs: https://next-auth.js.org/
- JWT.io: https://jwt.io/
