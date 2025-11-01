import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

const MONTHS_TO_SHOW = 12;
const EFFORT_WINDOW_MONTHS = 12;
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

type MonthAccumulator = {
  key: string;
  date: Date;
  label: string;
  webAppointments: number;
  newDemos: number;
  goLives: number;
  overdueWorkingTotal: number;
  overdueWorkingSamples: number;
  webToOnlineTotalDays: number;
  webToOnlineCount: number;
  agentCounts: Map<string, { name: string; count: number }>;
};

type MonthRow = {
  key: string;
  date: Date;
  label: string;
  webAppointments: number;
  newDemos: number;
  goLives: number;
  avgOverdueWorkingDays: number | null;
  avgWebToOnlineDays: number | null;
  topAgentName: string;
  topAgentCount: number;
};

const monthFormatter = new Intl.DateTimeFormat("de-DE", {
  year: "numeric",
  month: "long",
});

const decimalFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatMinutes = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const rounded = Math.max(0, Math.round(value));
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

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
  const start = startOfDay(from);
  const end = startOfDay(to);
  if (start.getTime() >= end.getTime()) return 0;
  const current = new Date(start);
  let count = 0;
  while (current.getTime() < end.getTime()) {
    current.setDate(current.getDate() + 1);
    if (isWorkingDay(current)) count += 1;
  }
  return count;
};

const calendarDaysBetween = (from: Date, to: Date) => {
  const start = startOfDay(from).getTime();
  const end = startOfDay(to).getTime();
  const diff = Math.floor((end - start) / MILLISECONDS_PER_DAY);
  return diff > 0 ? diff : 0;
};

