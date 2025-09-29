import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { createAgent, resetAgentPassword, updateAgentName, toggleAgentActive } from "../agents/actions";
import AgentColorForm from "./AgentColorForm";


type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const fmtDate = (d?: Date | string | null) =>
  d ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d)) : "-";

export default async function AgentsAdminPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const sp = await searchParams;
  const showInactive = sp.showInactive === "1";
  const agentError = typeof sp.agentError === "string" ? decodeURIComponent(sp.agentError) : undefined;
  const agentOk = sp.agentOk === "1";
  const pwdError = typeof sp.pwdError === "string" ? decodeURIComponent(sp.pwdError) : undefined;
  const pwdOk = sp.pwdOk === "1";

  const agents = await prisma.user.findMany({
    where: { role: "AGENT", ...(showInactive ? {} : { active: true }) },
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: true } } },
  });


  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Agenten-Verwaltung</h1>
          <p className="text-sm text-gray-500">Agenten verwalten, Passwörter setzen und Farben vergeben.</p>
        </div>
        <details className="relative">
          <summary className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-black/90">
            Agent anlegen
          </summary>
          <div className="absolute right-0 mt-2 w-[360px] space-y-4 rounded-lg border bg-white p-4 shadow-lg">
            {agentError && <p className="text-sm text-red-600">{agentError}</p>}
            {agentOk && <p className="text-sm text-green-700">Agent wurde angelegt.</p>}
            <form action={createAgent} className="space-y-3">
              <Field label="Name">
                <input name="name" className="w-full rounded border p-2" placeholder="z. B. Anna Agent" />
              </Field>
              <Field label="E-Mail">
                <input name="email" type="email" className="w-full rounded border p-2" placeholder="agent@example.com" />
              </Field>
              <Field label="Initiales Passwort *">
                <input name="password" type="password" required className="w-full rounded border p-2" placeholder="min. 8 Zeichen" />
              </Field>
              <button className="w-full rounded bg-black px-4 py-2 text-white">Anlegen</button>
            </form>
          </div>
        </details>
      </div>

      <section className="space-y-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Agenten</h2>
          <form method="get" className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="showInactive" value="1" defaultChecked={showInactive} />
              Inaktive anzeigen
            </label>
            <button className="rounded border px-3 py-1" type="submit">Anwenden</button>
          </form>
        </div>

        {pwdError && <p className="text-sm text-red-600">{pwdError}</p>}
        {pwdOk && <p className="text-sm text-green-700">Passwort aktualisiert.</p>}

        <div className="overflow-x-auto rounded border">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
                <th>Name</th>
                <th>Farbe</th>
                <th>E-Mail</th>
                <th>Projekte</th>
                <th>Erstellt</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:px-3 [&>tr>td]:py-2">
              {agents.map((a) => (
                <tr key={a.id} className={`border-t ${a.active ? "" : "opacity-60"}`}>
                  <td>
                    <form action={updateAgentName} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={a.id} />
                      <input name="name" defaultValue={a.name ?? ""} className="rounded border p-1" />
                      {!a.active && <span className="rounded border px-2 py-0.5 text-xs">inaktiv</span>}
                      <button className="rounded border px-2 py-1" title="Name speichern">Speichern</button>
                    </form>
                  </td>
                  <td>
                    <AgentColorForm userId={a.id} color={a.color} />
                  </td>
                  <td className="whitespace-nowrap">{a.email ?? "-"}</td>
                  <td>{a._count.projects}</td>
                  <td className="whitespace-nowrap">{fmtDate(a.createdAt)}</td>
                  <td className="space-y-2 whitespace-nowrap">
                    <form action={resetAgentPassword} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={a.id} />
                      <input name="newPassword" type="password" placeholder="Neues Passwort" className="rounded border p-1" />
                      <button className="rounded border px-2 py-1" title="Passwort setzen">Passwort setzen</button>
                    </form>
                    <form action={toggleAgentActive}>
                      <input type="hidden" name="userId" value={a.id} />
                      <input type="hidden" name="active" value={a.active ? "0" : "1"} />
                      <button className="rounded border px-2 py-1" title={a.active ? "Deaktivieren" : "Aktivieren"}>
                        {a.active ? "Deaktivieren" : "Aktivieren"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center opacity-60">Keine Agenten vorhanden.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

