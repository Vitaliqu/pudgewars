import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";

const PORT = 3001;
const TICK_RATE = 64;
const TICK = 1000 / TICK_RATE;

const MAP_SIZE = 800;
const PLAYER_RADIUS = 20;

const SPEED = 5;
const HOOK_SPEED = 5;
const HOOK_MAX_DISTANCE = 500;
const HOOK_COOLDOWN = 3000;
const HOOK_SPEED_MAX = 20;
const MAX_CHARGE_TIME = 1500;
const RESPAWN_TIME = 5000;

interface Vec2 { x: number; y: number; }
interface Hook {
    position: Vec2;
    direction: Vec2;
    speed: number;
    ownerId: string;
    returning: boolean;
    hookedPlayerId?: string;
}
interface Player {
    id: string;
    nickname: string;
    color: string;
    position: Vec2;
    velocity: Vec2;
    hook: Hook | null;
    hookReadyAt: number;
    alive: boolean;
    kills: number;
    respawnAt?: number;
}
interface Room {
    id: string;
    name: string;
    isPrivate: boolean;
    ownerId: string;
    players: Record<string, Player>;
    serverTime: number;
}
interface RoomInfo {
    id: string;
    name: string;
    isPrivate: boolean;
    playerCount: number;
}

// ===== State =====
const rooms: Record<string, Room> = {};
const wsToId  = new Map<WebSocket, string>();
const idToWs  = new Map<string, WebSocket>();
const idToRoom = new Map<string, string>();

// ===== Utils =====
function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}
function distance(a: Vec2, b: Vec2) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
function normalize(v: Vec2): Vec2 {
    const len = Math.sqrt(v.x ** 2 + v.y ** 2);
    return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}
function randomPosition(): Vec2 {
    return {
        x: PLAYER_RADIUS + Math.random() * (MAP_SIZE - 2 * PLAYER_RADIUS),
        y: PLAYER_RADIUS + Math.random() * (MAP_SIZE - 2 * PLAYER_RADIUS),
    };
}
function generateRoomId(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let id = "";
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

// ===== Room helpers =====
function roomInfo(r: Room): RoomInfo {
    return { id: r.id, name: r.name, isPrivate: r.isPrivate, playerCount: Object.keys(r.players).length };
}

function makeRoom(name: string, isPrivate: boolean, ownerId: string): Room {
    let id: string;
    do { id = generateRoomId(); } while (rooms[id]);

    const room: Room = {
        id,
        name: name.trim() || `Room ${id}`,
        isPrivate,
        ownerId,
        players: {},
        serverTime: Date.now(),
    };

    rooms[id] = room;
    return room;
}

function broadcastRoomList() {
    const list = Object.values(rooms)
        .filter(r => !r.isPrivate)
        .map(roomInfo);

    const msg = JSON.stringify({ type: "room_list", rooms: list });

    // Send only to clients NOT in a room
    for (const [ws, playerId] of wsToId.entries()) {
        if (!idToRoom.has(playerId) && ws.readyState === 1) {
            ws.send(msg);
        }
    }
}

function removePlayerFromRoom(playerId: string) {
    const roomId = idToRoom.get(playerId);
    if (!roomId) return;
    const room = rooms[roomId];
    if (!room) return;

    delete room.players[playerId];
    idToRoom.delete(playerId);

        if (Object.keys(room.players).length === 0) {
        delete rooms[roomId];
    }
}

// ===== WebSocket server =====
const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
    const id = randomUUID();
    wsToId.set(ws, id);
    idToWs.set(id, ws);

    ws.send(JSON.stringify({ type: "init", id }));

    // Send current public room list
    const list = Object.values(rooms)
        .filter(r => !r.isPrivate)
        .map(roomInfo);
    ws.send(JSON.stringify({ type: "room_list", rooms: list }));

    ws.on("message", (msg) => {
        let data: any;
        try { data = JSON.parse(msg.toString()); } catch { return; }

        const playerId = wsToId.get(ws);
        if (!playerId) return;

        // ===== CREATE ROOM =====
        if (data.type === "create_room") {
            if (idToRoom.has(playerId)) return; // already in a room

            const nickname = String(data.nickname || "Player").slice(0, 20);
            const color = String(data.color || "#06b6d4");

            const room = makeRoom(data.name || "", !!data.isPrivate, playerId);

            const player: Player = {
                id: playerId,
                nickname,
                color,
                position: randomPosition(),
                velocity: { x: 0, y: 0 },
                hook: null,
                hookReadyAt: 0,
                alive: true,
                kills: 0,
            };
            room.players[playerId] = player;
            idToRoom.set(playerId, room.id);

            ws.send(JSON.stringify({ type: "room_joined", roomId: room.id, isPrivate: room.isPrivate }));
            broadcastRoomList();
            return;
        }

        // ===== JOIN ROOM =====
        if (data.type === "join_room") {
            if (idToRoom.has(playerId)) return;

            const code = String(data.roomId || "").toUpperCase().trim();
            const room = rooms[code];
            if (!room) {
                ws.send(JSON.stringify({ type: "error", message: "Room not found. Check your code." }));
                return;
            }

            const nickname = String(data.nickname || "Player").slice(0, 20);
            const color = String(data.color || "#06b6d4");

            const player: Player = {
                id: playerId,
                nickname,
                color,
                position: randomPosition(),
                velocity: { x: 0, y: 0 },
                hook: null,
                hookReadyAt: 0,
                alive: true,
                kills: 0,
            };
            room.players[playerId] = player;
            idToRoom.set(playerId, room.id);

            ws.send(JSON.stringify({ type: "room_joined", roomId: room.id, isPrivate: room.isPrivate }));
            broadcastRoomList();
            return;
        }

        // ===== LEAVE ROOM =====
        if (data.type === "leave_room") {
            removePlayerFromRoom(playerId);
            ws.send(JSON.stringify({ type: "room_left" }));

            // Send updated room list to this client (now in lobby)
            const list = Object.values(rooms)
                .filter(r => !r.isPrivate)
                .map(roomInfo);
            ws.send(JSON.stringify({ type: "room_list", rooms: list }));

            broadcastRoomList();
            return;
        }

        // ===== IN-ROOM ACTIONS =====
        const roomId = idToRoom.get(playerId);
        if (!roomId) return;
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players[playerId];
        if (!player || !player.alive) return;

        // MOVEMENT
        if (data.type === "move") {
            if (!player.hook || player.hook.returning) {
                const dir = normalize(data.direction);
                // client sends a pre-computed smooth factor (0.15–1.0); clamp for safety
                const factor = typeof data.speedFactor === "number"
                    ? Math.max(0.1, Math.min(1.0, data.speedFactor))
                    : 1.0;
                player.velocity = { x: dir.x * factor, y: dir.y * factor };
            }
        }

        // HOOK
        if (data.type === "hook") {
            const now = Date.now();
            if (now < player.hookReadyAt) return;
            if (player.hook) return;

            const dir = normalize(data.direction);
            player.hookReadyAt = now + HOOK_COOLDOWN;

            const chargeTime = Math.min(Math.max(Number(data.chargeTime) || 0, 0), MAX_CHARGE_TIME);
            const t = chargeTime / MAX_CHARGE_TIME;
            const speed = HOOK_SPEED + t * (HOOK_SPEED_MAX - HOOK_SPEED);

            player.hook = {
                position: { ...player.position },
                direction: dir,
                speed,
                ownerId: player.id,
                returning: false,
            };
        }
    });

    ws.on("close", () => {
        const pid = wsToId.get(ws);
        if (!pid) return;
        removePlayerFromRoom(pid);
        wsToId.delete(ws);
        idToWs.delete(pid);
        broadcastRoomList();
    });
});

