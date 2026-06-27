import { Outlet, useNavigate } from "react-router-dom";
import { ThemeLogo } from "@/components/ThemeLogo";
import { UserHeaderDropdown } from "@/components/UserHeaderDropdown";
import { TermsAcceptanceModal } from "@/components/TermsAcceptanceModal";

export default function BuyerLayout() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen relative overflow-hidden bg-[#080808] text-white">
      {/* Animated yellow gradient blobs — same style as login page */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -right-32 top-1/2 -translate-y-1/2 h-[700px] w-[700px] rounded-full opacity-80 blur-[120px]"
          style={{ background: "radial-gradient(circle, hsl(48, 96%, 53%) 0%, hsl(38, 92%, 45%) 40%, transparent 70%)" }}
        />
        <div
          className="absolute -left-40 bottom-0 h-[500px] w-[500px] rounded-full opacity-60 blur-[120px]"
          style={{ background: "radial-gradient(circle, hsl(38, 92%, 50%) 0%, hsl(20, 85%, 40%) 50%, transparent 75%)" }}
        />
        <div
          className="absolute right-1/3 top-10 h-[300px] w-[300px] rounded-full opacity-40 blur-[100px]"
          style={{ background: "radial-gradient(circle, hsl(54, 100%, 60%) 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="h-14 flex items-center gap-4 border-b border-white/10 px-4 md:px-8 bg-black/40 backdrop-blur-md sticky top-0 z-30">
          <button onClick={() => navigate("/home")} className="shrink-0">
            <ThemeLogo variant="horizontal" className="h-6" />
          </button>
          <div className="ml-auto">
            <UserHeaderDropdown />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
        <TermsAcceptanceModal />
      </div>
    </div>
  );
}
