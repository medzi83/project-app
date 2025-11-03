import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";
import { createSalesAgent, resetSalesAgentPassword, toggleSalesAgentActive, deleteSalesAgent } from "./actions";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import SalesAgentEditModal from "./SalesAgentEditModal";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const fmtDate = (d?: Date | string | null) =>
  d ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d)) : "-";

export default async function VertriebAdminPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const sp = await searchParams;
  const showInactive = sp.showInactive === "1";
  const error = typeof sp.error === "string" ? decodeURIComponent(sp.error) : undefined;
  const ok = sp.ok === "1";
  const pwdError = typeof sp.pwdError === "string" ? decodeURIComponent(sp.pwdError) : undefined;
  const pwdOk = sp.pwdOk === "1";
  const delOk = sp.delOk === "1";

  const salesAgents = await prisma.user.findMany({
    where: { role: "SALES", ...(showInactive ? {} : { active: true }) },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      fullName: true,
      roleTitle: true,
      email: true,
      active: true,
      createdAt: true,
    },
  });

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Vertrieb-Verwaltung</h1>
          <p className="text-sm text-gray-500">Vertriebsagenten verwalten und Passwoerter setzen.</p>
          {delOk && <p className="text-sm text-green-700">Vertriebsagent wurde geloescht.</p>}
        </div>
        <details className="relative">
          <summary className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-black/90">
            Vertriebsagent anlegen
          </summary>
          <div className="absolute right-0 mt-2 w-[360px] space-y-4 rounded-lg border bg-white p-4 shadow-lg z-10">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {ok && <p className="text-sm text-green-700">Vertriebsagent wurde angelegt.</p>}
            <form action={createSalesAgent} className="space-y-3">
              <Field label="Name (Kurzname)">
                <input name="name" className="w-full rounded border p-2" placeholder="z. B. Max" />
              </Field>
              <Field label="Voller Name">
                <input name="fullName" className="w-full rounded border p-2" placeholder="z. B. Max Mustermann" />
              </Field>
              <Field label="Rollenbezeichnung">
                <input name="roleTitle" className="w-full rounded border p-2" placeholder="z. B. Vertriebsmitarbeiter" />
              </Field>
              <Field label="E-Mail">
                <input name="email" type="email" className="w-full rounded border p-2" placeholder="vertrieb@example.com" />
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
          <h2 className="text-lg font-semibold">Vertriebsagenten</h2>
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
                <th>Voller Name</th>
                <th>Rollenbezeichnung</th>
                <th>E-Mail</th>
                <th>Erstellt</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:px-3 [&>tr>td]:py-2">
              {salesAgents.map((sa) => (
                <tr key={sa.id} className={`border-t ${sa.active ? "" : "opacity-60 bg-gray-50"}`}>
                  <td>
                    <div className="flex items-center gap-2">
                      {sa.name ?? "-"}
                      {!sa.active && <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">inaktiv</span>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">{sa.fullName ?? "-"}</td>
                  <td className="whitespace-nowrap">{sa.roleTitle ?? "-"}</td>
                  <td className="whitespace-nowrap">{sa.email ?? "-"}</td>
                  <td className="whitespace-nowrap">{fmtDate(sa.createdAt)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <SalesAgentEditModal agent={{
                        id: sa.id,
                        name: sa.name,
                        fullName: sa.fullName,
                        roleTitle: sa.roleTitle,
                        email: sa.email,
                      }} />
                      <form action={resetSalesAgentPassword} className="flex items-center gap-1">
                        <input type="hidden" name="userId" value={sa.id} />
                        <input name="newPassword" type="password" placeholder="Neues Passwort" className="rounded border p-1 text-sm w-32" />
                        <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" title="Passwort setzen">🔑</button>
                      </form>
                      <form action={toggleSalesAgentActive}>
                        <input type="hidden" name="userId" value={sa.id} />
                        <input type="hidden" name="active" value={sa.active ? "0" : "1"} />
                        <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" title={sa.active ? "Deaktivieren" : "Aktivieren"}>
                          {sa.active ? "❌" : "✅"}
                        </button>
                      </form>
                      <form action={deleteSalesAgent}>
                        <input type="hidden" name="userId" value={sa.id} />
                        <ConfirmSubmit
                          confirmText="Diesen Vertriebsagent unwiderruflich loeschen?"
                          className="rounded border px-2 py-1 text-xs text-red-700 border-red-300 bg-red-50 hover:bg-red-100"
                          title="Vertriebsagent löschen"
                        >
                          🗑️
                        </ConfirmSubmit>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {salesAgents.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center opacity-60">Keine Vertriebsagenten vorhanden.</td></tr>
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
