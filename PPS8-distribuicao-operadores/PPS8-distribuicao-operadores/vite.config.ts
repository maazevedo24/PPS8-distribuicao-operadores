import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const figmaAssetFallback = {
  name: 'figma-asset-fallback',
  resolveId(id: string) {
    if (id.startsWith('figma:asset/')) {
      return `\0${id}`
    }
    return null
  },
  load(id: string) {
    if (id.startsWith('\0figma:asset/')) {
      // 1x1 transparent gif so local development works without Figma runtime assets.
      return 'export default "data:image/gif;base64,R0lGODlhAQABAAAAACw="'
    }
    return null
  },
}

export default defineConfig({
  base: '/texpact-wp3-pps8-operators/',
  plugins: [
    figmaAssetFallback,
    react(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
    strictPort: true,
    allowedHosts: ['dev.citeve.pt'],
  },
  preview: {
    allowedHosts: ['dev.citeve.pt'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})