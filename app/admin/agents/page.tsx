import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { createAgent, resetAgentPassword, updateAgentName, toggleAgentActive } from "../agents/actions";


type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const fmtDate = (d?: Date | string | null) =>
  d ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d)) : "-";

export default async function AdminPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const sp = await searchParams;
  const showInactive = sp.showInactive === "1";
  const agentError = typeof sp.agentError === "string" ? decodeURIComponent(sp.agentError) : undefined;
  const agentOk = sp.agentOk === "1";
  const pwdError = typeof sp.pwdError === "string" ? decodeURIComponent(sp.pwdError) : undefined;
  const pwdOk = sp.pwdOk === "1";

  const [counts, agents] = await Promise.all([
  prisma.$transaction(async (tx) => {
    const [clients, projects, users] = await Promise.all([
      tx.client.count(),
      tx.project.count(),
      tx.user.count(),
    ]);
    return { clients, projects, users };
  }),
  prisma.user.findMany({
    where: { role: "AGENT", ...(showInactive ? {} : { active: true }) },
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: true } } },
  }),
]);


  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Admin-Dashboard</h1>

      {/* KPIs */}
      <section className="grid md:grid-cols-3 gap-4">
        <Kpi label="Kunden" value={counts.clients} />
        <Kpi label="Projekte" value={counts.projects} />
        <Kpi label="Benutzer (alle Rollen)" value={counts.users} />
      </section>

      {/* Agent anlegen */}
      <section className="p-4 border rounded-lg space-y-4">
        <h2 className="text-lg font-semibold">Agent anlegen</h2>
        {agentError && <p className="text-sm text-red-600">{agentError}</p>}
        {agentOk && <p className="text-sm text-green-700">Agent wurde angelegt.</p>}

        <form action={createAgent} className="grid md:grid-cols-3 gap-4">
          <Field label="Name">
            <input name="name" className="p-2 border rounded" placeholder="z. B. Anna Agent" />
          </Field>
          <Field label="E-Mail *">
            <input name="email" type="email" required className="p-2 border rounded" placeholder="agent@example.com" />
          </Field>
          <Field label="Initiales Passwort *">
            <input name="password" type="password" required className="p-2 border rounded" placeholder="min. 8 Zeichen" />
          </Field>
          <div className="md:col-span-3">
            <button className="px-4 py-2 rounded bg-black text-white">Anlegen</button>
          </div>
        </form>
      </section>

      {/* Agentenliste */}
      <section className="p-4 border rounded-lg space-y-4">
        <h2 className="text-lg font-semibold">Agenten</h2>
        <form method="get" className="mb-3 flex items-center gap-3">
  <label className="flex items-center gap-2 text-sm">
    <input type="checkbox" name="showInactive" value="1" defaultChecked={showInactive} />
    Inaktive anzeigen
  </label>
  <button className="px-3 py-1 border rounded" type="submit">Anwenden</button>
</form>

        {pwdError && <p className="text-sm text-red-600">{pwdError}</p>}
        {pwdOk && <p className="text-sm text-green-700">Passwort aktualisiert.</p>}

        <div className="overflow-x-auto rounded border">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
                <th>Name</th>
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
        <form action={updateAgentName} className="flex gap-2 items-center">
          <input type="hidden" name="userId" value={a.id} />
          <input name="name" defaultValue={a.name ?? ""} className="p-1 border rounded" />
          {!a.active && <span className="text-xs px-2 py-0.5 border rounded">inaktiv</span>}
          <button className="px-2 py-1 border rounded" title="Name speichern">Speichern</button>
        </form>
      </td>
      <td className="whitespace-nowrap">{a.email}</td>
      <td>{a._count.projects}</td>
      <td className="whitespace-nowrap">
        {fmtDate(a.createdAt)}
      </td>
      <td className="whitespace-nowrap">
        <form action={resetAgentPassword} className="inline-flex gap-2 items-center mr-3">
          <input type="hidden" name="userId" value={a.id} />
          <input name="newPassword" type="password" placeholder="Neues Passwort" className="p-1 border rounded" />
          <button className="px-2 py-1 border rounded" title="Passwort setzen">Passwort setzen</button>
        </form>

        <form action={toggleAgentActive} className="inline">
          <input type="hidden" name="userId" value={a.id} />
          <input type="hidden" name="active" value={a.active ? "0" : "1"} />
          <button className="px-2 py-1 border rounded" title={a.active ? "Deaktivieren" : "Aktivieren"}>
            {a.active ? "Deaktivieren" : "Aktivieren"}
          </button>
        </form>
      </td>
    </tr>
  ))}
  {agents.length === 0 && (
    <tr><td colSpan={5} className="py-8 text-center opacity-60">Keine Agenten vorhanden.</td></tr>
  )}
</tbody>

          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="p-4 border rounded-lg">
      <div className="text-xs opacity-60">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs opacity-60">{label}</span>
      {children}
    </label>
  );
}

