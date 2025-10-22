import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { deriveProjectStatus, labelForProjectStatus, labelForWebsitePriority, labelForProductionStatus, labelForMaterialStatus, labelForSeoStatus, labelForTextitStatus, MATERIAL_STATUS_VALUES, getProjectDisplayName } from "@/lib/project-status";
import { notFound, redirect } from "next/navigation";
import InlineCell from "@/components/InlineCell";
import type { WebsitePriority, ProductionStatus, MaterialStatus, SEOStatus, TextitStatus, CMS as PrismaCMS } from "@prisma/client";

const fmtDate = (d?: Date | string | null) =>
  d ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d)) : "-";
const fmtDateTime = (d?: Date | string | null) =>
  d ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d)) : "-";
const mm = (n?: number | null) => (n ? `${Math.floor(n / 60)}h ${n % 60}m` : "-");
const yesNo = (v?: boolean | null) => (v === true ? "Ja" : v === false ? "Nein" : "-");
const linkify = (u?: string | null) => {
  if (!u) return "-";
  const hasProto = /^https?:\/\//i.test(u);
  const href = hasProto ? u : `https://${u}`;
  return <a className="underline" href={href} target="_blank" rel="noreferrer">{u}</a>;
};

const PRIORITIES = ["NONE", "PRIO_1", "PRIO_2", "PRIO_3"] as const;
const CMS = ["SHOPWARE", "JOOMLA", "LOGO", "PRINT", "OTHER"] as const;

type Props = { params: Promise<{ id: string }> };

