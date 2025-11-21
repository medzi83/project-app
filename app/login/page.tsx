"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Snowflake {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  drift: number;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [logoStage, setLogoStage] = useState(0); // 0: domain, 1: highlight, 2: PSN
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const router = useRouter();
  const { status } = useSession();

  // Check for session expiry
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('expired') === 'true') {
      setSessionExpired(true);
      // Clear the URL parameter
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
      router.refresh();
    }
  }, [status, router]);

  // Winter Mountain Landscape Animation (Performance Optimized)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Create background canvas for static mountains
    const bgCanvas = document.createElement("canvas");
    const bgCtx = bgCanvas.getContext("2d");
    if (!bgCtx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      bgCanvas.width = canvas.width;
      bgCanvas.height = canvas.height;
      drawMountains();
    };

    // Draw mountain landscape once (static background)
    const drawMountains = () => {
      const width = bgCanvas.width;
      const height = bgCanvas.height;

      // Sky gradient (dark blue to lighter blue)
      const skyGradient = bgCtx.createLinearGradient(0, 0, 0, height);
      skyGradient.addColorStop(0, "rgba(10, 25, 47, 1)");
      skyGradient.addColorStop(1, "rgba(30, 58, 95, 1)");
      bgCtx.fillStyle = skyGradient;
      bgCtx.fillRect(0, 0, width, height);

      // Back mountain layer (darkest)
      bgCtx.fillStyle = "rgba(20, 40, 70, 0.8)";
      bgCtx.beginPath();
      bgCtx.moveTo(0, height);
      for (let i = 0; i <= width; i += 50) {
        const y = height * 0.5 + Math.sin(i * 0.01) * 80 - Math.abs(Math.sin(i * 0.005)) * 120;
        bgCtx.lineTo(i, y);
      }
      bgCtx.lineTo(width, height);
      bgCtx.closePath();
      bgCtx.fill();

      // Middle mountain layer
      bgCtx.fillStyle = "rgba(35, 60, 95, 0.9)";
      bgCtx.beginPath();
      bgCtx.moveTo(0, height);
      for (let i = 0; i <= width; i += 40) {
        const y = height * 0.6 + Math.sin(i * 0.015) * 60 - Math.abs(Math.cos(i * 0.008)) * 100;
        bgCtx.lineTo(i, y);
      }
      bgCtx.lineTo(width, height);
      bgCtx.closePath();
      bgCtx.fill();

      // Front mountain layer (lightest)
      bgCtx.fillStyle = "rgba(50, 80, 120, 1)";
      bgCtx.beginPath();
      bgCtx.moveTo(0, height);
      for (let i = 0; i <= width; i += 30) {
        const y = height * 0.7 + Math.sin(i * 0.02) * 50 - Math.abs(Math.sin(i * 0.01)) * 80;
        bgCtx.lineTo(i, y);
      }
      bgCtx.lineTo(width, height);
      bgCtx.closePath();
      bgCtx.fill();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Create snowflakes (reduced count for better performance)
    const snowflakeCount = 80;
    const snowflakes: Snowflake[] = [];

    for (let i = 0; i < snowflakeCount; i++) {
      snowflakes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1,
        speed: Math.random() * 1 + 0.3,
        opacity: Math.random() * 0.8 + 0.2,
        drift: Math.random() * 0.8 - 0.4,
      });
    }

    // Animation loop
    let animationFrameId: number;
    const animate = () => {
      // Copy static mountain background
      ctx.drawImage(bgCanvas, 0, 0);

      // Update and draw snowflakes (without shadow blur for better performance)
      snowflakes.forEach((snowflake) => {
        // Move snowflake down and sideways
        snowflake.y += snowflake.speed;
        snowflake.x += snowflake.drift;

        // Reset snowflake if it goes off screen
        if (snowflake.y > canvas.height) {
          snowflake.y = -10;
          snowflake.x = Math.random() * canvas.width;
        }
        if (snowflake.x < -10) snowflake.x = canvas.width + 10;
        if (snowflake.x > canvas.width + 10) snowflake.x = -10;

        // Draw snowflake (simple circle, no glow for performance)
        ctx.beginPath();
        ctx.arc(snowflake.x, snowflake.y, snowflake.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${snowflake.opacity})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await signIn("credentials", { redirect: false, email, password });
    if (res?.ok) {
      router.replace("/dashboard");
      router.refresh();
    } else {
      setErr("Login fehlgeschlagen");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-slate-900">
      {/* Interactive Particle Network Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
      />

      {/* Glass Card */}
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-md space-y-8 p-10 rounded-3xl bg-white/[0.08] backdrop-blur-2xl border-2 border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]"
      >
        {/* Animated Logo with Domain -> PSN Transformation */}
        <div className="text-center space-y-4">
          <div className="group inline-flex items-center justify-center px-6 py-8 min-h-[120px] rounded-2xl bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 shadow-2xl transform hover:scale-105 transition-all duration-500 relative overflow-hidden cursor-pointer">
            {/* Animated gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>

            {/* Stage 0 & 1: Domain with highlighted letters */}
            <span
              className={`absolute text-xs font-medium text-white/90 transition-all duration-500 whitespace-nowrap ${
                logoStage === 2 ? 'opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100' : 'opacity-100 scale-100'
              }`}
            >
              <span className={`transition-all duration-500 ${logoStage >= 1 ? 'font-black text-xl uppercase' : ''}`}>p</span>
              rojekt.
              <span className={`transition-all duration-500 ${logoStage >= 1 ? 'font-black text-xl uppercase' : ''}`}>s</span>
              erver-
              <span className={`transition-all duration-500 ${logoStage >= 1 ? 'font-black text-xl uppercase' : ''}`}>n</span>
              ord.de
            </span>

            {/* Stage 2: PSN only */}
            <span
              className={`text-5xl font-black text-white tracking-tight transition-all duration-700 ${
                logoStage === 2 ? 'opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-150' : 'opacity-0 scale-150'
              }`}
            >
              PSN
            </span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">
              Projektverwaltung
            </h1>
            <p className="mt-2 text-sm text-gray-300">Melden Sie sich an, um fortzufahren</p>
          </div>
        </div>

        {/* Input Fields with Floating Labels */}
        <div className="space-y-6">
          <div className="relative">
            <input
              id="email"
              type="email"
              className="peer w-full px-4 py-3 pt-6 border-2 border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/5 backdrop-blur-sm text-white placeholder-transparent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              placeholder="ihre@email.de"
              autoComplete="email"
            />
            <label
              htmlFor="email"
              className={`absolute left-4 transition-all duration-200 text-gray-300 pointer-events-none ${
                email || focusedField === "email"
                  ? "top-2 text-xs text-blue-400"
                  : "top-3.5 text-base"
              }`}
            >
              E-Mail
            </label>
          </div>

          <div className="relative">
            <input
              id="password"
              type="password"
              className="peer w-full px-4 py-3 pt-6 border-2 border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/5 backdrop-blur-sm text-white placeholder-transparent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <label
              htmlFor="password"
              className={`absolute left-4 transition-all duration-200 text-gray-300 pointer-events-none ${
                password || focusedField === "password"
                  ? "top-2 text-xs text-blue-400"
                  : "top-3.5 text-base"
              }`}
            >
              Passwort
            </label>
          </div>
        </div>

        {sessionExpired && (
          <div className="rounded-xl border-2 border-amber-400/50 bg-amber-500/20 backdrop-blur-sm p-4 text-sm text-amber-200 font-medium">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-semibold">Session abgelaufen</p>
                <p className="text-xs mt-1">Ihre Session ist nach 12 Stunden abgelaufen. Bitte melden Sie sich erneut an.</p>
              </div>
            </div>
          </div>
        )}

        {err && (
          <div className="rounded-xl border-2 border-red-400/50 bg-red-500/20 backdrop-blur-sm p-4 text-sm text-red-200 font-medium animate-shake">
            {err}
          </div>
        )}

        <button
          className="w-full py-4 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
          type="submit"
        >
          <span className="relative z-10">Einloggen</span>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </button>
      </form>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }
          10%, 30%, 50%, 70%, 90% {
            transform: translateX(-5px);
          }
          20%, 40%, 60%, 80% {
            transform: translateX(5px);
          }
        }
        :global(.animate-shimmer) {
          animation: shimmer 3s ease-in-out infinite;
        }
        :global(.animate-shake) {
          animation: shake 0.5s;
        }
      `}</style>
    </div>
  );
}
