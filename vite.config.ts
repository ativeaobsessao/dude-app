import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    // A remoção da linha 'root' fará o Vite buscar o index.html na raiz do projeto (Padrão GitHub/Cloudflare)
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        // Ajustado para apontar para o diretório src correto
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});