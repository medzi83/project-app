import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { labelForProductionStatus, labelForWebsitePriority, labelForSeoStatus, labelForTextitStatus } from "@/lib/project-status";import { createClient, createProject } from "./actions";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type Option = { value: string; label: string };

const PRIORITIES = ["NONE", "PRIO_1", "PRIO_2", "PRIO_3"] as const;
const CMS = ["SHOPWARE", "WORDPRESS", "JOOMLA", "LOGO", "PRINT", "CUSTOM", "OTHER"] as const;
const PRODUCTION = ["NONE", "BEENDET", "MMW", "VOLLST_A_K"] as const;
const SEO = ["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA"] as const;
const TEXTIT = ["NEIN", "NEIN_NEIN", "JA_NEIN", "JA_JA"] as const;
const TRI = [
  { value: "unknown", label: "(nicht gesetzt)" },
  { value: "yes", label: "Ja" },
  { value: "no", label: "Nein" },
];
const MATERIAL_STATUS = [
  { value: "ANGEFORDERT", label: "angefordert" },
  { value: "TEILWEISE", label: "teilweise" },
  { value: "VOLLSTAENDIG", label: "vollständig" },
  { value: "NV", label: "N.V." },
];

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function NewProjectPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!["ADMIN", "AGENT"].includes(session.user.role || "")) redirect("/projects");

  const params = await searchParams;
  const clientError = str(params.clientError);
  const projectError = str(params.projectError);
  const clientIdFromQuery = str(params.cid);

  const [clients, agents] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: "AGENT" }, orderBy: { name: "asc" } }),
  ]);

  const clientOptions: Option[] = clients.map((c) => ({
    value: c.id,
    label: c.customerNo ? `${c.customerNo} | ${c.name}` : c.name,
  }));

  const agentOptions: Option[] = [
    { value: "", label: "- ohne Agent -" },
    ...agents.map((a) => ({ value: a.id, label: a.name ?? a.email })),
  ];

  return (
    <div className="p-6 space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Projekt anlegen</h1>
        <p className="text-sm text-muted-foreground">
          Lege hier zuerst optional einen neuen Kunden an und erstelle anschlieend das Projekt.
        </p>
      </header>

      <details className="rounded-lg border" open={Boolean(clientError)}>
        <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Neuen Kunden anlegen</h2>
            <p className="text-sm text-muted-foreground">
              Bereits vorhandene Kunden findest du weiter unten im Projektformular in der Auswahl.
            </p>
          </div>
          <span className="text-sm text-muted-foreground">optional</span>
        </summary>
        <div className="border-t px-6 py-6 space-y-4">
          {clientError && <p className="text-sm text-red-600">{clientError}</p>}
          <form action={createClient} className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Name *</span>
              <input name="name" required className="p-2 border rounded" placeholder="z. B. Muster GmbH" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Kundennummer</span>
              <input name="customerNo" className="p-2 border rounded" placeholder="optional" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Ansprechpartner</span>
              <input name="contact" className="p-2 border rounded" placeholder="optional" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Telefon</span>
              <input name="phone" className="p-2 border rounded" placeholder="optional" />
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Notiz</span>
              <textarea name="notes" rows={3} className="p-2 border rounded" placeholder="interne Hinweise" />
            </label>
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="px-4 py-2 bg-black text-white rounded">
                Kunde speichern
              </button>
            </div>
          </form>
        </div>
      </details>

      <section className="rounded-lg border p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Projektformular</h2>
          <p className="text-sm text-muted-foreground">
            Alle Felder lassen sich nach dem Anlegen weiter bearbeiten.
          </p>
        </div>
        {clientIdFromQuery && !clientError && (
          <p className="text-sm text-green-700">
            Neuer Kunde wurde angelegt und ist vorausgewhlt.
          </p>
        )}
        {projectError && <p className="text-sm text-red-600">{projectError}</p>}

        <form action={createProject} className="space-y-8">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Titel *</span>
              <input name="title" required className="p-2 border rounded" placeholder="Projektname" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Kunde *</span>
              <select
                name="clientId"
                required
                defaultValue={clientIdFromQuery && clientOptions.some((c) => c.value === clientIdFromQuery) ? clientIdFromQuery : ""}
                className="p-2 border rounded"
              >
                <option value="">Bitte auswhlen</option>
                {clientOptions.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Agent</span>
              <select name="agentId" defaultValue="" className="p-2 border rounded">
                {agentOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Domain</span>
              <input name="domain" className="p-2 border rounded" placeholder="www.example.de" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Prioritt</span>
              <select name="priority" defaultValue="NONE" className="p-2 border rounded">
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">CMS</span>
              <select name="cms" defaultValue="SHOPWARE" className="p-2 border rounded">
                {CMS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">CMS (falls OTHER/CUSTOM)</span>
              <input name="cmsOther" className="p-2 border rounded" placeholder="optional" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Produktionsstatus</span>
              <select name="pStatus" defaultValue="NONE" className="p-2 border rounded">
                {PRODUCTION.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <DateField name="webDate" label="Webtermin" />
            <DateField name="demoDate" label="Demo an Kunden" />
            <DateField name="onlineDate" label="Go-Live" />
            <DateField name="lastMaterialAt" label="Letzter Materialeingang" />
            <NumberField name="effortBuildMin" label="Aufwand Umsetzung (Stunden)" />
            <NumberField name="effortDemoMin" label="Aufwand Demo (Stunden)" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <SelectField name="materialStatus" label="Material" options={MATERIAL_STATUS} defaultValue="ANGEFORDERT" />
            <SelectField name="seo" label="SEO" options={SEO.map((v) => ({ value: v, label: v }))} defaultValue="NEIN" />
            <SelectField name="textit" label="Textit" options={TEXTIT.map((v) => ({ value: v, label: v }))} defaultValue="NEIN" />
            <SelectField name="accessible" label="Barrierefrei" options={TRI} defaultValue="unknown" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Demolink</span>
              <input name="demoLink" className="p-2 border rounded" placeholder="https://..." />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Interne Notiz</span>
              <textarea name="note" rows={3} className="p-2 border rounded" placeholder="optional" />
            </label>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Link href="/projects" className="px-4 py-2 border rounded">Abbrechen</Link>
            <button type="submit" className="px-4 py-2 bg-black text-white rounded">Projekt speichern</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DateField({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <input type="date" name={name} className="p-2 border rounded" />
    </label>
  );
}

function NumberField({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <input type="number" name={name} className="p-2 border rounded" min={0} step={0.5} inputMode="decimal" />
    </label>
  );
}

function SelectField({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: Option[];
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <select name={name} defaultValue={defaultValue} className="p-2 border rounded">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}













