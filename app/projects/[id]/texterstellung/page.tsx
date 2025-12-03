import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { notFound, redirect } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { getProjectDisplayName } from "@/lib/project-status";
import StartTexterstellungButton from "./StartTexterstellungButton";
import TexterstellungClient from "./TexterstellungClient";

type Props = { params: Promise<{ id: string }> };

export default async function TexterstellungPage({ params }: Props) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session) redirect("/login");

  // Only Admins, Agents, and Sales can access this page
  const role = session.user.role!;
  if (role !== "ADMIN" && role !== "AGENT" && role !== "SALES") {
    notFound();
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      website: {
        include: {
          texterstellung: {
            include: {
              items: {
                include: {
                  versions: {
                    orderBy: { versionNumber: "desc" },
                  },
                },
                orderBy: { menuItemName: "asc" },
              },
            },
          },
          webDocumentation: {
            include: {
              generalTextSubmission: true,
              menuItems: {
                include: {
                  textSubmission: true,
                },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!project) notFound();

  // Check if textit is active
  const hasTextit = project.website?.textit && project.website.textit !== "NEIN";
  if (!hasTextit) {
    // Texterstellung is only available for projects with Textit
    return (
      <div className="p-2 md:p-6 space-y-4 md:space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between px-2 md:px-0">
          <BackButton fallbackUrl={`/projects/${id}`} />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Texterstellung nicht verfügbar
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Dieses Projekt hat keine Texterstellung (Textit) im Umfang.
          </p>
        </div>
      </div>
    );
  }

  const webDoku = project.website?.webDocumentation;
  const texterstellung = project.website?.texterstellung;
  const canEdit = role === "ADMIN" || role === "AGENT";

  // Get all menu items that need texts and have submitted bullet points
  const menuItemsWithBulletPoints = webDoku?.menuItems.filter(
    (m) => m.needsTexts && m.textSubmission?.submittedAt && m.textSubmission?.suitable === true
  ) || [];

  // Check if the general text (Weitere Texte) is ready
  const generalTextReady = webDoku?.materialNotesNeedsTexts &&
    webDoku.generalTextSubmission?.submittedAt &&
    webDoku.generalTextSubmission?.suitable === true;

  // Check if all required bullet points are submitted and approved
  const allBulletPointsReady = menuItemsWithBulletPoints.length > 0 || generalTextReady;

  // Calculate statistics
  const stats = (() => {
    if (!texterstellung) return null;

    let pending = 0;
    let draft = 0;
    let submitted = 0;
    let revisionRequested = 0;
    let approved = 0;

    for (const item of texterstellung.items) {
      switch (item.status) {
        case "PENDING":
          pending++;
          break;
        case "DRAFT":
          draft++;
          break;
        case "SUBMITTED":
          submitted++;
          break;
        case "REVISION_REQUESTED":
          revisionRequested++;
          break;
        case "APPROVED":
          approved++;
          break;
      }
    }

    const total = texterstellung.items.length;
    return { pending, draft, submitted, revisionRequested, approved, total };
  })();

  return (
    <div className="p-2 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between px-2 md:px-0">
        <BackButton fallbackUrl={`/projects/${id}`} />
      </div>

      {/* Page Header */}
      <div className="bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20 rounded-xl md:rounded-2xl border border-cyan-200 dark:border-cyan-700 p-4 md:p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-1">
              Texterstellung
            </h1>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Link
                href={`/projects/${id}`}
                className="font-medium text-cyan-600 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline"
              >
                {getProjectDisplayName(project)}
              </Link>
              <span className="text-gray-400 dark:text-gray-500">•</span>
              <span>{project.client?.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Overview */}
      {texterstellung && stats && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-cyan-600 dark:text-cyan-400"
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
                Fortschritt: Texterstellung
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {stats.approved} von {stats.total} Texte fertig geschrieben
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
            <div className="h-full flex">
              {stats.approved > 0 && (
                <div
                  className="bg-green-500"
                  style={{ width: `${(stats.approved / stats.total) * 100}%` }}
                />
              )}
              {stats.submitted > 0 && (
                <div
                  className="bg-blue-500"
                  style={{ width: `${(stats.submitted / stats.total) * 100}%` }}
                />
              )}
              {stats.revisionRequested > 0 && (
                <div
                  className="bg-amber-500"
                  style={{ width: `${(stats.revisionRequested / stats.total) * 100}%` }}
                />
              )}
              {stats.draft > 0 && (
                <div
                  className="bg-cyan-500"
                  style={{ width: `${(stats.draft / stats.total) * 100}%` }}
                />
              )}
              {stats.pending > 0 && (
                <div
                  className="bg-gray-300 dark:bg-gray-600"
                  style={{ width: `${(stats.pending / stats.total) * 100}%` }}
                />
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-sm">
            {stats.pending > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
                <span className="text-gray-600 dark:text-gray-400">
                  {stats.pending} ausstehend
                </span>
              </div>
            )}
            {stats.draft > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  {stats.draft} in Bearbeitung
                </span>
              </div>
            )}
            {stats.submitted > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  {stats.submitted} liegt Kunde zur Kontrolle vor
                </span>
              </div>
            )}
            {stats.revisionRequested > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-amber-700 dark:text-amber-400 font-medium">
                  {stats.revisionRequested} Korrektur angefordert
                </span>
              </div>
            )}
            {stats.approved > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  {stats.approved} fertig
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      {!texterstellung ? (
        // Texterstellung not started yet
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
          <div className="max-w-xl mx-auto text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Texterstellung starten
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {allBulletPointsReady ? (
                <>
                  Für{" "}
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {menuItemsWithBulletPoints.length + (generalTextReady ? 1 : 0)} {(menuItemsWithBulletPoints.length + (generalTextReady ? 1 : 0)) === 1 ? "Bereich" : "Bereiche"}
                  </span>
                  {" "}wurden vom Kunden Stichpunkte eingereicht und als geeignet markiert.
                  {generalTextReady && <> (inkl. Weitere Texte)</>}
                  <br />
                  Starten Sie die Texterstellung, um diese in vollständige Texte umzuwandeln.
                </>
              ) : (
                <>
                  Die Texterstellung kann gestartet werden, sobald der Kunde für alle erforderlichen
                  Bereiche Stichpunkte eingereicht hat und diese als geeignet markiert wurden.
                  <br /><br />
                  <Link
                    href={`/projects/${id}/material-text`}
                    className="text-cyan-600 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline"
                  >
                    Eingereichte Stichpunkte prüfen →
                  </Link>
                </>
              )}
            </p>
            {canEdit && allBulletPointsReady && (
              <StartTexterstellungButton
                projectId={id}
                menuItems={menuItemsWithBulletPoints.map(m => ({
                  id: m.id,
                  name: m.name,
                  content: m.textSubmission!.content,
                }))}
                generalText={generalTextReady ? {
                  id: webDoku!.generalTextSubmission!.id,
                  name: "Weitere Texte",
                  content: webDoku!.generalTextSubmission!.content,
                } : undefined}
              />
            )}
          </div>
        </div>
      ) : (
        // Texterstellung in progress
        <TexterstellungClient
          texterstellung={texterstellung}
          projectId={id}
          menuItemNotes={Object.fromEntries(
            (webDoku?.menuItems || [])
              .filter(m => m.notes)
              .map(m => [m.id, m.notes!])
          )}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
