import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";

export default async function SocialProjectsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (!session.user.role || !["ADMIN", "AGENT"].includes(session.user.role)) {
    redirect("/");
  }

  return (
    <div className="p-6 space-y-6">
      {/* Modern Header */}
      <div className="rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Social Media Projekte</h1>
            <p className="text-green-100 text-sm mt-1">Platzhalterseite für Social Media Kampagnen und Inhalte</p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-green-200 bg-white shadow-sm">
        <div className="px-6 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200 rounded-t-2xl">
          <h2 className="text-sm font-semibold text-green-900">Übersicht</h2>
        </div>
        <div className="p-6 text-sm text-gray-500">
          <p>Noch keine Inhalte vorhanden.</p>
        </div>
      </section>
    </div>
  );
}


