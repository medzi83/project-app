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

export async function saveProjectsSort(sort: string, dir: "asc" | "desc") {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  await prisma.userPreferences.upsert({
    where: { userId: session.user.id },
    update: {
      projectsSort: sort,
      projectsSortDir: dir,
    },
    create: {
      userId: session.user.id,
      projectsSort: sort,
      projectsSortDir: dir,
    },
  });
}

export async function saveFilmProjectsSort(sort: string, dir: "asc" | "desc") {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  await prisma.userPreferences.upsert({
    where: { userId: session.user.id },
    update: {
      filmProjectsSort: sort,
      filmProjectsSortDir: dir,
    },
    create: {
      userId: session.user.id,
      filmProjectsSort: sort,
      filmProjectsSortDir: dir,
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
