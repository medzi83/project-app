import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";
import { createTrigger, updateTrigger, deleteTrigger, toggleTrigger } from "./actions";
import { TriggerForm } from "./TriggerForm";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const str = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function EmailTriggersPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const sp = await searchParams;
  const error = str(sp.error);
  const success = str(sp.success);

  const [triggers, templates] = await Promise.all([
    prisma.emailTrigger.findMany({
      include: {
        template: true,
        _count: {
          select: {
            queuedEmails: true,
            sentLogs: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.emailTemplate.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">E-Mail Trigger</h1>
          <p className="text-sm text-gray-500">
            Automatische E-Mail-Versendung basierend auf Projekt-Events konfigurieren
          </p>
        </div>
        <details className="relative">
          <summary className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-black/90">
            Neuer Trigger
          </summary>
          <div className="absolute right-0 mt-2 w-[600px] max-h-[600px] overflow-y-auto space-y-4 rounded-lg border bg-white p-6 shadow-xl z-10">
            <h3 className="text-lg font-semibold">Neuen Trigger erstellen</h3>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <TriggerForm action={createTrigger} templates={templates} />
          </div>
        </details>
      </div>

      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {success === "created" && "Trigger erfolgreich erstellt"}
          {success === "updated" && "Trigger erfolgreich aktualisiert"}
          {success === "deleted" && "Trigger erfolgreich gelöscht"}
        </div>
      )}

      {/* Trigger Liste */}
      <div className="space-y-4">
        {triggers.map((trigger) => {
          const conditions = trigger.conditions as Record<string, unknown>;
          const recipientConfig = trigger.recipientConfig as Record<string, unknown>;

          return (
            <div
              key={trigger.id}
              className={`rounded-lg border p-6 ${trigger.active ? "bg-white" : "bg-gray-50"}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{trigger.name}</h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        trigger.active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {trigger.active ? "Aktiv" : "Inaktiv"}
                    </span>
                    <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-medium">
                      {trigger.triggerType}
                    </span>
                    {trigger.projectType && (
                      <span className="px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs font-medium">
                        {trigger.projectType}
                      </span>
                    )}
                  </div>
                  {trigger.description && (
                    <p className="text-sm text-gray-600">{trigger.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <form action={toggleTrigger}>
                    <input type="hidden" name="id" value={trigger.id} />
                    <input type="hidden" name="active" value={trigger.active.toString()} />
                    <button
                      type="submit"
                      className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                    >
                      {trigger.active ? "Deaktivieren" : "Aktivieren"}
                    </button>
                  </form>
                  <form action={deleteTrigger}>
                    <input type="hidden" name="id" value={trigger.id} />
                    <button
                      type="submit"
                      className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                      onClick={(e) => {
                        if (!confirm(`Trigger "${trigger.name}" wirklich löschen?`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      Löschen
                    </button>
                  </form>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-500">Template:</span>{" "}
                  <span>{trigger.template.title}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500">Verzögerung:</span>{" "}
                  <span>
                    {trigger.delayDays != null
                      ? `${trigger.delayDays} Tage ${trigger.delayType === "BEFORE" ? "vorher" : trigger.delayType === "AFTER" ? "nachher" : "genau"}`
                      : "Sofort"}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-500">Bedingung:</span>{" "}
                  <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                    {JSON.stringify(conditions)}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-500">Empfänger:</span>{" "}
                  <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                    {JSON.stringify(recipientConfig)}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-500">Warteschlange:</span>{" "}
                  <span>{trigger._count.queuedEmails} E-Mails</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500">Versendet:</span>{" "}
                  <span>{trigger._count.sentLogs} E-Mails</span>
                </div>
              </div>
            </div>
          );
        })}

        {triggers.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <p className="text-gray-500">Noch keine E-Mail-Trigger konfiguriert.</p>
            <p className="text-sm text-gray-400 mt-1">
              Klicken Sie auf "Neuer Trigger", um einen Trigger anzulegen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
