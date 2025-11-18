import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { createNotice, updateNoticeActiveState, deleteNotice } from "@/app/notices/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const formatDateTime = (value: Date) =>
  new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(value);

export default async function AdminNoticesPage() {
  const session = await requireRole(["ADMIN"]);
  if (!session.user?.id) {
    redirect("/login");
  }

  const [agents, notices] = await Promise.all([
    prisma.user.findMany({
      where: { role: "AGENT", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
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
  ]);

  return (
    <main className="space-y-10">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Hinweise verwalten</h1>
          <p className="text-sm text-muted-foreground">
            Erstelle neue Hinweise für alle Agenten oder ausgewählte Teams.
          </p>
        </header>

        <form action={createNotice} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Titel</label>
              <Input name="title" placeholder="z. B. Wichtige Systemwartung" required />
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
                Bei Auswahl „Bestimmte Agenten“ muss mindestens eine Person gewählt werden.
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
          <h2 className="text-xl font-semibold text-foreground">Bestehende Hinweise</h2>
          <p className="text-sm text-muted-foreground">
            Aktive Hinweise werden auf dem Dashboard angezeigt. Hier siehst du auch den
            Bestätigungsstatus der Agenten.
          </p>
        </header>

        <div className="space-y-4">
          {notices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Es wurden noch keine Hinweise erstellt.
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
    </main>
  );
}
