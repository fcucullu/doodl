import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRoom } from "../lib/room";
import { useAuth } from "../lib/auth";

function ShareCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}?code=${code}`;

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Join my Doodl room!",
        text: `Join my Doodl room with code: ${code}`,
        url,
      }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-xs space-y-3">
      <p className="text-muted text-sm text-center">Share this code with your person:</p>
      <button
        onClick={handleCopy}
        className="w-full bg-surface border border-border rounded-xl px-4 py-4 text-center font-mono text-2xl tracking-[0.4em] text-foreground active:bg-purple/10"
      >
        {copied ? "Copied!" : code}
      </button>
      <button
        onClick={handleShare}
        className="w-full bg-purple text-white font-medium py-3 rounded-xl"
      >
        Share invite
      </button>
    </div>
  );
}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function Home() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn } = useAuth();
  const { setRoom, roomId, roomCode } = useRoom();
  const urlCode = new URLSearchParams(window.location.search).get("code") || "";
  const [joinCode, setJoinCode] = useState(urlCode);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <p className="text-muted text-sm">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 gap-4">
        <h1 className="text-4xl font-bold">Doodl</h1>
        <p className="text-muted text-sm">Draw and share with your person</p>
        <button
          onClick={signIn}
          className="w-full max-w-xs bg-purple text-white font-medium py-3 rounded-xl mt-4"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  // If already in a room, show option to go back
  if (roomId) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 gap-4">
        <h1 className="text-3xl font-bold">Doodl</h1>
        <p className="text-muted text-sm">You're already in a room</p>
        <ShareCode code={roomCode!} />
        <button
          onClick={() => navigate("/canvas")}
          className="w-full max-w-xs bg-surface border border-border text-foreground font-medium py-3 rounded-xl"
        >
          Go to Canvas
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

  // Show share code after creating a room
  if (createdCode) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 gap-4">
        <h1 className="text-3xl font-bold">Room Created!</h1>
        <ShareCode code={createdCode} />
        <button
          onClick={() => navigate("/canvas")}
          className="w-full max-w-xs bg-surface border border-border text-foreground font-medium py-3 rounded-xl"
        >
          Start Drawing
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

    const { data: doodlUser, error: userErr } = await supabase
      .from("doodl_users")
      .insert({ room_id: room.id, nickname: nickname.trim(), auth_id: user!.id })
      .select("id")
      .single();

    if (userErr || !doodlUser) { setError("Failed to join room"); setLoading(false); return; }

    setRoom(room.id, doodlUser.id, code, nickname.trim());
    setLoading(false);
    setCreatedCode(code);
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

    const { data: doodlUser, error: userErr } = await supabase
      .from("doodl_users")
      .insert({ room_id: room.id, nickname: nickname.trim(), auth_id: user!.id })
      .select("id")
      .single();

    if (userErr || !doodlUser) { setError("Failed to join room"); setLoading(false); return; }

    setRoom(room.id, doodlUser.id, joinCode.toUpperCase(), nickname.trim());
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
