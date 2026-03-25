import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRoom, type RoomEntry } from "../lib/room";

interface RoomWithBadge extends RoomEntry {
  unseen: number;
  memberCount: number;
}

export default function Rooms() {
  const navigate = useNavigate();
  const { rooms, setActiveRoom, removeRoom, updateRoomName } = useRoom();
  const [roomsData, setRoomsData] = useState<RoomWithBadge[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    if (rooms.length === 0) { navigate("/"); return; }
    loadRoomData();
  }, [rooms]);

  const loadRoomData = async () => {
    const enriched: RoomWithBadge[] = [];

    for (const room of rooms) {
      // Get unseen doodle count
      const { data: user } = await supabase
        .from("doodl_users")
        .select("last_seen_at")
        .eq("id", room.doodlUserId)
        .single();

      const { count: unseen } = await supabase
        .from("doodl_doodles")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.roomId)
        .neq("sender_id", room.doodlUserId)
        .gt("created_at", user?.last_seen_at || "1970-01-01");

      // Get member count
      const { count: memberCount } = await supabase
        .from("doodl_users")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.roomId);

      // Get room name from DB
      const { data: roomRow } = await supabase
        .from("doodl_rooms")
        .select("name")
        .eq("id", room.roomId)
        .single();

      if (roomRow?.name && roomRow.name !== room.name) {
        updateRoomName(room.roomId, roomRow.name);
      }

      enriched.push({
        ...room,
        name: roomRow?.name || room.name,
        unseen: unseen ?? 0,
        memberCount: memberCount ?? 0,
      });
    }

    setRoomsData(enriched);

    // Update app badge with total unseen
    const total = enriched.reduce((sum, r) => sum + r.unseen, 0);
    if ("setAppBadge" in navigator) {
      if (total > 0) {
        (navigator as any).setAppBadge(total).catch(() => {});
      } else {
        (navigator as any).clearAppBadge().catch(() => {});
      }
    }
  };

  const handleSelect = (roomId: string) => {
    setActiveRoom(roomId);
    navigate("/feed");
  };

  const handleLeave = (roomId: string) => {
    removeRoom(roomId);
    if (rooms.length <= 1) navigate("/");
  };

  const handleSaveName = async (roomId: string) => {
    if (!editName.trim()) { setEditingId(null); return; }
    await supabase
      .from("doodl_rooms")
      .update({ name: editName.trim() })
      .eq("id", roomId);
    updateRoomName(roomId, editName.trim());
    setEditingId(null);
    loadRoomData();
  };

  const totalUnseen = roomsData.reduce((sum, r) => sum + r.unseen, 0);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <div className="bg-surface border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-bold">Rooms</h1>
        <button
          onClick={() => navigate("/?new=1")}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-purple text-white"
        >
          + New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+4rem+env(safe-area-inset-bottom))] space-y-3">
        {roomsData.length === 0 && (
          <p className="text-center text-muted text-sm py-12">No rooms yet.</p>
        )}

        {roomsData.map((room) => (
          <div
            key={room.roomId}
            className="bg-surface rounded-2xl border border-border p-4"
          >
            <div className="flex items-start justify-between mb-2">
              {editingId === room.roomId ? (
                <div className="flex gap-2 flex-1 mr-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveName(room.roomId)}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-purple"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveName(room.roomId)}
                    className="text-purple text-sm font-medium"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleSelect(room.roomId)}
                  className="text-left flex-1"
                >
                  <h3 className="font-semibold text-foreground text-sm">
                    {room.name || `Room ${room.code}`}
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Code: {room.code} · {room.memberCount} member{room.memberCount !== 1 ? "s" : ""}
                  </p>
                </button>
              )}

              <div className="flex items-center gap-2 shrink-0">
                {room.unseen > 0 && (
                  <span className="bg-purple text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                    {room.unseen}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleSelect(room.roomId)}
                className="flex-1 py-2 rounded-lg text-xs font-medium bg-purple text-white"
              >
                Open
              </button>
              <button
                onClick={() => { setEditingId(room.roomId); setEditName(room.name || ""); }}
                className="py-2 px-3 rounded-lg text-xs font-medium bg-background text-muted border border-border"
              >
                Rename
              </button>
              <button
                onClick={() => handleLeave(room.roomId)}
                className="py-2 px-3 rounded-lg text-xs font-medium bg-background text-red-400 border border-border"
              >
                Leave
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border">
        <div className="flex pb-[env(safe-area-inset-bottom)]">
          <button onClick={() => navigate("/rooms")} className="flex-1 py-3 text-center text-xs text-purple relative">
            <span className="text-lg block">🏠</span>
            Rooms
            {totalUnseen > 0 && (
              <span className="absolute top-1 right-1/4 bg-purple text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {totalUnseen}
              </span>
            )}
          </button>
          <button onClick={() => navigate("/canvas")} className="flex-1 py-3 text-center text-xs text-muted">
            <span className="text-lg block">✏️</span>Canvas
          </button>
          <button onClick={() => navigate("/feed")} className="flex-1 py-3 text-center text-xs text-muted">
            <span className="text-lg block">🖼️</span>Feed
          </button>
          <button onClick={() => navigate("/apps")} className="flex-1 py-3 text-center text-xs text-muted">
            <span className="text-lg block">🚀</span>Apps
          </button>
        </div>
      </div>
    </div>
  );
}
