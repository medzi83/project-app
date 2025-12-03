"use client";

import { useState } from "react";
import { startTexterstellung } from "./actions";
import { useRouter } from "next/navigation";

type Props = {
  projectId: string;
  menuItems: { id: string; name: string; content: string }[];
  generalText?: { id: string; name: string; content: string };
};

export default function StartTexterstellungButton({ projectId, menuItems, generalText }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleStart = async () => {
    setLoading(true);
    try {
      await startTexterstellung(projectId, menuItems, generalText);
      router.refresh();
    } catch (error) {
      console.error("Fehler beim Starten der Texterstellung:", error);
      alert("Fehler beim Starten der Texterstellung");
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleStart}
      disabled={loading}
      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      {loading ? "Wird gestartet..." : "Texterstellung starten"}
    </button>
  );
}
