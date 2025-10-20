# Deployment Guide - Vercel (Frankfurt Region)

Diese Anleitung beschreibt, wie du die Projektverwaltung-App auf Vercel deployst, mit allen Serverless Functions in der Region Frankfurt (fra1).

## ✅ Was wurde konfiguriert

### 1. **vercel.json**
- Alle API Routes laufen in Frankfurt (fra1)
- Node.js 20.x Runtime

### 2. **API Routes**
- Alle 25 API Routes haben `preferredRegion: 'fra1'` konfiguriert
- Datenbank-Verbindungen erfolgen von Deutschland aus

### 3. **Root Layout**
- SSR (Server-Side Rendering) läuft in Frankfurt
- Alle dynamischen Seiten werden in Deutschland gerendert

## 🚀 Deployment Schritte

### Schritt 1: Vercel Account erstellen
1. Gehe zu https://vercel.com
2. Registriere dich mit deinem GitHub Account

### Schritt 2: Repository verbinden
1. Klicke auf "Add New Project"
2. Wähle dein GitHub Repository: `medzi83/project-app`
3. Vercel erkennt automatisch Next.js

### Schritt 3: Environment Variables konfigurieren

Füge folgende Umgebungsvariablen in Vercel hinzu:

#### **DATABASE_URL**
```
postgresql://postgres.flvguouxkfpfigfnksoj:.dknm95Z31.@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connect_timeout=15
```

#### **DIRECT_URL**
```
postgresql://postgres.flvguouxkfpfigfnksoj:.dknm95Z31.@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
```

#### **NEXTAUTH_SECRET**
```
VHdV42mnssNoXwY5mLOEOwKzdvvDxVCaLTVJY1V1we0=
```
*Dieser Wert wurde sicher generiert - verwende ihn für Production*

#### **NEXTAUTH_URL**
```
https://deine-app.vercel.app
```
*Ersetze mit deiner echten Vercel URL nach dem ersten Deployment*

#### **PRISMA_DISABLE_PREPARED_STATEMENTS**
```
true
```

### Schritt 4: Deploy
1. Klicke auf "Deploy"
2. Warte auf das Deployment (ca. 2-3 Minuten)
3. Kopiere die Vercel URL

### Schritt 5: NEXTAUTH_URL aktualisieren
1. Gehe zu Vercel Project Settings → Environment Variables
2. Update `NEXTAUTH_URL` mit deiner echten Vercel URL
3. Triggere ein Redeploy

## 🌍 Region-Konfiguration

### Was läuft in Frankfurt (fra1)?
✅ **API Routes** - Alle 25 API Endpoints
✅ **Authentication** - NextAuth
✅ **Datenbank-Queries** - Prisma/Supabase
✅ **Server-Side Rendering** - Alle dynamischen Seiten
✅ **Image Optimization** - Next/Image

### Was läuft NICHT in Frankfurt?
⚠️ **Build-Prozess** - Läuft in USA (iad1) - unvermeidbar bei Vercel
✅ **Static Files** - Werden global vom Edge Network ausgeliefert

## 🔍 Deployment verifizieren

Nach dem Deployment kannst du die Region überprüfen:

### Im Browser (Developer Tools)
```bash
# Öffne eine beliebige Seite
# Developer Tools → Network → Response Headers
# Suche nach: x-vercel-id

# Die ersten 4 Zeichen zeigen die Region:
# fra1:: = Frankfurt, Germany ✅
# iad1:: = Washington DC, USA
```

### Im Terminal
```bash
curl -I https://deine-app.vercel.app/api/projects | grep x-vercel-id
```

## 📝 Weitere Konfiguration

### Custom Domain hinzufügen
1. Vercel Dashboard → Domains
2. Füge deine Domain hinzu
3. Folge den DNS-Anweisungen

### Umgebungsvariablen für Preview/Development
- Production: Für Live-Deployment
- Preview: Für Pull Request Previews
- Development: Für lokale Entwicklung mit `vercel dev`

## 🔒 Sicherheit

✅ `.env` ist in `.gitignore` - wird nicht committed
✅ `.env.example` zeigt benötigte Variablen ohne echte Werte
✅ Alle Secrets sind in Vercel Environment Variables gespeichert

## 📚 Weitere Resources

- [Vercel Regions Dokumentation](https://vercel.com/docs/edge-network/regions)
- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)

## 🆘 Troubleshooting

### "Database connection error"
→ Überprüfe `DATABASE_URL` und `DIRECT_URL` in Vercel Environment Variables

### "NextAuth configuration error"
→ Stelle sicher, dass `NEXTAUTH_URL` korrekt gesetzt ist

### "Build fails"
→ Überprüfe Node.js Version in `package.json` engines field

---

**Fertig! Deine App läuft jetzt auf Vercel mit allen Functions in Frankfurt!** 🇩🇪🚀
