import logoHorizontalBlack from "@/assets/logo-vitrapay-horizontal.png";
import logoHorizontalWhite from "@/assets/logo-vitrapay-horizontal-white.png";
import logoIconBlack from "@/assets/logo-vitrapay.png";
import logoIconWhite from "@/assets/logo-vitrapay-stacked-white.png";
import { useEffect, useState } from "react";

type LogoVariant = "horizontal" | "icon";

interface ThemeLogoProps {
  variant?: LogoVariant;
  className?: string;
  alt?: string;
}

function useIsDark() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

const logos = {
  horizontal: { light: logoHorizontalBlack, dark: logoHorizontalWhite },
  icon: { light: logoIconBlack, dark: logoIconWhite },
};

export function ThemeLogo({ variant = "horizontal", className = "", alt = "VitraPay" }: ThemeLogoProps) {
  const isDark = useIsDark();
  const src = isDark ? logos[variant].dark : logos[variant].light;

  return <img src={src} alt={alt} className={className} />;
}
