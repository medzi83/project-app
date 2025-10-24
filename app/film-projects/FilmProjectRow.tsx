"use client";

import { useState } from "react";

type FilmProjectRowProps = {
  children: React.ReactNode;
  rowClasses: string;
  projectId: string;
};

export function FilmProjectRow({ children, rowClasses, projectId }: FilmProjectRowProps) {
  const [isHighlighted, setIsHighlighted] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const td = target.closest("td");

    // Only toggle highlight when clicking on the client-name-cell
    if (td?.classList.contains("client-name-cell")) {
      e.preventDefault();
      setIsHighlighted(!isHighlighted);
    }
  };

  const highlightClasses = isHighlighted
    ? "ring-4 ring-blue-500 ring-inset shadow-lg"
    : "";

  return (
    <tr
      className={`${rowClasses} ${highlightClasses}`}
      onClick={handleClick}
      data-project-id={projectId}
    >
      {children}
    </tr>
  );
}
