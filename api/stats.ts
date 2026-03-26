import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Count UNIQUE authenticated users (not rows — one user can join many rooms)
  const { data } = await supabase
    .from("doodl_users")
    .select("auth_id")
    .not("auth_id", "is", null);

  const uniqueUsers = new Set((data ?? []).map((d) => d.auth_id));

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json({ users: uniqueUsers.size });
}
