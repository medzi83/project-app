import "./globals.css";
import AppShell from "@/components/AppShell";
import AuthSessionProvider from "@/components/AuthSessionProvider";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import type { ReactNode } from "react";

type ShellRole = "ADMIN" | "AGENT";

type RootLayoutProps = {
  children: ReactNode;
};

type SessionUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
  clientId?: string | null;
};

type AppSession = {
  user: SessionUser;
};

function resolveShellRole(session?: AppSession | null): ShellRole | null {
  if (!session?.user?.role) return null;
  return session.user.role === "ADMIN" ? "ADMIN" : "AGENT";
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const session = await getServerSession(authOptions);
  const hasSession = Boolean(session);
  const resolvedRole = hasSession ? resolveShellRole(session as AppSession) ?? "AGENT" : null;

  const shell = resolvedRole
    ? {
        name: session?.user?.name ?? session?.user?.email ?? "Unbekannt",
        role: resolvedRole,
      }
    : null;

  const isPrivileged = resolvedRole === "ADMIN" || resolvedRole === "AGENT";
  const counts = isPrivileged ? await loadCounts() : undefined;

  return (
    <html lang="de">
      <body>
        <AuthSessionProvider session={session}>
          {shell ? (
            <AppShell user={shell} counts={counts}>{children}</AppShell>
          ) : (
            children
          )}
        </AuthSessionProvider>
      </body>
    </html>
  );
}

async function loadCounts() {
  const [projectsOpen, projectsAll, agentsActive] = await Promise.all([
    prisma.project.count({ where: { status: { not: "ONLINE" } } }),
    prisma.project.count(),
    prisma.user.count({ where: { role: "AGENT", active: true } }),
  ]);

  return { projectsOpen, projectsAll, agentsActive };
}
