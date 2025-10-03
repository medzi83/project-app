import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { labelForProjectStatus } from "@/lib/project-status";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect, notFound } from "next/navigation";
import { updateWebsite } from "./actions";

type Props = { params: Promise<{ id: string }> };

const dInput = (d?: Date | string | null) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";

export default async function EditProjectPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!["ADMIN", "AGENT"].includes(session.user.role || "")) redirect(`/projects/${id}`);

  const [project, agents] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: { client: true, agent: true, website: true },
    }),
    prisma.user.findMany({ where: { role: "AGENT" }, orderBy: { name: "asc" } }),
  ]);

  if (!project) notFound();

  const w = project.website;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Projekt bearbeiten</h1>
      <p className="opacity-70">
        {project.client?.name} {project.client?.customerNo ? ` ${project.client.customerNo}` : ""}  {project.title}
      </p>

      <form action={updateWebsite} className="space-y-6">
        <input type="hidden" name="projectId" value={project.id} />

        {/* Kopf */}
        <div className="grid md:grid-cols-3 gap-4 p-4 border rounded-lg">
          <Field label="Titel">
            <input name="title" defaultValue={project.title} className="w-full p-2 border rounded" required />
          </Field>

          <Field label="Status">
            <div className="w-full p-2 border rounded bg-gray-100 text-sm">
              {labelForProjectStatus(project.status, { pStatus: w?.pStatus })}
            </div>
          </Field>

          <Field label="Umsetzer (Agent)">
            <select name="agentId" defaultValue={project.agentId ?? ""} className="w-full p-2 border rounded">
              <option value=""> keiner </option>
              {agents.flatMap(a => ([<option key={a.id+"-base"} value={a.id}>{a.name ?? a.email}</option>, <option key={a.id+"-wt"} value={a.id}>{(a.name ?? a.email)} WT</option>]))}
            </select>
          </Field>
        </div>

        {/* Website-Details */}
        <div className="grid md:grid-cols-3 gap-4 p-4 border rounded-lg">
          <Field label="Domain">
            <input name="domain" defaultValue={w?.domain ?? ""} placeholder="www.example.de" className="w-full p-2 border rounded" />
          </Field>

          <Field label="Prio">
            <select name="priority" defaultValue={w?.priority ?? "NONE"} className="w-full p-2 border rounded">
              {["NONE","PRIO_1","PRIO_2","PRIO_3"].map(v=> <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>

          <Field label="CMS">
            <select name="cms" defaultValue={w?.cms ?? "SHOPWARE"} className="w-full p-2 border rounded">
              {["SHOPWARE","WORDPRESS","JOOMLA","LOGO","PRINT","CUSTOM","OTHER"].map(v=> <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>

          <Field label="CMS (falls OTHER/CUSTOM)">
            <input name="cmsOther" defaultValue={w?.cmsOther ?? ""} className="w-full p-2 border rounded" placeholder="z. B. Headless, Eigenbau" />
          </Field>

          <Field label="P-Status">
            <select name="pStatus" defaultValue={w?.pStatus ?? "NONE"} className="w-full p-2 border rounded">
              {["NONE","BEENDET","MMW","VOLLST_A_K"].map(v=> <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>

          <Field label="Demolink">
            <input name="demoLink" defaultValue={w?.demoLink ?? ""} className="w-full p-2 border rounded" placeholder="https://demo.example.com" />
          </Field>

          <Field label="Webtermin">
            <input type="date" name="webDate" defaultValue={dInput(w?.webDate)} className="w-full p-2 border rounded" />
          </Field>

          <Field label="Demo an Kunden">
            <input type="date" name="demoDate" defaultValue={dInput(w?.demoDate)} className="w-full p-2 border rounded" />
          </Field>

          <Field label="Online">
            <input type="date" name="onlineDate" defaultValue={dInput(w?.onlineDate)} className="w-full p-2 border rounded" />
          </Field>

          <Field label="Letzter Materialeingang">
            <input type="date" name="lastMaterialAt" defaultValue={dInput(w?.lastMaterialAt)} className="w-full p-2 border rounded" />
          </Field>

          <Field label="Aufwand Umsetzung (Stunden)">
          <input type="number" name="effortBuildMin" min={0} step={0.5} inputMode="decimal" defaultValue={w?.effortBuildMin != null ? (w.effortBuildMin / 60).toString() : ""} className="w-full p-2 border rounded" />
          </Field>

          <Field label="Aufwand Demo (Stunden)">
            <input type="number" name="effortDemoMin" min={0} step={0.5} inputMode="decimal" defaultValue={w?.effortDemoMin != null ? (w.effortDemoMin / 60).toString() : ""} className="w-full p-2 border rounded" />
          </Field>

          <Field label="Material">
            <select name="materialStatus" defaultValue={w?.materialStatus ?? "ANGEFORDERT"} className="w-full p-2 border rounded">
              <option value="ANGEFORDERT">angefordert</option>
              <option value="TEILWEISE">teilweise</option>
              <option value="VOLLSTAENDIG">vollständig</option>
              <option value="NV">N.V.</option>
            </select>
          </Field>

          <Field label="SEO (Fragebogen/Analyse)">
            <select name="seo" defaultValue={w?.seo ?? "NEIN"} className="w-full p-2 border rounded">
              {["NEIN","NEIN_NEIN","JA_NEIN","JA_JA"].map(v=> <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>

          <Field label="Textit">
            <select name="textit" defaultValue={w?.textit ?? "NEIN"} className="w-full p-2 border rounded">
              {["NEIN","NEIN_NEIN","JA_NEIN","JA_JA"].map(v=> <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>

          <Field label="Barrierefrei">
            <select name="accessible" defaultValue={w?.accessible === null || w?.accessible === undefined ? "unknown" : w?.accessible ? "yes" : "no"} className="w-full p-2 border rounded">
              <option value="unknown">(nicht gesetzt)</option>
              <option value="yes">Ja</option>
              <option value="no">Nein</option>
            </select>
          </Field>

          <div className="md:col-span-3">
            <Field label="Hinweis">
              <textarea name="note" defaultValue={w?.note ?? ""} className="w-full p-2 border rounded min-h-24" />
            </Field>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href={`/projects/${project.id}`} className="px-4 py-2 border rounded">Abbrechen</Link>
          <button className="px-4 py-2 rounded bg-black text-white">Speichern</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs opacity-60">{label}</span>
      {children}
    </label>
  );
}






