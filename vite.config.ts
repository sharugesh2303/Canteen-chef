import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables for the current build mode (e.g., 'production')
  // This correctly loads VITE_ variables into 'env'
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    // THIS RESOLUTION BLOCK TO FORCE POSTCSS/TAILWIND LOADING
    css: {
      postcss: './postcss.config.cjs', // Point to your CommonJS PostCSS config
    },
    // --- UPDATED SECTION ---
    // Explicitly define the environment variable for replacement during build
    define: {
      // This ensures Vercel's environment variable is correctly injected
      // by reading from the 'env' object we just loaded.
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL)
    }
    // --- END UPDATED SECTION ---
  };
});
