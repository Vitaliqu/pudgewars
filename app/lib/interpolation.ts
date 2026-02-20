import { INTERP_DELAY_MS } from "./constants";
import type { StateSnapshot } from "../types/game";

export function getInterpPlayers(
  stateBuffer: StateSnapshot[],
  fallback: Record<string, any> | null,
  interpDelayMs = INTERP_DELAY_MS
): Record<string, any> {
  if (stateBuffer.length === 0) return fallback ?? {};

  const renderTime = Date.now() - interpDelayMs;

  let lo = stateBuffer[0];
  let hi = stateBuffer[stateBuffer.length - 1];
  for (let i = 0; i < stateBuffer.length - 1; i++) {
    if (stateBuffer[i].t <= renderTime) lo = stateBuffer[i];
    if (stateBuffer[i + 1].t >= renderTime) {
      hi = stateBuffer[i + 1];
      break;
    }
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
    const hook =
      pH.hook && pL.hook
        ? {
            ...pH.hook,
            position: {
              x: pL.hook.position.x + (pH.hook.position.x - pL.hook.position.x) * alpha,
              y: pL.hook.position.y + (pH.hook.position.y - pL.hook.position.y) * alpha,
            },
          }
        : pH.hook;
    result[id] = { ...pH, position: pos, hook };
  }
  return result;
}
