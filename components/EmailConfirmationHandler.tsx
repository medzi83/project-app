"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { EmailConfirmationDialog } from "./EmailConfirmationDialog";

export function EmailConfirmationHandler() {
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [emptyChecks, setEmptyChecks] = useState(0);
  const [isPolling, setIsPolling] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();

  // Restart polling when route changes
  useEffect(() => {
    setIsPolling(true);
    setEmptyChecks(0);
  }, [pathname]);

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

  // Stop polling after 30 consecutive empty checks (60 seconds of no results)
  useEffect(() => {
    if (emptyChecks >= 30 && intervalRef.current) {
      console.log("No pending emails found after 60 seconds, stopping polling");
      setIsPolling(false);
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [emptyChecks]);

  const handleComplete = () => {
    setQueueIds([]);
    // Reload the page to show updated data
    window.location.reload();
  };

  if (queueIds.length === 0) return null;

  return <EmailConfirmationDialog queueIds={queueIds} onComplete={handleComplete} />;
}
