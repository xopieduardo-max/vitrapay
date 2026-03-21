import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

const UPDATE_INTERVAL_MS = 30 * 1000;
const APP_BUILD_ID = __APP_BUILD_ID__;

let isRefreshing = false;

async function clearAppCachesAndReload() {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.warn("[PWA] Failed to clear caches before reload", error);
  } finally {
    window.location.reload();
  }
}

async function checkPublishedVersion() {
  if (import.meta.env.DEV || isRefreshing) return;

  try {
    const response = await fetch(`/manifest.webmanifest?build-check=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "cache-control": "no-cache, no-store, must-revalidate",
      },
    });

    if (!response.ok) return;

    const manifest = await response.json();
    const latestBuildId = typeof manifest?.version === "string" ? manifest.version : null;

    if (latestBuildId && latestBuildId !== APP_BUILD_ID) {
      console.log("[PWA] New deployed version detected", latestBuildId);
      await clearAppCachesAndReload();
    }
  } catch (error) {
    console.warn("[PWA] Version check failed", error);
  }
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateSW(true);
    void clearAppCachesAndReload();
  },
  onOfflineReady() {
    console.log("[PWA] App ready for offline use");
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    void registration.update();

    window.setInterval(() => {
      void registration.update();
      void checkPublishedVersion();
    }, UPDATE_INTERVAL_MS);
  },
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    void clearAppCachesAndReload();
  });
}

window.addEventListener("focus", () => {
  void checkPublishedVersion();
});

window.setInterval(() => {
  void updateSW();
  void checkPublishedVersion();
}, UPDATE_INTERVAL_MS);

void checkPublishedVersion();

createRoot(document.getElementById("root")!).render(<App />);
