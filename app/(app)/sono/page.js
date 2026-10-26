"use client";

import { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { MI, StarRating, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import MetasEditor from "@/components/MetasEditor";
import { sleepXp, sleepMissXp, computeSleepXp, bedtimeLateness, SLEEP_LIMIT_DEFAULT, SLEEP_GOAL_MIN, SLEEP_GOAL_MAX, award, getDateStr, shiftDate, minutesToHm, weekdayShort, last7Dates } from "@/lib/state";
import { LineChart } from "@/components/charts";
import BichoDaNoite from "./BichoDaNoite";

function hm(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${pad2(m)}m`;
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
const ddmm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
// "seg" → "Seg": rótulo de dia sozinho começa em maiúscula (caixa de frase)
const capDay = (d) => { const w = weekdayShort(d); return w.charAt(0).toUpperCase() + w.slice(1); };

// Até onde o registro atrasado alcança. Um mês cobre "esqueci a semana passada"
// sem transformar o campo numa máquina do tempo: noite de três meses atrás
// ninguém lembra a que horas deitou, e o palpite entraria no placar como fato.
const RETRO_DAYS = 30;

export default function SonoPage() {
  const { state, setState, toast, setSetting } = useApp();
  const today = getDateStr(0);
  // Qual noite o formulário está editando. Começa em hoje — o caso de 99% das
  // aberturas — e aceita voltar até RETRO_DAYS: sono é registro, e registro que
  // só aceita o dia corrente vira buraco permanente quando o app não foi aberto.
  const [date, setDate] = useState(today);
  const minDate = shiftDate(today, -RETRO_DAYS);
  const existing = state.sleep[date];
  const [bedtime, setBedtime] = useState(existing?.bedtime || "23:00");
  const [wake, setWake] = useState(existing?.wake || "07:00");
  const [quality, setQuality] = useState(existing?.quality || 3);
  const [note, setNote] = useState(existing?.note || "");
  const [lateReason, setLateReason] = useState(existing?.lateReason || "");

  // Trocar de noite recarrega o formulário com o que estiver salvo nela (ou os
  // padrões). Sem isto, escolher ontem manteria na tela os campos de hoje e o
  // salvar gravaria a noite errada com os dados da outra.
  useEffect(() => {
    const e = state.sleep[date];
    setBedtime(e?.bedtime || "23:00");
    setWake(e?.wake || "07:00");
    setQuality(e?.quality || 3);
    setNote(e?.note || "");
    setLateReason(e?.lateReason || "");
    // de propósito só `date`: salvar não pode reescrever o que está sendo digitado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // clamp na mão: input[type=date] deixa DIGITAR fora do min/max, só bloqueia o
  // seletor — sem isto dava pra registrar sono em 2019 ou no ano que vem
  const pickDate = (v) => {
    if (!v) return setDate(today);
    setDate(v > today ? today : v < minDate ? minDate : v);
  };
  const isToday = date === today;
  const dayLabel = isToday ? "hoje" : date === shiftDate(today, -1) ? "ontem" : `${weekdayShort(date)} ${ddmm(date)}`;

  function computeDuration(bt, wk) {
    const [bh, bm] = bt.split(":").map(Number);
    const [wh, wm] = wk.split(":").map(Number);
    let diff = wh * 60 + wm - (bh * 60 + bm);
    if (diff <= 0) diff += 24 * 60;
    return diff;
  }
  const durationMin = computeDuration(bedtime, wake);
  const goalMin = state.settings.sleepGoalMin || 450;
  const limit = state.settings.sleepLimit || SLEEP_LIMIT_DEFAULT;
  const hitsGoal = durationMin >= goalMin;
  const lateMin = bedtimeLateness(bedtime, limit); // >0 = deitou tarde
  const onTime = lateMin <= 0;
  const needsReason = lateMin > 0 && !lateReason.trim(); // deitou tarde exige justificativa
  // XP líquido previsto p/ o registro atual (assinado): combina duração + horário
  const previewNet = computeSleepXp({ durationMin, bedtime, goalMin, limit, streak: state.stats.streak });

  function save() {
    if (needsReason) {
      toast("Justifique pra registrar", { sub: "Deitou tarde? Escreva o motivo.", type: "error", icon: "edit_note" });
      return;
    }
    setState((prev) => {
      const prevEntry = prev.sleep[date];
      // net anterior (assinado): prêmio − penalidade; fallback p/ entradas legadas
      const prevNet =
        (prevEntry?.awardedXp || 0) - (prevEntry?.penaltyXp || 0) ||
        (prevEntry?.xpAwarded ? award(sleepXp(goalMin), prev.stats.streak) : 0);
      const net = computeSleepXp({ durationMin, bedtime, goalMin, limit, streak: prev.stats.streak });
      const xp = Math.max(0, (prev.stats.xp || 0) + (net - prevNet)); // aplica só o delta (estorno simétrico)
      const entry = {
        bedtime,
        wake,
        durationMin,
        quality,
        note: note.slice(0, 200),
        lateReason: lateMin > 0 ? lateReason.slice(0, 200) : "",
        awardedXp: net > 0 ? net : 0,
        penaltyXp: net < 0 ? -net : 0,
      };
      return { ...prev, sleep: { ...prev.sleep, [date]: entry }, stats: { ...prev.stats, xp } };
    });
    const sign = previewNet >= 0 ? "+" : "−";
    const reason = !hitsGoal ? "Abaixo da meta" : onTime ? "Meta batida · cedo" : "Meta batida · deitou tarde";
    toast(isToday ? "Sono salvo" : `Sono de ${ddmm(date)} salvo`, {
      sub: `${reason} · ${sign}${Math.abs(previewNet)} XP`,
      icon: previewNet >= 0 ? "check_circle" : "warning",
      type: previewNet >= 0 ? undefined : "error",
    });
  }

  const days = last7Dates();
  const withData = days.filter((d) => state.sleep[d]);
  const avgMin = withData.length ? Math.round(withData.reduce((s, d) => s + state.sleep[d].durationMin, 0) / withData.length) : null;

  // anel de progresso (duração ÷ meta)
  const R = 42;
  const CIRC = 2 * Math.PI * R;
  const fillPct = Math.min(durationMin / goalMin, 1);
  const offset = CIRC * (1 - fillPct);

  // noites "sujas" no gráfico: deitou tarde (madrugada) — não é 8h limpa
  const lateFlags = days.map((d) => {
    const e = state.sleep[d];
    return e ? bedtimeLateness(e.bedtime, limit) > 0 : false;
  });
  const hasLate = lateFlags.some(Boolean);


  const card = "rounded-xl border border-outline-variant bg-surface-container";
  const lateTxt = `${Math.floor(lateMin / 60)}h${String(lateMin % 60).padStart(2, "0")}`;
  const xpTxt = `${previewNet >= 0 ? "+" : "−"}${Math.abs(previewNet)} XP`;

  return (
    <>
      <PageHeader title="Sono" subtitle="Registre a noite e acompanhe se está batendo a meta." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Registro da noite: a duração é a resposta da tela, então vem grande e
            antes dos campos que a produzem. */}
        <section className={`${card} flex flex-col gap-6 p-5 lg:col-span-7 lg:self-start`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-on-surface">Sono de {dayLabel}</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Este registro:{" "}
                <span className={`font-medium tabular-nums ${previewNet >= 0 ? "text-on-surface" : "text-error"}`}>{xpTxt}</span>
              </p>
              <p className="mt-0.5 text-xs text-outline tabular-nums">Deitar até {limit} rende XP cheio</p>
            </div>

            {/* Seletor da noite. Fica no cabeçalho do formulário, não escondido num
                menu: é o campo que diz o que os outros campos significam. */}
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <Label htmlFor="sono-noite" className="text-xs font-normal text-on-surface-variant">
                Noite de
              </Label>
              <Input
                id="sono-noite"
                type="date"
                value={date}
                min={minDate}
                max={today}
                onChange={(e) => pickDate(e.target.value)}
                aria-label="Noite que está sendo registrada"
                className="w-auto tabular-nums"
              />
              {!isToday && (
                <Button variant="ghost" size="xs" onClick={() => setDate(today)} className="text-on-surface-variant">
                  <MI name="history" className="text-[14px]" /> Registro atrasado · voltar pra hoje
                </Button>
              )}
            </div>
          </div>

          {/* Duração + veredito */}
          <div className="space-y-3">
            <div className="flex items-center gap-5">
              <div className="relative size-[76px] shrink-0">
                <svg className="size-full" viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" fill="transparent" r={R} stroke="var(--color-surface-variant)" strokeWidth="7" />
                  <circle
                    className="progress-ring__circle"
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r={R}
                    stroke={hitsGoal ? "var(--color-primary-container)" : "var(--color-error)"}
                    strokeLinecap="round"
                    strokeWidth="7"
                    style={{ strokeDasharray: CIRC, strokeDashoffset: offset }}
                  />
                </svg>
                <span className="absolute inset-0 grid place-items-center text-xs font-medium tabular-nums text-on-surface-variant">
                  {Math.round(fillPct * 100)}%
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-xs text-outline">Duração estimada</div>
                <div className="mt-1.5 text-4xl font-semibold leading-none tracking-tight tabular-nums text-on-surface sm:text-5xl">
                  {Math.floor(durationMin / 60)}
                  <span className="mr-2 text-2xl text-on-surface-variant sm:text-3xl">h</span>
                  {pad2(durationMin % 60)}
                  <span className="text-2xl text-on-surface-variant sm:text-3xl">m</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {/* horário de dormir */}
              <Badge variant="outline" className={`whitespace-normal tabular-nums ${onTime ? "text-on-surface-variant" : "border-error/40 text-error"}`}>
                <MI name={onTime ? "bedtime" : "nightlight"} className="text-[14px]" />
                {onTime ? `Deitou no horário (até ${limit})` : `Deitou ${lateTxt} após o limite`}
              </Badge>
              {/* duração vs meta */}
              <Badge variant="outline" className={`whitespace-normal tabular-nums ${hitsGoal ? "text-on-surface-variant" : "border-error/40 text-error"}`}>
                <MI name={hitsGoal ? "check_circle" : "warning"} className="text-[14px]" />
                Meta {minutesToHm(goalMin)} · {hitsGoal ? "bateu a meta" : `abaixo da meta (−${sleepMissXp(goalMin)} XP)`}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sono-deitou" className="text-xs font-normal text-on-surface-variant">
                Dormiu às
              </Label>
              <Input id="sono-deitou" type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} className="tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sono-acordou" className="text-xs font-normal text-on-surface-variant">
                Acordou às
              </Label>
              <Input id="sono-acordou" type="time" value={wake} onChange={(e) => setWake(e.target.value)} className="tabular-nums" />
            </div>
          </div>

          {/* justificativa obrigatória quando deitou tarde */}
          {lateMin > 0 && (
            <div className="space-y-2">
              <Label htmlFor="sono-motivo" className="text-xs font-normal text-error">
                Por que deitou tarde? (obrigatório)
              </Label>
              <Textarea
                id="sono-motivo"
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                placeholder="Ex.: trabalho atrasado, ansiedade, tela até tarde, saída..."
                maxLength={200}
                rows={2}
                aria-invalid={needsReason || undefined}
                className="resize-none"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-on-surface">Qualidade do descanso</span>
            <StarRating value={quality} onChange={setQuality} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sono-nota" className="text-xs font-normal text-on-surface-variant">
              Nota (opcional)
            </Label>
            <Textarea
              id="sono-nota"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Sonhou? Acordou no meio da noite? Cafeína tarde?"
              maxLength={200}
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Button onClick={save} disabled={needsReason} size="lg" className="w-full">
              {existing ? "Atualizar registro" : "Salvar registro"}
            </Button>
            {needsReason && <p className="text-center text-xs text-error">Justifique por que deitou tarde pra registrar.</p>}
          </div>
        </section>

        <div className="flex flex-col gap-6 lg:col-span-5">
          {/* o mascote deitado: a mesma noite dos números ao lado, virada em cena */}
          <BichoDaNoite
            state={state}
            bedtime={bedtime}
            wake={wake}
            durationMin={durationMin}
            goalMin={goalMin}
            limit={limit}
            quality={quality}
          />

          {/* Gráfico da semana + média */}
          <section className={`${card} p-5`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-on-surface">Últimos 7 dias</h2>
                {hasLate ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-outline">
                    <span className="size-2 rounded-full bg-error" /> Deitou tarde
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-outline">Duração de cada noite</p>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs text-outline">Média semanal</div>
                <div className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${avgMin ? "text-on-surface" : "text-outline"}`}>{avgMin ? hm(avgMin) : "—"}</div>
              </div>
            </div>

            {/* sem registro a moldura fica (grade, meta, dias) e a frase entra por cima */}
            <div className="relative mt-4">
              <LineChart
                days={days}
                values={days.map((d) => state.sleep[d]?.durationMin ?? null)}
                today={today}
                yMax={Math.max(600, goalMin + 120)}
                goal={{ value: goalMin, label: `Meta ${minutesToHm(goalMin)}` }}
                format={minutesToHm}
                xLabel={capDay}
                flags={lateFlags}
                reasons={days.map((d) => state.sleep[d]?.lateReason || "")}
                ariaLabel="Duração do sono nos últimos 7 dias (pontos vermelhos = deitou tarde)"
              />
              {withData.length === 0 && (
                <div className="absolute inset-x-0 top-[88px] bottom-7 grid place-items-center px-6">
                  <p className="bg-surface-container px-2 text-center text-sm text-on-surface-variant">
                    Sem registros ainda — salve a noite de hoje pra começar o gráfico.
                  </p>
                </div>
              )}
            </div>

            {/* justificativas das noites que deitou tarde */}
            {hasLate && (
              <div className="mt-4 border-t border-outline-variant pt-4">
                <div className="mb-2 text-xs text-outline">Noites que deitou tarde</div>
                <ul className="space-y-1.5">
                  {days
                    .filter((d) => state.sleep[d] && bedtimeLateness(state.sleep[d].bedtime, limit) > 0)
                    .map((d) => (
                      <li key={d} className="flex gap-3 text-sm">
                        <span className="w-8 shrink-0 text-error">{capDay(d)}</span>
                        <span className={state.sleep[d].lateReason ? "text-on-surface-variant" : "italic text-outline"}>
                          {state.sleep[d].lateReason || "sem justificativa"}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </section>

          {/* Metas de sono: configuração, não registro — fica por último */}
          <section className={`${card} p-5`}>
            <h2 className="mb-4 text-base font-semibold text-on-surface">Metas de sono</h2>
            <MetasEditor
              fields={[
                { key: "sleepGoalMin", label: "Meta de sono", type: "number", value: state.settings.sleepGoalMin, min: SLEEP_GOAL_MIN, max: SLEEP_GOAL_MAX, step: 15, format: (v) => minutesToHm(v), onChange: (v) => setSetting("sleepGoalMin", v) },
                { key: "sleepLimit", label: "Deitar até", type: "time", value: state.settings.sleepLimit || "23:30", onChange: (v) => setSetting("sleepLimit", v) },
              ]}
            />
          </section>
        </div>
      </div>
    </>
  );
}
