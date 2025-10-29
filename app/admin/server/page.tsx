import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

import { redirect } from "next/navigation";
import { createServer, updateServer, deleteServer, createMailServer, updateMailServer, deleteMailServer } from "./actions";
import { TestConnectionButton } from "./TestConnectionButton";
import { MailServerSection } from "./MailServerSection";
import { DatabaseServerSection } from "./DatabaseServerSection";


type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const str = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function ServerAdminPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const sp = await searchParams;
  const error = str(sp.error);
  const ok = sp.ok === "1";
  const mailError = str(sp.mailError);
  const mailOk = sp.mailOk === "1";
  const dbError = str(sp.dbError);
  const dbOk = sp.dbOk === "1";

  const [servers, mailServers, agencies, databaseServers] = await Promise.all([
    prisma.server.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.mailServer.findMany({
      orderBy: { name: "asc" },
      include: {
        agency: { select: { id: true, name: true } },
      },
    }),
    prisma.agency.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.databaseServer.findMany({
      orderBy: [{ serverId: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Serververwaltung</h1>
          <p className="text-sm text-gray-500">Verwalte Server mit direkten Links zu Froxlor und MySQL.</p>
        </div>
        <details className="relative" open={Boolean(error)}>
          <summary className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-black/90">
            Server hinzufügen
          </summary>
          <div className="absolute right-0 mt-2 w-[360px] space-y-4 rounded-lg border bg-white p-4 shadow-lg">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {ok && <p className="text-sm text-green-600">Server gespeichert.</p>}
            <form action={createServer} className="space-y-3">
              <Field label="Servername">
                <input name="name" required className="w-full rounded border p-2" placeholder="srv-example" />
              </Field>
              <Field label="IP-Adresse">
                <input name="ip" required className="w-full rounded border p-2" placeholder="192.0.2.10" />
              </Field>
              <Field label="Froxlor URL">
                <input name="froxlorUrl" type="url" className="w-full rounded border p-2" placeholder="https://froxlor.example.com" />
              </Field>
              <Field label="MySQL URL">
                <input name="mysqlUrl" type="url" className="w-full rounded border p-2" placeholder="https://dbadmin.example.com" />
              </Field>
              <Field label="Froxlor Version">
                <select name="froxlorVersion" defaultValue="2.0+" className="w-full rounded border p-2">
                  <option value="2.0+">Froxlor 2.0+ (HTTP Basic Auth)</option>
                  <option value="1.x">Froxlor 1.x (Legacy)</option>
                </select>
              </Field>
              <Field label="Froxlor API Key">
                <input name="froxlorApiKey" className="w-full rounded border p-2" placeholder="API Key" />
              </Field>
              <Field label="Froxlor API Secret">
                <input name="froxlorApiSecret" type="password" className="w-full rounded border p-2" placeholder="API Secret" />
              </Field>
              <hr className="my-4" />
              <div className="text-xs font-semibold text-gray-500 mb-2">SSH-Zugang (für Joomla-Installation)</div>
              <Field label="SSH Host">
                <input name="sshHost" className="w-full rounded border p-2" placeholder="z.B. srv01.example.com" />
              </Field>
              <Field label="SSH Port">
                <input name="sshPort" type="number" defaultValue="22" className="w-full rounded border p-2" placeholder="22" />
              </Field>
              <Field label="SSH Username">
                <input name="sshUsername" className="w-full rounded border p-2" placeholder="root" />
              </Field>
              <Field label="SSH Password">
                <input name="sshPassword" type="password" className="w-full rounded border p-2" placeholder="SSH Password" />
              </Field>
              <button type="submit" className="w-full rounded bg-black px-4 py-2 text-white">Speichern</button>
            </form>
          </div>
        </details>
      </div>

      <section className="space-y-4 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Serverliste</h2>
        <div className="overflow-x-auto rounded border">
          <table className="min-w-[1200px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
                <th>Name</th>
                <th>IP</th>
                <th>Froxlor</th>
                <th>MySQL</th>
                <th>Zugangsdaten</th>
                <th>SSH</th>
                <th>Test</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:px-3 [&>tr>td]:py-2">
              {servers.map((server) => {
                const formId = `server-${server.id}`;
                return (
                  <tr key={server.id} className="border-t">
                    <td>
                      <input form={formId} name="name" defaultValue={server.name} className="w-full rounded border p-1" />
                    </td>
                    <td>
                      <input form={formId} name="ip" defaultValue={server.ip} className="w-full rounded border p-1" />
                    </td>
                    <td>
                      <div className="space-y-1">
                        <input
                          form={formId}
                          name="froxlorUrl"
                          defaultValue={server.froxlorUrl ?? ""}
                          className="w-full rounded border p-1"
                          placeholder="https://..."
                        />
                        {server.froxlorUrl ? (
                          <a href={server.froxlorUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
                            Froxlor öffnen
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">nicht gesetzt</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <input
                          form={formId}
                          name="mysqlUrl"
                          defaultValue={server.mysqlUrl ?? ""}
                          className="w-full rounded border p-1"
                          placeholder="https://..."
                        />
                        {server.mysqlUrl ? (
                          <a href={server.mysqlUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
                            MySQL öffnen
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">nicht gesetzt</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="space-y-2">
                        <select
                          form={formId}
                          name="froxlorVersion"
                          defaultValue={server.froxlorVersion ?? "2.0+"}
                          className="w-full rounded border p-1 text-xs"
                        >
                          <option value="2.0+">Froxlor 2.0+</option>
                          <option value="1.x">Froxlor 1.x</option>
                        </select>
                        <input
                          form={formId}
                          name="froxlorApiKey"
                          defaultValue={server.froxlorApiKey ?? ""}
                          className="w-full rounded border p-1 text-xs"
                          placeholder="API Key"
                        />
                        <input
                          form={formId}
                          name="froxlorApiSecret"
                          type="password"
                          defaultValue={server.froxlorApiSecret ?? ""}
                          className="w-full rounded border p-1 text-xs"
                          placeholder="API Secret"
                        />
                      </div>
                    </td>
                    <td>
                      <div className="space-y-2">
                        <input
                          form={formId}
                          name="sshHost"
                          defaultValue={server.sshHost ?? ""}
                          className="w-full rounded border p-1 text-xs"
                          placeholder="SSH Host"
                        />
                        <input
                          form={formId}
                          name="sshPort"
                          type="number"
                          defaultValue={server.sshPort ?? 22}
                          className="w-full rounded border p-1 text-xs"
                          placeholder="Port"
                        />
                        <input
                          form={formId}
                          name="sshUsername"
                          defaultValue={server.sshUsername ?? ""}
                          className="w-full rounded border p-1 text-xs"
                          placeholder="Username"
                        />
                        <input
                          form={formId}
                          name="sshPassword"
                          type="password"
                          defaultValue={server.sshPassword ?? ""}
                          className="w-full rounded border p-1 text-xs"
                          placeholder="Password"
                        />
                      </div>
                    </td>
                    <td>
                      <TestConnectionButton
                        froxlorUrl={server.froxlorUrl}
                        froxlorApiKey={server.froxlorApiKey}
                        froxlorApiSecret={server.froxlorApiSecret}
                        froxlorVersion={server.froxlorVersion}
                      />
                    </td>
                    <td className="whitespace-nowrap space-x-2">
                      <form id={formId} action={updateServer} className="hidden">
                        <input type="hidden" name="id" value={server.id} />
                      </form>
                      <button form={formId} className="rounded border px-2 py-1">Speichern</button>
                      <form action={deleteServer} className="inline">
                        <input type="hidden" name="id" value={server.id} />
                        <button className="rounded border px-2 py-1 text-red-600" type="submit">Löschen</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {servers.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-sm text-gray-500">Noch keine Server hinterlegt.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DatabaseServerSection
        servers={servers}
        databaseServers={databaseServers}
        dbError={dbError}
        dbOk={dbOk}
      />

      <MailServerSection
        mailServers={mailServers}
        agencies={agencies}
        mailError={mailError}
        mailOk={mailOk}
        updateMailServer={updateMailServer}
        deleteMailServer={deleteMailServer}
        createMailServer={createMailServer}
      />
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
