import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRoom } from "../lib/room";

const COLORS = [
  "#F5F5F5", "#EF4444", "#F97316", "#F59E0B", "#10B981", "#3B82F6",
  "#7C3AED", "#EC4899", "#06B6D4", "#84CC16", "#A855F7", "#000000",
];
const BG_COLORS = [
  { label: "Dark", value: "#0A0A0A" },
  { label: "White", value: "#FFFFFF" },
  { label: "Cream", value: "#FEF3C7" },
  { label: "Sky", value: "#DBEAFE" },
  { label: "Mint", value: "#D1FAE5" },
  { label: "Pink", value: "#FCE7F3" },
];
const BRUSH_SIZES = [2, 4, 8, 14, 22];
type Tool = "pen" | "eraser" | "line" | "circle";

export default function Canvas() {
  const navigate = useNavigate();
  const { roomId, userId } = useRoom();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [bgColor, setBgColor] = useState(BG_COLORS[0].value);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[2]);
  const [tool, setTool] = useState<Tool>("pen");
  const [sending, setSending] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [showBg, setShowBg] = useState(false);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  // For shape tools: store start point and canvas snapshot
  const shapeStart = useRef<{ x: number; y: number } | null>(null);
  const canvasSnapshot = useRef<ImageData | null>(null);

  useEffect(() => {
    if (!roomId) { navigate("/"); return; }
    initCanvas();
  }, [roomId, navigate]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, rect.width, rect.height);
  };

  useEffect(() => {
    // Refill background when bg color changes
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, [bgColor]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const activeColor = tool === "eraser" ? bgColor : color;
  const activeSize = tool === "eraser" ? brushSize * 3 : brushSize;

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    drawing.current = true;
    const pos = getPos(e);
    lastPoint.current = pos;

    if (tool === "line" || tool === "circle") {
      shapeStart.current = pos;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      canvasSnapshot.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } else {
      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, activeSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = activeColor;
      ctx.fill();
    }
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const pos = getPos(e);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    if (tool === "line" || tool === "circle") {
      // Restore snapshot and draw preview
      if (canvasSnapshot.current) {
        ctx.putImageData(canvasSnapshot.current, 0, 0);
      }
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = activeSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();

      if (tool === "line") {
        ctx.moveTo(shapeStart.current!.x, shapeStart.current!.y);
        ctx.lineTo(pos.x, pos.y);
      } else {
        const dx = pos.x - shapeStart.current!.x;
        const dy = pos.y - shapeStart.current!.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        ctx.arc(shapeStart.current!.x, shapeStart.current!.y, radius, 0, Math.PI * 2);
      }
      ctx.stroke();
    } else {
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = activeSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(lastPoint.current!.x, lastPoint.current!.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPoint.current = pos;
    }
  };

  const endDraw = () => {
    drawing.current = false;
    lastPoint.current = null;
    shapeStart.current = null;
    canvasSnapshot.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, rect.width, rect.height);
  };

  const sendDoodle = async () => {
    if (!roomId || !userId || sending) return;
    setSending(true);

    const canvas = canvasRef.current!;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) { setSending(false); return; }

    const fileName = `${roomId}/${Date.now()}.png`;
    const { error: uploadErr } = await supabase.storage
      .from("doodles")
      .upload(fileName, blob, { contentType: "image/png" });

    if (uploadErr) { setSending(false); alert("Failed to upload"); return; }

    const { data: { publicUrl } } = supabase.storage.from("doodles").getPublicUrl(fileName);

    const { error: insertErr } = await supabase.from("doodl_doodles").insert({
      room_id: roomId,
      sender_id: userId,
      image_url: publicUrl,
    });

    if (insertErr) { setSending(false); alert("Failed to send"); return; }

    clearCanvas();
    setSending(false);
    navigate("/feed");
  };

  const tools: { id: Tool; label: string }[] = [
    { id: "pen", label: "✏️" },
    { id: "eraser", label: "🧹" },
    { id: "line", label: "📏" },
    { id: "circle", label: "⭕" },
  ];

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* Top bar: Clear + Send */}
      <div className="bg-surface border-b border-border px-4 py-2 flex items-center justify-between shrink-0">
        <button
          onClick={() => navigate("/feed")}
          className="text-muted text-sm"
        >
          ← Back
        </button>
        <div className="flex gap-2">
          <button
            onClick={clearCanvas}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-background text-muted border border-border"
          >
            Clear
          </button>
          <button
            onClick={sendDoodle}
            disabled={sending}
            className="px-5 py-1.5 rounded-lg text-sm font-medium bg-purple text-white disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="flex-1 w-full touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />

      {/* Color picker overlay */}
      {showColors && (
        <div className="absolute bottom-20 left-2 right-2 bg-surface border border-border rounded-2xl p-3 z-10 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <p className="text-xs text-muted mb-2">Drawing Color</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { setColor(c); setShowColors(false); }}
                className={`w-9 h-9 rounded-full border-2 ${
                  color === c ? "border-purple scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Background picker overlay */}
      {showBg && (
        <div className="absolute bottom-20 left-2 right-2 bg-surface border border-border rounded-2xl p-3 z-10 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <p className="text-xs text-muted mb-2">Background</p>
          <div className="flex flex-wrap gap-2">
            {BG_COLORS.map((bg) => (
              <button
                key={bg.value}
                onClick={() => { setBgColor(bg.value); setShowBg(false); }}
                className={`w-9 h-9 rounded-full border-2 ${
                  bgColor === bg.value ? "border-purple scale-110" : "border-border"
                }`}
                style={{ backgroundColor: bg.value }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom toolbar */}
      <div className="bg-surface border-t border-border px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shrink-0">
        <div className="flex items-center justify-between gap-1">
          {/* Tools */}
          <div className="flex gap-1">
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-base ${
                  tool === t.id ? "bg-purple/20 ring-1 ring-purple" : "bg-background"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Brush sizes */}
          <div className="flex gap-0.5">
            {BRUSH_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setBrushSize(s)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  brushSize === s ? "bg-purple/20" : "bg-background"
                }`}
              >
                <div
                  className="rounded-full"
                  style={{
                    width: Math.min(s + 2, 20),
                    height: Math.min(s + 2, 20),
                    backgroundColor: tool === "eraser" ? "#737373" : color,
                  }}
                />
              </button>
            ))}
          </div>

          {/* Color + BG buttons */}
          <div className="flex gap-1">
            <button
              onClick={() => { setShowColors(!showColors); setShowBg(false); }}
              className="w-9 h-9 rounded-lg border-2 border-border"
              style={{ backgroundColor: color }}
            />
            <button
              onClick={() => { setShowBg(!showBg); setShowColors(false); }}
              className="w-9 h-9 rounded-lg border-2 border-border flex items-center justify-center text-xs"
              style={{ backgroundColor: bgColor }}
            >
              <span style={{ color: bgColor === "#0A0A0A" ? "#737373" : "#333" }}>BG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
