import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";

function useDevMode() {
  const [dev, setDev] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDev(params.get("edit") === "1");
  }, []);
  return dev;
}

/**
 * Dev-only drag controls for hero notifications.
 * - Wrap each notification with <DevDraggable id="...">...</DevDraggable>
 * - Render <NotifDevControls /> once on the page to see a copyable JSON panel.
 * - Persists offsets in localStorage under "notif-dev-offsets".
 */

const STORAGE_KEY = "notif-dev-offsets";

type Offset = { x: number; y: number };
type OffsetMap = Record<string, Offset>;

const DEFAULT_OFFSETS: OffsetMap = {
  "notif-bottom-right": { x: 48.20703125, y: -228.48437498835847 },
  "notif-right": { x: 34.78125, y: -30.53125 },
  "notif-bottom-left": { x: -119.5390625, y: -107.15234375 },
  "notif-top-left": { x: -164.7721494305879, y: 258.21484446758404 },
};

const listeners = new Set<() => void>();
let state: OffsetMap = load();

function load(): OffsetMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_OFFSETS;
  } catch {
    return DEFAULT_OFFSETS;
  }
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  listeners.forEach((l) => l());
}
function setOffset(id: string, o: Offset) {
  state = { ...state, [id]: o };
  persist();
}
function resetAll() {
  state = {};
  persist();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot() {
  return state;
}

export function useDevOffsets() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function DevDraggable({
  id,
  className,
  style,
  children,
}: {
  id: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const offsets = useDevOffsets();
  const off = offsets[id] || { x: 0, y: 0 };
  const ref = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const dev = useDevMode();

  const onPointerDown = (e: React.PointerEvent) => {
    if (!dev || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: off.x, oy: off.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dev || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(id, { x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dev) return;
    dragRef.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        transform: `translate(${off.x}px, ${off.y}px)`,
        cursor: dev ? "grab" : undefined,
        outline: dev ? "1px dashed rgba(250, 204, 21, 0.6)" : undefined,
        outlineOffset: dev ? "2px" : undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      data-dev-drag-id={dev ? id : undefined}
    >
      {children}
    </div>
  );
}

export function NotifDevControls() {
  const offsets = useDevOffsets();
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const json = JSON.stringify(offsets, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 9999,
        background: "rgba(10,10,10,0.95)",
        color: "#fff",
        border: "1px solid rgba(250,204,21,0.4)",
        borderRadius: 12,
        padding: 12,
        fontSize: 12,
        fontFamily: "ui-monospace, monospace",
        width: 280,
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ color: "#facc15" }}>Notif Positions</strong>
        <button onClick={() => setOpen((o) => !o)} style={btn}>{open ? "–" : "+"}</button>
      </div>
      {open && (
        <>
          <pre style={{ margin: 0, maxHeight: 220, overflow: "auto", background: "#000", padding: 8, borderRadius: 6 }}>
{json}
          </pre>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={copy} style={{ ...btn, flex: 1, background: "#facc15", color: "#000" }}>
              {copied ? "Copiado!" : "Copiar JSON"}
            </button>
            <button onClick={resetAll} style={btn}>Reset</button>
          </div>
          <p style={{ marginTop: 8, opacity: 0.6, fontSize: 10 }}>
            Arraste as notificações no preview. Valores em px de offset (translate).
          </p>
        </>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 6,
  padding: "6px 10px",
  cursor: "pointer",
  fontSize: 12,
};
