import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface AppEntry {
  slug: string;
  title: string;
  description: string;
  url: string;
  img: string;
  tags: string[];
  status: "live" | "beta" | "offline";
}

const statusConfig = {
  live: { label: "Live", bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  beta: { label: "Beta", bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  offline: { label: "Offline", bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400" },
};

export default function Apps() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("https://franciscocucullu.com/api/apps.json")
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((data) => setApps(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-bold">Apps</h1>
        <button onClick={() => navigate(-1)} className="text-muted text-sm">← Back</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+4rem+env(safe-area-inset-bottom))]">
        <div className="text-center mb-6">
          <p className="text-xs text-purple-light font-medium uppercase tracking-widest mb-2">Indie Dev</p>
          <h2 className="text-2xl font-bold mb-2">Apps I Build</h2>
          <p className="text-sm text-muted max-w-xs mx-auto">
            Side projects shipped from scratch. Designed, coded, and maintained solo.
          </p>
        </div>

        <div className="space-y-3">
          {loading && <p className="text-center py-8 text-muted text-sm">Loading apps...</p>}
          {error && (
            <div className="text-center py-8 text-muted text-sm">
              Could not load apps.{" "}
              <a href="https://franciscocucullu.com/apps/" target="_blank" className="text-purple-light underline">
                View on website
              </a>
            </div>
          )}
          {apps.map((app) => {
            const status = statusConfig[app.status];
            return (
              <a
                key={app.slug}
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-surface rounded-2xl border border-border p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">{app.title}</h3>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {app.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple/10 text-muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${status.bg} ${status.text} shrink-0`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">{app.description}</p>
                <span className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-purple-light">
                  Open App →
                </span>
              </a>
            );
          })}
        </div>

        <div className="text-center mt-6">
          <a href="https://franciscocucullu.com/apps/" target="_blank" className="text-[11px] text-muted/60 hover:text-purple-light">
            View all on franciscocucullu.com
          </a>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border">
        <div className="flex pb-[env(safe-area-inset-bottom)]">
          <button onClick={() => navigate("/canvas")} className="flex-1 py-3 text-center text-xs text-muted">
            <span className="text-lg block">✏️</span>Canvas
          </button>
          <button onClick={() => navigate("/feed")} className="flex-1 py-3 text-center text-xs text-muted">
            <span className="text-lg block">🖼️</span>Feed
          </button>
          <button onClick={() => navigate("/apps")} className="flex-1 py-3 text-center text-xs text-purple">
            <span className="text-lg block">🚀</span>Apps
          </button>
        </div>
      </div>
    </div>
  );
}
