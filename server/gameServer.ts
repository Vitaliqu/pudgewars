import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";
import { PORT, TICK, SPEED } from "./constants";
import { rooms, wsToId, idToWs, idToRoom, removePlayerFromRoom, broadcastRoomList, roomInfo } from "./roomManager";
import { updateMovement, updateHook, respawnPlayers } from "./physics";
import { handleMessage } from "./messageHandler";

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
    const id = randomUUID();
    wsToId.set(ws, id);
    idToWs.set(id, ws);

    ws.send(JSON.stringify({ type: "init", id }));

    const list = Object.values(rooms)
        .filter(r => !r.isPrivate)
        .map(roomInfo);
    ws.send(JSON.stringify({ type: "room_list", rooms: list }));

    ws.on("message", (msg) => handleMessage(ws, msg.toString()));

    ws.on("close", () => {
        const pid = wsToId.get(ws);
        if (!pid) return;
        removePlayerFromRoom(pid);
        wsToId.delete(ws);
        idToWs.delete(pid);
        broadcastRoomList();
    });
});

function gameLoop() {
    for (const room of Object.values(rooms)) {
        room.serverTime = Date.now();

        for (const player of Object.values(room.players)) {
            updateMovement(player, SPEED);
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
