"use client";

import { useState, useEffect } from "react";

type PSNLogoProps = {
  size?: "small" | "medium" | "large";
  animated?: boolean;
  className?: string;
};

export function PSNLogo({ size = "small", animated = true, className = "" }: PSNLogoProps) {
  const [logoStage, setLogoStage] = useState(animated ? 0 : 2);

  useEffect(() => {
    if (!animated) return;

    // Stage 0: Show domain (1.5s)
    const timer1 = setTimeout(() => {
      setLogoStage(1); // Highlight P, S, N
    }, 1500);

    // Stage 1: Highlight letters (1s)
    const timer2 = setTimeout(() => {
      setLogoStage(2); // Show only PSN
    }, 2500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [animated]);

  // Size classes
  const sizeClasses = {
    small: {
      container: "px-3 py-2 min-h-[40px]",
      domainText: "text-[10px]",
      domainHighlight: "text-xs",
      psnText: "text-xl",
    },
    medium: {
      container: "px-4 py-3 min-h-[60px]",
      domainText: "text-xs",
      domainHighlight: "text-base",
      psnText: "text-3xl",
    },
    large: {
      container: "px-6 py-8 min-h-[120px]",
      domainText: "text-xs",
      domainHighlight: "text-xl",
      psnText: "text-5xl",
    },
  };

  const currentSize = sizeClasses[size];

  return (
    <div
      className={`group inline-flex items-center justify-center ${currentSize.container} rounded-xl bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 shadow-lg transform hover:scale-105 transition-all duration-500 relative overflow-hidden cursor-pointer ${className}`}
    >
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />

      {/* Stage 0 & 1: Domain with highlighted letters */}
      <span
        className={`absolute ${currentSize.domainText} font-medium text-white/90 transition-all duration-500 whitespace-nowrap ${
          logoStage === 2
            ? "opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100"
            : "opacity-100 scale-100"
        }`}
      >
        <span
          className={`transition-all duration-500 ${
            logoStage >= 1 ? `font-black ${currentSize.domainHighlight} uppercase` : ""
          }`}
        >
          p
        </span>
        rojekt.
        <span
          className={`transition-all duration-500 ${
            logoStage >= 1 ? `font-black ${currentSize.domainHighlight} uppercase` : ""
          }`}
        >
          s
        </span>
        erver-
        <span
          className={`transition-all duration-500 ${
            logoStage >= 1 ? `font-black ${currentSize.domainHighlight} uppercase` : ""
          }`}
        >
          n
        </span>
        ord.de
      </span>

      {/* Stage 2: PSN only */}
      <span
        className={`${currentSize.psnText} font-black text-white tracking-tight transition-all duration-700 ${
          logoStage === 2
            ? "opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-150"
            : "opacity-0 scale-150"
        }`}
      >
        PSN
      </span>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        :global(.animate-shimmer) {
          animation: shimmer 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
