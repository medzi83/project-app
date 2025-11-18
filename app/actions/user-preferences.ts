"use server";

import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

export async function getUserPreferences() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return null;
  }

  const preferences = await prisma.userPreferences.findUnique({
    where: { userId: session.user.id },
  });

  return preferences;
}

export async function saveProjectsFilter(
  status?: string[],
  priority?: string[],
  cms?: string[],
  agent?: string[]
) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  await prisma.userPreferences.upsert({
    where: { userId: session.user.id },
    update: {
      projectsStatusFilter: status ?? [],
      projectsPriorityFilter: priority ?? [],
      projectsCmsFilter: cms ?? [],
      projectsAgentFilter: agent ?? [],
    },
    create: {
      userId: session.user.id,
      projectsStatusFilter: status ?? [],
      projectsPriorityFilter: priority ?? [],
      projectsCmsFilter: cms ?? [],
      projectsAgentFilter: agent ?? [],
    },
  });
}

export async function saveFilmProjectsFilter(
  agent?: string[],
  status?: string[],
  pstatus?: string[],
  scope?: string[]
) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  await prisma.userPreferences.upsert({
    where: { userId: session.user.id },
    update: {
      filmProjectsAgentFilter: agent ?? [],
      filmProjectsStatusFilter: status ?? [],
      filmProjectsPStatusFilter: pstatus ?? [],
      filmProjectsScopeFilter: scope ?? [],
    },
    create: {
      userId: session.user.id,
      filmProjectsAgentFilter: agent ?? [],
      filmProjectsStatusFilter: status ?? [],
      filmProjectsPStatusFilter: pstatus ?? [],
      filmProjectsScopeFilter: scope ?? [],
    },
  });
}

export async function savePrintDesignFilter(
  agent?: string[],
  status?: string[],
  projectType?: string[]
) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  await prisma.userPreferences.upsert({
    where: { userId: session.user.id },
    update: {
      printDesignAgentFilter: agent ?? [],
      printDesignStatusFilter: status ?? [],
      printDesignProjectTypeFilter: projectType ?? [],
    },
    create: {
      userId: session.user.id,
      printDesignAgentFilter: agent ?? [],
      printDesignStatusFilter: status ?? [],
      printDesignProjectTypeFilter: projectType ?? [],
    },
  });
}
