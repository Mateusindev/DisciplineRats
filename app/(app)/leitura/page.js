"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import { MI, StarRating, PageHeader, inputCls, textareaCls } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { getDateStr, shiftDate, bookPct, readingPace } from "@/lib/state";

const STATUS = {
  want: { label: "Quero ler", icon: "bookmark", move: "Mover para quero ler" },
  reading: { label: "Lendo", icon: "auto_stories", move: "Começar a ler" },
  done: { label: "Lido", icon: "task_alt", move: "Marcar como lido" },
};
const SPINE = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];
const BOOK_CATS = ["Ficção", "Não-ficção", "Autoajuda", "Negócios", "Tecnologia", "Biografia", "História", "Fantasia", "Romance", "Outros"];
const uid = () => crypto.randomUUID();
const initials = (t) => (t || "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const spineColor = (t) => SPINE[[...(t || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % SPINE.length];
// "2026-11-09" → "09/11"
const dm = (d) => (d ? d.split("-").reverse().slice(0, 2).join("/") : "");

async function searchBooks(q) {
  try {
    const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,cover_i,number_of_pages_median`);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.docs || []).map((d) => ({
      title: d.title,
      author: (d.author_name || [])[0] || "",
      total: d.number_of_pages_median || 0,
      cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : "",
    }));
  } catch { return []; }
}

// Capa da Open Library ou, sem ela, as iniciais sobre a cor da lombada (a única cor
// fora dos tokens: é a "capa" do livro, não decoração da interface).
function Cover({ book, className = "" }) {
  if (book.cover) return <img src={book.cover} alt="" className={`${className} object-cover w-full h-full`} />;
  return (
    <div className={`${className} w-full h-full grid place-items-center text-white`} style={{ background: spineColor(book.title) }}>
      <span className="text-xs font-semibold">{initials(book.title)}</span>
    </div>
  );
}

// Ações da linha: abrir, mudar de estante, remover. Mesmos handlers do modal.
function RowMenu({ b, onOpen, onStatus, onDelete }) {
  const cur = b.status || "want";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${b.title}`} className="shrink-0 text-on-surface-variant">
          <MI name="more_horiz" className="text-[20px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={onOpen}>
          <MI name="edit" className="text-[18px] text-on-surface-variant" /> Detalhes
        </DropdownMenuItem>
        {Object.entries(STATUS)
          .filter(([k]) => k !== cur)
          .map(([k, s]) => (
            <DropdownMenuItem key={k} onSelect={() => onStatus(k)}>
              <MI name={s.icon} className="text-[18px] text-on-surface-variant" /> {s.move}
            </DropdownMenuItem>
          ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <MI name="delete" className="text-[18px]" /> Remover
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Linha do que está sendo lido: progresso, ritmo e o registro de página ali mesmo.
// O campo grava a página atual (o mesmo patch do campo de páginas do modal).
function ReadingRow({ b, onOpen, onPatch, onStatus, onDelete }) {
  const [draft, setDraft] = useState("");
  const pct = bookPct(b);
  const pace = readingPace(b);
  function log(e) {
    e.preventDefault();
    if (draft === "") return;
    onPatch({ page: Math.max(0, parseInt(draft) || 0) });
    setDraft("");
  }

  let paceLine = null;
  if (pace?.reason === "no-total") paceLine = <span className="text-outline">Sem total de páginas</span>;
  else if (pace?.reason === "no-target") paceLine = <span className="text-outline">Faltam {pace.pagesLeft} págs · sem meta</span>;
  else if (pace?.state === "late") paceLine = <span className="text-error">{pace.pagesLeft} págs atrasadas</span>;
  else if (pace?.perDay > 0)
    paceLine = (
      <span className="text-on-surface-variant">
        {pace.perDay} pág/dia até {dm(b.targetDate)}
      </span>
    );

  return (
    <li className="flex gap-4 py-4 first:pt-0 last:pb-0">
      <button onClick={onOpen} aria-label={`Abrir ${b.title}`} className="w-12 h-[72px] rounded-md overflow-hidden border border-outline-variant shrink-0 bg-surface-container-high active:scale-[.98] transition">
        <Cover book={b} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <button onClick={onOpen} className="min-w-0 text-left">
            <div className="text-base font-semibold text-on-surface leading-snug line-clamp-2 hover:underline underline-offset-4">{b.title}</div>
            {(b.author || b.category) && (
              <div className="mt-0.5 text-sm text-on-surface-variant truncate">
                {b.author}
                {b.author && b.category && " · "}
                {b.category}
              </div>
            )}
          </button>
          <RowMenu b={b} onOpen={onOpen} onStatus={onStatus} onDelete={onDelete} />
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-6">
          <div className="flex-1 min-w-0">
            <div className="h-1.5 rounded-full bg-surface-variant overflow-hidden">
              <div className="h-full rounded-full bg-primary-container transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs tabular-nums">
              <span className="text-on-surface">
                p. {b.page || 0}
                {b.total > 0 && ` de ${b.total} · ${pct}%`}
              </span>
              {paceLine}
            </div>
          </div>
          <form onSubmit={log} className="flex items-center gap-2 shrink-0">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Pág. atual"
              aria-label={`Página atual de ${b.title}`}
              className="h-9 w-28 tabular-nums"
            />
            <Button type="submit" variant="outline" size="sm" className="h-9" disabled={draft === ""}>
              Atualizar página
            </Button>
          </form>
        </div>
      </div>
    </li>
  );
}

// Linha das listas quietas (fila e lidos): capa pequena, título, e um dado à direita.
function ShelfRow({ b, onOpen, onStatus, onDelete }) {
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <button onClick={onOpen} className="flex flex-1 min-w-0 items-center gap-3 text-left group">
        <div className="w-8 h-12 rounded overflow-hidden border border-outline-variant shrink-0 bg-surface-container-high">
          <Cover book={b} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-on-surface truncate group-hover:underline underline-offset-4">{b.title}</div>
          {b.author && <div className="text-xs text-on-surface-variant truncate">{b.author}</div>}
        </div>
        {b.category && (
          <Badge variant="outline" className="hidden sm:inline-flex text-on-surface-variant font-normal">
            {b.category}
          </Badge>
        )}
        {b.status === "done" ? (
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            {b.rating > 0 && (
              <div className="flex" aria-label={`Nota ${b.rating} de 5`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <MI key={i} name="star" fill={i < b.rating} className={`text-[14px] ${i < b.rating ? "text-primary-container" : "text-outline-variant"}`} />
                ))}
              </div>
            )}
            {b.finishedAt && <span className="text-xs text-outline tabular-nums">Lido em {dm(b.finishedAt)}</span>}
          </div>
        ) : (
          b.total > 0 && <span className="text-xs text-outline tabular-nums shrink-0">{b.total} págs</span>
        )}
      </button>
      <RowMenu b={b} onOpen={onOpen} onStatus={onStatus} onDelete={onDelete} />
    </li>
  );
}

// Quantas páginas por dia pra fechar o livro na meta de término.
// Só aparece quando dá pra calcular — sem total de páginas ou sem meta, ele pede o que falta
// em vez de exibir número inventado.
function PacePanel({ book, onPatch }) {
  const pace = readingPace(book);
  if (!pace || pace.state === "done") return null;

  const presets = [
    { label: "2 semanas", days: 13 },
    { label: "1 mês", days: 29 },
    { label: "2 meses", days: 59 },
  ];
  const askTarget = pace.reason === "no-target";

  if (pace.reason === "no-total") {
    return (
      <div className="rounded-lg border border-outline-variant p-4">
        <div className="text-sm font-medium text-on-surface">Ritmo necessário</div>
        <p className="mt-1 text-sm text-on-surface-variant">Informe o total de páginas do livro pra eu calcular quantas por dia.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 ${pace.state === "late" ? "border-error/40" : "border-outline-variant"}`}>
      <div className="text-sm font-medium text-on-surface mb-2">Ritmo necessário</div>

      {askTarget ? (
        <>
          <p className="text-sm text-on-surface-variant mb-3">
            Faltam <strong className="font-semibold text-on-surface tabular-nums">{pace.pagesLeft} páginas</strong>. Defina a meta de término pra eu dizer quantas por dia.
          </p>
          <div className="flex gap-2 flex-wrap">
            {presets.map((p) => (
              <Button
                key={p.days}
                variant="outline"
                size="sm"
                className="tabular-nums"
                onClick={() => onPatch({ targetDate: shiftDate(getDateStr(0), p.days), startedAt: book.startedAt || getDateStr(0) })}
              >
                {p.label} · {Math.ceil(pace.pagesLeft / (p.days + 1))}/dia
              </Button>
            ))}
          </div>
        </>
      ) : pace.state === "late" ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight text-error tabular-nums leading-none">{pace.pagesLeft}</span>
            <span className="text-sm text-on-surface-variant">páginas restantes</span>
          </div>
          <p className="text-sm text-on-surface-variant mt-2">
            A meta era {pace.daysLate === 1 ? "ontem" : `${pace.daysLate} dias atrás`}. Empurre a data ou aceite que este livro vai levar mais tempo — as duas
            são respostas honestas.
          </p>
          <div className="flex gap-2 flex-wrap mt-3">
            {presets.map((p) => (
              <Button key={p.days} variant="outline" size="sm" className="tabular-nums" onClick={() => onPatch({ targetDate: shiftDate(getDateStr(0), p.days) })}>
                +{p.label} · {Math.ceil(pace.pagesLeft / (p.days + 1))}/dia
              </Button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-semibold tracking-tight text-on-surface tabular-nums leading-none">{pace.perDay}</span>
            <span className="text-sm text-on-surface">página(s) por dia</span>
          </div>
          <p className="text-sm text-on-surface-variant mt-2">
            {pace.pagesLeft} restantes em {pace.daysLeft} dia(s)
            {pace.state === "due-today" && <strong className="font-semibold text-on-surface"> — a meta é hoje</strong>}.
          </p>
          {Math.abs(pace.ahead) >= 5 && (
            <p className={`text-sm mt-1.5 flex flex-wrap items-center gap-x-1 ${pace.ahead > 0 ? "text-on-surface" : "text-error"}`}>
              <MI name={pace.ahead > 0 ? "trending_up" : "trending_down"} className="text-[16px]" />
              {pace.ahead > 0 ? `${pace.ahead} páginas adiantado` : `${-pace.ahead} páginas atrás do ritmo`}
              <span className="text-outline">(esperado hoje: p. {pace.expectedPage})</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function LeituraPage() {
  const { state, setState, confirm, setSetting, confirmState } = useApp();
  const books = state.books || [];
  const customCats = state.settings.bookCats || [];
  const allCats = [...new Set([...BOOK_CATS, ...customCats])];
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [catFilter, setCatFilter] = useState("all");
  const [shelf, setShelf] = useState(null); // aba da estante; null = escolhe sozinha
  const usedCats = [...new Set(books.map((b) => b.category).filter(Boolean))];

  const setBooks = (fn) => setState((prev) => ({ ...prev, books: fn(prev.books || []) }));
  const updateBook = (id, patch) => setBooks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  function addBook(b) {
    setBooks((bs) => [{ id: uid(), title: b.title || "Sem título", author: b.author || "", total: b.total || 0, page: 0, status: "want", rating: 0, review: "", cover: b.cover || "", startedAt: "", targetDate: "", finishedAt: "" }, ...bs]);
  }
  async function removeBook(id, title) {
    const ok = await confirm({ title: "Remover livro?", body: title, confirmLabel: "Remover" });
    if (ok) { setBooks((bs) => bs.filter((b) => b.id !== id)); setEditId(null); }
  }
  function setStatus(id, status) {
    const today = getDateStr(0);
    setBooks((bs) => bs.map((b) => {
      if (b.id !== id) return b;
      const patch = { status };
      if (status === "reading" && !b.startedAt) patch.startedAt = today;
      if (status === "done") { patch.finishedAt = b.finishedAt || today; if (b.total) patch.page = b.total; }
      return { ...b, ...patch };
    }));
  }

  const year = String(new Date().getFullYear());
  const readingN = books.filter((b) => b.status === "reading").length;
  const doneYear = books.filter((b) => b.status === "done" && (b.finishedAt || "").startsWith(year)).length;
  const pagesRead = books.filter((b) => b.status === "done").reduce((s, b) => s + (b.total || 0), 0);

  const editBook = books.find((b) => b.id === editId);

  const inCat = (b) => catFilter === "all" || b.category === catFilter;
  const byStatus = (st) => books.filter((b) => (b.status || "want") === st && inCat(b));
  const readingList = byStatus("reading");
  const wantList = byStatus("want");
  const doneList = byStatus("done");
  const shelfTab = shelf ?? (wantList.length || !doneList.length ? "want" : "done");
  const rowProps = (b) => ({
    b,
    onOpen: () => setEditId(b.id),
    onStatus: (s) => setStatus(b.id, s),
    onDelete: () => removeBook(b.id, b.title),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leitura"
        subtitle={
          <span className="tabular-nums">
            Lendo {readingN} · Lidos em {year}: {doneYear} · {pagesRead} páginas lidas
          </span>
        }
        actions={
          <Button onClick={() => setAdding(true)}>
            <MI name="add" className="text-[18px]" /> Adicionar livro
          </Button>
        }
      />

      {usedCats.length > 0 && (
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filtrar por categoria">
          {["all", ...usedCats].map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              aria-pressed={catFilter === c}
              className={`h-8 px-3 rounded-md border text-sm transition ${catFilter === c ? "border-input bg-surface-variant text-on-surface" : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/60"}`}
            >
              {c === "all" ? "Todas" : c}
            </button>
          ))}
        </div>
      )}

      {books.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container p-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-on-surface-variant">Sua estante está vazia. Adicione o livro que você está lendo agora.</p>
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <MI name="add" className="text-[18px]" /> Adicionar livro
          </Button>
        </div>
      ) : (
        <>
          {/* o bloco principal: o que estou lendo e quanto falta */}
          <section className="rounded-xl border border-outline-variant bg-surface-container p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-base font-semibold text-on-surface">Lendo agora</h2>
              <span className="text-xs text-outline tabular-nums">{readingList.length}</span>
            </div>
            {readingList.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Nenhum livro em andamento. Abra um da fila e escolha “Começar a ler”.</p>
            ) : (
              <ul className="divide-y divide-outline-variant">
                {readingList.map((b) => (
                  <ReadingRow key={b.id} {...rowProps(b)} onPatch={(patch) => updateBook(b.id, patch)} />
                ))}
              </ul>
            )}
          </section>

          {/* fila e lidos: listas quietas, uma de cada vez */}
          <Tabs value={shelfTab} onValueChange={setShelf} className="gap-4">
            <TabsList>
              <TabsTrigger value="want" className="px-3">
                Quero ler <span className="text-outline tabular-nums">{wantList.length}</span>
              </TabsTrigger>
              <TabsTrigger value="done" className="px-3">
                Lidos <span className="text-outline tabular-nums">{doneList.length}</span>
              </TabsTrigger>
            </TabsList>
            {[["want", wantList, "Nada na fila. Livros novos entram aqui."], ["done", doneList, "Nenhum livro terminado ainda."]].map(([v, list, empty]) => (
              <TabsContent key={v} value={v}>
                <div className="rounded-xl border border-outline-variant bg-surface-container p-5">
                  {list.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">{empty}</p>
                  ) : (
                    <ul className="divide-y divide-outline-variant">
                      {list.map((b) => (
                        <ShelfRow key={b.id} {...rowProps(b)} />
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}

      <Dialog open={adding} onOpenChange={(o) => !o && setAdding(false)}>
        {adding && <AddModal onAdd={(b) => { addBook(b); setAdding(false); }} />}
      </Dialog>
      {/* some enquanto o confirm de remoção está aberto: o Dialog modal bloquearia os cliques nele */}
      <Dialog open={!!editBook && !confirmState} onOpenChange={(o) => !o && setEditId(null)}>
        {editBook && (
          <BookModal
            book={editBook}
            cats={allCats}
            onAddCat={(name) => { if (name && !allCats.includes(name)) setSetting("bookCats", [...customCats, name]); }}
            onPatch={(patch) => updateBook(editBook.id, patch)}
            onStatus={(s) => setStatus(editBook.id, s)}
            onDelete={() => removeBook(editBook.id, editBook.title)}
          />
        )}
      </Dialog>
    </div>
  );
}

// Conteúdo do Dialog de adicionar. Esc/fora/✕ fecham pelo próprio Dialog (onOpenChange).
function AddModal({ onAdd }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState({ title: "", author: "", total: "" });
  async function run() {
    if (!q.trim()) return;
    setLoading(true);
    setResults(await searchBooks(q.trim()));
    setLoading(false);
  }
  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto ff-scroll sm:max-w-lg bg-popover border-outline-variant">
      <DialogHeader>
        <DialogTitle className="text-base">Adicionar livro</DialogTitle>
        <DialogDescription>Busque na Open Library ou preencha à mão.</DialogDescription>
      </DialogHeader>

      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="Buscar por título…" className="flex-1" autoFocus aria-label="Buscar livro" />
        <Button variant="outline" onClick={run}>Buscar</Button>
      </div>

      {loading && <p className="text-sm text-outline text-center py-2">Buscando…</p>}
      {results && results.length === 0 && !loading && <p className="text-sm text-outline">Nada encontrado. Adicione manualmente abaixo.</p>}
      {results && results.length > 0 && (
        <ul className="-mx-2">
          {results.map((b, i) => (
            <li key={i}>
              <button onClick={() => onAdd(b)} className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-surface-variant transition text-left">
                <div className="w-9 h-[54px] rounded overflow-hidden shrink-0 border border-outline-variant bg-surface-container-high"><Cover book={b} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-on-surface truncate">{b.title}</div>
                  <div className="text-xs text-on-surface-variant truncate">{b.author}{b.total ? ` · ${b.total} p.` : ""}</div>
                </div>
                <MI name="add" className="text-[18px] text-on-surface-variant shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-outline-variant pt-4 space-y-3">
        <div className="text-sm font-medium text-on-surface">Adicionar manualmente</div>
        <div className="space-y-1.5">
          <Label htmlFor="bk-title" className="text-xs font-normal text-on-surface-variant">Título</Label>
          <Input id="bk-title" value={manual.title} onChange={(e) => setManual((m) => ({ ...m, title: e.target.value }))} />
        </div>
        <div className="flex gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="bk-author" className="text-xs font-normal text-on-surface-variant">Autor</Label>
            <Input id="bk-author" value={manual.author} onChange={(e) => setManual((m) => ({ ...m, author: e.target.value }))} />
          </div>
          <div className="w-24 space-y-1.5">
            <Label htmlFor="bk-total" className="text-xs font-normal text-on-surface-variant">Páginas</Label>
            <Input id="bk-total" value={manual.total} onChange={(e) => setManual((m) => ({ ...m, total: e.target.value }))} inputMode="numeric" className="tabular-nums" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => manual.title.trim() && onAdd({ title: manual.title.trim(), author: manual.author.trim(), total: parseInt(manual.total) || 0, cover: "" })}>
            Adicionar
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

// Conteúdo do Dialog de detalhes. Tudo grava ao digitar (onPatch), como antes.
function BookModal({ book, cats = [], onAddCat, onPatch, onStatus, onDelete }) {
  const [newCat, setNewCat] = useState("");
  const pct = bookPct(book);
  const options = [...new Set([...cats, ...(book.category ? [book.category] : [])])];
  function addCat() {
    const c = newCat.trim();
    if (!c) return;
    onAddCat?.(c);
    onPatch({ category: c });
    setNewCat("");
  }
  const cur = book.status || "want";
  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto ff-scroll sm:max-w-lg bg-popover border-outline-variant gap-5">
      <DialogTitle className="sr-only">Detalhes do livro</DialogTitle>
      <DialogDescription className="sr-only">Edite título, progresso, nota, categoria, resenha e datas.</DialogDescription>

      <div className="flex gap-4 pr-6">
        <div className="w-16 h-24 rounded-md overflow-hidden shrink-0 border border-outline-variant bg-surface-container-high"><Cover book={book} /></div>
        <div className="flex-1 min-w-0 space-y-1">
          <input value={book.title} onChange={(e) => onPatch({ title: e.target.value })} aria-label="Título" className="w-full bg-transparent text-lg font-semibold tracking-tight text-on-surface outline-none rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/50" />
          <input value={book.author} onChange={(e) => onPatch({ author: e.target.value })} placeholder="Autor" aria-label="Autor" className="w-full bg-transparent text-sm text-on-surface-variant placeholder:text-outline outline-none rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/50" />
        </div>
      </div>

      {/* status: controle segmentado neutro (é navegação de estado, não dado) */}
      <div className="grid grid-cols-3 rounded-lg bg-muted p-[3px]" role="group" aria-label="Status">
        {Object.entries(STATUS).map(([k, s]) => (
          <button
            key={k}
            onClick={() => onStatus(k)}
            aria-pressed={cur === k}
            className={`h-8 flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition ${cur === k ? "bg-background text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
          >
            <MI name={s.icon} className="text-[16px]" /> {s.label}
          </button>
        ))}
      </div>

      {/* progresso */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input type="number" min="0" value={book.page || ""} onChange={(e) => onPatch({ page: Math.max(0, parseInt(e.target.value) || 0) })} placeholder="0" aria-label="Página atual" className={`${inputCls} h-9 w-20 text-center tabular-nums`} />
          <span className="text-outline text-sm">de</span>
          <input type="number" min="0" value={book.total || ""} onChange={(e) => onPatch({ total: Math.max(0, parseInt(e.target.value) || 0) })} placeholder="—" aria-label="Total de páginas" className={`${inputCls} h-9 w-20 text-center tabular-nums`} />
          <span className="text-on-surface-variant text-sm">páginas</span>
          <span className="ml-auto text-sm text-on-surface tabular-nums">{pct}%</span>
        </div>
        <div className="h-1.5 bg-surface-variant rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-primary-container" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* nota */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-on-surface-variant">Nota</span>
        <StarRating value={book.rating || 0} onChange={(v) => onPatch({ rating: v })} />
      </div>

      {/* categoria */}
      <div className="space-y-2">
        <span className="text-sm text-on-surface-variant">Categoria</span>
        <div className="flex flex-wrap gap-1.5">
          {options.map((c) => (
            <button
              key={c}
              onClick={() => onPatch({ category: book.category === c ? "" : c })}
              aria-pressed={book.category === c}
              className={`h-7 px-2.5 rounded-md border text-xs transition ${book.category === c ? "border-input bg-surface-variant text-on-surface font-medium" : "border-outline-variant text-on-surface-variant hover:text-on-surface"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 max-w-xs">
          <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCat()} placeholder="Nova categoria" className="h-8" aria-label="Nova categoria" />
          <Button variant="outline" size="icon-sm" onClick={addCat} aria-label="Adicionar categoria"><MI name="add" className="text-[18px]" /></Button>
        </div>
      </div>

      {/* resenha */}
      <div className="space-y-1.5">
        <Label htmlFor="bk-review" className="text-sm font-normal text-on-surface-variant">Resenha e notas</Label>
        <textarea id="bk-review" value={book.review || ""} onChange={(e) => onPatch({ review: e.target.value })} rows={4} placeholder="O que achou? Trechos, aprendizados…" className={textareaCls} />
      </div>

      {/* datas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[["startedAt", "Início"], ["targetDate", "Meta de término"], ["finishedAt", "Fim (real)"]].map(([k, lbl]) => (
          <div key={k} className="space-y-1.5 min-w-0">
            <Label htmlFor={`bk-${k}`} className="text-xs font-normal text-on-surface-variant">{lbl}</Label>
            <input id={`bk-${k}`} type="date" value={book[k] || ""} onChange={(e) => onPatch({ [k]: e.target.value })} className={`${inputCls} h-9 w-full min-w-0 tabular-nums`} />
          </div>
        ))}
      </div>

      <PacePanel book={book} onPatch={onPatch} />

      <div className="flex justify-start border-t border-outline-variant pt-4">
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-error hover:text-error hover:bg-error/10">
          <MI name="delete" className="text-[18px]" /> Remover livro
        </Button>
      </div>
    </DialogContent>
  );
}
