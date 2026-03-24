import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRoom } from "../lib/room";

interface Doodle {
  id: string;
  room_id: string;
  sender_id: string;
  image_url: string;
  created_at: string;
  sender_nickname?: string;
  reaction?: string;
}

const REACTION_EMOJIS = ["❤️", "😂", "🔥", "😍", "👏", "🎨"];

export default function Feed() {
  const navigate = useNavigate();
  const { roomId, userId, roomCode, clearRoom } = useRoom();
  const [doodles, setDoodles] = useState<Doodle[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const usersRef = useRef<Record<string, string>>({});
  const [reactingId, setReactingId] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) { navigate("/"); return; }
    loadData();

    const channel = supabase
      .channel(`doodles:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "doodl_doodles", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const d = payload.new as Doodle;
          d.sender_nickname = usersRef.current[d.sender_id] || "???";
          setDoodles((prev) => [d, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "doodl_reactions" },
        () => loadDoodles()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const loadData = async () => {
    // Load users in this room
    const { data: roomUsers } = await supabase
      .from("doodl_users")
      .select("id, nickname")
      .eq("room_id", roomId!);

    const userMap: Record<string, string> = {};
    roomUsers?.forEach((u) => { userMap[u.id] = u.nickname; });
    usersRef.current = userMap;
    setUsers(userMap);

    await loadDoodles(userMap);
  };

  const loadDoodles = async (userMap?: Record<string, string>) => {
    const map = userMap || users;
    const { data } = await supabase
      .from("doodl_doodles")
      .select("*, doodl_reactions(emoji)")
      .eq("room_id", roomId!)
      .order("created_at", { ascending: false });

    const enriched = (data ?? []).map((d) => ({
      ...d,
      sender_nickname: map[d.sender_id] || "???",
      reaction: d.doodl_reactions?.[0]?.emoji || undefined,
    }));
    setDoodles(enriched);
  };

  const handleReact = async (doodleId: string, emoji: string) => {
    // Upsert reaction
    await supabase.from("doodl_reactions").upsert(
      { doodle_id: doodleId, emoji },
      { onConflict: "doodle_id" }
    );
    setReactingId(null);
    loadDoodles();
  };

  const handleLeave = () => {
    clearRoom();
    navigate("/");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Doodl Feed</h1>
          <p className="text-xs text-muted">Room: {roomCode}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/canvas")}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-purple text-white"
          >
            Draw
          </button>
          <button
            onClick={handleLeave}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-background text-muted border border-border"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Doodle list */}
      <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+4rem+env(safe-area-inset-bottom))] space-y-4">
        {doodles.length === 0 && (
          <p className="text-center text-muted text-sm py-12">
            No doodles yet. Tap &quot;Draw&quot; to send the first one!
          </p>
        )}

        {doodles.map((d) => (
          <div key={d.id} className="bg-surface rounded-2xl border border-border overflow-hidden">
            <img
              src={d.image_url}
              alt="Doodle"
              className="w-full"
              loading="lazy"
            />
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">
                  {d.sender_id === userId ? "You" : d.sender_nickname}
                </span>
                <span className="text-xs text-muted ml-2">
                  {new Date(d.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {d.reaction && (
                  <span className="text-xl">{d.reaction}</span>
                )}
                {d.sender_id !== userId && (
                  <button
                    onClick={() => setReactingId(reactingId === d.id ? null : d.id)}
                    className="text-muted hover:text-foreground text-sm"
                  >
                    {d.reaction ? "change" : "react"}
                  </button>
                )}
              </div>
            </div>

            {/* Reaction picker */}
            {reactingId === d.id && (
              <div className="px-4 pb-3 flex gap-2">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(d.id, emoji)}
                    className="text-2xl hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border">
        <div className="flex pb-[env(safe-area-inset-bottom)]">
          <button
            onClick={() => navigate("/canvas")}
            className="flex-1 py-3 text-center text-xs text-muted"
          >
            <span className="text-lg block">✏️</span>
            Canvas
          </button>
          <button
            onClick={() => navigate("/feed")}
            className="flex-1 py-3 text-center text-xs text-purple"
          >
            <span className="text-lg block">🖼️</span>
            Feed
          </button>
          <button
            onClick={() => navigate("/apps")}
            className="flex-1 py-3 text-center text-xs text-muted"
          >
            <span className="text-lg block">🚀</span>
            Apps
          </button>
        </div>
      </div>
    </div>
  );
}
