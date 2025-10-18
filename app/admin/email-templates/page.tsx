import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";
import { deleteEmailTemplate, updateEmailTemplate } from "./actions";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import TemplateCreationTabs from "./TemplateCreationTabs";
import TemplateSlideout from "./TemplateSlideout";
import EditTemplateForm from "./EditTemplateForm";
import type { VariableGroup } from "./VariableGroupsPanel";
import { DEFAULT_SIGNATURE_KEY } from "./constants";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const fmtDate = (value: Date) =>
  new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(value);

const readMessage = (value: string | string[] | undefined) =>
  typeof value === "string" ? decodeURIComponent(value) : undefined;

const VARIABLE_GROUPS: VariableGroup[] = [
  {
    label: "Kunden",
    items: [
      { placeholder: "{{client.name}}", description: "Name des Kunden" },
      { placeholder: "{{client.contact}}", description: "Ansprechperson des Kunden" },
      { placeholder: "{{client.phone}}", description: "Telefonnummer des Kunden" },
      { placeholder: "{{client.customerNo}}", description: "Kundennummer" },
    ],
  },
  {
    label: "Webseitenprojekt",
    items: [
      { placeholder: "{{project.title}}", description: "Titel des Projekts" },
      { placeholder: "{{project.status}}", description: "Aktueller Projektstatus" },
      { placeholder: "{{project.webDate}}", description: "Geplanter Webtermin (Datum und Uhrzeit)" },
      { placeholder: "{{project.webterminType}}", description: "Art des Webtermins (Telefonisch, Beim Kunden, In der Agentur)" },
      { placeholder: "{{project.demoDate}}", description: "Termin für Demo" },
      { placeholder: "{{project.agentName}}", description: "Name des zuständigen Agents" },
    ],
  },
  {
    label: "Webseitenprojekt - Links",
    items: [
      { placeholder: "{{website.domain}}", description: "Domain der Webseite" },
      { placeholder: "{{website.demoLink}}", description: "Link zur Demo-Version" },
    ],
  },
  {
    label: "Filmprojekt",
    items: [
      { placeholder: "{{film.scope}}", description: "Art des Filmprojekts" },
      { placeholder: "{{film.status}}", description: "Status des Filmprojekts" },
      { placeholder: "{{film.shootDate}}", description: "Drehtermin" },
      { placeholder: "{{film.filmerName}}", description: "Filmer Name" },
      { placeholder: "{{film.cutterName}}", description: "Cutter Name" },
    ],
  },
  {
    label: "Filmprojekt - Links",
    items: [
      { placeholder: "{{film.previewLink}}", description: "Link zur neuesten Vorabversion" },
      { placeholder: "{{film.previewDate}}", description: "Datum der neuesten Vorabversion" },
      { placeholder: "{{film.finalLink}}", description: "Link zur finalen Version" },
      { placeholder: "{{film.onlineLink}}", description: "Link zur Online-Version" },
    ],
  },
  {
    label: "Agent",
    items: [
      { placeholder: "{{agent.name}}", description: "Anzeigename des Agents (Kurzname)" },
      { placeholder: "{{agent.fullName}}", description: "Voller Name des Agents" },
      { placeholder: "{{agent.roleTitle}}", description: "Rollenbezeichnung des Agents" },
      { placeholder: "{{agent.email}}", description: "E-Mail des Agents" },
      { placeholder: "{{agent.categories}}", description: "Kommagetrennte Agent Kategorien" },
    ],
  },
];

export default async function EmailTemplatesAdminPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const params = await searchParams;
  const successMessage = readMessage(params.success);
  const errorMessage = readMessage(params.error);

  const [templates, signatureRecords, agencies] = await Promise.all([
    prisma.emailTemplate.findMany({
      orderBy: [{ title: "asc" }, { createdAt: "desc" }],
    }),
    prisma.emailSignature.findMany({}),
    prisma.agency.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const defaultSignatureRecord = signatureRecords.find(
    (record) => !record.agencyId || record.key === DEFAULT_SIGNATURE_KEY,
  );
  const signatureOptions = [
    { agencyId: null, label: "Standard (alle Agenturen)", body: defaultSignatureRecord?.body ?? "" },
    ...agencies.map((agency) => {
      const record = signatureRecords.find((item) => item.agencyId === agency.id);
      return { agencyId: agency.id, label: agency.name, body: record?.body ?? "" };
    }),
  ];
  const orphanSignatures = signatureRecords.filter(
    (record) => record.agencyId && !agencies.some((agency) => agency.id === record.agencyId),
  );
  for (const orphan of orphanSignatures) {
    signatureOptions.push({
      agencyId: orphan.agencyId,
      label: `Unbekannte Agentur (${orphan.agencyId})`,
      body: orphan.body,
    });
  }
  return (
    <div className="space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">E-Mail-Vorlagen</h1>
        <p className="text-sm text-gray-500">
          Verwalte bestehende Vorlagen und lege neue Vorlagen für automatisierte E-Mails an.
        </p>
        {successMessage && <p className="text-sm text-green-700">{successMessage}</p>}
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      </header>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Vorlagen & Signatur</h2>
        <p className="text-sm text-gray-500">
          Lege neue Vorlagen an oder pflege Signaturen pro Agentur. Nutze die Tabs, um zwischen den Bereichen zu wechseln.
        </p>
        <div className="mt-4">
          <TemplateCreationTabs variableGroups={VARIABLE_GROUPS} signatureOptions={signatureOptions} />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Bestehende Vorlagen</h2>
          <span className="text-sm text-gray-500">{templates.length} Einträge</span>
        </div>

        {templates.length === 0 ? (
          <p className="text-sm text-gray-500">Es sind noch keine Vorlagen vorhanden.</p>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <TemplateSlideout
                key={template.id}
                title={template.title}
                subtitle={template.subject}
                meta={`Stand ${fmtDate(template.updatedAt)}`}
              >
                <EditTemplateForm
                  id={template.id}
                  initialTitle={template.title}
                  initialSubject={template.subject}
                  initialBody={template.body}
                />

                <form action={deleteEmailTemplate} className="mt-4">
                  <input type="hidden" name="id" value={template.id} />
                  <ConfirmSubmit
                    confirmText="Diese Vorlage wirklich löschen? Dies kann nicht rückgängig gemacht werden."
                    className="rounded border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                  >
                    Vorlage löschen
                  </ConfirmSubmit>
                </form>
              </TemplateSlideout>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
