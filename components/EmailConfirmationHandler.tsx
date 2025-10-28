"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { EmailConfirmationDialog } from "./EmailConfirmationDialog";
import { ClientDataDialog } from "./ClientDataDialog";

type MissingClientData = {
  clientId: string;
  clientName: string;
  currentEmail: string | null;
  currentSalutation: string | null;
  currentFirstname: string | null;
  currentLastname: string | null;
  currentAgencyId: string | null;
  missingEmail: boolean;
  missingContact: boolean;
  missingAgency: boolean;
} | null;

export function EmailConfirmationHandler() {
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [emptyChecks, setEmptyChecks] = useState(0);
  const [isPolling, setIsPolling] = useState(true);
  const [pollingReason, setPollingReason] = useState<"initial" | "userClick">("initial");
  const [missingClientData, setMissingClientData] = useState<MissingClientData>(null);
  const [checkingClientData, setCheckingClientData] = useState(false);
  const [clientDataChecked, setClientDataChecked] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();

  // Restart polling when route changes
  useEffect(() => {
    setIsPolling(true);
    setEmptyChecks(0);
    setPollingReason("initial");
    setClientDataChecked(false);
    setMissingClientData(null);
  }, [pathname]);

  // Check if client data is missing when queueIds change
  useEffect(() => {
    const checkClientData = async () => {
      if (queueIds.length === 0 || checkingClientData || clientDataChecked) return;

      setCheckingClientData(true);

      try {
        // Check first queue item for missing client data
        const res = await fetch(`/api/email/confirm?queueId=${queueIds[0]}`);
        if (res.ok) {
          const data = await res.json();
          const client = data.client;
          const queueEmail = data.toEmail || "";

          if (client) {
            const missingEmail = !client.email || client.email.trim() === "";
            const missingContact = (!client.firstname || client.firstname.trim() === "") && (!client.lastname || client.lastname.trim() === "");
            const missingAgency = !client.agencyId;

            // If queue email is empty but client has email, update queue and skip pre-dialog
            if (queueEmail.trim() === "" && !missingEmail) {
              // Update queue with client email
              await fetch(`/api/email/update-queue`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  queueId: queueIds[0],
                  toEmail: client.email
                }),
              });
              // Skip pre-dialog and show email dialog directly
              setCheckingClientData(false);
              setClientDataChecked(true);
              return;
            }

            if (missingEmail || missingContact || missingAgency) {
              // Show pre-dialog for missing data (with existing data included)
              setMissingClientData({
                clientId: client.id,
                clientName: client.name,
                currentEmail: client.email || null,
                currentSalutation: client.salutation || null,
                currentFirstname: client.firstname || null,
                currentLastname: client.lastname || null,
                currentAgencyId: client.agencyId || null,
                missingEmail,
                missingContact,
                missingAgency,
              });
            }
          }
        }
      } catch (error) {
        console.error("Error checking client data:", error);
      } finally {
        setCheckingClientData(false);
        setClientDataChecked(true);
      }
    };

    checkClientData();
  }, [queueIds, checkingClientData, clientDataChecked]);

  useEffect(() => {
    // Check for pending email confirmations from database
    const checkForPendingEmails = async () => {
      try {
        const res = await fetch("/api/email/pending-confirmations");
        if (res.ok) {
          const data = await res.json();
          if (data.queueIds && data.queueIds.length > 0) {
            setQueueIds(data.queueIds);
            setEmptyChecks(0); // Reset counter when we find pending emails
          } else {
            // Increment empty check counter only if still polling
            if (isPolling) {
              setEmptyChecks((prev) => prev + 1);
            }
          }
        }
      } catch (error) {
        console.error("Error checking for pending emails:", error);
      }
    };

    // Only set up interval if polling is active
    if (!isPolling) {
      return;
    }

    // Check immediately on mount
    checkForPendingEmails();

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      // Only check if no dialog is currently open and polling is active
      if (queueIds.length === 0 && isPolling) {
        checkForPendingEmails();
      }
    }, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [queueIds.length, isPolling]);

  // Stop polling based on reason:
  // - Initial page load: 5 checks (10 seconds) to catch queued emails
  // - User clicked field: 15 checks (30 seconds) to wait for user input
  useEffect(() => {
    const maxChecks = pollingReason === "initial" ? 5 : 15;

    if (emptyChecks >= maxChecks && intervalRef.current) {
      setIsPolling(false);
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [emptyChecks, pollingReason]);

  // Restart polling when user clicks on an editable field
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Check if click is on or within an InlineCell button
      const target = e.target as HTMLElement;
      const isInlineCell = target.closest('button[title="Zum Bearbeiten klicken"]');

      if (isInlineCell && !isPolling) {
        setIsPolling(true);
        setPollingReason("userClick");
        setEmptyChecks(0);
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [isPolling]);

  const handleComplete = () => {
    setQueueIds([]);
    // Reload the page to show updated data
    window.location.reload();
  };

  const handleClientDataComplete = async () => {
    // Set reloading state to prevent email dialog from showing
    setIsReloading(true);

    // Client data has been saved, now re-trigger email queue processing
    // This will re-render the email with the new data

    // Small delay to ensure database transaction is committed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Re-fetch the first queue item to trigger re-rendering
    try {
      const res = await fetch(`/api/email/rerender?queueId=${queueIds[0]}`, {
        method: "POST",
      });

      if (!res.ok) {
        console.error("Failed to re-render email");
      }
    } catch (error) {
      console.error("Error re-rendering email:", error);
    }

    // Force reload - isReloading=true prevents email dialog from showing
    window.location.reload();
  };

  const handleClientDataCancel = () => {
    // User canceled - remove this queue item and show next (if any)
    setMissingClientData(null);
    setQueueIds([]);
  };

  const handleBackToClientData = async () => {
    // Fetch current client data and show pre-dialog again
    try {
      const res = await fetch(`/api/email/confirm?queueId=${queueIds[0]}`);
      if (res.ok) {
        const data = await res.json();
        const client = data.client;

        if (client) {
          setMissingClientData({
            clientId: client.id,
            clientName: client.name,
            currentEmail: client.email || null,
            currentSalutation: client.salutation || null,
            currentFirstname: client.firstname || null,
            currentLastname: client.lastname || null,
            currentAgencyId: client.agencyId || null,
            missingEmail: false, // Allow editing even if not missing
            missingContact: false,
            missingAgency: false,
          });
          setClientDataChecked(false); // Reset to show pre-dialog again
        }
      }
    } catch (error) {
      console.error("Error fetching client data:", error);
    }
  };

  if (queueIds.length === 0) return null;

  // Wait for client data check to complete before showing any dialog
  if (!clientDataChecked) {
    return null; // Don't show anything while checking
  }

  // If reloading, keep showing pre-dialog (don't show email dialog)
  if (isReloading && missingClientData) {
    return (
      <ClientDataDialog
        isOpen={true}
        clientId={missingClientData.clientId}
        clientName={missingClientData.clientName}
        currentEmail={missingClientData.currentEmail}
        currentSalutation={missingClientData.currentSalutation}
        currentFirstname={missingClientData.currentFirstname}
        currentLastname={missingClientData.currentLastname}
        currentAgencyId={missingClientData.currentAgencyId}
        missingEmail={missingClientData.missingEmail}
        missingContact={missingClientData.missingContact}
        missingAgency={missingClientData.missingAgency}
        onComplete={handleClientDataComplete}
        onCancel={handleClientDataCancel}
      />
    );
  }

  // Show pre-dialog if client data is missing
  if (missingClientData) {
    return (
      <ClientDataDialog
        isOpen={true}
        clientId={missingClientData.clientId}
        clientName={missingClientData.clientName}
        currentEmail={missingClientData.currentEmail}
        currentSalutation={missingClientData.currentSalutation}
        currentFirstname={missingClientData.currentFirstname}
        currentLastname={missingClientData.currentLastname}
        currentAgencyId={missingClientData.currentAgencyId}
        missingEmail={missingClientData.missingEmail}
        missingContact={missingClientData.missingContact}
        missingAgency={missingClientData.missingAgency}
        onComplete={handleClientDataComplete}
        onCancel={handleClientDataCancel}
      />
    );
  }

  // Don't show email dialog while reloading
  if (isReloading) {
    return null;
  }

  // Show email confirmation dialog only after client data check is complete
  return (
    <EmailConfirmationDialog
      queueIds={queueIds}
      onComplete={handleComplete}
      onBackToClientData={handleBackToClientData}
    />
  );
}
