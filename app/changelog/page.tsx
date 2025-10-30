import { Metadata } from "next";
import { Calendar, CheckCircle2, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Changelog - Projektverwaltung",
  description: "Übersicht über alle Änderungen und Verbesserungen",
};

type ChangelogEntry = {
  date: string;
  version?: string;
  changes: {
    title: string;
    description: string;
    type: "feature" | "improvement" | "fix";
  }[];
};

const changelog: ChangelogEntry[] = [
  {
    date: "30.10.2024",
    version: "2.2.1",
    changes: [
      {
        title: "Relaunch-Kennzeichnung für Webseitenprojekte",
        description:
          "Webseitenprojekte können jetzt als 'Relaunch' markiert werden. Bei der Projekt-Anlage gibt es eine neue Checkbox 'Als Relaunch kennzeichnen'. In der Projekttabelle erscheint bei Relaunch-Projekten ein orange 'RL'-Badge neben dem Kundennamen. Auf der Detailseite wird ein prominentes 'RELAUNCH'-Badge mit Reload-Icon im Header angezeigt. Der Relaunch-Status kann jederzeit über Inline-Editing geändert werden.",
        type: "feature",
      },
      {
        title: "Arbeitstage-Spalte sortierbar",
        description:
          "Die 'Arbeitstage'-Spalte in der Projekttabelle kann jetzt per Klick auf die Spaltenüberschrift sortiert werden. Die Sortierung basiert auf dem letzten Materialeingang und Demo-Datum.",
        type: "improvement",
      },
    ],
  },
  {
    date: "29.10.2024",
    version: "2.2.0",
    changes: [
      {
        title: "Froxlor 2.0+ Unterstützung",
        description:
          "Die Froxlor-API-Integration wurde komplett überarbeitet und unterstützt jetzt sowohl Froxlor 1.x (Legacy) als auch Froxlor 2.0+ (HTTP Basic Authentication). In der Serververwaltung kann für jeden Server die Froxlor-Version ausgewählt werden. Der Verbindungstest erkennt automatisch die korrekte Authentifizierungsmethode.",
        type: "feature",
      },
      {
        title: "Datenbank-Server-Verwaltung",
        description:
          "Neue Funktion zur Verwaltung mehrerer Datenbankversionen pro Server. Du kannst jetzt verschiedene MariaDB/MySQL-Versionen konfigurieren (z.B. MariaDB 10.3 auf localhost:3306 und MariaDB 10.5 auf 127.0.0.1:3307). Bei Joomla-Installationen kann die gewünschte Datenbankversion ausgewählt werden. Dies ist besonders wichtig für Server mit Froxlor 2.0+, die mehrere DB-Versionen anbieten.",
        type: "feature",
      },
      {
        title: "Kontaktpersonen mit strukturierten Daten",
        description:
          "Das alte 'Kontakt'-Feld wurde durch die neuen Felder 'Anrede', 'Vorname' und 'Nachname' ersetzt. Das Formular zur Kundenanlage unter /projects/new wurde entsprechend angepasst. Die Kundennummer ist jetzt ein Pflichtfeld, um die Datenqualität zu verbessern.",
        type: "improvement",
      },
    ],
  },
  {
    date: "28.10.2025",
    version: "2.1.0",
    changes: [
      {
        title: "Projekt-Erstellung komplett überarbeitet",
        description:
          "Die Seite zum Anlegen neuer Projekte wurde komplett neu gestaltet: Klarer 3-Schritte-Prozess (Kunde auswählen → Projektart(en) wählen → Details eingeben), Inline-Suche für Kunden beim Tippen, Mehrfachauswahl per Checkboxen (Website, Film, Social Media), Agent-Zuweisung direkt pro Projektart, und alle Felder bleiben kompakt in einer Zeile.",
        type: "feature",
      },
      {
        title: "Termin-Verwaltung mit E-Mail-Integration",
        description:
          "Webtermin und Scouting-Termine können jetzt mit Datum UND Uhrzeit angelegt werden. Beim Webtermin wählst du zusätzlich die Art aus (Telefonisch, Beim Kunden, In der Agentur). Sobald du einen Termin einträgst und speicherst, erscheint automatisch ein Dialog zur E-Mail-Bestätigung, den du direkt bearbeiten und versenden kannst.",
        type: "feature",
      },
      {
        title: "Optimierte Benutzerführung",
        description:
          "Die komplette App verwendet jetzt die Du-Form für eine persönlichere Ansprache. Film-Projekte zeigen nur noch relevante Felder (P-Status, Wiedervorlage und Letzter Kontakt sind ausgeblendet). Die Navigation ist insgesamt intuitiver und aufgeräumter.",
        type: "improvement",
      },
      {
        title: "E-Mail-Trigger Fehlerbehebungen",
        description:
          "Der Pre-Dialog für fehlende Kundendaten wird jetzt nur noch angezeigt, wenn tatsächlich Daten fehlen. Die Prüfung berücksichtigt korrekt die neuen Kontaktfelder (Vorname/Nachname statt Contact). Zeitangaben in E-Mails werden jetzt ohne Timezone-Umrechnung angezeigt (16:30 bleibt 16:30). Neue E-Mail-Variablen für Agentur-Informationen hinzugefügt: {{agency.name}}, {{agency.phone}}, {{agency.email}}.",
        type: "fix",
      },
    ],
  },
];

const typeColors = {
  feature: "bg-green-100 text-green-800 border-green-200",
  improvement: "bg-blue-100 text-blue-800 border-blue-200",
  fix: "bg-orange-100 text-orange-800 border-orange-200",
};

const typeLabels = {
  feature: "Neu",
  improvement: "Verbessert",
  fix: "Behoben",
};

export default function ChangelogPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-blue-600" />
          Changelog
        </h1>
        <p className="text-gray-600">
          Hier findest du alle Änderungen und Verbesserungen an der Projektverwaltung.
        </p>
      </div>

      <div className="space-y-12">
        {changelog.map((entry, entryIndex) => (
          <div key={entryIndex} className="relative">
            {/* Timeline line */}
            {entryIndex < changelog.length - 1 && (
              <div className="absolute left-[19px] top-12 bottom-0 w-0.5 bg-gray-200" />
            )}

            {/* Date badge */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg z-10">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-semibold text-gray-900">{entry.date}</div>
                {entry.version && (
                  <div className="text-sm text-gray-500">Version {entry.version}</div>
                )}
              </div>
            </div>

            {/* Changes */}
            <div className="ml-[52px] space-y-4">
              {entry.changes.map((change, changeIndex) => (
                <div
                  key={changeIndex}
                  className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{change.title}</h3>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            typeColors[change.type]
                          }`}
                        >
                          {typeLabels[change.type]}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {change.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer info */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <p className="text-sm text-gray-500 text-center">
          Letzte Aktualisierung: {changelog[0].date}
        </p>
      </div>
    </div>
  );
}
