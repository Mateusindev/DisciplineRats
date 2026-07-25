"use client";

// Câmera de canvas (pan / zoom / pinch) sem dependência externa.
// Ideia central: uma única transform num elemento "world"; tudo (grid, nós, arestas) vive
// dentro dele, então a câmera nunca toca geometria — arestas ficam pixel-locked em qualquer zoom.
// Durante o gesto a transform é escrita IMPERATIVAMENTE (zero re-render); `setCam` roda uma vez
// no fim, pra botões/rótulo de zoom lerem estado consistente.

import { useCallback, useEffect, useRef, useState } from "react";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const snapZ = (z) => Math.round(z / 0.05) * 0.05; // passo de 0.05 evita texto borrado em escala fracionária

// `enabled` precisa refletir se o viewport está montado: o efeito do wheel depende dele pra
// re-rodar quando o canvas aparece (ex.: troca de lista → canvas por matchMedia). Sem isso o
// listener nativo nunca anexa e a roda do mouse rola a página.
export function useCanvas(viewportRef, worldRef, { minZ = 0.4, maxZ = 2.5, padding = 56, enabled = true } = {}) {
  const [cam, setCam] = useState({ x: 0, y: 0, z: 1 });
  const camRef = useRef(cam);
  const panRef = useRef(null); // { pid, sx, sy, ox, oy }
  const ptrs = useRef(new Map()); // pointerId → { x, y }
  const pinchRef = useRef(null); // { dist, z }
  const commitTimer = useRef(null);

  const apply = useCallback(() => {
    const w = worldRef.current;
    if (!w) return;
    const { x, y, z } = camRef.current;
    w.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${z})`;
  }, [worldRef]);

  const commit = useCallback(() => {
    clearTimeout(commitTimer.current);
    setCam({ ...camRef.current });
  }, []);

  // wheel pode disparar dezenas de vezes por segundo — só materializa no state no fim
  const scheduleCommit = useCallback(() => {
    clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(commit, 120);
  }, [commit]);

  // will-change permanente = camada gigante fixa na GPU; só durante o gesto
  const gesture = useCallback(
    (on) => {
      const w = worldRef.current;
      if (w) w.style.willChange = on ? "transform" : "";
    },
    [worldRef]
  );

  const screenToWorld = useCallback(
    (clientX, clientY) => {
      const r = viewportRef.current?.getBoundingClientRect();
      const { x, y, z } = camRef.current;
      if (!r) return { x: 0, y: 0 };
      return { x: (clientX - r.left - x) / z, y: (clientY - r.top - y) / z };
    },
    [viewportRef]
  );

  // zoom ancorado num ponto da tela: o ponto sob o cursor não se move
  const zoomAt = useCallback(
    (clientX, clientY, nextZ) => {
      const r = viewportRef.current?.getBoundingClientRect();
      if (!r) return;
      const { x, y, z } = camRef.current;
      const z2 = clamp(snapZ(nextZ), minZ, maxZ);
      if (z2 === z) return;
      const cx = clientX - r.left;
      const cy = clientY - r.top;
      const k = z2 / z;
      camRef.current = { x: cx - (cx - x) * k, y: cy - (cy - y) * k, z: z2 };
      apply();
    },
    [viewportRef, apply, minZ, maxZ]
  );

  // zoom pelos botões: âncora no centro do viewport
  const zoomBy = useCallback(
    (factor) => {
      const r = viewportRef.current?.getBoundingClientRect();
      if (!r) return;
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, camRef.current.z * factor);
      commit();
    },
    [viewportRef, zoomAt, commit]
  );

  // enquadra um retângulo em coordenadas de mundo
  const fitTo = useCallback(
    (rect) => {
      const r = viewportRef.current?.getBoundingClientRect();
      if (!r || !rect || rect.w <= 0 || rect.h <= 0) return;
      const z = clamp(snapZ(Math.min((r.width - padding * 2) / rect.w, (r.height - padding * 2) / rect.h)), minZ, maxZ);
      camRef.current = {
        x: (r.width - rect.w * z) / 2 - rect.x * z,
        y: (r.height - rect.h * z) / 2 - rect.y * z,
        z,
      };
      apply();
      commit();
    },
    [viewportRef, apply, commit, padding, minZ, maxZ]
  );

  const finishPointer = useCallback(
    (e) => {
      ptrs.current.delete(e.pointerId);
      if (ptrs.current.size < 2) pinchRef.current = null;
      if (panRef.current?.pid === e.pointerId) panRef.current = null;
      // saiu do pinch mas sobrou um dedo: reassenta o pan nele pra não travar o arraste
      if (!panRef.current && ptrs.current.size === 1) {
        const [pid, p] = [...ptrs.current.entries()][0];
        panRef.current = { pid, sx: p.x, sy: p.y, ox: camRef.current.x, oy: camRef.current.y };
      }
      if (ptrs.current.size === 0) {
        gesture(false);
        commit();
      }
    },
    [commit, gesture]
  );

  const bind = {
    onPointerDown: (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      e.currentTarget.setPointerCapture?.(e.pointerId);
      gesture(true);
      if (ptrs.current.size === 2) {
        const [a, b] = [...ptrs.current.values()];
        pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: camRef.current.z };
        panRef.current = null;
        return;
      }
      panRef.current = { pid: e.pointerId, sx: e.clientX, sy: e.clientY, ox: camRef.current.x, oy: camRef.current.y };
    },
    onPointerMove: (e) => {
      if (!ptrs.current.has(e.pointerId)) return;
      ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinchRef.current && ptrs.current.size >= 2) {
        const [a, b] = [...ptrs.current.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinchRef.current.z * (d / pinchRef.current.dist));
        return;
      }
      const p = panRef.current;
      if (!p || p.pid !== e.pointerId) return;
      camRef.current = { ...camRef.current, x: p.ox + (e.clientX - p.sx), y: p.oy + (e.clientY - p.sy) };
      apply();
    },
    onPointerUp: finishPointer,
    onPointerCancel: finishPointer,
    onLostPointerCapture: finishPointer,
  };

  // React registra `wheel` como passivo na raiz, então preventDefault() dentro de onWheel
  // falha e a página rola atrás do canvas. Precisa de listener nativo não-passivo.
  useEffect(() => {
    const el = enabled ? viewportRef.current : null;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(e.clientX, e.clientY, camRef.current.z * (1 - dy * 0.0015));
      scheduleCommit();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [viewportRef, zoomAt, scheduleCommit, enabled]);

  useEffect(() => () => clearTimeout(commitTimer.current), []);

  return { cam, camRef, bind, zoomBy, fitTo, screenToWorld, apply };
}
