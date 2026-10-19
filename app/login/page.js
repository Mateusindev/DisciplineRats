"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Spinner } from "@/components/ui";

function MI({ name, className = "", fill = false }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={{ fontVariationSettings: fill ? "'FILL' 1" : undefined }}>
      {name}
    </span>
  );
}

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

  const inputCls =
    "bg-surface-container-high text-on-surface border border-white/5 rounded-lg px-3 py-3 text-body-md outline-none focus:border-primary-container/50 transition-colors w-full";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md glass-card rounded-xl p-8 flex flex-col gap-6">
        <div className="flex items-center gap-2 justify-center">
          <img src="/logo.jpg" alt="" width={44} height={44} className="rounded-xl shrink-0" />
          <h1 className="font-headline-lg text-headline-lg font-black text-primary tracking-tighter">DISCIPLINE RATS</h1>
        </div>
        <p className="text-center text-on-surface-variant text-body-md -mt-2">
          {mode === "signin" ? "Entre pra manter a disciplina." : "Crie sua conta e comece a forjar XP."}
        </p>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-label-caps text-label-caps text-outline">EMAIL</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="voce@email.com" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-caps text-label-caps text-outline">SENHA</span>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="mínimo 6 caracteres" />
          </label>

          {error && <p className="text-[13px] text-error">{error}</p>}
          {info && <p className="text-[13px] text-primary-container">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="py-3 bg-primary-container text-on-primary-container font-label-caps rounded-full font-bold tracking-widest hover:brightness-110 active:scale-95 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <Spinner size={16} /> AGUARDE
              </>
            ) : mode === "signin" ? "ENTRAR" : "CRIAR CONTA"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
            setInfo("");
          }}
          className="text-center text-outline hover:text-primary transition text-[13px]"
        >
          {mode === "signin" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
        </button>

        {!supabase && (
          <p className="text-center text-[12px] text-error">.env.local ausente — auth desativado.</p>
        )}
      </div>
    </div>
  );
}
