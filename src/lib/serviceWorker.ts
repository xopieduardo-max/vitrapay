const APP_BUILD_ID = __APP_BUILD_ID__;

const SERVICE_WORKER_ROUTES = [
  "/dashboard",
  "/marketplace",
  "/product",
  "/products",
  "/sales",
  "/affiliates",
  "/library",
  "/purchases",
  "/finance",
  "/community",
  "/settings",
] as const;

export function isServiceWorkerSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
}

export function shouldUseServiceWorker(pathname: string) {
  return SERVICE_WORKER_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function clearServiceWorkerState() {
  if (!isServiceWorkerSupported()) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((key) => caches.delete(key)));
  }
}

let serviceWorkerRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export async function getAppServiceWorkerRegistration() {
  if (!isServiceWorkerSupported() || !shouldUseServiceWorker(window.location.pathname)) {
    return null;
  }

  if (!serviceWorkerRegistrationPromise) {
    serviceWorkerRegistrationPromise = navigator.serviceWorker
      .register(`/sw.js?build=${encodeURIComponent(APP_BUILD_ID)}`, {
        scope: "/",
        updateViaCache: "none",
      })
      .then(async (registration) => {
        await registration.update();
        return navigator.serviceWorker.ready;
      })
      .catch((error) => {
        console.warn("[SW] registration failed", error);
        serviceWorkerRegistrationPromise = null;
        return null;
      });
  }

  return serviceWorkerRegistrationPromise;
}
