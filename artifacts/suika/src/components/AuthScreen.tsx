import React, { useState } from "react";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { Globe, TreeDeciduous, FlaskConical } from "lucide-react";

type AuthTheme = "lunar" | "warm-earth" | "bio";

const THEME_KEY = "suika-auth-theme";

function getStoredTheme(): AuthTheme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "lunar" || v === "warm-earth" || v === "bio") return v;
  } catch {}
  return "bio";
}

function saveTheme(t: AuthTheme) {
  try { localStorage.setItem(THEME_KEY, t); } catch {}
}

interface FormProps {
  isLogin: boolean;
  username: string;
  password: string;
  error: string;
  isPending: boolean;
  onUsername: (v: string) => void;
  onPassword: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onToggle: () => void;
  theme: AuthTheme;
  onTheme: (t: AuthTheme) => void;
}

function ThemePicker({ current, onChange }: { current: AuthTheme; onChange: (t: AuthTheme) => void }) {
  const themes: { id: AuthTheme; color: string; label: string }[] = [
    { id: "lunar",      color: "#b8d4ff", label: "Lunar / Still" },
    { id: "warm-earth", color: "#c97b3a", label: "Warm Earth" },
    { id: "bio",        color: "#00e5c0", label: "Bioluminescent" },
  ];
  return (
    <div className="flex items-center gap-3 justify-center" role="group" aria-label="Choose theme">
      {themes.map(({ id, color, label }) => (
        <button
          key={id}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={current === id}
          onClick={() => onChange(id)}
          style={{
            width: current === id ? 10 : 7,
            height: current === id ? 10 : 7,
            borderRadius: "50%",
            backgroundColor: color,
            opacity: current === id ? 1 : 0.35,
            border: current === id ? `1.5px solid ${color}` : "none",
            padding: 0,
            cursor: "pointer",
            transition: "all 0.3s ease",
            boxShadow: current === id ? `0 0 8px ${color}55` : "none",
          }}
        />
      ))}
    </div>
  );
}

// ── Compact auth card (used on the guest screen) ──────────────────────────────

export function AuthCard({ onSuccess }: { onSuccess: () => void }) {
  const [theme, setTheme] = useState<AuthTheme>(getStoredTheme);
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const isPending = loginMutation.isPending || registerMutation.isPending;

  const accentColor =
    theme === "lunar" ? "#b8d4ff" : theme === "warm-earth" ? "#c97b3a" : "#00e5c0";

  const handleTheme = (t: AuthTheme) => { setTheme(t); saveTheme(t); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username || !password) { setError("Please fill in all fields."); return; }
    const mutation = isLogin ? loginMutation : registerMutation;
    mutation.mutate(
      { data: { username, password } },
      {
        onSuccess: () => onSuccess(),
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error;
          setError(msg || (isLogin ? "Login failed." : "Registration failed."));
        },
      },
    );
  };

  return (
    <div className="w-full max-w-sm flex flex-col gap-5">
      {/* App title */}
      <div className="text-center">
        <h1
          className="text-3xl font-light tracking-[0.2em] uppercase mb-1"
          style={{ color: accentColor }}
        >
          SuiKa
        </h1>
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">
          A Living System
        </p>
      </div>

      {/* Description */}
      <div
        className="rounded-2xl px-4 py-3 border text-xs leading-relaxed text-muted-foreground space-y-2"
        style={{ borderColor: `${accentColor}22`, backgroundColor: `${accentColor}08` }}
      >
        <div className="flex items-start gap-2">
          <div className="flex gap-1.5 shrink-0 mt-0.5">
            <Globe size={12} style={{ color: accentColor }} />
            <TreeDeciduous size={12} style={{ color: accentColor }} />
          </div>
          <p>
            Browse live <span style={{ color: accentColor }}>Earth events</span> and your{" "}
            <span style={{ color: accentColor }}>local environment</span> right away — no account needed.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <FlaskConical size={12} className="shrink-0 mt-0.5 text-yellow-400/70" />
          <p>
            Sign in to unlock Health, Action, and Insights. These features are still{" "}
            <span className="text-yellow-400/80">early and experimental</span> — expect rough edges and
            missing data as the system evolves.
          </p>
        </div>
        <p className="text-muted-foreground/45 pl-5">
          SuiKa is a personal tool, not a medical product. Use it gently.
        </p>
      </div>

      {/* Compact auth form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && (
          <p className="text-red-400 text-xs text-center" data-testid="auth-error">{error}</p>
        )}
        <input
          data-testid="input-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="w-full bg-transparent py-2 px-3 text-sm focus:outline-none rounded-xl border border-border/40 focus:border-primary/50 placeholder:text-muted-foreground/40 transition-colors"
          autoComplete="off"
        />
        <input
          data-testid="input-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full bg-transparent py-2 px-3 text-sm focus:outline-none rounded-xl border border-border/40 focus:border-primary/50 placeholder:text-muted-foreground/40 transition-colors"
        />
        <button
          data-testid="button-submit"
          type="submit"
          disabled={isPending}
          className="w-full py-2.5 rounded-full text-xs uppercase tracking-widest border transition-colors disabled:opacity-40"
          style={{ borderColor: `${accentColor}60`, color: accentColor }}
        >
          {isPending ? "…" : isLogin ? "Enter" : "Begin"}
        </button>
      </form>

      <div className="flex items-center justify-between">
        <button
          data-testid="button-toggle-mode"
          type="button"
          onClick={() => { setIsLogin(!isLogin); setError(""); }}
          className="text-[10px] uppercase tracking-widest text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          {isLogin ? "Create account" : "Already have one"}
        </button>
        <ThemePicker current={theme} onChange={handleTheme} />
      </div>
    </div>
  );
}

// ── Legacy full-screen AuthScreen (kept for potential future use) ─────────────

export function AuthScreen({ onSuccess }: { onSuccess: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <AuthCard onSuccess={onSuccess} />
    </div>
  );
}
