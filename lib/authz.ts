import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function requireRole(roles: ("ADMIN"|"AGENT"|"CUSTOMER")[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("UNAUTHORIZED");
  const role = (session.user.role || "CUSTOMER") as "ADMIN"|"AGENT"|"CUSTOMER";
  if (!roles.includes(role)) throw new Error("FORBIDDEN");
  return session;
}
