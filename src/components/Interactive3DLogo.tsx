import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import logoIcon from "@/assets/logo-vitrapay-icon.png";

export function Interactive3DLogo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const logoSrc = isDark ? logoDark : logoLight;

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
        {/* Glow */}
        <div className="absolute -inset-4 rounded-full bg-primary/10 blur-3xl" />

        {/* Shadow layer */}
        <motion.img
          src={logoSrc}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-contain blur-lg opacity-30"
          style={{ transform: "translateZ(-30px) scale(1.15)" }}
        />

        {/* Main logo */}
        <motion.img
          src={logoSrc}
          alt="VitraPay Logo 3D"
          className="relative w-full h-full object-contain drop-shadow-[0_0_25px_hsla(48,96%,53%,0.3)]"
          style={{ transform: "translateZ(30px)" }}
        />
      </motion.div>
    </div>
  );
}
