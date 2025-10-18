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
            ? "bg-red-100 border-red-300 text-red-800"
            : "bg-gray-50 border-gray-300 text-gray-400 hover:border-red-300 hover:text-red-600"
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
            ? "bg-gray-600 border-gray-700 text-white"
            : "bg-gray-50 border-gray-300 text-gray-400 hover:border-gray-600 hover:text-gray-700"
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