export default async function ProjectDetail({ params }: Props) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      agent: true,
      website: true,
      joomlaInstallations: {
        include: {
          server: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  // Check if client has film projects
  const filmProjects = project?.clientId
    ? await prisma.project.findMany({
        where: {
          clientId: project.clientId,
          type: "FILM"
        },
        select: {
          id: true,
          title: true,
          film: {
            select: {
              status: true,
              onlineDate: true,
              finalToClient: true,
              shootDate: true,
              scriptApproved: true,
              scriptToClient: true,
              scouting: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Helper to derive film status
  const deriveFilmStatusForLink = (film: any) => {
    if (!film) return "SCOUTING";
    if (film.status === "BEENDET") return "BEENDET";
    if (film.onlineDate) return "ONLINE";
    if (film.finalToClient) return "FINALVERSION";
    if (film.shootDate && new Date(film.shootDate).getTime() < Date.now()) return "SCHNITT";
    if (film.scriptApproved) return "DREH";
    if (film.scriptToClient) return "SKRIPTFREIGABE";
    if (film.scouting && new Date(film.scouting).getTime() < Date.now()) return "SKRIPT";
    return "SCOUTING";
  };

  const FILM_STATUS_LABELS: Record<string, string> = {
    BEENDET: "Beendet",
    ONLINE: "Online",
    FINALVERSION: "Finalversion",
    SCHNITT: "Schnitt",
    DREH: "Dreh",
    SKRIPTFREIGABE: "Skriptfreigabe",
    SKRIPT: "Skript",
    SCOUTING: "Scouting",
  };

  const getFilmStatusColor = (status: string) => {
    switch (status) {
      case "SCOUTING":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "SKRIPT":
        return "bg-indigo-100 text-indigo-700 border-indigo-200";
      case "SKRIPTFREIGABE":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "DREH":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "SCHNITT":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "FINALVERSION":
        return "bg-teal-100 text-teal-700 border-teal-200";
      case "ONLINE":
        return "bg-green-100 text-green-700 border-green-200";
      case "BEENDET":
        return "bg-gray-100 text-gray-700 border-gray-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  if (!project) notFound();
  if (session.user.role === "CUSTOMER" && project.clientId !== session.user.clientId) notFound();

  const website = project.website;
  const role = session.user.role!;
  const canEdit = ["ADMIN", "AGENT"].includes(role);

  // Prepare options for InlineCell selects (same as in projects list)
  const materialStatusOptions = MATERIAL_STATUS_VALUES.map((value) => ({ value, label: labelForMaterialStatus(value) }));
  const priorityOptions = PRIORITIES.map((p) => ({ value: p, label: labelForWebsitePriority(p) }));
  const cmsOptions = CMS.map((c) => ({ value: c, label: c === "SHOPWARE" ? "Shop" : c }));
  const pStatusOptions = ["NONE", "BEENDET", "MMW", "VOLLST_A_K"].map((v) => ({ value: v, label: labelForProductionStatus(v) }));
  const seoOptions = ["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA"].map((v) => ({ value: v, label: labelForSeoStatus(v) }));
  const textitOptions = ["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA"].map((v) => ({ value: v, label: labelForTextitStatus(v) }));

  // Import agent helpers
  const { expandAgentsWithWTAliases, getAgentDisplayName, getEffectiveAgentId } = await import("@/lib/agent-helpers");

  // Get all agents for dropdown
  const agentsAll = await prisma.user.findMany({
    where: { role: "AGENT" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, categories: true, color: true }
  });

  const agentsActive = await prisma.user.findMany({
    where: { role: "AGENT", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, categories: true, color: true }
  });

  // Nur aktive Agenten mit Kategorie WEBSEITE für die Dropdown-Auswahl
  const websiteAgentsForDropdown = agentsAll.filter(a => a.categories.includes("WEBSEITE") && agentsActive.some(active => active.id === a.id));

  // Expand with WT aliases for web projects
  const websiteAgentsExpanded = expandAgentsWithWTAliases(websiteAgentsForDropdown);

  const agentOptions = [
    { value: "", label: "- ohne Agent -" },
    ...websiteAgentsExpanded.map((a) => ({
      value: a.id,
      label: a.name ?? a.email ?? "",
    })),
  ];

  // Determine agent display name and effective ID based on isWTAssignment
  const isWTAssignment = project.website?.isWTAssignment ?? false;
  const agentDisplayName = getAgentDisplayName(project.agentId, isWTAssignment, agentsAll);
  const effectiveAgentId = getEffectiveAgentId(project.agentId, isWTAssignment);

  // Derive the correct status for website projects
  const displayStatus = project.type === "WEBSITE" && website
    ? deriveProjectStatus({
        pStatus: website.pStatus,
        webDate: website.webDate,
        demoDate: website.demoDate,
        onlineDate: website.onlineDate,
        materialStatus: website.materialStatus,
      })
    : project.status;

  const statusLabel = project.type === "WEBSITE"
    ? labelForProjectStatus(displayStatus, { pStatus: website?.pStatus })
    : displayStatus;

  // Status badge colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case "WEBTERMIN":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "MATERIAL":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "UMSETZUNG":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "DEMO":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "ONLINE":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/projects" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück zur Übersicht
        </Link>
      </div>

      {/* Project Header Card */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-200 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          {/* Large Website Icon */}
          <div className="flex-shrink-0">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(displayStatus)}`}>
                {statusLabel}
              </span>
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

          {/* Domain Link Button */}
          {website?.domain && (
            <div className="flex-shrink-0">
              <a
                href={website.domain.startsWith("http") ? website.domain : `https://${website.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors font-medium text-sm shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                {website.domain}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
        </div>

        {project.important && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-300 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold text-amber-900 text-sm">Wichtige Informationen</p>
                <p className="text-amber-800 text-sm mt-1">{project.important}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Links */}
      {filmProjects.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            <h2 className="font-semibold text-gray-900">Filmprojekte des Kunden</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {filmProjects.map((fp) => {
              const filmStatus = deriveFilmStatusForLink(fp.film);
              const statusLabel = FILM_STATUS_LABELS[filmStatus] || filmStatus;
              const statusColor = getFilmStatusColor(filmStatus);

              return (
                <Link
                  key={fp.id}
                  href={`/film-projects/${fp.id}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-colors"
                >
                  <span>🎬 {fp.title}</span>
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
        {/* Project Details */}
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
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Domain</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <InlineCell
                  target="website"
                  id={project.id}
                  name="domain"
                  type="text"
                  display={website?.domain ?? "-"}
                  value={website?.domain ?? ""}
                  canEdit={canEdit}
                />
              </dd>
            </div>

            {/* Joomla Installation */}
            {project.joomlaInstallations && project.joomlaInstallations.length > 0 && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Joomla Installation{project.joomlaInstallations.length > 1 ? "en" : ""}
                </dt>
                <dd className="space-y-2">
                  {project.joomlaInstallations.map((installation) => (
                    <div key={installation.id} className="rounded-lg border border-green-200 bg-green-50/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {installation.standardDomain}/{installation.folderName}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 border border-green-200 flex-shrink-0">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Zugeordnet
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 space-y-0.5">
                            <div>
                              <span className="text-gray-500">Server:</span>{" "}
                              <span className="font-medium">{installation.server.name}</span>
                            </div>
                            <div className="font-mono text-[11px] text-gray-500 truncate">
                              {installation.installPath}
                            </div>
                          </div>
                        </div>
                        <a
                          href={installation.installUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 transition text-xs font-medium whitespace-nowrap flex-shrink-0"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Öffnen
                        </a>
                      </div>
                    </div>
                  ))}
                </dd>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Priorität</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <InlineCell
                    target="website"
                    id={project.id}
                    name="priority"
                    type="select"
                    display={labelForWebsitePriority(website?.priority)}
                    value={website?.priority ?? "NONE"}
                    options={priorityOptions}
                    canEdit={canEdit}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">CMS</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <InlineCell
                    target="website"
                    id={project.id}
                    name="cms"
                    type="select"
                    display={website?.cms === "SHOPWARE" ? "Shop" : website?.cms ?? "-"}
                    value={website?.cms ?? ""}
                    options={cmsOptions}
                    canEdit={canEdit}
                  />
                </dd>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Produktionsstatus</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <InlineCell
                    target="website"
                    id={project.id}
                    name="pStatus"
                    type="select"
                    display={labelForProductionStatus(website?.pStatus)}
                    value={website?.pStatus ?? "NONE"}
                    options={pStatusOptions}
                    canEdit={canEdit}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Materialstatus</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <InlineCell
                    target="website"
                    id={project.id}
                    name="materialStatus"
                    type="select"
                    display={labelForMaterialStatus(website?.materialStatus)}
                    value={website?.materialStatus ?? "ANGEFORDERT"}
                    options={materialStatusOptions}
                    canEdit={canEdit}
                  />
                </dd>
              </div>
            </div>

            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Umsetzer</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <InlineCell
                  target="project"
                  id={project.id}
                  name="agentId"
                  type="select"
                  display={agentDisplayName}
                  value={effectiveAgentId}
                  options={agentOptions}
                  canEdit={canEdit}
                />
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hinweis</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <InlineCell
                  target="website"
                  id={project.id}
                  name="note"
                  type="textarea"
                  display={website?.note ?? ""}
                  value={website?.note ?? ""}
                  canEdit={canEdit}
                  displayClassName="block whitespace-pre-wrap"
                />
              </dd>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Termine
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-blue-500"></div>
              <div className="flex-1">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Webtermin</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">
                  <InlineCell
                    target="website"
                    id={project.id}
                    name="webDate"
                    type="datetime-with-type"
                    display={fmtDateTime(website?.webDate)}
                    value={website?.webDate ? new Date(website.webDate).toISOString() : ""}
                    extraValue={website?.webterminType ?? ""}
                    canEdit={canEdit}
                  />
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-orange-500"></div>
              <div className="flex-1">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Letzter Materialeingang</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">
                  <InlineCell
                    target="website"
                    id={project.id}
                    name="lastMaterialAt"
                    type="date"
                    display={fmtDate(website?.lastMaterialAt)}
                    value={website?.lastMaterialAt ? new Date(website.lastMaterialAt).toISOString().slice(0, 10) : ""}
                    canEdit={canEdit}
                  />
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-yellow-500"></div>
              <div className="flex-1">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Demo an Kunden</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">
                  <InlineCell
                    target="website"
                    id={project.id}
                    name="demoDate"
                    type="date"
                    display={fmtDate(website?.demoDate)}
                    value={website?.demoDate ? new Date(website.demoDate).toISOString().slice(0, 10) : ""}
                    canEdit={canEdit}
                  />
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-green-500"></div>
              <div className="flex-1">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Online</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">
                  <InlineCell
                    target="website"
                    id={project.id}
                    name="onlineDate"
                    type="date"
                    display={fmtDate(website?.onlineDate)}
                    value={website?.onlineDate ? new Date(website.onlineDate).toISOString().slice(0, 10) : ""}
                    canEdit={canEdit}
                  />
                </dd>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Zuletzt aktualisiert</dt>
              <dd className="mt-1 text-sm text-gray-600">{fmtDate(project.updatedAt)}</dd>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Zusatzinformationen
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">SEO</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <InlineCell
                    target="website"
                    id={project.id}
                    name="seo"
                    type="select"
                    display={labelForSeoStatus(website?.seo)}
                    value={website?.seo ?? ""}
                    options={seoOptions}
                    canEdit={canEdit}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Textit</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <InlineCell
                    target="website"
                    id={project.id}
                    name="textit"
                    type="select"
                    display={labelForTextitStatus(website?.textit)}
                    value={website?.textit ?? ""}
                    options={textitOptions}
                    canEdit={canEdit}
                  />
                </dd>
              </div>
            </div>

            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Barrierefrei</dt>
              <dd className="mt-1">
                <InlineCell
                  target="website"
                  id={project.id}
                  name="accessible"
                  type="tri"
                  display={website?.accessible == null ? "-" : website?.accessible ? "Ja" : "Nein"}
                  value={website?.accessible ?? null}
                  canEdit={canEdit}
                />
              </dd>
            </div>

            {website?.demoLink && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Demo-Link</dt>
                <dd className="mt-1 text-sm">
                  <a href={website.demoLink.startsWith("http") ? website.demoLink : `https://${website.demoLink}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                    {website.demoLink}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </dd>
              </div>
            )}
          </div>
        </div>

        {/* Effort Tracking */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Zeitaufwand
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Umsetzung</dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900">
                <InlineCell
                  target="website"
                  id={project.id}
                  name="effortBuildMin"
                  type="number"
                  display={mm(website?.effortBuildMin)}
                  value={website?.effortBuildMin != null ? website.effortBuildMin / 60 : ""}
                  canEdit={canEdit}
                />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Demo</dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900">
                <InlineCell
                  target="website"
                  id={project.id}
                  name="effortDemoMin"
                  type="number"
                  display={mm(website?.effortDemoMin)}
                  value={website?.effortDemoMin != null ? website.effortDemoMin / 60 : ""}
                  canEdit={canEdit}
                />
              </dd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
