import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";

export default async function SocialProjectsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (!session.user.role || !["ADMIN", "AGENT"].includes(session.user.role)) {
    redirect("/");
  }

  return (
    <div className="w-full space-y-6 py-6 px-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Social Media</h1>
          <p className="text-sm text-muted-foreground">
            0 Projekte gesamt
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-orange-200 bg-white shadow-sm">
        <div className="px-6 py-3 bg-gradient-to-r from-orange-50 to-red-50 border-b border-orange-200 rounded-t-2xl">
          <h2 className="text-sm font-semibold text-orange-900">Übersicht</h2>
        </div>
        <div className="p-6 text-sm text-gray-500">
          <p>Noch keine Inhalte vorhanden.</p>
        </div>
      </section>
    </div>
  );
}


