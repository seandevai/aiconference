// Riquadro del PiP per chi ha la camera spenta: iniziale e nome disegnati su un canvas,
// mandati nel <video> del PiP come stream. Solo visualizzazione, niente su disco.
type Ctx2d = {
  fillStyle: unknown;
  font: string;
  textAlign: unknown;
  textBaseline: unknown;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  fillText: (text: string, x: number, y: number) => void;
  beginPath: () => void;
  arc: (x: number, y: number, r: number, start: number, end: number) => void;
  fill: () => void;
};
type StreamLike = { getTracks: () => { stop: () => void }[] };
export type AvatarCanvasLike = {
  width: number;
  height: number;
  getContext: (kind: '2d') => unknown;
  captureStream?: ((fps?: number) => StreamLike) | undefined;
};

const WIDTH = 320;
const HEIGHT = 180;
// Un canvas fermo non produce fotogrammi: senza ridisegno il video non riceve mai i
// metadati e il browser rifiuta il PiP.
const REDRAW_MS = 500;

export function avatarInitial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}

function draw(ctx: Ctx2d, name: string) {
  ctx.fillStyle = '#171717';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#404040';
  ctx.beginPath();
  ctx.arc(WIDTH / 2, 76, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fafafa';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 40px system-ui, sans-serif';
  ctx.fillText(avatarInitial(name), WIDTH / 2, 78);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(name, WIDTH / 2, 148);
}

export function startAvatarStream(
  canvas: AvatarCanvasLike,
  name: string,
): { stream: StreamLike; stop: () => void } | null {
  const ctx = canvas.getContext('2d') as Ctx2d | null;
  if (!ctx || typeof canvas.captureStream !== 'function') return null;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  draw(ctx, name);
  const stream = canvas.captureStream(2);
  const timer = setInterval(() => draw(ctx, name), REDRAW_MS);
  return {
    stream,
    stop: () => {
      clearInterval(timer);
      stream.getTracks().forEach((track) => track.stop());
    },
  };
}
