import { getAuthSession } from "@/lib/authz";

import { redirect } from "next/navigation";
import { getImportResult } from "../../import/store";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

export default async function FilmImportResultPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const sp = await searchParams;
  const imported = Number(str(sp.imported) ?? 0);
  const skipped = Number(str(sp.skipped) ?? 0);
  const err = str(sp.err);
  const rid = str(sp.rid);
  const details = getImportResult(rid);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Filmprojekt-Import-Ergebnis</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-500">Importiert</div>
          <div className="text-2xl font-semibold">{imported}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-500">Übersprungen/Fehler</div>
          <div className="text-2xl font-semibold">{skipped}</div>
        </div>
      </div>
      {details?.createdAgents?.length ? (
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-500 mb-2">Neu angelegte Agenten ({details.createdAgents.length})</div>
          <ul className="text-sm list-disc pl-6 space-y-1">
            {details.createdAgents.map((a, i) => (
              <li key={i}><b>{a.name}</b> — {a.email}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {err ? (
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-500 mb-2">Erste Fehler</div>
          <div className="text-sm whitespace-pre-wrap">{err}</div>
        </div>
      ) : null}
      <a href="/admin/film-import" className="inline-block rounded border px-4 py-2">Zurück zum Import</a>
    </div>
  );
}
