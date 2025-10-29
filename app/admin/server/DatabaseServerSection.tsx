import { createDatabaseServer, updateDatabaseServer, deleteDatabaseServer } from "./actions";

type DatabaseServer = {
  id: string;
  serverId: string;
  name: string;
  version: string;
  host: string;
  port: number | null;
  isDefault: boolean;
};

type Server = {
  id: string;
  name: string;
};

type Props = {
  servers: Server[];
  databaseServers: DatabaseServer[];
  dbError?: string;
  dbOk?: boolean;
};

export function DatabaseServerSection({ servers, databaseServers, dbError, dbOk }: Props) {
  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Datenbank-Server</h2>
          <p className="text-sm text-gray-500">Verwalte verschiedene Datenbankversionen pro Server</p>
        </div>
        <details className="relative">
          <summary className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-black/90">
            Datenbank-Server hinzufügen
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-[400px] space-y-4 rounded-lg border bg-white p-4 shadow-lg">
            {dbError && <p className="text-sm text-red-600">{dbError}</p>}
            {dbOk && <p className="text-sm text-green-600">Datenbank-Server gespeichert.</p>}
            <form action={createDatabaseServer} className="space-y-3">
              <Field label="Server">
                <select name="serverId" required className="w-full rounded border p-2">
                  <option value="">-- Server wählen --</option>
                  {servers.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Name">
                <input name="name" required className="w-full rounded border p-2" placeholder="z.B. MariaDB 10.3" />
              </Field>
              <Field label="Version">
                <input name="version" required className="w-full rounded border p-2" placeholder="z.B. 10.3.39" />
              </Field>
              <Field label="Host">
                <input name="host" required defaultValue="localhost" className="w-full rounded border p-2" placeholder="localhost oder 127.0.0.1" />
              </Field>
              <Field label="Port">
                <input name="port" type="number" required defaultValue="3306" className="w-full rounded border p-2" placeholder="3306" />
              </Field>
              <Field label="Als Standard markieren">
                <select name="isDefault" className="w-full rounded border p-2">
                  <option value="no">Nein</option>
                  <option value="yes">Ja (empfohlen für neue Installationen)</option>
                </select>
              </Field>
              <button type="submit" className="w-full rounded bg-black px-4 py-2 text-white">
                Speichern
              </button>
            </form>
          </div>
        </details>
      </div>

      {databaseServers.length === 0 ? (
        <div className="rounded border border-dashed p-8 text-center">
          <p className="text-sm text-gray-500">
            Noch keine Datenbank-Server konfiguriert.
            <br />
            Füge verschiedene DB-Versionen hinzu (z.B. MariaDB 10.3 auf localhost:3306 und MariaDB 10.5 auf 127.0.0.1:3307)
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
                <th>Server</th>
                <th>Name</th>
                <th>Version</th>
                <th>Host</th>
                <th>Port</th>
                <th>Standard</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:px-3 [&>tr>td]:py-2">
              {databaseServers.map((dbServer) => {
                const server = servers.find((s) => s.id === dbServer.serverId);
                const formId = `db-server-${dbServer.id}`;
                return (
                  <tr key={dbServer.id} className="border-t">
                    <td>{server?.name || "Unbekannt"}</td>
                    <td>
                      <input form={formId} name="name" defaultValue={dbServer.name} className="w-full rounded border p-1" />
                    </td>
                    <td>
                      <input form={formId} name="version" defaultValue={dbServer.version} className="w-full rounded border p-1" />
                    </td>
                    <td>
                      <input form={formId} name="host" defaultValue={dbServer.host} className="w-full rounded border p-1" />
                    </td>
                    <td>
                      <input form={formId} name="port" type="number" defaultValue={dbServer.port ?? 3306} className="w-full rounded border p-1" />
                    </td>
                    <td>
                      <select form={formId} name="isDefault" defaultValue={dbServer.isDefault ? "yes" : "no"} className="w-full rounded border p-1">
                        <option value="no">Nein</option>
                        <option value="yes">Ja</option>
                      </select>
                    </td>
                    <td className="whitespace-nowrap space-x-2">
                      <form id={formId} action={updateDatabaseServer} className="hidden">
                        <input type="hidden" name="id" value={dbServer.id} />
                        <input type="hidden" name="serverId" value={dbServer.serverId} />
                      </form>
                      <button form={formId} className="rounded border px-2 py-1">
                        Speichern
                      </button>
                      <form action={deleteDatabaseServer} className="inline">
                        <input type="hidden" name="id" value={dbServer.id} />
                        <button className="rounded border px-2 py-1 text-red-600" type="submit">
                          Löschen
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
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
