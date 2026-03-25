import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = req.query.userId as string;
  const roomId = req.query.roomId as string;

  if (!userId || !roomId) {
    return res.json({ count: 0 });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get user's last_seen_at
  const { data: doodlUser } = await supabase
    .from("doodl_users")
    .select("last_seen_at")
    .eq("id", userId)
    .single();

  if (!doodlUser) return res.json({ count: 0 });

  // Count doodles in the room newer than last_seen_at, not sent by this user
  const { count } = await supabase
    .from("doodl_doodles")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId)
    .neq("sender_id", userId)
    .gt("created_at", doodlUser.last_seen_at);

  res.json({ count: count ?? 0 });
}