// ===== Game Loop =====
function updateMovement(player: Player) {
    if (!player.alive) return;

    player.position.x += player.velocity.x * SPEED;
    player.position.y += player.velocity.y * SPEED;

    player.position.x = clamp(player.position.x, PLAYER_RADIUS, MAP_SIZE - PLAYER_RADIUS);
    player.position.y = clamp(player.position.y, PLAYER_RADIUS, MAP_SIZE - PLAYER_RADIUS);
}

function updateHook(player: Player, roomPlayers: Record<string, Player>) {
    if (!player.hook) return;
    const hook = player.hook;

    if (!hook.returning) {
        hook.position.x += hook.direction.x * hook.speed;
        hook.position.y += hook.direction.y * hook.speed;

        player.velocity.x = 0;
        player.velocity.y = 0;

        if (distance(player.position, hook.position) > HOOK_MAX_DISTANCE) {
            hook.returning = true;
        }

        for (const target of Object.values(roomPlayers)) {
            if (target.id === player.id || !target.alive) continue;
            if (distance(hook.position, target.position) < PLAYER_RADIUS) {
                target.alive = false;
                target.respawnAt = Date.now() + RESPAWN_TIME;
                player.kills++;

                hook.returning = true;
                hook.hookedPlayerId = target.id;
                break;
            }
        }

    } else {
        const toOwner = normalize({ x: player.position.x - hook.position.x, y: player.position.y - hook.position.y });
        hook.position.x += toOwner.x * HOOK_SPEED;
        hook.position.y += toOwner.y * HOOK_SPEED;

        if (hook.hookedPlayerId) {
            const target = roomPlayers[hook.hookedPlayerId];
            const owner = roomPlayers[hook.ownerId];
            if (target && owner) {
                const toOwnerVec = { x: owner.position.x - target.position.x, y: owner.position.y - target.position.y };
                const distToOwner = distance(target.position, owner.position);
                const moveDist = Math.min(HOOK_SPEED, distToOwner);
                const dir = normalize(toOwnerVec);

                target.position.x += dir.x * moveDist;
                target.position.y += dir.y * moveDist;
            }
        }

        if (distance(hook.position, player.position) < 10) {
            player.hook = null;
        }
    }
}

function respawnPlayers(room: Room) {
    const now = Date.now();
    for (const player of Object.values(room.players)) {
        if (!player.alive && player.respawnAt && now >= player.respawnAt) {
            player.alive = true;
            player.position = randomPosition();
            player.velocity = { x: 0, y: 0 };
            player.hook = null;
            player.respawnAt = undefined;
            player.hookReadyAt = now;
        }
    }
}

function gameLoop() {
    for (const room of Object.values(rooms)) {
        room.serverTime = Date.now();

        for (const player of Object.values(room.players)) {
            updateMovement(player);
            updateHook(player, room.players);
        }

        respawnPlayers(room);

        const state = JSON.stringify({ players: room.players, serverTime: room.serverTime });
        for (const pid of Object.keys(room.players)) {
            const clientWs = idToWs.get(pid);
            if (clientWs && clientWs.readyState === 1) {
                clientWs.send(state);
            }
        }
    }
}

setInterval(gameLoop, TICK);

console.log(`Game server running on ws://localhost:${PORT}`);
