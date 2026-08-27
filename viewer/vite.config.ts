import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pagesのサブパス配下でも動くよう相対パスで出力する
  base: './',
  server: { port: 8000 },
  // maplibreのワーカーはESMのまま出す（createMap.ts の setWorkerUrl を参照）
  worker: { format: 'es' },
  define: {
    __BUILD_TIME__: JSON.stringify(
      new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'),
  },
})
