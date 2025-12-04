import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { updateFilmProject } from "./actions";
import DeleteVersionButton from "./DeleteVersionButton";
import { BackButton } from "@/components/BackButton";

type Props = {
  params: Promise<{ id: string }>;
};

const formatDate = (value?: Date | string | null) => {
  if (!value) return "";
  try {
    const date = new Date(value);
    return date.toISOString().slice(0, 10);
  } catch {
    return "";
  }
};

const SCOPE_OPTIONS = [
  { value: "FILM", label: "Film" },
  { value: "DROHNE", label: "Drohne" },
  { value: "NACHDREH", label: "Nachdreh" },
  { value: "FILM_UND_DROHNE", label: "Film + Drohne" },
  { value: "FOTO", label: "Foto" },
  { value: "GRAD_360", label: "360°" },
];

const PRIORITY_OPTIONS = [
  { value: "NONE", label: "Keine" },
  { value: "FILM_SOLO", label: "Film solo" },
  { value: "PRIO_1", label: "Prio 1" },
  { value: "PRIO_2", label: "Prio 2" },
];

const STATUS_OPTIONS = [
  { value: "", label: "- keine Auswahl -" },
  { value: "AKTIV", label: "Aktiv" },
  { value: "BEENDET", label: "Beendet" },
  { value: "WARTEN", label: "Warten" },
  { value: "VERZICHT", label: "Verzicht" },
  { value: "MMW", label: "MMW" },
];

export default async function EditFilmProjectPage({ params }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const { id } = await params;

  const [project, filmAgents] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        film: {
          include: {
            filmer: true,
            cutter: true,
            previewVersions: {
              orderBy: { version: "desc" },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: "AGENT", active: true, categories: { has: "FILM" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  if (!project || !project.film) {
    notFound();
  }

  const film = project.film;

  const agentOptions = [
    { value: "", label: "- nicht vergeben -" },
    ...filmAgents.map((a) => ({ value: a.id, label: a.name ?? a.email ?? "" })),
  ];

  return (
    <div className="space-y-6">
      <header>
        <BackButton fallbackUrl={`/film-projects/${project.id}`} />
        <h1 className="text-2xl font-semibold mt-2">Filmprojekt bearbeiten</h1>
        <p className="text-sm text-gray-500">{project.title || project.client?.name}</p>
      </header>

      <section className="rounded-lg border bg-white p-6">
        <form action={updateFilmProject} className="space-y-6">
          <input type="hidden" name="projectId" value={project.id} />

          <h3 className="text-base font-semibold border-b pb-2">Projekt-Informationen</h3>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">Umfang</label>
              <select
                name="scope"
                defaultValue={film.scope || "FILM"}
                className="w-full rounded border p-2"
              >
                {SCOPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Priorität</label>
              <select
                name="priority"
                defaultValue={film.priority || "NONE"}
                className="w-full rounded border p-2"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">P-Status</label>
              <select
                name="status"
                defaultValue={film.status || ""}
                className="w-full rounded border p-2"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Verantwortlicher Filmer</label>
              <select
                name="filmerId"
                defaultValue={film.filmerId || ""}
                className="w-full rounded border p-2"
              >
                {agentOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Cutter</label>
              <select
                name="cutterId"
                defaultValue={film.cutterId || ""}
                className="w-full rounded border p-2"
              >
                {agentOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Wiedervorlage am</label>
              <input
                type="date"
                name="reminderAt"
                defaultValue={formatDate(film.reminderAt)}
                className="w-full rounded border p-2"
              />
            </div>
          </div>

          <h3 className="text-base font-semibold border-b pb-2 mt-6">Zeitplan & Termine</h3>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium mb-1">Vertragsbeginn</label>
              <input
                type="date"
                name="contractStart"
                defaultValue={formatDate(film.contractStart)}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Scouting</label>
              <input
                type="date"
                name="scouting"
                defaultValue={formatDate(film.scouting)}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Skript an Kunden</label>
              <input
                type="date"
                name="scriptToClient"
                defaultValue={formatDate(film.scriptToClient)}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Skriptfreigabe</label>
              <input
                type="date"
                name="scriptApproved"
                defaultValue={formatDate(film.scriptApproved)}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Dreh-/Fototermin</label>
              <input
                type="date"
                name="shootDate"
                defaultValue={formatDate(film.shootDate)}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Erste Vorabversion (Legacy)</label>
              <input
                type="date"
                name="firstCutToClient"
                defaultValue={formatDate(
                  film.previewVersions.find((v) => v.version === 1)?.sentDate || film.firstCutToClient
                )}
                className="w-full rounded border p-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                {film.previewVersions.find((v) => v.version === 1)
                  ? "Wird automatisch von v1 übernommen"
                  : "Nur für alte Einträge, neue Versionen unten hinzufügen"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Finalversion an Kunden</label>
              <input
                type="date"
                name="finalToClient"
                defaultValue={formatDate(film.finalToClient)}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Finalversion-Link</label>
              <input
                type="url"
                name="finalLink"
                defaultValue={film.finalLink ?? ""}
                placeholder="https://domain.tld/film"
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Online</label>
              <input
                type="date"
                name="onlineDate"
                defaultValue={formatDate(film.onlineDate)}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Hauptlink (Online)</label>
              <input
                type="url"
                name="onlineLink"
                defaultValue={film.onlineLink ?? ""}
                placeholder="https://domain.tld/live"
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Letzter Kontakt</label>
              <input
                type="date"
                name="lastContact"
                defaultValue={formatDate(film.lastContact)}
                className="w-full rounded border p-2"
              />
            </div>
          </div>

          <h3 className="text-base font-semibold border-b pb-2 mt-6">Vorabversionen verwalten</h3>

          <div className="rounded border bg-gray-50 p-4">
            <p className="text-sm text-gray-600 mb-4">
              Hier können Sie bestehende Vorabversionen bearbeiten oder löschen. Neue Versionen können Sie direkt in der Filmliste hinzufügen.
            </p>

            {film.previewVersions.length === 0 ? (
              <p className="text-sm text-gray-500">Noch keine Vorabversionen vorhanden.</p>
            ) : (
              <div className="space-y-3">
                {film.previewVersions.map((version) => (
                  <div key={version.id} className="flex items-center gap-3 p-3 rounded border bg-white">
                    <span className="font-mono text-sm font-medium">v{version.version}</span>
                    <span className="text-sm">{formatDate(version.sentDate)}</span>
                    {version.link && (
                      <a
                        href={version.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Link →
                      </a>
                    )}
                    <div className="ml-auto">
                      <DeleteVersionButton
                        versionId={version.id}
                        projectId={project.id}
                        version={version.version}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Hinweis</label>
            <textarea
              name="note"
              defaultValue={film.note || ""}
              rows={4}
              className="w-full rounded border p-2"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded bg-black px-6 py-2 text-white hover:bg-gray-800"
            >
              Speichern
            </button>
            <Link
              href={`/film-projects/${project.id}`}
              className="rounded border px-6 py-2 hover:bg-gray-50"
            >
              Abbrechen
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
