import { useEffect } from "react";

interface Pixel {
  id: string;
  platform: string;
  pixel_id: string;
  access_token?: string;
  config: Record<string, any>;
}

interface Props {
  pixels: Pixel[];
  event?: "PageView" | "InitiateCheckout" | "Purchase";
  purchaseValue?: number;
}

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    ttq: any;
    TiktokAnalyticsObject: string;
  }
}

// Helper: load an external script and return a promise
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Avoid loading the same script twice
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(s);
  });
}

export function useCheckoutPixels(pixels: Pixel[]) {
  useEffect(() => {
    if (!pixels.length) return;

    let cancelled = false;

    const initPixels = async () => {
      if (cancelled) return;

      for (const px of pixels) {
        if (!px.pixel_id || cancelled) continue;

        if (px.platform === "facebook") {
          try {
            // Initialize fbq inline (the snippet minus the external script load)
            if (!window.fbq) {
              const n: any = (window.fbq = function (...args: any[]) {
                n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
              });
              if (!window._fbq) window._fbq = n;
              n.push = n;
              n.loaded = true;
              n.version = "2.0";
              n.queue = [];
            }

            // Load the external Facebook SDK
            await loadScript("https://connect.facebook.net/en_US/fbevents.js");

            if (!cancelled) {
              window.fbq("init", px.pixel_id);
              window.fbq("track", "PageView");
              console.log("[Pixel] Facebook initialized:", px.pixel_id);
            }
          } catch (err) {
            console.error("[Pixel] Failed to load Facebook SDK:", err);
          }
        }

        if (px.platform === "google_analytics") {
          try {
            await loadScript(`https://www.googletagmanager.com/gtag/js?id=${px.pixel_id}`);
            if (!cancelled) {
              window.dataLayer = window.dataLayer || [];
              window.gtag = function (...args: any[]) {
                window.dataLayer.push(args);
              };
              window.gtag("js", new Date());
              window.gtag("config", px.pixel_id);
              console.log("[Pixel] Google Analytics initialized:", px.pixel_id);
            }
          } catch (err) {
            console.error("[Pixel] Failed to load GA:", err);
          }
        }

        if (px.platform === "google_ads") {
          try {
            if (!document.querySelector('script[src*="googletagmanager"]')) {
              await loadScript(`https://www.googletagmanager.com/gtag/js?id=${px.pixel_id}`);
              if (!cancelled) {
                window.dataLayer = window.dataLayer || [];
                window.gtag = function (...args: any[]) {
                  window.dataLayer.push(args);
                };
                window.gtag("js", new Date());
              }
            }
            if (!cancelled) {
              window.gtag("config", px.pixel_id);
              console.log("[Pixel] Google Ads initialized:", px.pixel_id);
            }
          } catch (err) {
            console.error("[Pixel] Failed to load Google Ads:", err);
          }
        }

        if (px.platform === "tiktok") {
          try {
            // Initialize ttq inline
            if (!window.ttq) {
              const w = window as any;
              w.TiktokAnalyticsObject = "ttq";
              const ttq: any = (w.ttq = w.ttq || []);
              ttq.methods = [
                "page", "track", "identify", "instances", "debug", "on", "off",
                "once", "ready", "alias", "group", "enableCookie", "disableCookie",
              ];
              ttq.setAndDefer = function (t: any, e: string) {
                t[e] = function () {
                  t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
                };
              };
              for (let i = 0; i < ttq.methods.length; i++) {
                ttq.setAndDefer(ttq, ttq.methods[i]);
              }
              ttq.instance = function (t: string) {
                const e = ttq._i[t] || [];
                for (let n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
                return e;
              };
              ttq.load = function (e: string, n?: any) {
                ttq._i = ttq._i || {};
                ttq._i[e] = [];
                ttq._i[e]._u = "https://analytics.tiktok.com/i18n/pixel/events.js";
                ttq._t = ttq._t || {};
                ttq._t[e] = +new Date();
                ttq._o = ttq._o || {};
                ttq._o[e] = n || {};
              };
            }

            window.ttq.load(px.pixel_id);
            await loadScript(`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${px.pixel_id}&lib=ttq`);

            if (!cancelled) {
              window.ttq.page();
              console.log("[Pixel] TikTok initialized:", px.pixel_id);
            }
          } catch (err) {
            console.error("[Pixel] Failed to load TikTok:", err);
          }
        }
      }
    };

    // Defer pixel loading to after page render
    if (typeof requestIdleCallback !== "undefined") {
      const handle = requestIdleCallback(() => initPixels());
      return () => {
        cancelled = true;
        cancelIdleCallback(handle);
      };
    } else {
      const timeout = setTimeout(() => initPixels(), 100);
      return () => {
        cancelled = true;
        clearTimeout(timeout);
      };
    }
  }, [pixels]);
}

export function firePixelEvent(
  pixels: Pixel[],
  event: "InitiateCheckout" | "Purchase",
  value?: number,
  currency = "BRL",
  eventId?: string
) {
  pixels.forEach((px) => {
    if (!px.pixel_id) return;

    if (px.platform === "facebook" && window.fbq) {
      if (event === "InitiateCheckout") {
        const eid = eventId || `ic_${Date.now()}`;
        window.fbq("track", "InitiateCheckout", {}, { eventID: eid });
        console.log("[Pixel] Facebook InitiateCheckout fired, eventID:", eid);
      } else if (event === "Purchase" && value) {
        const eid = eventId || `pur_${Date.now()}`;
        window.fbq("track", "Purchase", { value: value / 100, currency }, { eventID: eid });
        console.log("[Pixel] Facebook Purchase fired, value:", value / 100, "eventID:", eid);
      }
    }

    if (px.platform === "google_analytics" && window.gtag) {
      if (event === "Purchase" && value) {
        window.gtag("event", "purchase", { value: value / 100, currency });
      }
    }

    if (px.platform === "google_ads" && window.gtag) {
      if (event === "Purchase" && value) {
        const conversionLabel = px.config?.conversion_label;
        const sendTo = conversionLabel ? `${px.pixel_id}/${conversionLabel}` : px.pixel_id;
        window.gtag("event", "conversion", {
          send_to: sendTo,
          value: value / 100,
          currency,
        });
      }
    }

    if (px.platform === "tiktok" && window.ttq) {
      if (event === "InitiateCheckout") {
        window.ttq.track("InitiateCheckout");
      } else if (event === "Purchase" && value) {
        window.ttq.track("CompletePayment", { value: value / 100, currency });
      }
    }
  });
}
