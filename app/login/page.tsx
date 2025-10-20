"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
      router.refresh();
    }
  }, [status, router]);

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
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-6 p-8 border-2 border-blue-100 rounded-2xl bg-gradient-to-br from-white to-blue-50/30 shadow-xl"
      >
        <div className="text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Projektverwaltung
          </h1>
          <p className="mt-2 text-sm text-gray-600">Melden Sie sich an, um fortzufahren</p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ihre@email.de"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
        </div>

        {err && (
          <div className="rounded-lg border-2 border-red-200 bg-gradient-to-r from-red-50 to-pink-50 p-3 text-sm text-red-700 font-medium">
            {err}
          </div>
        )}

        <button
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          type="submit"
        >
          Einloggen
        </button>
      </form>
    </div>
  );
}
