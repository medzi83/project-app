import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { deleteSelectedClients } from "./actions";
import SelectAllCheckbox from "./SelectAllCheckbox";

const SERVICE_DEFS = [
  { key: "website", label: "Webseite" },
  { key: "texte", label: "Texte" },
  { key: "film", label: "Film" },
  { key: "seo", label: "SEO" },
  { key: "shop", label: "Shop" },
] as const;

type ServiceKey = typeof SERVICE_DEFS[number]["key"];

const hasContentService = (status?: string | null) => {
  const normalized = status?.trim();
  if (!normalized) return false;
  return normalized !== "NEIN";
};

const formatDate = (value?: Date | string | null) => {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "-";
  }
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ClientsPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (!session.user.role || !["ADMIN", "AGENT"].includes(session.user.role)) {
    redirect("/");
  }
  const isAdmin = session.user.role === "ADMIN";

  const spRaw = await searchParams;
  const page = Math.max(1, parseInt(typeof spRaw.page === "string" ? spRaw.page : "1") || 1);
  const psRaw = typeof spRaw.ps === "string" ? spRaw.ps : "50";
  const pageSize = psRaw === "100" ? 100 : 50;
  const skip = (page - 1) * pageSize;
  const searchQuery = typeof spRaw.search === "string" ? spRaw.search.trim() : "";

  const whereClause = searchQuery
    ? {
        OR: [
          { name: { contains: searchQuery, mode: "insensitive" as const } },
          { customerNo: { contains: searchQuery, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
      skip,
      take: pageSize,
      include: {
        _count: { select: { projects: true } },
        server: { select: { id: true, name: true, hostname: true } },
        projects: {
          select: {
            type: true,
            website: { select: { seo: true, textit: true, cms: true } },
            film: { select: { projectId: true } },
          },
        },
      },
    }),
    prisma.client.count({ where: whereClause }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(total, skip + clients.length);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kunden</h1>
          <p className="text-sm text-gray-500">Alle Kunden mit Kontaktdaten, Projekten und Leistungen im Überblick.</p>
        </div>
      </header>

      <section className="rounded-lg border bg-white">
        {isAdmin && (
          <div className="flex items-center justify-end gap-2 p-3 border-b text-xs text-gray-500">
            Admin: Kunden löschen über Auswahl und Button unten.
          </div>
        )}
        <div className="p-3 border-b">
          <form method="get" className="flex items-center gap-3">
            <input
              type="search"
              name="search"
              defaultValue={searchQuery}
              placeholder="Suche nach Name oder Kundennummer..."
              className="flex-1 rounded border px-3 py-2 text-sm"
            />
            <input type="hidden" name="ps" value={pageSize} />
            <button type="submit" className="rounded bg-black px-4 py-2 text-sm text-white">
              Suchen
            </button>
            {searchQuery && (
              <a href="/clients" className="text-sm underline">
                Zurücksetzen
              </a>
            )}
          </form>
        </div>
        <div className="flex items-center justify-between gap-2 p-3 border-b text-sm">
          <div className="text-gray-600">Zeige {from}–{to} von {total}</div>
          <div className="flex items-center gap-3">
            <a className={pageSize===50?"font-semibold underline":"underline"} href={`?ps=50&page=1${searchQuery?`&search=${encodeURIComponent(searchQuery)}`:''}`}>50/Seite</a>
            <a className={pageSize===100?"font-semibold underline":"underline"} href={`?ps=100&page=1${searchQuery?`&search=${encodeURIComponent(searchQuery)}`:''}`}>100/Seite</a>
            <span className="mx-2">|</span>
            <a className={page===1?"pointer-events-none opacity-50 underline":"underline"} href={`?ps=${pageSize}&page=${Math.max(1,page-1)}${searchQuery?`&search=${encodeURIComponent(searchQuery)}`:''}`}>Zurück</a>
            <span>Seite {page} / {totalPages}</span>
            <a className={page>=totalPages?"pointer-events-none opacity-50 underline":"underline"} href={`?ps=${pageSize}&page=${Math.min(totalPages,page+1)}${searchQuery?`&search=${encodeURIComponent(searchQuery)}`:''}`}>Weiter</a>
          </div>
        </div>
        <div className="overflow-x-auto">
          <form action={deleteSelectedClients}>
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="[&>th]:px-3 [&>th]:py-2 text-left uppercase tracking-wide text-xs text-gray-500">
                {isAdmin && (
                  <th className="w-8">
                    <SelectAllCheckbox />
                  </th>
                )}
                <th>Kd.-Nr.</th>
                <th>Kunde</th>
                <th>Server</th>
                <th>Kontakt</th>
                <th>Telefon</th>
                <th>Projekte</th>
                <th>Leistungen</th>
                <th>Notiz</th>
                <th>Angelegt</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:px-3 [&>tr>td]:py-2">
              {clients.map((client) => {
                const serviceState: Record<ServiceKey, boolean> = {
                  website: client.projects.some((p) => p.website !== null),
                  film: client.projects.some((p) => p.film !== null),
                  texte: client.projects.some((p) => hasContentService(p.website?.textit)),
                  seo: client.projects.some((p) => hasContentService(p.website?.seo)),
                  shop: client.projects.some((p) => p.website?.cms === "SHOPWARE"),
                };

                const phoneRaw = client.phone ? client.phone.trim() : "";
                const phoneHref = phoneRaw ? `tel:${phoneRaw.replace(/[^+0-9]/g, "")}` : null;
                const phoneLabel = client.phone ?? "-";

                const activeServices = SERVICE_DEFS.filter((def) => serviceState[def.key]);

                return (
                  <tr key={client.id} className="border-t">
                    {isAdmin && (
                      <td>
                        <input type="checkbox" name="ids" value={client.id} />
                      </td>
                    )}
                    <td className="font-mono text-xs text-gray-600">{client.customerNo ?? "-"}</td>
                    <td className="font-medium">{client.name}</td>
                    <td className="text-xs">
                      {client.server ? (
                        <Badge variant="outline" className="font-mono">
                          {client.server.hostname || client.server.name}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td>{client.contact ?? "-"}</td>
                    <td className="whitespace-nowrap">{
                      phoneHref ? (
                        <a href={phoneHref} className="text-blue-600 hover:underline">
                          {phoneLabel}
                        </a>
                      ) : (
                        phoneLabel
                      )
                    }</td>
                    <td className="whitespace-nowrap">{
                      client._count.projects === 0 ? (
                        <span>0</span>
                      ) : (
                        <Link href={`/projects?client=${client.id}`} className="text-blue-600 hover:underline">
                          {client._count.projects}
                        </Link>
                      )
                    }</td>
                    <td className="space-y-1">
                      {activeServices.length === 0 ? (
                        <span className="text-xs text-gray-400">Keine Angaben</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {activeServices.map((service) => (
                            <Badge key={service.key} variant="secondary">{service.label}</Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="max-w-[240px] text-xs text-gray-600">
                      {client.notes ? client.notes.slice(0, 120) + (client.notes.length > 120 ? "..." : "") : "-"}
                    </td>
                    <td className="whitespace-nowrap text-xs text-gray-500">{formatDate(client.createdAt)}</td>
                    <td className="whitespace-nowrap">
                      <Link
                        href={`/clients/${client.id}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 11 : 10} className="py-8 text-center text-sm text-gray-500">
                    Keine Kunden gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="p-3 border-t flex justify-between text-sm text-gray-600">
            <div>
              Zeige {from}–{to} von {total}
            </div>
            <div className="flex items-center gap-3">
              <a className={pageSize===50?"font-semibold underline":"underline"} href={`?ps=50&page=1${searchQuery?`&search=${encodeURIComponent(searchQuery)}`:''}`}>50/Seite</a>
              <a className={pageSize===100?"font-semibold underline":"underline"} href={`?ps=100&page=1${searchQuery?`&search=${encodeURIComponent(searchQuery)}`:''}`}>100/Seite</a>
              <span className="mx-2">|</span>
              <a className={page===1?"pointer-events-none opacity-50 underline":"underline"} href={`?ps=${pageSize}&page=${Math.max(1,page-1)}${searchQuery?`&search=${encodeURIComponent(searchQuery)}`:''}`}>Zurück</a>
              <span>Seite {page} / {totalPages}</span>
              <a className={page>=totalPages?"pointer-events-none opacity-50 underline":"underline"} href={`?ps=${pageSize}&page=${Math.min(totalPages,page+1)}${searchQuery?`&search=${encodeURIComponent(searchQuery)}`:''}`}>Weiter</a>
            </div>
            {isAdmin && (
              <ConfirmSubmit confirmText="Ausgewählte Kunden unwiderruflich löschen?" className="px-3 py-1.5 rounded border border-red-300 text-red-700 bg-red-50 hover:bg-red-100">
                Ausgewählte löschen
              </ConfirmSubmit>
            )}
          </div>
          </form>
        </div>
      </section>
    </div>
  );
}


