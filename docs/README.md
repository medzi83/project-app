# Projektverwaltung - Dokumentation

Willkommen zur Dokumentation der Projektverwaltungs-Anwendung.

## 🚨 WICHTIGSTE DOKUMENTATION

### ⚠️ Datenbank-Migrationen - **PFLICHTLEKTÜRE!**

**→ [PRISMA-MIGRATIONS.md](./PRISMA-MIGRATIONS.md)** ← **NUR DIESE METHODE VERWENDEN!**

**Wichtig:** Die Dokumente `MIGRATION_STRATEGY.md` und `PRISMA_MIGRATIONS_VERCEL.md` sind **VERALTET** und enthalten **falsche Anleitungen** für unser pgBouncer-Setup!

Siehe auch: [DATABASE_MIGRATIONS_AKTUELL.md](./DATABASE_MIGRATIONS_AKTUELL.md) für Erklärung warum.

---

## 📚 Verfügbare Dokumentationen

### Datenbank & Migrationen

- **[✅ PRISMA-MIGRATIONS.md](./PRISMA-MIGRATIONS.md)** - **AKTUELLE & VERBINDLICHE** Anleitung für Datenbankmigrationen (pgBouncer-kompatibel)
- **[⚠️ DATABASE_MIGRATIONS_AKTUELL.md](./DATABASE_MIGRATIONS_AKTUELL.md)** - Erklärt warum alte Docs veraltet sind
- **[Migration: Contact Field](./MIGRATION_CONTACT_FIELD.md)** - Beispiel einer erfolgreichen Migration
- ~~**[❌ MIGRATION_STRATEGY.md](./MIGRATION_STRATEGY.md)**~~ - VERALTET (nur Konzepte noch gültig)
- ~~**[❌ PRISMA_MIGRATIONS_VERCEL.md](./PRISMA_MIGRATIONS_VERCEL.md)**~~ - VERALTET (funktioniert nicht mit pgBouncer)

### Features & Funktionen

- **[Joomla-Installation Löschen](./JOOMLA_INSTALLATION_DELETE.md)** - Vollständige Dokumentation der Lösch-Funktion für Joomla-Installationen
- **[Session Timeout](./SESSION_TIMEOUT.md)** - Automatisches 12-Stunden Session-Timeout für erhöhte Sicherheit
- **[Event-Based Architecture](./EVENT_BASED_ARCHITECTURE.md)** - Event-System für asynchrone Verarbeitung
- **[Joomla Installation](./joomla_installation.md)** - Joomla-Installationsprozess
- **[Joomla Technical](./JOOMLA_TECHNICAL.md)** - Technische Details zur Joomla-Integration
- **[Joomla Troubleshooting](./JOOMLA_TROUBLESHOOTING.md)** - Problemlösungen für Joomla
- **[Joomla Installation Delete](./JOOMLA_INSTALLATION_DELETE.md)** - Löschprozess für Joomla-Installationen

### Deployment & Infrastruktur

- **[Deployment Guide](./DEPLOYMENT.md)** - Anleitung für Deployment auf Vercel und Troubleshooting
- **[Naive Date Formatting](./NAIVE_DATE_FORMATTING.md)** - Zeitzonenprobleme vermeiden durch direkte ISO-String-Extraktion
- **[Froxlor 2.x Migration](./FROXLOR_2X_MIGRATION.md)** - Froxlor API-Änderungen

### Integrationen

- **[Orgamax Integration](./orgamax-integration.md)** - Integration mit Orgamax ERP-System

### Codebase

- **[Codebase Analyse](./CODEBASE_ANALYSIS.md)** - Übersicht über die Codebase-Struktur

---

## 📖 Dokumentations-Richtlinien

Beim Erstellen neuer Dokumentation bitte folgendes beachten:

### Dateinamen

- Großbuchstaben mit Unterstrichen oder Bindestrichen: `FEATURE_NAME.md` oder `PRISMA-MIGRATIONS.md`
- Beschreibend und prägnant
- Beispiele: `USER_AUTHENTICATION.md`, `EMAIL_SYSTEM.md`

### Struktur

Jede Dokumentation sollte folgende Abschnitte enthalten:

1. **Übersicht** - Kurze Beschreibung des Features
2. **Features** - Hauptfunktionen und Möglichkeiten
3. **Technische Details** - API-Endpunkte, Code-Referenzen
4. **Verwendung** - Anleitung für Endnutzer
5. **Code-Referenzen** - Links zu relevanten Dateien
6. **Changelog** - Versionshistorie

### Markdown-Formatierung

- Verwende Überschriften (`#`, `##`, `###`)
- Code-Blöcke mit Syntax-Highlighting (` ```typescript `)
- Checkboxen für Listen (`✅`, `❌`, `⚠️`)
- Tabellen für strukturierte Daten
- Links zu Code-Dateien

### Veraltete Dokumentation

Wenn eine Dokumentation veraltet ist:
1. **Nicht löschen** - Für historische Referenz behalten
2. **Kennzeichnen** - Mit `❌` oder `⚠️ VERALTET` markieren
3. **Verweis** - Auf neue/aktuelle Dokumentation verweisen
4. **Backup** - Backup-Datei mit `.backup` erstellen

---

## 🔄 Updates

Diese Dokumentation wird kontinuierlich erweitert. Neue Features sollten immer dokumentiert werden.

**Letztes Update:** 18. Januar 2025
**Wichtigste Änderung:** Aktualisierung der Migrations-Dokumentation für pgBouncer-Setup
