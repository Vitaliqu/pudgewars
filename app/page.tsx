"use client";

import { useEffect, useRef, useState } from "react";

const HOOK_COOLDOWN = 3000;
const MAX_CHARGE_TIME = 1500;
const CHARGE_RAMP_TIME = 500;
const CHARGING_SPEED_MIN = 0.15;

// Must mirror server constants for accurate prediction
const MAP_SIZE = 800;
const PLAYER_RADIUS = 20;
const SPEED = 5;
const INTERP_DELAY_MS = 100; // render others this far behind real-time
const RECONCILE_SNAP = 80;   // snap to server if gap exceeds this (px)

const COLOR_SWATCHES = [
  "#06b6d4", "#ef4444", "#22c55e", "#a855f7",
  "#f97316", "#ec4899", "#eab308", "#f4f4f5",
];

interface PlayerHUD {
  id: string;
  nickname: string;
  color: string;
  alive: boolean;
  kills: number;
  respawnIn?: number;
}

interface RoomInfo {
  id: string;
  name: string;
  isPrivate: boolean;
  playerCount: number;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  color: string;
  size: number;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const stateRef = useRef<any>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const mouseRef = useRef({ x: 0, y: 0 });
  const myIdRef = useRef<string | null>(null);
  const timeRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const prevAliveRef = useRef<Record<string, boolean>>({});
  const rafRef = useRef<number>(0);
  const hookChargeStartRef = useRef<number | null>(null);
  const predictedPosRef = useRef({ x: 400, y: 400 });
  const serverPosRef    = useRef<{ x: number; y: number } | null>(null);
  const stateBufferRef  = useRef<Array<{ t: number; players: Record<string, any> }>>([]);

  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [nickname, setNickname] = useState("Player");
  const [selectedColor, setSelectedColor] = useState("#06b6d4");
  const [openRooms, setOpenRooms] = useState<RoomInfo[]>([]);
  const [createRoomName, setCreateRoomName] = useState("");
  const [isPrivateCreate, setIsPrivateCreate] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isCurrentRoomPrivate, setIsCurrentRoomPrivate] = useState(false);

  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [chargeLevel, setChargeLevel] = useState(0);
  const [playersHUD, setPlayersHUD] = useState<PlayerHUD[]>([]);

  // ── WebSocket effect ───────────────────────────────────────────────────
  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";
    let destroyed = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      if (destroyed) return;
      setConnectionStatus("Connecting...");

      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      socket.onopen = () => setConnectionStatus("Online");

      socket.onclose = () => {
        setConnectionStatus("Offline");
        // If we were in-game, drop back to menu so state is clean
        setScreen("menu");
        stateRef.current = null;
        setPlayersHUD([]);
        // Retry after 2 s
        if (!destroyed) retryTimer = setTimeout(connect, 2000);
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "init") {
          myIdRef.current = data.id;
          return;
        }

        if (data.type === "room_list") {
          setOpenRooms(data.rooms);
          return;
        }

        if (data.type === "room_joined") {
          setCurrentRoomId(data.roomId);
          setIsCurrentRoomPrivate(data.isPrivate);
          setErrorMsg("");
          stateRef.current = null;
          prevAliveRef.current = {};
          particlesRef.current = [];
          predictedPosRef.current = { x: 400, y: 400 };
          serverPosRef.current = null;
          stateBufferRef.current = [];
          setScreen("game");
          return;
        }

        if (data.type === "room_left") {
          setCurrentRoomId(null);
          setIsCurrentRoomPrivate(false);
          stateRef.current = null;
          setPlayersHUD([]);
          setScreen("menu");
          return;
        }

        if (data.type === "error") {
          setErrorMsg(data.message);
          return;
        }

        // Raw game state blob
        const myId = myIdRef.current;
        if (myId && data.players[myId]) {
          const sm = data.players[myId];
          serverPosRef.current = { x: sm.position.x, y: sm.position.y };
          // Re-anchor prediction on respawn (dead → alive transition)
          if (!prevAliveRef.current[myId] && sm.alive) {
            predictedPosRef.current = { x: sm.position.x, y: sm.position.y };
          }
        }
        stateBufferRef.current.push({ t: Date.now(), players: data.players });
        if (stateBufferRef.current.length > 40) stateBufferRef.current.shift();
        stateRef.current = data;
      };
    }

    connect();

    return () => {
      destroyed = true;
      clearTimeout(retryTimer);
      socketRef.current?.close();
    };
  }, []);

  // ── Canvas / input effect ──────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "game") return;

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

    // ── Particles ──────────────────────────────────────────────────────────
    function spawnParticles(x: number, y: number, color: string, count = 16) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
        const speed = 2 + Math.random() * 5;
        particlesRef.current.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color,
          size: 2 + Math.random() * 4,
        });
      }
    }

    function drawParticles() {
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      for (const p of particlesRef.current) {
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
      ctx.globalAlpha = 1;
    }

    // ── Rope wire ─────────────────────────────────────────────────────────
    function drawRopeWire(
      x1: number, y1: number, x2: number, y2: number,
      time: number, color: string
    ) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 2) return;

      const px = -dy / len;
      const py =  dx / len;
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

    // ── Hook tip ──────────────────────────────────────────────────────────
    function drawHookTip(x: number, y: number, time: number, color: string) {
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
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.55, 0);
      ctx.lineTo(0,  s); ctx.lineTo(-s * 0.55, 0);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ── Player ────────────────────────────────────────────────────────────
    function drawPlayer(p: any, isMe: boolean, time: number) {
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
      if (isMe && alive && hookChargeStartRef.current !== null) {
        const charge = Math.min(1, (Date.now() - hookChargeStartRef.current) / MAX_CHARGE_TIME);
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

    // ── Input / HUD ───────────────────────────────────────────────────────
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
      sock.send(JSON.stringify({ type: "move", direction: len ? { x: x / len, y: y / len } : { x: 0, y: 0 }, speedFactor }));
    }

    function updateHUD() {
      const state = stateRef.current;
      if (!state) return;
      const now = state.serverTime;
      const sorted = (Object.values(state.players) as any[])
        .sort((a, b) => (b.kills ?? 0) - (a.kills ?? 0));
      setPlayersHUD(sorted.map((p: any) => ({
        id: p.id,
        nickname: p.nickname || p.id.slice(0, 8),
        color: p.color || "#06b6d4",
        alive: p.alive,
        kills: p.kills ?? 0,
        respawnIn: p.respawnAt ? Math.max(0, Math.ceil((p.respawnAt - now) / 1000)) : 0,
      })));
      const me = state.players[myIdRef.current!];
      if (me) setCooldownLeft(Math.max(0, me.hookReadyAt - now));
      setChargeLevel(hookChargeStartRef.current !== null
        ? Math.min(1, (Date.now() - hookChargeStartRef.current) / MAX_CHARGE_TIME)
        : 0);
    }

    // ── Client prediction ─────────────────────────────────────────────────
    function predictStep() {
      const myId = myIdRef.current;
      const state = stateRef.current;
      if (!myId || !state) return;
      const me = state.players[myId];
      if (!me?.alive) return;

      // Hook extending outward → server zeroes velocity, don't move locally
      if (me.hook && !me.hook.returning) {
        if (serverPosRef.current) {
          predictedPosRef.current.x += (serverPosRef.current.x - predictedPosRef.current.x) * 0.3;
          predictedPosRef.current.y += (serverPosRef.current.y - predictedPosRef.current.y) * 0.3;
        }
        return;
      }

      // Replicate server movement with current inputs
      let vx = 0, vy = 0;
      if (keysRef.current["w"]) vy--;
      if (keysRef.current["s"]) vy++;
      if (keysRef.current["a"]) vx--;
      if (keysRef.current["d"]) vx++;
      const vlen = Math.sqrt(vx * vx + vy * vy);
      if (vlen > 0) { vx /= vlen; vy /= vlen; }

      let sf = 1.0;
      if (hookChargeStartRef.current !== null) {
        const ct = Math.min(1, (Date.now() - hookChargeStartRef.current) / CHARGE_RAMP_TIME);
        sf = 1.0 - (1.0 - CHARGING_SPEED_MIN) * ct;
      }

      const pred = predictedPosRef.current;
      pred.x = Math.max(PLAYER_RADIUS, Math.min(MAP_SIZE - PLAYER_RADIUS, pred.x + vx * sf * SPEED));
      pred.y = Math.max(PLAYER_RADIUS, Math.min(MAP_SIZE - PLAYER_RADIUS, pred.y + vy * sf * SPEED));

      // Reconcile with server authority
      if (serverPosRef.current) {
        const dx = serverPosRef.current.x - pred.x;
        const dy = serverPosRef.current.y - pred.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > RECONCILE_SNAP) {
          predictedPosRef.current = { x: serverPosRef.current.x, y: serverPosRef.current.y };
        } else if (dist > 1) {
          pred.x += dx * 0.3;
          pred.y += dy * 0.3;
        }
      }
    }

    // ── State interpolation for remote players ─────────────────────────────
    function getInterpPlayers(): Record<string, any> {
      const buf = stateBufferRef.current;
      if (buf.length === 0) return stateRef.current?.players ?? {};

      const renderTime = Date.now() - INTERP_DELAY_MS;

      // Find the two samples that bracket renderTime
      let lo = buf[0];
      let hi = buf[buf.length - 1];
      for (let i = 0; i < buf.length - 1; i++) {
        if (buf[i].t <= renderTime) lo = buf[i];
        if (buf[i + 1].t >= renderTime) { hi = buf[i + 1]; break; }
      }

      if (renderTime <= lo.t) return lo.players;
      if (renderTime >= hi.t) return hi.players;

      const alpha = (renderTime - lo.t) / (hi.t - lo.t);
      const result: Record<string, any> = {};
      for (const id of Object.keys(hi.players)) {
        const pH = hi.players[id];
        const pL = lo.players[id] ?? pH;
        const pos = {
          x: pL.position.x + (pH.position.x - pL.position.x) * alpha,
          y: pL.position.y + (pH.position.y - pL.position.y) * alpha,
        };
        const hook = (pH.hook && pL.hook)
          ? { ...pH.hook, position: {
              x: pL.hook.position.x + (pH.hook.position.x - pL.hook.position.x) * alpha,
              y: pL.hook.position.y + (pH.hook.position.y - pL.hook.position.y) * alpha,
            }}
          : pH.hook;
        result[id] = { ...pH, position: pos, hook };
      }
      return result;
    }

    // ── Main render loop ──────────────────────────────────────────────────
    function render() {
      timeRef.current += 0.016;
      const time = timeRef.current;

      ctx.clearRect(0, 0, 800, 800);

      // Drifting grid
      const drift = (time * 8) % 40;
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let i = -40; i < 840; i += 40) {
        ctx.beginPath(); ctx.moveTo(i + drift, 0); ctx.lineTo(i + drift, 800); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i + drift); ctx.lineTo(800, i + drift); ctx.stroke();
      }

      predictStep();
      updateInput();
      const state = stateRef.current;
      const myId = myIdRef.current;

      if (state) {
        // Interpolated state for all players
        const displayPlayers = getInterpPlayers();

        // Override own player's position with client prediction
        if (myId && displayPlayers[myId]?.alive) {
          displayPlayers[myId] = { ...displayPlayers[myId], position: { ...predictedPosRef.current } };
        }

        // Detect deaths → spawn particles (server-authoritative)
        for (const [id, p] of Object.entries(state.players) as [string, any][]) {
          if (prevAliveRef.current[id] === true && !p.alive) {
            spawnParticles(p.position.x, p.position.y, p.color || "#06b6d4");
          }
          prevAliveRef.current[id] = p.alive;
        }

        // Hooks (draw before players; position already merged with prediction)
        Object.values(displayPlayers).forEach((p: any) => {
          if (!p.hook) return;
          const color = p.color || "#06b6d4";
          drawRopeWire(p.position.x, p.position.y, p.hook.position.x, p.hook.position.y, time, color);
          drawHookTip(p.hook.position.x, p.hook.position.y, time, color);
        });

        // Players
        Object.values(displayPlayers).forEach((p: any) => {
          drawPlayer(p, p.id === myId, time);
        });
      }

      drawParticles();
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
  }, [screen]);

  // ── Handlers ──────────────────────────────────────────────────────────
  function handleCreateRoom() {
    const sock = socketRef.current;
    if (!sock || sock.readyState !== WebSocket.OPEN) return;
    setErrorMsg("");
    sock.send(JSON.stringify({
      type: "create_room",
      name: createRoomName.trim() || `${nickname}'s Room`,
      isPrivate: isPrivateCreate,
      nickname,
      color: selectedColor,
    }));
  }

  function handleJoinRoom(roomId: string) {
    const sock = socketRef.current;
    if (!sock || sock.readyState !== WebSocket.OPEN) return;
    setErrorMsg("");
    sock.send(JSON.stringify({
      type: "join_room",
      roomId,
      nickname,
      color: selectedColor,
    }));
  }

  function handleLeaveRoom() {
    const sock = socketRef.current;
    if (!sock || sock.readyState !== WebSocket.OPEN) return;
    sock.send(JSON.stringify({ type: "leave_room" }));
  }

  const cooldownProgress = cooldownLeft / HOOK_COOLDOWN;
  const isReady = cooldownLeft === 0;

  // ── Menu screen ───────────────────────────────────────────────────────
  if (screen === "menu") {
    return (
      <div className="min-h-screen w-screen bg-[#09090b] text-zinc-100 font-sans overflow-auto flex flex-col items-center py-10 px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,#164e63_0%,transparent_55%)] opacity-20 pointer-events-none" />

        {/* Header */}
        <div className="relative w-full max-w-2xl mb-8 flex items-center justify-between">
          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            PUDGE WARS
          </h1>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md text-xs font-bold tracking-widest uppercase transition-colors ${
            connectionStatus === "Online"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${connectionStatus === "Online" ? "bg-emerald-400" : "bg-red-400"}`} />
            {connectionStatus}
          </div>
        </div>

        {/* 2-column grid */}
        <div className="relative w-full max-w-2xl grid grid-cols-2 gap-4 mb-4">
          {/* Left: Identity */}
          <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
            <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold">Identity</h2>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Nickname</label>
              <input
                value={nickname}
                onChange={e => setNickname(e.target.value.slice(0, 20))}
                placeholder="Enter nickname"
                className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-zinc-400 font-medium">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      selectedColor === c
                        ? "border-white scale-110 shadow-lg"
                        : "border-transparent hover:border-white/40 hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right: Create room */}
          <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
            <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold">Create Room</h2>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Room Name</label>
              <input
                value={createRoomName}
                onChange={e => setCreateRoomName(e.target.value.slice(0, 30))}
                placeholder={`${nickname || "Player"}'s Room`}
                className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setIsPrivateCreate(v => !v)}
                className={`w-10 h-5 rounded-full transition-colors relative ${isPrivateCreate ? "bg-cyan-500" : "bg-zinc-700"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isPrivateCreate ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
              <span className="text-sm text-zinc-300">Private room</span>
            </label>
            <button
              onClick={handleCreateRoom}
              disabled={connectionStatus !== "Online"}
              className="mt-auto bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-2 rounded-lg text-sm transition-colors"
            >
              Create &amp; Play
            </button>
          </div>
        </div>

        {/* Join by code */}
        <div className="relative w-full max-w-2xl bg-zinc-900/80 border border-white/10 rounded-2xl p-5 mb-4">
          <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold mb-3">Join by Code</h2>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 uppercase tracking-widest font-mono outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
            />
            <button
              onClick={() => handleJoinRoom(joinCode)}
              disabled={joinCode.length < 4 || connectionStatus !== "Online"}
              className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors"
            >
              Join
            </button>
          </div>
          {errorMsg && (
            <p className="mt-2 text-xs text-red-400">{errorMsg}</p>
          )}
        </div>

        {/* Open rooms list */}
        <div className="relative w-full max-w-2xl bg-zinc-900/80 border border-white/10 rounded-2xl p-5">
          <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold mb-3">
            Open Rooms
            <span className="ml-2 text-zinc-700">{openRooms.length}</span>
          </h2>
          {openRooms.length === 0 ? (
            <p className="text-sm text-zinc-600">No open rooms. Create one!</p>
          ) : (
            <div className="flex flex-col gap-2">
              {openRooms.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-zinc-800/60 rounded-lg px-4 py-2.5">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-zinc-200">{r.name}</span>
                    <span className="text-xs text-zinc-500 font-mono">{r.id} · {r.playerCount} player{r.playerCount !== 1 ? "s" : ""}</span>
                  </div>
                  <button
                    onClick={() => handleJoinRoom(r.id)}
                    disabled={connectionStatus !== "Online"}
                    className="bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 text-xs font-bold px-4 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 text-zinc-700 text-[10px] uppercase tracking-[0.3em] font-medium">
          Pudge Wars v2.0 · Alpha
        </div>
      </div>
    );
  }

  // ── Game screen ────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-cyan-500/30 overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#164e63_0%,transparent_50%)] opacity-20 pointer-events-none" />

      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000" />

        <canvas
          ref={canvasRef}
          width={800}
          height={800}
          className="relative bg-zinc-950/90 border border-white/10 rounded-xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-3xl"
        />

        {/* TOP OVERLAY */}
        <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
          {/* Left: leave + connection + room chip */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleLeaveRoom}
              className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-zinc-900/80 border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20 text-xs font-bold tracking-widest uppercase transition-colors backdrop-blur-md"
            >
              ← Leave
            </button>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md transition-colors ${
              connectionStatus === "Online"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${connectionStatus === "Online" ? "bg-emerald-400" : "bg-red-400"}`} />
              <span className="text-xs font-bold tracking-widest uppercase">{connectionStatus}</span>
            </div>
            {currentRoomId && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-zinc-900/60 border-white/10 backdrop-blur-md">
                <span className="text-xs font-mono text-zinc-400 tracking-widest">{currentRoomId}</span>
                {isCurrentRoomPrivate && (
                  <span className="text-[9px] uppercase font-bold tracking-wider text-amber-400 bg-amber-400/10 px-1.5 rounded-full border border-amber-400/20">
                    Private
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: scoreboard */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl min-w-[220px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">Scoreboard</h3>
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Kills</span>
            </div>
            <div className="space-y-2">
              {playersHUD.map((p, i) => {
                const isMe = p.id === myIdRef.current;
                return (
                  <div key={p.id} className={`flex items-center justify-between gap-3 transition-opacity ${p.alive ? "opacity-100" : "opacity-40"}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-zinc-600 w-3">{i + 1}</span>
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: p.color, boxShadow: `0 0 6px ${p.color}` }}
                      />
                      <span className={`text-sm font-medium ${isMe ? "text-cyan-400" : "text-zinc-300"}`}>
                        {isMe ? `${p.nickname} (you)` : p.nickname}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!p.alive && p.respawnIn !== undefined && p.respawnIn > 0 && (
                        <span className="text-[10px] font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500">
                          {p.respawnIn}s
                        </span>
                      )}
                      <span className={`text-sm font-black tabular-nums w-6 text-right ${p.kills > 0 ? (isMe ? "text-cyan-400" : "text-zinc-200") : "text-zinc-600"}`}>
                        {p.kills}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* BOTTOM OVERLAY */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-4 pointer-events-none">
          <div className="relative group/skill pointer-events-auto">
            <div className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center transition-all duration-300 ${
              chargeLevel > 0
                ? "bg-amber-500/10 border-amber-500/60 shadow-[0_0_20px_rgba(251,191,36,0.25)]"
                : isReady
                ? "bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                : "bg-zinc-900 border-zinc-800"
            }`}>
              {chargeLevel > 0 ? (
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                  <circle
                    cx="40" cy="40" r="34" fill="none"
                    stroke="#fbbf24" strokeWidth="4"
                    strokeDasharray={213.6}
                    strokeDashoffset={213.6 * (1 - chargeLevel)}
                  />
                </svg>
              ) : !isReady ? (
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                  <circle
                    cx="40" cy="40" r="34" fill="none"
                    stroke="#22d3ee" strokeWidth="4"
                    strokeDasharray={213.6}
                    strokeDashoffset={213.6 * (1 - cooldownProgress)}
                    className="transition-all duration-100 ease-linear"
                  />
                </svg>
              ) : null}
              <div className="flex flex-col items-center">
                <span className={`text-2xl font-black ${chargeLevel > 0 ? "text-amber-400" : isReady ? "text-cyan-400" : "text-zinc-600"}`}>Q</span>
                <span className="text-[9px] uppercase font-bold tracking-tighter opacity-60">
                  {chargeLevel > 0 ? "CHARGE" : "Hook"}
                </span>
              </div>
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/skill:opacity-100 transition-opacity whitespace-nowrap border border-white/10">
                Hold to charge · release to fire
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-zinc-100 text-black text-[10px] font-black px-1.5 rounded border-2 border-[#09090b]">
              Q
            </div>
          </div>

          <div className="mb-2 px-4 py-2 bg-black/40 backdrop-blur-md border border-white/5 rounded-full flex gap-3 items-center">
            <div className="flex gap-1">
              {['W','A','S','D'].map(k => (
                <div key={k} className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold border border-white/10 bg-white/5">
                  {k}
                </div>
              ))}
            </div>
            <div className="h-4 w-[1px] bg-white/10" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Move</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-6 text-zinc-600 text-[10px] uppercase tracking-[0.3em] font-medium">
        Pudge Wars v2.0 · Alpha
      </div>
    </div>
  );
}
