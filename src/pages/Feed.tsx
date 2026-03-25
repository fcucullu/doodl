import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRoom } from "../lib/room";

interface Reaction {
  emoji: string;
  reactor_id: string;
}

interface Doodle {
  id: string;
  room_id: string;
  sender_id: string;
  image_url: string;
  created_at: string;
  sender_nickname?: string;
  reactions: Reaction[];
}

const REACTION_EMOJIS = ["❤️", "😂", "🔥", "😍", "👏", "🎨"];

export default function Feed() {
  const navigate = useNavigate();
  const { roomId, userId, roomCode, clearRoom, activeRoom } = useRoom();
  const [doodles, setDoodles] = useState<Doodle[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const usersRef = useRef<Record<string, string>>({});
  const [reactingId, setReactingId] = useState<string | null>(null);

  // Mark feed as seen and update badge
  const markSeen = async () => {
    if (!userId) return;
    await supabase
      .from("doodl_users")
      .update({ last_seen_at: new Date(Date.now() + 1000).toISOString() })
      .eq("id", userId);
    if ("clearAppBadge" in navigator) {
      (navigator as any).clearAppBadge().catch(() => {});
    }
  };

  useEffect(() => {
    if (!roomId) { navigate("/"); return; }
    loadData();
    markSeen();

    const channel = supabase
      .channel(`doodles:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "doodl_doodles", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const d = payload.new as any;
          const doodle: Doodle = {
            ...d,
            sender_nickname: usersRef.current[d.sender_id] || "???",
            reactions: [],
          };
          setDoodles((prev) => [doodle, ...prev]);
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
    const map = userMap || usersRef.current;
    const { data } = await supabase
      .from("doodl_doodles")
      .select("*, doodl_reactions(emoji, reactor_id)")
      .eq("room_id", roomId!)
      .order("created_at", { ascending: false });

    const enriched: Doodle[] = (data ?? []).map((d) => ({
      ...d,
      sender_nickname: map[d.sender_id] || "???",
      reactions: (d.doodl_reactions || []) as Reaction[],
    }));
    setDoodles(enriched);
  };

  const handleReact = async (doodleId: string, emoji: string) => {
    if (!userId) return;
    await supabase.from("doodl_reactions").upsert(
      { doodle_id: doodleId, emoji, reactor_id: userId },
      { onConflict: "doodle_id,reactor_id" }
    );
    setReactingId(null);
    loadDoodles();
  };

  const handleLeave = () => {
    clearRoom();
    navigate("/rooms");
  };

  // Group reactions by emoji for display
  function groupReactions(reactions: Reaction[]) {
    const groups: Record<string, string[]> = {};
    for (const r of reactions) {
      if (!groups[r.emoji]) groups[r.emoji] = [];
      groups[r.emoji].push(r.reactor_id);
    }
    return Object.entries(groups);
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{activeRoom?.name || `Room ${roomCode}`}</h1>
          <p className="text-xs text-muted">Code: {roomCode}</p>
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

        {doodles.map((d) => {
          const grouped = groupReactions(d.reactions);
          const myReaction = d.reactions.find((r) => r.reactor_id === userId)?.emoji;

          return (
            <div key={d.id} className="bg-surface rounded-2xl border border-border overflow-hidden relative">
              <img
                src={d.image_url}
                alt="Doodle"
                className="w-full"
                loading="lazy"
              />

              {/* Reactions bar — WhatsApp style, overlapping bottom of image */}
              {grouped.length > 0 && (
                <div className="flex gap-1 px-3 -mt-4 relative z-10">
                  {grouped.map(([emoji, reactors]) => (
                    <span
                      key={emoji}
                      className="inline-flex items-center gap-0.5 bg-surface/90 backdrop-blur border border-border rounded-full px-2 py-1 text-sm"
                    >
                      {emoji}
                      {reactors.length > 1 && (
                        <span className="text-xs text-muted">{reactors.length}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}

              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">
                    {d.sender_id === userId ? "You" : d.sender_nickname}
                  </span>
                  <span className="text-xs text-muted ml-2">
                    {new Date(d.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <button
                  onClick={() => setReactingId(reactingId === d.id ? null : d.id)}
                  className="text-muted hover:text-foreground text-sm"
                >
                  {myReaction ? `${myReaction} change` : "+ react"}
                </button>
              </div>

              {/* Reaction picker */}
              {reactingId === d.id && (
                <div className="px-4 pb-3 flex gap-2 flex-wrap">
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReact(d.id, emoji)}
                      className={`text-2xl hover:scale-125 transition-transform ${
                        myReaction === emoji ? "scale-125 ring-2 ring-purple rounded-lg" : ""
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border">
        <div className="flex pb-[env(safe-area-inset-bottom)]">
          <button onClick={() => navigate("/rooms")} className="flex-1 py-3 text-center text-xs text-muted">
            <span className="text-lg block">🏠</span>Rooms
          </button>
          <button onClick={() => navigate("/canvas")} className="flex-1 py-3 text-center text-xs text-muted">
            <span className="text-lg block">✏️</span>Canvas
          </button>
          <button onClick={() => navigate("/feed")} className="flex-1 py-3 text-center text-xs text-purple">
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
