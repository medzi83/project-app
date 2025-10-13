import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

type Role = "ADMIN" | "AGENT" | "CUSTOMER";

export type AuthSession = NonNullable<Awaited<ReturnType<typeof getServerSession>>> & {
  user: {
    id?: string;
    role?: Role;
    clientId?: string | null;
    email?: string | null;
    name?: string | null;
  };
  expires?: string | null;
};

export async function getAuthSession(): Promise<AuthSession | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = (await getServerSession(authOptions as any)) as AuthSession | null;
  if (!session?.user) return null;
  return session;
}

/**
 * Get the effective user view for dev mode.
 * If admin has dev-view-as cookie set, return that agent's data.
 * Otherwise return the actual session user with their categories.
 */
export async function getEffectiveUser() {
  const session = await getAuthSession();
  if (!session) return null;

  const userId = session.user.id;

  // Only admins can use dev mode
  if (session.user.role !== "ADMIN") {
    // Load user's categories from database
    const user = userId ? await prisma.user.findUnique({
      where: { id: userId },
      select: { categories: true },
    }) : null;

    return {
      id: userId ?? null,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      role: session.user.role ?? "CUSTOMER",
      clientId: session.user.clientId ?? null,
      categories: user?.categories ?? [],
      isDevMode: false,
    };
  }

  const cookieStore = await cookies();
  const devViewAs = cookieStore.get("dev-view-as");

  if (devViewAs?.value) {
    // Load agent data
    const agent = await prisma.user.findUnique({
      where: { id: devViewAs.value, role: "AGENT" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        clientId: true,
        categories: true,
      },
    });

    if (agent) {
      return {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        clientId: agent.clientId,
        categories: agent.categories,
        isDevMode: true,
      };
    }
  }

  // Return admin with their categories
  const admin = userId ? await prisma.user.findUnique({
    where: { id: userId },
    select: { categories: true },
  }) : null;

  return {
    id: userId ?? null,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    role: session.user.role ?? "ADMIN",
    clientId: session.user.clientId ?? null,
    categories: admin?.categories ?? [],
    isDevMode: false,
  };
}

export async function requireRole(roles: Role[]): Promise<AuthSession> {
  const session = await getAuthSession();
  if (!session) throw new Error("UNAUTHORIZED");

  const role = (session.user.role ?? "CUSTOMER") as Role;
  if (!roles.includes(role)) throw new Error("FORBIDDEN");
  return session;
}

export async function requireAuthenticated(): Promise<AuthSession> {
  const session = await getAuthSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}