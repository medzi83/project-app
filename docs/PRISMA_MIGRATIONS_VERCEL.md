# ❌ VERALTET: Prisma Migrations mit Vercel Deployment

> ## 🚨 ACHTUNG: DIESES DOKUMENT IST VERALTET!
>
> **Diese Anleitung funktioniert NICHT mit unserem pgBouncer-Setup!**
>
> ### ✅ AKTUELLE DOKUMENTATION:
> **→ [PRISMA-MIGRATIONS.md](./PRISMA-MIGRATIONS.md)** ← **NUR DIESE VERWENDEN!**
>
> **Warum ist dieses Dokument veraltet?**
> - Die Anleitung empfiehlt `npx prisma migrate dev` - das funktioniert NICHT mit pgBouncer
> - Unser Setup erfordert manuelle Migration-Files und `npx prisma migrate deploy`
> - Siehe [DATABASE_MIGRATIONS_AKTUELL.md](./DATABASE_MIGRATIONS_AKTUELL.md) für Details
>
> **Dieses Dokument wird nur für historische Referenz behalten.**

---

**Erstellt:** 13. November 2024
**Status:** ❌ VERALTET - NICHT VERWENDEN
**Kategorie:** Development Guidelines (OBSOLETE)

## Architektur-Übersicht

```
Lokaler PC (Development)
    ↓ Schema-Änderungen + git push
GitHub Repository
    ↓ Automatisches Deployment
Vercel (Production)
    ↓ Führt prisma migrate deploy aus
Gemeinsame PostgreSQL Datenbank (Supabase)
    ↑
Lokaler PC greift direkt zu
```

**Wichtig:** Lokal und Vercel nutzen dieselbe Datenbank!

## Problem: Warum nicht `db push`?

### Was wir früher gemacht haben (FALSCH für Vercel)

```bash
# Lokal: Schema ändern
npx prisma db push  # ✅ Funktioniert lokal

# Code zu Git pushen
git push

# Vercel deployed automatisch
# ⚠️ Problem: Vercel weiß nicht, welche Schema-Version in DB ist
# ⚠️ Keine Migrations = Keine Versionskontrolle
```

### Das Problem

- `db push` ist nicht versioniert
- Vercel kann nicht erkennen, ob Schema-Änderungen bereits angewendet wurden
- Race Conditions möglich bei Deployments
- Keine Rollback-Möglichkeit

## Lösung: Migrations mit Vercel

### 1. package.json Build Command angepasst

