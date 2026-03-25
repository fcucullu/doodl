import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    // Send push notification to room members
    const { roomId, senderId, imageUrl, senderNickname } = req.body;

    if (!roomId || !senderId) {
      return res.status(400).json({ error: "Missing roomId or senderId" });
    }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.VITE_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );

    // Get all users in the room except sender
    const { data: roomUsers } = await supabase
      .from("doodl_users")
      .select("id")
      .eq("room_id", roomId)
      .neq("id", senderId);

    if (!roomUsers || roomUsers.length === 0) {
      return res.json({ sent: 0 });
    }

    // Get push subscriptions for those users
    const userIds = roomUsers.map((u) => u.id);
    const { data: subs } = await supabase
      .from("doodl_push_subs")
      .select("*")
      .in("user_id", userIds);

    if (!subs || subs.length === 0) {
      return res.json({ sent: 0 });
    }

    // Get room name
    const { data: room } = await supabase
      .from("doodl_rooms")
      .select("name")
      .eq("id", roomId)
      .single();

    const payload = JSON.stringify({
      title: room?.name || "Doodl",
      body: `${senderNickname || "Alguien"} te envió un doodle!`,
      icon: "/icon-192.png",
      image: imageUrl,
      url: "/feed",
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
          },
          payload
        );
        sent++;
      } catch (err: any) {
        // Remove invalid subscriptions
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from("doodl_push_subs").delete().eq("id", sub.id);
        }
      }
    }

    return res.json({ sent });
  }

  // PUT — register push subscription
  if (req.method === "PUT") {
    const { userId, subscription } = req.body;
    if (!userId || !subscription) {
      return res.status(400).json({ error: "Missing userId or subscription" });
    }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase.from("doodl_push_subs").upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
      },
      { onConflict: "endpoint" }
    );

    return res.json({ ok: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
