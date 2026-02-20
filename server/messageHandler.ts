import { WebSocket } from "ws";
import { HOOK_COOLDOWN, HOOK_SPEED, HOOK_SPEED_MAX, MAX_CHARGE_TIME } from "./constants";
import { normalize } from "./utils";
import {
    rooms,
    wsToId,
    idToWs,
    idToRoom,
    makeRoom,
    createPlayer,
    removePlayerFromRoom,
    broadcastRoomList,
    roomInfo,
} from "./roomManager";

export function handleMessage(ws: WebSocket, raw: string) {
    let data: any;
    try {
        data = JSON.parse(raw);
    } catch {
        return;
    }

    const playerId = wsToId.get(ws);
    if (!playerId) return;

    // ===== PING =====
    if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", t: data.t }));
        const rId = idToRoom.get(playerId);
        if (rId && rooms[rId]?.players[playerId] && typeof data.rtt === "number") {
            rooms[rId].players[playerId].ping = data.rtt;
        }
        return;
    }

    // ===== CREATE ROOM =====
    if (data.type === "create_room") {
        if (idToRoom.has(playerId)) return;

        const nickname = String(data.nickname || "Player").slice(0, 20);
        const color = String(data.color || "#06b6d4");

        const room = makeRoom(data.name || "", !!data.isPrivate, playerId);
        const player = createPlayer(playerId, nickname, color);
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

        const player = createPlayer(playerId, nickname, color);
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
}
