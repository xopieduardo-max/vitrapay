import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import AdminLayout from "@/components/admin/AdminLayout";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Marketplace from "./pages/Marketplace";
import ProductDetail from "./pages/ProductDetail";
import MyProducts from "./pages/MyProducts";
import CreateProduct from "./pages/CreateProduct";
import EditProduct from "./pages/EditProduct";
import CheckoutBuilder from "./pages/CheckoutBuilder";
import Sales from "./pages/Sales";
import Affiliates from "./pages/Affiliates";
import BuyerLibrary from "./pages/BuyerLibrary";
import Purchases from "./pages/Purchases";
import Checkout from "./pages/Checkout";
import MemberArea from "./pages/MemberArea";
import Finance from "./pages/Finance";
import NotFound from "./pages/NotFound";
import TermsOfUse from "./pages/TermsOfUse";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Community from "./pages/Community";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminSettings from "./pages/AdminSettings";
import AdminWithdrawals from "./pages/AdminWithdrawals";
import AdminBanners from "./pages/admin/AdminBanners";
import AdminPopups from "./pages/admin/AdminPopups";
import AdminFakeSales from "./pages/admin/AdminFakeSales";
import AdminCommunity from "./pages/admin/AdminCommunity";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/checkout/:id" element={<Checkout />} />
            <Route path="/learn/:productId" element={<MemberArea />} />
            <Route path="/terms" element={<TermsOfUse />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />

            {/* Producer panel */}
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
            </Route>

            {/* Admin panel */}
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/withdrawals" element={<AdminWithdrawals />} />
              <Route path="/admin/banners" element={<AdminBanners />} />
              <Route path="/admin/popups" element={<AdminPopups />} />
              <Route path="/admin/fake-sales" element={<AdminFakeSales />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
