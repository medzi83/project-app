"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

export type AuthSessionProviderProps = {
  children: React.ReactNode;
  session: Session | null;
};

export default function AuthSessionProvider({ children, session }: AuthSessionProviderProps) {
  const normalizedSession = session ? { ...session, expires: session.expires ?? "" } : undefined;
  return <SessionProvider session={normalizedSession}>{children}</SessionProvider>;
}