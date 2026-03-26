import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import { Loader2 } from "lucide-react";

// Eager: auth only (smallest critical path)
import Auth from "./pages/Auth";

// Lazy: everything including landing
const Landing = lazy(() => import("./pages/Landing"));

// Lazy: everything else
const DashboardLayout = lazy(() => import("@/components/DashboardLayout").then(m => ({ default: m.DashboardLayout })));
const AdminLayout = lazy(() => import("@/components/admin/AdminLayout"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const MyProducts = lazy(() => import("./pages/MyProducts"));
const CreateProduct = lazy(() => import("./pages/CreateProduct"));
const EditProduct = lazy(() => import("./pages/EditProduct"));
const CheckoutBuilder = lazy(() => import("./pages/CheckoutBuilder"));
const Sales = lazy(() => import("./pages/Sales"));
const Affiliates = lazy(() => import("./pages/Affiliates"));
const BuyerLibrary = lazy(() => import("./pages/BuyerLibrary"));
const Purchases = lazy(() => import("./pages/Purchases"));
const Checkout = lazy(() => import("./pages/Checkout"));
const MemberArea = lazy(() => import("./pages/MemberArea"));
const Finance = lazy(() => import("./pages/Finance"));
const Transactions = lazy(() => import("./pages/Transactions"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const PurchaseTerms = lazy(() => import("./pages/PurchaseTerms"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Community = lazy(() => import("./pages/Community"));
const Settings = lazy(() => import("./pages/Settings"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Install = lazy(() => import("./pages/Install"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const MinhaConta = lazy(() => import("./pages/MinhaConta"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const Taxas = lazy(() => import("./pages/Taxas"));


// Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminWithdrawals = lazy(() => import("./pages/AdminWithdrawals"));
const AdminBanners = lazy(() => import("./pages/admin/AdminBanners"));
const AdminPopups = lazy(() => import("./pages/admin/AdminPopups"));
const AdminFakeSales = lazy(() => import("./pages/admin/AdminFakeSales"));
const AdminCommunity = lazy(() => import("./pages/admin/AdminCommunity"));
const AdminPushNotifications = lazy(() => import("./pages/admin/AdminPushNotifications"));
const AdminUserDetail = lazy(() => import("./pages/admin/AdminUserDetail"));
const AdminFeeSimulator = lazy(() => import("./pages/admin/AdminFeeSimulator"));
const AdminDisputes = lazy(() => import("./pages/admin/AdminDisputes"));
const AdminProductDetail = lazy(() => import("./pages/admin/AdminProductDetail"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

const UtmCapture = lazy(() => import("@/components/UtmCapture").then(m => ({ default: m.UtmCapture })));

const App = () => {
  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <UtmCapture />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/checkout/:id" element={<Checkout />} />
              
              <Route path="/terms" element={<TermsOfUse />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/purchase-terms" element={<PurchaseTerms />} />
              <Route path="/install" element={<Install />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/minha-conta" element={<MinhaConta />} />

              {/* Protected routes */}
              <Route element={<AuthGuard />}>
                {/* Standalone protected pages (no sidebar) */}
                <Route path="/learn/:productId" element={<MemberArea />} />

                {/* Producer panel with sidebar */}
                <Route element={<DashboardLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/marketplace" element={<Marketplace />} />
                  <Route path="/product/:id" element={<ProductDetail />} />
                  <Route path="/products" element={<MyProducts />} />
                  <Route path="/products/new" element={<CreateProduct />} />
                  <Route path="/products/:id/edit" element={<EditProduct />} />
                  <Route path="/products/:id/checkout-builder" element={<CheckoutBuilder />} />
                  <Route path="/sales" element={<Sales />} />
                  <Route path="/affiliates" element={<Affiliates />} />
                  <Route path="/library" element={<BuyerLibrary />} />
                  <Route path="/purchases" element={<Purchases />} />
                  <Route path="/finance" element={<Finance />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/community" element={<Community />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/integrations" element={<Integrations />} />
                  <Route path="/help" element={<HelpCenter />} />
                  <Route path="/taxas" element={<Taxas />} />
                </Route>
              </Route>

              {/* Admin panel */}
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/users/:userId" element={<AdminUserDetail />} />
                <Route path="/admin/withdrawals" element={<AdminWithdrawals />} />
                <Route path="/admin/banners" element={<AdminBanners />} />
                <Route path="/admin/popups" element={<AdminPopups />} />
                <Route path="/admin/fake-sales" element={<AdminFakeSales />} />
                <Route path="/admin/community" element={<AdminCommunity />} />
                <Route path="/admin/push" element={<AdminPushNotifications />} />
                <Route path="/admin/fee-simulator" element={<AdminFeeSimulator />} />
                <Route path="/admin/disputes" element={<AdminDisputes />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/admin/product/:productId" element={<AdminProductDetail />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
