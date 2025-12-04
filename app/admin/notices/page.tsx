import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import {
  createNotice,
  updateNoticeActiveState,
  deleteNotice,
  createCustomerNotice,
  updateCustomerNoticeActiveState,
  deleteCustomerNotice,
} from "@/app/notices/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditAgentNoticeDialog, EditCustomerNoticeDialog } from "./EditNoticeDialog";

const formatDateTime = (value: Date) =>
  new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(value);

const TARGET_GROUP_LABELS: Record<string, string> = {
  ALL_CUSTOMERS: "Alle Kunden",
  AGENCY_CUSTOMERS: "Agentur-Kunden",
  SELECTED_CUSTOMERS: "Ausgewählte Kunden",
};

export default async function AdminNoticesPage() {
  const session = await requireRole(["ADMIN"]);
  if (!session.user?.id) {
    redirect("/login");
  }

  const [agents, notices, agencies, clients, customerNotices] = await Promise.all([
    // Agenten für Agenten-Hinweise
    prisma.user.findMany({
      where: { role: "AGENT", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    // Bestehende Agenten-Hinweise
    prisma.notice.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
        recipients: {
          select: {
            userId: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        acknowledgements: {
          select: {
            userId: true,
            readAt: true,
            user: { select: { name: true } },
          },
        },
      },
    }),
    // Agenturen für Kunden-Hinweise (EM/VW)
    prisma.agency.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Kunden mit Portal-Zugang für ausgewählte Kunden
    prisma.client.findMany({
      where: { portalEnabled: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, customerNo: true, agency: { select: { name: true } } },
    }),
    // Bestehende Kunden-Hinweise
    prisma.customerNotice.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
        agency: { select: { name: true } },
        recipients: {
          select: {
            clientId: true,
            client: { select: { id: true, name: true, customerNo: true } },
          },
        },
      },
      // showOnDashboard is automatically included by default
    }),
  ]);

  return (
    <main className="space-y-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Hinweise verwalten</h1>
        <p className="text-sm text-muted-foreground">
          Erstelle Hinweise für Agenten (intern) oder für Kunden (Kundenportal).
        </p>
      </header>

      <Tabs defaultValue="agents" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Agenten-Hinweise
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Kunden-Hinweise (Portal)
          </TabsTrigger>
        </TabsList>

        {/* ===== AGENTEN-HINWEISE TAB ===== */}
        <TabsContent value="agents" className="space-y-10">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <header className="mb-6">
              <h2 className="text-xl font-semibold text-foreground">Neuer Agenten-Hinweis</h2>
              <p className="text-sm text-muted-foreground">
                Hinweise für Agenten werden auf deren Dashboard angezeigt.
              </p>
            </header>

            <form action={createNotice} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Titel</label>
                  <Input name="title" placeholder="z. B. Wichtige Systemwartung" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Sichtbarkeit</label>
                  <div className="flex gap-3 rounded-lg border border-border bg-background p-3 text-sm text-foreground">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="visibility" value="GLOBAL" defaultChecked />
                      Global
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="visibility" value="TARGETED" />
                      Bestimmte Agenten
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Bei Auswahl „Bestimmte Agenten" muss mindestens eine Person gewählt werden.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Nachricht</label>
                <Textarea
                  name="message"
                  rows={5}
                  required
                  placeholder="Beschreibe den Hinweis…"
                  className="resize-y"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Empfänger (Agenten)</label>
                <select
                  name="recipients"
                  multiple
                  className="w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground"
                  size={Math.min(agents.length, 8)}
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name ?? agent.email ?? agent.id}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Für globale Hinweise wird die Auswahl ignoriert.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    name="requireAcknowledgement"
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                  />
                  Bestätigung durch Agenten erforderlich
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                  />
                  Sofort im Dashboard anzeigen
                </label>
              </div>

              <Button type="submit">Hinweis erstellen</Button>
            </form>
          </section>

          <section className="space-y-6">
            <header>
              <h2 className="text-xl font-semibold text-foreground">Bestehende Agenten-Hinweise</h2>
              <p className="text-sm text-muted-foreground">
                Aktive Hinweise werden auf dem Dashboard angezeigt.
              </p>
            </header>

            <div className="space-y-4">
              {notices.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  Es wurden noch keine Agenten-Hinweise erstellt.
                </div>
              ) : (
                notices.map((notice) => {
                  const recipientEntries =
                    notice.visibility === "GLOBAL"
                      ? agents.map((agent) => {
                          const acknowledgement = notice.acknowledgements.find(
                            (ack) => ack.userId === agent.id,
                          );
                          return {
                            label: agent.name ?? agent.email ?? agent.id,
                            readAt: acknowledgement?.readAt ?? null,
                          };
                        })
                      : notice.recipients.map((recipient) => {
                          const acknowledgement = notice.acknowledgements.find(
                            (ack) => ack.userId === recipient.userId,
                          );
                          return {
                            label:
                              recipient.user.name ?? recipient.user.email ?? recipient.user.id,
                            readAt: acknowledgement?.readAt ?? null,
                          };
                        });

                  const acknowledgedCount = recipientEntries.filter((entry) => entry.readAt).length;

                  return (
                    <article
                      key={notice.id}
                      className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-foreground">{notice.title}</h3>
                        {notice.isActive ? (
                          <Badge variant="default">Aktiv</Badge>
                        ) : (
                          <Badge variant="outline">Archiviert</Badge>
                        )}
                        <Badge variant="secondary">
                          {notice.visibility === "GLOBAL" ? "Global" : "Gezielt"}
                        </Badge>
                        {notice.requireAcknowledgement && (
                          <Badge variant="secondary">
                            Bestätigung erforderlich ({acknowledgedCount}/{recipientEntries.length})
                          </Badge>
                        )}
                      </div>

                      <p className="whitespace-pre-wrap text-sm text-foreground">{notice.message}</p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span>Erstellt am {formatDateTime(notice.createdAt)}</span>
                        <span>von {notice.createdBy.name ?? "Unbekannt"}</span>
                        {notice.requireAcknowledgement && (
                          <span>
                            Letzte Bestätigung:{" "}
                            {notice.acknowledgements.length > 0
                              ? formatDateTime(
                                  notice.acknowledgements
                                    .map((ack) => ack.readAt)
                                    .sort((a, b) => b.getTime() - a.getTime())[0],
                                )
                              : "noch keine Bestätigungen"}
                          </span>
                        )}
                      </div>

                      <details className="rounded-lg border border-border bg-muted/50 dark:bg-muted/20 p-4">
                        <summary className="cursor-pointer text-sm font-medium text-foreground">
                          Bestätigungen anzeigen
                        </summary>
                        <div className="mt-3 space-y-2 text-sm">
                          {recipientEntries.length === 0 ? (
                            <p className="text-muted-foreground">Keine Empfänger hinterlegt.</p>
                          ) : (
                            recipientEntries.map((entry) => (
                              <div
                                key={entry.label}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
                              >
                                <span className="text-foreground">{entry.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  {entry.readAt ? `Gelesen am ${formatDateTime(entry.readAt)}` : "Noch offen"}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </details>

                      <div className="flex flex-wrap items-center gap-3">
                        <EditAgentNoticeDialog
                          notice={{
                            id: notice.id,
                            title: notice.title,
                            message: notice.message,
                            visibility: notice.visibility,
                            requireAcknowledgement: notice.requireAcknowledgement,
                            isActive: notice.isActive,
                            recipients: notice.recipients,
                          }}
                          agents={agents}
                        />

                        <form
                          action={async () => {
                            "use server";
                            await updateNoticeActiveState(notice.id, !notice.isActive);
                          }}
                        >
                          <Button type="submit" variant="outline">
                            {notice.isActive ? "Inaktiv setzen" : "Aktivieren"}
                          </Button>
                        </form>

                        <form
                          action={async () => {
                            "use server";
                            await deleteNotice(notice.id);
                          }}
                        >
                          <Button type="submit" variant="destructive">
                            Löschen
                          </Button>
                        </form>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </TabsContent>

        {/* ===== KUNDEN-HINWEISE TAB ===== */}
        <TabsContent value="customers" className="space-y-10">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <header className="mb-6">
              <h2 className="text-xl font-semibold text-foreground">Neuer Kunden-Hinweis</h2>
              <p className="text-sm text-muted-foreground">
                Hinweise für Kunden werden im Kundenportal unter „News" angezeigt.
              </p>
            </header>

            <form action={createCustomerNotice} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Titel</label>
                  <Input name="title" placeholder="z. B. Wartungsarbeiten am Wochenende" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Zielgruppe</label>
                  <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 text-sm text-foreground">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="targetGroup" value="ALL_CUSTOMERS" defaultChecked />
                      Alle Kunden
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="targetGroup" value="AGENCY_CUSTOMERS" />
                      Nur Kunden einer Agentur (EM/VW)
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="targetGroup" value="SELECTED_CUSTOMERS" />
                      Ausgewählte Kunden
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Nachricht</label>
                <Textarea
                  name="message"
                  rows={5}
                  required
                  placeholder="Beschreibe den Hinweis für Kunden…"
                  className="resize-y"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    Agentur <span className="text-xs text-muted-foreground">(für Agentur-Kunden)</span>
                  </label>
                  <select
                    name="agencyId"
                    className="w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground"
                  >
                    <option value="">-- Agentur auswählen --</option>
                    {agencies.map((agency) => (
                      <option key={agency.id} value={agency.id}>
                        {agency.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Wird nur bei „Nur Kunden einer Agentur" verwendet.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    Kunden <span className="text-xs text-muted-foreground">(für ausgewählte Kunden)</span>
                  </label>
                  <select
                    name="recipients"
                    multiple
                    className="w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground"
                    size={Math.min(clients.length, 8)}
                  >
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                        {client.customerNo ? ` (${client.customerNo})` : ""}
                        {client.agency?.name ? ` - ${client.agency.name}` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Wird nur bei „Ausgewählte Kunden" verwendet. Nur Kunden mit Portal-Zugang.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    name="showOnDashboard"
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                  />
                  Auch auf Dashboard anzeigen (wichtig)
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                  />
                  Sofort im Kundenportal anzeigen
                </label>
              </div>

              <Button type="submit">Kunden-Hinweis erstellen</Button>
            </form>
          </section>

          <section className="space-y-6">
            <header>
              <h2 className="text-xl font-semibold text-foreground">Bestehende Kunden-Hinweise</h2>
              <p className="text-sm text-muted-foreground">
                Diese Hinweise werden im Kundenportal unter „News" angezeigt.
              </p>
            </header>

            <div className="space-y-4">
              {customerNotices.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  Es wurden noch keine Kunden-Hinweise erstellt.
                </div>
              ) : (
                customerNotices.map((notice) => (
                  <article
                    key={notice.id}
                    className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-foreground">{notice.title}</h3>
                      {notice.isActive ? (
                        <Badge variant="default">Aktiv</Badge>
                      ) : (
                        <Badge variant="outline">Archiviert</Badge>
                      )}
                      <Badge variant="secondary">
                        {TARGET_GROUP_LABELS[notice.targetGroup] || notice.targetGroup}
                      </Badge>
                      {notice.targetGroup === "AGENCY_CUSTOMERS" && notice.agency && (
                        <Badge variant="outline">{notice.agency.name}</Badge>
                      )}
                      {notice.targetGroup === "SELECTED_CUSTOMERS" && (
                        <Badge variant="outline">{notice.recipients.length} Kunde(n)</Badge>
                      )}
                      {notice.showOnDashboard && (
                        <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">
                          Dashboard
                        </Badge>
                      )}
                    </div>

                    <p className="whitespace-pre-wrap text-sm text-foreground">{notice.message}</p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span>Erstellt am {formatDateTime(notice.createdAt)}</span>
                      <span>von {notice.createdBy.name ?? "Unbekannt"}</span>
                    </div>

                    {notice.targetGroup === "SELECTED_CUSTOMERS" && notice.recipients.length > 0 && (
                      <details className="rounded-lg border border-border bg-muted/50 dark:bg-muted/20 p-4">
                        <summary className="cursor-pointer text-sm font-medium text-foreground">
                          Empfänger anzeigen ({notice.recipients.length})
                        </summary>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {notice.recipients.map((recipient) => (
                            <span
                              key={recipient.clientId}
                              className="inline-block px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                            >
                              {recipient.client.name}
                              {recipient.client.customerNo ? ` (${recipient.client.customerNo})` : ""}
                            </span>
                          ))}
                        </div>
                      </details>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <EditCustomerNoticeDialog
                        notice={{
                          id: notice.id,
                          title: notice.title,
                          message: notice.message,
                          targetGroup: notice.targetGroup,
                          agencyId: notice.agencyId,
                          showOnDashboard: notice.showOnDashboard,
                          isActive: notice.isActive,
                          recipients: notice.recipients,
                        }}
                        agencies={agencies}
                        clients={clients}
                      />

                      <form
                        action={async () => {
                          "use server";
                          await updateCustomerNoticeActiveState(notice.id, !notice.isActive);
                        }}
                      >
                        <Button type="submit" variant="outline">
                          {notice.isActive ? "Inaktiv setzen" : "Aktivieren"}
                        </Button>
                      </form>

                      <form
                        action={async () => {
                          "use server";
                          await deleteCustomerNotice(notice.id);
                        }}
                      >
                        <Button type="submit" variant="destructive">
                          Löschen
                        </Button>
                      </form>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </main>
  );
}
