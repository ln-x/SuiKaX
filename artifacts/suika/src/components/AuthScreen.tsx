import React, { useState } from "react";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { useTranslation } from "../lib/i18n";

export function AuthScreen({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = useLogin();
  const registerMutation = useRegister();

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
        onSuccess: () => {
          onSuccess();
        },
        onError: (err: any) => {
          setError(err.error?.error || "Authentication failed.");
        }
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
      <h1 className="text-4xl font-serif mb-4 tracking-tight">SuiKa</h1>
      <p className="text-muted-foreground mb-12 max-w-sm">{t("auth.tagline")}</p>
      
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
        {error && <div className="text-destructive text-sm" data-testid="auth-error">{error}</div>}
        
        <input
          data-testid="input-username"
          type="text"
          placeholder={t("auth.username")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-transparent border-b border-border/50 py-3 px-1 text-center outline-none focus:border-primary transition-colors"
        />
        
        <input
          data-testid="input-password"
          type="password"
          placeholder={t("auth.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-transparent border-b border-border/50 py-3 px-1 text-center outline-none focus:border-primary transition-colors"
        />
        
        <button
          data-testid="button-submit"
          type="submit"
          disabled={loginMutation.isPending || registerMutation.isPending}
          className="w-full bg-card hover:bg-secondary text-foreground rounded-full py-4 mt-8 transition-colors disabled:opacity-50"
        >
          {loginMutation.isPending || registerMutation.isPending ? "..." : t("auth.submit")}
        </button>
      </form>
      
      <button
        data-testid="button-toggle-mode"
        onClick={() => setIsLogin(!isLogin)}
        className="mt-8 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {isLogin ? "Create an account" : "Sign in to existing account"}
      </button>
    </div>
  );
}
