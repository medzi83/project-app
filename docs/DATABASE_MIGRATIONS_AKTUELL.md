# ⚠️ WICHTIG: Korrekte Datenbank-Migrationen

## 🚨 ACHTUNG: Veraltete Dokumentation

Die Dokumente `MIGRATION_STRATEGY.md` und `PRISMA_MIGRATIONS_VERCEL.md` sind **VERALTET** und enthalten **FALSCHE ANLEITUNGEN** für unser aktuelles Setup!

❌ **Diese Befehle funktionieren NICHT:**
```bash
npx prisma migrate dev --name xyz  # FEHLSCHLAG wegen pgBouncer!
```

## ✅ AKTUELL GÜLTIGE DOKUMENTATION

**→ [PRISMA-MIGRATIONS.md](./PRISMA-MIGRATIONS.md)** ← **NUR DIESE ANLEITUNG VERWENDEN!**

Diese Dokumentation ist die **einzige verbindliche** Anleitung für Datenbankmigrationen.

## Warum funktioniert `migrate dev` nicht?

Unser Setup verwendet:
- **Supabase PostgreSQL**
- **pgBouncer** für Connection Pooling
- `DATABASE_URL` → pgBouncer Pooler
- `DIRECT_URL` → Direkte DB-Verbindung

**Problem:**
- `npx prisma migrate dev` benötigt direkte Verbindung
- `DATABASE_URL` zeigt auf pgBouncer
- **Ergebnis:** `Can't reach database server` Fehler

## ✅ Korrekte Vorgehensweise

Siehe **[PRISMA-MIGRATIONS.md](./PRISMA-MIGRATIONS.md)** für die vollständige Anleitung.

**Kurz zusammengefasst:**

1. Schema in `prisma/schema.prisma` anpassen
2. Migrationsordner erstellen:
   ```bash
   mkdir prisma/migrations/YYYYMMDDHHMMSS_beschreibung
   ```
3. `migration.sql` erstellen mit SQL-Befehlen
4. Migration ausführen:
   ```bash
   npx prisma migrate deploy
   ```
5. Prisma Client generieren:
   ```bash
   npx prisma generate
   ```

## Dokumentations-Status

| Dokument | Status | Verwendung |
|----------|--------|------------|
| [PRISMA-MIGRATIONS.md](./PRISMA-MIGRATIONS.md) | ✅ AKTUELL | **VERWENDEN** |
| [MIGRATION_STRATEGY.md](./MIGRATION_STRATEGY.md) | ❌ VERALTET | Nur für Konzepte (Multi-Phasen, etc.) |
| [PRISMA_MIGRATIONS_VERCEL.md](./PRISMA_MIGRATIONS_VERCEL.md) | ❌ VERALTET | Nicht verwenden |

## Bei Fragen

1. **Zuerst lesen:** [PRISMA-MIGRATIONS.md](./PRISMA-MIGRATIONS.md)
2. Bei Problemen: SQL-Syntax in `migration.sql` prüfen
3. Troubleshooting-Sektion in der Dokumentation konsultieren

---

**Letzte Aktualisierung:** 18. Januar 2025
**Grund:** pgBouncer-Setup erfordert manuelle Migrations mit `migrate deploy`
