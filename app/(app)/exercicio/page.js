"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../AppContext";
import { MI, Caps, StarRating, Select, inputCls, textareaCls } from "@/components/ui";
import { XP, award, getDateStr, shiftDate, weekdayShort, last7Dates, weekStartOf, isGymModality, gymProgress, gymExercises, gymPR, playAlarm, DOW_SHORT, mmss } from "@/lib/state";
import { fetchExercises } from "@/lib/persistence";
import { LineChart } from "@/components/charts";
import { ExerciseModal, guessMuscle } from "@/components/ExerciseInfo";

const GLOW = { boxShadow: "0 0 15px var(--brand-glow)" };

// Horários por dia, quando a mesma divisão acontece em horas diferentes.
// Aparece só a partir de 2 dias marcados — com um dia só, o campo padrão basta.
function DayTimes({ weekdays, obj, onSet }) {
  const [open, setOpen] = useState(() => Object.keys(obj.times || {}).length > 0);
  const days = [...(weekdays || [])].sort((a, b) => a - b);
  if (days.length < 2) return null;
  const overrides = Object.keys(obj.times || {}).length;

  return (
    <div className="mb-3">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 text-[11px] text-outline hover:text-primary transition">
        <MI name="schedule" className="text-[14px]" />
        Horário diferente por dia
        {overrides > 0 && <span className="text-primary">({overrides})</span>}
        <MI name="expand_more" className={`text-[14px] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-2 flex flex-wrap gap-2">
          {days.map((d) => {
            const val = obj.times?.[String(d)] || "";
            return (
              <label key={d} className="flex items-center gap-1.5 rounded bg-surface-container-lowest/60 border border-white/5 px-2 py-1">
                <Caps className={`text-[9px] ${val ? "text-primary" : "text-outline"}`}>{DOW_SHORT[d]}</Caps>
                <input
                  type="time"
                  value={val}
                  onChange={(e) => onSet(d, e.target.value)}
                  aria-label={`Horário de ${DOW_SHORT[d]}`}
                  className="bg-transparent text-on-surface text-[11px] outline-none w-[74px]"
                />
                {val && (
                  <button onClick={() => onSet(d, "")} aria-label={`Voltar ${DOW_SHORT[d]} pro padrão`} className="text-outline hover:text-error transition">
                    <MI name="close" className="text-[13px]" />
                  </button>
                )}
              </label>
            );
          })}
          <p className="text-[10px] text-outline w-full">Dia em branco usa o horário padrão acima.</p>
        </div>
      )}
    </div>
  );
}

// ===== descanso entre séries =====
const REST_MIN = 30;
const REST_MAX = 240;

function RestTimer({ left, total, pref, onPick, onStart, onBump, onSkip }) {
  const running = left > 0;
  const pct = total > 0 ? Math.max(0, Math.min(100, (left / total) * 100)) : 0;
  const ending = left > 0 && left <= 10; // últimos 10s em vermelho

  // Parado é configuração: fica embutido na superfície da seção, sem card nem sticky.
  // (Fundo próprio aqui virava um bloco opaco dentro do painel glass-card.)
  if (!running) {
    const fill = ((pref - REST_MIN) / (REST_MAX - REST_MIN)) * 100;
    return (
      <div className="mb-3 flex items-end gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1.5">
            <Caps className="text-outline text-[10px]">DESCANSO</Caps>
            <span className="font-headline-md text-[15px] text-primary tabular-nums leading-none">{mmss(pref)}</span>
          </div>
          <input
            type="range"
            min={REST_MIN}
            max={REST_MAX}
            step={15}
            value={pref}
            onChange={(e) => onPick(parseInt(e.target.value, 10))}
            aria-label="Intervalo de descanso"
            aria-valuetext={mmss(pref)}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-container [&::-webkit-slider-thumb]:shadow-md
              [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary-container"
            style={{ background: `linear-gradient(to right, var(--color-primary-container) ${fill}%, var(--color-surface-variant) ${fill}%)` }}
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-outline/70 tabular-nums">{mmss(REST_MIN)}</span>
            <span className="text-[10px] text-outline/70">começa sozinho ao registrar série</span>
            <span className="text-[10px] text-outline/70 tabular-nums">{mmss(REST_MAX)}</span>
          </div>
        </div>
        <button
          onClick={() => onStart(pref)}
          aria-label="Começar descanso"
          title="Começar descanso"
          className="w-9 h-9 mb-4 shrink-0 grid place-items-center rounded-full border border-primary/40 text-primary hover:bg-primary/10 active:scale-95 transition"
        >
          <MI name="play_arrow" fill className="text-lg" />
        </button>
      </div>
    );
  }

  // Rodando precisa acompanhar o scroll. A barra é opaca e preenche o sticky inteiro,
  // então não sobra fresta — dispensa fundo no wrapper.
  return (
    <div className="sticky top-0 z-30 mb-2">
      <div className={`relative overflow-hidden rounded-xl border ${ending ? "border-error/50" : "border-primary-container/40"} bg-surface-container-high`}>
        <div
          className={`absolute inset-y-0 left-0 ${ending ? "bg-error/25" : "bg-primary-container/25"}`}
          style={{ width: `${pct}%`, transition: "width .3s linear" }}
        />
        <div className="relative flex items-center gap-3 px-3 py-3">
          <span className={`font-headline-lg text-[30px] leading-none tabular-nums ${ending ? "text-error" : "text-primary"}`}>{mmss(left)}</span>
          <Caps className="text-on-surface-variant text-[10px] flex-1">DESCANSO</Caps>
          <button onClick={onBump} className="px-2.5 py-1.5 rounded font-label-caps text-[11px] border border-white/15 text-on-surface-variant hover:border-white/30 transition shrink-0">
            +30s
          </button>
          <button onClick={onSkip} aria-label="Pular descanso" className="w-9 h-9 grid place-items-center rounded-full text-outline hover:text-on-surface hover:bg-surface-variant/50 transition shrink-0">
            <MI name="skip_next" />
          </button>
        </div>
      </div>
    </div>
  );
}

// busca/escolha de exercício no catálogo — abre no clique, agrupado por músculo
function ExercisePicker({ value, onChange, onSubmit, catalog }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null); // posição do input p/ ancorar o dropdown no portal
  const inputRef = useRef(null);
  const q = (value || "").trim().toLowerCase();
  const filtered = q ? catalog.filter((e) => e.name.toLowerCase().includes(q)) : catalog;
  // agrupa por grupo muscular (catálogo já vem ordenado por músculo → nome)
  const groups = [];
  for (const e of filtered) {
    let g = groups.find((x) => x.muscle === e.muscle);
    if (!g) groups.push((g = { muscle: e.muscle, items: [] }));
    g.items.push(e);
  }

  // dropdown vai pro body (portal): .glass-card usa backdrop-filter e cria stacking
  // context por card, então z-index interno ficaria atrás dos cards de modalidade irmãos.
  const measure = () => inputRef.current && setRect(inputRef.current.getBoundingClientRect());
  useEffect(() => {
    if (!open) return;
    measure();
    const onScroll = () => measure();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === "Enter") { setOpen(false); onSubmit(); } }}
        placeholder="Buscar ou escolher exercício..."
        className={`${inputCls} w-full text-[13px]`}
      />
      {open && rect && groups.length > 0 && createPortal(
        <div
          className="fixed z-[120] bg-surface-container-highest border border-white/10 rounded-lg shadow-2xl max-h-72 overflow-auto ff-scroll"
          style={{ top: rect.bottom + 4, left: rect.left, width: rect.width }}
        >
          {groups.map((g) => (
            <div key={g.muscle}>
              <div className="sticky top-0 bg-surface-container-highest px-3 py-1.5 border-b border-white/5">
                <Caps className="text-primary-container text-[9px]">{g.muscle}</Caps>
              </div>
              <ul>
                {g.items.map((e) => (
                  <li key={e.name}>
                    <button
                      type="button"
                      onMouseDown={(ev) => { ev.preventDefault(); onChange(e.name); setOpen(false); }}
                      className="w-full px-3 py-2 text-left text-[13px] text-on-surface hover:bg-surface-variant/50 transition flex items-center gap-2"
                    >
                      <span className="flex-1 min-w-0 truncate">{e.name}</span>
                      {e.video_id && <MI name="play_circle" className="text-sm text-primary-container shrink-0" title="Vídeo disponível" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

const TABS_EX = [
  { id: "registrar", label: "REGISTRAR", short: "REGISTRAR", icon: "edit_note" },
  { id: "progresso", label: "PROGRESSO", short: "PROGRESSO", icon: "monitoring" },
  { id: "treinos", label: "MEUS TREINOS", short: "TREINOS", icon: "assignment" },
];

// divisão agendada pra hoje na modalidade (0=Seg…6=Dom) → auto-seleção no registrar
const dowToday = () => (new Date().getDay() + 6) % 7;
const scheduledDivName = (mod) => (mod?.divisions || []).find((d) => (d.weekdays || []).includes(dowToday()))?.name || "";
const defaultDivName = (mod) => scheduledDivName(mod) || mod?.divisions?.[0]?.name || "";

export default function ExercicioPage() {
  const { state, setState, toast, confirm, setSetting } = useApp();
  const [tab, setTab] = useState("registrar");
  const [type, setType] = useState(state.workoutPlan?.[0]?.name || "");
  const [division, setDivision] = useState(() => defaultDivName(state.workoutPlan?.[0]));
  const [duration, setDuration] = useState("60");
  const [intensity, setIntensity] = useState(3);
  const [note, setNote] = useState("");

  // ===== plano de treinos (modalidade → divisão → exercício) =====
  const plan = state.workoutPlan || [];
  const modalityNames = plan.map((m) => m.name).filter(Boolean);
  const selectedMod = plan.find((m) => m.name === type);
  const divisionNames = (selectedMod?.divisions || []).map((d) => d.name).filter(Boolean);
  // anti-stale: divisão renomeada/excluída na aba Meus Treinos cai na 1ª válida
  const effectiveDivision = divisionNames.includes(division) ? division : divisionNames[0] || "";

  // troca modalidade → seleciona a divisão agendada pra hoje (ou a 1ª)
  function changeType(name) {
    setType(name);
    setDivision(defaultDivName(plan.find((m) => m.name === name)));
  }
  const [divForms, setDivForms] = useState({}); // { [modId]: nomeDaNovaDivisao }
  const [itemForms, setItemForms] = useState({}); // { [divId]: {name, detail} }
  const [newModality, setNewModality] = useState("");
  const [catalog, setCatalog] = useState([]); // exercícios do banco pra busca
  useEffect(() => {
    fetchExercises().then(setCatalog);
  }, []);
  // após carregar o plano (weekdays salvos), auto-seleciona a divisão de hoje 1×
  const autoDiv = useRef(false);
  useEffect(() => {
    if (autoDiv.current) return;
    const sched = scheduledDivName(plan.find((m) => m.name === type) || plan[0]);
    if (sched) {
      setDivision(sched);
      autoDiv.current = true;
    }
  }, [plan, type]);
  const [infoEx, setInfoEx] = useState(null); // { name, muscle } → modal vídeo + músculo
  const openInfo = (name) => {
    const hit = catalog.find((e) => e.name === name);
    setInfoEx({ name, muscle: hit?.muscle || guessMuscle(name), videoId: hit?.video_id || null });
  };

  // modalidade simples (sem divisões): jiu jitsu, corrida, etc — só pra registrar sessão
  function addModality() {
    const name = newModality.trim() || `Modalidade ${plan.length + 1}`;
    setState((prev) => ({ ...prev, workoutPlan: [...(prev.workoutPlan || []), { id: Date.now(), name, divisions: [], weekdays: [] }] }));
    setNewModality("");
  }
  // dias de prática da modalidade simples (sem divisões) → reflete na Home
  function toggleModalityDay(modId, dayIdx) {
    setState((prev) => ({
      ...prev,
      workoutPlan: (prev.workoutPlan || []).map((m) => {
        if (m.id !== modId) return m;
        const cur = m.weekdays || [];
        const weekdays = cur.includes(dayIdx) ? cur.filter((x) => x !== dayIdx) : [...cur, dayIdx].sort((a, b) => a - b);
        return { ...m, weekdays };
      }),
    }));
  }
  async function removeModality(id) {
    const m = (state.workoutPlan || []).find((x) => x.id === id);
    const ok = await confirm({ title: "Excluir modalidade?", body: `"${m?.name || ""}" e todas as divisões/exercícios dela serão removidos.`, confirmLabel: "EXCLUIR" });
    if (!ok) return;
    setState((prev) => ({ ...prev, workoutPlan: (prev.workoutPlan || []).filter((m) => m.id !== id) }));
  }
  function renameModality(id, name) {
    setState((prev) => ({ ...prev, workoutPlan: (prev.workoutPlan || []).map((m) => (m.id === id ? { ...m, name } : m)) }));
  }

  const mapMod = (prev, modId, fn) => (prev.workoutPlan || []).map((m) => (m.id === modId ? fn(m) : m));

  function addDivision(modId) {
    const name = (divForms[modId] || "").trim() || "Nova divisão";
    setState((prev) => ({ ...prev, workoutPlan: mapMod(prev, modId, (m) => ({ ...m, divisions: [...(m.divisions || []), { id: Date.now(), name, items: [], weekdays: [] }] })) }));
    setDivForms((f) => ({ ...f, [modId]: "" }));
  }
  async function removeDivision(modId, divId) {
    const d = (state.workoutPlan || []).find((m) => m.id === modId)?.divisions?.find((x) => x.id === divId);
    if ((d?.items || []).length) {
      const ok = await confirm({ title: "Excluir divisão?", body: `"${d.name}" tem ${d.items.length} exercício(s) que serão removidos.`, confirmLabel: "EXCLUIR" });
      if (!ok) return;
    }
    setState((prev) => ({ ...prev, workoutPlan: mapMod(prev, modId, (m) => ({ ...m, divisions: (m.divisions || []).filter((d) => d.id !== divId) })) }));
  }
  function renameDivision(modId, divId, name) {
    setState((prev) => ({ ...prev, workoutPlan: mapMod(prev, modId, (m) => ({ ...m, divisions: (m.divisions || []).map((d) => (d.id === divId ? { ...d, name } : d)) })) }));
  }
  // liga/desliga um dia da semana (0=Seg…6=Dom) em que a divisão é executada
  function toggleDivisionDay(modId, divId, dayIdx) {
    setState((prev) => ({
      ...prev,
      workoutPlan: mapMod(prev, modId, (m) => ({
        ...m,
        divisions: (m.divisions || []).map((d) => {
          if (d.id !== divId) return d;
          const cur = d.weekdays || [];
          const weekdays = cur.includes(dayIdx) ? cur.filter((x) => x !== dayIdx) : [...cur, dayIdx].sort((a, b) => a - b);
          return { ...d, weekdays };
        }),
      })),
    }));
  }

  const setModalityTime = (modId, time) => setState((prev) => ({ ...prev, workoutPlan: mapMod(prev, modId, (m) => ({ ...m, time })) }));

  // horário da divisão: só serve pra Agenda posicionar o treino na hora certa
  function setDivisionTime(modId, divId, time) {
    setState((prev) => ({
      ...prev,
      workoutPlan: mapMod(prev, modId, (m) => ({
        ...m,
        divisions: (m.divisions || []).map((d) => (d.id === divId ? { ...d, time } : d)),
      })),
    }));
  }

  // exceção de horário por dia da semana. Valor vazio remove a chave e volta pro padrão.
  const patchTimes = (obj, dow, time) => {
    const times = { ...(obj.times || {}) };
    if (time) times[String(dow)] = time;
    else delete times[String(dow)];
    return times;
  };
  function setDivisionDayTime(modId, divId, dow, time) {
    setState((prev) => ({
      ...prev,
      workoutPlan: mapMod(prev, modId, (m) => ({
        ...m,
        divisions: (m.divisions || []).map((d) => (d.id === divId ? { ...d, times: patchTimes(d, dow, time) } : d)),
      })),
    }));
  }
  const setModalityDayTime = (modId, dow, time) =>
    setState((prev) => ({ ...prev, workoutPlan: mapMod(prev, modId, (m) => ({ ...m, times: patchTimes(m, dow, time) })) }));

  const getItemForm = (divId) => itemForms[divId] || { name: "", detail: "" };
  const setItemField = (divId, key) => (e) => setItemForms((f) => ({ ...f, [divId]: { ...getItemForm(divId), [key]: e.target.value } }));

  function addItem(modId, divId) {
    const f = getItemForm(divId);
    const name = (f.name || "").trim();
    if (!name) {
      toast("Informe o exercício", { type: "error" });
      return;
    }
    const item = { id: Date.now(), name: name.slice(0, 80), detail: (f.detail || "").trim().slice(0, 80) };
    setState((prev) => ({
      ...prev,
      workoutPlan: mapMod(prev, modId, (m) => ({
        ...m,
        divisions: (m.divisions || []).map((d) => (d.id === divId ? { ...d, items: [...(d.items || []), item] } : d)),
      })),
    }));
    setItemForms((fs) => ({ ...fs, [divId]: { name: "", detail: "" } }));
  }
  function removeItem(modId, divId, itemId) {
    setState((prev) => ({
      ...prev,
      workoutPlan: mapMod(prev, modId, (m) => ({
        ...m,
        divisions: (m.divisions || []).map((d) => (d.id === divId ? { ...d, items: (d.items || []).filter((i) => i.id !== itemId) } : d)),
      })),
    }));
  }

  // ---- reordenar exercícios (drag & drop) ----
  const [drag, setDrag] = useState(null); // { divId, index }
  const [dragOver, setDragOver] = useState(null); // { divId, index }
  function moveItem(modId, divId, from, to) {
    if (from === to) return;
    setState((prev) => ({
      ...prev,
      workoutPlan: mapMod(prev, modId, (m) => ({
        ...m,
        divisions: (m.divisions || []).map((d) => {
          if (d.id !== divId) return d;
          const items = [...(d.items || [])];
          if (from < 0 || from >= items.length || to < 0 || to >= items.length) return d;
          const [moved] = items.splice(from, 1);
          items.splice(to, 0, moved);
          return { ...d, items };
        }),
      })),
    }));
  }

  // ---- edição inline de exercício do plano ----
  const [itemEdits, setItemEdits] = useState({}); // { [itemId]: {name, detail} }
  const startItemEdit = (it) => setItemEdits((e) => ({ ...e, [it.id]: { name: it.name, detail: it.detail || "" } }));
  const cancelItemEdit = (itemId) =>
    setItemEdits((e) => {
      const { [itemId]: _, ...rest } = e;
      return rest;
    });
  const editItemField = (itemId, key) => (e) => setItemEdits((es) => ({ ...es, [itemId]: { ...es[itemId], [key]: e.target.value } }));
  function saveItemEdit(modId, divId, itemId) {
    const f = itemEdits[itemId];
    const name = (f?.name || "").trim();
    if (!name) {
      toast("Informe o exercício", { type: "error" });
      return;
    }
    const patch = { name: name.slice(0, 80), detail: (f.detail || "").trim().slice(0, 80) };
    // rename migra o histórico de séries (gym_sets são chaveados por nome)
    const curMod = plan.find((m) => m.id === modId);
    const oldName = (curMod?.divisions || []).find((d) => d.id === divId)?.items?.find((i) => i.id === itemId)?.name;
    const renamed = !!oldName && oldName !== patch.name && isGymModality(curMod);
    const migrated = renamed ? (state.gymSets || []).filter((s) => s.exercise === oldName).length : 0;
    setState((prev) => ({
      ...prev,
      workoutPlan: mapMod(prev, modId, (m) => ({
        ...m,
        divisions: (m.divisions || []).map((d) =>
          d.id === divId ? { ...d, items: (d.items || []).map((i) => (i.id === itemId ? { ...i, ...patch } : i)) } : d
        ),
      })),
      gymSets: renamed
        ? (prev.gymSets || []).map((s) => (s.exercise === oldName ? { ...s, exercise: patch.name } : s))
        : prev.gymSets,
    }));
    if (renamed && chartEx === oldName) setChartEx(patch.name);
    if (renamed && rowForms[oldName]) setRowForms(({ [oldName]: row, ...rest }) => ({ ...rest, [patch.name]: row }));
    if (migrated > 0) toast("Histórico migrado", { sub: `${migrated} SÉRIE(S) → ${patch.name.toUpperCase()}`, icon: "sync_alt" });
    cancelItemEdit(itemId);
  }

  const today = getDateStr(0);

  // ===== data da sessão (retroativo até 7 dias) =====
  const [sessionDate, setSessionDate] = useState(getDateStr(0));
  const minDate = shiftDate(today, -7);
  const isRetro = sessionDate !== today;
  const validSessionDate = sessionDate >= minDate && sessionDate <= today;
  const ddmm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

  // ===== academia: séries (peso × reps | falha) =====
  const gymSets = state.gymSets || [];
  const [setForm, setSetForm] = useState({ exercise: "", weight: "", reps: "" });
  const [setFailure, setSetFailure] = useState(false);
  const [chartEx, setChartEx] = useState(null);
  const [metric, setMetric] = useState("max"); // max | volume
  const [rowForms, setRowForms] = useState({}); // { [exercise]: {weight, reps, failure} }

  const gymMod = plan.find(isGymModality);
  const planExercises = (gymMod?.divisions || []).flatMap((d) => (d.items || []).map((i) => i.name));
  const knownExercises = [...new Set([...gymExercises(gymSets), ...planExercises])];
  // séries da DATA selecionada (retroativo mostra/grava na data escolhida)
  const sessionSets = gymSets.filter((s) => s.date === sessionDate);
  const sessionByEx = {};
  for (const s of sessionSets) (sessionByEx[s.exercise] ||= []).push(s);

  // ficha do fluxo unificado: divisão da sessão dirige a ficha, SÓ se a modalidade selecionada é academia
  const isGymSession = isGymModality(selectedMod);
  const trainDiv = isGymSession ? (selectedMod?.divisions || []).find((d) => d.name === effectiveDivision) || null : null;
  const trainItems = trainDiv?.items || [];
  const trainNames = new Set(trainItems.map((i) => i.name));
  // avulsos do dia = séries de exercícios fora da ficha carregada
  const looseByEx = Object.fromEntries(Object.entries(sessionByEx).filter(([ex]) => !trainNames.has(ex)));

  const getRow = (ex) => rowForms[ex] || { weight: "", reps: "", failure: false };
  const setRow = (ex, patch) => setRowForms((f) => ({ ...f, [ex]: { ...getRow(ex), ...patch } }));

  // ===== descanso entre séries =====
  // Ancorado no relógio (endRef), não na contagem de ticks: aba em segundo plano é
  // estrangulada pelo navegador, então contar intervalos atrasaria o cronômetro.
  const restPref = state.settings?.restSec || 90;
  const [restLeft, setRestLeft] = useState(0);
  const [restTotal, setRestTotal] = useState(0); // duração da rodada atual, p/ o % da barra
  const restEndRef = useRef(0);

  const startRest = (sec = restPref) => {
    restEndRef.current = Date.now() + sec * 1000;
    setRestTotal(sec);
    setRestLeft(sec);
  };
  const stopRest = () => {
    restEndRef.current = 0;
    setRestLeft(0);
  };
  const bumpRest = (delta) => {
    if (!restEndRef.current) return;
    restEndRef.current = Math.max(Date.now(), restEndRef.current + delta * 1000);
    setRestTotal((t) => t + delta); // senão +30s trava a barra em 100%
    setRestLeft(Math.max(0, Math.round((restEndRef.current - Date.now()) / 1000)));
  };

  useEffect(() => {
    if (!restEndRef.current) return;
    const tick = () => {
      const left = Math.max(0, Math.round((restEndRef.current - Date.now()) / 1000));
      setRestLeft(left);
      if (left === 0) {
        restEndRef.current = 0;
        playAlarm();
        toast("Descanso acabou", { sub: "Próxima série.", icon: "fitness_center" });
      }
    };
    const id = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick); // volta pra aba → recalcula na hora
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [restLeft > 0, toast]);

  // registra série p/ um exercício (ficha ou avulso). Retorna true se gravou.
  function pushSet(exercise, { weight, reps, failure }) {
    const ex = exercise.trim().slice(0, 60);
    const w = parseFloat(String(weight).replace(",", "."));
    const r = parseInt(reps, 10);
    if (!validSessionDate) {
      toast("Data inválida — até 7 dias atrás", { type: "error" });
      return false;
    }
    if (!ex) {
      toast("Informe o exercício", { type: "error" });
      return false;
    }
    if (isNaN(w) || w <= 0) {
      toast("Informe a carga (kg)", { type: "error" });
      return false;
    }
    if (!failure && (isNaN(r) || r <= 0)) {
      toast("Informe as repetições ou marque FALHA", { type: "error" });
      return false;
    }
    setState((prev) => ({
      ...prev,
      gymSets: [
        ...(prev.gymSets || []),
        { id: crypto.randomUUID(), date: sessionDate, exercise: ex, weight: w, reps: isNaN(r) || r <= 0 ? null : r, failure: !!failure },
      ],
    }));
    if (!isRetro) startRest(); // série retroativa não é descanso de agora
    return true;
  }
  const chartExercise = chartEx || gymExercises(gymSets)[0] || null;
  const progress = chartExercise ? gymProgress(gymSets, chartExercise).slice(-12) : [];
  const progressVals = progress.map((p) => (metric === "max" ? p.max : Math.round(p.volume)));

  function addSet() {
    if (!pushSet(setForm.exercise, { weight: setForm.weight, reps: setForm.reps, failure: setFailure })) return;
    setSetForm((f) => ({ ...f, reps: "" })); // mantém exercício+carga pra próxima série
    setSetFailure(false);
  }

  function addRowSet(exercise) {
    const row = getRow(exercise);
    if (!pushSet(exercise, row)) return;
    setRow(exercise, { reps: "", failure: false }); // mantém carga
  }
  function removeSet(id) {
    setState((prev) => ({ ...prev, gymSets: (prev.gymSets || []).filter((s) => s.id !== id) }));
  }

  const days = last7Dates();
  const daysSet = new Set(days);
  // mais recente primeiro; empate na data mantém ordem de inserção (prepend)
  const weekLogs = state.exerciseLogs.filter((l) => daysSet.has(l.date)).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const goal = state.settings.exerciseWeeklyGoal;
  // meta semanal = dias treinados na SEMANA do calendário (começa segunda), não janela móvel
  const weekStart = weekStartOf(getDateStr(0));
  const weekDone = new Set(state.exerciseLogs.filter((l) => l.date >= weekStart).map((l) => l.date)).size;

  // volume per weekday (total minutes)
  const volByDate = {};
  for (const l of weekLogs) volByDate[l.date] = (volByDate[l.date] || 0) + l.durationMin;
  const weekVolume = weekLogs.reduce((s, l) => s + l.durationMin, 0);
  const maxDayVol = Math.max(1, ...days.map((d) => volByDate[d] || 0));

  // week vs prev-week comparison
  const prevDays = Array.from({ length: 7 }, (_, i) => getDateStr(-(13 - i)));
  const prevSet = new Set(prevDays);
  const prevVolume = state.exerciseLogs.filter((l) => prevSet.has(l.date)).reduce((s, l) => s + l.durationMin, 0);
  const volDelta = prevVolume ? Math.round(((weekVolume - prevVolume) / prevVolume) * 100) : null;

  // current intensity gauge = avg intensity of week (0-5) -> %
  const avgIntensity = weekLogs.length ? weekLogs.reduce((s, l) => s + l.intensity, 0) / weekLogs.length : 0;
  const intensityPct = Math.round((avgIntensity / 5) * 100);

  // 30-day frequency bars (minutes per day)
  const days30 = Array.from({ length: 30 }, (_, i) => getDateStr(-(29 - i)));
  const freqByDate = {};
  for (const l of state.exerciseLogs) if (freqByDate[l.date] !== undefined || days30.includes(l.date)) freqByDate[l.date] = (freqByDate[l.date] || 0) + l.durationMin;
  const maxFreq = Math.max(60, ...days30.map((d) => freqByDate[d] || 0));

  function logWorkout() {
    if (!type) {
      toast("Cadastre uma modalidade em Meus Treinos", { type: "error" });
      return;
    }
    if (!validSessionDate) {
      toast("Data inválida — até 7 dias atrás", { type: "error" });
      return;
    }
    const n = Number(duration);
    if (!String(duration).trim() || Number.isNaN(n) || n < 1) {
      toast("Informe uma duração válida", { type: "error" });
      return;
    }
    const durationMin = Math.min(300, Math.max(5, Math.round(n)));
    setState((prev) => {
      const xpGain = award(XP.exercise, prev.stats.streak); // grava no log p/ estorno simétrico ao excluir
      const log = { id: crypto.randomUUID(), date: sessionDate, type, division: effectiveDivision, durationMin, intensity, note: note.slice(0, 200), xp: xpGain };
      return {
        ...prev,
        exerciseLogs: [log, ...prev.exerciseLogs].slice(0, 200),
        stats: { ...prev.stats, xp: (prev.stats.xp || 0) + xpGain },
      };
    });
    setNote("");
    const label = effectiveDivision ? `${type} · ${effectiveDivision}` : type;
    const when = isRetro ? ` · ${ddmm(sessionDate)}` : "";
    toast("Treino registrado", { sub: `${label.toUpperCase()}${when} · ${durationMin} MIN · +${XP.exercise} XP`, icon: "fitness_center" });
    if (isRetro) setSessionDate(today); // evita segunda sessão acidental na data velha
  }
  async function removeLog(id) {
    const log = state.exerciseLogs.find((l) => l.id === id);
    const ok = await confirm({ title: "Remover treino?", body: log?.xp ? `Devolve ${log.xp} XP ganho nesse treino.` : "", confirmLabel: "REMOVER" });
    if (!ok) return;
    setState((prev) => ({
      ...prev,
      exerciseLogs: prev.exerciseLogs.filter((l) => l.id !== id),
      stats: { ...prev.stats, xp: Math.max(0, (prev.stats.xp || 0) - (log?.xp || 0)) },
    }));
  }
  function updateGoal(delta) {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, exerciseWeeklyGoal: Math.min(14, Math.max(1, prev.settings.exerciseWeeklyGoal + delta)) },
    }));
  }

  return (
    <div className="grid grid-cols-12 gap-gutter">
      {/* Header */}
      <div className="col-span-12">
        <h1 className="font-headline-lg text-headline-lg text-primary uppercase mb-2">Cockpit de Treino</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          Registre sua disciplina. Cada métrica é um passo rumo à performance de elite.
        </p>
      </div>

      {/* Abas */}
      <div role="tablist" aria-label="Seções do treino" className="col-span-12 flex rounded-xl overflow-hidden border border-white/10">
        {TABS_EX.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 font-label-caps text-[11px] flex items-center justify-center gap-1.5 transition ${
              tab === t.id ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-variant/40"
            }`}
          >
            <MI name={t.icon} className="text-base" />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.short}</span>
          </button>
        ))}
      </div>

      {/* ============ ABA: REGISTRAR ============ */}
      {tab === "registrar" && (
        <>
          {/* Sessão unificada */}
          <section className="col-span-12 lg:col-span-7 glass-card p-6 md:p-8 rounded-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <MI name="edit_note" className="text-[120px]" />
            </div>
            <h2 className="font-headline-md text-headline-md text-primary mb-6 flex items-center gap-2">
              <MI name="edit_note" /> SESSÃO
              {isRetro && (
                <Caps className="text-outline text-[10px] border border-white/10 rounded-full px-2 py-1 ml-1">
                  RETROATIVO · {ddmm(sessionDate)}
                </Caps>
              )}
            </h2>

            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Caps className="text-on-surface-variant">DATA</Caps>
                  <input
                    type="date"
                    value={sessionDate}
                    min={minDate}
                    max={today}
                    onChange={(e) => setSessionDate(e.target.value || today)}
                    aria-label="Data da sessão"
                    className={`${inputCls} w-full py-2 ${isRetro ? "border-primary-container/40" : ""}`}
                  />
                </div>
                <div className="space-y-2">
                  <Caps className="text-on-surface-variant">TIPO DE TREINO</Caps>
                  <Select
                    value={type}
                    options={modalityNames}
                    onChange={changeType}
                    disabled={modalityNames.length === 0}
                    placeholder="Cadastre uma modalidade em Meus Treinos"
                  />
                </div>
                {divisionNames.length > 0 && (
                  <div className="space-y-2">
                    <Caps className="text-on-surface-variant">DIVISÃO</Caps>
                    <Select value={effectiveDivision} options={divisionNames} onChange={setDivision} placeholder="Selecione a divisão" />
                  </div>
                )}
              </div>

              {/* ficha da academia: séries por exercício, salvam na hora */}
              {isGymSession && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Caps className="text-on-surface-variant">SÉRIES · {trainDiv ? trainDiv.name.toUpperCase() : "SEM DIVISÃO"}</Caps>
                    <Caps className={`text-[9px] ${isRetro ? "text-primary-container" : "text-outline"}`}>
                      {isRetro ? `SALVAM EM ${ddmm(sessionDate)}` : "SALVAM AO ADICIONAR"}
                    </Caps>
                  </div>

                  {/* descanso: começa sozinho ao registrar série */}
                  {!isRetro && (
                    <RestTimer
                      left={restLeft}
                      total={restTotal}
                      pref={restPref}
                      onPick={(s) => setSetting("restSec", s)}
                      onStart={(s) => {
                        if (s !== restPref) setSetting("restSec", s);
                        startRest(s);
                      }}
                      onBump={() => bumpRest(30)}
                      onSkip={stopRest}
                    />
                  )}

                  {trainDiv && trainItems.length === 0 && (
                    <div className="text-[12px] text-outline bg-surface-container-high rounded-lg border border-white/5 p-3 flex items-center justify-between gap-2">
                      <span>Divisão sem exercícios.</span>
                      <button onClick={() => setTab("treinos")} className="font-label-caps text-[10px] text-primary hover:underline shrink-0">
                        CADASTRAR →
                      </button>
                    </div>
                  )}

                  {trainItems.length > 0 && (
                    <div className="space-y-2.5">
                      {trainItems.map((it) => {
                        const sets = sessionByEx[it.name] || [];
                        const row = getRow(it.name);
                        const pr = gymPR(gymSets, it.name);
                        return (
                          <div key={it.id} className="bg-surface-container-high rounded-lg border border-white/5 p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sets.length ? "bg-primary-container" : "bg-surface-variant"}`} />
                              <button onClick={() => openInfo(it.name)} className="flex-1 min-w-0 flex items-center gap-1 text-[13px] font-bold text-on-surface truncate text-left hover:text-primary transition" title="Ver músculo + vídeo">
                                <span className="truncate">{it.name}</span>
                                <MI name="info" className="text-sm text-outline shrink-0" />
                              </button>
                              {pr && (
                                <span
                                  title={`Recorde pessoal: ${pr.weight}kg${pr.reps ? ` × ${pr.reps}` : ""}`}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary-container/15 border border-primary-container/30 text-primary-container text-[10px] font-bold tabular-nums shrink-0"
                                >
                                  <MI name="emoji_events" fill className="text-[11px]" /> {pr.weight}kg{pr.reps ? `×${pr.reps}` : ""}
                                </span>
                              )}
                              {it.detail && <Caps className="text-outline text-[9px] shrink-0">{it.detail}</Caps>}
                            </div>
                            {sets.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {sets.map((s) => (
                                  <span key={s.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-surface-container-lowest border border-white/10 text-[11px] text-on-surface tabular-nums">
                                    {s.weight}kg×{s.reps ?? "F"}
                                    {s.failure && s.reps != null && <span className="text-error text-[9px] font-bold">F</span>}
                                    <button onClick={() => removeSet(s.id)} aria-label="Remover série" className="text-outline hover:text-error transition flex items-center">
                                      <MI name="close" className="text-[13px]" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="grid grid-cols-12 gap-1.5">
                              <input
                                value={row.weight}
                                onChange={(e) => setRow(it.name, { weight: e.target.value })}
                                inputMode="decimal"
                                placeholder="kg"
                                className={`${inputCls} col-span-3 text-[12px] py-1.5`}
                              />
                              <input
                                value={row.reps}
                                onChange={(e) => setRow(it.name, { reps: e.target.value })}
                                onKeyDown={(e) => e.key === "Enter" && addRowSet(it.name)}
                                inputMode="numeric"
                                placeholder="reps"
                                className={`${inputCls} col-span-3 text-[12px] py-1.5`}
                              />
                              <button
                                onClick={() => setRow(it.name, { failure: !row.failure })}
                                aria-pressed={row.failure}
                                className={`col-span-3 rounded-lg font-label-caps text-[9px] border transition ${
                                  row.failure ? "bg-error text-on-error border-error" : "border-error/40 text-error hover:bg-error/10"
                                }`}
                              >
                                FALHA
                              </button>
                              <button onClick={() => addRowSet(it.name)} aria-label={`Adicionar série de ${it.name}`} className="col-span-3 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center active:scale-95 transition py-1.5">
                                <MI name="add" className="text-lg" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* avulso compacto */}
                  <details className="mt-3 group">
                    <summary className="cursor-pointer font-label-caps text-[10px] text-outline hover:text-primary transition list-none flex items-center gap-1">
                      <MI name="chevron_right" className="text-sm transition-transform group-open:rotate-90" /> EXERCÍCIO AVULSO
                    </summary>
                    <div className="grid grid-cols-12 gap-2 mt-2">
                      <input
                        value={setForm.exercise}
                        onChange={(e) => setSetForm((f) => ({ ...f, exercise: e.target.value }))}
                        list="gym-exercises"
                        placeholder="Exercício (ex.: Supino reto)"
                        className={`${inputCls} col-span-12 text-[13px]`}
                      />
                      <datalist id="gym-exercises">
                        {knownExercises.map((n) => (
                          <option key={n} value={n} />
                        ))}
                      </datalist>
                      <input
                        value={setForm.weight}
                        onChange={(e) => setSetForm((f) => ({ ...f, weight: e.target.value }))}
                        inputMode="decimal"
                        placeholder="kg"
                        className={`${inputCls} col-span-3 text-[13px]`}
                      />
                      <input
                        value={setForm.reps}
                        onChange={(e) => setSetForm((f) => ({ ...f, reps: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && addSet()}
                        inputMode="numeric"
                        placeholder="reps"
                        className={`${inputCls} col-span-3 text-[13px]`}
                      />
                      <button
                        onClick={() => setSetFailure((v) => !v)}
                        aria-pressed={setFailure}
                        className={`col-span-3 rounded-lg font-label-caps text-[10px] border transition ${
                          setFailure ? "bg-error text-on-error border-error" : "border-error/40 text-error hover:bg-error/10"
                        }`}
                      >
                        FALHA
                      </button>
                      <button onClick={addSet} aria-label="Adicionar série avulsa" className="col-span-3 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center active:scale-95 transition">
                        <MI name="add" />
                      </button>
                    </div>
                    {Object.keys(looseByEx).length > 0 && (
                      <div className="space-y-2 mt-3">
                        {Object.entries(looseByEx).map(([ex, sets]) => (
                          <div key={ex}>
                            <Caps className="text-primary-container text-[10px] block mb-1">{ex}</Caps>
                            <div className="flex flex-wrap gap-1.5">
                              {sets.map((s) => (
                                <span key={s.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-surface-container-lowest border border-white/10 text-[11px] text-on-surface tabular-nums">
                                  {s.weight}kg×{s.reps ?? "F"}
                                  <button onClick={() => removeSet(s.id)} aria-label="Remover série" className="text-outline hover:text-error transition flex items-center">
                                    <MI name="close" className="text-[13px]" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </details>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Caps className="text-on-surface-variant">DURAÇÃO (MIN)</Caps>
                  <input
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    inputMode="numeric"
                    placeholder="60"
                    className={`${inputCls} w-full py-2.5`}
                  />
                </div>
                <div className="space-y-2">
                  <Caps className="text-on-surface-variant">INTENSIDADE</Caps>
                  <div className="py-2">
                    <StarRating value={intensity} onChange={setIntensity} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Caps className="text-on-surface-variant">NOTAS</Caps>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Como se sentiu, observações..."
                  maxLength={200}
                  rows={2}
                  className={textareaCls}
                />
              </div>

              <button
                onClick={logWorkout}
                style={GLOW}
                className="w-full py-4 bg-primary text-on-primary font-headline-md text-headline-md uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-primary-container active:scale-[0.99] transition-colors rounded-lg"
              >
                REGISTRAR SESSÃO
                <MI name="chevron_right" />
              </button>
            </div>
          </section>

          {/* Feed treinos da semana */}
          <div className="col-span-12 lg:col-span-5 glass-card p-5 rounded-xl border-primary/20 bg-primary/5 self-start">
            <div className="flex items-center gap-3 text-primary mb-3">
              <MI name="sensors" />
              <Caps>TREINOS DA SEMANA</Caps>
            </div>
            {weekLogs.length === 0 ? (
              <p className="text-[12px] text-on-surface-variant">Nenhum treino registrado ainda.</p>
            ) : (
              <ul className="flex flex-col gap-2 max-h-[420px] overflow-y-auto ff-scroll">
                {weekLogs.map((l) => (
                  <li key={l.id} className="flex flex-col gap-1 rounded-lg px-3 py-2 bg-surface-container-high border border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-body-md text-on-surface truncate">{l.type}{l.division ? ` · ${l.division}` : ""} · {l.durationMin} min</p>
                        <Caps className="text-outline text-[10px]">{weekdayShort(l.date)}, {l.date}</Caps>
                      </div>
                      <StarRating value={l.intensity} onChange={() => {}} size="text-sm" />
                      <button onClick={() => removeLog(l.id)} aria-label="Remover" className="text-outline hover:text-error transition">
                        <MI name="close" className="text-lg" />
                      </button>
                    </div>
                    {l.note && <p className="text-[12px] text-on-surface-variant">{l.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* ============ ABA: PROGRESSO ============ */}
      {tab === "progresso" && (
        <>
          {/* Gráfico de progressão de carga */}
          <div className="col-span-12 lg:col-span-7 glass-card p-6 rounded-xl flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between mb-4">
              <div>
                <h3 className="font-headline-md text-headline-md text-primary uppercase">Progressão de Carga</h3>
                <Caps className="text-outline text-[10px]">ÚLTIMOS {progress.length} TREINO(S)</Caps>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-44">
                  <Select value={chartExercise} options={gymExercises(gymSets)} onChange={setChartEx} placeholder="Exercício" disabled={gymExercises(gymSets).length === 0} />
                </div>
                <div className="flex rounded-lg overflow-hidden border border-white/10 shrink-0">
                  <button
                    onClick={() => setMetric("max")}
                    className={`px-3 py-2 font-label-caps text-[10px] transition ${metric === "max" ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-variant/40"}`}
                  >
                    CARGA
                  </button>
                  <button
                    onClick={() => setMetric("volume")}
                    className={`px-3 py-2 font-label-caps text-[10px] transition ${metric === "volume" ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-variant/40"}`}
                  >
                    VOLUME
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 flex items-center">
              {progress.length > 0 ? (
                <LineChart
                  days={progress.map((p) => p.date)}
                  values={progressVals}
                  today={today}
                  yMax={Math.max(...progressVals) * 1.15 || 10}
                  format={(v) => (metric === "max" ? `${v}kg` : `${v}`)}
                  xLabel={(d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`}
                  ariaLabel={`Progressão de ${chartExercise || "exercício"}`}
                />
              ) : (
                <p className="text-[13px] text-outline text-center w-full py-10">
                  Registre séries na aba REGISTRAR pra ver sua progressão de carga.
                </p>
              )}
            </div>
          </div>

          {/* Coluna direita: intensidade + volume + meta */}
          <div className="col-span-12 lg:col-span-5 flex flex-col gap-gutter">
            <div className="glass-card p-6 rounded-xl flex items-center justify-between">
              <Caps className="text-primary uppercase">Intensidade média (7d)</Caps>
              <p className="font-display-timer text-[40px] leading-none text-primary">{intensityPct}%</p>
            </div>

            {/* Weekly volume heatmap */}
            <div className="glass-card p-6 rounded-xl">
              <div className="flex justify-between items-center mb-6">
                <Caps className="text-primary">VOLUME SEMANAL</Caps>
                <MI name="grid_view" className="text-on-surface-variant" />
              </div>
              <div className="grid grid-cols-7 gap-2">
                {days.map((d) => {
                  const vol = volByDate[d] || 0;
                  const isToday = d === today;
                  const ratio = vol / maxDayVol; // 0..1
                  const bg = vol === 0 ? "bg-surface-container-highest" : "bg-primary";
                  const opacity = vol === 0 ? 1 : 0.2 + ratio * 0.7;
                  return (
                    <div key={d} className="space-y-2">
                      <div
                        className={`h-12 w-full rounded-sm ${bg} ${isToday && vol ? "border border-primary/50 shadow-inner" : ""}`}
                        style={{ opacity }}
                        title={`${vol} min`}
                      />
                      <div className={`text-center text-[10px] font-label-caps ${isToday ? "text-primary" : "text-on-surface-variant"}`}>
                        {weekdayShort(d)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                <Caps className="text-[10px] text-on-surface-variant">VOLUME TOTAL: {weekVolume} MIN</Caps>
                {volDelta !== null && (
                  <Caps className={`text-[10px] ${volDelta >= 0 ? "text-primary" : "text-error"}`}>
                    {volDelta >= 0 ? "+" : ""}{volDelta}% VS SEMANA PASSADA
                  </Caps>
                )}
              </div>
            </div>

            {/* Weekly goal */}
            <div className="glass-card p-6 rounded-xl">
              <div className="flex justify-between items-center mb-4">
                <Caps className="text-primary">META SEMANAL</Caps>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateGoal(-1)} aria-label="Diminuir meta" className="w-7 h-7 rounded-full bg-surface-variant text-on-surface flex items-center justify-center hover:brightness-125 active:scale-95 transition">−</button>
                  <span className="font-label-caps w-8 text-center text-primary">{goal}x</span>
                  <button onClick={() => updateGoal(1)} aria-label="Aumentar meta" className="w-7 h-7 rounded-full bg-surface-variant text-on-surface flex items-center justify-center hover:brightness-125 active:scale-95 transition">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {Array.from({ length: goal }).map((_, i) => (
                  <MI key={i} name="fitness_center" fill={i < weekDone} className={`text-2xl ${i < weekDone ? "text-primary" : "text-surface-variant"}`} />
                ))}
                {weekDone > goal && <Caps className="text-outline ml-1">+{weekDone - goal}</Caps>}
              </div>
              <p className="text-[12px] text-on-surface-variant mt-3">{weekDone} de {goal} treinos essa semana</p>
            </div>
          </div>

          {/* Frequency bar chart (30d) */}
          <section className="col-span-12 glass-card p-6 rounded-xl overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">FREQUÊNCIA DE TREINO (30D)</h3>
                <Caps className="text-on-surface-variant">CONSISTÊNCIA ACIMA DE INTENSIDADE</Caps>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-primary rounded-full" />
                  <span className="text-[10px] font-label-caps">TREINO</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-surface-container-highest rounded-full" />
                  <span className="text-[10px] font-label-caps">DESCANSO</span>
                </div>
              </div>
            </div>
            <div className="flex items-end justify-between h-32 gap-[3px] md:gap-2">
              {days30.map((d) => {
                const vol = freqByDate[d] || 0;
                const isToday = d === today;
                const hpct = vol === 0 ? 6 : Math.max(12, Math.round((vol / maxFreq) * 100));
                return (
                  <div
                    key={d}
                    title={`${weekdayShort(d)} ${d} · ${vol} min`}
                    style={{ height: `${hpct}%`, ...(isToday && vol ? GLOW : {}) }}
                    className={`w-full rounded-t-sm transition-colors ${vol === 0 ? "bg-surface-container-highest" : "bg-primary hover:bg-primary-container"}`}
                  />
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* ============ ABA: MEUS TREINOS ============ */}
      {tab === "treinos" && (
        <section className="col-span-12 space-y-4">
          <p className="text-body-md text-on-surface-variant">
            Monte seus treinos por modalidade. Ex.: Academia com divisões A/B/C/D, JiuJitsu com posições. Tudo dinâmico.
          </p>

          {plan.length === 0 && (
            <p className="text-[13px] text-outline glass-card rounded-xl p-6 text-center">Nenhuma modalidade ainda — crie a primeira abaixo.</p>
          )}

          {plan.map((m) => {
            const gym = isGymModality(m);
            return (
              <div key={m.id} className="glass-card p-6 rounded-xl">
                <div className="flex items-center gap-3 mb-4">
                  <MI name={gym ? "fitness_center" : "sports_martial_arts"} className="text-primary-container shrink-0" />
                  {gym ? (
                    <span className="flex-1 min-w-0 font-headline-md text-headline-md text-primary">{m.name}</span>
                  ) : (
                    <input
                      value={m.name}
                      onChange={(e) => renameModality(m.id, e.target.value)}
                      aria-label="Nome da modalidade"
                      className="flex-1 min-w-0 bg-transparent font-headline-md text-headline-md text-primary outline-none border-b border-transparent focus:border-primary-container/40 transition-colors"
                    />
                  )}
                  {gym ? (
                    <Caps className="text-outline text-[10px] border border-white/10 rounded-full px-2 py-1 shrink-0">FIXA</Caps>
                  ) : (
                    <button onClick={() => removeModality(m.id)} aria-label="Excluir modalidade" className="text-outline hover:text-error transition p-1 shrink-0">
                      <MI name="delete" />
                    </button>
                  )}
                </div>

                {gym && (
                <>
                <div className="space-y-3">
                  {(m.divisions || []).map((d) => {
                    const f = getItemForm(d.id);
                    return (
                      <div key={d.id} className="bg-surface-container-high rounded-lg border border-white/5 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <MI name="view_module" className="text-outline text-lg shrink-0" />
                          <input
                            value={d.name}
                            onChange={(e) => renameDivision(m.id, d.id, e.target.value)}
                            aria-label="Nome da divisão"
                            className="flex-1 min-w-0 bg-transparent font-label-caps text-label-caps text-primary outline-none border-b border-transparent focus:border-primary-container/40 transition-colors"
                          />
                          <button onClick={() => removeDivision(m.id, d.id)} aria-label="Excluir divisão" className="text-outline hover:text-error transition p-1 shrink-0">
                            <MI name="delete" className="text-lg" />
                          </button>
                        </div>

                        {/* dias da semana em que faço esse treino (aparece na Home) */}
                        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                          <Caps className="text-outline text-[9px] mr-1">DIAS</Caps>
                          {DOW_SHORT.map((label, idx) => {
                            const on = (d.weekdays || []).includes(idx);
                            return (
                              <button
                                key={idx}
                                onClick={() => toggleDivisionDay(m.id, d.id, idx)}
                                aria-label={`${label}${on ? " (ativo)" : ""}`}
                                aria-pressed={on}
                                className={`w-8 h-8 rounded-full font-label-caps text-[9px] transition active:scale-95 ${
                                  on ? "bg-primary-container text-on-primary-container" : "bg-surface-container-lowest/60 text-outline hover:text-on-surface-variant"
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                          {(d.weekdays || []).length > 0 && (
                            <label className="flex items-center gap-1.5 ml-1">
                              <Caps className={`text-[9px] ${d.time ? "text-outline" : "text-primary-container"}`}>HORA</Caps>
                              <input
                                type="time"
                                value={d.time || ""}
                                onChange={(e) => setDivisionTime(m.id, d.id, e.target.value)}
                                aria-label="Horário do treino"
                                title="Horário — aparece na Agenda"
                                className={`bg-surface-container-lowest/60 text-on-surface border rounded px-2 py-1 text-[11px] outline-none focus:border-primary-container/50 transition ${
                                  d.time ? "border-white/5" : "border-primary-container/40"
                                }`}
                              />
                              {!d.time && <span className="text-[10px] text-outline">sem hora = dia inteiro na Agenda</span>}
                            </label>
                          )}
                        </div>

                        <DayTimes weekdays={d.weekdays} obj={d} onSet={(dow, t) => setDivisionDayTime(m.id, d.id, dow, t)} />

                        {(d.items || []).length > 0 && (
                          <div className="space-y-1.5 mb-3">
                            {d.items.map((it, idx) => {
                              const ed = itemEdits[it.id];
                              if (ed) {
                                return (
                                  <div key={it.id} className="flex flex-col sm:flex-row gap-2 py-1.5 px-2 rounded bg-surface-container-lowest/50 border border-primary-container/30">
                                    <input
                                      value={ed.name}
                                      onChange={editItemField(it.id, "name")}
                                      onKeyDown={(e) => (e.key === "Enter" ? saveItemEdit(m.id, d.id, it.id) : e.key === "Escape" ? cancelItemEdit(it.id) : null)}
                                      autoFocus
                                      placeholder="Exercício"
                                      className={`${inputCls} flex-1 text-[13px] py-1.5`}
                                    />
                                    <input
                                      value={ed.detail}
                                      onChange={editItemField(it.id, "detail")}
                                      onKeyDown={(e) => (e.key === "Enter" ? saveItemEdit(m.id, d.id, it.id) : e.key === "Escape" ? cancelItemEdit(it.id) : null)}
                                      placeholder="Detalhe (ex.: 4x12 · 30kg)"
                                      className={`${inputCls} flex-1 text-[13px] py-1.5`}
                                    />
                                    <div className="flex gap-1 shrink-0">
                                      <button onClick={() => saveItemEdit(m.id, d.id, it.id)} aria-label="Salvar exercício" className="px-2.5 rounded-lg bg-primary-container text-on-primary-container flex items-center active:scale-95 transition">
                                        <MI name="check" className="text-lg" />
                                      </button>
                                      <button onClick={() => cancelItemEdit(it.id)} aria-label="Cancelar edição" className="px-2.5 rounded-lg bg-surface-variant text-on-surface-variant flex items-center active:scale-95 transition">
                                        <MI name="close" className="text-lg" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              }
                              const isDragging = drag && drag.divId === d.id && drag.index === idx;
                              const isOver = dragOver && dragOver.divId === d.id && dragOver.index === idx && !isDragging;
                              return (
                                <div
                                  key={it.id}
                                  onDragOver={(e) => {
                                    if (!drag || drag.divId !== d.id) return;
                                    e.preventDefault();
                                    if (!isOver) setDragOver({ divId: d.id, index: idx });
                                  }}
                                  onDrop={(e) => {
                                    if (!drag || drag.divId !== d.id) return;
                                    e.preventDefault();
                                    moveItem(m.id, d.id, drag.index, idx);
                                    setDrag(null);
                                    setDragOver(null);
                                  }}
                                  className={`flex items-center gap-2 py-1.5 px-2 rounded bg-surface-container-lowest/50 transition ${isDragging ? "opacity-40" : ""} ${isOver ? "border-t-2 border-primary-container" : "border-t-2 border-transparent"}`}
                                >
                                  <button
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.effectAllowed = "move";
                                      setDrag({ divId: d.id, index: idx });
                                    }}
                                    onDragEnd={() => {
                                      setDrag(null);
                                      setDragOver(null);
                                    }}
                                    aria-label="Arrastar para reordenar"
                                    className="text-outline hover:text-on-surface-variant cursor-grab active:cursor-grabbing shrink-0 touch-none"
                                  >
                                    <MI name="drag_indicator" className="text-base" />
                                  </button>
                                  <div className="flex-1 min-w-0 text-[13px]">
                                    <button onClick={() => openInfo(it.name)} className="font-bold text-on-surface hover:text-primary transition inline-flex items-center gap-1 text-left" title="Ver músculo + vídeo">
                                      {it.name}
                                      <MI name="info" className="text-sm text-outline" />
                                    </button>
                                    {it.detail && <span className="text-outline"> — {it.detail}</span>}
                                  </div>
                                  {/* fallback de reordenação p/ touch (drag não funciona em mobile) */}
                                  <button onClick={() => moveItem(m.id, d.id, idx, idx - 1)} disabled={idx === 0} aria-label="Mover para cima" className="text-outline hover:text-primary-container disabled:opacity-20 disabled:hover:text-outline transition p-0.5 shrink-0">
                                    <MI name="keyboard_arrow_up" className="text-base" />
                                  </button>
                                  <button onClick={() => moveItem(m.id, d.id, idx, idx + 1)} disabled={idx === d.items.length - 1} aria-label="Mover para baixo" className="text-outline hover:text-primary-container disabled:opacity-20 disabled:hover:text-outline transition p-0.5 shrink-0">
                                    <MI name="keyboard_arrow_down" className="text-base" />
                                  </button>
                                  <button onClick={() => startItemEdit(it)} aria-label="Editar exercício" className="text-outline hover:text-primary-container transition p-1 shrink-0">
                                    <MI name="edit" className="text-base" />
                                  </button>
                                  <button onClick={() => removeItem(m.id, d.id, it.id)} aria-label="Remover exercício" className="text-outline hover:text-error transition p-1 shrink-0">
                                    <MI name="close" className="text-base" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2">
                          <ExercisePicker
                            value={f.name}
                            onChange={(v) => setItemForms((fs) => ({ ...fs, [d.id]: { ...getItemForm(d.id), name: v } }))}
                            onSubmit={() => addItem(m.id, d.id)}
                            catalog={catalog}
                          />
                          <input value={f.detail} onChange={setItemField(d.id, "detail")} onKeyDown={(e) => e.key === "Enter" && addItem(m.id, d.id)} placeholder="Detalhe (ex.: 4x12 · 30kg)" className={`${inputCls} flex-1 text-[13px]`} />
                          <button onClick={() => addItem(m.id, d.id)} aria-label="Adicionar exercício" className="px-3 py-2 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center gap-1 active:scale-95 transition font-label-caps text-[11px] shrink-0">
                            <MI name="add" className="text-lg" /> ADD
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* adicionar divisão */}
                <div className="flex gap-2 mt-4">
                  <input
                    value={divForms[m.id] || ""}
                    onChange={(e) => setDivForms((fs) => ({ ...fs, [m.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addDivision(m.id)}
                    placeholder="Nova divisão (ex.: Treino C, Guarda...)"
                    className={`${inputCls} flex-1 text-[13px]`}
                  />
                  <button onClick={() => addDivision(m.id)} className="px-4 rounded-lg border border-primary/40 text-primary font-label-caps text-[11px] flex items-center gap-1 hover:bg-primary/10 active:scale-95 transition shrink-0">
                    <MI name="add" className="text-lg" /> DIVISÃO
                  </button>
                </div>
                </>
                )}
                {!gym && (
                  <div>
                    <Caps className="text-outline text-[9px] block mb-2">DIAS QUE PRATICO (aparece na Home)</Caps>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {DOW_SHORT.map((label, idx) => {
                        const on = (m.weekdays || []).includes(idx);
                        return (
                          <button
                            key={idx}
                            onClick={() => toggleModalityDay(m.id, idx)}
                            aria-label={`${label}${on ? " (ativo)" : ""}`}
                            aria-pressed={on}
                            className={`w-9 h-9 rounded-full font-label-caps text-[9px] transition active:scale-95 ${
                              on ? "bg-primary-container text-on-primary-container" : "bg-surface-container-lowest/60 text-outline hover:text-on-surface-variant"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                      {(m.weekdays || []).length > 0 && (
                        <label className="flex items-center gap-1.5 ml-1">
                          <Caps className={`text-[9px] ${m.time ? "text-outline" : "text-primary-container"}`}>HORA</Caps>
                          <input
                            type="time"
                            value={m.time || ""}
                            onChange={(e) => setModalityTime(m.id, e.target.value)}
                            aria-label="Horário da prática"
                            title="Horário — aparece na Agenda"
                            className={`bg-surface-container-lowest/60 text-on-surface border rounded px-2 py-1 text-[11px] outline-none focus:border-primary-container/50 transition ${
                              m.time ? "border-white/5" : "border-primary-container/40"
                            }`}
                          />
                          {!m.time && <span className="text-[10px] text-outline">sem hora = dia inteiro na Agenda</span>}
                        </label>
                      )}
                    </div>
                    <div className="mt-3">
                      <DayTimes weekdays={m.weekdays} obj={m} onSet={(dow, t) => setModalityDayTime(m.id, dow, t)} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* adicionar modalidade (simples, sem divisões) */}
          <div className="glass-card p-4 rounded-xl flex flex-col sm:flex-row gap-3 sm:items-center">
            <input
              value={newModality}
              onChange={(e) => setNewModality(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addModality()}
              placeholder="Nova modalidade (ex.: JiuJitsu, Corrida, Natação...)"
              className={`${inputCls} flex-1`}
            />
            <button onClick={addModality} className="px-5 py-2.5 rounded-lg bg-primary-container text-on-primary-container font-label-caps text-label-caps flex items-center justify-center gap-2 active:scale-95 transition">
              <MI name="add" /> ADICIONAR MODALIDADE
            </button>
          </div>
        </section>
      )}

      {infoEx && <ExerciseModal name={infoEx.name} muscle={infoEx.muscle} videoId={infoEx.videoId} onClose={() => setInfoEx(null)} />}
    </div>
  );
}
