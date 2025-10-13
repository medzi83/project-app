"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type DevModeToggleProps = {
  currentUserId?: string | null;
  currentUserName?: string | null;
  agents: Array<{ id: string; name: string | null; categories: string[] }>;
};

export default function DevModeToggle({ currentUserId, currentUserName, agents }: DevModeToggleProps) {
  const router = useRouter();

  const setViewAs = async (userId: string | null) => {
    const response = await fetch("/api/dev/set-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (response.ok) {
      router.refresh();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          <span className="hidden md:inline">
            {currentUserName ? `Ansicht: ${currentUserName}` : "Admin-Ansicht"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Dev-Modus: Ansicht wechseln</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setViewAs(null)}>
          <span className="font-medium">Admin-Ansicht</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Als Agent anzeigen:
        </DropdownMenuLabel>
        {agents.map((agent) => (
          <DropdownMenuItem
            key={agent.id}
            onClick={() => setViewAs(agent.id)}
            className={currentUserId === agent.id ? "bg-accent" : ""}
          >
            <div className="flex flex-col">
              <span>{agent.name || "Unbenannt"}</span>
              {agent.categories.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {agent.categories.join(", ")}
                </span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
