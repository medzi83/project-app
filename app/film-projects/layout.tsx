import type { ReactNode } from "react";
import { EmailConfirmationHandler } from "@/components/EmailConfirmationHandler";

export default function FilmProjectsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <EmailConfirmationHandler />
    </>
  );
}
