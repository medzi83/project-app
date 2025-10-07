import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";

export default async function SocialProjectsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (!session.user.role || !["ADMIN", "AGENT"].includes(session.user.role)) {
    redirect("/");
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">SocialMedia-Projekte</h1>
          <p className="text-sm text-gray-500">Platzhalterseite für Social Media Kampagnen und Inhalte.</p>
        </div>
      </header>
      <section className="rounded-lg border bg-white p-6 text-sm text-gray-500">
        <p>Noch keine Inhalte vorhanden.</p>
      </section>
    </div>
  );
}


