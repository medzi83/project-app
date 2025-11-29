import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { notFound, redirect } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { getProjectDisplayName } from "@/lib/project-status";
import CopyButton from "./CopyButton";
import ReviewButtons from "./ReviewButtons";

type Props = { params: Promise<{ id: string }> };

export default async function MaterialTextPage({ params }: Props) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session) redirect("/login");

  // Only Admins and Agents can access this page
  const role = session.user.role!;
  if (role !== "ADMIN" && role !== "AGENT") {
    notFound();
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      website: {
        include: {
          webDocumentation: {
            include: {
              generalTextSubmission: true,
              menuItems: {
                where: {
                  needsTexts: true,
                },
                include: {
                  textSubmission: true,
                },
                orderBy: {
                  sortOrder: "asc",
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) notFound();

  const webDoku = project.website?.webDocumentation;
  if (!webDoku) notFound();

  // Get submitted texts
  const menuItems = webDoku.menuItems || [];
  const submittedMenuItems = menuItems.filter(
    (m) => m.textSubmission?.submittedAt
  );
  const generalTextSubmission = webDoku.generalTextSubmission;

  // Build hierarchical structure: main items first, then children grouped under parents
  const mainItems = submittedMenuItems.filter((m) => !m.parentId);
  const childItems = submittedMenuItems.filter((m) => m.parentId);

  // Group children by parent ID
  const childrenByParent = new Map<string, typeof submittedMenuItems>();
  childItems.forEach((child) => {
    const parentId = child.parentId!;
    if (!childrenByParent.has(parentId)) {
      childrenByParent.set(parentId, []);
    }
    childrenByParent.get(parentId)!.push(child);
  });

  // Find orphan children (children whose parent has no submitted text)
  // These need to be shown with parent context
  const orphanChildren = childItems.filter((child) => {
    const parentHasSubmission = mainItems.some((m) => m.id === child.parentId);
    return !parentHasSubmission;
  });

  // Get unique parent IDs for orphan children to group them
  const orphanParentIds = [...new Set(orphanChildren.map((c) => c.parentId!))];

  // Check if textit is active (Stichpunkte instead of Texte)
  const isTextit = project.website?.textit && project.website.textit !== "NEIN";
  const textLabel = isTextit ? "Stichpunkte" : "Texte";

  // Statistiken für die Fortschrittsübersicht berechnen
  const reviewStats = (() => {
    let pending = 0;    // Eingereicht, aber noch nicht bewertet
    let approved = 0;   // Als geeignet markiert
    let rejected = 0;   // Als ungeeignet markiert (zur Überarbeitung)

    for (const item of submittedMenuItems) {
      const sub = item.textSubmission;
      if (sub?.suitable === true) {
        approved++;
      } else if (sub?.suitable === false) {
        rejected++;
      } else {
        // Eingereicht aber noch nicht bewertet
        pending++;
      }
    }

    // Allgemeiner Text
    if (generalTextSubmission?.submittedAt) {
      if (generalTextSubmission.suitable === true) {
        approved++;
      } else if (generalTextSubmission.suitable === false) {
        rejected++;
      } else {
        pending++;
      }
    }

    const total = pending + approved + rejected;
    return { pending, approved, rejected, total };
  })();

  // Helper to get parent name for context
  const getParentName = (item: typeof menuItems[number]): string | null => {
    if (!item.parentId) return null;
    const parent = menuItems.find((m) => m.id === item.parentId);
    return parent?.name || null;
  };

  const fmtDateTime = (d?: Date | string | null) => {
    if (!d) return "-";
    try {
      // Naive Formatierung - direkt aus ISO-String extrahieren ohne Zeitzonen-Konvertierung
      const dateStr = typeof d === "string" ? d : d.toISOString();
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (!match) return "-";
      const [, year, month, day, hours, minutes] = match;
      return `${day}.${month}.${year}, ${hours}:${minutes} Uhr`;
    } catch {
      return "-";
    }
  };

  // Status-Badge basierend auf Review-Status
  const getStatusBadge = (suitable: boolean | null) => {
    if (suitable === true) {
      // Geprüft und geeignet - Grün
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Geprüft
        </span>
      );
    } else if (suitable === false) {
      // Ungeeignet - Überarbeitung nötig - Gelb/Orange
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Überarbeitung nötig
        </span>
      );
    } else {
      // Noch nicht bewertet - Blau
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Eingereicht
        </span>
      );
    }
  };

  return (
    <div className="p-2 md:p-6 space-y-4 md:space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-2 md:px-0">
        <BackButton fallbackUrl={`/projects/${id}`} />
      </div>

      {/* Page Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl md:rounded-2xl border border-green-200 dark:border-green-700 p-4 md:p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
            <svg
              className="w-6 h-6 md:w-7 md:h-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-1">
              Eingereichte {textLabel}
            </h1>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Link
                href={`/projects/${id}`}
                className="font-medium text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 hover:underline"
              >
                {getProjectDisplayName(project)}
              </Link>
              <span className="text-gray-400 dark:text-gray-500">•</span>
              <span>{project.client?.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fortschrittsübersicht - nur anzeigen wenn Texte eingereicht wurden */}
      {reviewStats.total > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Prüffortschritt: {textLabel}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {reviewStats.approved} von {reviewStats.total} geprüft
              </p>
            </div>
          </div>

          {/* Fortschrittsbalken */}
          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
            <div className="h-full flex">
              {reviewStats.approved > 0 && (
                <div
                  className="bg-green-500"
                  style={{ width: `${(reviewStats.approved / reviewStats.total) * 100}%` }}
                />
              )}
              {reviewStats.rejected > 0 && (
                <div
                  className="bg-amber-500"
                  style={{ width: `${(reviewStats.rejected / reviewStats.total) * 100}%` }}
                />
              )}
              {reviewStats.pending > 0 && (
                <div
                  className="bg-blue-500"
                  style={{ width: `${(reviewStats.pending / reviewStats.total) * 100}%` }}
                />
              )}
            </div>
          </div>

          {/* Status-Legende */}
          <div className="flex flex-wrap gap-4 text-sm">
            {reviewStats.pending > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  {reviewStats.pending} zu prüfen
                </span>
              </div>
            )}
            {reviewStats.rejected > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-amber-700 dark:text-amber-400 font-medium">
                  {reviewStats.rejected} als ungeeignet markiert
                </span>
              </div>
            )}
            {reviewStats.approved > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  {reviewStats.approved} geprüft
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Submitted Texts */}
      <div className="space-y-4">
        {/* Main Menu Items with their Children */}
        {mainItems.map((item) => {
          const children = childrenByParent.get(item.id) || [];
          return (
            <div key={item.id} className="space-y-2">
              {/* Main Item */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-700 px-4 md:px-6 py-3 border-b border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {item.name}
                    </h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.textSubmission?.content && (
                        <CopyButton text={item.textSubmission.content} />
                      )}
                      {getStatusBadge(item.textSubmission?.suitable ?? null)}
                    </div>
                  </div>
                </div>
                <div className="p-4 md:p-6">
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {item.textSubmission?.content || (
                      <span className="text-gray-400 italic">Kein Inhalt</span>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      {item.textSubmission?.isResubmission ? "Erneut eingereicht" : "Eingereicht"} am {fmtDateTime(item.textSubmission?.submittedAt)}
                      {item.textSubmission?.submittedByName && (
                        <span> von {item.textSubmission.submittedByName}</span>
                      )}
                    </span>
                  </div>
                  {/* Vorheriger Ablehnungsgrund bei erneuter Einreichung */}
                  {item.textSubmission?.isResubmission && item.textSubmission?.previousReviewNote && (
                    <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Vorheriger Ablehnungsgrund:</p>
                      <p className="text-sm text-amber-800 dark:text-amber-300">{item.textSubmission.previousReviewNote}</p>
                    </div>
                  )}
                  {/* Bewertung */}
                  <ReviewButtons
                    type="menuItem"
                    itemId={item.id}
                    projectId={id}
                    currentReview={item.textSubmission ? {
                      suitable: item.textSubmission.suitable,
                      reviewNote: item.textSubmission.reviewNote,
                      reviewedAt: item.textSubmission.reviewedAt,
                      reviewedByName: item.textSubmission.reviewedByName,
                    } : null}
                  />
                </div>
              </div>

              {/* Child Items */}
              {children.map((child) => (
                <div
                  key={child.id}
                  className="ml-4 md:ml-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
                >
                  <div className="bg-gray-50 dark:bg-gray-700 px-4 md:px-6 py-3 border-b border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {child.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {child.textSubmission?.content && (
                          <CopyButton text={child.textSubmission.content} />
                        )}
                        {getStatusBadge(child.textSubmission?.suitable ?? null)}
                      </div>
                    </div>
                  </div>
                  <div className="p-4 md:p-6">
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                      {child.textSubmission?.content || (
                        <span className="text-gray-400 italic">Kein Inhalt</span>
                      )}
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        {child.textSubmission?.isResubmission ? "Erneut eingereicht" : "Eingereicht"} am {fmtDateTime(child.textSubmission?.submittedAt)}
                        {child.textSubmission?.submittedByName && (
                          <span> von {child.textSubmission.submittedByName}</span>
                        )}
                      </span>
                    </div>
                    {/* Vorheriger Ablehnungsgrund bei erneuter Einreichung */}
                    {child.textSubmission?.isResubmission && child.textSubmission?.previousReviewNote && (
                      <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Vorheriger Ablehnungsgrund:</p>
                        <p className="text-sm text-amber-800 dark:text-amber-300">{child.textSubmission.previousReviewNote}</p>
                      </div>
                    )}
                    {/* Bewertung */}
                    <ReviewButtons
                      type="menuItem"
                      itemId={child.id}
                      projectId={id}
                      currentReview={child.textSubmission ? {
                        suitable: child.textSubmission.suitable,
                        reviewNote: child.textSubmission.reviewNote,
                        reviewedAt: child.textSubmission.reviewedAt,
                        reviewedByName: child.textSubmission.reviewedByName,
                      } : null}
                    />
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {/* Orphan Children (children whose parent has no submission) - grouped by parent */}
        {orphanParentIds.map((parentId) => {
          const parent = menuItems.find((m) => m.id === parentId);
          const orphans = orphanChildren.filter((c) => c.parentId === parentId);
          return (
            <div key={parentId} className="space-y-2">
              {/* Parent Header (not submitted, just for context) */}
              <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                <h3 className="font-medium text-gray-600 dark:text-gray-400">
                  {parent?.name || "Unbekannt"}
                </h3>
              </div>
              {/* Orphan Child Items */}
              {orphans.map((child) => (
                <div
                  key={child.id}
                  className="ml-4 md:ml-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
                >
                  <div className="bg-gray-50 dark:bg-gray-700 px-4 md:px-6 py-3 border-b border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {child.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {child.textSubmission?.content && (
                          <CopyButton text={child.textSubmission.content} />
                        )}
                        {getStatusBadge(child.textSubmission?.suitable ?? null)}
                      </div>
                    </div>
                  </div>
                  <div className="p-4 md:p-6">
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                      {child.textSubmission?.content || (
                        <span className="text-gray-400 italic">Kein Inhalt</span>
                      )}
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        {child.textSubmission?.isResubmission ? "Erneut eingereicht" : "Eingereicht"} am {fmtDateTime(child.textSubmission?.submittedAt)}
                        {child.textSubmission?.submittedByName && (
                          <span> von {child.textSubmission.submittedByName}</span>
                        )}
                      </span>
                    </div>
                    {/* Vorheriger Ablehnungsgrund bei erneuter Einreichung */}
                    {child.textSubmission?.isResubmission && child.textSubmission?.previousReviewNote && (
                      <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Vorheriger Ablehnungsgrund:</p>
                        <p className="text-sm text-amber-800 dark:text-amber-300">{child.textSubmission.previousReviewNote}</p>
                      </div>
                    )}
                    {/* Bewertung */}
                    <ReviewButtons
                      type="menuItem"
                      itemId={child.id}
                      projectId={id}
                      currentReview={child.textSubmission ? {
                        suitable: child.textSubmission.suitable,
                        reviewNote: child.textSubmission.reviewNote,
                        reviewedAt: child.textSubmission.reviewedAt,
                        reviewedByName: child.textSubmission.reviewedByName,
                      } : null}
                    />
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {/* General Text Submission */}
        {generalTextSubmission?.submittedAt && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="bg-amber-50 dark:bg-amber-900/20 px-4 md:px-6 py-3 border-b border-amber-200 dark:border-amber-700">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                  Weitere Hinweise / Anmerkungen
                </h3>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {generalTextSubmission.content && (
                    <CopyButton text={generalTextSubmission.content} />
                  )}
                  {getStatusBadge(generalTextSubmission.suitable)}
                </div>
              </div>
            </div>
            <div className="p-4 md:p-6">
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                {generalTextSubmission.content || (
                  <span className="text-gray-400 italic">Kein Inhalt</span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>
                  {generalTextSubmission.isResubmission ? "Erneut eingereicht" : "Eingereicht"} am {fmtDateTime(generalTextSubmission.submittedAt)}
                  {generalTextSubmission.submittedByName && (
                    <span> von {generalTextSubmission.submittedByName}</span>
                  )}
                </span>
              </div>
              {/* Vorheriger Ablehnungsgrund bei erneuter Einreichung */}
              {generalTextSubmission.isResubmission && generalTextSubmission.previousReviewNote && (
                <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Vorheriger Ablehnungsgrund:</p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">{generalTextSubmission.previousReviewNote}</p>
                </div>
              )}
              {/* Bewertung */}
              <ReviewButtons
                type="general"
                itemId={webDoku.projectId}
                projectId={id}
                currentReview={{
                  suitable: generalTextSubmission.suitable,
                  reviewNote: generalTextSubmission.reviewNote,
                  reviewedAt: generalTextSubmission.reviewedAt,
                  reviewedByName: generalTextSubmission.reviewedByName,
                }}
              />
            </div>
          </div>
        )}

        {/* Empty State */}
        {submittedMenuItems.length === 0 &&
          !generalTextSubmission?.submittedAt && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-400 dark:text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Keine {textLabel} eingereicht
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Der Kunde hat noch keine {textLabel} über das Kundenportal
                eingereicht.
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
