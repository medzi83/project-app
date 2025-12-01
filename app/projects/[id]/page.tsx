import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { deriveProjectStatus, labelForProjectStatus, labelForWebsitePriority, labelForProductionStatus, labelForMaterialStatus, labelForSeoStatus, labelForTextitStatus, MATERIAL_STATUS_VALUES, getProjectDisplayName } from "@/lib/project-status";
import { notFound, redirect } from "next/navigation";
import InlineCell from "@/components/InlineCell";
import ClientReassignment from "@/components/ClientReassignment";
import { BackButton } from "@/components/BackButton";
import { createWebDocumentation, deleteWebDocumentation } from "./webdoku/actions";
import DangerActionButton from "@/components/DangerActionButton";
import type { WebsitePriority, ProductionStatus, MaterialStatus, SEOStatus, TextitStatus, CMS as PrismaCMS } from "@prisma/client";

// Naive date/time formatting - extracts components directly from ISO string without timezone conversion
const fmtDate = (d?: Date | string | null) => {
  if (!d) return "-";
  try {
    const dateStr = typeof d === 'string' ? d : d.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "-";
    const [, year, month, day] = match;
    return `${day}.${month}.${year}`;
  } catch {
    return "-";
  }
};

const fmtDateTime = (d?: Date | string | null) => {
  if (!d) return "-";
  try {
    const dateStr = typeof d === 'string' ? d : d.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return "-";
    const [, year, month, day, hours, minutes] = match;
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
  } catch {
    return "-";
  }
};
const mm = (n?: number | null) => (n ? `${Math.floor(n / 60)}h ${n % 60}m` : "-");
const yesNo = (v?: boolean | null) => (v === true ? "Ja" : v === false ? "Nein" : "-");
const linkify = (u?: string | null) => {
  if (!u) return "-";
  const hasProto = /^https?:\/\//i.test(u);
  const href = hasProto ? u : `https://${u}`;
  return <a className="underline" href={href} target="_blank" rel="noreferrer">{u}</a>;
};

