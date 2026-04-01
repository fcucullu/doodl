import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "doodl_install_dismissed";
const DISMISS_DAYS = 7;

function isDismissed(): boolean {
  if (typeof window === "undefined") return true;
  const dismissed = localStorage.getItem(DISMISS_KEY);
  if (!dismissed) return false;
  const dismissedAt = parseInt(dismissed, 10);
  return Date.now() - dismissedAt < DISMISS_DAYS * 86400000;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [iosExpanded, setIosExpanded] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || isDismissed()) return;

    if (isIOS()) {
      setShowIOSGuide(true);
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="bg-surface rounded-2xl border border-border p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-purple/15 flex items-center justify-center shrink-0">
        <Download className="w-5 h-5 text-purple" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold mb-0.5">Install Doodl</p>
        {showIOSGuide ? (
          iosExpanded ? (
            <div className="space-y-3 mt-1">
              <div className="flex items-start gap-2">
                <span className="bg-purple text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
                <p className="text-xs text-muted">Tap the <Share className="w-3.5 h-3.5 inline -mt-0.5 text-foreground" /> <span className="font-medium text-foreground">Share</span> button in Safari</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-purple text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
                <p className="text-xs text-muted">Scroll down and tap <span className="font-medium text-foreground">&quot;Add to Home Screen&quot;</span></p>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-purple text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
                <p className="text-xs text-muted">Tap <span className="font-medium text-foreground">&quot;Add&quot;</span> to confirm</p>
              </div>
              <p className="text-[10px] text-muted">Doodl will appear on your home screen like a regular app!</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted mb-2">Add to your home screen for the best experience</p>
              <button
                onClick={() => setIosExpanded(true)}
                className="bg-purple text-white text-xs font-medium px-4 py-1.5 rounded-lg hover:bg-purple/80 transition-colors"
              >
                Show me how
              </button>
            </>
          )
        ) : (
          <>
            <p className="text-xs text-muted mb-2">Add to your home screen for the best experience</p>
            <button
              onClick={handleInstall}
              className="bg-purple text-white text-xs font-medium px-4 py-1.5 rounded-lg hover:bg-purple/80 transition-colors"
            >
              Install
            </button>
          </>
        )}
      </div>
      <button onClick={handleDismiss} className="p-1 text-muted hover:text-foreground shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
