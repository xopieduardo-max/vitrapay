import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
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
import AdminUsers from "./pages/AdminUsers";
import AdminSettings from "./pages/AdminSettings";
import Checkout from "./pages/Checkout";
import MemberArea from "./pages/MemberArea";
import Finance from "./pages/Finance";
import NotFound from "./pages/NotFound";

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
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/products" element={<MyProducts />} />
              <Route path="/products/new" element={<CreateProduct />} />
              <Route path="/products/:id/edit" element={<EditProduct />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/affiliates" element={<Affiliates />} />
              <Route path="/library" element={<BuyerLibrary />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/admin/users" element={<AdminUsers />} />
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
