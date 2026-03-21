import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const APP_BUILD_ID = __APP_BUILD_ID__;
let hasReloadedAfterSwUpdate = false;

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(`/sw.js?build=${encodeURIComponent(APP_BUILD_ID)}`, {
        scope: "/",
        updateViaCache: "none",
      });

      await registration.update();

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (hasReloadedAfterSwUpdate) return;
        hasReloadedAfterSwUpdate = true;
        window.location.reload();
      });
    } catch (error) {
      console.warn("[SW] registration failed", error);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
