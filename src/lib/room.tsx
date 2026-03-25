import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface RoomEntry {
  roomId: string;
  doodlUserId: string;
  code: string;
  nickname: string;
  name?: string;
}

interface RoomState {
  rooms: RoomEntry[];
  activeRoom: RoomEntry | null;
  setActiveRoom: (roomId: string) => void;
  addRoom: (entry: RoomEntry) => void;
  removeRoom: (roomId: string) => void;
  updateRoomName: (roomId: string, name: string) => void;
  // Convenience shortcuts for active room
  roomId: string | null;
  userId: string | null;
  roomCode: string | null;
  nickname: string | null;
  clearRoom: () => void;
}

const STORAGE_KEY = "doodl_rooms";
const ACTIVE_KEY = "doodl_active_room";

function loadRooms(): RoomEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRooms(rooms: RoomEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
}

const RoomContext = createContext<RoomState | null>(null);

export function RoomProvider({ children }: { children: ReactNode }) {
  const [rooms, setRooms] = useState<RoomEntry[]>(loadRooms);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_KEY)
  );

  const activeRoom = rooms.find((r) => r.roomId === activeRoomId) || null;

  useEffect(() => {
    saveRooms(rooms);
    // Migrate old single-room localStorage
    const oldRoomId = localStorage.getItem("doodl_room_id");
    if (oldRoomId && rooms.length === 0) {
      const migrated: RoomEntry = {
        roomId: oldRoomId,
        doodlUserId: localStorage.getItem("doodl_user_id") || "",
        code: localStorage.getItem("doodl_room_code") || "",
        nickname: localStorage.getItem("doodl_nickname") || "",
      };
      setRooms([migrated]);
      setActiveRoomId(oldRoomId);
      localStorage.removeItem("doodl_room_id");
      localStorage.removeItem("doodl_user_id");
      localStorage.removeItem("doodl_room_code");
      localStorage.removeItem("doodl_nickname");
    }
  }, []);

  useEffect(() => {
    saveRooms(rooms);
  }, [rooms]);

  useEffect(() => {
    if (activeRoomId) {
      localStorage.setItem(ACTIVE_KEY, activeRoomId);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
  }, [activeRoomId]);

  const setActiveRoom = (roomId: string) => setActiveRoomId(roomId);

  const addRoom = (entry: RoomEntry) => {
    setRooms((prev) => {
      if (prev.some((r) => r.roomId === entry.roomId)) return prev;
      return [...prev, entry];
    });
    setActiveRoomId(entry.roomId);
  };

  const removeRoom = (roomId: string) => {
    setRooms((prev) => prev.filter((r) => r.roomId !== roomId));
    if (activeRoomId === roomId) {
      setActiveRoomId(null);
    }
  };

  const updateRoomName = (roomId: string, name: string) => {
    setRooms((prev) => prev.map((r) => r.roomId === roomId ? { ...r, name } : r));
  };

  const clearRoom = () => {
    if (activeRoomId) removeRoom(activeRoomId);
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
    <RoomContext.Provider
      value={{
        rooms,
        activeRoom,
        setActiveRoom,
        addRoom,
        removeRoom,
        updateRoomName,
        roomId: activeRoom?.roomId || null,
        userId: activeRoom?.doodlUserId || null,
        roomCode: activeRoom?.code || null,
        nickname: activeRoom?.nickname || null,
        clearRoom,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be inside RoomProvider");
  return ctx;
}
