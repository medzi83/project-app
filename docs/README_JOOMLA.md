# Joomla Automatische Installation - Quick Start

## Übersicht

Vollautomatische Installation einer Joomla-Basis auf Froxlor-Servern in **unter 1 Minute**.

## Voraussetzungen

- Server in Froxlor mit SSH/SFTP-Zugriff
- Kunde existiert in Froxlor
- Backup auf Vautron 6 (`109.235.60.55:/var/customers/basis-backup/`)

## Installation durchführen

### 1. In der App navigieren
```
/admin/basisinstallation?clientId=[CLIENT_ID]
```

### 2. Formular ausfüllen
- **Ordnername**: z.B. `demo2024` (nur Buchstaben, Zahlen, `-`, `_`)
- **DB-Passwort**: Automatisch generiert (kann angepasst werden)
- **Projekt zuordnen** (optional): Verknüpfung mit bestehendem Projekt

### 3. Installation starten
- Klick auf "Joomla automatisch installieren"
- **Dauer**: ~47 Sekunden (gleiches Server) oder ~2-3 Min (unterschiedliche Server)

### 4. Ergebnis
- ✅ Webseite sofort verfügbar unter `https://domain.de/ordnername`
- ✅ Datenbank angelegt und importiert
- ✅ Zugangsdaten werden angezeigt

## Performance

**Gleicher Server (Vautron 6 → Vautron 6):**
- Datei-Transfer: ~4 Sek (lokaler `cp`)
- Extraktion: ~40 Sek
- **Gesamt: ~47 Sekunden** ⚡

**Unterschiedliche Server:**
- Datei-Transfer: ~30-45 Sek (SFTP)
- Extraktion: ~40 Sek
- **Gesamt: ~2-3 Minuten**

## Wichtige Hinweise

- `.htaccess` wird automatisch aus dem Backup extrahiert (nicht überschreiben!)
- Datenbank-Passwort wird in Klartext gespeichert (nur für Admins sichtbar)
- Installation wird in Datenbank protokolliert

## Weitere Dokumentation

- 📘 **[Technische Dokumentation](./JOOMLA_INSTALLATION.md)** - API-Details, Code-Stellen
- 🔧 **[Troubleshooting](./JOOMLA_TROUBLESHOOTING.md)** - Problemlösungen
- 🗑️ **[Installation löschen](./JOOMLA_INSTALLATION_DELETE.md)** - Lösch-Prozess

## Backup verwalten

Upload neuer Backups unter `/admin/joomla-backup`:
- `kickstart.php` - Akeeba Kickstart Extraktor
- `*.jpa` - Joomla Backup-Archiv (alte werden automatisch gelöscht)
