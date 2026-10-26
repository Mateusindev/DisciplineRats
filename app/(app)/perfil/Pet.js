"use client";

// ============================================================================
// MASCOTE — o cercado do perfil: um bicho que cresce com o XP e se veste na lojinha.
//
// O DESENHO não mora aqui — está em `components/PetArt.js`, porque a tela de sono
// também põe o bicho na cama. Aqui fica só o que é do cercado: a vagabundagem, o
// carinho, o nome, a espécie, a pelagem e a compra.
//
// Quem pede menos movimento (prefers-reduced-motion) recebe um bicho parado: as
// keyframes morrem no CSS e a vagabundagem nem começa aqui.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../AppContext";
import { startItemCheckout } from "@/lib/persistence";
import { MI } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  PET_SPECIES,
  petSpecies,
  petCoatLabel,
  setPetSpecies,
  petOwns,
  petPriceLabel,
} from "@/lib/state";
import { Toy, Scene, Bicho, GearPreview, SpeciesPreview } from "@/components/PetArt";

// A espécie ganha uma aba própria em vez de virar um slot: slot é "onde a peça fica
// no corpo", e o bicho não fica em lugar nenhum — ele É o corpo. Ver PET_SPECIES.
const SHOP_TABS = [{ id: "species", label: "Espécie", icon: "pets" }, ...PET_SLOTS];

// Os rótulos do catálogo (lib/state) vêm em caixa alta da época do mono. A tela é em
// caixa normal, então converte só na hora de pintar — o dado não muda.
const cap = (t) => (t ? t.charAt(0) + t.slice(1).toLowerCase() : t);

// Cartão de uma opção da loja. Selecionado (vestido / espécie atual) = contorno de
// tinta; o amarelo fica só nas barras de dado.
function ShopCard({ selected, free, preview, title, desc, children }) {
  return (
    <div
      className={`flex flex-col rounded-lg border p-3 transition-colors ${
        selected ? "border-primary bg-surface-variant/40" : "border-outline-variant"
      }`}
    >
      <div className="relative">
        {preview}
        {free && (
          <Badge variant="secondary" className="absolute right-0 top-0">
            Grátis
          </Badge>
        )}
      </div>
      <div className="mt-2 min-w-0 flex-1">
        <div className="text-sm font-medium leading-tight text-on-surface">{title}</div>
        <div className="mt-0.5 text-xs leading-snug text-outline">{desc}</div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function BuyButton({ id, buying, onBuy }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onBuy(id)}
      disabled={buying === id}
      title={`Comprar por ${petPriceLabel()}`}
      className="w-full"
    >
      {buying === id ? (
        "Abrindo…"
      ) : (
        <>
          Comprar <span className="tabular-nums text-outline">{petPriceLabel()}</span>
        </>
      )}
    </Button>
  );
}

