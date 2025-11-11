import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { deleteSelectedClients } from "./actions";
import SelectAllCheckbox from "./SelectAllCheckbox";
import { FavoriteToggle } from "@/components/FavoriteToggle";
import { isFavoriteClient } from "@/app/actions/favorites";

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
  if (!session.user.role || !["ADMIN", "AGENT", "SALES"].includes(session.user.role)) {
    redirect("/");
  }
  const isAdmin = session.user.role === "ADMIN";
  const isSales = session.user.role === "SALES";

  const spRaw = await searchParams;
  const page = Math.max(1, parseInt(typeof spRaw.page === "string" ? spRaw.page : "1") || 1);
  const psRaw = typeof spRaw.ps === "string" ? spRaw.ps : "50";
  const pageSize = psRaw === "100" ? 100 : 50;
  const skip = (page - 1) * pageSize;
  const searchQuery = typeof spRaw.search === "string" ? spRaw.search.trim() : "";
  const agencyFilter = typeof spRaw.agency === "string" ? spRaw.agency : "";
  const serverFilter = typeof spRaw.server === "string" ? spRaw.server : "";
  const statusFilter = typeof spRaw.status === "string" ? spRaw.status : "";
  const projectTypeFilter = typeof spRaw.projectType === "string" ? spRaw.projectType : "";

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
  if (serverFilter) {
    filters.serverId = serverFilter;
  }
  if (statusFilter) {
    if (statusFilter === "active") {
      filters.finished = false;
      filters.workStopped = false;
    } else if (statusFilter === "finished") {
      filters.finished = true;
    } else if (statusFilter === "workStopped") {
      filters.workStopped = true;
    }
  }
  if (projectTypeFilter) {
    filters.projects = {
      some: {
        type: projectTypeFilter as any,
      },
    };
  }

  const whereClause = Object.keys(filters).length > 0 ? filters : undefined;

  // Fetch all favorite client IDs for the current user (SALES only)
  const favoriteClientIds = session.user.id && isSales
    ? await prisma.favoriteClient.findMany({
        where: { userId: session.user.id },
        select: { clientId: true },
      }).then((favorites) => new Set(favorites.map((f) => f.clientId)))
    : new Set<string>();

  const [clients, total, agencies, servers] = await Promise.all([
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
    prisma.server.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, hostname: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(total, skip + clients.length);

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 text-white shadow-lg">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Kunden</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'Kunde' : 'Kunden'} gefunden
          </p>
        </div>
      </div>

      {/* Filter & Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filter & Suche</CardTitle>
          <CardDescription>
            Suchen und filtern Sie nach Kunden
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <input
                type="search"
                name="search"
                defaultValue={searchQuery}
                placeholder="Suche nach Name oder Kundennummer..."
                className="flex-1 rounded-lg border border-border bg-background text-foreground px-4 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-600 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
              />
              <input type="hidden" name="ps" value={pageSize} />
              <Button type="submit" className="gap-2">
                Suchen / Filter anwenden
              </Button>
              {(searchQuery || agencyFilter || serverFilter || statusFilter || projectTypeFilter) && (
                <Link href="/clients" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium underline transition-colors self-center">
                  Zurücksetzen
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <select
                name="status"
                defaultValue={statusFilter}
                className="rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-600 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
              >
                <option value="">Alle Status</option>
                <option value="active">Aktiv</option>
                <option value="finished">Beendet</option>
                <option value="workStopped">Arbeitsstopp</option>
              </select>
              <select
                name="projectType"
                defaultValue={projectTypeFilter}
                className="rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-600 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
              >
                <option value="">Alle Projektarten</option>
                <option value="WEBSITE">Webseite</option>
                <option value="FILM">Film</option>
                <option value="SOCIAL">Social Media</option>
              </select>
              <select
                name="agency"
                defaultValue={agencyFilter}
                className="rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-600 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
              >
                <option value="">Alle Agenturen</option>
                {agencies.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                  </option>
                ))}
              </select>
              <select
                name="server"
                defaultValue={serverFilter}
                className="rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-600 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
              >
                <option value="">Alle Server</option>
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.hostname || server.name}
                  </option>
                ))}
              </select>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Admin Info */}
      {isAdmin && (
        <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/30">
          <CardContent className="py-3">
            <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">
              Admin: Kunden löschen über Auswahl und Button unten.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pagination Top */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="text-muted-foreground font-medium">Zeige {from}–{to} von {total}</div>
        <div className="flex items-center gap-3">
          <Link className={pageSize===50?"px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white font-semibold shadow-sm":"px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-accent transition-all"} href={`?ps=50&page=1${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}${agencyFilter ? `&agency=${encodeURIComponent(agencyFilter)}` : ""}${serverFilter ? `&server=${encodeURIComponent(serverFilter)}` : ""}${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ""}${projectTypeFilter ? `&projectType=${encodeURIComponent(projectTypeFilter)}` : ""}`}>50/Seite</Link>
          <Link className={pageSize===100?"px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white font-semibold shadow-sm":"px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-accent transition-all"} href={`?ps=100&page=1${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}${agencyFilter ? `&agency=${encodeURIComponent(agencyFilter)}` : ""}${serverFilter ? `&server=${encodeURIComponent(serverFilter)}` : ""}${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ""}${projectTypeFilter ? `&projectType=${encodeURIComponent(projectTypeFilter)}` : ""}`}>100/Seite</Link>
          <span className="mx-1 text-muted-foreground">|</span>
          <Link className={page===1?"pointer-events-none opacity-50 px-3 py-1.5 rounded-lg border border-border":"px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-all font-medium"} href={`?ps=${pageSize}&page=${Math.max(1,page-1)}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}${agencyFilter ? `&agency=${encodeURIComponent(agencyFilter)}` : ""}${serverFilter ? `&server=${encodeURIComponent(serverFilter)}` : ""}${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ""}${projectTypeFilter ? `&projectType=${encodeURIComponent(projectTypeFilter)}` : ""}`}>← Zurück</Link>
          <span className="font-semibold text-foreground">Seite {page} / {totalPages}</span>
          <Link className={page>=totalPages?"pointer-events-none opacity-50 px-3 py-1.5 rounded-lg border border-border":"px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-all font-medium"} href={`?ps=${pageSize}&page=${Math.min(totalPages,page+1)}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}${agencyFilter ? `&agency=${encodeURIComponent(agencyFilter)}` : ""}${serverFilter ? `&server=${encodeURIComponent(serverFilter)}` : ""}${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ""}${projectTypeFilter ? `&projectType=${encodeURIComponent(projectTypeFilter)}` : ""}`}>Weiter →</Link>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <form action={deleteSelectedClients}>
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && (
                      <TableHead className="w-8">
                        <SelectAllCheckbox />
                      </TableHead>
                    )}
                    {isSales && <TableHead className="w-10"></TableHead>}
                    <TableHead>Kd.-Nr.</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Agentur</TableHead>
                    <TableHead>Server</TableHead>
                    <TableHead>Kontakt</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Projekte</TableHead>
                    <TableHead>Leistungen</TableHead>
                    <TableHead>Notiz</TableHead>
                    <TableHead>Angelegt</TableHead>
                    <TableHead>Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
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

                    const isFavorite = favoriteClientIds.has(client.id);

                    return (
                      <TableRow key={client.id}>
                        {isAdmin && (
                          <TableCell>
                            <input type="checkbox" name="ids" value={client.id} />
                          </TableCell>
                        )}
                        {isSales && (
                          <TableCell>
                            <FavoriteToggle
                              clientId={client.id}
                              initialIsFavorite={isFavorite}
                              size="sm"
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-mono text-xs">
                          {client.customerNo ? (
                            <Link href={`/clients/${client.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                              {client.customerNo}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-2">
                            {client.name}
                            {client.workStopped && (
                              <Badge variant="destructive" className="text-xs">Arbeitsstopp</Badge>
                            )}
                            {client.finished && (
                              <Badge className="bg-black dark:bg-gray-200 hover:bg-gray-900 dark:hover:bg-gray-300 text-white dark:text-black text-xs">Beendet</Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
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
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {client.server ? (
                            <Badge variant="outline" className="font-mono">
                              {client.server.hostname || client.server.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{[client.firstname, client.lastname].filter(Boolean).join(' ') || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{
                          phoneHref ? (
                            <a href={phoneHref} className="text-blue-600 dark:text-blue-400 hover:underline">
                              {phoneLabel}
                            </a>
                          ) : (
                            phoneLabel
                          )
                        }</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {client._count.projects === 0 ? (
                            <span>0</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Link href={`/projects?client=${client.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                                {client._count.projects}
                              </Link>
                              {client.projects.some(p => p.website) && (
                                <Link
                                  href={`/projects?client=${client.id}`}
                                  className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                                  title="Webseiten-Projekte"
                                >
                                  W
                                </Link>
                              )}
                              {client.projects.some(p => p.film) && (
                                <Link
                                  href={`/film-projects?q=${encodeURIComponent(client.customerNo || client.name)}`}
                                  className="text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50"
                                  title="Film-Projekte"
                                >
                                  F
                                </Link>
                              )}
                            </div>
                          )
                        }</TableCell>
                        <TableCell className="space-y-1">
                          {activeServices.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Keine Angaben</span>
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
                        </TableCell>
                        <TableCell className="max-w-[240px] text-xs text-muted-foreground">
                          {client.notes ? client.notes.slice(0, 120) + (client.notes.length > 120 ? "..." : "") : "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(client.createdAt)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Link
                            href={`/clients/${client.id}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                          >
                            Details
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {clients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isAdmin && isSales ? 13 : isAdmin || isSales ? 12 : 11} className="py-8 text-center text-sm text-muted-foreground">
                        Keine Kunden gefunden.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {isAdmin && (
                <div className="border-t border-border p-3 flex justify-end">
                  <ConfirmSubmit confirmText="Ausgewählte Kunden unwiderruflich löschen?" className="px-3 py-1.5 rounded border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50">
                    Ausgewählte löschen
                  </ConfirmSubmit>
                </div>
              )}
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Pagination Bottom */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="text-muted-foreground">Zeige {from}–{to} von {total}</div>
        <div className="flex items-center gap-3">
          <Link className={pageSize===50?"font-semibold underline text-foreground":"underline text-muted-foreground hover:text-foreground"} href={`?ps=50&page=1${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}${agencyFilter ? `&agency=${encodeURIComponent(agencyFilter)}` : ""}${serverFilter ? `&server=${encodeURIComponent(serverFilter)}` : ""}${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ""}${projectTypeFilter ? `&projectType=${encodeURIComponent(projectTypeFilter)}` : ""}`}>50/Seite</Link>
          <Link className={pageSize===100?"font-semibold underline text-foreground":"underline text-muted-foreground hover:text-foreground"} href={`?ps=100&page=1${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}${agencyFilter ? `&agency=${encodeURIComponent(agencyFilter)}` : ""}${serverFilter ? `&server=${encodeURIComponent(serverFilter)}` : ""}${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ""}${projectTypeFilter ? `&projectType=${encodeURIComponent(projectTypeFilter)}` : ""}`}>100/Seite</Link>
          <span className="mx-2 text-muted-foreground">|</span>
          <Link className={page===1?"pointer-events-none opacity-50 underline text-muted-foreground":"underline text-foreground hover:text-primary"} href={`?ps=${pageSize}&page=${Math.max(1,page-1)}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}${agencyFilter ? `&agency=${encodeURIComponent(agencyFilter)}` : ""}${serverFilter ? `&server=${encodeURIComponent(serverFilter)}` : ""}${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ""}${projectTypeFilter ? `&projectType=${encodeURIComponent(projectTypeFilter)}` : ""}`}>Zurück</Link>
          <span className="text-foreground">Seite {page} / {totalPages}</span>
          <Link className={page>=totalPages?"pointer-events-none opacity-50 underline text-muted-foreground":"underline text-foreground hover:text-primary"} href={`?ps=${pageSize}&page=${Math.min(totalPages,page+1)}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}${agencyFilter ? `&agency=${encodeURIComponent(agencyFilter)}` : ""}${serverFilter ? `&server=${encodeURIComponent(serverFilter)}` : ""}${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ""}${projectTypeFilter ? `&projectType=${encodeURIComponent(projectTypeFilter)}` : ""}`}>Weiter</Link>
        </div>
      </div>
    </div>
  );
}
