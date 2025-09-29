"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

export type AuthSessionProviderProps = {
  children: React.ReactNode;
  session: Session | null;
};

export default function AuthSessionProvider({ children, session }: AuthSessionProviderProps) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
