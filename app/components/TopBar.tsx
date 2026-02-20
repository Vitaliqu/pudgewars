interface Props {
  connectionStatus: string;
  currentRoomId: string | null;
  isCurrentRoomPrivate: boolean;
  onLeave: () => void;
}

export default function TopBar({ connectionStatus, currentRoomId, isCurrentRoomPrivate, onLeave }: Props) {
  const isOnline = connectionStatus === "Online";
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={onLeave}
        className="pointer-events-auto cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-zinc-900/80 border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20 text-xs font-bold tracking-widest uppercase transition-colors backdrop-blur-md"
      >
        ← Leave
      </button>
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md transition-colors ${
          isOnline
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}
      >
        <div className={`w-2 h-2 rounded-full animate-pulse ${isOnline ? "bg-emerald-400" : "bg-red-400"}`} />
        <span className="text-xs font-bold tracking-widest uppercase">{connectionStatus}</span>
      </div>
      {currentRoomId && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-zinc-900/60 border-white/10 backdrop-blur-md">
          <span className="text-xs font-mono text-zinc-400 tracking-widest">{currentRoomId}</span>
          {isCurrentRoomPrivate && (
            <span className="text-[9px] uppercase font-bold tracking-wider text-amber-400 bg-amber-400/10 px-1.5 rounded-full border border-amber-400/20">
              Private
            </span>
          )}
        </div>
      )}
    </div>
  );
}
