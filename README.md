# Pudge Wars

Real-time multiplayer hook combat arena built with Next.js + WebSocket.

## Stack
- **Frontend** — Next.js 16 (App Router), React 19, Tailwind CSS v4, Canvas 2D
- **Backend** — Node.js WebSocket server (`ws`), TypeScript via `ts-node`

## Running locally

```bash
# Terminal 1 — game server (port 3001)
npm run game

# Terminal 2 — Next.js dev server (port 3000)
npm run dev
```

Open http://localhost:3000, set a nickname + color, create or join a room.

## Controls
| Input | Action |
|-------|--------|
| W A S D | Move |
| Q | Cast hook toward cursor |

## Project structure
```
pudgewars/
  app/
    page.tsx      # Menu + game canvas (client component)
    layout.tsx
    globals.css
  server/
    gameServer.ts # WebSocket game server (64 Hz tick)
```

## Deploying

> The project has **two parts** that must be hosted separately.

### Frontend → Vercel (free)
1. Push the repo to GitHub
2. Import the project on [vercel.com/new](https://vercel.com/new)
3. Set **Root Directory** to `pudgewars`
4. Add env var: `NEXT_PUBLIC_WS_URL=wss://your-server-host.com`
5. Deploy — Vercel handles the Next.js build automatically

Update the WebSocket URL in `page.tsx`:
```ts
const socket = new WebSocket(process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001");
```

### Game server → Railway / Render / Fly.io (cheapest options)
The `server/gameServer.ts` is a plain Node.js process — it **cannot** run on Vercel (no persistent connections).

**Railway (recommended — free tier available):**
1. New project → Deploy from GitHub repo
2. Set start command: `npx ts-node server/gameServer.ts`
3. Set root directory to `pudgewars`
4. Expose port `3001`
5. Copy the generated public URL and set it as `NEXT_PUBLIC_WS_URL` on Vercel

**Render:**
- New Web Service → Docker or Node → same start command as above

**Fly.io:**
- `fly launch` from `pudgewars/`, set `PORT=3001`, deploy
