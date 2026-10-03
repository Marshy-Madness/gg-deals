import { Navigation, Router } from "@decky/ui";
import { useEffect, useState } from "react";
import { formatPrice, getPrice, onSettingsChanged, PriceResult } from "./api";

declare global {
  interface Window {
    MainWindowBrowserManager?: any;
  }
}

// Returns the Steam app ID of the store page currently open in the Gamepad UI
// browser, or null when the store isn't showing an app page.
function readStoreAppId(): string | null {
  const route: string | undefined = (Router as any).WindowStore?.GamepadUIMainWindowInstance
    ?.m_history?.location?.pathname;
  if (route !== undefined && !route.startsWith("/steamweb")) return null;

  const path: string | undefined = window.MainWindowBrowserManager?.m_lastLocation?.pathname;
  return path?.match(/^\/app\/(\d+)/)?.[1] ?? null;
}

function useStoreAppId() {
  const [appId, setAppId] = useState<string | null>(readStoreAppId);
  useEffect(() => {
    // Polling is the most reliable signal across Steam client updates;
    // it's a couple of property reads every half second.
    const timer = setInterval(() => setAppId(readStoreAppId()), 500);
    return () => clearInterval(timer);
  }, []);
  return appId;
}

export function StoreBadge() {
  const appId = useStoreAppId();
  const [price, setPrice] = useState<PriceResult | null>(null);
  const [settingsVersion, setSettingsVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = onSettingsChanged(() => setSettingsVersion((v) => v + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setPrice(null);
    if (!appId) return;
    let cancelled = false;
    getPrice(appId)
      .then((result) => !cancelled && setPrice(result))
      .catch((e) => !cancelled && setPrice({ status: "error", message: String(e) }));
    return () => {
      cancelled = true;
    };
  }, [appId, settingsVersion]);

  if (!appId || !price || price.status === "not_found") return null;

  let main: string;
  let detail: string | null = null;
  if (price.status === "ok") {
    main = `Lowest: ${formatPrice(price.lowest, price.currency)}`;
    detail = price.source;
  } else if (price.status === "no_key") {
    main = "Add your API key in the plugin settings";
  } else {
    main = "Couldn't load price";
    detail = price.message;
  }

  const url = price.status === "ok" ? price.url : null;

  return (
    <div
      onClick={() => url && Navigation.NavigateToExternalWeb(url)}
      style={{
        position: "fixed",
        top: "52px",
        right: "16px",
        zIndex: 7002,
        padding: "6px 12px",
        borderRadius: "6px",
        background: "rgba(14, 20, 27, 0.92)",
        border: "1px solid #2a475e",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
        color: "#fff",
        fontSize: "14px",
        lineHeight: "18px",
        pointerEvents: url ? "auto" : "none",
      }}
    >
      <div style={{ fontSize: "11px", color: "#8f98a0", letterSpacing: "0.5px" }}>GG.DEALS</div>
      <div style={{ fontWeight: "bold", color: price.status === "ok" ? "#a4d007" : "#fff" }}>
        {main}
      </div>
      {detail && <div style={{ fontSize: "12px", color: "#8f98a0" }}>{detail}</div>}
    </div>
  );
}
