import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Memastikan hasil build Vite dilempar ke folder ekstensi utama
    outDir: '../out/webview-ui',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Menghilangkan hash acak agar namanya tetap main.js dan index.css
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
});