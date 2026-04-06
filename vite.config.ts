import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  return {
    base: './',
    server: {
      host: '::',
      port: 8080,
    },
    plugins: [
      tailwindcss(),
      react(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify('6.2.1'),
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            router: ['react-router-dom'],
            ui: ['framer-motion', 'lucide-react'],
            charts: ['recharts'],
            supabase: ['@supabase/supabase-js'],
            xlsx: ['xlsx'],
            pdf: ['jspdf', 'jspdf-autotable'],
          },
        },
      },
    },
  };
});
