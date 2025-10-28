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

  const [clients, agents, agencies] = await Promise.all([
    prisma.client.findMany({
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
        <h1 className="text-2xl font-semibold">Neues Projekt anlegen</h1>
        <p className="text-sm text-muted-foreground">
          Wähle zunächst, ob du ein Projekt für einen bestehenden Kunden oder einen neuen Kunden anlegen möchtest.
        </p>
      </header>

      <details className="rounded-lg border bg-white" open={Boolean(clientError)}>
        <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
          <div>
            <h2 className="text-lg font-semibold">Neukunde anlegen</h2>
            <p className="text-sm text-muted-foreground">
              Falls der Kunde noch nicht in der Datenbank vorhanden ist, lege ihn hier zuerst an.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground bg-gray-100 px-3 py-1 rounded-full">Optional</span>
          </div>
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
              <span className="text-xs uppercase tracking-wide text-muted-foreground">E-Mail</span>
              <input name="email" type="email" className="rounded border p-2" placeholder="optional" />
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
        <div className="border-b px-6 py-5 bg-gray-50">
          <h2 className="text-lg font-semibold">Projekt für Bestandskunden</h2>
          <p className="text-sm text-muted-foreground">
            Suche einen bestehenden Kunden und lege ein neues Projekt an.
          </p>
        </div>

        <div className="space-y-6 px-6 py-6">
          {projectError && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              <strong>Fehler:</strong> {projectError}
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
