import { useState, useEffect } from "react";
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
      <p className="text-muted text-sm text-center">Share this code:</p>
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

function getDisplayName(user: any): string {
  return user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User";
}

export default function Home() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn } = useAuth();
  const { rooms, addRoom, setActiveRoom } = useRoom();
  const urlCode = new URLSearchParams(window.location.search).get("code") || "";
  const [joinCode, setJoinCode] = useState(urlCode);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [autoJoining, setAutoJoining] = useState(false);

  // Auto-join when user arrives with a code and is authenticated
  useEffect(() => {
    if (user && urlCode && !autoJoining && !createdCode) {
      setAutoJoining(true);
      autoJoin(urlCode);
    }
  }, [user, urlCode]);

  const autoJoin = async (code: string) => {
    const { data: room } = await supabase
      .from("doodl_rooms")
      .select("id, name")
      .eq("code", code.toUpperCase())
      .single();

    if (!room) { setAutoJoining(false); setError("Room not found"); return; }

    // Already in this room? Go straight to feed
    const existing = rooms.find((r) => r.roomId === room.id);
    if (existing) {
      setActiveRoom(room.id);
      navigate("/feed", { replace: true });
      return;
    }

    const displayName = getDisplayName(user!);
    const { data: doodlUser, error: userErr } = await supabase
      .from("doodl_users")
      .insert({ room_id: room.id, nickname: displayName, auth_id: user!.id })
      .select("id")
      .single();

    if (userErr || !doodlUser) { setAutoJoining(false); setError("Failed to join"); return; }

    addRoom({
      roomId: room.id,
      doodlUserId: doodlUser.id,
      code: code.toUpperCase(),
      nickname: displayName,
      name: room.name || undefined,
    });
    navigate("/feed", { replace: true });
  };

  if (authLoading || autoJoining) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <p className="text-muted text-sm">{autoJoining ? "Joining room..." : "Loading..."}</p>
      </div>
    );
  }

  if (!user) {
    const handleSignIn = () => {
      if (urlCode) localStorage.setItem("doodl_pending_code", urlCode);
      signIn();
    };

    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 gap-4">
        <h1 className="text-4xl font-bold">Doodl</h1>
        <p className="text-muted text-sm">Draw and share with your people</p>
        {urlCode && (
          <p className="text-purple-light text-sm">Room code: {urlCode} — sign in to join</p>
        )}
        <button
          onClick={handleSignIn}
          className="w-full max-w-xs bg-purple text-white font-medium py-3 rounded-xl mt-4"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  // If user has rooms and not explicitly creating, redirect to rooms list
  const isNewRoom = new URLSearchParams(window.location.search).has("new");
  if (rooms.length > 0 && !createdCode && !isNewRoom && !urlCode) {
    navigate("/rooms", { replace: true });
    return null;
  }

  // Show share code after creating a room
  if (createdCode) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 gap-4">
        <h1 className="text-3xl font-bold">Room Created!</h1>
        <ShareCode code={createdCode} />
        <button
          onClick={() => navigate("/rooms")}
          className="w-full max-w-xs bg-surface border border-border text-foreground font-medium py-3 rounded-xl"
        >
          Go to Rooms
        </button>
      </div>
    );
  }

  const displayName = getDisplayName(user);

  const handleCreate = async () => {
    setLoading(true);
    setError("");

    const code = generateCode();
    const { data: room, error: roomErr } = await supabase
      .from("doodl_rooms")
      .insert({ code, name: displayName + "'s Room" })
      .select("id")
      .single();

    if (roomErr || !room) { setError("Failed to create room"); setLoading(false); return; }

    const { data: doodlUser, error: userErr } = await supabase
      .from("doodl_users")
      .insert({ room_id: room.id, nickname: displayName, auth_id: user!.id })
      .select("id")
      .single();

    if (userErr || !doodlUser) { setError("Failed to join room"); setLoading(false); return; }

    addRoom({
      roomId: room.id,
      doodlUserId: doodlUser.id,
      code,
      nickname: displayName,
      name: displayName + "'s Room",
    });
    setLoading(false);
    setCreatedCode(code);
  };

  const handleJoin = async () => {
    if (joinCode.length !== 6) { setError("Code must be 6 characters"); return; }
    setLoading(true);
    setError("");

    const { data: room } = await supabase
      .from("doodl_rooms")
      .select("id, name")
      .eq("code", joinCode.toUpperCase())
      .single();

    if (!room) { setError("Room not found"); setLoading(false); return; }

    if (rooms.some((r) => r.roomId === room.id)) {
      setActiveRoom(room.id);
      navigate("/feed");
      return;
    }

    const { data: doodlUser, error: userErr } = await supabase
      .from("doodl_users")
      .insert({ room_id: room.id, nickname: displayName, auth_id: user!.id })
      .select("id")
      .single();

    if (userErr || !doodlUser) { setError("Failed to join room"); setLoading(false); return; }

    addRoom({
      roomId: room.id,
      doodlUserId: doodlUser.id,
      code: joinCode.toUpperCase(),
      nickname: displayName,
      name: room.name || undefined,
    });
    setLoading(false);
    navigate("/feed");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {rooms.length > 0 && (
        <div className="bg-surface border-b border-border px-4 py-2 shrink-0">
          <button onClick={() => navigate("/rooms")} className="text-muted text-sm">
            ← Back
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <h1 className="text-4xl font-bold mb-2">Doodl</h1>
        <p className="text-muted text-sm mb-1">
          {rooms.length > 0 ? "Create or join a room" : "Draw and share with your people"}
        </p>
        <p className="text-purple-light text-xs mb-8">Hi, {displayName}!</p>

        <div className="w-full max-w-xs space-y-4">
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full bg-purple text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 text-base"
          >
            + Create New Room
          </button>

          <div className="flex items-center gap-3 text-muted text-xs">
            <div className="flex-1 h-px bg-border" />
            <span>or join one</span>
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
            className="w-full bg-purple/80 text-white font-semibold py-3.5 rounded-xl disabled:opacity-30 text-base"
          >
            Join Room
          </button>

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
}
