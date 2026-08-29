"use client";

import { useEffect, useState } from "react";

// Lightweight connectivity indicator. Uses the browser online/offline events
// only — no polling, no external service.
export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();

    const onOffline = () => setOnline(false);
    const onOnline = () => {
      setOnline(true);
      setShowBack(true);
      window.setTimeout(() => setShowBack(false), 2500);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (online && !showBack) return null;

  return (
    <div
      role="status"
      className={`sticky top-0 z-20 px-4 py-2 text-center text-sm font-medium text-white ${
        online ? "bg-emerald-600" : "bg-amber-600"
      }`}
    >
      {online ? "Back online" : "Offline — changes cannot be saved."}
    </div>
  );
}
