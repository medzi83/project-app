import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { updateFeedbackStatus, deleteFeedback } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/date-utils";

const feedbackTypeLabels: Record<string, string> = {
  BUG: "Bug/Fehler",
  SUGGESTION: "Vorschlag",
  IMPROVEMENT: "Verbesserung",
  OTHER: "Sonstiges",
};

const feedbackStatusLabels: Record<string, string> = {
  OPEN: "Offen",
  IN_PROGRESS: "In Bearbeitung",
  RESOLVED: "Erledigt",
  DISMISSED: "Abgelehnt",
};

const feedbackStatusVariant: Record<string, "default" | "secondary" | "outline" | "destructive" | "success"> = {
  OPEN: "default",
  IN_PROGRESS: "secondary",
  RESOLVED: "success",
  DISMISSED: "destructive",
};

export default async function KummerkastenPage() {
  const session = await requireRole(["ADMIN"]);
  if (!session.user?.id) {
    redirect("/login");
  }

  const feedbacks = await prisma.feedback.findMany({
    orderBy: [
      { type: "asc" },
      { status: "asc" },
      { createdAt: "desc" }
    ],
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        }
      }
    },
  });

  const stats = {
    open: feedbacks.filter(f => f.status === "OPEN").length,
    inProgress: feedbacks.filter(f => f.status === "IN_PROGRESS").length,
    resolved: feedbacks.filter(f => f.status === "RESOLVED").length,
    dismissed: feedbacks.filter(f => f.status === "DISMISSED").length,
  };

  // Group feedbacks by type
  const feedbacksByType = feedbacks.reduce((acc, feedback) => {
    if (!acc[feedback.type]) {
      acc[feedback.type] = [];
    }
    acc[feedback.type].push(feedback);
    return acc;
  }, {} as Record<string, typeof feedbacks>);

  const typeOrder = ["BUG", "IMPROVEMENT", "SUGGESTION", "OTHER"] as const;

  return (
    <main className="space-y-8">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Kummerkasten</h1>
          <p className="text-sm text-muted-foreground">
            Hier siehst du alle Verbesserungsvorschläge und Bug-Meldungen von deinen Agenten.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg border p-4">
            <div className="text-2xl font-bold">{stats.open}</div>
            <div className="text-sm text-muted-foreground">Offen</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <div className="text-sm text-muted-foreground">In Bearbeitung</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-2xl font-bold">{stats.resolved}</div>
            <div className="text-sm text-muted-foreground">Erledigt</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-2xl font-bold">{stats.dismissed}</div>
            <div className="text-sm text-muted-foreground">Abgelehnt</div>
          </div>
        </div>
      </section>

      <section>
        {feedbacks.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white p-6 text-center text-sm text-muted-foreground">
            Es wurden noch keine Feedbacks eingereicht.
          </div>
        ) : (
          <Tabs defaultValue="BUG" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              {typeOrder.map((type) => {
                const openCount = feedbacksByType[type]?.filter(f => f.status === "OPEN").length ?? 0;
                return (
                  <TabsTrigger key={type} value={type} className="relative">
                    {feedbackTypeLabels[type]}
                    {openCount > 0 && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {openCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {typeOrder.map((type) => {
              const typeFeedbacks = feedbacksByType[type] ?? [];

              return (
                <TabsContent key={type} value={type} className="space-y-4">
                  {typeFeedbacks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed bg-white p-6 text-center text-sm text-muted-foreground">
                      Keine {feedbackTypeLabels[type]}-Meldungen vorhanden.
                    </div>
                  ) : (
                    typeFeedbacks.map((feedback) => {
                    const isDimmed = feedback.status === "RESOLVED" || feedback.status === "DISMISSED";
                    return (
                      <article
                        key={feedback.id}
                        className={`rounded-2xl border bg-white p-6 shadow-sm space-y-4 ${isDimmed ? "opacity-60" : ""}`}
                      >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold">{feedback.title}</h3>
                    <Badge variant={feedbackStatusVariant[feedback.status]}>
                      {feedbackStatusLabels[feedback.status]}
                    </Badge>
                  </div>
                </div>

                <p className="whitespace-pre-wrap text-sm text-gray-700">{feedback.message}</p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span>
                  Eingereicht am {formatDateTime(feedback.createdAt)}
                </span>
                <span>
                  von <strong>{feedback.author.name ?? feedback.author.email ?? "Unbekannt"}</strong>
                  {" "}({feedback.author.role.toLowerCase()})
                </span>
                {feedback.updatedAt.getTime() !== feedback.createdAt.getTime() && (
                  <span>
                    Zuletzt aktualisiert: {formatDateTime(feedback.updatedAt)}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <form action={updateFeedbackStatus} className="flex gap-2 items-center">
                  <input type="hidden" name="id" value={feedback.id} />
                  <Select name="status" defaultValue={feedback.status}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Offen</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Bearbeitung</SelectItem>
                      <SelectItem value="RESOLVED">Erledigt</SelectItem>
                      <SelectItem value="DISMISSED">Abgelehnt</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" size="sm">
                    Status ändern
                  </Button>
                </form>

                <form action={deleteFeedback}>
                  <input type="hidden" name="id" value={feedback.id} />
                  <Button type="submit" size="sm" variant="destructive">
                    Löschen
                  </Button>
                </form>
              </div>
            </article>
                    );
                  })
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </section>
    </main>
  );
}