function Shop({ pet, coat, entitlements, buying, onBuy, onToggle, onSpecies, onClose }) {
  const [slot, setSlot] = useState(SHOP_TABS[0].id);

  const items = PET_ITEMS.filter((i) => i.slot === slot);
  // grátis é de todos; pago é de quem tem o entitlement. Nenhum dos dois consulta
  // dado que o navegador possa editar. Vale igual pra acessório e pra espécie.
  const ownsItem = (it) => it.source === "free" || entitlements.includes(it.id);
  const catalogo = [...PET_SPECIES, ...PET_ITEMS];
  const total = catalogo.length;
  const have = catalogo.filter(ownsItem).length;
  const especie = pet.species || PET_SPECIES[0].id;

  // Dialog do Radix cuida de Esc, clique fora e foco preso; fechar chama o mesmo onClose.
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-label="Lojinha do mascote"
        className="flex max-h-[min(88vh,760px)] flex-col gap-0 overflow-hidden bg-surface-container p-0 sm:max-w-3xl"
      >
        <div className="flex items-start gap-3 border-b border-outline-variant p-4 sm:p-5">
          <DialogHeader className="min-w-0 flex-1 gap-1.5 text-left">
            <DialogTitle className="text-base">Lojinha</DialogTitle>
            {/* O que a pessoa merece saber ANTES de pagar, e o que a lei manda dizer:
                é cosmético, é compra única e não mexe em progresso nenhum. */}
            <DialogDescription className="text-xs leading-relaxed">
              O rato e um item de cada categoria são grátis. O resto — inclusive a outra espécie — custa{" "}
              <strong className="font-medium text-on-surface">{petPriceLabel()}</strong> cada, compra única, sem assinatura. É tudo{" "}
              <strong className="font-medium text-on-surface">cosmético</strong>: não dá XP, não sobe nível e não mexe no ranking — XP serve só pra o bicho crescer.
            </DialogDescription>
          </DialogHeader>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar" className="-mr-1 -mt-1 text-outline">
            <MI name="close" className="text-[18px]" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-outline-variant px-4 py-2.5 text-xs text-outline sm:px-5">
          <span>
            <span className="tabular-nums text-on-surface-variant">
              {have}/{total}
            </span>{" "}
            do catálogo é seu
          </span>
          <span className="ml-auto">Pix · cartão · boleto</span>
        </div>

        <Tabs value={slot} onValueChange={setSlot} className="min-h-0 flex-1 gap-0">
          <div className="overflow-x-auto ff-scroll border-b border-outline-variant px-4 py-2.5 sm:px-5">
            <TabsList className="w-max">
              {SHOP_TABS.map((sl) => {
                const all = sl.id === "species" ? PET_SPECIES : PET_ITEMS.filter((i) => i.slot === sl.id);
                return (
                  <TabsTrigger key={sl.id} value={sl.id} className="flex-none px-2.5 text-xs">
                    {cap(sl.label)}
                    <span className="tabular-nums text-outline">
                      {all.filter(ownsItem).length}/{all.length}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto ff-scroll">
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-5">
              {slot === "species" &&
                PET_SPECIES.map((sp) => {
                  const owned = ownsItem(sp);
                  const atual = sp.id === especie;
                  return (
                    <ShopCard
                      key={sp.id}
                      selected={atual}
                      free={sp.source === "free"}
                      preview={<SpeciesPreview species={sp.id} coat={coat} />}
                      title={cap(sp.label)}
                      desc={sp.desc}
                    >
                      {owned ? (
                        <Button
                          size="sm"
                          variant={atual ? "default" : "outline"}
                          onClick={() => onSpecies(sp.id)}
                          disabled={atual}
                          className="w-full disabled:opacity-100"
                        >
                          {atual ? "É esse aí" : "Virar este"}
                        </Button>
                      ) : (
                        <BuyButton id={sp.id} buying={buying} onBuy={onBuy} />
                      )}
                    </ShopCard>
                  );
                })}
              {items.map((item) => {
                const free = item.source === "free";
                const owned = ownsItem(item);
                const worn = pet.gear?.[item.slot] === item.id;
                return (
                  <ShopCard
                    key={item.id}
                    selected={worn}
                    free={free}
                    preview={<GearPreview item={item} coat={coat} species={especie} />}
                    title={item.name}
                    desc={item.desc}
                  >
                    {owned ? (
                      <Button size="sm" variant={worn ? "default" : "outline"} onClick={() => onToggle(item.id)} className="w-full">
                        {worn ? "Vestido · tirar" : "Vestir"}
                      </Button>
                    ) : (
                      <BuyButton id={item.id} buying={buying} onBuy={onBuy} />
                    )}
                  </ShopCard>
                );
              })}
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
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
  const bicho = petSpecies(pet.species);
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

  const label = name || "Sem nome";
  const stageIdx = PET_STAGES.indexOf(stage);
  const wornCount = PET_SLOTS.filter((sl) => gear[sl.id]).length;

  // chip de escolha (espécie, pelagem): selecionado = contorno e texto de tinta
  const chip = (on) =>
    `inline-flex h-10 items-center sm:h-8 gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors active:scale-[.98] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
      on ? "border-primary bg-surface-variant text-on-surface" : "border-outline-variant text-on-surface-variant hover:bg-surface-variant/60"
    }`;

  return (
    <section id="mascote" className="scroll-mt-16">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-on-surface">Mascote</h2>
        <span className="text-xs text-outline tabular-nums">
          {cap(stage.name)} · {stageIdx + 1} de {PET_STAGES.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container">
        {/* cercado */}
        <div className="relative h-[190px] overflow-hidden bg-surface-container-high/50">
          <Scene id={gear.scene} />
          <div className="absolute inset-x-0 bottom-0 h-10 border-t border-outline-variant bg-surface-variant/50" />

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
              <Bicho stage={stage} coat={coat} act={walk.act} gear={gear} species={pet.species} />
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
        <div className="space-y-5 border-t border-outline-variant p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <>
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => (e.key === "Enter" ? saveName() : e.key === "Escape" ? setEditing(false) : null)}
                  autoFocus
                  maxLength={PET_NAME_LEN}
                  placeholder={`Nome do ${bicho.label.toLowerCase()}`}
                  aria-label="Nome do mascote"
                  className="max-w-[220px]"
                />
                <Button size="icon" onClick={saveName} aria-label="Salvar nome">
                  <MI name="check" className="text-[18px]" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditing(false)} aria-label="Cancelar">
                  <MI name="close" className="text-[18px]" />
                </Button>
              </>
            ) : (
              <>
                <h3 className={`text-lg font-semibold tracking-tight ${name ? "text-on-surface" : "text-outline"}`}>{label}</h3>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => {
                    setDraft(name);
                    setEditing(true);
                  }}
                  aria-label="Dar um nome ao mascote"
                  className="text-outline"
                >
                  <MI name="edit" className="text-[16px]" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShop(true)} className="ml-auto">
                  <MI name="storefront" className="text-[16px]" /> Lojinha
                </Button>
              </>
            )}
          </div>

          {/* XP tem UM papel só agora: fazer o gato crescer. Não há saldo pra
              mostrar porque não há nada pra gastar com ele. Crescimento sai do XP
              TOTAL: gastar na loja não mexe nesta barra. */}
          <div>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
              <span className="text-outline">
                <span className="font-medium text-on-surface">{cap(stage.name)}</span>
                {" · "}
                <span className="tabular-nums">{fmtK(g.xp)}</span> XP · nível <span className="tabular-nums">{g.level}</span>
              </span>
              <span className="text-outline tabular-nums">
                {growth.next ? `Faltam ${fmtK(growth.missing)} XP pra ${cap(growth.next.name).toLowerCase()}` : "Tamanho máximo"}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-variant">
              <div className="h-full rounded-full bg-primary-container transition-all" style={{ width: `${growth.pct}%` }} />
            </div>
            <div className="mt-2 text-xs text-outline">
              <span className="tabular-nums">
                {PET_ITEMS.filter((i) => petOwns(state, i.id)).length}/{PET_ITEMS.length}
              </span>{" "}
              itens · <span className="tabular-nums">{wornCount}</span> vestido(s)
            </div>
          </div>

          {/* Espécie e pelagem lado a lado: são a mesma pergunta ("que bicho é esse?"),
              e separá-las em telas diferentes só faria procurar. O que não é seu
              manda pra loja em vez de ficar inerte — cadeado sem porta é frustração. */}
          <div className="grid gap-5 md:grid-cols-[auto_1fr] md:gap-10">
            <div>
              <div className="mb-2 text-xs text-outline">Espécie</div>
              <div className="flex flex-wrap gap-1.5">
                {PET_SPECIES.map((sp) => {
                  const on = sp.id === bicho.id;
                  const owned = petOwns(state, sp.id);
                  return (
                    <button
                      key={sp.id}
                      onClick={() => (owned ? setState((prev) => setPetSpecies(prev, sp.id)) : setShop(true))}
                      aria-pressed={on}
                      title={owned ? sp.desc : `${cap(sp.label)} — ${petPriceLabel()} na lojinha`}
                      className={chip(on)}
                    >
                      {!owned && <MI name="lock" className="text-[14px] text-outline" />}
                      {cap(sp.label)}
                      {!owned && <span className="tabular-nums text-outline">{petPriceLabel()}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs text-outline">Pelagem</div>
              <div className="flex flex-wrap gap-1.5">
                {PET_COATS.map((k) => {
                  const on = k.id === coat.id;
                  return (
                    <button
                      key={k.id}
                      onClick={() => patchPet({ coat: k.id })}
                      aria-pressed={on}
                      title={cap(petCoatLabel(k, bicho.id))}
                      className={chip(on)}
                    >
                      <span className="size-3.5 rounded-full border border-black/15" style={{ background: k.fur }} />
                      {cap(petCoatLabel(k, bicho.id))}
                    </button>
                  );
                })}
              </div>
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
          onSpecies={(id) => setState((prev) => setPetSpecies(prev, id))}
          onClose={() => setShop(false)}
        />
      )}
    </section>
  );
}
