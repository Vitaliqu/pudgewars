import { HOOK_SPEED, HOOK_MAX_DISTANCE, PLAYER_RADIUS, MAP_SIZE, RESPAWN_TIME } from "./constants";
import { clamp, distance, normalize, randomPosition } from "./utils";
import type { Player, Room } from "./types";

export function updateMovement(player: Player, speed: number) {
    if (!player.alive) return;

    player.position.x += player.velocity.x * speed;
    player.position.y += player.velocity.y * speed;

    player.position.x = clamp(player.position.x, PLAYER_RADIUS, MAP_SIZE - PLAYER_RADIUS);
    player.position.y = clamp(player.position.y, PLAYER_RADIUS, MAP_SIZE - PLAYER_RADIUS);
}

export function updateHook(player: Player, roomPlayers: Record<string, Player>) {
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
        const toOwner = normalize({
            x: player.position.x - hook.position.x,
            y: player.position.y - hook.position.y,
        });
        hook.position.x += toOwner.x * HOOK_SPEED;
        hook.position.y += toOwner.y * HOOK_SPEED;

        if (hook.hookedPlayerId) {
            const target = roomPlayers[hook.hookedPlayerId];
            const owner = roomPlayers[hook.ownerId];
            if (target && owner) {
                const toOwnerVec = {
                    x: owner.position.x - target.position.x,
                    y: owner.position.y - target.position.y,
                };
                const distToOwner = distance(target.position, owner.position);
                const moveDist = Math.min(HOOK_SPEED, distToOwner);
                const dir = normalize(toOwnerVec);
                if (!target.alive) {
                    target.position.x += dir.x * moveDist;
                    target.position.y += dir.y * moveDist;
                } else {
                    hook.position.x = owner.position.x;
                    hook.position.y = owner.position.y;
                }
            }
        }

        if (distance(hook.position, player.position) < 10) {
            player.hook = null;
        }
    }
}

export function respawnPlayers(room: Room) {
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
