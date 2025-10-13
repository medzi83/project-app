import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";

type Props = {
  params: Promise<{ id: string }>;
};

const formatDate = (value?: Date | string | null) => {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "-";
  }
};

const formatLink = (value?: string | null, labelOverride?: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return { label: labelOverride ?? trimmed, href };
};

const DERIVED_STATUS_LABELS = {
  BEENDET: "Beendet",
  ONLINE: "Online",
  FINALVERSION: "Finalversion",
  SCHNITT: "Schnitt",
  DREH: "Dreh",
  SKRIPTFREIGABE: "Skriptfreigabe",
  SKRIPT: "Skript",
  SCOUTING: "Scouting",
} as const;

type DerivedFilmStatus = keyof typeof DERIVED_STATUS_LABELS;

const deriveFilmStatus = (film: {
  status?: string | null;
  onlineDate?: Date | string | null;
  finalToClient?: Date | string | null;
  shootDate?: Date | string | null;
  scriptApproved?: Date | string | null;
  scriptToClient?: Date | string | null;
  scouting?: Date | string | null;
}): DerivedFilmStatus => {
  if (film.status === "BEENDET") return "BEENDET";
  if (film.onlineDate) return "ONLINE";
  if (film.finalToClient) return "FINALVERSION";
  if (film.shootDate && new Date(film.shootDate).getTime() < Date.now()) return "SCHNITT";
  if (film.scriptApproved) return "DREH";
  if (film.scriptToClient) return "SKRIPTFREIGABE";
  if (film.scouting && new Date(film.scouting).getTime() < Date.now()) return "SKRIPT";
  return "SCOUTING";
};

const SCOPE_LABELS = {
  FILM: "Film",
  DROHNE: "Drohne",
  NACHDREH: "Nachdreh",
  FILM_UND_DROHNE: "Film + Drohne",
} as const;

const PRIORITY_LABELS = {
  NONE: "Keine",
  FILM_SOLO: "Film solo",
  PRIO_1: "Prio 1",
  PRIO_2: "Prio 2",
} as const;

const STATUS_LABELS = {
  AKTIV: "Aktiv",
  BEENDET: "Beendet",
  WARTEN: "Warten",
  VERZICHT: "Verzicht",
  MMW: "MMW",
} as const;

