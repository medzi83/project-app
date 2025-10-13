import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { createClient } from "./actions";
import { UnifiedProjectForm } from "./ProjectForm";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type Option = { value: string; label: string };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function NewProjectPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (!["ADMIN", "AGENT"].includes(session.user.role || "")) redirect("/projects");

  const params = await searchParams;
  const clientError = str(params.clientError);
  const projectError = str(params.projectError);
  const clientIdFromQuery = str(params.cid);
  const clientSearch = str(params.clientSearch);

  const [clients, agents, agencies] = await Promise.all([
    prisma.client.findMany({
      where: clientSearch
        ? {
            OR: [
              { name: { contains: clientSearch, mode: "insensitive" } },
              { customerNo: { contains: clientSearch, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "AGENT", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, categories: true, color: true }
    }),
    prisma.agency.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const clientOptions: Option[] = clients.map((c) => ({
    value: c.id,
    label: c.customerNo ? `${c.customerNo} | ${c.name}` : c.name,
  }));

  const websiteAgents = agents.filter(a => a.categories.includes("WEBSEITE"));
  const filmAgents = agents.filter(a => a.categories.includes("FILM"));

  // For website projects: Include WT aliases
  const { expandAgentsWithWTAliases } = await import("@/lib/agent-helpers");
  const websiteAgentsExpanded = expandAgentsWithWTAliases(websiteAgents);

  const websiteAgentOptions: Option[] = [
    { value: "", label: "- kein Agent -" },
    ...websiteAgentsExpanded.map((a) => ({ value: a.id, label: a.name ?? a.email ?? "" })),
  ];

  // For film projects: Only base agents (no WT aliases)
  const filmAgentOptions: Option[] = [
    { value: "", label: "- kein Agent -" },
    ...filmAgents.map((a) => ({ value: a.id, label: a.name ?? a.email ?? "" })),
  ];

  const filmPersonOptions: Option[] = [
    { value: "", label: "- nicht vergeben -" },
    ...filmAgents.map((a) => ({ value: a.id, label: a.name ?? a.email ?? "" })),
  ];


  return (
    <div className="p-6 space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Projekt anlegen</h1>
        <p className="text-sm text-muted-foreground">
          Lege bei Bedarf zuerst einen Kunden an, wähle ihn anschließend aus und erstelle danach das gewünschte Projekt.
        </p>
      </header>

      <details className="rounded-lg border" open={Boolean(clientError)}>
        <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Neuen Kunden anlegen</h2>
            <p className="text-sm text-muted-foreground">
              Bereits vorhandene Kunden findest du weiter unten in der Auswahl.
            </p>
          </div>
          <span className="text-sm text-muted-foreground">optional</span>
        </summary>
        <div className="space-y-4 border-t px-6 py-6">
          {clientError && <p className="text-sm text-red-600">{clientError}</p>}
          <form action={createClient} className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Name *</span>
              <input name="name" required className="rounded border p-2" placeholder="z. B. Muster GmbH" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Kundennummer</span>
              <input name="customerNo" className="rounded border p-2" placeholder="optional" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Ansprechpartner</span>
              <input name="contact" className="rounded border p-2" placeholder="optional" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Telefon</span>
              <input name="phone" className="rounded border p-2" placeholder="optional" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Agentur</span>
              <select name="agencyId" className="rounded border p-2">
                <option value="">Keine Agentur</option>
                {agencies.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Notiz</span>
              <textarea name="notes" rows={3} className="rounded border p-2" placeholder="optional" />
            </label>
            <div className="md:col-span-2 flex items-center justify-end gap-3">
              <button type="submit" className="rounded bg-black px-4 py-2 text-white">Kunde speichern</button>
            </div>
          </form>
        </div>
      </details>

      <section className="rounded-lg border bg-white">
        <div className="border-b px-6 py-5">
          <h2 className="text-lg font-semibold">Projekt erfassen</h2>
          <p className="text-sm text-muted-foreground">
            Kunde auswählen oder suchen und Projekttyp festlegen.
          </p>
        </div>

        <div className="space-y-6 px-6 py-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="client-search" className="text-xs uppercase tracking-wide text-muted-foreground">
                Kunde suchen
              </label>
              <input
                id="client-search"
                name="clientSearch"
                defaultValue={clientSearch ?? ""}
                className="rounded border p-2"
                placeholder="Kundennr. oder Name"
              />
            </div>
            {clientIdFromQuery && <input type="hidden" name="cid" value={clientIdFromQuery} />}
            <button type="submit" className="rounded border px-3 py-2 text-sm">Filtern</button>
            {clientSearch && (
              <Link
                href={`/projects/new?${new URLSearchParams(clientIdFromQuery ? { cid: clientIdFromQuery } : {}).toString()}`}
                className="text-sm underline"
              >
                Zurücksetzen
              </Link>
            )}
          </form>

          {projectError && (
            <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              {projectError}
            </div>
          )}

          <UnifiedProjectForm
            clientOptions={clientOptions}
            websiteAgentOptions={websiteAgentOptions}
            filmAgentOptions={filmAgentOptions}
            personOptions={filmPersonOptions}
            clientIdFromQuery={clientIdFromQuery}
          />
        </div>
      </section>
    </div>
  );
}
