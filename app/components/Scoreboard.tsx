import type { PlayerHUD } from "../types/game";

interface Props {
  players: PlayerHUD[];
  myId: string | null;
}

export default function Scoreboard({ players, myId }: Props) {
  return (
    <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl min-w-[220px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">Scoreboard</h3>
        <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Kills</span>
      </div>
      <div className="space-y-2">
        {players.map((p, i) => {
          const isMe = p.id === myId;
          return (
            <div
              key={p.id}
              className={`flex items-center justify-between gap-3 transition-opacity ${p.alive ? "opacity-100" : "opacity-40"}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-600 w-3">{i + 1}</span>
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.color, boxShadow: `0 0 6px ${p.color}` }}
                />
                <span className={`text-sm font-medium ${isMe ? "text-cyan-400" : "text-zinc-300"}`}>
                  {isMe ? `${p.nickname} (you)` : p.nickname}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!p.alive && p.respawnIn !== undefined && p.respawnIn > 0 && (
                  <span className="text-[10px] font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500">
                    {p.respawnIn}s
                  </span>
                )}
                {p.ping !== undefined && p.ping > 0 && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded tabular-nums ${
                      p.ping < 60
                        ? "text-emerald-400"
                        : p.ping < 120
                        ? "text-amber-400"
                        : "text-red-400"
                    }`}
                  >
                    {p.ping}ms
                  </span>
                )}
                <span
                  className={`text-sm font-black tabular-nums w-6 text-right ${
                    p.kills > 0 ? (isMe ? "text-cyan-400" : "text-zinc-200") : "text-zinc-600"
                  }`}
                >
                  {p.kills}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
