"use client";

import { useEffect, useRef, useState } from "react";
import MenuScreen from "./components/MenuScreen";
import GameScreen from "./components/GameScreen";
import type { RoomInfo, InputSample, StateSnapshot } from "./types/game";

export default function Game() {
  // ── Shared refs (written by WS messages, read by GameScreen) ──────────
  const socketRef = useRef<WebSocket | null>(null);
  const myIdRef = useRef<string | null>(null);
  const myPingRef = useRef(0);
  const stateRef = useRef<any>(null);
  const serverSnapshotRef = useRef<{ pos: { x: number; y: number }; t: number } | null>(null);
  const stateBufferRef = useRef<StateSnapshot[]>([]);
  const inputHistoryRef = useRef<InputSample[]>([]);
  const prevAliveRef = useRef<Record<string, boolean>>({});
  // Respawn signal: page writes here, GameScreen reads + clears it
  const respawnAnchorRef = useRef<{ x: number; y: number } | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isCurrentRoomPrivate, setIsCurrentRoomPrivate] = useState(false);

  // Menu state
  const [nickname, setNickname] = useState("Player");
  const [selectedColor, setSelectedColor] = useState("#06b6d4");
  const [openRooms, setOpenRooms] = useState<RoomInfo[]>([]);
  const [createRoomName, setCreateRoomName] = useState("");
  const [isPrivateCreate, setIsPrivateCreate] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // ── WebSocket lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";
    let destroyed = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      if (destroyed) return;
      setConnectionStatus("Connecting...");

      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      let pingInterval: ReturnType<typeof setInterval>;

      socket.onopen = () => {
        setConnectionStatus("Online");
        pingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN)
            socket.send(JSON.stringify({ type: "ping", t: Date.now(), rtt: myPingRef.current }));
        }, 2000);
      };

      socket.onclose = () => {
        setConnectionStatus("Offline");
        setScreen("menu");
        stateRef.current = null;
        clearInterval(pingInterval);
        if (!destroyed) retryTimer = setTimeout(connect, 2000);
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "pong") {
          myPingRef.current = Date.now() - data.t;
          return;
        }

        if (data.type === "init") {
          myIdRef.current = data.id;
          return;
        }

        if (data.type === "room_list") {
          setOpenRooms(data.rooms);
          return;
        }

        if (data.type === "room_joined") {
          setCurrentRoomId(data.roomId);
          setIsCurrentRoomPrivate(data.isPrivate);
          setErrorMsg("");
          // Reset all game state
          stateRef.current = null;
          prevAliveRef.current = {};
          serverSnapshotRef.current = null;
          inputHistoryRef.current = [];
          stateBufferRef.current = [];
          respawnAnchorRef.current = null;
          setScreen("game");
          return;
        }

        if (data.type === "room_left") {
          setCurrentRoomId(null);
          setIsCurrentRoomPrivate(false);
          stateRef.current = null;
          setScreen("menu");
          return;
        }

        if (data.type === "error") {
          setErrorMsg(data.message);
          return;
        }

        // Raw game state blob
        const myId = myIdRef.current;
        if (myId && data.players[myId]) {
          const sm = data.players[myId];
          serverSnapshotRef.current = {
            pos: { x: sm.position.x, y: sm.position.y },
            t: Date.now() - myPingRef.current / 2,
          };
          // Respawn detection (dead → alive transition)
          if (!prevAliveRef.current[myId] && sm.alive) {
            respawnAnchorRef.current = { x: sm.position.x, y: sm.position.y };
            inputHistoryRef.current = [];
          }
        }
        stateBufferRef.current.push({ t: Date.now(), players: data.players });
        if (stateBufferRef.current.length > 40) stateBufferRef.current.shift();
        stateRef.current = data;
      };
    }

    connect();

    return () => {
      destroyed = true;
      clearTimeout(retryTimer);
      socketRef.current?.close();
    };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────
  function handleCreateRoom() {
    const sock = socketRef.current;
    if (!sock || sock.readyState !== WebSocket.OPEN) return;
    setErrorMsg("");
    sock.send(
      JSON.stringify({
        type: "create_room",
        name: createRoomName.trim() || `${nickname}'s Room`,
        isPrivate: isPrivateCreate,
        nickname,
        color: selectedColor,
      })
    );
  }

  function handleJoinRoom(roomId: string) {
    const sock = socketRef.current;
    if (!sock || sock.readyState !== WebSocket.OPEN) return;
    setErrorMsg("");
    sock.send(JSON.stringify({ type: "join_room", roomId, nickname, color: selectedColor }));
  }

  function handleLeaveRoom() {
    const sock = socketRef.current;
    if (!sock || sock.readyState !== WebSocket.OPEN) return;
    sock.send(JSON.stringify({ type: "leave_room" }));
  }

  // ── Screen routing ────────────────────────────────────────────────────
  if (screen === "menu") {
    return (
      <MenuScreen
        connectionStatus={connectionStatus}
        nickname={nickname}
        setNickname={setNickname}
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
        createRoomName={createRoomName}
        setCreateRoomName={setCreateRoomName}
        isPrivateCreate={isPrivateCreate}
        setIsPrivateCreate={setIsPrivateCreate}
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        errorMsg={errorMsg}
        openRooms={openRooms}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
      />
    );
  }

  return (
    <GameScreen
      socketRef={socketRef}
      myIdRef={myIdRef}
      myPingRef={myPingRef}
      serverSnapshotRef={serverSnapshotRef}
      stateBufferRef={stateBufferRef}
      stateRef={stateRef}
      inputHistoryRef={inputHistoryRef}
      respawnAnchorRef={respawnAnchorRef}
      prevAliveRef={prevAliveRef}
      connectionStatus={connectionStatus}
      currentRoomId={currentRoomId}
      isCurrentRoomPrivate={isCurrentRoomPrivate}
      onLeave={handleLeaveRoom}
    />
  );
}