export default async function FilmProjectDetailPage({ params }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (!session.user.role || !["ADMIN", "AGENT"].includes(session.user.role)) {
    redirect("/");
  }

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      agent: true,
      film: {
        include: {
          filmer: true,
          cutter: true,
          previewVersions: {
            orderBy: { version: 'desc' },
          },
        },
      },
    },
  });

  if (!project || !project.film) {
    notFound();
  }

  const film = project.film;
  const isAdmin = session.user.role === "ADMIN";
  const finalLinkData = formatLink(film.finalLink, "Zum Video");
  const onlineLinkData = formatLink(film.onlineLink ?? (film.onlineDate ? film.finalLink : undefined), "Zum Video");
  const derivedStatus = deriveFilmStatus({
    status: film.status,
    onlineDate: film.onlineDate,
    finalToClient: film.finalToClient,
    shootDate: film.shootDate,
    scriptApproved: film.scriptApproved,
    scriptToClient: film.scriptToClient,
    scouting: film.scouting,
  });

  return (
    <div className="space-y-6">
      <header>
        <Link href="/film-projects" className="text-blue-600 hover:underline">
          ← Zurück zur Filmprojekt-Liste
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{project.title}</h1>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-sm text-gray-500">
            {project.client?.name} {project.client?.customerNo && `(${project.client.customerNo})`}
          </p>
          {project.client?.workStopped && (
            <Badge variant="destructive" className="text-xs">Arbeitsstopp</Badge>
          )}
          {project.client?.finished && (
            <Badge className="bg-gray-600 hover:bg-gray-700 text-xs">Beendet</Badge>
          )}
        </div>
      </header>

      <section className="rounded-lg border bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Aktueller Status</div>
            <div className="text-xl font-semibold">{DERIVED_STATUS_LABELS[derivedStatus]}</div>
          </div>
          {derivedStatus === "ONLINE" && onlineLinkData && (
            <a
              href={onlineLinkData.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              🎬 Zum Film
            </a>
          )}
        </div>
      </section>

      {/* Projekt-Informationen */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-base font-medium mb-3">Projekt-Informationen</h2>
        <div className="grid gap-3 md:grid-cols-4 text-sm">
          <div>
            <div className="text-xs text-gray-500">Umfang</div>
            <div>{film.scope ? SCOPE_LABELS[film.scope] : "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Priorität</div>
            <div>{film.priority ? PRIORITY_LABELS[film.priority] : "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">P-Status</div>
            <div>
              <Badge variant={film.status === "AKTIV" ? "default" : "secondary"}>
                {film.status ? STATUS_LABELS[film.status] : "-"}
              </Badge>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Verantwortlicher Filmer</div>
            <div>{film.filmer?.name ?? "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Cutter</div>
            <div>{film.cutter?.name ?? "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Wiedervorlage am</div>
            <div>{formatDate(film.reminderAt)}</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-gray-500">Hinweis</div>
            <div className="whitespace-pre-wrap">{film.note || "-"}</div>
          </div>
        </div>
      </section>

      {/* Zeitplan */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-base font-medium mb-3">Zeitplan & Termine</h2>
        <div className="grid gap-3 md:grid-cols-4 text-sm">
          <div>
            <div className="text-xs text-gray-500">Vertragsbeginn</div>
            <div>{formatDate(film.contractStart)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Scouting</div>
            <div>{formatDate(film.scouting)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Skript an Kunden</div>
            <div>{formatDate(film.scriptToClient)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Skriptfreigabe</div>
            <div>{formatDate(film.scriptApproved)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Dreh-/Fototermin</div>
            <div>{formatDate(film.shootDate)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Finalversion an Kunden</div>
            <div>{formatDate(film.finalToClient)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Finalversion-Link</div>
            {finalLinkData ? (
              <a
                href={finalLinkData.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline break-all"
              >
                {finalLinkData.label}
              </a>
            ) : (
              <div>-</div>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-500">Online</div>
            <div>{formatDate(film.onlineDate)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Hauptlink (Online)</div>
            {onlineLinkData ? (
              <a
                href={onlineLinkData.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline break-all"
              >
                {onlineLinkData.label}
              </a>
            ) : (
              <div>-</div>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-500">Letzter Kontakt</div>
            <div>{formatDate(film.lastContact)}</div>
          </div>
        </div>
      </section>

      {/* Vorabversionen */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-base font-medium mb-3">
          Vorabversionen an Kunden ({film.previewVersions.length})
        </h2>
        {film.previewVersions.length === 0 ? (
          <div className="text-sm text-gray-500">
            {film.firstCutToClient
              ? `Erste Version: ${formatDate(film.firstCutToClient)} (Legacy-Eintrag)`
              : "Noch keine Vorabversionen versendet"}
          </div>
        ) : (
          <div className="space-y-2">
            {film.previewVersions.map((version) => (
              <div key={version.id} className="flex items-center gap-3 p-2 rounded border">
                <Badge variant="outline" className="font-mono">v{version.version}</Badge>
                <span className="text-sm">{formatDate(version.sentDate)}</span>
                {version.link && (
                  <a
                    href={version.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Link öffnen →
                  </a>
                )}
                <span className="text-xs text-gray-500 ml-auto">
                  (Erfasst: {formatDate(version.createdAt)})
                </span>
              </div>
            ))}
            {film.firstCutToClient && film.previewVersions.length > 0 && (
              <div className="flex items-center gap-3 p-2 rounded border border-dashed bg-gray-50">
                <Badge variant="outline" className="font-mono bg-gray-100">Legacy</Badge>
                <span className="text-sm">{formatDate(film.firstCutToClient)}</span>
                <span className="text-xs text-gray-500">(Alter Eintrag vor Versionierung)</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Aktionen */}
      {isAdmin && (
        <section className="flex gap-3">
          <Link
            href={`/film-projects/${project.id}/edit`}
            className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            Filmprojekt bearbeiten
          </Link>
        </section>
      )}
    </div>
  );
}