const PRIORITIES = ["NONE", "PRIO_1", "PRIO_2", "PRIO_3"] as const;
const CMS = ["SHOPWARE", "JOOMLA", "WORDPRESS", "CUSTOM", "OTHER"] as const;

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
      website: {
        include: {
          webDocumentation: {
            include: {
              feedback: true,
              generalTextSubmission: true,
              menuItems: {
                include: {
                  textSubmission: true,
                },
              },
            },
          },
        },
      },
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
  const canEdit = role === "ADMIN" || role === "AGENT";

  // Prepare options for InlineCell selects (same as in projects list)
  const materialStatusOptions = MATERIAL_STATUS_VALUES.map((value) => ({ value, label: labelForMaterialStatus(value) }));
  const priorityOptions = PRIORITIES.map((p) => ({ value: p, label: labelForWebsitePriority(p) }));
  const cmsOptions = CMS.map((c) => ({ value: c, label: c === "SHOPWARE" ? "Shop" : c }));
  const pStatusOptions = ["NONE", "BEENDET", "MMW", "VOLLST_A_K", "VOLLST_K_E_S"].map((v) => ({ value: v, label: labelForProductionStatus(v) }));
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

  // Get all clients for reassignment (Admin only)
  const allClients = role === "ADMIN"
    ? await prisma.client.findMany({
        select: { id: true, name: true, customerNo: true },
        orderBy: { name: "asc" },
      })
    : [];

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

  // Calculate status in real-time based on current data
  const displayStatus = project.type === "WEBSITE"
    ? deriveProjectStatus({
        pStatus: website?.pStatus,
        webDate: website?.webDate,
        webterminType: website?.webterminType,
        demoDate: website?.demoDate,
        onlineDate: website?.onlineDate,
        materialStatus: website?.materialStatus,
      })
    : project.status;

  const statusLabel = project.type === "WEBSITE"
    ? labelForProjectStatus(displayStatus, { pStatus: website?.pStatus })
    : displayStatus;

  // Check if status should be italic (K.e.S. status)
  const isKesStatus = website?.pStatus === "VOLLST_K_E_S" && displayStatus === "UMSETZUNG";

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
    <div className="p-2 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-2 md:px-0">
        <BackButton fallbackUrl="/projects" />
      </div>

      {/* Project Header Card */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl md:rounded-2xl border border-purple-200 dark:border-purple-700 p-3 md:p-6 shadow-sm">
        {/* Mobile: Stacked Layout */}
        <div className="md:hidden space-y-3">
          {/* Icon and Title */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1 break-words">{getProjectDisplayName(project)}</h1>
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold border ${getStatusColor(displayStatus)}`} style={isKesStatus ? { fontStyle: "italic" } : undefined}>
              {statusLabel}
            </span>
            {website?.isRelaunch && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm border border-orange-600">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                RELAUNCH
              </span>
            )}
            {website?.priority && website.priority !== "NONE" && (
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold shadow-sm border ${
                website.priority === "PRIO_1"
                  ? "bg-gradient-to-r from-red-500 to-red-600 text-white border-red-600"
                  : website.priority === "PRIO_2"
                  ? "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white border-yellow-600"
                  : "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600"
              }`}>
                {website.priority === "PRIO_1" ? "PRIO 1" : website.priority === "PRIO_2" ? "PRIO 2" : "PRIO 3"}
              </span>
            )}
          </div>

          {/* Client Info */}
          <div className="flex flex-col gap-2 text-xs text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <Link href={`/clients/${project.clientId}`} className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline truncate">
                {project.client?.name || "Unbekannter Kunde"}
              </Link>
            </div>
            {project.client?.customerNo && (
              <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 w-fit">
                Kd-Nr: {project.client.customerNo}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            {website?.domain && (
              <a
                href={website.domain.startsWith("http") ? website.domain : `https://${website.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border-2 border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white dark:hover:text-white transition-colors font-medium text-xs shadow-sm"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <span className="truncate">{website.domain}</span>
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}

            {(website?.demoLink || (project.joomlaInstallations && project.joomlaInstallations.length > 0)) && (
              <a
                href={
                  website?.demoLink
                    ? (website.demoLink.startsWith("http") ? website.demoLink : `https://${website.demoLink}`)
                    : (project.joomlaInstallations![0].installUrl.startsWith("http")
                        ? project.joomlaInstallations![0].installUrl
                        : `https://${project.joomlaInstallations![0].installUrl}`)
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border-2 border-green-600 dark:border-green-500 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-600 dark:hover:bg-green-600 hover:text-white dark:hover:text-white transition-colors font-medium text-xs shadow-sm"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Zur Demo
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* Desktop: Original Layout */}
        <div className="hidden md:flex items-start justify-between gap-6">
          {/* Large Website Icon */}
          <div className="flex-shrink-0">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(displayStatus)}`} style={isKesStatus ? { fontStyle: "italic" } : undefined}>
                {statusLabel}
              </span>
              {website?.isRelaunch && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm border border-orange-600">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  RELAUNCH
                </span>
              )}
              {website?.priority && website.priority !== "NONE" && (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm border ${
                  website.priority === "PRIO_1"
                    ? "bg-gradient-to-r from-red-500 to-red-600 text-white border-red-600"
                    : website.priority === "PRIO_2"
                    ? "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white border-yellow-600"
                    : "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600"
                }`}>
                  {website.priority === "PRIO_1" ? "PRIO 1" : website.priority === "PRIO_2" ? "PRIO 2" : "PRIO 3"}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{getProjectDisplayName(project)}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <Link href={`/clients/${project.clientId}`} className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline">
                {project.client?.name || "Unbekannter Kunde"}
              </Link>
              {project.client?.customerNo && (
                <>
                  <span className="text-gray-400 dark:text-gray-500">•</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600">
                    Kd-Nr: {project.client.customerNo}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 flex flex-col gap-2">
            {/* Domain Link Button */}
            {website?.domain && (
              <a
                href={website.domain.startsWith("http") ? website.domain : `https://${website.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white dark:hover:text-white transition-colors font-medium text-sm shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                {website.domain}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}

            {/* Demo Link Button - Custom or First Joomla Installation */}
            {(website?.demoLink || (project.joomlaInstallations && project.joomlaInstallations.length > 0)) && (
              <a
                href={
                  website?.demoLink
                    ? (website.demoLink.startsWith("http") ? website.demoLink : `https://${website.demoLink}`)
                    : (project.joomlaInstallations![0].installUrl.startsWith("http")
                        ? project.joomlaInstallations![0].installUrl
                        : `https://${project.joomlaInstallations![0].installUrl}`)
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-green-600 dark:border-green-500 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-600 dark:hover:bg-green-600 hover:text-white dark:hover:text-white transition-colors font-medium text-sm shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Zur Demo
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}

          </div>
        </div>

        {project.important && (
          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-200 text-sm">Wichtige Informationen</p>
                <p className="text-amber-800 dark:text-amber-300 text-sm mt-1">{project.important}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Client Reassignment (Admin Only) */}
      {role === "ADMIN" && project.client && (
        <ClientReassignment
          projectId={project.id}
          currentClient={{
            id: project.client.id,
            name: project.client.name,
            customerNo: project.client.customerNo,
          }}
          allClients={allClients}
        />
      )}

      {/* Quick Links */}
      {filmProjects.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            <h2 className="font-semibold text-gray-900 dark:text-white">Filmprojekte des Kunden</h2>
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
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
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
        {/* Project Details - Compact Layout */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Projektdetails
            </h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Projekttitel</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">
                  <InlineCell target="project" id={project.id} name="title" type="text" display={project.title ?? "-"} value={project.title ?? ""} canEdit={canEdit} />
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Domain</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">
                  <InlineCell target="website" id={project.id} name="domain" type="text" display={website?.domain ?? "-"} value={website?.domain ?? ""} canEdit={canEdit} />
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Umsetzer</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">
                  <InlineCell target="project" id={project.id} name="agentId" type="select" display={agentDisplayName} value={effectiveAgentId} options={agentOptions} canEdit={canEdit} />
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Relaunch</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">
                  <InlineCell target="website" id={project.id} name="isRelaunch" type="tri" display={website?.isRelaunch ? "Ja" : "Nein"} value={website?.isRelaunch ?? false} canEdit={canEdit} />
                </dd>
              </div>
            </div>

            {/* Hinweis - full width if present */}
            {(website?.note || canEdit) && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Hinweis</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">
                  <InlineCell target="website" id={project.id} name="note" type="textarea" display={website?.note ?? ""} value={website?.note ?? ""} canEdit={canEdit} displayClassName="block whitespace-pre-wrap" />
                </dd>
              </div>
            )}
          </div>
        </div>

        {/* Status & Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Status & Einstellungen
            </h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Priorität</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">
                  <InlineCell target="website" id={project.id} name="priority" type="select" display={labelForWebsitePriority(website?.priority)} value={website?.priority ?? "NONE"} options={priorityOptions} canEdit={canEdit} />
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">CMS</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">
                  <InlineCell target="website" id={project.id} name="cms" type="select" display={website?.cms === "SHOPWARE" ? "Shop" : website?.cms ?? "-"} value={website?.cms ?? ""} options={cmsOptions} canEdit={canEdit} />
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Produktionsstatus</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">
                  <InlineCell target="website" id={project.id} name="pStatus" type="select" display={labelForProductionStatus(website?.pStatus)} value={website?.pStatus ?? "NONE"} options={pStatusOptions} canEdit={canEdit} />
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Materialstatus</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">
                  <InlineCell target="website" id={project.id} name="materialStatus" type="select" display={labelForMaterialStatus(website?.materialStatus)} value={website?.materialStatus ?? "ANGEFORDERT"} options={materialStatusOptions} canEdit={canEdit} />
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">SEO</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">
                  <InlineCell target="website" id={project.id} name="seo" type="select" display={labelForSeoStatus(website?.seo)} value={website?.seo ?? ""} options={seoOptions} canEdit={canEdit} />
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Textit</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">
                  <InlineCell target="website" id={project.id} name="textit" type="select" display={labelForTextitStatus(website?.textit)} value={website?.textit ?? ""} options={textitOptions} canEdit={canEdit} />
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Barrierefrei</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">
                  <InlineCell target="website" id={project.id} name="accessible" type="tri" display={website?.accessible == null ? "-" : website?.accessible ? "Ja" : "Nein"} value={website?.accessible ?? null} canEdit={canEdit} />
                </dd>
              </div>
            </div>
          </div>
        </div>

        {/* Termine */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Termine
            </h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-blue-500"></div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Webtermin</dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    <InlineCell target="website" id={project.id} name="webDate" type="datetime-with-type" display={fmtDateTime(website?.webDate)} value={website?.webDate ? new Date(website.webDate).toISOString() : ""} extraValue={website?.webterminType ?? ""} canEdit={canEdit} />
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-orange-500"></div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Materialeingang</dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    <InlineCell target="website" id={project.id} name="lastMaterialAt" type="date" display={fmtDate(website?.lastMaterialAt)} value={website?.lastMaterialAt ? new Date(website.lastMaterialAt).toISOString().slice(0, 10) : ""} canEdit={canEdit} />
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-yellow-500"></div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Demo an Kunden</dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    <InlineCell target="website" id={project.id} name="demoDate" type="date" display={fmtDate(website?.demoDate)} value={website?.demoDate ? new Date(website.demoDate).toISOString().slice(0, 10) : ""} canEdit={canEdit} />
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-green-500"></div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Online</dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    <InlineCell target="website" id={project.id} name="onlineDate" type="date" display={fmtDate(website?.onlineDate)} value={website?.onlineDate ? new Date(website.onlineDate).toISOString().slice(0, 10) : ""} canEdit={canEdit} />
                  </dd>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              Aktualisiert: {fmtDate(project.updatedAt)}
            </div>
          </div>
        </div>

        {/* Zeitaufwand */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Zeitaufwand
            </h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Umsetzung</dt>
                <dd className="text-xl font-bold text-gray-900 dark:text-white">
                  <InlineCell target="website" id={project.id} name="effortBuildMin" type="number" display={mm(website?.effortBuildMin)} value={website?.effortBuildMin != null ? website.effortBuildMin / 60 : ""} canEdit={canEdit} />
                </dd>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Demo</dt>
                <dd className="text-xl font-bold text-gray-900 dark:text-white">
                  <InlineCell target="website" id={project.id} name="effortDemoMin" type="number" display={mm(website?.effortDemoMin)} value={website?.effortDemoMin != null ? website.effortDemoMin / 60 : ""} canEdit={canEdit} />
                </dd>
              </div>
            </div>
            {(website?.effortBuildMin || website?.effortDemoMin) && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-center">
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Gesamt: </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{mm((website?.effortBuildMin ?? 0) + (website?.effortDemoMin ?? 0))}</span>
              </div>
            )}
          </div>
        </div>

        {/* Webdokumentation Card */}
        {canEdit && website && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Webdokumentation
              </h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    website.webDocumentation
                      ? "bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-200 dark:shadow-purple-900/30"
                      : "bg-gray-100 dark:bg-gray-700"
                  }`}>
                    <svg className={`w-6 h-6 ${website.webDocumentation ? "text-white" : "text-gray-400 dark:text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    {website.webDocumentation ? (
                      <>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Dokumentation vorhanden</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Erstellt am {fmtDate(website.webDocumentation.createdAt)}
                          {website.webDocumentation.updatedAt && website.webDocumentation.updatedAt.getTime() !== website.webDocumentation.createdAt.getTime() && (
                            <span> · Aktualisiert {fmtDate(website.webDocumentation.updatedAt)}</span>
                          )}
                        </p>
                        {/* Freigabe-Status */}
                        {website.webDocumentation.releasedAt && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Freigegeben am {new Date(website.webDocumentation.releasedAt).toLocaleDateString("de-DE")} um {new Date(website.webDocumentation.releasedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr von {website.webDocumentation.releasedByName}
                          </p>
                        )}
                        {/* Kunden-Bestätigung */}
                        {website.webDocumentation.confirmedAt && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            Vom Kunden bestätigt am {new Date(website.webDocumentation.confirmedAt).toLocaleDateString("de-DE")} um {new Date(website.webDocumentation.confirmedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
                            {website.webDocumentation.feedback ? (
                              <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                mit Anmerkungen
                              </span>
                            ) : (
                              <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                änderungsfrei
                              </span>
                            )}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Noch keine Dokumentation</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Kann am Webtermin erstellt werden
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {website.webDocumentation ? (
                    <>
                      <Link
                        href={`/projects/${project.id}/webdoku`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Öffnen
                      </Link>
                      {role === "ADMIN" && (
                        <DangerActionButton
                          action={async () => {
                            "use server";
                            await deleteWebDocumentation(project.id);
                          }}
                          confirmText="Möchten Sie die Webdokumentation wirklich unwiderruflich löschen? Alle Daten inkl. Menüstruktur, Impressum, Material-Einreichungen und Kundenfeedback gehen verloren."
                          className="inline-flex items-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-medium text-sm"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </DangerActionButton>
                      )}
                    </>
                  ) : (
                    (() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const webDate = website.webDate ? new Date(website.webDate) : null;
                      const webDateDay = webDate ? new Date(webDate.getFullYear(), webDate.getMonth(), webDate.getDate()) : null;
                      const isWebterminToday = webDateDay && webDateDay.getTime() === today.getTime();

                      return isWebterminToday ? (
                        <form action={async () => {
                          "use server";
                          await createWebDocumentation(project.id);
                        }}>
                          <button
                            type="submit"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm shadow-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Erstellen
                          </button>
                        </form>
                      ) : (
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg text-xs">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Nur am Webtermin
                        </span>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Material Card - Only show when webDocumentation exists */}
        {canEdit && website?.webDocumentation && (() => {
          const webDoku = website.webDocumentation;
          const menuItems = webDoku.menuItems || [];

          // Bilder-Statistik
          const menuItemsNeedingImages = menuItems.filter((m) => m.needsImages);
          const totalImagesNeeded = menuItemsNeedingImages.length +
            (webDoku.materialLogoNeeded ? 1 : 0) +
            (webDoku.materialNotesNeedsImages ? 1 : 0);

          // Texte-Statistik
          const menuItemsNeedingTexts = menuItems.filter((m) => m.needsTexts);
          const textsSubmitted = menuItemsNeedingTexts.filter(
            (m) => m.textSubmission?.submittedAt
          ).length;
          const generalTextSubmitted = webDoku.materialNotesNeedsTexts && webDoku.generalTextSubmission?.submittedAt ? 1 : 0;
          const totalTextsNeeded = menuItemsNeedingTexts.length + (webDoku.materialNotesNeedsTexts ? 1 : 0);
          const totalTextsSubmitted = textsSubmitted + generalTextSubmitted;

          // Prüfstatus für eingereichte Texte
          let textsApproved = 0;
          let textsRejected = 0;
          let textsPending = 0;

          for (const item of menuItemsNeedingTexts) {
            if (item.textSubmission?.submittedAt) {
              if (item.textSubmission.suitable === true) {
                textsApproved++;
              } else if (item.textSubmission.suitable === false) {
                textsRejected++;
              } else {
                textsPending++;
              }
            }
          }

          if (webDoku.materialNotesNeedsTexts && webDoku.generalTextSubmission?.submittedAt) {
            if (webDoku.generalTextSubmission.suitable === true) {
              textsApproved++;
            } else if (webDoku.generalTextSubmission.suitable === false) {
              textsRejected++;
            } else {
              textsPending++;
            }
          }

          // Authcode
          const authcodeNeeded = webDoku.materialAuthcodeNeeded;

          // Prüfen ob überhaupt Material benötigt wird
          const hasMaterialRequirements = totalImagesNeeded > 0 || totalTextsNeeded > 0 || authcodeNeeded;

          if (!hasMaterialRequirements) return null;

          const allTextsSubmitted = totalTextsNeeded > 0 && totalTextsSubmitted === totalTextsNeeded;

          return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Material
                </h2>
              </div>
              <div className="p-6 space-y-4">
                {/* Bilder-Status */}
                {totalImagesNeeded > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Bilder</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {totalImagesNeeded} {totalImagesNeeded === 1 ? "Bereich benötigt" : "Bereiche benötigen"} Bilder
                        {webDoku.materialLogoNeeded && <span className="ml-1">(inkl. Logo)</span>}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
                      Offen
                    </span>
                  </div>
                )}

                {/* Texte-Status */}
                {totalTextsNeeded > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        allTextsSubmitted
                          ? "bg-green-100 dark:bg-green-900/30"
                          : "bg-purple-100 dark:bg-purple-900/30"
                      }`}>
                        <svg className={`w-5 h-5 ${
                          allTextsSubmitted
                            ? "text-green-600 dark:text-green-400"
                            : "text-purple-600 dark:text-purple-400"
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {website.textit && website.textit !== "NEIN" ? "Stichpunkte" : "Texte"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {allTextsSubmitted
                            ? `Alle ${totalTextsSubmitted} ${totalTextsSubmitted === 1 ? "Text eingereicht" : "Texte eingereicht"}`
                            : `${totalTextsSubmitted} von ${totalTextsNeeded} eingereicht`
                          }
                        </p>
                      </div>
                      {allTextsSubmitted ? (
                        <Link
                          href={`/projects/${project.id}/material-text`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Anzeigen
                        </Link>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
                          {totalTextsSubmitted > 0 ? "Teilweise" : "Offen"}
                        </span>
                      )}
                    </div>
                    {/* Prüfstatus für eingereichte Texte */}
                    {totalTextsSubmitted > 0 && (
                      <div className="ml-[52px]">
                        <div className="flex items-center gap-2 text-xs">
                          {textsApproved > 0 && (
                            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                              {textsApproved} geprüft
                            </span>
                          )}
                          {textsPending > 0 && (
                            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              {textsPending} offen
                            </span>
                          )}
                          {textsRejected > 0 && (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              {textsRejected} ungeeignet
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Authcode-Status */}
                {authcodeNeeded && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Authcode</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Wird zum Zeitpunkt der Onlinestellung benötigt
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                      Ausstehend
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Demo Card - Always visible */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Demo
            </h2>
          </div>
          <div className="p-4 space-y-3">
            {/* Benutzerdefinierter Demo-Link */}
            <div>
              <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Benutzerdefinierter Link</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100">
                <InlineCell target="website" id={project.id} name="demoLink" type="text" display={website?.demoLink || "-"} value={website?.demoLink ?? ""} canEdit={canEdit} displayClassName={website?.demoLink ? "text-blue-600 dark:text-blue-400" : "text-gray-400"} />
              </dd>
            </div>

            {/* Joomla Installationen */}
            {project.joomlaInstallations && project.joomlaInstallations.length > 0 && (
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                <dt className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Joomla Installation{project.joomlaInstallations.length > 1 ? "en" : ""}
                </dt>
                <dd className="space-y-2">
                  {project.joomlaInstallations.map((installation) => (
                    <div key={installation.id} className="flex items-center justify-between gap-2 rounded-lg border border-green-200 dark:border-green-700 bg-green-50/40 dark:bg-green-900/20 px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {installation.standardDomain}/{installation.folderName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Server: {installation.server.name}
                        </div>
                      </div>
                      <a
                        href={installation.installUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 transition text-xs font-medium whitespace-nowrap flex-shrink-0"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Öffnen
                      </a>
                    </div>
                  ))}
                </dd>
              </div>
            )}

            {/* Demo installieren Button */}
            {canEdit && (
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                <Link
                  href={`/admin/basisinstallation?clientId=${project.clientId}&projectId=${project.id}`}
                  className="inline-flex items-center gap-2 px-3 py-2 w-full justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-green-500 hover:text-green-600 dark:hover:border-green-500 dark:hover:text-green-400 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Demo installieren
                </Link>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
