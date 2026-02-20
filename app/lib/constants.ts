// Must mirror server constants
export const MAP_SIZE = 800;
export const PLAYER_RADIUS = 20;
export const SPEED = 10;
export const HOOK_COOLDOWN = 3000;
export const MAX_CHARGE_TIME = 1500;
export const SERVER_TICK_MS = 1000 / 32; // must match server TICK_RATE

export const CHARGE_RAMP_TIME = 500;
export const CHARGING_SPEED_MIN = 0.15;

export const INTERP_DELAY_MS = 80; // render others this far behind real-time (~2.5 server ticks at 32hz)
export const RECONCILE_SNAP = 100; // hard-snap to server if gap exceeds this (px)

export const COLOR_SWATCHES = [
  "#06b6d4", "#ef4444", "#22c55e", "#a855f7",
  "#f97316", "#ec4899", "#eab308", "#f4f4f5",
];
