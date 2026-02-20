interface Props {
  cooldownLeft: number;
  cooldownProgress: number;
  chargeLevel: number;
  isReady: boolean;
}

export default function SkillBar({ cooldownLeft: _cooldownLeft, cooldownProgress, chargeLevel, isReady }: Props) {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-4 pointer-events-none">
      <div className="relative group/skill pointer-events-auto">
        <div
          className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center transition-all duration-300 ${
            chargeLevel > 0
              ? "bg-amber-500/10 border-amber-500/60 shadow-[0_0_20px_rgba(251,191,36,0.25)]"
              : isReady
              ? "bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.2)]"
              : "bg-zinc-900 border-zinc-800"
          }`}
        >
          {chargeLevel > 0 ? (
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
              <circle
                cx="40" cy="40" r="34" fill="none"
                stroke="#fbbf24" strokeWidth="4"
                strokeDasharray={213.6}
                strokeDashoffset={213.6 * (1 - chargeLevel)}
              />
            </svg>
          ) : !isReady ? (
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
              <circle
                cx="40" cy="40" r="34" fill="none"
                stroke="#22d3ee" strokeWidth="4"
                strokeDasharray={213.6}
                strokeDashoffset={213.6 * (1 - cooldownProgress)}
                className="transition-all duration-100 ease-linear"
              />
            </svg>
          ) : null}
          <div className="flex flex-col items-center">
            <span className={`text-2xl font-black ${chargeLevel > 0 ? "text-amber-400" : isReady ? "text-cyan-400" : "text-zinc-600"}`}>
              Q
            </span>
            <span className="text-[9px] uppercase font-bold tracking-tighter opacity-60">
              {chargeLevel > 0 ? "CHARGE" : "Hook"}
            </span>
          </div>
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/skill:opacity-100 transition-opacity whitespace-nowrap border border-white/10">
            Hold to charge · release to fire
          </div>
        </div>
        <div className="absolute -bottom-2 -right-2 bg-zinc-100 text-black text-[10px] font-black px-1.5 rounded border-2 border-[#09090b]">
          Q
        </div>
      </div>

      <div className="mb-2 px-4 py-2 bg-black/40 backdrop-blur-md border border-white/5 rounded-full flex gap-3 items-center">
        <div className="flex gap-1">
          {["W", "A", "S", "D"].map(k => (
            <div
              key={k}
              className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold border border-white/10 bg-white/5"
            >
              {k}
            </div>
          ))}
        </div>
        <div className="h-4 w-[1px] bg-white/10" />
        <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Move</span>
      </div>
    </div>
  );
}
