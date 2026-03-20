import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Auto-update service worker: check every 60s and reload when new version is available
const updateSW = registerSW({
  onNeedRefresh() {
    // Automatically update without prompting
    updateSW(true);
  },
  onOfflineReady() {
    console.log("[PWA] App ready for offline use");
  },
});

// Also check for updates periodically (every 60 seconds)
setInterval(() => {
  updateSW();
}, 60 * 1000);

createRoot(document.getElementById("root")!).render(<App />);
