"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  clientId: string;
  initialWorkStopped: boolean;
  initialFinished: boolean;
};

export function ClientStatusToggles({
  clientId,
  initialWorkStopped,
  initialFinished,
}: Props) {
  const router = useRouter();
  const [workStopped, setWorkStopped] = useState(initialWorkStopped);
  const [finished, setFinished] = useState(initialFinished);
  const [loading, setLoading] = useState<"workStopped" | "finished" | null>(null);

  const toggleStatus = async (field: "workStopped" | "finished") => {
    setLoading(field);

    try {
      const res = await fetch("/api/clients/toggle-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, field }),
      });

      if (!res.ok) {
        throw new Error("Failed to toggle status");
      }

      const data = await res.json();

      if (field === "workStopped") {
        setWorkStopped(data.workStopped);
      } else {
        setFinished(data.finished);
      }

      // Refresh the page to update all data
      router.refresh();
    } catch (error) {
      console.error("Error toggling status:", error);
      alert("Fehler beim Ändern des Status");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {/* Work Stopped Icon - Stop Sign */}
      <button
        onClick={() => toggleStatus("workStopped")}
        disabled={loading !== null}
        className={`flex items-center gap-2 px-3 py-2 rounded border transition-all ${
          workStopped
            ? "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300"
            : "bg-muted/50 border-border text-muted-foreground hover:border-red-300 dark:hover:border-red-800 hover:text-red-600 dark:hover:text-red-400"
        } ${loading === "workStopped" ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
        title={workStopped ? "Arbeitsstopp aktiv - Klicken zum Deaktivieren" : "Arbeitsstopp setzen"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5"
        >
          <path
            fillRule="evenodd"
            d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-xs font-medium">Arbeitsstopp</span>
      </button>

      {/* Finished Icon - X Mark */}
      <button
        onClick={() => toggleStatus("finished")}
        disabled={loading !== null}
        className={`flex items-center gap-2 px-3 py-2 rounded border transition-all ${
          finished
            ? "bg-gray-600 dark:bg-gray-300 border-gray-700 dark:border-gray-400 text-white dark:text-black"
            : "bg-muted/50 border-border text-muted-foreground hover:border-gray-600 dark:hover:border-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        } ${loading === "finished" ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
        title={finished ? "Beendet - Klicken zum Reaktivieren" : "Als beendet markieren"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5"
        >
          <path
            fillRule="evenodd"
            d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-xs font-medium">Beendet</span>
      </button>
    </div>
  );
}
