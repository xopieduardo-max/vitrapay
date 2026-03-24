import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const buildVersion = new Date().toISOString();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildVersion),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React - always needed
          if (id.includes('react-dom') || (id.includes('/react/') && !id.includes('react-router'))) {
            return 'vendor-react';
          }
          if (id.includes('react-router-dom')) {
            return 'vendor-router';
          }
          // Supabase - needed for checkout
          if (id.includes('@supabase/')) {
            return 'vendor-supabase';
          }
          // TanStack Query
          if (id.includes('@tanstack/react-query')) {
            return 'vendor-query';
          }
          // Framer Motion - NOT needed for checkout, separate chunk
          if (id.includes('framer-motion')) {
            return 'vendor-motion';
          }
          // Radix UI - split into checkout-needed and rest
          if (id.includes('@radix-ui/react-checkbox') || id.includes('@radix-ui/react-label') || id.includes('@radix-ui/react-separator')) {
            return 'vendor-ui-checkout';
          }
          if (id.includes('@radix-ui/')) {
            return 'vendor-ui';
          }
          // Recharts - only for dashboard
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'vendor-charts';
          }
        },
      },
    },
  },
}));