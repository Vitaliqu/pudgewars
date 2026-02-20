"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  MAP_SIZE,
  PLAYER_RADIUS,
  SPEED,
  HOOK_COOLDOWN,
  MAX_CHARGE_TIME,
  CHARGE_RAMP_TIME,
  CHARGING_SPEED_MIN,
  SERVER_TICK_MS,
  RECONCILE_SNAP,
} from "../lib/constants";
import { drawGrid, drawPlayer, drawRopeWire, drawHookTip, spawnParticles, drawParticles } from "../lib/renderer";
import { getInterpPlayers } from "../lib/interpolation";
import Scoreboard from "./Scoreboard";
import SkillBar from "./SkillBar";
import TopBar from "./TopBar";
import type { PlayerHUD, Particle, InputSample, StateSnapshot } from "../types/game";

interface Props {
  socketRef: RefObject<WebSocket | null>;
  myIdRef: RefObject<string | null>;
  myPingRef: RefObject<number>;
  serverSnapshotRef: RefObject<{ pos: { x: number; y: number }; t: number } | null>;
  stateBufferRef: RefObject<StateSnapshot[]>;
  stateRef: RefObject<any>;
  inputHistoryRef: RefObject<InputSample[]>;
  respawnAnchorRef: RefObject<{ x: number; y: number } | null>;
  prevAliveRef: RefObject<Record<string, boolean>>;
  connectionStatus: string;
  currentRoomId: string | null;
  isCurrentRoomPrivate: boolean;
  onLeave: () => void;
}

