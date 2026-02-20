"use client";

import { COLOR_SWATCHES } from "../lib/constants";
import type { RoomInfo } from "../types/game";

interface Props {
  connectionStatus: string;
  nickname: string;
  setNickname: (v: string) => void;
  selectedColor: string;
  setSelectedColor: (v: string) => void;
  createRoomName: string;
  setCreateRoomName: (v: string) => void;
  isPrivateCreate: boolean;
  setIsPrivateCreate: (v: boolean) => void;
  joinCode: string;
  setJoinCode: (v: string) => void;
  errorMsg: string;
  openRooms: RoomInfo[];
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
}

export default function MenuScreen({
  connectionStatus,
  nickname,
  setNickname,
  selectedColor,
  setSelectedColor,
  createRoomName,
  setCreateRoomName,
  isPrivateCreate,
  setIsPrivateCreate,
  joinCode,
  setJoinCode,
  errorMsg,
  openRooms,
  onCreateRoom,
  onJoinRoom,
}: Props) {
  const isOnline = connectionStatus === "Online";

  return (
    <div className="min-h-screen w-screen bg-[#09090b] text-zinc-100 font-sans overflow-auto flex flex-col items-center py-10 px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,#164e63_0%,transparent_55%)] opacity-20 pointer-events-none" />

      {/* Header */}
      <div className="relative w-full max-w-2xl mb-8 flex items-center justify-between">
        <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          PUDGE WARS
        </h1>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md text-xs font-bold tracking-widest uppercase transition-colors ${
            isOnline
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          <div className={`w-2 h-2 rounded-full animate-pulse ${isOnline ? "bg-emerald-400" : "bg-red-400"}`} />
          {connectionStatus}
        </div>
      </div>

      {/* 2-column grid */}
      <div className="relative w-full max-w-2xl grid grid-cols-2 gap-4 mb-4">
        {/* Left: Identity */}
        <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold">Identity</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400 font-medium">Nickname</label>
            <input
              value={nickname}
              onChange={e => setNickname(e.target.value.slice(0, 20))}
              placeholder="Enter nickname"
              className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-zinc-400 font-medium">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedColor(c)}
                  className={`w-8 h-8 rounded-lg cursor-pointer border-2 transition-all ${
                    selectedColor === c
                      ? "border-white scale-110 shadow-lg"
                      : "border-transparent hover:border-white/40 hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Create room */}
        <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold">Create Room</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400 font-medium">Room Name</label>
            <input
              value={createRoomName}
              onChange={e => setCreateRoomName(e.target.value.slice(0, 30))}
              placeholder={`${nickname || "Player"}'s Room`}
              className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setIsPrivateCreate(!isPrivateCreate)}
              className={`w-10 h-5 rounded-full transition-colors relative ${isPrivateCreate ? "bg-cyan-500" : "bg-zinc-700"}`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  isPrivateCreate ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-sm text-zinc-300">Private room</span>
          </label>
          <button
            onClick={onCreateRoom}
            disabled={!isOnline}
            className="mt-auto cursor-pointer bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-2 rounded-lg text-sm transition-colors"
          >
            Create &amp; Play
          </button>
        </div>
      </div>

      {/* Join by code */}
      <div className="relative w-full max-w-2xl bg-zinc-900/80 border border-white/10 rounded-2xl p-5 mb-4">
        <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold mb-3">Join by Code</h2>
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="ABC123"
            className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 uppercase tracking-widest font-mono outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
          />
          <button
            onClick={() => onJoinRoom(joinCode)}
            disabled={joinCode.length < 4 || !isOnline}
            className="bg-zinc-700 cursor-pointer hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors"
          >
            Join
          </button>
        </div>
        {errorMsg && <p className="mt-2 text-xs text-red-400">{errorMsg}</p>}
      </div>

      {/* Open rooms list */}
      <div className="relative w-full max-w-2xl bg-zinc-900/80 border border-white/10 rounded-2xl p-5">
        <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold mb-3">
          Open Rooms
          <span className="ml-2 text-zinc-700">{openRooms.length}</span>
        </h2>
        {openRooms.length === 0 ? (
          <p className="text-sm text-zinc-600">No open rooms. Create one!</p>
        ) : (
          <div className="flex flex-col gap-2">
            {openRooms.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-zinc-800/60 rounded-lg px-4 py-2.5">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-zinc-200">{r.name}</span>
                  <span className="text-xs text-zinc-500 font-mono">
                    {r.id} · {r.playerCount} player{r.playerCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <button
                  onClick={() => onJoinRoom(r.id)}
                  disabled={!isOnline}
                  className="bg-cyan-500/20 cursor-pointer hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 text-xs font-bold px-4 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 text-zinc-700 text-[10px] uppercase tracking-[0.3em] font-medium">
        Pudge Wars v2.0 · Alpha
      </div>
    </div>
  );
}
