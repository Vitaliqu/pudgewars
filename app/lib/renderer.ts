import { MAP_SIZE, MAX_CHARGE_TIME } from "./constants";
import type { Particle } from "../types/game";

export function drawGrid(ctx: CanvasRenderingContext2D, time: number) {
  const drift = (time * 8) % 40;
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let i = -40; i < MAP_SIZE + 40; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i + drift, 0);
    ctx.lineTo(i + drift, MAP_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i + drift);
    ctx.lineTo(MAP_SIZE, i + drift);
    ctx.stroke();
  }
}

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: any,
  isMe: boolean,
  time: number,
  hookChargeStart: number | null
) {
  const { x, y } = p.position;
  const alive = p.alive;
  const baseColor = !alive ? "#3f3f46" : (p.color || "#06b6d4");

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y + 16, 14, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pulse ring
  if (alive) {
    const pulse = (Math.sin(time * 2.5 + (isMe ? 0 : Math.PI)) * 0.5 + 0.5) * 0.35 + 0.05;
    ctx.beginPath();
    ctx.arc(x, y, 27, 0, Math.PI * 2);
    ctx.strokeStyle = baseColor;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Body glow
  ctx.fillStyle = baseColor;
  ctx.shadowBlur = alive ? 22 : 0;
  ctx.shadowColor = baseColor;
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Inner highlight gradient
  if (alive) {
    const grad = ctx.createRadialGradient(x - 7, y - 7, 1, x, y, 20);
    grad.addColorStop(0, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  // Border
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.stroke();

  // Charge ring (my player only, while holding Q)
  if (isMe && alive && hookChargeStart !== null) {
    const charge = Math.min(1, (Date.now() - hookChargeStart) / MAX_CHARGE_TIME);
    ctx.beginPath();
    ctx.arc(x, y, 32, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2);
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.4 + charge * 0.6;
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#fbbf24";
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Nickname label
  if (alive) {
    const label = p.nickname || p.id.slice(0, 8);
    ctx.fillStyle = isMe ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.75)";
    ctx.font = `bold ${isMe ? "11px" : "10px"} monospace`;
    ctx.textAlign = "center";
    ctx.fillText(label, x, y - 28);
  }
}

export function drawRopeWire(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  time: number, color: string
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return;

  const px = -dy / len;
  const py = dx / len;
  const amplitude = Math.min(10, len * 0.05);
  const segments = Math.max(16, Math.floor(len / 8));

  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const envelope = Math.sin(t * Math.PI);
      const wave = Math.sin(t * Math.PI * 5 - time * 8) * amplitude * envelope;
      const x = x1 + dx * t + px * wave;
      const y = y1 + dy * t + py * wave;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    if (pass === 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.25;
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9;
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

export function drawHookTip(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, time: number, color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(time * 5);
  ctx.shadowBlur = 18;
  ctx.shadowColor = color;

  const pulse = 0.5 + Math.sin(time * 10) * 0.3;
  ctx.strokeStyle = color;
  ctx.globalAlpha = pulse;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const s = 6;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.55, 0);
  ctx.lineTo(0, s);
  ctx.lineTo(-s * 0.55, 0);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

export function spawnParticles(
  particles: Particle[],
  x: number, y: number, color: string, count = 16
) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const speed = 2 + Math.random() * 5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color,
      size: 2 + Math.random() * 4,
    });
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  // Mutate in place — filter dead particles
  let write = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.life <= 0) continue;
    particles[write++] = p;

    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.91;
    p.vy *= 0.91;
    p.life -= 0.022;

    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0, p.size * p.life), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  particles.length = write;
  ctx.globalAlpha = 1;
}