**Datei:** [package.json:7](../package.json#L7)

```json
{
  "scripts": {
    "build": "prisma migrate deploy && prisma generate && next build"
  }
}
```

**Was passiert bei Vercel Deployment:**
1. `prisma migrate deploy` - Wendet fehlende Migrations auf DB an
2. `prisma generate` - Generiert Prisma Client
3. `next build` - Baut die Next.js App

### 2. Migration-Workflow für Solo-Entwickler

#### ✅ Korrekter Workflow (ab jetzt)

```bash
# 1. Schema in prisma/schema.prisma ändern
# Beispiel: ftpPasswords Json? hinzufügen

# 2. Migration erstellen (lokal)
npx prisma migrate dev --name add_ftp_passwords

# Was passiert:
# - Prisma erstellt Migration-Datei in prisma/migrations/
# - Migration wird auf lokale DB angewendet
# - Prisma Client wird neu generiert

# 3. Änderungen committen
git add .
git commit -m "Add FTP password storage"
git push

# 4. Vercel deployed automatisch
# - Führt prisma migrate deploy aus
# - Wendet nur fehlende Migrations an
# - Build läuft mit korrektem Schema
```

#### ❌ Falscher Workflow (nicht mehr nutzen)

```bash
# NICHT MEHR SO MACHEN:
npx prisma db push  # Skip migrations
git push            # Vercel hat keine Migration-Info
```

## Aktuelle Situation (Nach Migration auf Migrations-System)

### Was wir heute gemacht haben

1. **Ausgangslage:**
   - Alte Migrations in `prisma/migrations-old/` (zur Sicherheit umbenannt)
   - Schema-Änderung (`ftpPasswords Json?`) bereits mit `db push` angewendet
   - Drift zwischen lokalen Migrations und DB

2. **Durchgeführte Schritte:**
   - ✅ `package.json` Build Command angepasst
   - ✅ Schema mit `db push` auf DB angewendet (letzte Mal!)
   - ✅ Code zu Git gepusht
   - ✅ Vercel Deployment erfolgreich

3. **Migration-Status:**
   ```bash
   npx prisma migrate status
   # Output: No migration found in prisma/migrations
   #         Database schema is up to date!
   ```

### Was bedeutet das?

- ✅ **Aktuelle Situation ist sauber**
- ✅ Schema ist in DB (inkl. ftpPasswords)
- ✅ Vercel läuft korrekt
- ⚠️ Keine Migration-Files vorhanden (weil letztes Mal `db push` genutzt)

### Nächste Schema-Änderung wird zur Baseline

Bei der **nächsten Schema-Änderung** wird automatisch eine saubere Migration erstellt:

```bash
# Beispiel: Neues Feld hinzufügen
# prisma/schema.prisma: emailPasswords Json?

npx prisma migrate dev --name add_email_passwords

# Prisma erstellt:
# - prisma/migrations/20241113120000_add_email_passwords/migration.sql
# - Dies wird quasi zur neuen Baseline
```

## Best Practices für zukünftige Migrationen

### 1. Immer `migrate dev` verwenden

```bash
# ✅ Richtig
npx prisma migrate dev --name descriptive_name

# ❌ Falsch (nicht mehr nutzen)
npx prisma db push
```

### 2. Aussagekräftige Namen verwenden

```bash
# ✅ Gute Namen
npx prisma migrate dev --name add_ftp_passwords
npx prisma migrate dev --name add_email_templates
npx prisma migrate dev --name update_user_roles

# ❌ Schlechte Namen
npx prisma migrate dev --name migration1
npx prisma migrate dev --name temp
npx prisma migrate dev --name fix
```

### 3. Additive Changes bevorzugen

Siehe [MIGRATION_STRATEGY.md](./MIGRATION_STRATEGY.md) für Details.

```typescript
// ✅ Phase 1: Neue Felder hinzufügen
model Client {
  oldField  String?  // Bleibt erstmal
  newField  String?  // Neu hinzufügen
}

// Migration erstellen
npx prisma migrate dev --name add_new_field

// ✅ Phase 2: Daten migrieren (Script)
// ✅ Phase 3: Alte Felder entfernen
npx prisma migrate dev --name remove_old_field
```

### 4. Migration-Files in Git committen

```bash
# IMMER Migration-Files mit committen
git add prisma/migrations/
git add prisma/schema.prisma
git commit -m "Add new feature with migration"
git push
```

### 5. Niemals Migration-Files manuell bearbeiten

```bash
# ❌ NIEMALS so:
echo "ALTER TABLE..." > prisma/migrations/xyz/migration.sql

# ✅ Immer Prisma CLI nutzen:
npx prisma migrate dev --name xyz
```

## Vercel Deployment Verhalten

### Bei jedem Git Push

```bash
git push
    ↓
Vercel erkennt neue Commits
    ↓
Build Command läuft:
    ├─ prisma migrate deploy  # Wendet fehlende Migrations an
    ├─ prisma generate         # Generiert Client
    └─ next build              # Baut App
    ↓
Deployment läuft live
```

### Wenn keine neuen Migrations vorhanden

```bash
prisma migrate deploy
# Output: No pending migrations to apply
# → Überspringt Migration-Schritt
# → Build läuft normal weiter
```

### Wenn neue Migration vorhanden

```bash
prisma migrate deploy
# Output: Applying migration `20241113120000_add_ftp_passwords`
# → Wendet Migration auf DB an
# → Build läuft mit aktualisiertem Schema
```

## Häufige Fehler vermeiden

### ❌ Fehler 1: `db push` nach Migration-Setup

```bash
# NICHT MEHR SO:
npx prisma db push  # ⚠️ Umgeht Migration-System
git push            # Vercel hat keine Migration-Info
```

**Folge:** Vercel weiß nicht, dass Schema geändert wurde.

**Lösung:** Immer `migrate dev` nutzen!

### ❌ Fehler 2: Migration-Files nicht committen

```bash
npx prisma migrate dev --name add_field
# ... vergisst git add prisma/migrations/
git push  # ⚠️ Migration-Files fehlen in Git
```

**Folge:** Vercel kann Migration nicht ausführen.

**Lösung:** Immer `git add prisma/migrations/` vor dem Push!

### ❌ Fehler 3: Schema ändern ohne Migration

```bash
# prisma/schema.prisma editieren
# ... direkt git push ohne migrate dev
```

**Folge:** Vercel Build schlägt fehl (Schema nicht in DB).

**Lösung:** Immer zuerst `migrate dev` ausführen!

## Rollback-Strategie

### Bei Fehler in Migration

```bash
# 1. Migration rückgängig machen (lokal)
# Letzten Commit rückgängig machen
git reset --hard HEAD~1

# 2. Migration aus DB entfernen
npx prisma migrate resolve --rolled-back <migration-name>

# 3. Schema korrigieren und neu versuchen
npx prisma migrate dev --name fixed_migration
```

### Bei Fehler in Production (Vercel)

```bash
# 1. Zu letztem funktionierenden Commit zurückkehren
git revert <bad-commit-sha>
git push

# 2. Vercel deployed automatisch mit altem Stand
# 3. DB-Schema muss ggf. manuell bereinigt werden
```

## Monitoring und Debugging

### Migration-Status prüfen

```bash
# Zeigt alle angewendeten und ausstehenden Migrations
npx prisma migrate status
```

### Vercel Build Logs prüfen

1. Vercel Dashboard öffnen
2. Deployment auswählen
3. Build Logs anschauen
4. Nach `prisma migrate deploy` suchen

**Erfolg:**
```
Running "prisma migrate deploy"
No pending migrations to apply.
✓ Generated Prisma Client
```

**Fehler:**
```
Running "prisma migrate deploy"
Error: Migration xyz failed
```

## Checkliste für Schema-Änderungen

Nutze diese Checkliste bei jeder Schema-Änderung:

- [ ] Schema in `prisma/schema.prisma` anpassen
- [ ] `npx prisma migrate dev --name descriptive_name` ausführen
- [ ] Migration-SQL prüfen in `prisma/migrations/<timestamp>_<name>/migration.sql`
- [ ] Lokal testen (App neu starten)
- [ ] Änderungen committen: `git add prisma/`
- [ ] Commit erstellen: `git commit -m "Add: descriptive message"`
- [ ] Zu Git pushen: `git push`
- [ ] Vercel Deployment beobachten
- [ ] Production testen nach Deployment

## Backup-Strategie

### Vor größeren Migrationen

```bash
# 1. Datenbank-Backup erstellen (z.B. via Supabase Dashboard)

# 2. Migration lokal testen
npx prisma migrate dev --name big_change

# 3. Wenn erfolgreich: zu Git pushen
git push

# 4. Vercel Deployment beobachten

# 5. Bei Fehler: Rollback durchführen
```

## Zusammenfassung

### Die 3 goldenen Regeln

1. **Immer `migrate dev` nutzen** - Niemals mehr `db push` für Schema-Änderungen
2. **Migration-Files committen** - Immer `prisma/migrations/` in Git pushen
3. **Vercel macht den Rest** - `prisma migrate deploy` läuft automatisch bei jedem Deployment

### Dein neuer Workflow (einfach!)

```bash
# 1. Schema ändern
# 2. npx prisma migrate dev --name xyz
# 3. git add . && git commit -m "message" && git push
# 4. Fertig! Vercel deployed automatisch
```

## Wichtige Dateien

- **[package.json](../package.json)** - Build Command mit `prisma migrate deploy`
- **[prisma/schema.prisma](../prisma/schema.prisma)** - Datenbank-Schema
- **[prisma/migrations/](../prisma/migrations/)** - Migration-Files (werden von Prisma erstellt)
- **[prisma/migrations-old/](../prisma/migrations-old/)** - Alte Migrations (zur Sicherheit behalten)

## Verwandte Dokumentation

- [MIGRATION_STRATEGY.md](./MIGRATION_STRATEGY.md) - Allgemeine Migration Best Practices
- [FROXLOR_2X_MIGRATION.md](./FROXLOR_2X_MIGRATION.md) - Froxlor API Änderungen

---

**Letzte Aktualisierung:** 13. November 2024
**Verantwortlich:** Development Team
