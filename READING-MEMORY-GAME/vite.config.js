import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** נרשם לפני ה-error handler הפנימי של Vite — מחזיר 502 + הסבר במקום 500 כש־CBT לא רץ על 5176 */
function attachCbtProxyFriendlyError(proxy) {
  proxy.on('error', (err, _req, res) => {
    try {
      if (!res || typeof res.writeHead !== 'function') return
      if (res.headersSent || res.writableEnded) return
      const detail = String(err && err.message ? err.message : 'unknown').replace(/</g, '&lt;')
      res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        '<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"/>' +
          '<title>מלחמה – שרת לא זמין</title></head>' +
          '<body style="font-family:sans-serif;padding:1.5rem;line-height:1.5">' +
          '<h1>שרת CBT לא רץ או לא נגיש</h1>' +
          '<p>נתיב <code>/cbt</code> מועבר ל־<code>http://127.0.0.1:5176</code>. כשאין שם שרת פעיל, Vite היה מחזיר <strong>HTTP 500</strong> ללא הסבר.</p>' +
          '<p><strong>מה לעשות:</strong> טרמינל נפרד → <code>cd CBT</code> → <code>npm run dev</code> — וודאו שמופיע משהו כמו ' +
          '<code>Local: http://localhost:5176/cbt/</code>, ואז רעננו את הדף.</p>' +
          `<p><small>פרט טכני: ${detail}</small></p>` +
          '</body></html>'
      )
    } catch {
      /* ignore */
    }
  })
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@math-games': path.resolve(__dirname, '../MATH-GAMES/src')
    }
  },
  server: {
    port: 5175,
    host: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/socket.io': { target: 'http://127.0.0.1:5000', ws: true },
      /* CBT – אותו מקור כמו READING (5175); חובה שגם CBT רץ (5176) */
      '/cbt': {
        target: 'http://127.0.0.1:5176',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          attachCbtProxyFriendlyError(proxy)
        }
      }
    }
  }
})
