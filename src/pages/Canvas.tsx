import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRoom } from "../lib/room";

const COLORS = [
  "#F5F5F5", "#000000", "#EF4444", "#F97316", "#F59E0B", "#FCD34D",
  "#10B981", "#06B6D4", "#3B82F6", "#6366F1", "#7C3AED", "#A855F7",
  "#EC4899", "#F43F5E", "#78716C", "#1E293B",
];
const BG_COLORS = [
  "#E9D5FF", "#FFFFFF", "#FEF3C7", "#DBEAFE",
  "#D1FAE5", "#FCE7F3", "#FEE2E2", "#F1F5F9",
];
const BRUSH_SIZES = [2, 5, 10, 18, 28];
type Tool = "pencil" | "brush" | "eraser";

export default function Canvas() {
  const navigate = useNavigate();
  const { roomId, userId } = useRoom();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState("#EC4899");
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [tool, setTool] = useState<Tool>("pencil");
  const [sending, setSending] = useState(false);
  const [openPicker, setOpenPicker] = useState<"width" | "color" | "bg" | null>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const lastPressure = useRef(0.5);

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
      const touch = e.touches[0];
      // Get pressure for brush tool (falls back to 0.5 if not supported)
      const pressure = (touch as any).force || (touch as any).webkitForce || 0.5;
      lastPressure.current = Math.max(0.1, Math.min(1, pressure));
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    lastPressure.current = 0.5;
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const getDrawColor = () => tool === "eraser" ? bgColor : color;
  const getDrawSize = () => {
    const base = tool === "eraser" ? brushSize * 3 : brushSize;
    if (tool === "brush") return base * lastPressure.current * 1.8;
    return base;
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setOpenPicker(null);
    drawing.current = true;
    const pos = getPos(e);
    lastPoint.current = pos;

    const ctx = canvasRef.current!.getContext("2d")!;
    const size = getDrawSize();
    ctx.fillStyle = getDrawColor();

    if (tool === "brush") {
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    const size = getDrawSize();
    const drawColor = getDrawColor();

    ctx.strokeStyle = drawColor;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (tool === "brush") {
      ctx.globalAlpha = 0.4;
    } else {
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.moveTo(lastPoint.current!.x, lastPoint.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    ctx.globalAlpha = 1;
    lastPoint.current = pos;
  };

  const endDraw = () => {
    drawing.current = false;
    lastPoint.current = null;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.globalAlpha = 1;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    ctx.globalAlpha = 1;
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

  const toolItems: { id: Tool; label: string }[] = [
    { id: "pencil", label: "✏️" },
    { id: "brush", label: "🖌️" },
    { id: "eraser", label: "🧼" },
  ];

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* Top bar */}
      <div className="bg-surface border-b border-border px-4 py-2 flex items-center justify-between shrink-0">
        <button onClick={() => navigate("/feed")} className="text-muted text-sm">
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

      {/* Picker overlays */}
      {openPicker === "width" && (
        <div className="absolute bottom-16 left-2 right-2 bg-surface border border-border rounded-2xl p-4 z-10">
          <p className="text-xs text-muted mb-3">Brush Width</p>
          <div className="flex justify-around">
            {BRUSH_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => { setBrushSize(s); setOpenPicker(null); }}
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  brushSize === s ? "bg-purple/20 ring-2 ring-purple" : "bg-background"
                }`}
              >
                <div
                  className="rounded-full"
                  style={{
                    width: Math.min(s + 2, 28),
                    height: Math.min(s + 2, 28),
                    backgroundColor: tool === "eraser" ? "#737373" : color,
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {openPicker === "color" && (
        <div className="absolute bottom-16 left-2 right-2 bg-surface border border-border rounded-2xl p-4 z-10">
          <p className="text-xs text-muted mb-3">Drawing Color</p>
          <div className="grid grid-cols-8 gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { setColor(c); setOpenPicker(null); if (tool === "eraser") setTool("pencil"); }}
                className={`w-full aspect-square rounded-full border-2 ${
                  color === c ? "border-purple scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}

      {openPicker === "bg" && (
        <div className="absolute bottom-16 left-2 right-2 bg-surface border border-border rounded-2xl p-4 z-10">
          <p className="text-xs text-muted mb-3">Background Color</p>
          <div className="grid grid-cols-8 gap-2">
            {BG_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { setBgColor(c); setOpenPicker(null); }}
                className={`w-full aspect-square rounded-full border-2 ${
                  bgColor === c ? "border-purple scale-110" : "border-border"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom toolbar — fixed layout, no scroll */}
      <div className="bg-surface border-t border-border px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shrink-0">
        <div className="flex items-center justify-between">
          {/* Tools: pencil, brush, eraser */}
          {toolItems.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                tool === t.id ? "bg-white ring-2 ring-purple" : "bg-white"
              }`}
            >
              {t.label}
            </button>
          ))}

          {/* Width picker */}
          <button
            onClick={() => setOpenPicker(openPicker === "width" ? null : "width")}
            className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white ${
              openPicker === "width" ? "ring-2 ring-purple" : ""
            }`}
          >
            <div
              className="rounded-full"
              style={{
                width: Math.min(brushSize + 2, 20),
                height: Math.min(brushSize + 2, 20),
                backgroundColor: tool === "eraser" ? "#737373" : color,
              }}
            />
          </button>

          {/* Color picker (CL) */}
          <button
            onClick={() => setOpenPicker(openPicker === "color" ? null : "color")}
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${
              openPicker === "color" ? "ring-2 ring-purple" : ""
            }`}
            style={{ backgroundColor: color, color: color === "#000000" || color === "#1E293B" ? "#fff" : "#000" }}
          >
            CL
          </button>

          {/* Background picker (BG) */}
          <button
            onClick={() => setOpenPicker(openPicker === "bg" ? null : "bg")}
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold border border-border ${
              openPicker === "bg" ? "ring-2 ring-purple" : ""
            }`}
            style={{ backgroundColor: bgColor, color: "#555" }}
          >
            BG
          </button>
        </div>
      </div>
    </div>
  );
}
