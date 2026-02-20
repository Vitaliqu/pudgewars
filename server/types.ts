export interface Vec2 {
    x: number;
    y: number;
}

export interface Hook {
    position: Vec2;
    direction: Vec2;
    speed: number;
    ownerId: string;
    returning: boolean;
    hookedPlayerId?: string;
}

export interface Player {
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
    ping?: number;
}

export interface Room {
    id: string;
    name: string;
    isPrivate: boolean;
    ownerId: string;
    players: Record<string, Player>;
    serverTime: number;
}

export interface RoomInfo {
    id: string;
    name: string;
    isPrivate: boolean;
    playerCount: number;
}