export default function GameScreen({
  socketRef,
  myIdRef,
  myPingRef,
  serverSnapshotRef,
  stateBufferRef,
  stateRef,
  inputHistoryRef,
  respawnAnchorRef,
  prevAliveRef,
  connectionStatus,
  currentRoomId,
  isCurrentRoomPrivate,
  onLeave,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const mouseRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const hookChargeStartRef = useRef<number | null>(null);
  const predictedPosRef = useRef({ x: 400, y: 400 });
  const lastPredictTimeRef = useRef(0);

  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [chargeLevel, setChargeLevel] = useState(0);
  const [playersHUD, setPlayersHUD] = useState<PlayerHUD[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    function castHook(chargeTime: number) {
      const state = stateRef.current;
      const myId = myIdRef.current;
      const sock = socketRef.current;
      if (!state || !myId || !sock) return;
      const me = state.players[myId];
      if (!me || !me.alive) return;
      const dx = mouseRef.current.x - me.position.x;
      const dy = mouseRef.current.y - me.position.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (!len) return;
      sock.send(JSON.stringify({ type: "hook", direction: { x: dx / len, y: dy / len }, chargeTime }));
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = true;
      if (key === "q" && hookChargeStartRef.current === null) {
        const state = stateRef.current;
        const myId = myIdRef.current;
        if (!state || !myId) return;
        const me = state.players[myId];
        if (!me || !me.alive) return;
        if (me.hookReadyAt && me.hookReadyAt > state.serverTime) return;
        hookChargeStartRef.current = Date.now();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = false;
      if (key === "q" && hookChargeStartRef.current !== null) {
        const chargeTime = Date.now() - hookChargeStartRef.current;
        hookChargeStartRef.current = null;
        castHook(chargeTime);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);

    function updateInput() {
      const sock = socketRef.current;
      if (!sock || sock.readyState !== WebSocket.OPEN) return;
      let x = 0, y = 0;
      if (keysRef.current["w"]) y--;
      if (keysRef.current["s"]) y++;
      if (keysRef.current["a"]) x--;
      if (keysRef.current["d"]) x++;
      const len = Math.sqrt(x * x + y * y);
      let speedFactor = 1.0;
      if (hookChargeStartRef.current !== null) {
        const t = Math.min(1, (Date.now() - hookChargeStartRef.current) / CHARGE_RAMP_TIME);
        speedFactor = 1.0 - (1.0 - CHARGING_SPEED_MIN) * t;
      }
      sock.send(
        JSON.stringify({
          type: "move",
          direction: len ? { x: x / len, y: y / len } : { x: 0, y: 0 },
          speedFactor,
        })
      );
    }

    function updateHUD() {
      const state = stateRef.current;
      if (!state) return;
      const now = state.serverTime;
      const sorted = (Object.values(state.players) as any[]).sort(
        (a, b) => (b.kills ?? 0) - (a.kills ?? 0)
      );
      setPlayersHUD(
        sorted.map((p: any) => ({
          id: p.id,
          nickname: p.nickname || p.id.slice(0, 8),
          color: p.color || "#06b6d4",
          alive: p.alive,
          kills: p.kills ?? 0,
          respawnIn: p.respawnAt ? Math.max(0, Math.ceil((p.respawnAt - now) / 1000)) : 0,
          ping: p.id === myIdRef.current ? myPingRef.current : p.ping,
        }))
      );
      const me = state.players[myIdRef.current!];
      if (me) setCooldownLeft(Math.max(0, me.hookReadyAt - now));
      setChargeLevel(
        hookChargeStartRef.current !== null
          ? Math.min(1, (Date.now() - hookChargeStartRef.current) / MAX_CHARGE_TIME)
          : 0
      );
    }

    function predictStep() {
      // Check for respawn anchor signal from page
      const anchor = respawnAnchorRef.current;
      if (anchor) {
        predictedPosRef.current = { x: anchor.x, y: anchor.y };
        inputHistoryRef.current = [];
        respawnAnchorRef.current = null;
      }

      const myId = myIdRef.current;
      const state = stateRef.current;
      if (!myId || !state) return;
      const me = state.players[myId];
      if (!me?.alive) return;

      const now = Date.now();
      const dt = lastPredictTimeRef.current ? now - lastPredictTimeRef.current : SERVER_TICK_MS;
      lastPredictTimeRef.current = now;

      let vx = 0, vy = 0;
      if (keysRef.current["w"]) vy--;
      if (keysRef.current["s"]) vy++;
      if (keysRef.current["a"]) vx--;
      if (keysRef.current["d"]) vx++;
      const vlen = Math.sqrt(vx * vx + vy * vy);
      if (vlen > 0) { vx /= vlen; vy /= vlen; }
      let sf = 1.0;
      if (hookChargeStartRef.current !== null) {
        const ct = Math.min(1, (now - hookChargeStartRef.current) / CHARGE_RAMP_TIME);
        sf = 1.0 - (1.0 - CHARGING_SPEED_MIN) * ct;
      }

      const hist = inputHistoryRef.current;
      hist.push({ t: now, vx, vy, sf });
      while (hist.length > 1 && hist[0].t < now - 2000) hist.shift();

      const pred = predictedPosRef.current;

      if (me.hook && !me.hook.returning) {
        const snap = serverSnapshotRef.current;
        if (snap) {
          const a = 1 - Math.pow(0.7, dt / (1000 / 60));
          pred.x += (snap.pos.x - pred.x) * a;
          pred.y += (snap.pos.y - pred.y) * a;
        }
        return;
      }

      const ticks = dt / SERVER_TICK_MS;
      pred.x = Math.max(PLAYER_RADIUS, Math.min(MAP_SIZE - PLAYER_RADIUS, pred.x + vx * sf * SPEED * ticks));
      pred.y = Math.max(PLAYER_RADIUS, Math.min(MAP_SIZE - PLAYER_RADIUS, pred.y + vy * sf * SPEED * ticks));

      const snap = serverSnapshotRef.current;
      if (snap) {
        let rx = snap.pos.x;
        let ry = snap.pos.y;
        for (let i = 0; i < hist.length; i++) {
          if (hist[i].t <= snap.t) continue;
          const prevT = i > 0 ? Math.max(hist[i - 1].t, snap.t) : snap.t;
          const stepTicks = (hist[i].t - prevT) / SERVER_TICK_MS;
          rx = Math.max(PLAYER_RADIUS, Math.min(MAP_SIZE - PLAYER_RADIUS, rx + hist[i].vx * hist[i].sf * SPEED * stepTicks));
          ry = Math.max(PLAYER_RADIUS, Math.min(MAP_SIZE - PLAYER_RADIUS, ry + hist[i].vy * hist[i].sf * SPEED * stepTicks));
        }

        const ex = rx - pred.x;
        const ey = ry - pred.y;
        const dist = Math.sqrt(ex * ex + ey * ey);
        if (dist > RECONCILE_SNAP) {
          pred.x = rx;
          pred.y = ry;
        } else if (dist > 0.5) {
          const corrRate = Math.min(1, dt / 80);
          pred.x += ex * corrRate;
          pred.y += ey * corrRate;
        }
      }
    }

    function render() {
      timeRef.current += 0.016;
      const time = timeRef.current;

      ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
      drawGrid(ctx, time);

      predictStep();
      updateInput();

      const state = stateRef.current;
      const myId = myIdRef.current;

      if (state) {
        const displayPlayers = getInterpPlayers(stateBufferRef.current, state.players);

        if (myId && displayPlayers[myId]?.alive) {
          displayPlayers[myId] = { ...displayPlayers[myId], position: { ...predictedPosRef.current } };
        }

        // Detect deaths → spawn particles (server-authoritative)
        for (const [id, p] of Object.entries(state.players) as [string, any][]) {
          if (prevAliveRef.current[id] === true && !p.alive) {
            spawnParticles(particlesRef.current, p.position.x, p.position.y, p.color || "#06b6d4");
          }
          prevAliveRef.current[id] = p.alive;
        }

        // Hooks
        Object.values(displayPlayers).forEach((p: any) => {
          if (!p.hook) return;
          const color = p.color || "#06b6d4";
          drawRopeWire(ctx, p.position.x, p.position.y, p.hook.position.x, p.hook.position.y, time, color);
          drawHookTip(ctx, p.hook.position.x, p.hook.position.y, time, color);
        });

        // Players
        Object.values(displayPlayers).forEach((p: any) => {
          drawPlayer(ctx, p, p.id === myId, time, hookChargeStartRef.current);
        });
      }

      drawParticles(ctx, particlesRef.current);
      updateHUD();
      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      keysRef.current = {};
      hookChargeStartRef.current = null;
    };
  }, []);

  const cooldownProgress = cooldownLeft / HOOK_COOLDOWN;
  const isReady = cooldownLeft === 0;

  return (
    <div className="h-screen w-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-cyan-500/30 overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#164e63_0%,transparent_50%)] opacity-20 pointer-events-none" />

      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000" />

        <canvas
          ref={canvasRef}
          width={MAP_SIZE}
          height={MAP_SIZE}
          className="relative bg-zinc-950/90 border border-white/10 rounded-xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-3xl"
        />

        {/* TOP OVERLAY */}
        <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
          <TopBar
            connectionStatus={connectionStatus}
            currentRoomId={currentRoomId}
            isCurrentRoomPrivate={isCurrentRoomPrivate}
            onLeave={onLeave}
          />
          <Scoreboard players={playersHUD} myId={myIdRef.current} />
        </div>

        {/* BOTTOM OVERLAY */}
        <SkillBar
          cooldownLeft={cooldownLeft}
          cooldownProgress={cooldownProgress}
          chargeLevel={chargeLevel}
          isReady={isReady}
        />
      </div>

      <div className="absolute bottom-4 right-6 text-zinc-600 text-[10px] uppercase tracking-[0.3em] font-medium">
        Pudge Wars v2.0 · Alpha
      </div>
    </div>
  );
}
