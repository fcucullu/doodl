import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(() => {
      // Restore pending room code if user was joining via shared link
      const pendingCode = localStorage.getItem("doodl_pending_code");
      if (pendingCode) {
        localStorage.removeItem("doodl_pending_code");
        navigate(`/?code=${pendingCode}&new=1`, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center">
      <p className="text-muted text-sm">Signing in...</p>
    </div>
  );
}
