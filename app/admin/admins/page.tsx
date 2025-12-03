import { prisma } from "@/lib/prisma";
import type { ReactNode } from "react";
import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";
import { createAdmin, resetAdminPassword, toggleAdminActive, updateAdminDetails } from "./actions";

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
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Admin-Verwaltung</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Admins anlegen, bearbeiten oder deaktivieren.</p>
        </div>
      </header>

      <section className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4 bg-white dark:bg-gray-800">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Admin anlegen</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Neuen Administrator mit initialem Passwort erstellen.</p>
        </div>
        {adminError && <p className="text-sm text-red-600 dark:text-red-400">{adminError}</p>}
        {adminOk && <p className="text-sm text-green-700 dark:text-green-400">Admin wurde angelegt.</p>}
        <form action={createAdmin} className="grid gap-4 md:grid-cols-3">
          <Field label="Kurzname">
            <input name="name" className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="z. B. Alex" />
          </Field>
          <Field label="Voller Name">
            <input name="fullName" className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="z. B. Alexander Admin" />
          </Field>
          <Field label="Rollenbezeichnung">
            <input name="roleTitle" className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="z. B. Administrator" />
          </Field>
          <Field label="E-Mail *">
            <input name="email" type="email" required className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="admin@example.com" />
          </Field>
          <Field label="Initiales Passwort *">
            <input name="password" type="password" required className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="mind. 8 Zeichen" />
          </Field>
          <div className="md:col-span-3 flex justify-end">
            <button className="px-4 py-2 rounded bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200">Anlegen</button>
          </div>
        </form>
      </section>

      <section className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4 bg-white dark:bg-gray-800">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Admins</h2>
          <form method="get" className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <input type="checkbox" name="showInactive" value="1" defaultChecked={showInactive} className="rounded border-gray-300 dark:border-gray-600" />
              Inaktive anzeigen
            </label>
            <button type="submit" className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Anwenden</button>
          </form>
        </div>
        {pwdError && <p className="text-sm text-red-600 dark:text-red-400">{pwdError}</p>}
        {pwdOk && <p className="text-sm text-green-700 dark:text-green-400">Passwort aktualisiert.</p>}

        <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
          <table className="min-w-[1000px] w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-gray-700 dark:text-gray-300">
                <th>Kurzname</th>
                <th>Voller Name</th>
                <th>Rollenbezeichnung</th>
                <th>E-Mail</th>
                <th>Status</th>
                <th>Erstellt</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:px-3 [&>tr>td]:py-2 text-gray-900 dark:text-gray-100">
              {admins.map((admin) => (
                <tr key={admin.id} className={`border-t border-gray-200 dark:border-gray-700 ${admin.active ? "" : "opacity-60"}`}>
                  <td className="align-top" colSpan={3}>
                    <form action={updateAdminDetails} className="grid grid-cols-3 gap-2">
                      <input type="hidden" name="userId" value={admin.id} />
                      <div className="flex flex-col gap-1">
                        <input
                          name="name"
                          defaultValue={admin.name ?? ""}
                          className="p-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="Kurzname"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <input
                          name="fullName"
                          defaultValue={admin.fullName ?? ""}
                          className="p-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="Voller Name"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <input
                          name="roleTitle"
                          defaultValue={admin.roleTitle ?? ""}
                          className="p-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="Rolle"
                        />
                      </div>
                      <div className="col-span-3 flex items-center gap-2">
                        {!admin.active && (
                          <span className="text-xs px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400">inaktiv</span>
                        )}
                        <button className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" title="Details speichern">Speichern</button>
                      </div>
                    </form>
                  </td>
                  <td className="align-top whitespace-nowrap">{admin.email}</td>
                  <td className="align-top whitespace-nowrap">{admin.active ? "Aktiv" : "Inaktiv"}</td>
                  <td className="align-top whitespace-nowrap">{fmtDate(admin.createdAt)}</td>
                  <td className="align-top whitespace-nowrap space-y-2">
                    <form action={resetAdminPassword} className="flex gap-2 items-center">
                      <input type="hidden" name="userId" value={admin.id} />
                      <input name="newPassword" type="password" placeholder="Neues Passwort" className="p-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                      <button className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" title="Passwort setzen">Passwort setzen</button>
                    </form>
                    <form action={toggleAdminActive}>
                      <input type="hidden" name="userId" value={admin.id} />
                      <input type="hidden" name="active" value={admin.active ? "0" : "1"} />
                      <button className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" title={admin.active ? "Deaktivieren" : "Aktivieren"}>
                        {admin.active ? "Deaktivieren" : "Aktivieren"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500 dark:text-gray-400">Keine Admins gefunden.</td>
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
      <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}


