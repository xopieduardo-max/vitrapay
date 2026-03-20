import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import logoIcon from "@/assets/logo-vitrapay.png";

export function Interactive3DLogo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const springConfig = { damping: 20, stiffness: 150 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const rotateX = useTransform(smoothY, [0, 1], [25, -25]);
  const rotateY = useTransform(smoothX, [0, 1], [-25, 25]);
  const glowX = useTransform(smoothX, [0, 1], ["0%", "100%"]);
  const glowY = useTransform(smoothY, [0, 1], ["0%", "100%"]);

  const handleMouseMove = (e: MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxDist = 500;
    const dx = (e.clientX - centerX) / maxDist;
    const dy = (e.clientY - centerY) / maxDist;
    mouseX.set(Math.max(0, Math.min(1, 0.5 + dx * 0.5)));
    mouseY.set(Math.max(0, Math.min(1, 0.5 + dy * 0.5)));
  };

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{ perspective: "1000px" }}
      onMouseEnter={() => window.addEventListener("mousemove", handleMouseMove)}
      onMouseLeave={() => {
        window.removeEventListener("mousemove", handleMouseMove);
        mouseX.set(0.5);
        mouseY.set(0.5);
      }}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className="relative"
      >
        {/* Glow behind logo */}
        <motion.div
          className="absolute inset-0 rounded-3xl blur-3xl opacity-40"
          style={{
            background: `radial-gradient(circle at ${glowX} ${glowY}, hsla(48, 96%, 53%, 0.5), transparent 70%)`,
          }}
        />

        {/* Shadow layer for depth */}
        <motion.img
          src={logoIcon}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-contain blur-md opacity-20"
          style={{ transform: "translateZ(-40px) scale(1.1)" }}
        />

        {/* Main logo */}
        <motion.img
          src={logoIcon}
          alt="VitraPay Logo"
          className="relative w-full h-full object-contain drop-shadow-2xl"
          style={{ transform: "translateZ(40px)" }}
        />

        {/* Shine overlay */}
        <motion.div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{
            background: `linear-gradient(135deg, transparent 30%, hsla(48, 96%, 70%, 0.15) 50%, transparent 70%)`,
            transform: "translateZ(50px)",
          }}
        />
      </motion.div>
    </div>
  );
}
