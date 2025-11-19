"use client";

import { useState } from "react";
import { Calendar, CheckCircle2, Sparkles, ChevronDown } from "lucide-react";

/**
 * HINWEIS für neue Changelog-Einträge:
 * - Schreibe für End-User, nicht für Entwickler
 * - Vermeide technische Details (API-Parameter, Code-Referenzen, etc.)
 * - Fokus auf: Was kann der User jetzt machen? Was wurde verbessert?
 * - Verwende einfache, verständliche Sprache
 * - Beschreibe den Nutzen, nicht die technische Umsetzung
 */

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
    date: "19.11.2024",
    version: "2.4.1",
    changes: [
      {
        title: "Neuer P-Status: vollst. K.e.S.",
        description:
          "Für Webseitenprojekte gibt es einen neuen Produktionsstatus: 'vollst. K.e.S.' (vollständig - Kraft eigener Suppe). Dieser Status funktioniert wie 'vollst. a.K.' und versetzt Projekte in die UMSETZUNG-Phase. Der Unterschied: Wenn ein Projekt den Status 'vollst. K.e.S.' hat, wird das Wort 'Umsetzung' in der Projektliste und auf der Detailseite kursiv dargestellt. So erkennst du auf einen Blick, dass das Projekt aus eigener Initiative weiterläuft. Der neue Status steht in allen Dropdowns zur Auswahl und wird in der Filterlogik genauso behandelt wie 'vollst. a.K.'.",
        type: "feature",
      },
      {
        title: "Projekte ohne Webtermin erstellen",
        description:
          "Du kannst jetzt bei der Webtermin-Eingabe die Art 'Ohne Termin' auswählen! Projekte mit dieser Einstellung überspringen automatisch die WEBTERMIN-Phase und starten direkt bei MATERIAL. Das ist perfekt für Projekte, bei denen kein klassischer Webtermin stattfindet. Die Status-Berechnung wurde entsprechend angepasst und berücksichtigt diese neue Option in allen Listen und Filtern. In der Projektliste und auf der Detailseite wird der korrekte Status in Echtzeit basierend auf den aktuellen Daten berechnet.",
        type: "feature",
      },
      {
        title: "Beendete Projekte standardmäßig ausgeblendet",
        description:
          "Projekte mit dem Produktionsstatus 'Beendet' werden jetzt automatisch ausgeblendet, um die Listen übersichtlicher zu machen! In der Webseitenprojekt-Liste gibt es einen neuen Button 'Beendete Projekte einblenden', mit dem du sie bei Bedarf anzeigen lassen kannst. Der Status 'BEENDET' ist nun ein eigener Projektstatus und wird entsprechend gefiltert. Beendete Projekte tauchen nicht mehr in den normalen Listen auf, außer du aktivierst sie explizit. So konzentrierst du dich auf die aktiven Projekte.",
        type: "improvement",
      },
      {
        title: "Verbesserte Filter-Bedienung",
        description:
          "Die Filter-Buttons wurden unter die Filterfelder verschoben für eine bessere Übersicht! Alle Buttons haben jetzt eine einheitliche Höhe und das Layout ist übersichtlicher strukturiert. Eine neue Hilfetext-Zeile erklärt: 'Bevor du einen Filter speichern möchtest, um ihn bei jedem Aufruf der Liste standardmäßig zu laden, musst du die gesetzten Filteroptionen erst Anwenden und dann kannst du Filter speichern.' So ist der Ablauf klarer verständlich.",
        type: "improvement",
      },
      {
        title: "Print & Design Liste erweitert",
        description:
          "Die Print & Design Liste hat neue Funktionen erhalten! Die Kundennummer ist jetzt klickbar und führt direkt zum Kundenblatt. Admins können Projekte direkt aus der Liste oder von der Detailseite löschen - ein kompakter Mülleimer-Button mit Bestätigungs-Dialog verhindert versehentliches Löschen. Der 'Neues Projekt' Button wurde entfernt, da Print-Projekte über den allgemeinen Projekt-Anlegen-Dialog erstellt werden. Das Icon wurde auf das Palette-Symbol geändert, passend zur Navigation.",
        type: "improvement",
      },
    ],
  },
  {
    date: "18.11.2024",
    version: "2.4.0",
    changes: [
      {
        title: "Neuer Bereich Print & Design",
        description:
          "Die Projektverwaltung hat einen neuen Bereich für Print- und Designprojekte bekommen! Du kannst jetzt Projekte für Logos, Visitenkarten, Flyer, Plakate, Broschüren und sonstige Drucksachen anlegen und verwalten. Im neuen Formular unter 'Projekt anlegen' gibt es die Option 'Print & Design' mit Feldern für Art des Projekts, Agent, Webtermin und ob Druck erforderlich ist. Die Print & Design Projekte haben ihren eigenen Bereich in der Navigation und werden im Dashboard mit eigenen Kacheln angezeigt. Die Detailseite zeigt alle relevanten Informationen: Projektart, Agent, Status, Zeitplan (Webtermin, Umsetzung, Design an Kunden, Designabnahme, Finalversion, Druckauftrag) sowie Notizen. Alle Felder können direkt bearbeitet werden (Inline-Editing). Agenten können die Kategorie 'Print & Design' zugewiesen bekommen, um Print-Projekte betreuen zu können.",
        type: "feature",
      },
      {
        title: "Dashboard mit Print & Design Integration",
        description:
          "Das Dashboard zeigt jetzt auch Print & Design Projekte mit eigener Kachel und Status-Übersicht! Die neue grüne Kachel zeigt die Anzahl aller Print & Design Projekte. Im Status-Bereich werden alle Print-Projekte nach ihrem Status aufgeschlüsselt: Webtermin, Umsetzung, Design an Kunden, Designabnahme, Finalversion, Druck und Abgeschlossen. Projekte, die älter als 4 Wochen sind, werden mit einem Warn-Badge markiert. Agenten mit der Kategorie 'Print & Design' sehen nur ihre zugewiesenen Projekte.",
        type: "feature",
      },
      {
        title: "Einheitliches Design für alle Projektlisten",
        description:
          "Alle Projektlisten (Website, Film, Print & Design, Social Media) haben jetzt ein einheitliches, modernes Design! Jede Liste hat einen farbigen Icon-Header mit Projektanzahl: Website (Blau), Film (Lila), Print & Design (Grün) und Social Media (Orange). Die Farben entsprechen den Dashboard-Kacheln und erleichtern die Orientierung. Alle Listen haben den gleichen Aufbau mit Filter-Bereich, Sortierung und Inline-Editing-Funktionen.",
        type: "improvement",
      },
      {
        title: "Agent-Kategorien erweitert",
        description:
          "Agenten können jetzt die neue Kategorie 'Print & Design' zugewiesen bekommen! In der Agenten-Verwaltung unter Admin gibt es die neue Checkbox 'Print & Design'. Agenten mit dieser Kategorie können Print-Projekte betreuen und sehen diese im Dashboard und in den Listen. Die Agent-Bearbeitung wurde vollständig für Dark Mode optimiert.",
        type: "improvement",
      },
    ],
  },
  {
    date: "13.11.2024",
    version: "2.3.6",
    changes: [
      {
        title: "FTP-Passwörter direkt bearbeiten",
        description:
          "Admins können jetzt FTP-Passwörter direkt auf der Kundenseite ändern! Bei jedem FTP-Account gibt es einen 'Bearbeiten'-Button. Nach dem Klick öffnet sich ein Eingabefeld mit Anzeige-/Verbergen-Funktion für das neue Passwort (mindestens 8 Zeichen). Das geänderte Passwort wird sowohl in Froxlor als auch in der Datenbank gespeichert, sodass es beim nächsten Besuch wieder angezeigt wird. So hast du immer Zugriff auf die aktuellen FTP-Zugangsdaten.",
        type: "feature",
      },
      {
        title: "Alle Serverdaten beim Kunden anzeigen",
        description:
          "Die Kundenseite zeigt jetzt alle Server-Informationen auf einen Blick! Wenn ein Kunde auf mehreren Servern liegt, werden alle Serverdaten automatisch in Tabs dargestellt. Jeder Tab enthält die kompletten Froxlor-Daten: Kundendaten (Login, Name, Firma, Status), Domains mit Zuweisungsmöglichkeit zu Online-Projekten, FTP-Accounts mit Passwort-Bearbeitung und Datenbanken (inkl. Passwörter für selbst erstellte DBs). Die Darstellung ist kompakt und übersichtlich - alle wichtigen Server-Informationen sind schnell erreichbar.",
        type: "feature",
      },
      {
        title: "Berechtigte Personen hinterlegen",
        description:
          "Du kannst jetzt beim Kunden festhalten, welche Personen Zugriff auf die Webseite haben! Im neuen Bereich 'Berechtigte Personen' (neben den Basisdaten) kannst du beliebig viele Kontaktpersonen hinzufügen. Für jede Person speicherst du: Anrede, Vorname, Nachname, E-Mail, Telefon, Position und optionale Notizen. Die Liste ist übersichtlich als Tabelle dargestellt. Mit dem Mülleimer-Button kannst du Einträge wieder löschen. Perfekt um alle wichtigen Ansprechpartner und deren Kontaktdaten zentral zu verwalten.",
        type: "feature",
      },
    ],
  },
  {
    date: "12.11.2024",
    version: "2.3.5",
    changes: [
      {
        title: "Termin-Kalender mit Übersicht aller Kundentermine",
        description:
          "Neuer Bereich 'Termine' in der Navigation! Hier findest du alle anstehenden Kundentermine übersichtlich in einem Kalender. Der Kalender zeigt Webtermine (blau), Drehtermine (lila) und Scouting-Termine (orange) auf einen Blick. Für jeden Termin siehst du direkt die Uhrzeit, den Kundennamen, die Kundennummer und den zuständigen Agenten. Ein Klick auf einen Termin führt dich direkt zum Projekt. Zusätzlich zur Kalenderansicht gibt es auch gefilterte Listen für jede Terminart (Alle, Webtermine, Scouting, Drehtermine). Die Termine werden automatisch aus den Projekten geladen, sobald ein Datum gesetzt ist.",
        type: "feature",
      },
      {
        title: "Korrekte Zeitanzeige ohne Zeitzonenverschiebung",
        description:
          "Alle Datums- und Zeitanzeigen in der App zeigen jetzt die korrekten Werte ohne Zeitzonenverschiebung an. Ein Termin um 14:00 Uhr wird jetzt auch überall als 14:00 Uhr angezeigt, nicht mehr als 15:00 Uhr. Das betrifft die Projekt-Listen, Detailseiten, den neuen Termin-Kalender und alle Filmprojekte. Die interne Datumsverarbeitung wurde komplett überarbeitet, um eine konsistente Anzeige in der gesamten Anwendung zu garantieren.",
        type: "fix",
      },
    ],
  },
  {
    date: "12.11.2024",
    version: "2.3.4",
    changes: [
      {
        title: "Verbesserte Filter-Auswahl mit Live-Feedback",
        description:
          "Die Filter in den Projekt- und Film-Listen zeigen jetzt sofort, wenn du Änderungen vornimmst! Sobald du Checkboxen an- oder abhakst, wird die Anzahl der ausgewählten Filter live aktualisiert. Wenn deine Auswahl von den aktuell angewendeten Filtern abweicht, wird der Filter-Button blau hervorgehoben - so erkennst du sofort, dass Änderungen vorgenommen wurden, die erst nach Klick auf 'Anwenden' wirksam werden.",
        type: "improvement",
      },
      {
        title: "Scrollbare Tabellen mit fester Höhe",
        description:
          "Die Projekt- und Filmlisten scrollen jetzt innerhalb eines Containers mit fester Höhe. Das bedeutet, dass Filter und Pagination immer sichtbar bleiben, während du durch die Tabelle scrollst. Die Tabelle passt sich automatisch an die Bildschirmhöhe an und lässt genug Platz für Navigation und Filter.",
        type: "improvement",
      },
      {
        title: "Wiedervorlage-Spalte ausgeblendet",
        description:
          "Die Spalte 'Wiedervorlage am' wurde aus der Filmprojekt-Liste entfernt, um die Übersichtlichkeit zu verbessern. Das Feld ist weiterhin in der Datenbank vorhanden und kann über die Detailansicht einzelner Filmprojekte bearbeitet werden.",
        type: "improvement",
      },
      {
        title: "Dark Mode für Kundenbearbeitung",
        description:
          "Alle Bearbeitungsfelder auf der Kundenseite (Basisdaten und Froxlor-Daten) unterstützen jetzt vollständig den Dark Mode. Alle Eingabefelder, Auswahlmenüs und Textareas haben nun die richtigen Farben für helle und dunkle Themes und sind dadurch deutlich besser lesbar.",
        type: "improvement",
      },
    ],
  },
  {
    date: "11.11.2024",
    version: "2.3.3",
    changes: [
      {
        title: "Erweiterte Filteroptionen für Kundenliste",
        description:
          "Die Kundenliste (/clients) hat jetzt vier neue Filter erhalten! Du kannst jetzt gezielt nach Status (Aktiv, Beendet, Arbeitsstopp), Projektart (Webseite, Film, Social Media), Agentur und Server filtern. Alle Filter lassen sich kombinieren und bleiben beim Blättern zwischen den Seiten erhalten. Mit dem 'Zurücksetzen'-Button kannst du alle aktiven Filter mit einem Klick entfernen. So findest du noch schneller die gesuchten Kunden!",
        type: "feature",
      },
    ],
  },
  {
    date: "11.11.2024",
    version: "2.3.2",
    changes: [
      {
        title: "Quick Links direkt in den Projekt-Boxen",
        description:
          "Demo-Links für Webseiten und Film-Links sind jetzt direkt in den Projekt-Boxen auf der Kundenseite integriert! Du musst nicht mehr scrollen - die Links erscheinen am Ende jeder Box mit einem grünen 'Zur Demo'-Button für Webseiten (zeigt den benutzerdefinierten Demo-Link oder die Joomla-Installation) und einem roten 'Zum Film'-Button für Film-Projekte mit Online-Link. Demo-Links können jetzt auch manuell auf der Projekt-Detailseite hinzugefügt werden. So hast du schnellen Zugriff auf die wichtigsten Links.",
        type: "feature",
      },
      {
        title: "Dark Mode-Verbesserungen für Filmprojekte",
        description:
          "Alle Filmprojekt-Seiten unterstützen jetzt vollständig den Dark Mode! Die Detailseite, die Film-Projekt-Liste und alle Inline-Bearbeitungsfelder wurden für dunkles Design optimiert. Texte, Rahmen und Hintergründe passen sich automatisch an dein gewähltes Theme an und sorgen für optimale Lesbarkeit in beiden Modi.",
        type: "improvement",
      },
      {
        title: "Feedback-Polling nur noch auf dem Dashboard",
        description:
          "Die Abfrage neuer Feedback-Benachrichtigungen (rotes Badge) erfolgt jetzt nur noch alle 30 Sekunden, wenn du dich auf dem Dashboard befindest. Auf allen anderen Seiten wird die Anzahl nur beim Seitenwechsel aktualisiert. Das spart unnötige Server-Anfragen und reduziert die Last auf dem Server erheblich.",
        type: "improvement",
      },
    ],
  },
  {
    date: "10.11.2024",
    version: "2.3.1",
    changes: [
      {
        title: "Sidebar minimierbar",
        description:
          "Die Navigation (Sitenav) kann jetzt eingeklappt werden! Neben der Überschrift 'Navigation' findest du einen Button mit Doppelpfeil-Icon. Im minimierten Zustand werden nur die Icons angezeigt. Beim Hovern über ein Icon erscheint ein Tooltip mit dem vollständigen Namen. Deine Auswahl wird gespeichert und bleibt auch nach einem Neustart erhalten. So hast du mehr Platz für die Projektlisten.",
        type: "feature",
      },
      {
        title: "Projekt-Zeilen markierbar in Webseitenprojekten",
        description:
          "Wie in der Filmprojekt-Liste kannst du jetzt auch in der Webseitenprojekt-Liste einzelne Zeilen durch Anklicken des Kundennamens markieren. Markierte Zeilen werden mit einem blauen Rahmen hervorgehoben und sind so leichter wiederzufinden. Perfekt, wenn du mehrere Projekte parallel bearbeitest.",
        type: "feature",
      },
      {
        title: "Domain-Spalte aus Webseitenprojekten entfernt",
        description:
          "Die Domain-Spalte wurde aus der Webseitenprojekt-Liste entfernt, um die Tabelle übersichtlicher zu machen. Die Domain-Information ist weiterhin auf der Projekt-Detailseite verfügbar.",
        type: "improvement",
      },
      {
        title: "Spaltenüberschriften umbrechen sich bei Bedarf",
        description:
          "Spaltenüberschriften in der Webseitenprojekt-Liste können sich jetzt auf zwei Zeilen umbrechen, wenn der Text zu lang ist. Dadurch sind alle Überschriften vollständig lesbar, auch bei schmaleren Bildschirmen.",
        type: "improvement",
      },
      {
        title: "Dark Mode-Verbesserungen",
        description:
          "Mehrere Komponenten wurden für den Dark Mode optimiert: Filter in Projekt- und Filmprojekt-Listen sind jetzt besser lesbar, Dashboard-Hinweise haben verbesserte Kontraste, die 'Projekte ohne Installation'-Box ist deutlicher sichtbar, und alle Komponenten nutzen jetzt semantische Farbklassen für konsistente Darstellung in beiden Modi.",
        type: "improvement",
      },
    ],
  },
  {
    date: "09.11.2024",
    version: "2.2.9",
    changes: [
      {
        title: "Dark Mode - Dunkles Design für die gesamte App",
        description:
          "Die Projektverwaltung unterstützt jetzt einen vollständigen Dark Mode! Wechsle zwischen hellem und dunklem Design über dein Account-Menü in der Topbar unter 'Design'. Du kannst zwischen drei Optionen wählen: Hell (helles Design), Dunkel (dunkles Design) oder System (folgt automatisch deinen Systemeinstellungen). Deine Auswahl wird gespeichert und bleibt auch nach einem Neustart erhalten. Alle Bereiche der App - Dashboard, Topbar, Navigation, Formulare und Listen - passen sich dem gewählten Theme an.",
        type: "feature",
      },
      {
        title: "Browser-Autovervollständigung auf Login-Seite aktiviert",
        description:
          "Der Browser kann jetzt wieder gespeicherte Zugangsdaten auf der Login-Seite vorschlagen und automatisch ausfüllen. Das macht den Login-Vorgang schneller und bequemer, da du deine E-Mail und dein Passwort nicht jedes Mal manuell eingeben musst.",
        type: "improvement",
      },
    ],
  },
  {
    date: "05.11.2024",
    version: "2.2.8",
    changes: [
      {
        title: "Favoriten-Funktion für SALES",
        description:
          "SALES-Benutzer können jetzt Kunden als Favoriten markieren! Der Stern-Button erscheint in der Kundenliste und auf jeder Kunden-Detailseite. Deine Favoriten siehst du prominent in einer eigenen Box auf dem Dashboard mit Kundenname, Kundennummer, Agentur und Projektanzahl. In allen Listen (Kunden, Projekte, Filmprojekte) werden deine favorisierten Kunden mit einem gelben Stern gekennzeichnet. Jeder SALES-Benutzer hat seine eigenen Favoriten - perfekt um wichtige Kunden schnell wiederzufinden! Die Favoriten-Funktion ist exklusiv für SALES-Benutzer verfügbar.",
        type: "feature",
      },
    ],
  },
  {
    date: "04.11.2024",
    version: "2.2.7",
    changes: [
      {
        title: "Filter-Speicherung für Projekt- und Filmprojekt-Listen",
        description:
          "Du kannst jetzt deine Filter in beiden Listen dauerhaft speichern! Nach dem Setzen deiner gewünschten Filter (Status, Prio, CMS, Agent etc.) klickst du auf 'Filter speichern'. Beim nächsten Besuch werden deine gespeicherten Filter automatisch angewendet. Mit 'Zurücksetzen' kannst du sowohl die aktuellen als auch die gespeicherten Filter löschen. Die Sortierung wird bewusst nicht gespeichert, damit du flexibel bleiben kannst.",
        type: "feature",
      },
      {
        title: "Login-Felder jetzt ohne Vorbelegung",
        description:
          "Die E-Mail- und Passwort-Felder auf der Login-Seite sind jetzt beim Öffnen leer. Du musst die vorausgefüllten Test-Zugangsdaten nicht mehr erst löschen, bevor du deine eigenen Daten eingeben kannst. Der Browser speichert auch keine Zugangsdaten mehr automatisch.",
        type: "improvement",
      },
      {
        title: "Cutter-Filter entfernt aus Filmprojekten",
        description:
          "Der nicht mehr benötigte Cutter-Filter wurde aus der Filmprojekt-Liste entfernt, da die Cutter-Spalte nicht mehr angezeigt wird. Die Liste ist jetzt aufgeräumter und die Filter-Optionen konzentrieren sich auf die relevanten Kriterien.",
        type: "improvement",
      },
    ],
  },
  {
    date: "03.11.2024",
    version: "2.2.6",
    changes: [
      {
        title: "MySQL-Server-Auswahl bei Joomla-Installation",
        description:
          "Bei der Joomla-Installation musst du jetzt auswählen, welche MySQL-Version verwendet werden soll (Standard oder MariaDB 10.5). So kannst du sicherstellen, dass die Datenbank auf dem richtigen Server angelegt wird. Die Konfiguration wird automatisch angepasst.",
        type: "feature",
      },
      {
        title: "Joomla-Installation mit MariaDB 10.5 funktioniert jetzt korrekt",
        description:
          "Wenn du bei der Joomla-Installation MariaDB 10.5 auswählst, wird die Datenbank jetzt auch wirklich dort erstellt (vorher landete sie trotzdem auf dem Standard-Server). Die installierten Joomla-Seiten funktionieren direkt ohne Fehlermeldungen.",
        type: "fix",
      },
    ],
  },
  {
    date: "01.11.2024",
    version: "2.3.0",
    changes: [
      {
        title: "Vertrieb-Bereich mit SALES-Rolle",
        description:
          "Neuer Bereich für Vertriebsmitarbeiter: Admin kann unter /admin/vertrieb SALES-Benutzer anlegen und verwalten (Name, E-Mail, Passwort). SALES-Benutzer haben Lesezugriff auf alle Projekte, Filmprojekte und Kundendaten, können aber nichts bearbeiten. Separate Dashboard-Ansicht mit 'Neueste Webseiten' und 'Neueste Filmprojekte' (jeweils die letzten 10 online gegangenen Projekte) inklusive Filter nach Agentur mit Icons.",
        type: "feature",
      },
      {
        title: "Read-Only Zugriff für Vertrieb",
        description:
          "SALES-Benutzer sehen alle Projekt- und Filmprojektlisten sowie Detailseiten im Read-Only-Modus: Inline-Bearbeitungsfelder sind deaktiviert, 'Mail an Kunden'-Button ausgeblendet, keine Bearbeitung von Kunden-Basisdaten oder Froxlor-Daten möglich, Kundensuchfunktion verfügbar.",
        type: "feature",
      },
      {
        title: "Dashboard-Verbesserungen für Vertrieb",
        description:
          "Spezielles SALES-Dashboard mit Agentur-Filter (Buttons mit Logos statt Dropdown), intelligente Projekt-Anzeige (Kundenname immer als Hauptüberschrift, Projekttitel nur wenn vorhanden darunter), 'Onlinestellung am:' Label vor Datum, nur aktive (nicht archivierte) Hinweise werden angezeigt.",
        type: "improvement",
      },
    ],
  },
  {
    date: "31.10.2024",
    version: "2.2.2",
    changes: [
      {
        title: "Sicherheitslücken geschlossen",
        description:
          "7 kritische Sicherheitslücken behoben: IDOR-Schwachstelle (Zugriff auf fremde Daten), unbefugter E-Mail-Versand, ungeschützte Template- und Import-Funktionen. Alle API-Routes und Server Actions sind jetzt mit Role-Checks abgesichert.",
        type: "fix",
      },
      {
        title: "Auth-Verbesserungen",
        description:
          "Middleware schützt jetzt alle Routen. Neue Helper-Funktionen (isAuthenticated, hasRole, hasAnyRole) für bessere Code-Qualität. Auto-Redirect von Login zu Dashboard für eingeloggte User.",
        type: "improvement",
      },
      {
        title: "Veraltete .htaccess Upload-Funktion entfernt",
        description:
          "Die nicht mehr verwendete uploadJoomlaHtaccess-Funktion wurde entfernt. Die Umbenennung von htaccess.bak zu .htaccess während der Joomla-Installation bleibt erhalten.",
        type: "improvement",
      },
    ],
  },
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
  feature: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  improvement: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  fix: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
};

