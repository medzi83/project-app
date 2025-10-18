import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";
import { createAgent, resetAgentPassword, toggleAgentActive, deleteAgent } from "../agents/actions";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import AgentColorForm from "./AgentColorForm";
import AgentEditModal from "./AgentEditModal";


type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const fmtDate = (d?: Date | string | null) =>
  d ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d)) : "-";

export default async function AgentsAdminPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const sp = await searchParams;
  const showInactive = sp.showInactive === "1";
  const agentError = typeof sp.agentError === "string" ? decodeURIComponent(sp.agentError) : undefined;
  const agentOk = sp.agentOk === "1";
  const pwdError = typeof sp.pwdError === "string" ? decodeURIComponent(sp.pwdError) : undefined;
  const pwdOk = sp.pwdOk === "1";
  const delOk = sp.delOk === "1";

  const agents = await prisma.user.findMany({
    where: { role: "AGENT", ...(showInactive ? {} : { active: true }) },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      fullName: true,
      roleTitle: true,
      email: true,
      active: true,
      color: true,
      createdAt: true,
      categories: true,
      _count: {
        select: {
          projects: true,
          filmProjectsResponsible: true,
          filmProjectsCutting: true,
        }
      },
    },
  });


  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Agenten-Verwaltung</h1>
          <p className="text-sm text-gray-500">Agenten verwalten, Passwoerter setzen und Farben vergeben.</p>
          {delOk && <p className="text-sm text-green-700">Agent wurde geloescht.</p>}
        </div>
        <details className="relative">
          <summary className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-black/90">
            Agent anlegen
          </summary>
          <div className="absolute right-0 mt-2 w-[360px] space-y-4 rounded-lg border bg-white p-4 shadow-lg">
            {agentError && <p className="text-sm text-red-600">{agentError}</p>}
            {agentOk && <p className="text-sm text-green-700">Agent wurde angelegt.</p>}
            <form action={createAgent} className="space-y-3">
              <Field label="Name (Kurzname)">
                <input name="name" className="w-full rounded border p-2" placeholder="z. B. Anna" />
              </Field>
              <Field label="Voller Name">
                <input name="fullName" className="w-full rounded border p-2" placeholder="z. B. Anna Agent" />
              </Field>
              <Field label="Rollenbezeichnung">
                <input name="roleTitle" className="w-full rounded border p-2" placeholder="z. B. Projektmanagerin" />
              </Field>
              <Field label="E-Mail">
                <input name="email" type="email" className="w-full rounded border p-2" placeholder="agent@example.com" />
              </Field>
              <Field label="Initiales Passwort *">
                <input name="password" type="password" required className="w-full rounded border p-2" placeholder="min. 8 Zeichen" />
              </Field>
              <Field label="Kategorien">
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="categories" value="WEBSEITE" className="rounded" />
                    <span>Webseite</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="categories" value="FILM" className="rounded" />
                    <span>Film</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="categories" value="SOCIALMEDIA" className="rounded" />
                    <span>Social Media</span>
                  </label>
                </div>
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
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
                <th>Name</th>
                <th>E-Mail</th>
                <th>Farbe</th>
                <th>Projekte</th>
                <th>Erstellt</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:px-3 [&>tr>td]:py-2">
              {agents.map((a) => (
                <tr key={a.id} className={`border-t ${a.active ? "" : "opacity-60 bg-gray-50"}`}>
                  <td>
                    <div className="flex items-center gap-2">
                      {a.name ?? "-"}
                      {!a.active && <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">inaktiv</span>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">{a.email ?? "-"}</td>
                  <td>
                    <AgentColorForm userId={a.id} color={a.color} />
                  </td>
                  <td>{a._count.projects + a._count.filmProjectsResponsible + a._count.filmProjectsCutting}</td>
                  <td className="whitespace-nowrap">{fmtDate(a.createdAt)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <AgentEditModal agent={{
                        id: a.id,
                        name: a.name,
                        fullName: a.fullName,
                        roleTitle: a.roleTitle,
                        email: a.email,
                        categories: a.categories,
                      }} />
                      <form action={resetAgentPassword} className="flex items-center gap-1">
                        <input type="hidden" name="userId" value={a.id} />
                        <input name="newPassword" type="password" placeholder="Neues Passwort" className="rounded border p-1 text-sm w-32" />
                        <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" title="Passwort setzen">🔑</button>
                      </form>
                      <form action={toggleAgentActive}>
                        <input type="hidden" name="userId" value={a.id} />
                        <input type="hidden" name="active" value={a.active ? "0" : "1"} />
                        <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" title={a.active ? "Deaktivieren" : "Aktivieren"}>
                          {a.active ? "❌" : "✅"}
                        </button>
                      </form>
                      <form action={deleteAgent}>
                        <input type="hidden" name="userId" value={a.id} />
                        <ConfirmSubmit
                          confirmText="Diesen Agent unwiderruflich loeschen? Zugeordnete Projekte werden vom Agent geloest."
                          className="rounded border px-2 py-1 text-xs text-red-700 border-red-300 bg-red-50 hover:bg-red-100"
                          title="Agent löschen"
                        >
                          🗑️
                        </ConfirmSubmit>
                      </form>
                    </div>
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














