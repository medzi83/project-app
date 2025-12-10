import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { BackButton } from "@/components/BackButton";
import TemplateClient from "./TemplateClient";

export default async function OnlineCheckTemplatePage() {
  const session = await requireRole(["ADMIN"]);
  if (!session.user?.id) {
    redirect("/login");
  }

  const templateItems = await prisma.onlineCheckTemplateItem.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackUrl="/admin" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            QM Check Template
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Konfiguriere die QM-Checkliste für die Onlinestellung von Webseiten
          </p>
        </div>
      </div>

      {/* Template Editor */}
      <TemplateClient items={templateItems} />
    </div>
  );
}
