"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Registers the service worker and offers an "add to home screen" prompt.
 * A daily game belongs on a home screen, not in a bookmark folder.
 */
export default function PwaSetup() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    try {
      setDismissed(localStorage.getItem("lily-install-dismissed") === "1");
    } catch {
      setDismissed(false);
    }
    // iOS never fires beforeinstallprompt — Safari users must be shown the way
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) ||
      (ua.includes("Macintosh") && "ontouchend" in document);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIos(isIos && !standalone);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (dismissed || (!prompt && !ios)) return null;

  const close = () => {
    setDismissed(true);
    try { localStorage.setItem("lily-install-dismissed", "1"); } catch {}
  };

  return (
    <div className="install-bar">
      <span className="install-icon">🌸</span>
      <div className="install-text">
        <b>Keep your garden on your home screen</b>
        {prompt ? (
          <span>One tap to water, and reminders can reach you.</span>
        ) : (
          <span>
            Tap <b className="ios-share" aria-label="the Share button">⎋</b> Share, then{" "}
            <b>&ldquo;Add to Home Screen&rdquo;</b> — it opens full screen like an app.
          </span>
        )}
      </div>
      {prompt && (
        <button
          className="btn small"
          onClick={async () => {
            await prompt.prompt();
            await prompt.userChoice;
            close();
          }}
        >
          Add
        </button>
      )}
      <button className="install-close" onClick={close} aria-label="Not now">✕</button>
    </div>
  );
}
