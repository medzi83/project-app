import { prisma } from "@/lib/prisma";
import type { ReactNode } from "react";
import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";
import { createAdmin, resetAdminPassword, toggleAdminActive, updateAdminName } from "./actions";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const fmtDate = (d?: Date | string | null) =>
  d ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d)) : "-";

export default async function AdminManagementPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const sp = await searchParams;
  const showInactive = sp.showInactive === "1";
  const adminError = typeof sp.adminError === "string" ? decodeURIComponent(sp.adminError) : undefined;
  const adminOk = sp.adminOk === "1";
  const pwdError = typeof sp.pwdError === "string" ? decodeURIComponent(sp.pwdError) : undefined;
  const pwdOk = sp.pwdOk === "1";

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", ...(showInactive ? {} : { active: true }) },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Admin-Verwaltung</h1>
          <p className="text-sm text-gray-500">Admins anlegen, bearbeiten oder deaktivieren.</p>
        </div>
      </header>

      <section className="p-4 border rounded-lg space-y-4 bg-white">
        <div>
          <h2 className="text-lg font-semibold">Admin anlegen</h2>
          <p className="text-sm text-gray-500">Neuen Administrator mit initialem Passwort erstellen.</p>
        </div>
        {adminError && <p className="text-sm text-red-600">{adminError}</p>}
        {adminOk && <p className="text-sm text-green-700">Admin wurde angelegt.</p>}
        <form action={createAdmin} className="grid gap-4 md:grid-cols-3">
          <Field label="Name">
            <input name="name" className="p-2 border rounded" placeholder="z. B. Alex Admin" />
          </Field>
          <Field label="E-Mail *">
            <input name="email" type="email" required className="p-2 border rounded" placeholder="admin@example.com" />
          </Field>
          <Field label="Initiales Passwort *">
            <input name="password" type="password" required className="p-2 border rounded" placeholder="mind. 8 Zeichen" />
          </Field>
          <div className="md:col-span-3 flex justify-end">
            <button className="px-4 py-2 rounded bg-black text-white">Anlegen</button>
          </div>
        </form>
      </section>

      <section className="p-4 border rounded-lg space-y-4 bg-white">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">Admins</h2>
          <form method="get" className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="showInactive" value="1" defaultChecked={showInactive} />
              Inaktive anzeigen
            </label>
            <button type="submit" className="px-3 py-1 border rounded">Anwenden</button>
          </form>
        </div>
        {pwdError && <p className="text-sm text-red-600">{pwdError}</p>}
        {pwdOk && <p className="text-sm text-green-700">Passwort aktualisiert.</p>}

        <div className="overflow-x-auto rounded border">
          <table className="min-w-[800px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
                <th>Name</th>
                <th>E-Mail</th>
                <th>Status</th>
                <th>Erstellt</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:px-3 [&>tr>td]:py-2">
              {admins.map((admin) => (
                <tr key={admin.id} className={`border-t ${admin.active ? "" : "opacity-60"}`}>
                  <td className="align-top">
                    <form action={updateAdminName} className="flex gap-2 items-center">
                      <input type="hidden" name="userId" value={admin.id} />
                      <input name="name" defaultValue={admin.name ?? ""} className="p-1 border rounded" />
                      {!admin.active && (
                        <span className="text-xs px-2 py-0.5 border rounded">inaktiv</span>
                      )}
                      <button className="px-2 py-1 border rounded" title="Name speichern">Speichern</button>
                    </form>
                  </td>
                  <td className="align-top whitespace-nowrap">{admin.email}</td>
                  <td className="align-top whitespace-nowrap">{admin.active ? "Aktiv" : "Inaktiv"}</td>
                  <td className="align-top whitespace-nowrap">{fmtDate(admin.createdAt)}</td>
                  <td className="align-top whitespace-nowrap space-y-2">
                    <form action={resetAdminPassword} className="flex gap-2 items-center">
                      <input type="hidden" name="userId" value={admin.id} />
                      <input name="newPassword" type="password" placeholder="Neues Passwort" className="p-1 border rounded" />
                      <button className="px-2 py-1 border rounded" title="Passwort setzen">Passwort setzen</button>
                    </form>
                    <form action={toggleAdminActive}>
                      <input type="hidden" name="userId" value={admin.id} />
                      <input type="hidden" name="active" value={admin.active ? "0" : "1"} />
                      <button className="px-2 py-1 border rounded" title={admin.active ? "Deaktivieren" : "Aktivieren"}>
                        {admin.active ? "Deaktivieren" : "Aktivieren"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center opacity-60">Keine Admins gefunden.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}


