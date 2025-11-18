import { EmailConfirmationHandler } from "@/components/EmailConfirmationHandler";

export default function PrintDesignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <EmailConfirmationHandler />
      {children}
    </>
  );
}
