import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // Fallback values for Lovable Cloud when .env is auto-managed
  const supabaseUrl = env.VITE_SUPABASE_URL || "https://jdnqaxldwyembanatnqd.supabase.co";
  const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkbnFheGxkd3llbWJhbmF0bnFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNDQwMzQsImV4cCI6MjA4NjcyMDAzNH0.M3aTAW4-4ZdvbObSLyi2vqcT3KszZoz4truq17Slpcw";
  const supabaseProjectId = env.VITE_SUPABASE_PROJECT_ID || "jdnqaxldwyembanatnqd";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabaseKey),
      'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify(supabaseProjectId),
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
