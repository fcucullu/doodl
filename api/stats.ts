import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Count unique authenticated users who have used Doodl
  // (profiles table is populated on Google sign-in via trigger)
  const { count } = await supabase
    .from("doodl_users")
    .select("auth_id", { count: "exact", head: true })
    .not("auth_id", "is", null);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json({ users: count ?? 0 });
}
