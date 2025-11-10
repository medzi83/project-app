"use client";

import { useState } from "react";
import { TableRow } from "@/components/ui/table";

type ProjectRowProps = {
  children: React.ReactNode;
  rowClasses: string;
  projectId: string;
};

export function ProjectRow({ children, rowClasses, projectId }: ProjectRowProps) {
  const [isHighlighted, setIsHighlighted] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Check for both td (native) and TableCell elements
    const cell = target.closest("td, [role='cell']");

    // Only toggle highlight when clicking on the client-name-cell
    if (cell?.classList.contains("client-name-cell")) {
      e.preventDefault();
      setIsHighlighted(!isHighlighted);
    }
  };

  const highlightClasses = isHighlighted
    ? "ring-4 ring-blue-500 ring-inset shadow-lg"
    : "";

  return (
    <TableRow
      className={`${rowClasses} ${highlightClasses}`}
      onClick={handleClick}
      data-project-id={projectId}
    >
      {children}
    </TableRow>
  );
}