const typeLabels = {
  feature: "Neu",
  improvement: "Verbessert",
  fix: "Behoben",
};

export default function ChangelogPage() {
  const [openChanges, setOpenChanges] = useState<Set<string>>(new Set());

  const toggleChange = (key: string) => {
    setOpenChanges((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          Changelog
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Hier findest du alle Änderungen und Verbesserungen an der Projektverwaltung.
        </p>
      </div>

      <div className="space-y-12">
        {changelog.map((entry, entryIndex) => (
          <div key={entryIndex} className="relative">
            {/* Timeline line */}
            {entryIndex < changelog.length - 1 && (
              <div className="absolute left-[19px] top-12 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
            )}

            {/* Date badge */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-700 text-white shadow-lg z-10">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{entry.date}</div>
                {entry.version && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">Version {entry.version}</div>
                )}
              </div>
            </div>

            {/* Changes */}
            <div className="ml-[52px] space-y-2">
              {entry.changes.map((change, changeIndex) => {
                const changeKey = `${entryIndex}-${changeIndex}`;
                const isOpen = openChanges.has(changeKey);

                return (
                  <div
                    key={changeIndex}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    {/* Accordion Header */}
                    <button
                      onClick={() => toggleChange(changeKey)}
                      className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{change.title}</h3>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                              typeColors[change.type]
                            }`}
                          >
                            {typeLabels[change.type]}
                          </span>
                        </div>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Accordion Content */}
                    {isOpen && (
                      <div className="px-5 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                          {change.description}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer info */}
      <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Letzte Aktualisierung: {changelog[0].date}
        </p>
      </div>
    </div>
  );
}
