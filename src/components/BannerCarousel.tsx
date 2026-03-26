import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface BannerCarouselProps {
  location: "dashboard" | "marketplace";
  fallbackSrc?: string;
  fallbackAlt?: string;
  maxHeight?: number;
  className?: string;
}

export default function BannerCarousel({
  location,
  fallbackSrc,
  fallbackAlt = "Banner",
  maxHeight = 160,
  className = "",
}: BannerCarouselProps) {
  const [current, setCurrent] = useState(0);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: banners = [] } = useQuery({
    queryKey: ["platform-banners", location],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_banners")
        .select("*")
        .eq("is_active", true)
        .or(`location.eq.${location},location.eq.both`)
        .order("position", { ascending: true });
      return data || [];
    },
  });

  // Fetch rotation interval from platform_fees
  const { data: intervalSeconds = 5 } = useQuery({
    queryKey: ["banner-interval"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_fees")
        .select("banner_interval_seconds")
        .limit(1)
        .single();
      return (data as any)?.banner_interval_seconds ?? 5;
    },
    staleTime: 60000,
  });

  const slides = banners.length > 0
    ? banners.map((b: any) => ({
        id: b.id,
        image_url: b.image_url,
        link_url: b.link_url,
        title: b.title,
      }))
    : fallbackSrc
      ? [{ id: "fallback", image_url: fallbackSrc, link_url: null, title: fallbackAlt }]
      : [];

  const count = slides.length;

  const goTo = useCallback((index: number) => {
    setCurrent(index);
  }, []);

  const next = useCallback(() => {
    if (count <= 1) return;
    setCurrent((c) => (c + 1) % count);
  }, [count]);

  const prev = useCallback(() => {
    if (count <= 1) return;
    setCurrent((c) => (c - 1 + count) % count);
  }, [count]);

  // Auto-rotate
  useEffect(() => {
    if (count <= 1) return;
    timerRef.current = setInterval(next, intervalSeconds * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [count, next, intervalSeconds]);

  // Reset index if banners change
  useEffect(() => {
    setCurrent(0);
  }, [count]);

  if (slides.length === 0) return null;

  return (
    <div className={`relative rounded-xl overflow-hidden group ${className}`} style={{ maxHeight }}>
      {/* All slides stacked, only current one visible via opacity */}
      {slides.map((slide, i) => {
        const Wrapper = slide.link_url ? "a" : "div";
        const wrapperProps = slide.link_url
          ? { href: slide.link_url, target: "_blank" as const, rel: "noopener noreferrer" }
          : {};

        return (
          <div
            key={slide.id}
            className="absolute inset-0 transition-opacity duration-500 ease-in-out"
            style={{ opacity: i === current ? 1 : 0, zIndex: i === current ? 1 : 0 }}
          >
            <Wrapper
              {...(wrapperProps as any)}
              className="block w-full h-full cursor-pointer"
            >
              <img
                src={slide.image_url || ""}
                alt={slide.title || "Banner"}
                className="w-full h-full object-cover rounded-xl"
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
              />
            </Wrapper>
          </div>
        );
      })}

      {/* Spacer to maintain height */}
      <div style={{ maxHeight }} className="w-full">
        <img
          src={slides[0]?.image_url || ""}
          alt=""
          className="w-full h-auto object-cover rounded-xl invisible"
          style={{ maxHeight }}
        />
      </div>

      {/* Navigation arrows */}
      {count > 1 && (
        <>
          <button
            onClick={(e) => { e.preventDefault(); prev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            aria-label="Banner anterior"
          >
            <ChevronLeft className="h-4 w-4 text-foreground" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); next(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            aria-label="Próximo banner"
          >
            <ChevronRight className="h-4 w-4 text-foreground" />
          </button>
        </>
      )}

      {/* Dots */}
      {count > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === current
                  ? "w-4 bg-primary"
                  : "w-1.5 bg-foreground/30"
              }`}
              aria-label={`Banner ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
