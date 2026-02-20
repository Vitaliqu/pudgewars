export interface Vector {
    x: number;
    y: number;
}

export interface Hook {
    position: Vector;
    direction: Vector;
    speed: number;
    ownerId: string;
    returning: boolean;
    hookedPlayerId?: string;
    collisionPoint?: Vector;
}

export interface Player {
    id: string;
    position: Vector;
    velocity: Vector;
    hook: Hook | null;
    hookReadyAt: number;
}

export interface GameState {
    players: Record<string, Player>;
    serverTime: number;
}