const toDate = (value?: Date | string | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const parseDateParam = (value?: string | string[] | null) => {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const normalized = /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : raw;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatInputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildMonthRange = (start: Date, end: Date) => {
  const months: MonthAccumulator[] = [];
  const current = startOfMonth(start);
  const limit = startOfMonth(end);
  while (current.getTime() <= limit.getTime()) {
    const date = new Date(current.getFullYear(), current.getMonth(), 1);
    months.push({
      key: monthKey(date),
      date,
      label: monthFormatter.format(date),
      webAppointments: 0,
      newDemos: 0,
      goLives: 0,
      overdueWorkingTotal: 0,
      overdueWorkingSamples: 0,
      webToOnlineTotalDays: 0,
      webToOnlineCount: 0,
      agentCounts: new Map(),
    });
    current.setMonth(current.getMonth() + 1);
  }
  return months;
};

function ensureMonthEntry(accumulators: Map<string, MonthAccumulator>, date: Date) {
  const key = monthKey(date);
  let entry = accumulators.get(key);
  if (!entry) {
    entry = {
      key,
      date: new Date(date.getFullYear(), date.getMonth(), 1),
      label: monthFormatter.format(date),
      webAppointments: 0,
      newDemos: 0,
      goLives: 0,
      overdueWorkingTotal: 0,
      overdueWorkingSamples: 0,
      webToOnlineTotalDays: 0,
      webToOnlineCount: 0,
      agentCounts: new Map(),
    };
    accumulators.set(key, entry);
  }
  return entry;
}

export default async function AdminStatisticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[]>>;
}) {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  // Next.js 15: await searchParams
  const params = await searchParams;

  const now = new Date();
  const today = startOfDay(now);
  const defaultEndMonth = startOfMonth(today);
  const defaultStartMonth = startOfMonth(new Date(defaultEndMonth.getFullYear(), defaultEndMonth.getMonth() - (MONTHS_TO_SHOW - 1), 1));

  const startRawParam = Array.isArray(params?.start) ? params?.start[0] : params?.start;
  const endRawParam = Array.isArray(params?.end) ? params?.end[0] : params?.end;
  const agencyRawParam = Array.isArray(params?.agency) ? params?.agency[0] : params?.agency;
  const agencyFilter = typeof agencyRawParam === "string" ? agencyRawParam : "";

  const startParam = parseDateParam(startRawParam ?? null);
  const endParam = parseDateParam(endRawParam ?? null);

  let startMonth = startParam ? startOfMonth(startParam) : defaultStartMonth;
  let endMonth = endParam ? startOfMonth(endParam) : defaultEndMonth;
  if (startMonth.getTime() > endMonth.getTime()) {
    const temp = startMonth;
    startMonth = endMonth;
    endMonth = temp;
  }

  const startRange = startMonth;
  const endExclusive = new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 1);

  const monthAccumulators = new Map<string, MonthAccumulator>();
  buildMonthRange(startMonth, endMonth).forEach((entry) => monthAccumulators.set(entry.key, entry));

  const agentEffortTotals = new Map<string, { name: string; totalMinutes: number; count: number }>();

  const startInputValue = startRawParam
    ? (/^\d{4}-\d{2}$/.test(startRawParam) ? `${startRawParam}-01` : startRawParam)
    : formatInputDate(startRange);

  const endInputValue = endRawParam
    ? (/^\d{4}-\d{2}$/.test(endRawParam) ? `${endRawParam}-01` : endRawParam)
    : formatInputDate(endMonth);

  const preservedParams = new URLSearchParams();
  if (startRawParam) preservedParams.set("start", startRawParam);
  if (endRawParam) preservedParams.set("end", endRawParam);
  const resetAgencyHref = preservedParams.toString() ? `/admin/statistics?${preservedParams.toString()}` : "/admin/statistics";

  const resetDateParams = new URLSearchParams();
  if (agencyFilter) resetDateParams.set("agency", agencyFilter);
  const resetDateHref = resetDateParams.toString() ? `/admin/statistics?${resetDateParams.toString()}` : "/admin/statistics";
  const effortWindowStart = startOfMonth(
    new Date(now.getFullYear(), now.getMonth() - (EFFORT_WINDOW_MONTHS - 1), 1),
  );
  const effortWindowEndExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const agenciesPromise = prisma.agency.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const websiteProjectsPromise = prisma.project.findMany({
    where: {
      type: "WEBSITE",
      ...(agencyFilter ? { client: { agencyId: agencyFilter } } : {}),
      website: {
        is: {
          OR: [
            { webDate: { not: null, gte: startRange, lt: endExclusive } },
            { demoDate: { not: null, gte: startRange, lt: endExclusive } },
            { onlineDate: { not: null, gte: startRange, lt: endExclusive } },
          ],
        },
      },
    },
    select: {
      id: true,
      agent: { select: { id: true, name: true, email: true } },
      website: {
        select: {
          webDate: true,
          demoDate: true,
          onlineDate: true,
          lastMaterialAt: true,
        },
      },
    },
  });
  const agentEffortProjectsPromise = prisma.project.findMany({
    where: {
      type: "WEBSITE",
      ...(agencyFilter ? { client: { agencyId: agencyFilter } } : {}),
      website: {
        is: {
          AND: [
            { effortBuildMin: { not: null } },
            {
              OR: [
                { webDate: { not: null, gte: effortWindowStart, lt: effortWindowEndExclusive } },
                { demoDate: { not: null, gte: effortWindowStart, lt: effortWindowEndExclusive } },
                { onlineDate: { not: null, gte: effortWindowStart, lt: effortWindowEndExclusive } },
              ],
            },
          ],
        },
      },
    },
    select: {
      id: true,
      agent: { select: { id: true, name: true, email: true } },
      website: {
        select: {
          effortBuildMin: true,
          demoDate: true,
          webDate: true,
          onlineDate: true,
        },
      },
    },
  });

  const [agencies, websiteProjects, agentEffortProjects] = await Promise.all([
    agenciesPromise,
    websiteProjectsPromise,
    agentEffortProjectsPromise,
  ]);
  const selectedAgency = agencyFilter ? agencies.find((agency) => agency.id === agencyFilter) : undefined;
  for (const project of websiteProjects) {
    const agentName = project.agent?.name?.trim() || project.agent?.email?.trim() || "Unzugewiesen";
    const agentKey = project.agent?.id ?? "unassigned";
    const { website } = project;
    if (!website) continue;

    const webDate = toDate(website.webDate);
    const demoDate = toDate(website.demoDate);
    const onlineDate = toDate(website.onlineDate);
    const lastMaterialAt = toDate(website.lastMaterialAt);

    if (webDate && webDate >= startRange && webDate < endExclusive) {
      const entry = ensureMonthEntry(monthAccumulators, webDate);
      entry.webAppointments += 1;
    }

    if (demoDate && demoDate >= startRange && demoDate < endExclusive) {
      const entry = ensureMonthEntry(monthAccumulators, demoDate);
      entry.newDemos += 1;

      const currentCount = entry.agentCounts.get(agentKey);
      if (currentCount) {
        currentCount.count += 1;
      } else {
        entry.agentCounts.set(agentKey, { name: agentName, count: 1 });
      }

      if (lastMaterialAt) {
        const overdueDays = workingDaysBetween(lastMaterialAt, demoDate);
        if (overdueDays > 0) {
          entry.overdueWorkingTotal += overdueDays;
          entry.overdueWorkingSamples += 1;
        }
      }
    }

    if (onlineDate && onlineDate >= startRange && onlineDate < endExclusive) {
      const entry = ensureMonthEntry(monthAccumulators, onlineDate);
      entry.goLives += 1;
      if (webDate) {
        const duration = calendarDaysBetween(webDate, onlineDate);
        if (duration >= 0) {
          entry.webToOnlineTotalDays += duration;
          entry.webToOnlineCount += 1;
        }
      }
    }

  }
  for (const project of agentEffortProjects) {
    const agentName = project.agent?.name?.trim() || project.agent?.email?.trim() || "Unzugewiesen";
    const agentId = project.agent?.id ?? "unassigned";
    const effortBuild = project.website?.effortBuildMin ?? null;
    if (typeof effortBuild === "number" && Number.isFinite(effortBuild) && effortBuild >= 0) {
      const existing = agentEffortTotals.get(agentId);
      if (existing) {
        existing.totalMinutes += effortBuild;
        existing.count += 1;
      } else {
        agentEffortTotals.set(agentId, {
          name: agentName,
          totalMinutes: effortBuild,
          count: 1,
        });
      }
    }
  }

  const agentEffortRows = Array.from(agentEffortTotals.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      projectCount: data.count,
      totalMinutes: data.totalMinutes,
      avgMinutes: data.count > 0 ? data.totalMinutes / data.count : null,
    }))
    .sort((a, b) => {
      if (a.avgMinutes === null) return 1;
      if (b.avgMinutes === null) return -1;
      return b.avgMinutes - a.avgMinutes;
    });

  const monthEntries = Array.from(monthAccumulators.values());

  const rows: MonthRow[] = monthEntries
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((entry) => {
      let topAgentName = "-";
      let topAgentCount = 0;
      for (const { name, count } of entry.agentCounts.values()) {
        if (count > topAgentCount) {
          topAgentName = name;
          topAgentCount = count;
        }
      }

      const avgOverdueWorkingDays =
        entry.overdueWorkingSamples > 0
          ? entry.overdueWorkingTotal / entry.overdueWorkingSamples
          : null;

      return {
        key: entry.key,
        date: entry.date,
        label: entry.label,
        webAppointments: entry.webAppointments,
        newDemos: entry.newDemos,
        goLives: entry.goLives,
        avgOverdueWorkingDays,
        avgWebToOnlineDays:
          entry.webToOnlineCount > 0
            ? entry.webToOnlineTotalDays / entry.webToOnlineCount
            : null,
        topAgentName,
        topAgentCount,
      };
    });

  const currentYear = now.getFullYear();
  const currentYearEntries = monthEntries.filter(
    (entry) => entry.date.getFullYear() === currentYear,
  );

  const currentYearTotals = currentYearEntries.reduce(
    (acc, entry) => {
      acc.webAppointments += entry.webAppointments;
      acc.newDemos += entry.newDemos;
      acc.goLives += entry.goLives;
      acc.overdueWorkingTotal += entry.overdueWorkingTotal;
      acc.overdueWorkingSamples += entry.overdueWorkingSamples;
      acc.webToOnlineTotalDays += entry.webToOnlineTotalDays;
      acc.webToOnlineCount += entry.webToOnlineCount;
      return acc;
    },
    {
      webAppointments: 0,
      newDemos: 0,
      goLives: 0,
      overdueWorkingTotal: 0,
      overdueWorkingSamples: 0,
      webToOnlineTotalDays: 0,
      webToOnlineCount: 0,
    },
  );

  const yearAgentCounts = new Map<string, { name: string; count: number }>();
  for (const entry of currentYearEntries) {
    for (const [key, value] of entry.agentCounts.entries()) {
      const existing = yearAgentCounts.get(key);
      if (existing) {
        existing.count += value.count;
      } else {
        yearAgentCounts.set(key, { name: value.name, count: value.count });
      }
    }
  }

  const topYearAgents = Array.from(yearAgentCounts.entries())
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const currentYearAvgWebToOnlineDays =
    currentYearTotals.webToOnlineCount > 0
      ? currentYearTotals.webToOnlineTotalDays / currentYearTotals.webToOnlineCount
      : null;

  const currentYearAvgOverdueDays =
    currentYearTotals.overdueWorkingSamples > 0
      ? currentYearTotals.overdueWorkingTotal / currentYearTotals.overdueWorkingSamples
      : null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Statistik</h1>
        <p className="text-sm text-muted-foreground">
          Überblick über zentrale Kennzahlen. Der Betrachtungszeitraum kann unten angepasst werden.
        </p>
      </div>
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <form method="get" className="flex flex-wrap items-end gap-4 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-gray-500">Agentur</span>
            <select name="agency" defaultValue={agencyFilter} className="rounded border px-3 py-2">
              <option value="">Alle Agenturen</option>
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.name}
                </option>
              ))}
            </select>
          </label>
          {startRawParam && <input type="hidden" name="start" value={startRawParam} />}
          {endRawParam && <input type="hidden" name="end" value={endRawParam} />}
          <button type="submit" className="rounded bg-black px-4 py-2 text-white">
            Filter anwenden
          </button>
          {agencyFilter && (
            <a href={resetAgencyHref} className="text-sm underline">
              Filter loeschen
            </a>
          )}
        </form>
        <p className="mt-3 text-xs text-gray-500">
          {selectedAgency ? `Auswertung fuer: ${selectedAgency.name}` : "Auswertung fuer alle Agenturen."}
        </p>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            Aktuelles Jahr - Summen
          </div>
          {currentYearEntries.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">
              Für {currentYear} liegen noch keine Kennzahlen vor.
            </p>
          ) : (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Webtermine</dt>
                <dd className="font-semibold text-gray-900">{currentYearTotals.webAppointments}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Neue Demos</dt>
                <dd className="font-semibold text-gray-900">{currentYearTotals.newDemos}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Onlinestellungen</dt>
                <dd className="font-semibold text-gray-900">{currentYearTotals.goLives}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Überfällige Arbeitstage (Ø)</dt>
                <dd className="font-semibold text-gray-900">{currentYearAvgOverdueDays !== null ? decimalFormatter.format(currentYearAvgOverdueDays) : "-"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Webtermin &rarr; Online (Tage)</dt>
                <dd className="font-semibold text-gray-900">
                  {currentYearAvgWebToOnlineDays !== null
                    ? decimalFormatter.format(currentYearAvgWebToOnlineDays)
                    : "-"}
                </dd>
              </div>
            </dl>
          )}
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            Aktuelles Jahr - Top 3 Agenten (Neue Demos)
          </div>
          {topYearAgents.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">Noch keine Demo-Projekte in {currentYear}.</p>
          ) : (
            <ol className="mt-3 space-y-2 text-sm">
              {topYearAgents.map((agent, index) => (
                <li
                  key={agent.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  <span className="flex items-center gap-2 font-medium text-gray-900">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    {agent.name}
                  </span>
                  <span className="text-sm text-gray-600">
                    {agent.count} Demo{agent.count === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ol>
      )}
    </div>
  </section>

      <section className="rounded-2xl border overflow-hidden">
        <div className="border-b bg-gray-50 px-4 py-3">
          <h2 className="font-medium">Umsetzungsaufwand nach Agent</h2>
          <p className="text-xs text-gray-500">
            Grundlage: Projekte mit erfasstem Aufwand in den letzten zwölf Monaten.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-[13px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Agent</th>
                <th className="px-3 py-2 text-left font-medium">Anzahl Projekte</th>
                <th className="px-3 py-2 text-left font-medium">Gesamtaufwand</th>
                <th className="px-3 py-2 text-left font-medium">Durchschnittlicher Aufwand</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {agentEffortRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-gray-500" colSpan={4}>
                    Keine Werte für den gewählten Zeitraum.
                  </td>
                </tr>
              ) : (
                agentEffortRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{row.name}</td>
                    <td className="px-3 py-2">{row.projectCount}</td>
                    <td className="px-3 py-2">{formatMinutes(row.totalMinutes)}</td>
                    <td className="px-3 py-2">
                      {row.avgMinutes !== null ? formatMinutes(row.avgMinutes) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border overflow-hidden">
        <div className="border-b bg-gray-50 px-4 py-3">
          <h2 className="font-medium">Monatliche Kennzahlen</h2>
          <p className="text-xs text-gray-500">
            Zeitraum: {monthFormatter.format(startMonth)} - {monthFormatter.format(endMonth)}
          </p>
          <form method="get" className="mt-3 flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-gray-500">Startdatum</span>
              <input
                type="date"
                name="start"
                defaultValue={startInputValue}
                className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-black focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-gray-500">Enddatum</span>
              <input
                type="date"
                name="end"
                defaultValue={endInputValue}
                className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-black focus:outline-none"
              />
            </label>
            {agencyFilter && <input type="hidden" name="agency" value={agencyFilter} />}
            <button
              type="submit"
              className="rounded bg-black px-3 py-2 text-sm font-semibold text-white hover:bg-gray-900"
            >
              Zeitraum anwenden
            </button>
            <a
              href={resetDateHref}
              className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Zuruecksetzen
            </a>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-[13px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Monat</th>
                <th className="px-3 py-2 text-left font-medium">Webtermine</th>
                <th className="px-3 py-2 text-left font-medium">Neue Demos</th>
                <th className="px-3 py-2 text-left font-medium">Onlinestellungen</th>
                <th className="px-3 py-2 text-left font-medium">Überfällige Arbeitstage (Ø)</th>
                <th className="px-3 py-2 text-left font-medium">Webtermin &rarr; Online (Tage)</th>
                <th className="px-3 py-2 text-left font-medium">Agent (Neue Demos)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {rows.map((row) => (
                <tr key={row.key} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{row.label}</td>
                  <td className="px-3 py-2">{row.webAppointments}</td>
                  <td className="px-3 py-2">{row.newDemos}</td>
                  <td className="px-3 py-2">{row.goLives}</td>
                  <td className="px-3 py-2">
                    {row.avgOverdueWorkingDays !== null ? decimalFormatter.format(row.avgOverdueWorkingDays) : "-"}
                  </td>
                  <td className="px-3 py-2">
                    {row.avgWebToOnlineDays !== null ? decimalFormatter.format(row.avgWebToOnlineDays) : "-"}
                  </td>
                  <td className="px-3 py-2">
                    {row.topAgentCount > 0 ? `${row.topAgentName} (${row.topAgentCount})` : "-"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-gray-500" colSpan={7}>
                    Für den gewählten Zeitraum liegen noch keine Daten vor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
