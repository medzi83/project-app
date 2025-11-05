"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { toggleFavoriteClient } from "@/app/actions/favorites";
import { useRouter } from "next/navigation";

type Props = {
  clientId: string;
  initialIsFavorite: boolean;
  size?: "sm" | "md" | "lg";
};

export function FavoriteToggle({ clientId, initialIsFavorite, size = "md" }: Props) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsLoading(true);
    try {
      const result = await toggleFavoriteClient(clientId);
      setIsFavorite(result.isFavorite);
      router.refresh();
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const iconSize = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-6 w-6" : "h-4 w-4";

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`transition-all ${isLoading ? "opacity-50 cursor-not-allowed" : "hover:scale-110"}`}
      title={isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
    >
      <Star
        className={`${iconSize} transition-all ${
          isFavorite
            ? "fill-yellow-400 stroke-yellow-500"
            : "stroke-gray-400 hover:stroke-yellow-500"
        }`}
      />
    </button>
  );
}
