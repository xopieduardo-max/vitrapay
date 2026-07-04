import { useEffect, useState } from "react";

/**
 * Painel visual de ajuste do Hero.
 * Ativa com ?edit=1 na URL. Ajusta valores em tempo real via CSS variables
 * aplicadas ao <body>. Botão "Copiar valores" gera o snippet para colar.
 */

type Vals = {
  pt: number;         // padding-top (px)
  gap: number;        // gap entre colunas (px)
  logo: number;       // tamanho do logo 3D (px)
  title: number;      // font-size do H1 (rem)
  leftY: number;      // translateY coluna esquerda (px)
  rightY: number;     // translateY coluna direita (px)
  notifY: number;     // offset vertical da notificação (px)
  notifX: number;     // offset horizontal da notificação (px)
};

const DEFAULTS: Vals = {
  pt: 64,
  gap: 24,
  logo: 500,
  title: 3.1,
  leftY: 0,
  rightY: 0,
  notifY: 0,
  notifX: 0,
};

const STORAGE_KEY = "hero-dev-controls-v1";

function applyVars(v: Vals) {
  const r = document.body.style;
  r.setProperty("--hero-pt", `${v.pt}px`);
  r.setProperty("--hero-gap", `${v.gap}px`);
  r.setProperty("--hero-logo", `${v.logo}px`);
  r.setProperty("--hero-title", `${v.title}rem`);
  r.setProperty("--hero-left-y", `${v.leftY}px`);
  r.setProperty("--hero-right-y", `${v.rightY}px`);
  r.setProperty("--hero-notif-y", `${v.notifY}px`);
  r.setProperty("--hero-notif-x", `${v.notifX}px`);
}

export function HeroDevControls() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(true);
  const [vals, setVals] = useState<Vals>(DEFAULTS);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("edit") === "1") {
      setEnabled(true);
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setVals({ ...DEFAULTS, ...JSON.parse(saved) });
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    applyVars(vals);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(vals)); } catch {}
  }, [vals, enabled]);

  if (!enabled) return null;

  const update = (k: keyof Vals) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setVals((v) => ({ ...v, [k]: parseFloat(e.target.value) }));

  const copy = () => {
    navigator.clipboard.writeText(JSON.stringify(vals, null, 2));
  };

  const reset = () => setVals(DEFAULTS);

  const rows: Array<[keyof Vals, string, number, number, number]> = [
    ["pt", "Padding topo (px)", 0, 200, 1],
    ["gap", "Gap colunas (px)", 0, 120, 1],
    ["logo", "Tamanho logo (px)", 160, 700, 2],
    ["title", "Título (rem)", 1, 5, 0.05],
    ["leftY", "Coluna esq. Y (px)", -200, 200, 1],
    ["rightY", "Coluna dir. Y (px)", -200, 200, 1],
    ["notifY", "Notif Y (px)", -300, 300, 1],
    ["notifX", "Notif X (px)", -300, 300, 1],
  ];

  return (
    <div
      style={{ position: "fixed", top: 12, right: 12, zIndex: 9999, width: open ? 300 : 44 }}
      className="rounded-xl border border-primary/40 bg-black/90 backdrop-blur text-xs text-white shadow-2xl"
    >
      <div className="flex items-center justify-between p-2 border-b border-white/10">
        {open && <span className="font-semibold text-primary">Hero · ajuste manual</span>}
        <button
          onClick={() => setOpen((o) => !o)}
          className="px-2 py-0.5 rounded bg-primary/20 hover:bg-primary/30"
        >
          {open ? "–" : "+"}
        </button>
      </div>
      {open && (
        <div className="p-3 space-y-3 max-h-[80vh] overflow-y-auto">
          {rows.map(([key, label, min, max, step]) => (
            <label key={key} className="block">
              <div className="flex justify-between mb-1">
                <span>{label}</span>
                <span className="text-primary tabular-nums">{vals[key]}</span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={vals[key]}
                onChange={update(key)}
                className="w-full accent-primary"
              />
            </label>
          ))}
          <div className="flex gap-2 pt-2 border-t border-white/10">
            <button
              onClick={copy}
              className="flex-1 py-1.5 rounded bg-primary text-black font-semibold hover:brightness-110"
            >
              Copiar valores
            </button>
            <button
              onClick={reset}
              className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20"
            >
              Reset
            </button>
          </div>
          <p className="text-[10px] text-white/50 leading-snug">
            Painel visível apenas com <code>?edit=1</code> na URL. Ajuste e envie os valores copiados para eu fixar no código.
          </p>
        </div>
      )}
    </div>
  );
}
