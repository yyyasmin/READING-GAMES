import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BASE = '/soccer-board/'

/** בלי זה: פתיחה ב־http://localhost:5178/ מבקשת /src/main.jsx ומקבלת 404 — דף לבן. */
function redirectRootToBase() {
  return {
    name: 'redirect-root-to-soccer-board-base',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url || ''
        const pathOnly = raw.split('?')[0] || ''
        const search = raw.includes('?') ? raw.slice(raw.indexOf('?')) : ''
        const rootPath = BASE.replace(/\/$/, '')
        const withBase = search ? `${rootPath}/${search}` : BASE
        if (pathOnly === '/' || pathOnly === '/index.html') {
          res.statusCode = 302
          res.setHeader('Location', withBase)
          res.end()
          return
        }
        if (pathOnly === '/soccer-board' || pathOnly === '/soccer-board/index.html') {
          res.statusCode = 302
          res.setHeader('Location', withBase)
          res.end()
          return
        }
        next()
      })
    }
  }
}

export default defineConfig({
  base: BASE,
  plugins: [react(), redirectRootToBase()],
  server: {
    port: 5178,
    host: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true }
    }
  }
})
