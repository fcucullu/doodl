import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface RoomState {
  roomId: string | null;
  userId: string | null;
  roomCode: string | null;
  nickname: string | null;
  setRoom: (roomId: string, userId: string, code: string, nickname: string) => void;
  clearRoom: () => void;
}

const RoomContext = createContext<RoomState | null>(null);

export function RoomProvider({ children }: { children: ReactNode }) {
  const [roomId, setRoomId] = useState<string | null>(() => localStorage.getItem("doodl_room_id"));
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem("doodl_user_id"));
  const [roomCode, setRoomCode] = useState<string | null>(() => localStorage.getItem("doodl_room_code"));
  const [nickname, setNickname] = useState<string | null>(() => localStorage.getItem("doodl_nickname"));

  const setRoom = (rid: string, uid: string, code: string, nick: string) => {
    setRoomId(rid);
    setUserId(uid);
    setRoomCode(code);
    setNickname(nick);
    localStorage.setItem("doodl_room_id", rid);
    localStorage.setItem("doodl_user_id", uid);
    localStorage.setItem("doodl_room_code", code);
    localStorage.setItem("doodl_nickname", nick);
  };

  const clearRoom = () => {
    setRoomId(null);
    setUserId(null);
    setRoomCode(null);
    setNickname(null);
    localStorage.removeItem("doodl_room_id");
    localStorage.removeItem("doodl_user_id");
    localStorage.removeItem("doodl_room_code");
    localStorage.removeItem("doodl_nickname");
  };

  // Listen for service worker storage requests
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "get-storage" && event.ports?.[0]) {
        const value = localStorage.getItem(event.data.key);
        event.ports[0].postMessage(value);
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    return () => navigator.serviceWorker?.removeEventListener("message", handler);
  }, []);

  return (
    <RoomContext.Provider value={{ roomId, userId, roomCode, nickname, setRoom, clearRoom }}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be inside RoomProvider");
  return ctx;
}
