import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { NoticeBoard, type NoticeBoardEntry } from "@/components/NoticeBoard";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Hinweis-Historie",
};

const buildTargetLabel = (
  visibility: "GLOBAL" | "TARGETED",
  role: string | undefined,
  recipients: Array<{ user: { name: string | null } }>,
) => {
  if (visibility === "GLOBAL") return undefined;
  if (role === "AGENT") return "Für dich";
  const names = recipients.map((entry) => entry.user.name).filter(Boolean) as string[];
  if (names.length === 0) return "Spezifische Agenten";
  if (names.length > 3) {
    const displayed = names.slice(0, 3).join(", ");
    return `${displayed} und ${names.length - 3} weitere`;
  }
  return names.join(", ");
};

export default async function NoticesPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  const userId = session.user.id;
  const role = session.user.role ?? "CUSTOMER";
  const isAdmin = role === "ADMIN";

  const notices = await prisma.notice.findMany({
    where: isAdmin
      ? {}
      : {
          OR: [
            { visibility: "GLOBAL" },
            { visibility: "TARGETED", recipients: { some: { userId } } },
          ],
        },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      recipients: {
        select: {
          user: { select: { name: true } },
        },
      },
      acknowledgements: {
        select: {
          userId: true,
          readAt: true,
        },
      },
    },
  });

  const active: NoticeBoardEntry[] = [];
  const archive: NoticeBoardEntry[] = [];

  notices.forEach((notice) => {
    const entry: NoticeBoardEntry = {
      id: notice.id,
      title: notice.title,
      message: notice.message,
      createdAt: notice.createdAt.toISOString(),
      requireAcknowledgement: notice.requireAcknowledgement,
      acknowledgedAt:
        notice.acknowledgements.find((ack) => ack.userId === userId)?.readAt?.toISOString() ?? null,
      visibility: notice.visibility,
      targetLabel: buildTargetLabel(notice.visibility, role, notice.recipients),
      authorName: notice.createdBy.name,
    };

    if (notice.isActive) {
      active.push(entry);
    } else {
      archive.push(entry);
    }
  });

  return (
    <main className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Hinweise</h1>
          <p className="text-sm text-muted-foreground">
            Übersicht aller systemweiten und persönlichen Hinweise.
          </p>
        </div>
        {isAdmin && <Badge variant="outline">Admin-Ansicht</Badge>}
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Aktive Hinweise</h2>
          <span className="text-sm text-muted-foreground">{active.length} Einträge</span>
        </div>
        <NoticeBoard notices={active} canAcknowledge={role === "AGENT"} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Archiv</h2>
          <span className="text-sm text-muted-foreground">{archive.length} Einträge</span>
        </div>
        <NoticeBoard notices={archive} />
      </section>
    </main>
  );
}
