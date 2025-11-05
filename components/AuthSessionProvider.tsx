"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

export type AuthSessionProviderProps = {
  children: React.ReactNode;
  session: (Session & {
    user?: {
      id?: string;
      role?: "ADMIN" | "AGENT" | "CUSTOMER" | "SALES";
      clientId?: string | null;
      email?: string | null;
      name?: string | null;
    };
  }) | null;
};

export default function AuthSessionProvider({ children, session }: AuthSessionProviderProps) {
  const normalizedSession = session ? { ...session, expires: session.expires ?? "" } : undefined;
  return <SessionProvider session={normalizedSession}>{children}</SessionProvider>;
}