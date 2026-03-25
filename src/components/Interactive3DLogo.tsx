import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import logoIcon from "@/assets/logo-vitrapay-icon.webp";

export function Interactive3DLogo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const springConfig = { damping: 20, stiffness: 120 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const rotateX = useTransform(smoothY, [0, 1], [20, -20]);
  const rotateY = useTransform(smoothX, [0, 1], [-20, 20]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxDist = 600;
      const dx = (e.clientX - centerX) / maxDist;
      const dy = (e.clientY - centerY) / maxDist;
      mouseX.set(Math.max(0, Math.min(1, 0.5 + dx * 0.5)));
      mouseY.set(Math.max(0, Math.min(1, 0.5 + dy * 0.5)));
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{ perspective: "800px" }}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className="relative w-full h-full"
      >
        {/* Subtle glow behind logo */}
        <div className="absolute inset-8 rounded-full bg-primary/8 blur-2xl pointer-events-none" />

        {/* Main logo — crisp, no blur effects */}
        <motion.img
          src={logoIcon}
          alt="VitraPay Logo 3D"
          className="relative w-full h-full object-contain"
          style={{ transform: "translateZ(30px)", imageRendering: "auto" }}
        />
      </motion.div>
    </div>
  );
}
