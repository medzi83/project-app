import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { notFound, redirect } from "next/navigation";

const fmtDate = (d?: Date | string | null) =>
  d ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d)) : "-";
const mm = (n?: number | null) => (n ? `${Math.floor(n / 60)}h ${n % 60}m` : "-");
const yesNo = (v?: boolean | null) => (v === true ? "Ja" : v === false ? "Nein" : "-");
const linkify = (u?: string | null) => {
  if (!u) return "-";
  const hasProto = /^https?:\/\//i.test(u);
  const href = hasProto ? u : `https://${u}`;
  return <a className="underline" href={href} target="_blank" rel="noreferrer">{u}</a>;
};

type Props = { params: Promise<{ id: string }> };

export default async function ProjectDetail({ params }: Props) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const project = await prisma.project.findUnique({
    where: { id },
    include: { client: true, agent: true, website: true },
  });

  if (!project) notFound();
  if (session.user.role === "CUSTOMER" && project.clientId !== session.user.clientId) notFound();

  const website = project.website;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/projects" className="text-sm underline">Zurück zur Übersicht</Link>
        {["ADMIN", "AGENT"].includes(session.user.role ?? "") && (
          <Link href={`/projects/${project.id}/edit`} className="text-sm underline">Bearbeiten</Link>
        )}
      </div>

      <div>
        <div className="text-sm opacity-60">Kunde</div>
        <div className="text-lg font-semibold">
          {project.client?.name}{" "}
          {project.client?.customerNo ? (
            <span className="opacity-60">| {project.client.customerNo}</span>
          ) : null}
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{project.title}</h1>
        <div className="text-sm opacity-70">Typ: {project.type} | Status: {project.status}</div>
        {project.important && (
          <div className="p-3 bg-yellow-50 border rounded">Wichtige Infos: {project.important}</div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-[700px] w-full text-sm">
          <tbody className="[&>tr>th]:bg-gray-50 [&>tr>th]:text-left [&>tr>th]:w-56 [&>tr>th]:px-3 [&>tr>th]:py-2 [&>tr>td]:px-3 [&>tr>td]:py-2">
            <tr><th>Domain</th><td>{website?.domain ?? "-"}</td></tr>
            <tr><th>Prio</th><td>{website?.priority ?? "-"}</td></tr>
            <tr><th>CMS</th><td>{website?.cms === "OTHER" && website?.cmsOther ? `OTHER (${website.cmsOther})` : website?.cms ?? "-"}</td></tr>
            <tr><th>P-Status</th><td>{website?.pStatus ?? "-"}</td></tr>
            <tr><th>Umsetzer</th><td>{project.agent?.name ?? "-"}</td></tr>
            <tr><th>Webtermin</th><td className="whitespace-nowrap">{fmtDate(website?.webDate)}</td></tr>
            <tr><th>Demo an Kunden</th><td className="whitespace-nowrap">{fmtDate(website?.demoDate)}</td></tr>
            <tr><th>Online</th><td className="whitespace-nowrap">{fmtDate(website?.onlineDate)}</td></tr>
            <tr><th>Letzter Materialeingang</th><td className="whitespace-nowrap">{fmtDate(website?.lastMaterialAt)}</td></tr>
            <tr><th>Zeitaufwand Umsetzung</th><td>{mm(website?.effortBuildMin)}</td></tr>
            <tr><th>Zeitaufwand Demo</th><td>{mm(website?.effortDemoMin)}</td></tr>
            <tr><th>Material vorhanden?</th><td>{yesNo(website?.materialStatus === "VOLLSTAENDIG")}</td></tr>
            <tr><th>SEO (Fragebogen/Analyse)</th><td>{website?.seo ?? "-"}</td></tr>
            <tr><th>Textit</th><td>{website?.textit ?? "-"}</td></tr>
            <tr><th>Barrierefrei?</th><td>{yesNo(website?.accessible)}</td></tr>
            <tr><th>Demolink</th><td>{linkify(website?.demoLink)}</td></tr>
            <tr><th>Hinweis</th><td>{website?.note ?? "-"}</td></tr>
            <tr><th>Zuletzt aktualisiert</th><td className="whitespace-nowrap">{fmtDate(project.updatedAt)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
