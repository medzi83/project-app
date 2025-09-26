import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import InlineCell from "@/components/InlineCell";

type Search = {
  sort?: string;
  dir?: "asc" | "desc";
  q?: string;
  status?: string;
  priority?: string;
  cms?: string;
  agent?: string;
};

const STATUSES = ["NEW","BRIEFING","IN_PROGRESS","ON_HOLD","REVIEW","DONE"] as const;
const PRIORITIES = ["LOW","NORMAL","HIGH","CRITICAL"] as const;
const CMS = ["SHOPWARE","WORDPRESS","TYPO3","JOOMLA","WEBFLOW","WIX","CUSTOM","OTHER"] as const;

const fmtDate = (d?: Date | string | null) =>
  d ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d)) : "-";
const yesNo = (v?: boolean | null) => (v === true ? "Ja" : v === false ? "Nein" : "-");
const mm = (n?: number | null) => (n ? `${Math.floor(n / 60)}h ${n % 60}m` : "-");

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProjectsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const spRaw = await searchParams;
  const sp: Search = {
    sort: str(spRaw.sort) ?? "customerNo",
    dir: (str(spRaw.dir) as "asc" | "desc") ?? "asc",
    q: str(spRaw.q) ?? "",
    status: str(spRaw.status),
    priority: str(spRaw.priority),
    cms: str(spRaw.cms),
    agent: str(spRaw.agent),
  };

  const role = session.user.role!;
  const canEdit = ["ADMIN", "AGENT"].includes(role);
  const clientId = session.user.clientId ?? undefined;

  const where: Prisma.ProjectWhereInput = {};

  if (role === "CUSTOMER") {
    if (!clientId) redirect("/");
    where.clientId = clientId!;
  }

  if (sp.q) {
    where.client = {
      is: {
        customerNo: { contains: sp.q, mode: "insensitive" },
      },
    };
  }

  if (sp.status && STATUSES.includes(sp.status as (typeof STATUSES)[number])) {
    where.status = sp.status as Prisma.ProjectStatus;
  }

  const websiteFilters: Prisma.ProjectWebsiteWhereInput = {};
  if (sp.priority && PRIORITIES.includes(sp.priority as (typeof PRIORITIES)[number])) {
    websiteFilters.priority = sp.priority as Prisma.WebsitePriority;
  }
  if (sp.cms && CMS.includes(sp.cms as (typeof CMS)[number])) {
    websiteFilters.cms = sp.cms as Prisma.CMS;
  }
  if (Object.keys(websiteFilters).length > 0) {
    where.website = { is: websiteFilters };
  }

  if (sp.agent) {
    where.agentId = sp.agent === "none" ? null : sp.agent;
  }

  const orderBy = mapOrderBy(sp.sort!, sp.dir!);


  const [projects, agents] = await Promise.all([
    prisma.project.findMany({
      where,
      include: { client: true, website: true, agent: true },
      orderBy,
    }),
    prisma.user.findMany({ where: { role: "AGENT" }, orderBy: { name: "asc" } }),
  ]);

  const mkSort = (key: string) => makeSortHref({ current: sp, key });

  // Select-Optionen
  const agentOptions = [{ value: "", label: "- ohne Agent -" }, ...agents.map(a => ({
    value: a.id, label: a.name ?? a.email
  }))];
  const statusOptions   = STATUSES.map(s => ({ value: s, label: s }));
  const priorityOptions = PRIORITIES.map(p => ({ value: p, label: p }));
  const cmsOptions      = CMS.map(c => ({ value: c, label: c }));
  const seoOptions      = ["NONE","QUESTIONNAIRE","ANALYSIS","DONE"].map(v => ({ value: v, label: v }));
  const textitOptions   = ["NONE","SENT_OUT","DONE"].map(v => ({ value: v, label: v }));

  return (
    <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Projekte</h1>
        {canEdit && (
          <Link href="/projects/new" className="px-3 py-1.5 rounded bg-black text-white">
            Neues Projekt
          </Link>
        )}
      </div>

      {/* Filterleiste */}
<form method="get" className="grid xl:grid-cols-7 lg:grid-cols-6 md:grid-cols-3 grid-cols-1 gap-3 p-4 border rounded-lg">
  <div className="flex flex-col gap-1">
    <label className="text-xs opacity-60">Kundennr. suchen</label>
    <input name="q" defaultValue={sp.q} placeholder="z. B. K1023" className="p-2 border rounded" />
  </div>

  <div className="flex flex-col gap-1">
    <label className="text-xs opacity-60">Status</label>
    <select name="status" defaultValue={sp.status ?? ""} className="p-2 border rounded">
      <option value="">(alle)</option>
      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  </div>

  <div className="flex flex-col gap-1">
    <label className="text-xs opacity-60">Prio</label>
    <select name="priority" defaultValue={sp.priority ?? ""} className="p-2 border rounded">
      <option value="">(alle)</option>
      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
    </select>
  </div>

  <div className="flex flex-col gap-1">
    <label className="text-xs opacity-60">CMS</label>
    <select name="cms" defaultValue={sp.cms ?? ""} className="p-2 border rounded">
      <option value="">(alle)</option>
      {CMS.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  </div>

  <div className="flex flex-col gap-1">
    <label className="text-xs opacity-60">Agent</label>
    <select name="agent" defaultValue={sp.agent ?? ""} className="p-2 border rounded">
      <option value="">(alle)</option>
      <option value="none">- ohne Agent -</option>
      {agents.map(a => <option key={a.id} value={a.id}>{a.name ?? a.email}</option>)}
    </select>
  </div>

  <div className="flex flex-col gap-1">
    <label className="text-xs opacity-60">Sortieren nach</label>
    <select name="sort" defaultValue={sp.sort} className="p-2 border rounded">
      <option value="customerNo">Kundennr.</option>
      <option value="clientName">Kunde</option>
      <option value="title">Projekt</option>
      <option value="domain">Domain</option>
      <option value="priority">Prio</option>
      <option value="status">Status</option>
      <option value="pStatus">P-Status</option>
      <option value="cms">CMS</option>
      <option value="agent">Umsetzer</option>
      <option value="webDate">Webtermin</option>
      <option value="demoDate">Demo an Kunden</option>
      <option value="onlineDate">Online</option>
      <option value="lastMaterialAt">Letzter Materialeingang</option>
      <option value="effortBuildMin">Aufwand Umsetz.</option>
      <option value="effortDemoMin">Aufwand Demo</option>
      <option value="materialAvailable">Material?</option>
      <option value="seo">SEO</option>
      <option value="textit">Textit</option>
      <option value="accessible">♿</option>
      <option value="updatedAt">Aktualisiert</option>
    </select>
  </div>

  <div className="flex flex-col gap-1">
    <label className="text-xs opacity-60">Reihenfolge</label>
    <select name="dir" defaultValue={sp.dir} className="p-2 border rounded">
      <option value="asc">aufsteigend</option>
      <option value="desc">absteigend</option>
    </select>
  </div>

  <div className="xl:col-span-7 lg:col-span-6 md:col-span-3 flex gap-3">
    <button className="px-4 py-2 rounded bg-black text-white" type="submit">Anwenden</button>
    <Link href="/projects" className="px-4 py-2 rounded border">Zurücksetzen</Link>
  </div>
</form>


      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
              <Th href={mkSort("customerNo")} active={sp.sort==="customerNo"} dir={sp.dir} width={120}>Kundennr.</Th>
              <Th href={mkSort("clientName")} active={sp.sort==="clientName"} dir={sp.dir} width={280}>Kunde</Th>
              <Th href={mkSort("title")} active={sp.sort==="title"} dir={sp.dir}>Projekt</Th>
              <Th href={mkSort("domain")} active={sp.sort==="domain"} dir={sp.dir}>Domain</Th>
              <Th href={mkSort("priority")} active={sp.sort==="priority"} dir={sp.dir}>Prio</Th>
              <Th href={mkSort("status")} active={sp.sort==="status"} dir={sp.dir}>Status</Th>
              <Th href={mkSort("pStatus")} active={sp.sort==="pStatus"} dir={sp.dir}>P-Status</Th>
              <Th href={mkSort("cms")} active={sp.sort==="cms"} dir={sp.dir}>CMS</Th>
              <Th href={mkSort("agent")} active={sp.sort==="agent"} dir={sp.dir}>Umsetzer</Th>
              <Th href={mkSort("webDate")} active={sp.sort==="webDate"} dir={sp.dir}>Webtermin</Th>
              <Th href={mkSort("demoDate")} active={sp.sort==="demoDate"} dir={sp.dir}>Demo an Kunden</Th>
              <Th href={mkSort("onlineDate")} active={sp.sort==="onlineDate"} dir={sp.dir}>Online</Th>
              <Th href={mkSort("lastMaterialAt")} active={sp.sort==="lastMaterialAt"} dir={sp.dir}>Letzter Materialeingang</Th>
              <Th href={mkSort("effortBuildMin")} active={sp.sort==="effortBuildMin"} dir={sp.dir}>Aufwand Umsetz.</Th>
              <Th href={mkSort("effortDemoMin")} active={sp.sort==="effortDemoMin"} dir={sp.dir}>Aufwand Demo</Th>
              <Th href={mkSort("materialAvailable")} active={sp.sort==="materialAvailable"} dir={sp.dir}>Material?</Th>
              <Th href={mkSort("seo")} active={sp.sort==="seo"} dir={sp.dir}>SEO</Th>
              <Th href={mkSort("textit")} active={sp.sort==="textit"} dir={sp.dir}>Textit</Th>
                            <Th href={mkSort("accessible")} active={sp.sort==="accessible"} dir={sp.dir}>♿</Th>
              <Th href={mkSort("updatedAt")} active={sp.sort==="updatedAt"} dir={sp.dir}>Aktualisiert</Th>
              <Th>Aktionen</Th>
            </tr>
          </thead>
          <tbody className="[&>tr>td]:px-3 [&>tr>td]:py-2">
            {projects.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="whitespace-nowrap">{p.client?.customerNo ?? "-"}</td>
                <td className="whitespace-nowrap">{p.client?.name ?? "-"}</td>
                <td className="font-medium">
                  <Link className="underline" href={`/projects/${p.id}`}>{p.title}</Link>
                </td>

                {/* Domain (text) */}
                <td className="whitespace-nowrap">
                  <InlineCell
                    target="website" id={p.id} name="domain" type="text"
                    display={p.website?.domain ?? "-"} value={p.website?.domain ?? ""}
                    canEdit={canEdit}
                  />
                </td>

                {/* Prio (select) */}
                <td>
                  <InlineCell
                    target="website" id={p.id} name="priority" type="select"
                    display={p.website?.priority ?? "-"} value={p.website?.priority ?? ""}
                    options={priorityOptions} canEdit={canEdit}
                  />
                </td>

                {/* Status (select auf Project) */}
                <td>
                  <InlineCell
                    target="project" id={p.id} name="status" type="select"
                    display={p.status} value={p.status}
                    options={statusOptions} canEdit={canEdit}
                  />
                </td>

                {/* P-Status (select) */}
                <td>
                  <InlineCell
                    target="website" id={p.id} name="pStatus" type="select"
                    display={p.website?.pStatus ?? "-"} value={p.website?.pStatus ?? ""}
                    options={[
                      { value: "NONE", label: "NONE" },
                      { value: "TODO", label: "TODO" },
                      { value: "IN_PROGRESS", label: "IN_PROGRESS" },
                      { value: "WITH_CUSTOMER", label: "WITH_CUSTOMER" },
                      { value: "BLOCKED", label: "BLOCKED" },
                      { value: "READY_FOR_LAUNCH", label: "READY_FOR_LAUNCH" },
                      { value: "DONE", label: "DONE" },
                    ]}
                    canEdit={canEdit}
                  />
                </td>

                {/* CMS (select) */}
                <td>
                  <InlineCell
                    target="website" id={p.id} name="cms" type="select"
                    display={p.website?.cms ?? "-"} value={p.website?.cms ?? ""}
                    options={cmsOptions} canEdit={canEdit}
                  />
                </td>

                {/* Agent (select auf Project, inkl. "ohne Agent") */}
                <td className="whitespace-nowrap">
                  <InlineCell
                    target="project" id={p.id} name="agentId" type="select"
                    display={p.agent?.name ?? "-"} value={p.agentId ?? ""}
                    options={agentOptions} canEdit={canEdit}
                  />
                </td>

                {/* Termine (date) */}
                <td className="whitespace-nowrap">
                  <InlineCell
                    target="website" id={p.id} name="webDate" type="date"
                    display={fmtDate(p.website?.webDate)} value={p.website?.webDate ?? ""}
                    canEdit={canEdit}
                  />
                </td>
                <td className="whitespace-nowrap">
                  <InlineCell
                    target="website" id={p.id} name="demoDate" type="date"
                    display={fmtDate(p.website?.demoDate)} value={p.website?.demoDate ?? ""}
                    canEdit={canEdit}
                  />
                </td>
                <td className="whitespace-nowrap">
                  <InlineCell
                    target="website" id={p.id} name="onlineDate" type="date"
                    display={fmtDate(p.website?.onlineDate)} value={p.website?.onlineDate ?? ""}
                    canEdit={canEdit}
                  />
                </td>
                <td className="whitespace-nowrap">
                  <InlineCell
                    target="website" id={p.id} name="lastMaterialAt" type="date"
                    display={fmtDate(p.website?.lastMaterialAt)} value={p.website?.lastMaterialAt ?? ""}
                    canEdit={canEdit}
                  />
                </td>

                {/* Aufwand (Stunden) */}
                <td>
                  <InlineCell
                    target="website" id={p.id} name="effortBuildMin" type="number"
                    display={mm(p.website?.effortBuildMin)} value={p.website?.effortBuildMin != null ? p.website.effortBuildMin / 60 : ""}
                    canEdit={canEdit}
                  />
                </td>
                <td>
                  <InlineCell
                    target="website" id={p.id} name="effortDemoMin" type="number"
                    display={mm(p.website?.effortDemoMin)} value={p.website?.effortDemoMin != null ? p.website.effortDemoMin / 60 : ""}
                    canEdit={canEdit}
                  />
                </td>

                {/* Material? (tri) */}
                <td>
                  <InlineCell
                    target="website" id={p.id} name="materialAvailable" type="tri"
                    display={yesNo(p.website?.materialAvailable)}
                    value={p.website?.materialAvailable ?? null}
                    canEdit={canEdit}
                  />
                </td>

                {/* SEO (select) */}
<td>
  <InlineCell
    target="website" id={p.id} name="seo" type="select"
    display={p.website?.seo ?? "-"} value={p.website?.seo ?? ""}
    options={seoOptions} canEdit={canEdit}
  />
</td>

{/* Textit (select) */}
<td>
  <InlineCell
    target="website" id={p.id} name="textit" type="select"
    display={p.website?.textit ?? "-"} value={p.website?.textit ?? ""}
    options={textitOptions} canEdit={canEdit}
  />
</td>
                <td>
  <InlineCell
    target="website" id={p.id} name="accessible" type="tri"
    display={p.website?.accessible === null || p.website?.accessible === undefined ? "-" : (p.website?.accessible ? "Ja" : "Nein")}
    value={p.website?.accessible ?? null} canEdit={canEdit}
  />
</td>

                <td className="whitespace-nowrap">{fmtDate(p.updatedAt)}</td>
                <td className="whitespace-nowrap">
                  <Link href={`/projects/${p.id}`} className="underline mr-3">Details</Link>
                  {canEdit && <Link href={`/projects/${p.id}/edit`} className="underline">Bearbeiten</Link>}
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr><td colSpan={21} className="py-10 text-center opacity-60">Keine Projekte gefunden.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===== Helpers (wie gehabt) ===== */

function str(v: string | string[] | undefined) { return typeof v === "string" ? v : undefined; }

function mapOrderBy(sort: string, dir: "asc" | "desc"): Prisma.ProjectOrderByWithRelationInput[] {
  const direction: Prisma.SortOrder = dir === "desc" ? "desc" : "asc";
  const updatedDesc: Prisma.SortOrder = "desc";

  const defaultOrder: Prisma.ProjectOrderByWithRelationInput[] = [
    { client: { customerNo: "asc" } },
    { client: { name: "asc" } },
    { updatedAt: updatedDesc },
  ];

  switch (sort) {
    case "customerNo":
      return [
        { client: { customerNo: direction } },
        { client: { name: "asc" } },
        { updatedAt: updatedDesc },
      ];
    case "clientName":
      return [
        { client: { name: direction } },
        { updatedAt: updatedDesc },
      ];
    case "title":
      return [{ title: direction }];
    case "status":
      return [{ status: direction }, { updatedAt: updatedDesc }];
    case "priority":
      return [{ website: { priority: direction } }, { updatedAt: updatedDesc }];
    case "pStatus":
      return [{ website: { pStatus: direction } }, { updatedAt: updatedDesc }];
    case "cms":
      return [{ website: { cms: direction } }, { updatedAt: updatedDesc }];
    case "domain":
      return [{ website: { domain: direction } }, { updatedAt: updatedDesc }];
    case "agent":
      return [{ agent: { name: direction } }, { updatedAt: updatedDesc }];
    case "webDate":
      return [{ website: { webDate: direction } }, { updatedAt: updatedDesc }];
    case "demoDate":
      return [{ website: { demoDate: direction } }, { updatedAt: updatedDesc }];
    case "onlineDate":
      return [{ website: { onlineDate: direction } }, { updatedAt: updatedDesc }];
    case "lastMaterialAt":
      return [{ website: { lastMaterialAt: direction } }, { updatedAt: updatedDesc }];
    case "effortBuildMin":
      return [{ website: { effortBuildMin: direction } }, { updatedAt: updatedDesc }];
    case "effortDemoMin":
      return [{ website: { effortDemoMin: direction } }, { updatedAt: updatedDesc }];
    case "seo":
      return [{ website: { seo: direction } }, { updatedAt: updatedDesc }];
    case "textit":
      return [{ website: { textit: direction } }, { updatedAt: updatedDesc }];
    case "materialAvailable":
      return [{ website: { materialAvailable: direction } }, { updatedAt: updatedDesc }];
    case "accessible":
      return [{ website: { accessible: direction } }, { updatedAt: updatedDesc }];
    case "updatedAt":
      return [{ updatedAt: direction }];
    default:
      return defaultOrder;
  }
}

function makeSortHref({ current, key }: { current: Search; key: string }) {
  const p = new URLSearchParams();

  // Wenn erneut auf die gleiche Spalte geklickt wird -> Richtung toggeln,
  // sonst standardmaessig aufsteigend.
  const nextDir: "asc" | "desc" =
    current.sort === key ? (current.dir === "asc" ? "desc" : "asc") : "asc";

  p.set("sort", key);
  p.set("dir", nextDir);

  // aktive Filter/Suche beibehalten
  if (current.q) p.set("q", current.q);
  if (current.status) p.set("status", current.status);
  if (current.priority) p.set("priority", current.priority);
  if (current.cms) p.set("cms", current.cms);
  if (current.agent) p.set("agent", current.agent);

  return `/projects?${p.toString()}`;
}


function Th(props: { href?: string; active?: boolean; dir?: "asc" | "desc"; children: React.ReactNode; width?: number }) {
  const { href, active, dir, children, width } = props;
  const arrow = active ? (dir === "desc" ? "↓" : "↑") : "";
  const className = "px-3 py-2 text-left";
  if (!href) return <th style={width ? { width } : undefined} className={className}>{children}</th>;
  return (
    <th style={width ? { width } : undefined} className={className}>
      <Link href={href} className="underline">{children} {arrow}</Link>
    </th>
  );
}






























