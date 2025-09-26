import NextAuth, { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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


export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
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
    async jwt({ token, user }) {
      if (user) {
        const details = extractRoleAndClient(user);
        if (details.role) {
          token.role = details.role;
        }
        token.clientId = details.clientId;
      }
      return token;
    },
    async session({ session, token }) {
      const details = extractRoleAndClient(token);
      if (session.user) {
        session.user.role = details.role;
        session.user.clientId = details.clientId;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

