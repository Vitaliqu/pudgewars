export interface PlayerHUD {
  id: string;
  nickname: string;
  color: string;
  alive: boolean;
  kills: number;
  respawnIn?: number;
  ping?: number;
}

export interface RoomInfo {
  id: string;
  name: string;
  isPrivate: boolean;
  playerCount: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface InputSample {
  t: number;
  vx: number;
  vy: number;
  sf: number;
}

export interface StateSnapshot {
  t: number;
  players: Record<string, any>;
}
