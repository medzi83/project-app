"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * SessionTimeout component
 * Monitors session status and redirects to login when session expires
 */
export function SessionTimeout() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;

    // If session is unauthenticated and we haven't redirected yet
    if (status === "unauthenticated" && !hasRedirected.current) {
      hasRedirected.current = true;

      // Show a message to the user
      const currentPath = window.location.pathname;
      if (currentPath !== "/login") {
        // Store the attempted URL for redirect after login
        sessionStorage.setItem("redirectAfterLogin", currentPath);

        // Redirect to login
        router.push("/login?expired=true");
      }
    }

    // Reset redirect flag when authenticated
    if (status === "authenticated") {
      hasRedirected.current = false;
    }
  }, [status, router]);

  // Check session every 5 minutes
  useEffect(() => {
    if (status !== "authenticated") return;

    const interval = setInterval(() => {
      // Trigger a session check by accessing the session
      if (session) {
        // Session is still valid, do nothing
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [status, session]);

  // This component doesn't render anything
  return null;
}
