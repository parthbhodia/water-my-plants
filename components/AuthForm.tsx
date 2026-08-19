"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Mode = "signin" | "signup";

export default function AuthForm() {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);

    const timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { timezone },
          },
        });
        if (error) throw error;
        if (data.session) {
          router.push("/garden");
          router.refresh();
        } else {
          // New users are auto-confirmed server-side (DB trigger), so a
          // direct sign-in works immediately — no email round-trip needed.
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (!signInErr) {
            router.push("/garden");
            router.refresh();
          } else {
            setNote(
              "🌱 Almost there! Check your inbox for a confirmation email, then come back here and sign in."
            );
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/garden");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <h2>{mode === "signin" ? "Welcome back 🌿" : "Plant your first seed 🌱"}</h2>
      <p className="auth-sub">
        {mode === "signin"
          ? "Your lily has been waiting for you."
          : "Create an account so your lily remembers you every day."}
      </p>

      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@pond.garden"
      />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        required
        minLength={6}
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="at least 6 characters"
      />

      <button className="btn" type="submit" disabled={busy}>
        {busy ? "…" : mode === "signin" ? "Enter the garden" : "Create account"}
      </button>

      {error && <div className="auth-error">{error}</div>}
      {note && <div className="auth-note">{note}</div>}

      <div className="auth-switch">
        {mode === "signin" ? (
          <>
            New gardener?{" "}
            <button type="button" onClick={() => { setMode("signup"); setError(null); }}>
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have a lily?{" "}
            <button type="button" onClick={() => { setMode("signin"); setError(null); }}>
              Sign in
            </button>
          </>
        )}
      </div>
    </form>
  );
}
