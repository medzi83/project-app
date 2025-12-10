import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { notFound, redirect } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import ChecklistClient from "./ChecklistClient";
import { getOrCreateOnlineCheck } from "./actions";

type Props = { params: Promise<{ id: string }> };

export default async function OnlineCheckPage({ params }: Props) {
  const { id } = await params;
  const session = await requireRole(["ADMIN", "AGENT"]);
  if (!session) redirect("/login");

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      website: {
        include: {
          onlineCheck: {
            include: {
              items: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!project) notFound();
  if (!project.website) notFound();

  // Nur sichtbar wenn Demo freigegeben wurde
  if (!project.website.demoApprovedAt) {
    redirect(`/projects/${id}`);
  }

  const website = project.website;

  // Online-Check holen oder erstellen (mit Template-Items Kopie)
  const onlineCheck = await getOrCreateOnlineCheck(id);

  return (
    <div className="p-2 md:p-6 space-y-4 md:space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 px-2 md:px-0">
        <BackButton fallbackUrl={`/projects/${id}`} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">QM Check</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {project.client?.name} - {website.domain || project.title}
          </p>
        </div>
      </div>

      {/* Checklist */}
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Checkliste für die Onlinestellung
        </h2>
        <ChecklistClient onlineCheck={onlineCheck} projectId={id} />
      </div>
    </div>
  );
}
