import "./globals.css";
import AppShell from "@/components/AppShell";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  const user = session
    ? {
        name: session.user.name ?? session.user.email ?? "Unbekannt",
        role: session.user.role === "ADMIN" ? "ADMIN" : "AGENT",
      }
    : {
        name: "Gast",
        role: "AGENT" as const,
      };

  const counts = session && (session.user.role === "ADMIN" || session.user.role === "AGENT")
    ? await loadCounts()
    : undefined;

  return (
    <html lang="de">
      <body>
        <AppShell user={user} counts={counts}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}

async function loadCounts() {
  const [projectsOpen, projectsAll, agentsActive] = await Promise.all([
    prisma.project.count({ where: { status: { not: "DONE" } } }),
    prisma.project.count(),
    prisma.user.count({ where: { role: "AGENT", active: true } }),
  ]);

  return { projectsOpen, projectsAll, agentsActive };
}
