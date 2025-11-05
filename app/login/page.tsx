"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
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

  // Particle Network Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Create particles
    const particleCount = 80;
    const particles: Particle[] = [];
    const maxDistance = 150;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
      });
    }

    // Mouse move handler
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Animation loop
    let animationFrameId: number;
    const animate = () => {
      ctx.fillStyle = "rgba(15, 23, 42, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particles.forEach((particle, i) => {
        // Move particle
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Bounce off edges
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

        // Mouse interaction - attract particles
        const dx = mouseRef.current.x - particle.x;
        const dy = mouseRef.current.y - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 150) {
          const force = (150 - distance) / 150;
          particle.x += dx * force * 0.03;
          particle.y += dy * force * 0.03;
        }

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(147, 197, 253, 0.8)";
        ctx.fill();

        // Draw connections
        particles.slice(i + 1).forEach((otherParticle) => {
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < maxDistance) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            const opacity = 1 - distance / maxDistance;
            ctx.strokeStyle = `rgba(147, 197, 253, ${opacity * 0.3})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });

        // Connection to mouse
        const mouseDistance = Math.sqrt(
          Math.pow(mouseRef.current.x - particle.x, 2) +
          Math.pow(mouseRef.current.y - particle.y, 2)
        );
        if (mouseDistance < maxDistance) {
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
          const opacity = 1 - mouseDistance / maxDistance;
          ctx.strokeStyle = `rgba(168, 85, 247, ${opacity * 0.5})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
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
              autoComplete="off"
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
              autoComplete="off"
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
