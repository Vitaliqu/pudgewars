import { WebSocket } from "ws";
import { generateRoomId, randomPosition } from "./utils";
import type { Player, Room, RoomInfo } from "./types";

// ===== Shared state =====
export const rooms: Record<string, Room> = {};
export const wsToId = new Map<WebSocket, string>();
export const idToWs = new Map<string, WebSocket>();
export const idToRoom = new Map<string, string>();

// ===== Helpers =====
export function roomInfo(r: Room): RoomInfo {
    return {
        id: r.id,
        name: r.name,
        isPrivate: r.isPrivate,
        playerCount: Object.keys(r.players).length,
    };
}

export function makeRoom(name: string, isPrivate: boolean, ownerId: string): Room {
    let id: string;
    do {
        id = generateRoomId();
    } while (rooms[id]);

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

export function createPlayer(playerId: string, nickname: string, color: string): Player {
    return {
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
}

export function removePlayerFromRoom(playerId: string) {
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

export function broadcastRoomList() {
    const list = Object.values(rooms)
        .filter(r => !r.isPrivate)
        .map(roomInfo);

    const msg = JSON.stringify({ type: "room_list", rooms: list });

    for (const [ws, playerId] of wsToId.entries()) {
        if (!idToRoom.has(playerId) && ws.readyState === 1) {
            ws.send(msg);
        }
    }
}
