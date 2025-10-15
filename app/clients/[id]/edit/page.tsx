import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { updateClient } from "./actions";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditClientPage({ params }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const { id } = await params;

  const [client, servers, agencies] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      include: { server: true, agency: { select: { id: true, name: true } } },
    }),
    prisma.server.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.agency.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!client) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header>
        <Link href={`/clients/${client.id}`} className="text-blue-600 hover:underline">
          ← Zurück zu Kundendetails
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Kunde bearbeiten</h1>
        <p className="text-sm text-gray-500">{client.name}</p>
      </header>

      <section className="rounded-lg border bg-white p-6">
        <form action={updateClient} className="space-y-4">
          <input type="hidden" name="clientId" value={client.id} />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">
                Kundenname <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                defaultValue={client.name}
                required
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Kundennummer
              </label>
              <input
                type="text"
                name="customerNo"
                defaultValue={client.customerNo || ""}
                className="w-full rounded border p-2"
                placeholder="z.B. 10437 oder EM10437"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Kontaktperson
              </label>
              <input
                type="text"
                name="contact"
                defaultValue={client.contact || ""}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                E-Mail
              </label>
              <input
                type="email"
                name="email"
                defaultValue={client.email || ""}
                className="w-full rounded border p-2"
                placeholder="kunde@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Telefon
              </label>
              <input
                type="tel"
                name="phone"
                defaultValue={client.phone || ""}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Server
              </label>
              <select
                name="serverId"
                defaultValue={client.serverId || ""}
                className="w-full rounded border p-2"
              >
                <option value="">Kein Server zugeordnet</option>
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.hostname || server.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Wird automatisch gesetzt, wenn Kunde in Froxlor gefunden wird
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Agentur
              </label>
              <select
                name="agencyId"
                defaultValue={client.agency?.id ?? ""}
                className="w-full rounded border p-2"
              >
                <option value="">Keine Agentur zugeordnet</option>
                {agencies.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Wird fuer Kundenuebersicht, Projekte und Statistiken genutzt.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Notizen
            </label>
            <textarea
              name="notes"
              defaultValue={client.notes || ""}
              rows={4}
              className="w-full rounded border p-2"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="workStopped"
                id="workStopped"
                defaultChecked={client.workStopped}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="workStopped" className="text-sm font-medium cursor-pointer">
                Arbeitsstopp
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="finished"
                id="finished"
                defaultChecked={client.finished}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="finished" className="text-sm font-medium cursor-pointer">
                Beendet
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded bg-black px-6 py-2 text-white hover:bg-gray-800"
            >
              Speichern
            </button>
            <Link
              href={`/clients/${client.id}`}
              className="rounded border px-6 py-2 hover:bg-gray-50"
            >
              Abbrechen
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
