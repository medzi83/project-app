# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

## [2.2.0] - 2025-10-31

### 🔒 Security (Sicherheit)

#### Kritische Sicherheitslücken behoben

- **IDOR-Schwachstelle behoben**: `/api/clients/update-contact` - Customers können jetzt nur noch ihre eigenen Client-Daten ändern, nicht mehr fremde Daten manipulieren
- **Unbefugter E-Mail-Versand verhindert**: `/api/email/send-client-email` - Nur ADMIN und AGENT können jetzt E-Mails versenden
- **Template-Zugriff eingeschränkt**: `/api/email-templates/*` - Nur ADMIN und AGENT haben Zugriff auf E-Mail-Templates
- **Import-Funktionen gesichert**: CSV-Import für Projekte und Filmprojekte erfordert jetzt ADMIN-Rechte
- **Agentur-Liste geschützt**: `/api/agencies` - Nur ADMIN und AGENT können die Agenturliste abrufen

#### Authentication & Authorization

- **Middleware erweitert**: Alle Routen (inkl. `/login`) werden jetzt durch Middleware geschützt
- **Auto-Redirect implementiert**: Eingeloggte User werden automatisch von `/login` zu `/dashboard` umgeleitet
- **RootLayout dokumentiert**: Klare Kommentare zur Auth-Logik und AppShell-Rendering hinzugefügt

#### Neue Auth-Helper-Funktionen

Drei neue Helper-Funktionen in `lib/authz.ts` für bessere Code-Lesbarkeit:

- `isAuthenticated()` - Boolean-Check ohne Exception
- `hasRole(role)` - Prüft spezifische Rolle
- `hasAnyRole(roles)` - Prüft ob User eine der angegebenen Rollen hat

### 📊 Analysierte Bereiche

- 34 API-Routes überprüft und gesichert
- 100+ Server Actions analysiert
- 7 kritische Sicherheitslücken identifiziert und behoben

### 🔧 Geänderte Dateien

- `middleware.ts` - Erweiterte Authentifizierungs-Logik
- `app/layout.tsx` - Dokumentation hinzugefügt
- `lib/authz.ts` - Neue Helper-Funktionen
- `app/api/email/send-client-email/route.ts` - Role-Check hinzugefügt
- `app/api/clients/update-contact/route.ts` - IDOR-Schutz implementiert
- `app/api/email-templates/general/route.ts` - Role-Check hinzugefügt
- `app/api/email-templates/render-client-template/route.ts` - Role-Check hinzugefügt
- `app/api/agencies/route.ts` - Role-Check hinzugefügt
- `app/admin/import/actions.ts` - Auth-Prüfung hinzugefügt
- `app/admin/film-import/actions.ts` - Auth-Prüfung hinzugefügt

---

## [2.1.0] - Vorherige Version

_Frühere Änderungen sind hier nicht dokumentiert._
