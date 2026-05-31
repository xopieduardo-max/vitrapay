// Gera um card 1080x1080 (ideal para Stories/Feed) com o brasão da conquista
// e o valor desbloqueado, depois aciona share ou download.

interface ShareOptions {
  tierName: string;
  tierLabel: string;
  badgeSrc: string;
  userName?: string | null;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

export async function generateAchievementCard(opts: ShareOptions): Promise<Blob> {
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Fundo preto VitraPay com glow amarelo central
  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, size, size);
  const grad = ctx.createRadialGradient(size / 2, size * 0.42, 50, size / 2, size * 0.42, size * 0.6);
  grad.addColorStop(0, "rgba(250, 204, 21, 0.32)");
  grad.addColorStop(1, "rgba(8, 8, 8, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Pill "CONQUISTA DESBLOQUEADA"
  ctx.font = "bold 22px Inter, system-ui, sans-serif";
  const pillText = "CONQUISTA DESBLOQUEADA";
  const pw = ctx.measureText(pillText).width + 48;
  const px = (size - pw) / 2;
  const py = 90;
  ctx.fillStyle = "rgba(250, 204, 21, 0.12)";
  roundRect(ctx, px, py, pw, 44, 22);
  ctx.fill();
  ctx.fillStyle = "#facc15";
  ctx.textBaseline = "middle";
  ctx.fillText(pillText, px + 24, py + 22);

  // Badge centralizado
  try {
    const img = await loadImage(opts.badgeSrc);
    const badgeSize = 520;
    ctx.drawImage(img, (size - badgeSize) / 2, 170, badgeSize, badgeSize);
  } catch {
    /* fallback: continue sem imagem */
  }

  // Nome do tier
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "bold 96px Inter, system-ui, sans-serif";
  ctx.fillText(opts.tierName.toUpperCase(), size / 2, 800);

  // Valor
  ctx.fillStyle = "#facc15";
  ctx.font = "bold 64px Inter, system-ui, sans-serif";
  ctx.fillText(opts.tierLabel, size / 2, 880);

  // Sub: usuário
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.font = "500 28px Inter, system-ui, sans-serif";
  ctx.fillText(opts.userName ? `${opts.userName} · vitrapay.com.br` : "vitrapay.com.br", size / 2, 950);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no blob"))), "image/png", 0.95)
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function shareAchievement(opts: ShareOptions) {
  const blob = await generateAchievementCard(opts);
  const filename = `vitrapay-conquista-${opts.tierName.toLowerCase()}.png`;
  const file = new File([blob], filename, { type: "image/png" });

  // @ts-ignore — canShare está disponível em browsers modernos
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Conquista ${opts.tierName} — VitraPay`,
        text: `Acabei de desbloquear ${opts.tierLabel} na VitraPay!`,
      });
      return "shared";
    } catch {
      /* usuário cancelou — segue pro download */
    }
  }

  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return "downloaded";
}

// Som curto "ding" sintético — sem arquivos externos
const SOUND_KEY = "vitrapay_achievement_sound";
export const isSoundEnabled = () => {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(SOUND_KEY) !== "0";
};
export const toggleSound = (enabled: boolean) => {
  localStorage.setItem(SOUND_KEY, enabled ? "1" : "0");
};

export function playUnlockSound() {
  if (!isSoundEnabled()) return;
  try {
    const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    // 3 notas crescentes (acorde maior — vitória)
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.18, now + i * 0.08 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.7);
      o.connect(g).connect(ctx.destination);
      o.start(now + i * 0.08);
      o.stop(now + i * 0.08 + 0.75);
    });

    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {
    /* navegador bloqueou ou sem permissão de áudio */
  }
}
