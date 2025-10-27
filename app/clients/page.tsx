import Link from "next/link";
import type { Prisma } from "@prisma/client";
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
  const agencyFilter = typeof spRaw.agency === "string" ? spRaw.agency : "";

  const filters: Prisma.ClientWhereInput = {};
  if (searchQuery) {
    filters.OR = [
      { name: { contains: searchQuery, mode: "insensitive" } },
      { customerNo: { contains: searchQuery, mode: "insensitive" } },
    ];
  }
  if (agencyFilter) {
    filters.agencyId = agencyFilter;
  }

  const whereClause = Object.keys(filters).length > 0 ? filters : undefined;

  const [clients, total, agencies] = await Promise.all([
    prisma.client.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
      skip,
      take: pageSize,
      include: {
        _count: { select: { projects: true } },
        server: { select: { id: true, name: true, hostname: true } },
        agency: { select: { id: true, name: true, logoIconPath: true } },
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
    prisma.agency.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(total, skip + clients.length);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">Kunden</h1>
          <p className="text-sm text-gray-600 mt-1">Alle Kunden mit Kontaktdaten, Projekten und Leistungen im Überblick.</p>
        </div>
      </header>

      <section className="rounded-2xl border border-blue-100 bg-white shadow-lg overflow-hidden">
        {isAdmin && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-b border-blue-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/30 text-xs text-blue-700 font-medium">
            Admin: Kunden löschen über Auswahl und Button unten.
          </div>
        )}
        <div className="p-4 border-b border-blue-100 bg-gradient-to-r from-slate-50 to-blue-50/30">
          <form method="get" className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              name="search"
              defaultValue={searchQuery}
              placeholder="Suche nach Name oder Kundennummer..."
              className="flex-1 rounded-lg border-2 border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            />
            <select
              name="agency"
              defaultValue={agencyFilter}
              className="rounded-lg border-2 border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            >
              <option value="">Alle Agenturen</option>
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.name}
                </option>
              ))}
            </select>
            <input type="hidden" name="ps" value={pageSize} />
            <button type="submit" className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all active:scale-95">
              Suchen
            </button>
            {(searchQuery || agencyFilter) && (
              <Link href="/clients" className="text-sm text-blue-600 hover:text-blue-800 font-medium underline transition-colors">
                Zurücksetzen
              </Link>
            )}
          </form>
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-blue-100 bg-gradient-to-r from-gray-50 to-slate-50 text-sm">
          <div className="text-gray-700 font-medium">Zeige {from}–{to} von {total}</div>
          <div className="flex items-center gap-3">
            <Link className={pageSize===50?"px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-sm":"px-3 py-1.5 rounded-lg border-2 border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50 transition-all"} href={`?ps=50&page=1${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}${agencyFilter ? `&agency=${encodeURIComponent(agencyFilter)}` : ""}`}>50/Seite</Link>
            <Link className={pageSize===100?"px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-sm":"px-3 py-1.5 rounded-lg border-2 border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50 transition-all"} href={`?ps=100&page=1${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}${agencyFilter ? `&agency=${encodeURIComponent(agencyFilter)}` : ""}`}>100/Seite</Link>
            <span className="mx-1 text-gray-400">|</span>
            <Link className={page===1?"pointer-events-none opacity-50 px-3 py-1.5 rounded-lg border-2 border-gray-300 text-gray-500":"px-3 py-1.5 rounded-lg border-2 border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50 transition-all font-medium"} href={`?ps=${pageSize}&page=${Math.max(1,page-1)}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}${agencyFilter ? `&agency=${encodeURIComponent(agencyFilter)}` : ""}`}>← Zurück</Link>
            <span className="font-semibold text-gray-900">Seite {page} / {totalPages}</span>
            <Link className={page>=totalPages?"pointer-events-none opacity-50 px-3 py-1.5 rounded-lg border-2 border-gray-300 text-gray-500":"px-3 py-1.5 rounded-lg border-2 border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50 transition-all font-medium"} href={`?ps=${pageSize}&page=${Math.min(totalPages,page+1)}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}${agencyFilter ? `&agency=${encodeURIComponent(agencyFilter)}` : ""}`}>Weiter →</Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <form action={deleteSelectedClients}>
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gradient-to-r from-indigo-50 to-blue-50">
              <tr className="[&>th]:px-3 [&>th]:py-3 text-left uppercase tracking-wide text-xs text-indigo-700 font-bold">
                {isAdmin && (
                  <th className="w-8">
                    <SelectAllCheckbox />
                  </th>
                )}
                <th>Kd.-Nr.</th>
                <th>Kunde</th>
                <th>Agentur</th>
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
                  website: client.projects.some((p) => p.website !== null && p.website.cms !== "SHOPWARE"),
                  film: client.projects.some((p) => p.film !== null),
                  texte: client.projects.some((p) => hasContentService(p.website?.textit)),
                  seo: client.projects.some((p) => hasContentService(p.website?.seo)),
                  shop: client.projects.some((p) => p.website?.cms === "SHOPWARE"),
                };

                const phoneRaw = client.phone ? client.phone.trim() : "";
                const phoneHref = phoneRaw ? `tel:${phoneRaw.replace(/[^+0-9]/g, "")}` : null;
                const phoneLabel = client.phone ?? "-";

                const activeServices = SERVICE_DEFS.filter((def) => serviceState[def.key]);

                // Map services to dashboard colors
                const serviceColors: Record<ServiceKey, string> = {
                  website: "bg-gradient-to-r from-purple-500 to-pink-600 text-white",
                  film: "bg-gradient-to-r from-green-500 to-emerald-600 text-white",
                  texte: "bg-gradient-to-r from-blue-500 to-indigo-600 text-white",
                  seo: "bg-gradient-to-r from-cyan-500 to-blue-600 text-white",
                  shop: "bg-gradient-to-r from-orange-500 to-red-600 text-white",
                };

                return (
                  <tr key={client.id} className="border-t">
                    {isAdmin && (
                      <td>
                        <input type="checkbox" name="ids" value={client.id} />
                      </td>
                    )}
                    <td className="font-mono text-xs">
                      {client.customerNo ? (
                        <Link href={`/clients/${client.id}`} className="text-blue-600 hover:underline">
                          {client.customerNo}
                        </Link>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {client.name}
                        {client.workStopped && (
                          <Badge variant="destructive" className="text-xs">Arbeitsstopp</Badge>
                        )}
                        {client.finished && (
                          <Badge className="bg-black hover:bg-gray-900 text-white text-xs">Beendet</Badge>
                        )}
                      </span>
                    </td>
                    <td className="text-xs text-gray-600">
                      {client.agency ? (
                        client.agency.logoIconPath ? (
                          <img
                            src={client.agency.logoIconPath}
                            alt={client.agency.name}
                            title={client.agency.name}
                            className="h-6 w-6 object-contain"
                          />
                        ) : (
                          <span>{client.agency.name}</span>
                        )
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="text-xs">
                      {client.server ? (
                        <Badge variant="outline" className="font-mono">
                          {client.server.hostname || client.server.name}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td>{[client.firstname, client.lastname].filter(Boolean).join(' ') || "-"}</td>
                    <td className="whitespace-nowrap">{
                      phoneHref ? (
                        <a href={phoneHref} className="text-blue-600 hover:underline">
                          {phoneLabel}
                        </a>
                      ) : (
                        phoneLabel
                      )
                    }</td>
                    <td className="whitespace-nowrap">
                      {client._count.projects === 0 ? (
                        <span>0</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Link href={`/projects?client=${client.id}`} className="text-blue-600 hover:underline">
                            {client._count.projects}
                          </Link>
                          {client.projects.some(p => p.website) && (
                            <Link
                              href={`/projects?client=${client.id}`}
                              className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                              title="Webseiten-Projekte"
                            >
                              W
                            </Link>
                          )}
                          {client.projects.some(p => p.film) && (
                            <Link
                              href={`/film-projects?q=${encodeURIComponent(client.customerNo || client.name)}`}
                              className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                              title="Film-Projekte"
                            >
                              F
                            </Link>
                          )}
                        </div>
                      )
                    }</td>
                    <td className="space-y-1">
                      {activeServices.length === 0 ? (
                        <span className="text-xs text-gray-400">Keine Angaben</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {activeServices.map((service) => (
                            <span
                              key={service.key}
                              className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded shadow-sm ${serviceColors[service.key]}`}
                            >
                              {service.label}
                            </span>
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
                  <td colSpan={isAdmin ? 12 : 11} className="py-8 text-center text-sm text-gray-500">
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
              <Link className={pageSize===50?"font-semibold underline":"underline"} href={`?ps=50&page=1${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}${agencyFilter ? `&agency=${encodeURIComponent(agencyFilter)}` : ""}`}>50/Seite</Link>
              <Link className={pageSize===100?"font-semibold underline":"underline"} href={`?ps=100&page=1${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}${agencyFilter ? `&agency=${encodeURIComponent(agencyFilter)}` : ""}`}>100/Seite</Link>
              <span className="mx-2">|</span>
              <Link className={page===1?"pointer-events-none opacity-50 underline":"underline"} href={`?ps=${pageSize}&page=${Math.max(1,page-1)}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}${agencyFilter ? `&agency=${encodeURIComponent(agencyFilter)}` : ""}`}>Zurück</Link>
              <span>Seite {page} / {totalPages}</span>
              <Link className={page>=totalPages?"pointer-events-none opacity-50 underline":"underline"} href={`?ps=${pageSize}&page=${Math.min(totalPages,page+1)}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}${agencyFilter ? `&agency=${encodeURIComponent(agencyFilter)}` : ""}`}>Weiter</Link>
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
