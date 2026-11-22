"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Spinner } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!supabase) {
      setError("Supabase não configurado. Preencha .env.local e reinicie o servidor.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          router.replace("/");
        } else {
          setInfo("Conta criada. Confirme o email para entrar (ou desative 'Confirm email' no painel Supabase).");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/");
      }
    } catch (err) {
      setError(err.message || "Falha na autenticação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/logo.jpg" alt="" width={40} height={40} className="size-10 shrink-0 rounded-lg" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-on-surface">Discipline Rats</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              {mode === "signin" ? "Entre pra manter a disciplina." : "Crie sua conta e comece a construir hábitos."}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container p-6">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                className="h-10"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="login-password">Senha</Label>
              <Input
                id="login-password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="h-10"
              />
            </div>

            {error && <p className="text-sm text-error">{error}</p>}
            {info && <p className="text-sm text-on-surface-variant">{info}</p>}

            <Button type="submit" size="lg" disabled={busy} className="mt-1 w-full">
              {busy ? (
                <>
                  <Spinner size={16} /> Aguarde
                </>
              ) : mode === "signin" ? (
                "Entrar"
              ) : (
                "Criar conta"
              )}
            </Button>
          </form>
        </div>

        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
            setInfo("");
          }}
          className="text-center text-sm text-on-surface-variant transition-colors hover:text-on-surface"
        >
          {mode === "signin" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
        </button>

        {!supabase && <p className="text-center text-xs text-error">.env.local ausente — auth desativado.</p>}
      </div>
    </div>
  );
}
