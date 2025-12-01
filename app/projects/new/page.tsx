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
      include: {
        agency: {
          select: { id: true, name: true },
        },
      },
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

  // Prepare client data with LuckyCloud info for the form
  const clientsData = clients.map((c) => ({
    id: c.id,
    name: c.name,
    customerNo: c.customerNo,
    luckyCloudLibraryId: c.luckyCloudLibraryId,
    luckyCloudLibraryName: c.luckyCloudLibraryName,
    luckyCloudFolderPath: c.luckyCloudFolderPath,
    agency: c.agency,
  }));

  const websiteAgents = agents.filter(a => a.categories.includes("WEBSEITE"));
  const filmAgents = agents.filter(a => a.categories.includes("FILM"));
  const printDesignAgents = agents.filter(a => a.categories.includes("PRINT_DESIGN"));

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

  // For print design projects: Only base agents
  const printDesignAgentOptions: Option[] = [
    { value: "", label: "- kein Agent -" },
    ...printDesignAgents.map((a) => ({ value: a.id, label: a.name ?? a.email ?? "" })),
  ];


  return (
    <div className="p-6 space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Neues Projekt anlegen</h1>
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          Wähle zunächst, ob du ein Projekt für einen bestehenden Kunden oder einen neuen Kunden anlegen möchtest.
        </p>
      </header>

      <details className="rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700" open={Boolean(clientError)}>
        <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Neukunde anlegen</h2>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Falls der Kunde noch nicht in der Datenbank vorhanden ist, lege ihn hier zuerst an.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">Optional</span>
          </div>
        </summary>
        <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 px-6 py-6">
          {clientError && <p className="text-sm text-red-600 dark:text-red-400">{clientError}</p>}
          <form action={createClient} className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Name *</span>
              <input name="name" required className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" placeholder="z. B. Muster GmbH" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Kundennummer *</span>
              <input name="customerNo" required className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" placeholder="z. B. M12345" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Anrede</span>
              <select name="salutation" className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                <option value="">-- Bitte wählen --</option>
                <option value="Herr">Herr</option>
                <option value="Frau">Frau</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Vorname</span>
              <input name="firstname" className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" placeholder="optional" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Nachname</span>
              <input name="lastname" className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" placeholder="optional" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">E-Mail</span>
              <input name="email" type="email" className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" placeholder="optional" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Telefon</span>
              <input name="phone" className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" placeholder="optional" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Agentur</span>
              <select name="agencyId" className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                <option value="">Keine Agentur</option>
                {agencies.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground dark:text-gray-400">Notiz</span>
              <textarea name="notes" rows={3} className="rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" placeholder="optional" />
            </label>
            <div className="md:col-span-2 flex items-center justify-end gap-3">
              <button type="submit" className="rounded bg-black dark:bg-blue-600 px-4 py-2 text-white hover:bg-gray-800 dark:hover:bg-blue-700">Kunde speichern</button>
            </div>
          </form>
        </div>
      </details>

      <section className="rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-5 bg-gray-50 dark:bg-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Projekt für Bestandskunden</h2>
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            Suche einen bestehenden Kunden und lege ein neues Projekt an.
          </p>
        </div>

        <div className="space-y-6 px-6 py-6">
          {projectError && (
            <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              <strong>Fehler:</strong> {projectError}
            </div>
          )}

          <UnifiedProjectForm
            clientOptions={clientOptions}
            clientsData={clientsData}
            websiteAgentOptions={websiteAgentOptions}
            filmAgentOptions={filmAgentOptions}
            printDesignAgentOptions={printDesignAgentOptions}
            clientIdFromQuery={clientIdFromQuery}
          />
        </div>
      </section>
    </div>
  );
}
