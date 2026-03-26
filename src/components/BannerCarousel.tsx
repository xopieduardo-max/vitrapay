import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
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
  className = "",
}: BannerCarouselProps) {
  const [current, setCurrent] = useState(0);

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

  // Combine DB banners with fallback
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

  const next = useCallback(() => {
    if (count <= 1) return;
    setCurrent((c) => (c + 1) % count);
  }, [count]);

  const prev = useCallback(() => {
    if (count <= 1) return;
    setCurrent((c) => (c - 1 + count) % count);
  }, [count]);

  // Auto-rotate every 3 seconds
  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(next, 3000);
    return () => clearInterval(timer);
  }, [count, next]);

  // Reset index if banners change
  useEffect(() => {
    setCurrent(0);
  }, [count]);

  if (slides.length === 0) return null;

  const slide = slides[current];

  const Wrapper = slide.link_url ? "a" : "div";
  const wrapperProps = slide.link_url
    ? { href: slide.link_url, target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <div className={`relative rounded-xl overflow-hidden group ${className}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id + current}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Wrapper
            {...(wrapperProps as any)}
            className="block cursor-pointer hover:opacity-95 transition-opacity"
          >
            <img
              src={slide.image_url || ""}
              alt={slide.title || "Banner"}
              className="w-full h-auto object-contain rounded-xl"
              style={{ aspectRatio: "3.75 / 1" }}
              loading="lazy"
              decoding="async"
            />
          </Wrapper>
        </motion.div>
      </AnimatePresence>

      {/* Navigation arrows */}
      {count > 1 && (
        <>
          <button
            onClick={(e) => { e.preventDefault(); prev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Banner anterior"
          >
            <ChevronLeft className="h-4 w-4 text-foreground" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); next(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Próximo banner"
          >
            <ChevronRight className="h-4 w-4 text-foreground" />
          </button>
        </>
      )}

      {/* Dots */}
      {count > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
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
