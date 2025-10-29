"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { InstallationAssignmentDialog } from "./InstallationAssignmentDialog";

type Installation = {
  id: string;
  folderName: string;
  installUrl: string;
};

type InstallationCheckData = {
  needsAssignment: boolean;
  hasInstallation: boolean;
  availableInstallations?: Installation[];
  defaultDomain?: string;
  clientId?: string;
};

type InstallationCheckEvent = CustomEvent<{
  projectId: string;
}>;

export function InstallationCheckHandler() {
  const [checkData, setCheckData] = useState<InstallationCheckData | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const pathname = usePathname();

  // Reset state when route changes
  useEffect(() => {
    setCheckData(null);
    setPendingProjectId(null);
    setIsDialogOpen(false);
  }, [pathname]);

  // Listen for installation check events
  useEffect(() => {
    const handleInstallationCheck = async (event: Event) => {
      const customEvent = event as InstallationCheckEvent;
      const { projectId } = customEvent.detail;

      try {
        const res = await fetch(`/api/projects/check-installation?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.needsAssignment) {
            setPendingProjectId(projectId);
            setCheckData(data);
            setIsDialogOpen(true);
          }
        }
      } catch (error) {
        console.error("Error checking for installation:", error);
      }
    };

    window.addEventListener("checkInstallation", handleInstallationCheck);

    return () => {
      window.removeEventListener("checkInstallation", handleInstallationCheck);
    };
  }, []);

  const handleClose = () => {
    setIsDialogOpen(false);
    setPendingProjectId(null);
    setCheckData(null);
  };

  if (!isDialogOpen || !pendingProjectId || !checkData?.needsAssignment) {
    return null;
  }

  return (
    <InstallationAssignmentDialog
      isOpen={isDialogOpen}
      projectId={pendingProjectId}
      clientId={checkData.clientId || ""}
      availableInstallations={checkData.availableInstallations || []}
      defaultDomain={checkData.defaultDomain || ""}
      onClose={handleClose}
    />
  );
}
