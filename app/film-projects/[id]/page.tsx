import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { PreviewVersionItem } from "@/components/PreviewVersionItem";
import { getProjectDisplayName } from "@/lib/project-status";

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

  // Check if client has website projects
  const websiteProjects = project?.clientId
    ? await prisma.project.findMany({
        where: {
          clientId: project.clientId,
          type: "WEBSITE"
        },
        select: {
          id: true,
          title: true,
          website: {
            select: {
              pStatus: true,
              webDate: true,
              demoDate: true,
              onlineDate: true,
              materialStatus: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Helper to derive website status
  const deriveWebsiteStatusForLink = (website: any) => {
    if (!website) return "WEBTERMIN";

    const normalizedPStatus = website.pStatus?.toUpperCase();
    if (normalizedPStatus === "BEENDET") return "ONLINE";
    if (website.onlineDate) return "ONLINE";
    if (website.demoDate) return "DEMO";

    const now = new Date();
    const webDate = website.webDate ? new Date(website.webDate) : null;
    if (!webDate || webDate > now) return "WEBTERMIN";
    if (normalizedPStatus === "VOLLST_A_K") return "UMSETZUNG";
    if (website.materialStatus !== "VOLLSTAENDIG") return "MATERIAL";

    return "UMSETZUNG";
  };

  const WEBSITE_STATUS_LABELS: Record<string, string> = {
    WEBTERMIN: "Webtermin",
    MATERIAL: "Material",
    UMSETZUNG: "Umsetzung",
    DEMO: "Demo",
    ONLINE: "Online",
  };

  const getWebsiteStatusColor = (status: string) => {
    switch (status) {
      case "WEBTERMIN":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "MATERIAL":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "UMSETZUNG":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "DEMO":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "ONLINE":
        return "bg-green-100 text-green-700 border-green-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

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

  // Status badge colors
  const getStatusColor = (status: DerivedFilmStatus) => {
    switch (status) {
      case "SCOUTING":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "SKRIPT":
        return "bg-indigo-100 text-indigo-800 border-indigo-300";
      case "SKRIPTFREIGABE":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "DREH":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "SCHNITT":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "FINALVERSION":
        return "bg-teal-100 text-teal-800 border-teal-300";
      case "ONLINE":
        return "bg-green-100 text-green-800 border-green-300";
      case "BEENDET":
        return "bg-gray-100 text-gray-800 border-gray-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/film-projects" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück zur Übersicht
        </Link>
        {isAdmin && (
          <Link
            href={`/film-projects/${project.id}/edit`}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Bearbeiten
          </Link>
        )}
      </div>

      {/* Project Header Card */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          {/* Large Film Icon */}
          <div className="flex-shrink-0">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(derivedStatus)}`}>
                {DERIVED_STATUS_LABELS[derivedStatus]}
              </span>
              {project.client?.workStopped && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
                  ⚠️ Arbeitsstopp
                </span>
              )}
              {project.client?.finished && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-300">
                  Beendet
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{getProjectDisplayName(project)}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <Link href={`/clients/${project.clientId}`} className="font-medium text-blue-600 hover:text-blue-800 hover:underline">
                {project.client?.name || "Unbekannter Kunde"}
              </Link>
              {project.client?.customerNo && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-300">
                    Kd-Nr: {project.client.customerNo}
                  </span>
                </>
              )}
            </div>
          </div>
          {derivedStatus === "ONLINE" && onlineLinkData && (
            <a
              href={onlineLinkData.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
              </svg>
              Zum Film
            </a>
          )}
        </div>

        {film.note && (
          <div className="mt-4 p-4 bg-purple-50 border border-purple-300 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold text-purple-900 text-sm">Hinweis</p>
                <p className="text-purple-800 text-sm mt-1 whitespace-pre-wrap">{film.note}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Links to Website Projects */}
      {websiteProjects.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <h2 className="font-semibold text-gray-900">Verknüpfte Webseitenprojekte</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {websiteProjects.map((wp) => {
              const websiteStatus = deriveWebsiteStatusForLink(wp.website);
              const statusLabel = WEBSITE_STATUS_LABELS[websiteStatus] || websiteStatus;
              const statusColor = getWebsiteStatusColor(websiteStatus);

              return (
                <Link
                  key={wp.id}
                  href={`/projects/${wp.id}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-colors"
                >
                  <span>🌐 {wp.title}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${statusColor}`}>
                    {statusLabel}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Projekt-Informationen */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Projektdetails
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Umfang</dt>
                <dd className="mt-1 text-sm text-gray-900">{film.scope ? SCOPE_LABELS[film.scope] : "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Priorität</dt>
                <dd className="mt-1 text-sm text-gray-900">{film.priority ? PRIORITY_LABELS[film.priority] : "-"}</dd>
              </div>
            </div>

            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Produktionsstatus</dt>
              <dd className="mt-1">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${film.status === "AKTIV" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                  {film.status ? STATUS_LABELS[film.status] : "-"}
                </span>
              </dd>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Filmer</dt>
                <dd className="mt-1 text-sm text-gray-900">{film.filmer?.name ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cutter</dt>
                <dd className="mt-1 text-sm text-gray-900">{film.cutter?.name ?? "-"}</dd>
              </div>
            </div>

            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Wiedervorlage am</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">{formatDate(film.reminderAt)}</dd>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden lg:col-span-2">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Produktionszeitplan
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-gray-500"></div>
              <div className="flex-1">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vertragsbeginn</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{formatDate(film.contractStart)}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-blue-500"></div>
              <div className="flex-1">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Scouting</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{formatDate(film.scouting)}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-indigo-500"></div>
              <div className="flex-1">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Skript an Kunden</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{formatDate(film.scriptToClient)}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-purple-500"></div>
              <div className="flex-1">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Skriptfreigabe</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{formatDate(film.scriptApproved)}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-orange-500"></div>
              <div className="flex-1">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dreh-/Fototermin</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{formatDate(film.shootDate)}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-teal-500"></div>
              <div className="flex-1">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Finalversion an Kunden</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{formatDate(film.finalToClient)}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-green-500"></div>
              <div className="flex-1">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Online</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{formatDate(film.onlineDate)}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-gray-400"></div>
              <div className="flex-1">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Letzter Kontakt</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{formatDate(film.lastContact)}</dd>
              </div>
            </div>
          </div>
        </div>

        {/* Links */}
        {(finalLinkData || onlineLinkData) && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Video-Links
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {finalLinkData && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Finalversion</dt>
                  <dd className="mt-1">
                    <a
                      href={finalLinkData.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1 text-sm break-all"
                    >
                      {finalLinkData.label}
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </dd>
                </div>
              )}
              {onlineLinkData && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Online (Hauptlink)</dt>
                  <dd className="mt-1">
                    <a
                      href={onlineLinkData.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1 text-sm break-all"
                    >
                      {onlineLinkData.label}
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </dd>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Vorabversionen */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            Vorabversionen an Kunden
            <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {film.previewVersions.length}
            </span>
          </h2>
        </div>
        <div className="p-6">
          {film.previewVersions.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
              <p className="mt-2 text-sm text-gray-500">
                {film.firstCutToClient
                  ? `Erste Version: ${formatDate(film.firstCutToClient)} (Legacy-Eintrag)`
                  : "Noch keine Vorabversionen versendet"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {film.previewVersions.map((version) => (
                <PreviewVersionItem
                  key={version.id}
                  version={version}
                  isAdmin={isAdmin}
                />
              ))}
              {film.firstCutToClient && film.previewVersions.length > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed bg-gray-50">
                  <Badge variant="outline" className="font-mono bg-gray-100">Legacy</Badge>
                  <span className="text-sm font-medium">{formatDate(film.firstCutToClient)}</span>
                  <span className="text-xs text-gray-500">(Alter Eintrag vor Versionierung)</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
