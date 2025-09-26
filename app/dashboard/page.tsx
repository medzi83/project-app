// /app/dashboard/page.tsx
import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"

export const metadata = { title: "Dashboard" }

function formatDate(d?: Date | null) {
  if (!d) return "–"
  try {
    return new Date(d).toLocaleString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "–"
  }
}

export default async function DashboardPage() {
  // Kennzahlen parallel laden
  // Kennzahlen parallel laden (Clients = distinct clientId aus Projekten)
const [
  totalProjects,
  activeAgents,
  totalAgents,
  distinctClientRefs,
] = await Promise.all([
  prisma.project.count(),
  prisma.user.count({ where: { role: "AGENT", active: true } }),
  prisma.user.count({ where: { role: "AGENT" } }),
  prisma.project.findMany({
    distinct: ["clientId"],
    select: { clientId: true },
  }),
])

const clientIds = distinctClientRefs.map((x) => x.clientId)
const totalClients = clientIds.length

const clientsWithNumber = clientIds.length
  ? await prisma.client.count({
      where: { id: { in: clientIds }, customerNo: { not: null } },
    })
  : 0

const clientsWithoutNumber = totalClients - clientsWithNumber


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
})

// Helper für Aktivitätslabel
function activityInfo(p: typeof recentProjects[number]) {
  const lastNote = p.notes[0]
  if (lastNote) {
    // Heuristik: wenn updatedAt ~ letzte Notiz (±2 Minuten)
    const diff = Math.abs(new Date(p.updatedAt).getTime() - new Date(lastNote.createdAt).getTime())
    if (diff <= 2 * 60 * 1000) {
      return {
        label: "Notiz hinzugefügt",
        detail:
          (lastNote.author?.name ? `${lastNote.author.name}: ` : "") +
          (lastNote.text.length > 80 ? lastNote.text.slice(0, 80) + "…" : lastNote.text),
      }
    }
  }
  return { label: "Projekt aktualisiert", detail: `Status: ${p.status}` }
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
            mit Kundennummer: {clientsWithNumber} • ohne: {clientsWithoutNumber}
          </div>
        </div>

        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Letztes Projekt-Update</div>
          <div className="mt-1 text-lg font-medium">
            {formatDate(recentProjects[0]?.updatedAt)}
          </div>
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
        const { label, detail } = activityInfo(p)
        return (
          <a
            key={p.id}
            href={`/projects/${p.id}`}
            className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <div className="font-medium truncate">{p.title ?? `Projekt #${p.id}`}</div>
                <span className="text-xs text-gray-500 shrink-0">
                  • Kunde: {p.client?.name ?? "—"}
                  {p.client?.customerNo ? ` (${p.client.customerNo})` : ""}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5 truncate">
                {label} • {detail} • aktualisiert: {formatDate(p.updatedAt)} • erstellt: {formatDate(p.createdAt)}
              </div>
            </div>
            <span className="text-sm text-blue-600 shrink-0">Details</span>
          </a>
        )
      })
    )}
  </div>
</section>

    </main>
  )
}
