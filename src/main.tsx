import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { clearServiceWorkerState, getAppServiceWorkerRegistration, shouldUseServiceWorker } from "./lib/serviceWorker";

const APP_BUILD_ID = __APP_BUILD_ID__;
const PUBLIC_ROUTE_RESET_KEY = `public-sw-reset:${APP_BUILD_ID}`;
let hasReloadedAfterSwUpdate = false;

async function syncServiceWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) {
    return;
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hasReloadedAfterSwUpdate) return;
    hasReloadedAfterSwUpdate = true;
    window.location.reload();
  });

  if (shouldUseServiceWorker(window.location.pathname)) {
    await getAppServiceWorkerRegistration();
    return;
  }

  const wasControlled = !!navigator.serviceWorker.controller;
  await clearServiceWorkerState();

  if (wasControlled && sessionStorage.getItem(PUBLIC_ROUTE_RESET_KEY) !== "done") {
    sessionStorage.setItem(PUBLIC_ROUTE_RESET_KEY, "done");
    window.location.reload();
    return;
  }

  sessionStorage.removeItem(PUBLIC_ROUTE_RESET_KEY);
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void syncServiceWorker();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
