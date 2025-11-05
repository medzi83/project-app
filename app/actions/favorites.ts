"use server";

import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

export async function toggleFavoriteClient(clientId: string) {
  const session = await getAuthSession();
  if (!session?.user?.id || !session.user.role) {
    throw new Error("Not authenticated");
  }
  if (session.user.role !== "SALES") {
    throw new Error("Only SALES users can manage favorites");
  }

  // Check if already favorited
  const existing = await prisma.favoriteClient.findUnique({
    where: {
      userId_clientId: {
        userId: session.user.id,
        clientId: clientId,
      },
    },
  });

  if (existing) {
    // Remove from favorites
    await prisma.favoriteClient.delete({
      where: { id: existing.id },
    });
    return { isFavorite: false };
  } else {
    // Add to favorites
    await prisma.favoriteClient.create({
      data: {
        userId: session.user.id,
        clientId: clientId,
      },
    });
    return { isFavorite: true };
  }
}

export async function getFavoriteClients() {
  const session = await getAuthSession();
  if (!session?.user?.id || !session.user.role) {
    return [];
  }
  if (session.user.role !== "SALES") {
    return [];
  }

  const favorites = await prisma.favoriteClient.findMany({
    where: { userId: session.user.id },
    include: {
      client: {
        include: {
          agency: {
            select: {
              id: true,
              name: true,
              logoIconPath: true,
            },
          },
          projects: {
            select: {
              id: true,
              type: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return favorites.map((fav) => fav.client);
}

export async function isFavoriteClient(clientId: string) {
  const session = await getAuthSession();
  if (!session?.user?.id || !session.user.role) {
    return false;
  }
  if (session.user.role !== "SALES") {
    return false;
  }

  const favorite = await prisma.favoriteClient.findUnique({
    where: {
      userId_clientId: {
        userId: session.user.id,
        clientId: clientId,
      },
    },
  });

  return !!favorite;
}
