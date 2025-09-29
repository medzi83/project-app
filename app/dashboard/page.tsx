// /app/dashboard/page.tsx
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Dashboard" };

type ProjectStatus = Prisma.$Enums.ProjectStatus;

const STATUSES: ProjectStatus[] = ["WEBTERMIN", "MATERIAL", "UMSETZUNG", "DEMO", "ONLINE"];
const STATUS_LABELS: Record<ProjectStatus, string> = {
  WEBTERMIN: "Webtermin",
  MATERIAL: "Material",
  UMSETZUNG: "Umsetzung",
  DEMO: "Demo",
  ONLINE: "Online",
};

function formatDate(d?: Date | null) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}


const startOfDay = (input: Date) => {
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isWorkingDay = (date: Date) => {
  const day = date.getDay();
  return day !== 0 && day !== 6;
};

const workingDaysBetween = (from: Date, to: Date) => {
  if (from.getTime() === to.getTime()) return 0;
  const step = from < to ? 1 : -1;
  const current = new Date(from);
  let count = 0;
  while (current.getTime() !== to.getTime()) {
    current.setDate(current.getDate() + step);
    if (isWorkingDay(current)) count += step;
  }
  return count;
};

const workingDaysSince = (lastMaterialAt: Date | string) => {
  const start = startOfDay(new Date(lastMaterialAt));
  if (Number.isNaN(start.getTime())) return null;
  const today = startOfDay(new Date());
  let days = workingDaysBetween(start, today);
  if (days < 0) days = 0;
  return days;
};
export default async function DashboardPage() {
  // Kennzahlen parallel laden (Clients = distinct clientId aus Projekten)

  const [
    totalProjects,
    activeAgents,
    totalAgents,
    distinctClientRefs,
    statusRaw,
    overdueCandidates,
  ] = await Promise.all([
    prisma.project.count(),
    prisma.user.count({ where: { role: "AGENT", active: true } }),
    prisma.user.count({ where: { role: "AGENT" } }),
    prisma.project.findMany({
      distinct: ["clientId"],
      select: { clientId: true },
    }),
    prisma.project.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.project.findMany({
      where: {
        status: { not: "ONLINE" },
        website: {
          is: {
            materialStatus: "VOLLSTAENDIG",
            lastMaterialAt: { not: null },
          },
        },
      },
      select: {
        id: true,
        website: { select: { lastMaterialAt: true } },
      },
    }),
  ]);

  const clientIds = distinctClientRefs.map((x) => x.clientId);
  const totalClients = clientIds.length;

  const clientsWithNumber = clientIds.length
    ? await prisma.client.count({
        where: { id: { in: clientIds }, customerNo: { not: null } },
      })
    : 0;

  const clientsWithoutNumber = totalClients - clientsWithNumber;

  const overdueProjectsCount = overdueCandidates.reduce((count, project) => {
    const last = project.website?.lastMaterialAt;
    if (!last) return count;
    const days = workingDaysSince(last);
    return days !== null && days >= 60 ? count + 1 : count;
  }, 0);
  const statusCountMap = new Map<ProjectStatus, number>(
    statusRaw.map((entry) => [entry.status as ProjectStatus, entry._count._all])
  );

  const statusTiles = STATUSES.map((status) => ({
    key: status,
    label: STATUS_LABELS[status],
    count: statusCountMap.get(status) ?? 0,
    href: `/projects?status=${status}`,
  }));

  const statusTilesWithOverdue = [
    ...statusTiles,
    {
      key: "OVERDUE",
      label: "\u00DCberf\u00E4llige Projekte (60+ Tage)",
      count: overdueProjectsCount,
      href: "/projects?overdue=1",
    },
  ];

  // Zuletzt aktualisierte Projekte
  const recentProjects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      createdAt: true,
      client: { select: { name: true, customerNo: true } },
      notes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          text: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });

  // Helper fuer Aktivitaetslabel
  function activityInfo(p: (typeof recentProjects)[number]) {
    const lastNote = p.notes[0];
    if (lastNote) {
      // Heuristik: wenn updatedAt ~ letzte Notiz (+/-2 Minuten)
      const diff = Math.abs(new Date(p.updatedAt).getTime() - new Date(lastNote.createdAt).getTime());
      if (diff <= 2 * 60 * 1000) {
        return {
          label: "Notiz hinzugefuegt",
          detail:
            (lastNote.author?.name ? `${lastNote.author.name}: ` : "") +
            (lastNote.text.length > 80 ? `${lastNote.text.slice(0, 80)}...` : lastNote.text),
        };
      }
    }
    return { label: "Projekt aktualisiert", detail: `Status: ${p.status}` };
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* KPI-Kacheln */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Projekte gesamt</div>
          <div className="mt-1 text-3xl font-bold">{totalProjects}</div>
        </div>

        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Aktive Agenten</div>
          <div className="mt-1 text-3xl font-bold">{activeAgents}</div>
          <div className="mt-1 text-xs text-gray-500">von {totalAgents} gesamt</div>
        </div>

        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Kunden (Clients)</div>
          <div className="mt-1 text-3xl font-bold">{totalClients}</div>
          <div className="mt-1 text-xs text-gray-500">
            mit Kundennummer: {clientsWithNumber} - ohne: {clientsWithoutNumber}
          </div>
        </div>

        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Letztes Projekt-Update</div>
          <div className="mt-1 text-lg font-medium">
            {formatDate(recentProjects[0]?.updatedAt)}
          </div>
        </div>
      </section>

      {/* Statusuebersicht */}
      <section className="rounded-2xl border">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-medium">Projektstatus</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
          {statusTilesWithOverdue.map((tile) => (
            <Link
              key={tile.key}
              href={tile.href}
              className="rounded-xl border bg-white p-4 shadow-sm transition hover:border-black"
            >
              <div className="text-sm text-gray-500">{tile.label}</div>
              <div className="mt-1 text-3xl font-bold">{tile.count}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Zuletzt aktualisierte Projekte */}
      <section className="rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-medium">Zuletzt aktualisierte Projekte</h2>
        </div>
        <div className="divide-y">
          {recentProjects.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">Noch keine Projekte vorhanden.</div>
          ) : (
            recentProjects.map((p) => {
              const { label, detail } = activityInfo(p);
              const customerLabel = [p.client?.customerNo, p.client?.name].filter(Boolean).join(" - ");
              return (
                <a
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0">
                      <div className="font-semibold truncate">{customerLabel || "Kunde unbekannt"}</div>
                      <div className="font-medium text-sm text-gray-600 truncate">{p.title ?? `Projekt #${p.id}`}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {label} - {detail} - aktualisiert: {formatDate(p.updatedAt)} - erstellt: {formatDate(p.createdAt)}
                    </div>
                  </div>
                  <span className="text-sm text-blue-600 shrink-0">Details</span>
                </a>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}

















