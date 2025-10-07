import { getAuthSession } from "@/lib/authz";

import { redirect } from "next/navigation";
import { importFilmProjects } from "./actions";
import { prisma } from "@/lib/prisma";

export default async function FilmImportAdminPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const totalClients = await prisma.client.count();
  const totalFilmProjects = await prisma.projectFilm.count();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Filmprojekt-Import</h1>
        <p className="text-sm text-gray-500">
          CSV/TSV mit folgenden Spalten hochladen: Kundennummer, Name/Firma, Umfang, Prio / Nur Film, Verantwortl. Filmer, Cutter, 8. Vetragsbeginn, 7. Scouting, 6. Skript an Kunden, 5. Skriptfreigabe, 4. Drehtermin/Fototermin, 3. Vorabversion an Kunden, 2. Finalversion an Kunden, 1. Online, letzter Kontakt, Status, Wiedervorlage am, Hinweis.
        </p>
      </div>

      <Stats totalClients={totalClients} totalProjects={totalFilmProjects} />

      <section className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Datei hochladen</h2>
        <p className="text-sm text-gray-500 mb-3">Erlaubt: .csv oder .tsv. Trennzeichen ; , oder Tab. Datumsformate: dd.mm.yyyy (optional hh:mm) oder ISO.</p>
        <form action={async (formData) => {
          'use server';
          const res = await importFilmProjects(formData);
          const params = new URLSearchParams();
          params.set('imported', String(res.imported));
          params.set('skipped', String(res.skipped));
          if (res.resultId) params.set('rid', res.resultId);
          if (res.errors.length) {
            // packe die ersten 5 Fehler in die URL
            params.set('err', res.errors.slice(0,5).map(e=>`#${e.row} ${e.reason}`).join(' | '));
          }
          redirect(`/admin/film-import/result?${params.toString()}`);
        }} className="space-y-3">
          <input required type="file" name="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" className="block w-full rounded border p-2" />
          <button className="rounded bg-black px-4 py-2 text-white">Import starten</button>
        </form>
      </section>
    </div>
  );
}

function Stats({ totalClients, totalProjects }: { totalClients: number; totalProjects: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="rounded-lg border p-4">
        <div className="text-sm text-gray-500">Kunden</div>
        <div className="text-2xl font-semibold">{totalClients}</div>
      </div>
      <div className="rounded-lg border p-4">
        <div className="text-sm text-gray-500">Filmprojekte</div>
        <div className="text-2xl font-semibold">{totalProjects}</div>
      </div>
    </div>
  );
}
