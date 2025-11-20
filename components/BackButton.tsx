"use client";

import { useRouter } from "next/navigation";

type Props = {
  fallbackUrl?: string;
  className?: string;
};

export function BackButton({ fallbackUrl = "/", className }: Props) {
  const router = useRouter();

  const handleBack = () => {
    // Check if there's a history to go back to
    if (window.history.length > 1) {
      router.back();
    } else {
      // Fallback to a default URL if no history
      router.push(fallbackUrl);
    }
  };

  return (
    <button
      onClick={handleBack}
      className={className || "inline-flex items-center text-xs md:text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"}
    >
      <svg className="w-3 h-3 md:w-4 md:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Zurück
    </button>
  );
}
