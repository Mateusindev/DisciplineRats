"use client";

// ============================================================================
// MASCOTE — o cercado do perfil: um gato que cresce com o XP e se veste na lojinha.
//
// O DESENHO não mora aqui — está em `components/PetArt.js`, porque a tela de sono
// também põe o bicho na cama. Aqui fica só o que é do cercado: a vagabundagem, o
// carinho, o nome, a pelagem e a compra.
//
// Quem pede menos movimento (prefers-reduced-motion) recebe um gato parado: as
// keyframes morrem no CSS e a vagabundagem nem começa aqui.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../AppContext";
import { startItemCheckout } from "@/lib/persistence";
import { MI, Caps, inputCls } from "@/components/ui";
import {
  fmtK,
  gamify,
  petGrowth,
  petCoat,
  togglePetGear,
  defaultPet,
  PET_STAGES,
  PET_COATS,
  PET_SLOTS,
  PET_ITEMS,
  PET_ITEM_BY_ID,
  PET_NAME_LEN,
  petOwns,
  petPriceLabel,
} from "@/lib/state";
import { Toy, Scene, Cat, GearPreview } from "@/components/PetArt";

function Shop({ pet, coat, entitlements, buying, onBuy, onToggle, onClose }) {
  const [slot, setSlot] = useState(PET_SLOTS[0].id);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items = PET_ITEMS.filter((i) => i.slot === slot);
  // grátis é de todos; pago é de quem tem o entitlement. Nenhum dos dois consulta
  // dado que o navegador possa editar.
  const ownsItem = (it) => it.source === "free" || entitlements.includes(it.id);
  const total = PET_ITEMS.length;
  const have = PET_ITEMS.filter(ownsItem).length;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto ff-scroll bg-black/40 backdrop-blur-sm p-4 py-8 animate-[fadeIn_.1s_ease-out]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Lojinha do mascote"
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-outline-variant bg-surface-container shadow-2xl shadow-black/25"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-outline-variant/50 p-4 sm:p-5">
          <MI name="storefront" className="text-primary-container text-3xl shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-headline-md text-headline-md text-primary uppercase">Lojinha</h3>
            {/* O que a pessoa merece saber ANTES de pagar, e o que a lei manda dizer:
                é cosmético, é compra única e não mexe em progresso nenhum. */}
            <p className="text-[11px] text-on-surface-variant">
              Um item grátis por categoria. Os outros custam <strong className="text-on-surface">{petPriceLabel()}</strong> cada, compra única, sem assinatura. São
              acessórios <strong className="text-on-surface">cosméticos</strong>: não dão XP, não sobem nível e não mexem no ranking — XP serve só pra o gato crescer.
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="shrink-0 p-1 text-outline hover:text-on-surface transition">
            <MI name="close" />
          </button>
        </div>

        <div className="flex items-center gap-x-5 border-b border-outline-variant/50 px-4 sm:px-5 py-2.5">
          <span className="flex items-baseline gap-1.5">
            <span className="text-[13px] text-on-surface-variant tabular-nums">
              {have}/{total}
            </span>
            <Caps className="text-outline text-[10px]">ITENS SEUS</Caps>
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <MI name="pix" className="text-sm text-outline" />
            <Caps className="text-outline text-[10px]">PIX · CARTÃO · BOLETO</Caps>
          </span>
        </div>

        <div className="flex gap-1 overflow-x-auto ff-scroll border-b border-outline-variant/50 px-4 sm:px-5 py-2">
          {PET_SLOTS.map((sl) => {
            const on = sl.id === slot;
            const all = PET_ITEMS.filter((i) => i.slot === sl.id);
            return (
              <button
                key={sl.id}
                onClick={() => setSlot(sl.id)}
                aria-pressed={on}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-label-caps text-[10px] transition ${
                  on
                    ? "border-primary-container bg-primary-container/15 text-primary-container"
                    : "border-outline-variant text-on-surface-variant hover:border-outline"
                }`}
              >
                <MI name={sl.icon} className="text-base" />
                {sl.label}
                <span className="tabular-nums text-outline">
                  {all.filter(ownsItem).length}/{all.length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 sm:p-5">
          {items.map((item) => {
            const free = item.source === "free";
            const owned = ownsItem(item);
            const worn = pet.gear?.[item.slot] === item.id;
            return (
              <div
                key={item.id}
                className={`flex flex-col rounded-xl border p-3 transition ${
                  worn ? "border-primary-container bg-primary-container/10" : "border-outline-variant/60 bg-surface-container-high/40"
                }`}
              >
                <div className="relative">
                  <GearPreview item={item} coat={coat} />
                  {free && (
                    <span className="absolute right-0 top-0 rounded-full bg-surface-container px-1.5 py-0.5 font-label-caps text-[9px] text-primary-container">
                      GRÁTIS
                    </span>
                  )}
                </div>
                <div className="mt-2 min-w-0 flex-1">
                  <div className="text-[13px] leading-tight text-on-surface">{item.name}</div>
                  <div className="text-[10px] leading-tight text-outline">{item.desc}</div>
                </div>
                <div className="mt-2">
                  {owned ? (
                    <button
                      onClick={() => onToggle(item.id)}
                      className={`w-full rounded-lg py-1.5 font-label-caps text-[10px] transition active:scale-[.98] ${
                        worn
                          ? "bg-primary-container text-on-primary-container"
                          : "border border-primary-container/50 text-primary-container hover:bg-primary-container/10"
                      }`}
                    >
                      {worn ? "VESTIDO · TIRAR" : "VESTIR"}
                    </button>
                  ) : (
                    <button
                      onClick={() => onBuy(item.id)}
                      disabled={buying === item.id}
                      title={`Comprar por ${petPriceLabel()}`}
                      className="w-full rounded-lg border border-primary py-1.5 font-label-caps text-[10px] tabular-nums text-primary transition hover:bg-primary/10 active:scale-[.98] disabled:opacity-50"
                    >
                      {buying === item.id ? "ABRINDO..." : petPriceLabel()}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- o cercado

const WALK_MIN = 8; // % da largura — margem pra ele não colar nas paredes
const WALK_MAX = 88;

export default function Pet() {
  const { state, setState, toast, refreshEntitlements } = useApp();
  const g = gamify(state.stats);
  const growth = petGrowth(state.stats);
  const stage = growth.cur;
  const pet = state.pet || defaultPet();
  const coat = petCoat(pet.coat);
  const gear = pet.gear || {};
  const name = (pet.name || "").trim();
  const entitlements = state.entitlements || [];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [shop, setShop] = useState(false);
  const [buying, setBuying] = useState(null); // id do item cuja cobrança está abrindo
  const [hearts, setHearts] = useState([]);
  const [walk, setWalk] = useState({ act: "idle", x: 46, dir: 1, dur: 0 });
  const walkRef = useRef(walk);
  walkRef.current = walk;
  const timer = useRef(null);
  const heartId = useRef(0);

  // Máquina de estados da vagabundagem. Sorteia o que fazer, marca quanto tempo
  // aquilo dura e se agenda de novo. Andar devolve destino + duração, e é a duração
  // que vira a transição de `left` — o navegador interpola o passeio.
  const step = useCallback(() => {
    const cur = walkRef.current;
    const r = Math.random();
    let next;
    let wait;
    if (r < 0.5) {
      const x = WALK_MIN + Math.random() * (WALK_MAX - WALK_MIN);
      const dur = Math.max(700, Math.round(Math.abs(x - cur.x) * 62));
      next = { act: "walk", x, dir: x >= cur.x ? 1 : -1, dur };
      wait = dur + 150;
    } else if (r < 0.74) {
      next = { ...cur, act: "idle", dur: 0 };
      wait = 2400 + Math.random() * 2600;
    } else if (r < 0.92) {
      next = { ...cur, act: "sit", dur: 0 };
      wait = 3000 + Math.random() * 3500;
    } else {
      next = { ...cur, act: "sleep", dur: 0 };
      wait = 6000 + Math.random() * 7000;
    }
    setWalk(next);
    timer.current = setTimeout(step, wait);
  }, []);

  useEffect(() => {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (still) return; // gato parado é o pedido; nem começa
    timer.current = setTimeout(step, 1200);
    return () => clearTimeout(timer.current);
  }, [step]);

  // carinho: interrompe o que ele estava fazendo, ele fica feliz e solta corações
  function stroke() {
    clearTimeout(timer.current);
    setWalk((p) => ({ ...p, act: "happy", dur: 0 }));
    const base = heartId.current;
    heartId.current += 3;
    setHearts((hs) => [...hs, ...[0, 1, 2].map((i) => ({ id: base + i, dx: -14 + i * 14, delay: i * 180 }))]);
    setTimeout(() => setHearts((hs) => hs.filter((h) => h.id >= base + 3)), 1800);
    timer.current = setTimeout(step, 2300);
  }

  const patchPet = (p) => setState((prev) => ({ ...prev, pet: { ...(prev.pet || defaultPet()), ...p } }));

  function saveName() {
    patchPet({ name: draft.trim().slice(0, PET_NAME_LEN) });
    setEditing(false);
  }

  // Compra: sai do app pro Mercado Pago. Nada é liberado aqui — a volta acontece
  // pelo back_url, e a liberação só pelo webhook, depois que o dinheiro entrou.
  async function buyItem(itemId) {
    setBuying(itemId);
    const res = await startItemCheckout(itemId);
    setBuying(null);
    if (res.ok) {
      window.location.href = res.url;
      return;
    }
    const msg =
      res.reason === "ja_possui"
        ? "Você já tem esse item"
        : res.reason === "sem_sessao"
          ? "Entre na conta pra comprar"
          : res.reason === "mp_nao_configurado" || res.reason === "site_url_nao_configurada"
            ? "Pagamento ainda não configurado neste servidor"
            : "Não foi possível abrir o pagamento agora";
    toast(msg, { type: "error" });
    if (res.reason === "ja_possui") refreshEntitlements();
  }

  // Volta do checkout. O webhook pode levar alguns segundos depois do "aprovado", e
  // é por isso que a consulta tenta algumas vezes em vez de uma só: chegar aqui e
  // não ver o item é a hora exata em que o usuário desconfia da compra.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("compra");
    if (!q) return;
    // limpa a query pra um F5 não repetir o aviso
    window.history.replaceState({}, "", `${window.location.pathname}#mascote`);
    if (q === "falhou") return toast("Pagamento não concluído", { type: "error" });
    if (q === "pendente") {
      toast("Pagamento pendente", { sub: "Pix/boleto libera quando o banco confirmar", icon: "hourglass_top", duration: 6000 });
      return;
    }
    let tries = 0;
    let alive = true;
    const before = (state.entitlements || []).length;
    const poll = async () => {
      if (!alive) return;
      const ents = await refreshEntitlements();
      if (ents && ents.length > before) {
        setShop(true);
        return toast("Item liberado!", { sub: "Já pode vestir na lojinha", icon: "redeem", duration: 6000 });
      }
      if (++tries < 6) return setTimeout(poll, 2000);
      toast("Pagamento recebido", { sub: "A liberação pode levar alguns minutos — recarregue depois", icon: "hourglass_top", duration: 7000 });
    };
    poll();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = name || "SEM NOME";
  const stageIdx = PET_STAGES.indexOf(stage);
  const wornCount = PET_SLOTS.filter((sl) => gear[sl.id]).length;

  return (
    <section id="mascote" className="scroll-mt-16">
      <div className="flex items-end justify-between mb-4">
        <h3 className="font-headline-md text-headline-md text-primary uppercase">Mascote</h3>
        <Caps className="text-outline">
          {stage.name} · {stageIdx + 1} DE {PET_STAGES.length}
        </Caps>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {/* cercado */}
        <div className="relative h-[190px] overflow-hidden bg-gradient-to-b from-surface-container-high/40 to-transparent">
          <Scene id={gear.scene} />
          <div className="absolute inset-x-0 bottom-0 h-10 border-t border-outline-variant/40 bg-surface-variant/40" />

          {gear.toy && (
            <div className="absolute bottom-7 left-4">
              <Toy id={gear.toy} />
            </div>
          )}

          <button
            onClick={stroke}
            aria-label={`Fazer carinho em ${label.toLowerCase()}`}
            title="Clique pra fazer carinho"
            className="pet-walker absolute bottom-8 cursor-pointer"
            style={{ left: `${walk.x}%`, transform: "translateX(-50%)", transition: walk.dur ? `left ${walk.dur}ms linear` : "none" }}
          >
            <span className="relative block" style={{ transform: `scaleX(${walk.dir})` }}>
              <Cat stage={stage} coat={coat} act={walk.act} gear={gear} />
            </span>
            {hearts.map((h) => (
              <span
                key={h.id}
                className="pet-heart pointer-events-none absolute left-1/2 top-0 text-primary-container"
                style={{ "--pet-dx": `${h.dx}px`, animationDelay: `${h.delay}ms` }}
              >
                <MI name="favorite" fill className="text-base" />
              </span>
            ))}
          </button>
        </div>

        {/* nome, loja, saldos, crescimento e pelagem */}
        <div className="space-y-4 border-t border-outline-variant/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => (e.key === "Enter" ? saveName() : e.key === "Escape" ? setEditing(false) : null)}
                  autoFocus
                  maxLength={PET_NAME_LEN}
                  placeholder="Nome do gato"
                  aria-label="Nome do mascote"
                  className={`${inputCls} font-headline-md text-headline-md max-w-[220px]`}
                />
                <button
                  onClick={saveName}
                  aria-label="Salvar nome"
                  className="grid h-9 w-9 place-items-center rounded-lg bg-primary-container text-on-primary-container transition active:scale-95"
                >
                  <MI name="check" />
                </button>
                <button
                  onClick={() => setEditing(false)}
                  aria-label="Cancelar"
                  className="grid h-9 w-9 place-items-center rounded-lg bg-surface-variant text-on-surface-variant transition active:scale-95"
                >
                  <MI name="close" />
                </button>
              </>
            ) : (
              <>
                <h4 className={`font-headline-md text-headline-md uppercase ${name ? "text-on-surface" : "text-outline"}`}>{label}</h4>
                <button
                  onClick={() => {
                    setDraft(name);
                    setEditing(true);
                  }}
                  aria-label="Dar um nome ao mascote"
                  className="p-1 text-outline transition hover:text-primary-container"
                >
                  <MI name="edit" className="text-lg" />
                </button>
                <button
                  onClick={() => setShop(true)}
                  className="ml-auto flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1.5 font-label-caps text-[10px] text-on-primary-container transition active:scale-95"
                >
                  <MI name="storefront" className="text-base" /> LOJINHA
                </button>
              </>
            )}
          </div>

          {/* XP tem UM papel só agora: fazer o gato crescer. Não há saldo pra
              mostrar porque não há nada pra gastar com ele. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="flex items-baseline gap-1.5">
              <span className="text-[13px] text-primary tabular-nums">{fmtK(g.xp)}</span>
              <Caps className="text-outline text-[10px]">XP · NÍVEL {g.level}</Caps>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-[13px] text-on-surface-variant tabular-nums">
                {PET_ITEMS.filter((i) => petOwns(state, i.id)).length}/{PET_ITEMS.length}
              </span>
              <Caps className="text-outline text-[10px]">ITENS · {wornCount} VESTIDO(S)</Caps>
            </span>
          </div>

          {/* crescimento sai do XP TOTAL: gastar na loja não mexe nesta barra */}
          <div>
            <div className="mb-1 flex justify-between font-label-caps text-[10px] text-outline">
              <span>{stage.name}</span>
              <span>{growth.next ? `FALTAM ${fmtK(growth.missing)} XP PRA ${growth.next.name}` : "TAMANHO MÁXIMO"}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-variant">
              <div className="h-full rounded-full bg-primary-container transition-all" style={{ width: `${growth.pct}%` }} />
            </div>
          </div>

          <div>
            <Caps className="text-outline text-[10px] mb-1.5 block">PELAGEM</Caps>
            <div className="flex flex-wrap gap-1.5">
              {PET_COATS.map((k) => {
                const on = k.id === coat.id;
                return (
                  <button
                    key={k.id}
                    onClick={() => patchPet({ coat: k.id })}
                    aria-pressed={on}
                    title={k.label}
                    className={`flex items-center gap-1.5 rounded-full border px-2 py-1 font-label-caps text-[9px] transition ${
                      on ? "border-primary-container bg-primary-container/10 text-primary-container" : "border-outline-variant text-outline hover:border-outline"
                    }`}
                  >
                    <span className="h-3.5 w-3.5 rounded-full border border-black/20" style={{ background: k.fur }} />
                    {k.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {shop && (
        <Shop
          pet={pet}
          coat={coat}
          entitlements={entitlements}
          buying={buying}
          onBuy={buyItem}
          onToggle={(id) => setState((prev) => togglePetGear(prev, id))}
          onClose={() => setShop(false)}
        />
      )}
    </section>
  );
}
