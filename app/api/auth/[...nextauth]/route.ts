import NextAuth from "next-auth/next";
import type { Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const preferredRegion = 'fra1';

type UserRole = "ADMIN" | "AGENT" | "CUSTOMER";

type RoleAndClient = { role?: UserRole; clientId: string | null };

function extractRoleAndClient(value: unknown): RoleAndClient {
  if (typeof value === "object" && value !== null) {
    const potentialRole = (value as { role?: unknown }).role;
    const potentialClientId = (value as { clientId?: unknown }).clientId;
    const role = typeof potentialRole === "string" ? (potentialRole as UserRole) : undefined;
    const clientId = typeof potentialClientId === "string" ? potentialClientId : null;
    return { role, clientId };
  }
  return { clientId: null };
}


export const authOptions = {
  session: {
    strategy: "jwt" as const,
    maxAge: 12 * 60 * 60, // 12 hours in seconds
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email ?? "");
        const pw = String(creds?.password ?? "");
        if (!email || !pw) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const ok = bcrypt.compareSync(pw, user.password);
        if (!ok) return null;

        // Inhalte landen im JWT-Token
        return { id: user.id, email: user.email, name: user.name, role: user.role, clientId: user.clientId };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }: { token: Record<string, unknown>; user?: unknown; trigger?: string }) {
      // On sign-in, store the initial login time
      if (user) {
        const details = extractRoleAndClient(user);
        const userId = typeof (user as { id?: unknown }).id === "string" ? (user as { id: string }).id : undefined;
        if (userId) token.id = userId;
        if (details.role) {
          token.role = details.role;
        }
        token.clientId = details.clientId;
        token.iat = Math.floor(Date.now() / 1000); // Set initial authentication time
      }

      // Check if token has expired (12 hours)
      const iat = typeof token.iat === 'number' ? token.iat : Math.floor(Date.now() / 1000);
      const maxAge = 12 * 60 * 60; // 12 hours in seconds
      const currentTime = Math.floor(Date.now() / 1000);

      if (currentTime - iat > maxAge) {
        // Session expired, return null to force logout
        return {};
      }

      return token;
    },
    async session(params: { session: Session; token: Record<string, unknown> } & Record<string, unknown>): Promise<Session> {
      const { session, token } = params;
      const details = extractRoleAndClient(token);
      const userId = typeof token.id === "string" ? token.id : undefined;
      if (session.user) {
        if (userId) session.user.id = userId;
        session.user.role = details.role;
        session.user.clientId = details.clientId;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler = NextAuth(authOptions as any);
export { handler as GET, handler as POST };

