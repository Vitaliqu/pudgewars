import { MAP_SIZE, PLAYER_RADIUS } from "./constants";
import type { Vec2 } from "./types";

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function distance(a: Vec2, b: Vec2): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function normalize(v: Vec2): Vec2 {
    const len = Math.sqrt(v.x ** 2 + v.y ** 2);
    return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

export function randomPosition(): Vec2 {
    return {
        x: PLAYER_RADIUS + Math.random() * (MAP_SIZE - 2 * PLAYER_RADIUS),
        y: PLAYER_RADIUS + Math.random() * (MAP_SIZE - 2 * PLAYER_RADIUS),
    };
}

export function generateRoomId(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let id = "";
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}
