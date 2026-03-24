import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(() => {
      navigate("/", { replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center">
      <p className="text-muted text-sm">Signing in...</p>
    </div>
  );
}
