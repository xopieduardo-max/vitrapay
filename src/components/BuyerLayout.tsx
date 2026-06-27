import { Outlet, useNavigate } from "react-router-dom";
import { ThemeLogo } from "@/components/ThemeLogo";
import { UserHeaderDropdown } from "@/components/UserHeaderDropdown";
import { TermsAcceptanceModal } from "@/components/TermsAcceptanceModal";

export default function BuyerLayout() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="h-14 flex items-center gap-4 border-b border-border px-4 md:px-8 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
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
  );
}
