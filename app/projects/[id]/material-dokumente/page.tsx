import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { notFound, redirect } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { getProjectDisplayName } from "@/lib/project-status";
import MaterialDokumenteClient from "./MaterialDokumenteClient";

type Props = { params: Promise<{ id: string }> };

// Mapping von Agentur-Namen zu LuckyCloud-Agency-Keys
function getAgencyKey(agencyName: string): "eventomaxx" | "vendoweb" | null {
  const lowerName = agencyName.toLowerCase().trim();
  if (lowerName.startsWith("eventomaxx")) return "eventomaxx";
  if (lowerName.startsWith("vendoweb")) return "vendoweb";
  return null;
}

export default async function MaterialDokumentePage({ params }: Props) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session) redirect("/login");

  // Only Admins, Agents, and Sales can access this page
  const role = session.user.role!;
  if (role !== "ADMIN" && role !== "AGENT" && role !== "SALES") {
    notFound();
  }

  const canEdit = role === "ADMIN" || role === "AGENT";

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: {
        include: {
          agency: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      website: {
        include: {
          webDocumentation: {
            select: {
              materialLogoNeeded: true,
              materialNotesNeedsImages: true,
              materialNotes: true,
              // Logo Review-Daten
              logoImagesComplete: true,
              logoImagesAgentComment: true,
              logoImagesReviewedAt: true,
              logoImagesReviewedByName: true,
              // General Review-Daten
              generalImagesComplete: true,
              generalImagesAgentComment: true,
              generalImagesReviewedAt: true,
              generalImagesReviewedByName: true,
              menuItems: {
                where: {
                  needsImages: true,
                },
                orderBy: {
                  sortOrder: "asc",
                },
                select: {
                  id: true,
                  name: true,
                  notes: true, // Hinweise zu Menüpunkten (Step 3)
                  materialNotes: true,
                  imagesComplete: true,
                  imagesAgentComment: true,
                  imagesReviewedAt: true,
                  imagesReviewedByName: true,
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

  // Get menu items that need images
  const menuItems = webDoku.menuItems || [];

  // Check if client has LuckyCloud configuration
  const client = project.client;
  const agency = client?.agency ? getAgencyKey(client.agency.name) : null;
  const libraryId = client?.luckyCloudLibraryId;
  const clientFolderPath = client?.luckyCloudFolderPath;
  const projectFolderPath = project.website?.luckyCloudFolderPath;

  // Calculate total images needed
  const totalImagesNeeded = menuItems.length +
    (webDoku.materialLogoNeeded ? 1 : 0) +
    (webDoku.materialNotesNeedsImages ? 1 : 0);

  return (
    <div className="p-2 md:p-6 space-y-4 md:space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-2 md:px-0">
        <BackButton fallbackUrl={`/projects/${id}`} />
      </div>

      {/* Page Header */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl md:rounded-2xl border border-blue-200 dark:border-blue-700 p-4 md:p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
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
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-1">
              Material-Dokumente
            </h1>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Link
                href={`/projects/${id}`}
                className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
              >
                {getProjectDisplayName(project)}
              </Link>
              <span className="text-gray-400 dark:text-gray-500">•</span>
              <span>{project.client?.name}</span>
            </div>
            {totalImagesNeeded > 0 && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {totalImagesNeeded} {totalImagesNeeded === 1 ? "Bereich benötigt" : "Bereiche benötigen"} Bilder
                {webDoku.materialLogoNeeded && " (inkl. Logo)"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* LuckyCloud Configuration Check */}
      {!agency || !libraryId ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-700 p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">LuckyCloud nicht konfiguriert</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Für diesen Kunden ist noch keine LuckyCloud-Zuordnung eingerichtet.
                Bitte zuerst im Kundendetailblatt eine Bibliothek und einen Ordner zuordnen.
              </p>
              <Link
                href={`/clients/${client?.id}`}
                className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Zum Kunden
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      ) : !projectFolderPath ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-700 p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Kein Material-Ordner zugeordnet</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Diesem Projekt ist noch kein Material-Ordner zugeordnet.
                Bitte auf der Projektseite einen Material-Ordner zuweisen.
              </p>
              <Link
                href={`/projects/${id}`}
                className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Zum Projekt
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <MaterialDokumenteClient
          projectId={id}
          agency={agency}
          libraryId={libraryId}
          clientFolderPath={clientFolderPath}
          projectFolderPath={projectFolderPath}
          menuItems={menuItems.map(m => ({
            id: m.id,
            name: m.name,
            notes: m.notes, // Hinweise zu Menüpunkten (Step 3)
            materialNotes: m.materialNotes,
            imagesComplete: m.imagesComplete,
            imagesAgentComment: m.imagesAgentComment,
            imagesReviewedAt: m.imagesReviewedAt?.toISOString() ?? null,
            imagesReviewedByName: m.imagesReviewedByName,
          }))}
          materialLogoNeeded={webDoku.materialLogoNeeded ?? false}
          materialNotesNeedsImages={webDoku.materialNotesNeedsImages ?? false}
          materialNotes={webDoku.materialNotes}
          logoReview={{
            complete: webDoku.logoImagesComplete ?? false,
            comment: webDoku.logoImagesAgentComment,
            reviewedAt: webDoku.logoImagesReviewedAt?.toISOString() ?? null,
            reviewedByName: webDoku.logoImagesReviewedByName,
          }}
          generalReview={{
            complete: webDoku.generalImagesComplete ?? false,
            comment: webDoku.generalImagesAgentComment,
            reviewedAt: webDoku.generalImagesReviewedAt?.toISOString() ?? null,
            reviewedByName: webDoku.generalImagesReviewedByName,
          }}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
