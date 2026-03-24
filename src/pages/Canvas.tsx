import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRoom } from "../lib/room";

const COLORS = ["#F5F5F5", "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#7C3AED"];
const BRUSH_SIZES = [3, 6, 12];

export default function Canvas() {
  const navigate = useNavigate();
  const { roomId, userId } = useRoom();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [isEraser, setIsEraser] = useState(false);
  const [sending, setSending] = useState(false);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!roomId) { navigate("/"); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#0A0A0A";
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, [roomId, navigate]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    drawing.current = true;
    const pos = getPos(e);
    lastPoint.current = pos;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, (isEraser ? brushSize * 2 : brushSize) / 2, 0, Math.PI * 2);
    ctx.fillStyle = isEraser ? "#0A0A0A" : color;
    ctx.fill();
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = isEraser ? "#0A0A0A" : color;
    ctx.lineWidth = isEraser ? brushSize * 2 : brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPoint.current!.x, lastPoint.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPoint.current = pos;
  };

  const endDraw = () => {
    drawing.current = false;
    lastPoint.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#0A0A0A";
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

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
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

      {/* Toolbar */}
      <div className="bg-surface border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-2">
          {/* Colors */}
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { setColor(c); setIsEraser(false); }}
                className={`w-7 h-7 rounded-full border-2 ${
                  color === c && !isEraser ? "border-purple" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Brush size */}
          <div className="flex gap-1">
            {BRUSH_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setBrushSize(s)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  brushSize === s && !isEraser ? "bg-purple/20" : "bg-background"
                }`}
              >
                <div
                  className="rounded-full bg-foreground"
                  style={{ width: s + 2, height: s + 2 }}
                />
              </button>
            ))}
          </div>

          {/* Eraser */}
          <button
            onClick={() => setIsEraser(!isEraser)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
              isEraser ? "bg-purple text-white" : "bg-background text-muted"
            }`}
          >
            Eraser
          </button>

          {/* Clear */}
          <button
            onClick={clearCanvas}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-background text-muted"
          >
            Clear
          </button>

          {/* Send */}
          <button
            onClick={sendDoodle}
            disabled={sending}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-purple text-white disabled:opacity-50"
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
