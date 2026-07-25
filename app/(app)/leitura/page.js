"use client";

import { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { MI, Caps, StarRating, inputCls } from "@/components/ui";
import { getDateStr, bookPct } from "@/lib/state";

const STATUS = {
  want: { label: "Quero ler", icon: "bookmark" },
  reading: { label: "Lendo", icon: "auto_stories" },
  done: { label: "Lido", icon: "task_alt" },
};
const SPINE = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];
const BOOK_CATS = ["Ficção", "Não-ficção", "Autoajuda", "Negócios", "Tecnologia", "Biografia", "História", "Fantasia", "Romance", "Outros"];
const uid = () => crypto.randomUUID();
const stop = (e) => e.stopPropagation();
const initials = (t) => (t || "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const spineColor = (t) => SPINE[[...(t || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % SPINE.length];

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

function Cover({ book, className = "" }) {
  if (book.cover) return <img src={book.cover} alt={book.title} className={`${className} object-cover w-full h-full`} />;
  return (
    <div className={`${className} w-full h-full grid place-items-center text-white font-headline-md`} style={{ background: spineColor(book.title) }}>
      <span className="text-lg font-bold">{initials(book.title)}</span>
    </div>
  );
}

function BookCard({ b, onOpen }) {
  const pct = bookPct(b);
  return (
    <button onClick={onOpen} className="text-left group">
      <div className="aspect-[2/3] rounded-lg overflow-hidden border border-outline-variant/30 shadow-sm relative group-hover:shadow-md group-active:scale-[0.98] transition">
        <Cover book={b} />
        {b.status === "reading" && b.total > 0 && (
          <div className="absolute bottom-0 left-0 w-full h-1.5 bg-black/30">
            <div className="h-full bg-primary-container" style={{ width: `${pct}%` }} />
          </div>
        )}
        {b.status === "done" && (
          <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-primary-container text-on-primary-container grid place-items-center">
            <MI name="check" className="text-sm" />
          </div>
        )}
        {b.status === "want" && (
          <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white grid place-items-center">
            <MI name="bookmark" className="text-sm" fill />
          </div>
        )}
      </div>
      <div className="mt-1.5">
        <div className="text-[12px] font-semibold text-on-surface leading-tight line-clamp-2">{b.title}</div>
        {b.author && <div className="text-[10px] text-outline truncate">{b.author}</div>}
        {b.category && <div className="text-[9px] text-primary-container font-label-caps truncate mt-0.5">{b.category}</div>}
        {b.status === "done" && b.rating > 0 && (
          <div className="flex gap-0.5 mt-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <MI key={i} name="star" fill={i < b.rating} className={`text-[11px] ${i < b.rating ? "text-primary-container" : "text-outline-variant"}`} />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

const GROUPS = [["want", "Quero ler"], ["reading", "Lendo"], ["done", "Lido"]];

export default function LeituraPage() {
  const { state, setState, confirm, setSetting } = useApp();
  const books = state.books || [];
  const customCats = state.settings.bookCats || [];
  const allCats = [...new Set([...BOOK_CATS, ...customCats])];
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [catFilter, setCatFilter] = useState("all");
  const usedCats = [...new Set(books.map((b) => b.category).filter(Boolean))];

  const setBooks = (fn) => setState((prev) => ({ ...prev, books: fn(prev.books || []) }));
  const updateBook = (id, patch) => setBooks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  function addBook(b) {
    setBooks((bs) => [{ id: uid(), title: b.title || "Sem título", author: b.author || "", total: b.total || 0, page: 0, status: "want", rating: 0, review: "", cover: b.cover || "", startedAt: "", finishedAt: "" }, ...bs]);
  }
  async function removeBook(id, title) {
    const ok = await confirm({ title: "Remover livro?", body: title, confirmLabel: "REMOVER" });
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

  return (
    <div className="space-y-6">
      <section className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-primary uppercase">Leitura</h2>
          <p className="font-body-md text-on-surface-variant">Lendo {readingN} · Lidos em {year}: {doneYear} · {pagesRead} páginas lidas</p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary font-label-caps text-[11px] active:scale-95 transition">
          <MI name="add" className="text-lg" /> ADICIONAR
        </button>
      </section>

      {usedCats.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {["all", ...usedCats].map((c) => (
            <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1.5 rounded-full font-label-caps text-[10px] transition ${catFilter === c ? "bg-primary-container text-on-primary-container" : "bg-surface-container-high text-outline hover:text-on-surface-variant"}`}>
              {c === "all" ? "Todas" : c}
            </button>
          ))}
        </div>
      )}

      {books.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center">
          <MI name="menu_book" className="text-4xl text-outline mb-2" />
          <p className="text-[13px] text-outline">Sua estante está vazia — adicione um livro.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {GROUPS.map(([st, lbl]) => {
            const list = books.filter((b) => (b.status || "want") === st && (catFilter === "all" || b.category === catFilter));
            if (list.length === 0) return null;
            return (
              <section key={st}>
                <div className="flex items-center gap-2 mb-3">
                  <Caps className="text-primary text-[11px]">{lbl}</Caps>
                  <div className="flex-1 h-px bg-outline-variant/30" />
                  <Caps className="text-outline text-[10px]">{list.length}</Caps>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {list.map((b) => (
                    <BookCard key={b.id} b={b} onOpen={() => setEditId(b.id)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {adding && <AddModal onClose={() => setAdding(false)} onAdd={(b) => { addBook(b); setAdding(false); }} />}
      {editBook && (
        <BookModal
          book={editBook}
          cats={allCats}
          onAddCat={(name) => { if (name && !allCats.includes(name)) setSetting("bookCats", [...customCats, name]); }}
          onClose={() => setEditId(null)}
          onPatch={(patch) => updateBook(editBook.id, patch)}
          onStatus={(s) => setStatus(editBook.id, s)}
          onDelete={() => removeBook(editBook.id, editBook.title)}
        />
      )}
    </div>
  );
}

function AddModal({ onClose, onAdd }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState({ title: "", author: "", total: "" });
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  async function run() {
    if (!q.trim()) return;
    setLoading(true);
    setResults(await searchBooks(q.trim()));
    setLoading(false);
  }
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 animate-[fadeIn_.1s_ease-out]" onClick={onClose} role="dialog" aria-label="Adicionar livro">
      <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-white/10 max-h-[90vh] overflow-auto ff-scroll" onClick={stop}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline-md text-headline-md text-primary">Adicionar livro</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-outline hover:text-on-surface transition"><MI name="close" /></button>
        </div>

        <div className="flex gap-2 mb-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="Buscar por título..." className={`${inputCls} flex-1`} autoFocus />
          <button onClick={run} className="px-4 rounded-lg bg-primary-container text-on-primary-container font-label-caps text-[11px] active:scale-95 transition shrink-0">BUSCAR</button>
        </div>

        {loading && <p className="text-[12px] text-outline text-center py-4">Buscando…</p>}
        {results && results.length === 0 && !loading && <p className="text-[12px] text-outline text-center py-2">Nada encontrado. Adicione manualmente abaixo.</p>}
        {results && results.length > 0 && (
          <ul className="space-y-2 mb-4">
            {results.map((b, i) => (
              <li key={i}>
                <button onClick={() => onAdd(b)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface-variant/40 transition text-left">
                  <div className="w-10 h-14 rounded overflow-hidden shrink-0 bg-surface-container-high"><Cover book={b} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-on-surface truncate">{b.title}</div>
                    <div className="text-[11px] text-outline truncate">{b.author}{b.total ? ` · ${b.total} p.` : ""}</div>
                  </div>
                  <MI name="add" className="text-primary shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-white/5 pt-4">
          <Caps className="text-outline text-[10px] mb-2 block">Adicionar manualmente</Caps>
          <div className="flex flex-col gap-2">
            <input value={manual.title} onChange={(e) => setManual((m) => ({ ...m, title: e.target.value }))} placeholder="Título" className={`${inputCls} w-full`} />
            <div className="flex gap-2">
              <input value={manual.author} onChange={(e) => setManual((m) => ({ ...m, author: e.target.value }))} placeholder="Autor" className={`${inputCls} flex-1`} />
              <input value={manual.total} onChange={(e) => setManual((m) => ({ ...m, total: e.target.value }))} inputMode="numeric" placeholder="Págs" className={`${inputCls} w-20`} />
            </div>
            <button
              onClick={() => manual.title.trim() && onAdd({ title: manual.title.trim(), author: manual.author.trim(), total: parseInt(manual.total) || 0, cover: "" })}
              className="self-start px-4 py-2 rounded-lg border border-primary/40 text-primary font-label-caps text-[11px] active:scale-95 transition"
            >
              ADICIONAR MANUAL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookModal({ book, cats = [], onAddCat, onClose, onPatch, onStatus, onDelete }) {
  const [newCat, setNewCat] = useState("");
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const pct = bookPct(book);
  const options = [...new Set([...cats, ...(book.category ? [book.category] : [])])];
  function addCat() {
    const c = newCat.trim();
    if (!c) return;
    onAddCat?.(c);
    onPatch({ category: c });
    setNewCat("");
  }
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 animate-[fadeIn_.1s_ease-out]" onClick={onClose} role="dialog" aria-label="Detalhes do livro">
      <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-white/10 max-h-[90vh] overflow-auto ff-scroll" onClick={stop}>
        <div className="flex gap-4 mb-5">
          <div className="w-20 h-28 rounded-lg overflow-hidden shrink-0 border border-outline-variant/30"><Cover book={book} /></div>
          <div className="flex-1 min-w-0">
            <input value={book.title} onChange={(e) => onPatch({ title: e.target.value })} className="w-full bg-transparent font-headline-md text-headline-md text-primary outline-none border-b border-transparent focus:border-primary-container/40 transition mb-1" />
            <input value={book.author} onChange={(e) => onPatch({ author: e.target.value })} placeholder="Autor" className="w-full bg-transparent text-[13px] text-on-surface-variant outline-none border-b border-transparent focus:border-primary-container/40 transition" />
          </div>
          <button onClick={onClose} aria-label="Fechar" className="text-outline hover:text-on-surface transition shrink-0"><MI name="close" /></button>
        </div>

        {/* status */}
        <div className="flex gap-1.5 mb-4">
          {Object.entries(STATUS).map(([k, s]) => (
            <button key={k} onClick={() => onStatus(k)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-label-caps text-[10px] transition ${(book.status || "want") === k ? "bg-primary-container text-on-primary-container" : "bg-surface-container-high text-on-surface-variant"}`}>
              <MI name={s.icon} className="text-base" /> {s.label}
            </button>
          ))}
        </div>

        {/* progresso */}
        <div className="flex items-center gap-2 mb-4">
          <input type="number" min="0" value={book.page || ""} onChange={(e) => onPatch({ page: Math.max(0, parseInt(e.target.value) || 0) })} placeholder="0" className={`${inputCls} w-20 text-center`} />
          <span className="text-outline text-[13px]">/</span>
          <input type="number" min="0" value={book.total || ""} onChange={(e) => onPatch({ total: Math.max(0, parseInt(e.target.value) || 0) })} placeholder="—" className={`${inputCls} w-20 text-center`} />
          <span className="text-on-surface-variant text-[12px]">páginas</span>
          <div className="flex-1 h-2 bg-surface-variant rounded-full overflow-hidden ml-2">
            <div className="h-full bg-primary-container" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-label-caps text-[11px] text-outline w-9 text-right">{pct}%</span>
        </div>

        {/* nota */}
        <div className="flex items-center justify-between mb-4">
          <Caps className="text-outline text-[10px]">Nota</Caps>
          <StarRating value={book.rating || 0} onChange={(v) => onPatch({ rating: v })} />
        </div>

        {/* categoria */}
        <div className="mb-4">
          <Caps className="text-outline text-[10px]">Categoria</Caps>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {options.map((c) => (
              <button key={c} onClick={() => onPatch({ category: book.category === c ? "" : c })} className={`font-label-caps text-[10px] px-2.5 py-1 rounded-full transition ${book.category === c ? "bg-primary-container text-on-primary-container" : "bg-surface-container-high text-outline hover:text-on-surface-variant"}`}>
                {c}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 mt-2 border-2 border-dashed border-outline-variant/40 rounded-lg focus-within:border-primary/40 transition max-w-xs">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCat()} placeholder="Nova categoria" className="flex-1 min-w-0 bg-transparent px-3 py-1.5 text-[13px] text-on-surface placeholder:text-outline outline-none" />
            <button onClick={addCat} aria-label="Adicionar categoria" className="mr-1 h-7 w-7 grid place-items-center rounded-md text-primary hover:bg-primary/10 transition shrink-0"><MI name="add" className="text-lg" /></button>
          </div>
        </div>

        {/* resenha */}
        <label className="block mb-4">
          <Caps className="text-outline text-[10px]">Resenha / notas</Caps>
          <textarea value={book.review || ""} onChange={(e) => onPatch({ review: e.target.value })} rows={4} placeholder="O que achou? Trechos, aprendizados..." className={`${inputCls} w-full mt-1 resize-none`} />
        </label>

        {/* datas */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <label className="block">
            <Caps className="text-outline text-[10px]">Início</Caps>
            <input type="date" value={book.startedAt || ""} onChange={(e) => onPatch({ startedAt: e.target.value })} className={`${inputCls} w-full mt-1`} />
          </label>
          <label className="block">
            <Caps className="text-outline text-[10px]">Fim</Caps>
            <input type="date" value={book.finishedAt || ""} onChange={(e) => onPatch({ finishedAt: e.target.value })} className={`${inputCls} w-full mt-1`} />
          </label>
        </div>

        <button onClick={onDelete} className="flex items-center gap-2 text-error hover:bg-error/10 px-3 py-1.5 rounded-lg font-label-caps text-[11px] transition">
          <MI name="delete" className="text-base" /> REMOVER LIVRO
        </button>
      </div>
    </div>
  );
}
