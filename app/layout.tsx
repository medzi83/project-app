import "./globals.css";
import AppShell from "@/components/AppShell";
import AuthSessionProvider from "@/components/AuthSessionProvider";
import { SessionTimeout } from "@/components/SessionTimeout";
import { InstallationCheckHandler } from "@/components/InstallationCheckHandler";
import { getAuthSession, getEffectiveUser } from "@/lib/authz";

import { prisma } from "@/lib/prisma";
import type { ReactNode } from "react";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const preferredRegion = 'fra1';

type RootLayoutProps = {
  children: ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps) {
  const session = await getAuthSession();

  // Get effective user (might be an agent in dev mode)
  const effectiveUser = await getEffectiveUser();

  // Use effective user role for shell (respects dev mode)
  const effectiveRole = effectiveUser?.role === "ADMIN" ? "ADMIN" as const : effectiveUser?.role === "AGENT" ? "AGENT" as const : effectiveUser?.role === "SALES" ? "SALES" as const : null;

  const shell = effectiveRole
    ? {
        name: effectiveUser?.name ?? session?.user?.name ?? session?.user?.email ?? "Unbekannt",
        role: effectiveRole,
        categories: effectiveUser?.categories ?? [],
      }
    : null;

  const isPrivileged = effectiveRole === "ADMIN" || effectiveRole === "AGENT" || effectiveRole === "SALES";
  const counts = isPrivileged ? await loadCounts() : undefined;

  // Load dev mode data if actual session user is admin (not effective user)
  const devMode = session?.user?.role === "ADMIN" ? await loadDevModeData(effectiveUser) : undefined;

  // Load agencies with icons
  const agencies = await loadAgencies();

  return (
    <html lang="de">
      <body>
        <AuthSessionProvider session={session}>
          <SessionTimeout />
          {isPrivileged && <InstallationCheckHandler />}
          {/*
            AppShell (Navigation + Topbar) is only rendered when user is authenticated
            and has a valid role (ADMIN or AGENT). For login page, shell will be null
            and only children (login form) will be rendered without AppShell.
          */}
          {shell ? (
            <AppShell user={shell} counts={counts} devMode={devMode} agencies={agencies}>
              {children}
            </AppShell>
          ) : (
            // No session or no valid role: render only children (login page)
            // Middleware ensures only /login can be accessed without auth
            children
          )}
        </AuthSessionProvider>
      </body>
    </html>
  );
}

async function loadCounts() {
  const [projectsOpen, projectsAll, agentsActive, feedbackOpen] = await Promise.all([
    prisma.project.count({ where: { status: { not: "ONLINE" } } }),
    prisma.project.count(),
    prisma.user.count({ where: { role: "AGENT", active: true } }),
    prisma.feedback.count({ where: { status: "OPEN" } }),
  ]);

  return { projectsOpen, projectsAll, agentsActive, feedbackOpen };
}

async function loadDevModeData(effectiveUser: Awaited<ReturnType<typeof getEffectiveUser>>) {
  const agents = await prisma.user.findMany({
    where: { role: "AGENT", active: true },
    select: {
      id: true,
      name: true,
      categories: true,
    },
    orderBy: { name: "asc" },
  });

  return {
    isDevMode: effectiveUser?.isDevMode ?? false,
    currentViewUserId: effectiveUser?.isDevMode ? effectiveUser.id : null,
    currentViewUserName: effectiveUser?.isDevMode ? effectiveUser.name : null,
    availableAgents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      categories: a.categories,
    })),
  };
}

async function loadAgencies() {
  const agencies = await prisma.agency.findMany({
    where: {
      logoIconPath: { not: null },
    },
    select: {
      id: true,
      name: true,
      logoIconPath: true,
    },
    orderBy: { name: "asc" },
  });

  return agencies;
}
