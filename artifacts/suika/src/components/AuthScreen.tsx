import React, { useState } from "react";
import { useLogin, useRegister } from "@workspace/api-client-react";

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

// ── Shared form state type ────────────────────────────────────────────────────

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

// ── Theme Picker ──────────────────────────────────────────────────────────────

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

// ── Lunar / Still theme ───────────────────────────────────────────────────────

function LunarTheme({ isLogin, username, password, error, isPending, onUsername, onPassword, onSubmit, onToggle, theme, onTheme }: FormProps) {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "#03050d" }}
    >
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none rounded-full"
        style={{
          width: "120vw", height: "60vh",
          background: "radial-gradient(circle at top center, rgba(184,212,255,0.05) 0%, rgba(3,5,13,0) 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="w-full max-w-sm px-8 z-10 flex flex-col">
        <div className="text-center mb-16">
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            className="text-5xl text-white tracking-widest font-light mb-4">
            SuiKa
          </h1>
          <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#8e95a5" }}>
            Recover your rhythm
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-10">
          {error && (
            <p className="text-red-400 text-xs text-center" data-testid="auth-error">{error}</p>
          )}
          <input
            data-testid="input-username"
            type="text"
            value={username}
            onChange={(e) => onUsername(e.target.value)}
            placeholder="Username"
            className="w-full bg-transparent pb-3 text-sm tracking-widest focus:outline-none transition-colors duration-500 rounded-none font-light"
            style={{
              borderBottom: "1px solid #3b4154",
              color: "#e2e8f0",
              caretColor: "#b8d4ff",
            }}
            onFocus={e => (e.target.style.borderBottomColor = "#b8d4ff")}
            onBlur={e => (e.target.style.borderBottomColor = "#3b4154")}
          />
          <input
            data-testid="input-password"
            type="password"
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-transparent pb-3 text-sm tracking-widest focus:outline-none transition-colors duration-500 rounded-none font-light"
            style={{
              borderBottom: "1px solid #3b4154",
              color: "#e2e8f0",
              caretColor: "#b8d4ff",
            }}
            onFocus={e => (e.target.style.borderBottomColor = "#b8d4ff")}
            onBlur={e => (e.target.style.borderBottomColor = "#3b4154")}
          />
          <button
            data-testid="button-submit"
            type="submit"
            disabled={isPending}
            className="mt-4 w-full py-4 rounded-full bg-transparent text-xs uppercase tracking-[0.2em] transition-all duration-700 disabled:opacity-40"
            style={{
              border: "1px solid #3b4154",
              color: "#d1d5db",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#b8d4ff";
              (e.currentTarget as HTMLButtonElement).style.color = "#b8d4ff";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 20px rgba(184,212,255,0.15)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#3b4154";
              (e.currentTarget as HTMLButtonElement).style.color = "#d1d5db";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
          >
            {isPending ? "…" : isLogin ? "Enter" : "Begin"}
          </button>
        </form>

        <div className="mt-16 text-center">
          <button
            data-testid="button-toggle-mode"
            type="button"
            onClick={onToggle}
            className="text-[10px] uppercase tracking-widest transition-colors duration-500"
            style={{ color: "#555a69" }}
            onMouseEnter={e => ((e.target as HTMLElement).style.color = "#b8d4ff")}
            onMouseLeave={e => ((e.target as HTMLElement).style.color = "#555a69")}
          >
            {isLogin ? "Create an account" : "I already have an account"}
          </button>
        </div>

        <div className="mt-10 flex justify-center">
          <ThemePicker current={theme} onChange={onTheme} />
        </div>
      </div>
    </div>
  );
}

// ── Warm Earth / Grounded theme ───────────────────────────────────────────────

function WarmEarthTheme({ isLogin, username, password, error, isPending, onUsername, onPassword, onSubmit, onToggle, theme, onTheme }: FormProps) {
  return (
    <div className="warm-earth-bg min-h-screen w-full flex flex-col justify-center items-center px-8 py-12 overflow-hidden"
      style={{ color: "#e8dbce" }}>
      <div className="w-full max-w-sm flex flex-col items-center z-10">
        <div className="mb-16 text-center">
          <h1 style={{ fontFamily: "'Lora', Georgia, serif", color: "#c97b3a" }}
            className="text-5xl mb-3 tracking-wide font-medium">
            SuiKa
          </h1>
          <p className="text-xs tracking-widest uppercase font-light" style={{ color: "#a39081" }}>
            Find your center again
          </p>
        </div>

        <form onSubmit={onSubmit} className="w-full flex flex-col gap-8 mb-12">
          {error && (
            <p className="text-red-400 text-xs text-center" data-testid="auth-error">{error}</p>
          )}
          <input
            data-testid="input-username"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => onUsername(e.target.value)}
            className="bg-transparent px-2 py-3 focus:outline-none transition-colors rounded-none"
            style={{
              borderBottom: "1px solid #8a7260",
              color: "#e8dbce",
              caretColor: "#c97b3a",
            }}
            onFocus={e => (e.target.style.borderBottomColor = "#c97b3a")}
            onBlur={e => (e.target.style.borderBottomColor = "#8a7260")}
          />
          <input
            data-testid="input-password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            className="bg-transparent px-2 py-3 focus:outline-none transition-colors rounded-none"
            style={{
              borderBottom: "1px solid #8a7260",
              color: "#e8dbce",
              caretColor: "#c97b3a",
            }}
            onFocus={e => (e.target.style.borderBottomColor = "#c97b3a")}
            onBlur={e => (e.target.style.borderBottomColor = "#8a7260")}
          />
          <button
            data-testid="button-submit"
            type="submit"
            disabled={isPending}
            className="mt-6 w-full rounded-full py-4 font-medium tracking-wider uppercase text-sm transition-colors focus:outline-none disabled:opacity-40"
            style={{
              border: "1px solid #c97b3a",
              color: "#e8dbce",
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(201,123,58,0.1)")}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent")}
          >
            {isPending ? "…" : isLogin ? "Sign In" : "Begin Journey"}
          </button>
        </form>

        <button
          data-testid="button-toggle-mode"
          type="button"
          onClick={onToggle}
          className="text-sm transition-colors focus:outline-none hover:underline underline-offset-4 mb-10"
          style={{ color: "#965a29" }}
          onMouseEnter={e => ((e.target as HTMLElement).style.color = "#c97b3a")}
          onMouseLeave={e => ((e.target as HTMLElement).style.color = "#965a29")}
        >
          {isLogin ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>

        <ThemePicker current={theme} onChange={onTheme} />
      </div>
    </div>
  );
}

// ── Bioluminescent / Alive theme ──────────────────────────────────────────────

function BioTheme({ isLogin, username, password, error, isPending, onUsername, onPassword, onSubmit, onToggle, theme, onTheme }: FormProps) {
  return (
    <div
      className="min-h-screen w-full flex flex-col justify-center px-8 relative overflow-hidden"
      style={{ backgroundColor: "#020d0c" }}
    >
      <div
        className="absolute top-1/3 left-1/2 w-[120vw] h-[120vw] rounded-full pointer-events-none animate-bio-pulse"
        style={{ background: "radial-gradient(circle, rgba(0,201,167,0.12) 0%, rgba(2,13,12,0) 60%)" }}
      />

      <div className="z-10 w-full max-w-sm mx-auto flex flex-col items-center">
        <div className="text-center mb-16 relative">
          <h1
            className="text-4xl text-white font-light tracking-[0.25em] uppercase mb-4"
            style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
          >
            SuiKa
          </h1>
          <p className="text-sm tracking-wider font-light uppercase" style={{ color: "rgba(0,201,167,0.6)" }}>
            A Living System
          </p>
        </div>

        <form onSubmit={onSubmit} className="w-full flex flex-col gap-8">
          {error && (
            <p className="text-red-400 text-xs text-center" data-testid="auth-error">{error}</p>
          )}
          <div className="flex flex-col gap-6">
            <input
              data-testid="input-username"
              type="text"
              value={username}
              onChange={(e) => onUsername(e.target.value)}
              placeholder="Username"
              className="w-full bg-transparent border-0 text-lg py-2 focus:ring-0 focus:outline-none transition-all bio-input"
              style={{
                borderBottom: "1px solid #04332e",
                color: "#00e5c0",
                caretColor: "#00e5c0",
              }}
              autoComplete="off"
            />
            <input
              data-testid="input-password"
              type="password"
              value={password}
              onChange={(e) => onPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-transparent border-0 text-lg py-2 focus:ring-0 focus:outline-none transition-all bio-input"
              style={{
                borderBottom: "1px solid #04332e",
                color: "#00e5c0",
                caretColor: "#00e5c0",
              }}
            />
          </div>

          <button
            data-testid="button-submit"
            type="submit"
            disabled={isPending}
            className="mt-4 w-full py-4 rounded-full text-sm uppercase tracking-widest transition-colors animate-bio-breathe focus:outline-none disabled:opacity-40"
            style={{
              border: "1px solid rgba(0,229,192,0.5)",
              color: "#00e5c0",
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,229,192,0.05)")}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent")}
          >
            {isPending ? "…" : isLogin ? "Enter" : "Initiate"}
          </button>
        </form>

        <button
          data-testid="button-toggle-mode"
          type="button"
          onClick={onToggle}
          className="mt-12 text-xs uppercase tracking-widest transition-colors focus:outline-none mb-10"
          style={{ color: "rgba(0,201,167,0.4)" }}
          onMouseEnter={e => ((e.target as HTMLElement).style.color = "rgba(0,201,167,0.8)")}
          onMouseLeave={e => ((e.target as HTMLElement).style.color = "rgba(0,201,167,0.4)")}
        >
          {isLogin ? "Regenerate System" : "Return to Core"}
        </button>

        <ThemePicker current={theme} onChange={onTheme} />
      </div>
    </div>
  );
}

// ── Main AuthScreen ───────────────────────────────────────────────────────────

export function AuthScreen({ onSuccess }: { onSuccess: () => void }) {
  const [theme, setTheme] = useState<AuthTheme>(getStoredTheme);
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const isPending = loginMutation.isPending || registerMutation.isPending;

  const handleTheme = (t: AuthTheme) => {
    setTheme(t);
    saveTheme(t);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username || !password) {
      setError("Please fill in all fields.");
      return;
    }
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

  const props: FormProps = {
    isLogin, username, password, error, isPending,
    onUsername: setUsername,
    onPassword: setPassword,
    onSubmit: handleSubmit,
    onToggle: () => { setIsLogin(!isLogin); setError(""); },
    theme,
    onTheme: handleTheme,
  };

  if (theme === "lunar")      return <LunarTheme {...props} />;
  if (theme === "warm-earth") return <WarmEarthTheme {...props} />;
  return <BioTheme {...props} />;
}
