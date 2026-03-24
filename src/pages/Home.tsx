import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRoom } from "../lib/room";

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function Home() {
  const navigate = useNavigate();
  const { setRoom, roomId } = useRoom();
  const [joinCode, setJoinCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already in a room, show option to go back
  if (roomId) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 gap-4">
        <h1 className="text-3xl font-bold">Doodl</h1>
        <p className="text-muted text-sm">You're already in a room</p>
        <button
          onClick={() => navigate("/canvas")}
          className="w-full max-w-xs bg-purple text-white font-medium py-3 rounded-xl"
        >
          Back to Canvas
        </button>
        <button
          onClick={() => navigate("/feed")}
          className="w-full max-w-xs bg-surface border border-border text-foreground font-medium py-3 rounded-xl"
        >
          View Feed
        </button>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!nickname.trim()) { setError("Enter a nickname"); return; }
    setLoading(true);
    setError("");

    const code = generateCode();
    const { data: room, error: roomErr } = await supabase
      .from("doodl_rooms")
      .insert({ code })
      .select("id")
      .single();

    if (roomErr || !room) { setError("Failed to create room"); setLoading(false); return; }

    const { data: user, error: userErr } = await supabase
      .from("doodl_users")
      .insert({ room_id: room.id, nickname: nickname.trim() })
      .select("id")
      .single();

    if (userErr || !user) { setError("Failed to join room"); setLoading(false); return; }

    setRoom(room.id, user.id, code, nickname.trim());
    setLoading(false);
    navigate("/canvas");
  };

  const handleJoin = async () => {
    if (!nickname.trim()) { setError("Enter a nickname"); return; }
    if (joinCode.length !== 6) { setError("Code must be 6 characters"); return; }
    setLoading(true);
    setError("");

    const { data: room } = await supabase
      .from("doodl_rooms")
      .select("id")
      .eq("code", joinCode.toUpperCase())
      .single();

    if (!room) { setError("Room not found"); setLoading(false); return; }

    // Check if room already has 2 users
    const { count } = await supabase
      .from("doodl_users")
      .select("*", { count: "exact", head: true })
      .eq("room_id", room.id);

    if (count && count >= 2) { setError("Room is full"); setLoading(false); return; }

    const { data: user, error: userErr } = await supabase
      .from("doodl_users")
      .insert({ room_id: room.id, nickname: nickname.trim() })
      .select("id")
      .single();

    if (userErr || !user) { setError("Failed to join room"); setLoading(false); return; }

    setRoom(room.id, user.id, joinCode.toUpperCase(), nickname.trim());
    setLoading(false);
    navigate("/canvas");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
      <h1 className="text-4xl font-bold mb-2">Doodl</h1>
      <p className="text-muted text-sm mb-8">Draw and share with your person</p>

      <div className="w-full max-w-xs space-y-4">
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Your nickname"
          maxLength={20}
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:border-purple"
        />

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full bg-purple text-white font-medium py-3 rounded-xl disabled:opacity-50"
        >
          Create Room
        </button>

        <div className="flex items-center gap-3 text-muted text-xs">
          <div className="flex-1 h-px bg-border" />
          <span>or join</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <input
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="Enter 6-letter code"
          maxLength={6}
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-sm text-center tracking-[0.3em] font-mono uppercase outline-none focus:border-purple"
        />

        <button
          onClick={handleJoin}
          disabled={loading || joinCode.length !== 6}
          className="w-full bg-surface border border-border text-foreground font-medium py-3 rounded-xl disabled:opacity-50"
        >
          Join Room
        </button>

        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
      </div>
    </div>
  );
}
