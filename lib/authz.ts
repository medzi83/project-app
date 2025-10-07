import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

type Role = "ADMIN" | "AGENT" | "CUSTOMER";

export type AuthSession = NonNullable<Awaited<ReturnType<typeof getServerSession>>> & {
  user: {
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