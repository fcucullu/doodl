import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Accept either single userId/roomId or authId for multi-room
  const authId = req.query.authId as string;
  const userId = req.query.userId as string;
  const roomId = req.query.roomId as string;

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let totalUnseen = 0;

  if (authId) {
    // Multi-room: count unseen across all rooms for this auth user
    const { data: doodlUsers } = await supabase
      .from("doodl_users")
      .select("id, room_id, last_seen_at")
      .eq("auth_id", authId);

    if (doodlUsers) {
      for (const du of doodlUsers) {
        const { count } = await supabase
          .from("doodl_doodles")
          .select("*", { count: "exact", head: true })
          .eq("room_id", du.room_id)
          .neq("sender_id", du.id)
          .gt("created_at", du.last_seen_at || "1970-01-01");
        totalUnseen += count ?? 0;
      }
    }
  } else if (userId && roomId) {
    // Single room fallback
    const { data: user } = await supabase
      .from("doodl_users")
      .select("last_seen_at")
      .eq("id", userId)
      .single();

    if (user) {
      const { count } = await supabase
        .from("doodl_doodles")
        .select("*", { count: "exact", head: true })
        .eq("room_id", roomId)
        .neq("sender_id", userId)
        .gt("created_at", user.last_seen_at || "1970-01-01");
      totalUnseen = count ?? 0;
    }
  }

  res.json({ count: totalUnseen });
}
