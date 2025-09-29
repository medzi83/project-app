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
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 p-6 border rounded-xl bg-white shadow-sm">
        <h1 className="text-xl font-semibold">Login</h1>
        <input
          className="w-full p-2 border rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-Mail"
          autoComplete="email"
        />
        <input
          className="w-full p-2 border rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Passwort"
          autoComplete="current-password"
        />
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button className="w-full p-2 rounded bg-black text-white" type="submit">
          Einloggen
        </button>
      </form>
    </div>
  );
}
