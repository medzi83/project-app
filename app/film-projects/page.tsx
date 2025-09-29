import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function FilmProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!session.user.role || !["ADMIN", "AGENT"].includes(session.user.role)) {
    redirect("/");
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Filmprojekte</h1>
          <p className="text-sm text-gray-500">Diese Seite ist vorbereitet und wird demnächst mit Inhalten gefüllt.</p>
        </div>
      </header>
      <section className="rounded-lg border bg-white p-6 text-sm text-gray-500">
        <p>Noch keine Inhalte vorhanden.</p>
      </section>
    </div>
  );
}


