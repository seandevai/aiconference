import type { Frame } from '@omnicanvas/gesture';

// Collegamenti dello scheletro con gli indici di MediaPipe (0 polso, 4 punta del pollice…).
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  color: string,
  w: number,
  h: number,
) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  for (const hand of frame.hands) {
    // Vista specchio, come il video: x → 1 - x.
    const at = (i: number) => {
      const p = hand.landmarks[i]!;
      return { x: (1 - p.x) * w, y: p.y * h };
    };
    for (const [a, b] of HAND_CONNECTIONS) {
      const from = at(a);
      const to = at(b);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    for (let i = 0; i < hand.landmarks.length; i++) {
      const p = at(i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Grezzo e filtrato con colori diversi: si vede quanto il filtro ferma il tremolio.
export function drawHands(
  canvas: HTMLCanvasElement,
  frames: { raw: Frame; processed: Frame } | null,
  colors: { raw: string; processed: string },
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!frames) return;
  drawFrame(ctx, frames.raw, colors.raw, canvas.width, canvas.height);
  if (frames.processed !== frames.raw)
    drawFrame(ctx, frames.processed, colors.processed, canvas.width, canvas.height);
}
