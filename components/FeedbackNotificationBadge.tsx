"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function FeedbackNotificationBadge() {
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

    // Poll every 30 seconds
    const interval = setInterval(fetchCount, 30000);

    return () => clearInterval(interval);
  }, []);

  // Refresh count when navigating away from kummerkasten
  useEffect(() => {
    if (!pathname.includes("/kummerkasten")) {
      fetchCount();
    }
  }, [pathname]);

  if (count === 0) return null;

  return (
    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full">
      {count}
    </span>
  );
}
