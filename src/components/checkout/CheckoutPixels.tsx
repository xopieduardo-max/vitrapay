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

export function useCheckoutPixels(pixels: Pixel[]) {
  useEffect(() => {
    if (!pixels.length) return;

    const scripts: HTMLScriptElement[] = [];

    pixels.forEach((px) => {
      if (!px.pixel_id) return;

      if (px.platform === "facebook") {
        const script = document.createElement("script");
        script.innerHTML = `
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window,document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${px.pixel_id}');
          fbq('track', 'PageView');
        `;
        document.head.appendChild(script);
        scripts.push(script);
      }

      if (px.platform === "google_analytics") {
        const gtagScript = document.createElement("script");
        gtagScript.async = true;
        gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${px.pixel_id}`;
        document.head.appendChild(gtagScript);
        scripts.push(gtagScript);

        const initScript = document.createElement("script");
        initScript.innerHTML = `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${px.pixel_id}');
        `;
        document.head.appendChild(initScript);
        scripts.push(initScript);
      }

      if (px.platform === "google_ads") {
        if (!document.querySelector('script[src*="googletagmanager"]')) {
          const gtagScript = document.createElement("script");
          gtagScript.async = true;
          gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${px.pixel_id}`;
          document.head.appendChild(gtagScript);
          scripts.push(gtagScript);

          const initScript = document.createElement("script");
          initScript.innerHTML = `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
          `;
          document.head.appendChild(initScript);
          scripts.push(initScript);
        }

        const configScript = document.createElement("script");
        configScript.innerHTML = `gtag('config', '${px.pixel_id}');`;
        document.head.appendChild(configScript);
        scripts.push(configScript);
      }

      if (px.platform === "tiktok") {
        const script = document.createElement("script");
        script.innerHTML = `
          !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
          ttq.methods=["page","track","identify","instances","debug","on","off",
          "once","ready","alias","group","enableCookie","disableCookie"],
          ttq.setAndDefer=function(t,e){t[e]=function(){
          t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
          for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
          ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;
          n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
          ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
          ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,
          ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},
          ttq._o[e]=n||{};var o=document.createElement("script");
          o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;
          var a=document.getElementsByTagName("script")[0];
          a.parentNode.insertBefore(o,a)};
          ttq.load('${px.pixel_id}');
          ttq.page();
          }(window,document,'ttq');
        `;
        document.head.appendChild(script);
        scripts.push(script);
      }
    });

    return () => {
      scripts.forEach((script) => script.remove());
    };
  }, [pixels]);
}

export function firePixelEvent(
  pixels: Pixel[],
  event: "InitiateCheckout" | "Purchase",
  value?: number,
  currency = "BRL"
) {
  pixels.forEach((px) => {
    if (!px.pixel_id) return;
    const w = window as any;

    if (px.platform === "facebook" && w.fbq) {
      if (event === "InitiateCheckout") {
        w.fbq("track", "InitiateCheckout");
      } else if (event === "Purchase" && value) {
        w.fbq("track", "Purchase", { value: value / 100, currency });
      }
    }

    if (px.platform === "google_analytics" && w.gtag) {
      if (event === "Purchase" && value) {
        w.gtag("event", "purchase", { value: value / 100, currency });
      }
    }

    if (px.platform === "google_ads" && w.gtag) {
      if (event === "Purchase" && value) {
        const conversionLabel = px.config?.conversion_label;
        const sendTo = conversionLabel ? `${px.pixel_id}/${conversionLabel}` : px.pixel_id;

        w.gtag("event", "conversion", {
          send_to: sendTo,
          value: value / 100,
          currency,
        });
      }
    }

    if (px.platform === "tiktok" && w.ttq) {
      if (event === "InitiateCheckout") {
        w.ttq.track("InitiateCheckout");
      } else if (event === "Purchase" && value) {
        w.ttq.track("CompletePayment", { value: value / 100, currency });
      }
    }
  });
}
