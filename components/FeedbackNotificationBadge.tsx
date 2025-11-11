"use client";

import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import { usePathname } from "next/navigation";

// Context for sharing feedback count across all badge instances
type FeedbackContextType = {
  count: number;
  fetchCount: () => void;
};

const FeedbackContext = createContext<FeedbackContextType | null>(null);

export function FeedbackNotificationProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  const fetchCount = () => {
    fetch("/api/feedback/unread-count", { cache: "no-store" })
      .then(res => res.json())
      .then(data => setCount(data.count))
      .catch(err => console.error("Failed to fetch feedback count:", err));
  };

  useEffect(() => {
    // Fetch initial count
    fetchCount();

    // Only poll every 30 seconds when on the dashboard
    const isDashboard = pathname === "/dashboard";
    if (!isDashboard) {
      return; // No polling on other pages
    }

    const interval = setInterval(fetchCount, 30000);

    return () => clearInterval(interval);
  }, [pathname]);

  // Refresh count when navigating away from kummerkasten
  useEffect(() => {
    if (!pathname.includes("/kummerkasten")) {
      fetchCount();
    }
  }, [pathname]);

  return (
    <FeedbackContext.Provider value={{ count, fetchCount }}>
      {children}
    </FeedbackContext.Provider>
  );
}

export function FeedbackNotificationBadge() {
  const context = useContext(FeedbackContext);

  if (!context) {
    console.warn("FeedbackNotificationBadge must be used within FeedbackNotificationProvider");
    return null;
  }

  const { count } = context;

  if (count === 0) return null;

  return (
    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full">
      {count}
    </span>
  );
}
