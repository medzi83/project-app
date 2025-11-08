import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
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

export default async function UserKummerkastenPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  const feedbacks = await prisma.feedback.findMany({
    where: {
      authorId: session.user.id,
    },
    orderBy: [
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

  // Mark all feedbacks as viewed by the author
  await prisma.feedback.updateMany({
    where: {
      authorId: session.user.id,
      viewedByAuthor: false, // Only update feedbacks that haven't been viewed yet
    },
    data: {
      viewedByAuthor: true,
    },
  });

  const stats = {
    open: feedbacks.filter(f => f.status === "OPEN").length,
    inProgress: feedbacks.filter(f => f.status === "IN_PROGRESS").length,
    resolved: feedbacks.filter(f => f.status === "RESOLVED").length,
    dismissed: feedbacks.filter(f => f.status === "DISMISSED").length,
  };

  return (
    <main className="space-y-8">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Mein Kummerkasten</h1>
          <p className="text-sm text-muted-foreground">
            Hier siehst du alle deine eingereichten Verbesserungsvorschläge und Bug-Meldungen.
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

      <section className="space-y-4">
        {feedbacks.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white p-6 text-center text-sm text-muted-foreground">
            Du hast noch keine Feedbacks eingereicht.
          </div>
        ) : (
          feedbacks.map((feedback) => {
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
                    <Badge variant="secondary">
                      {feedbackTypeLabels[feedback.type]}
                    </Badge>
                  </div>
                </div>

                <p className="whitespace-pre-wrap text-sm text-gray-700">{feedback.message}</p>

                {feedback.adminResponse && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-green-700">Admin-Antwort:</div>
                    <p className="whitespace-pre-wrap text-sm text-gray-700 bg-green-50 border border-green-200 rounded p-3">
                      {feedback.adminResponse}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    Eingereicht am {formatDateTime(feedback.createdAt)}
                  </span>
                  {feedback.updatedAt.getTime() !== feedback.createdAt.getTime() && (
                    <span>
                      Zuletzt aktualisiert: {formatDateTime(feedback.updatedAt)}
                    </span>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
